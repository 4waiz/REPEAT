/**
 * REPEAT Observer — content script.
 *
 * This is the real version of the observation layer the in-app workspace
 * simulates. Its only job is to turn a raw DOM interaction into a
 * SemanticEvent-shaped object, and to refuse to look at anything sensitive.
 *
 * Design rules, in order of importance:
 *
 *   1. Never read a password, payment or otherwise sensitive input. Not even
 *      to discard it later — the value is never touched.
 *   2. Never record coordinates, key codes or CSS selectors. Only meaning.
 *   3. Prefer saying "I don't know what that was" over guessing.
 */

/* ------------------------------------------------------------------------ */
/* 1. Redaction                                                             */
/* ------------------------------------------------------------------------ */

const SENSITIVE_INPUT_TYPES = new Set(['password', 'hidden']);

const SENSITIVE_NAME_PATTERN =
  /(pass|pwd|secret|token|otp|pin|cvv|cvc|card|credit|iban|account[-_]?number|ssn|social)/i;

const SENSITIVE_AUTOCOMPLETE =
  /(current-password|new-password|cc-number|cc-csc|cc-exp|one-time-code)/i;

/** True when an element must never be read from. */
function isSensitive(el) {
  if (!el) return false;
  if (el instanceof HTMLInputElement) {
    if (SENSITIVE_INPUT_TYPES.has(el.type)) return true;
    if (SENSITIVE_AUTOCOMPLETE.test(el.autocomplete || '')) return true;
  }
  const haystack = [el.name, el.id, el.getAttribute?.('aria-label'), el.className]
    .filter((v) => typeof v === 'string')
    .join(' ');
  if (SENSITIVE_NAME_PATTERN.test(haystack)) return true;
  // Respect the standard opt-out.
  return Boolean(el.closest?.('[data-repeat-ignore], [autocomplete*="password"]'));
}

/** True when the whole page should be left alone. */
function pageIsExcluded() {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return true;
  // A page containing a password field is treated as an auth surface.
  return Boolean(document.querySelector('input[type="password"]'));
}

/* ------------------------------------------------------------------------ */
/* 2. App identification                                                    */
/* ------------------------------------------------------------------------ */

/** Map a hostname to the semantic app REPEAT reasons about. */
function identifyApp() {
  const host = location.hostname;
  if (/mail\.google|outlook\.(office|live)|mail\./.test(host)) return 'mail';
  if (/github\.com|gitlab\.com|atlassian\.net|linear\.app/.test(host)) return 'tracker';
  if (/slack\.com|teams\.microsoft|discord\.com/.test(host)) return 'chat';
  if (host === 'localhost') return 'repeat';
  return 'unknown';
}

/* ------------------------------------------------------------------------ */
/* 3. Intent inference                                                      */
/* ------------------------------------------------------------------------ */

/**
 * Accessible label for a control, without reading any value.
 * Text content only — never `.value`.
 */
function accessibleLabel(el) {
  if (!el) return '';
  const aria = el.getAttribute?.('aria-label');
  if (aria) return aria.trim().slice(0, 80);
  const text = (el.innerText || el.textContent || '').trim();
  if (text) return text.replace(/\s+/g, ' ').slice(0, 80);
  const title = el.getAttribute?.('title');
  return title ? title.trim().slice(0, 80) : '';
}

/**
 * Verb table. Deliberately conservative: an unrecognised control produces a
 * generic `ui.activate` rather than a confident wrong guess.
 */
const INTENT_RULES = [
  { test: /^(create|new|open)\s+(issue|ticket|bug|task)/i, action: 'tracker.create_issue', intent: 'create engineering ticket' },
  { test: /^(submit|create|save)\s*(issue|ticket)?$/i, action: 'tracker.create_issue', intent: 'commit the ticket to the tracker' },
  { test: /\bassign\b/i, action: 'tracker.assign_owner', intent: 'give the ticket to the responsible engineer' },
  { test: /\blabel|\btag\b/i, action: 'tracker.apply_labels', intent: 'categorise the ticket for triage' },
  { test: /\bpriorit/i, action: 'tracker.set_priority', intent: 'record how urgent the issue is' },
  { test: /^(send|post|reply)\b/i, action: 'chat.notify_team', intent: 'notify the team' },
  { test: /^(copy)\b/i, action: 'mail.copy_content', intent: 'capture the report content for reuse' },
];

function inferAction(label, app) {
  for (const rule of INTENT_RULES) {
    if (rule.test.test(label)) return { action: rule.action, intent: rule.intent };
  }
  if (app === 'mail') return { action: 'mail.read_message', intent: 'read an inbound message' };
  return { action: 'ui.activate', intent: `activated "${label || 'a control'}"` };
}

/* ------------------------------------------------------------------------ */
/* 4. Event emission                                                        */
/* ------------------------------------------------------------------------ */

let enabled = true;
const queue = [];
let flushTimer = null;

chrome.storage?.local?.get(['repeatEnabled'], (result) => {
  enabled = result?.repeatEnabled !== false;
});

chrome.storage?.onChanged?.addListener((changes) => {
  if (changes.repeatEnabled) enabled = changes.repeatEnabled.newValue !== false;
});

function emit(event) {
  if (!enabled) return;
  queue.push(event);
  if (flushTimer) return;
  // Batch so a busy page does not produce a request per click.
  flushTimer = setTimeout(flush, 600);
}

async function flush() {
  flushTimer = null;
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    await chrome.runtime.sendMessage({ type: 'repeat:events', events: batch });
  } catch {
    // The receiver may not be running. Dropping observations is always
    // preferable to retrying them somewhere unexpected.
  }
}

function buildEvent(action, intent, data) {
  return {
    timestamp: new Date().toISOString(),
    sourceApp: identifyApp(),
    action,
    semanticIntent: intent,
    // Page identity only: origin and path shape, never the query string,
    // which routinely carries tokens and personal data.
    pageContext: {
      origin: location.origin,
      path: location.pathname.replace(/\/\d+/g, '/:id'),
      title: document.title.slice(0, 120),
    },
    structuredData: data,
    confidence: action === 'ui.activate' ? 0.4 : 0.85,
    origin: 'observed',
  };
}

/* ------------------------------------------------------------------------ */
/* 5. Listeners                                                             */
/* ------------------------------------------------------------------------ */

if (!pageIsExcluded()) {
  const app = identifyApp();

  // Meaningful activations: buttons, links and role=button only. Arbitrary
  // clicks on the document are noise, not workflow.
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const control = target?.closest('button, a, [role="button"], [type="submit"]');
      if (!control || isSensitive(control)) return;

      const label = accessibleLabel(control);
      const { action, intent } = inferAction(label, app);
      emit(buildEvent(action, intent, { control: label, controlKind: control.tagName.toLowerCase() }));
    },
    { capture: true, passive: true },
  );

  // Form submission: record that a form was submitted and which fields it
  // had. Field NAMES only — never a single field value.
  document.addEventListener(
    'submit',
    (e) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement) || isSensitive(form)) return;
      const fields = Array.from(form.elements)
        .filter((el) => el.name && !isSensitive(el))
        .map((el) => el.name)
        .slice(0, 25);
      emit(
        buildEvent('form.submit', 'submitted a form', {
          fieldNames: fields,
          fieldCount: fields.length,
        }),
      );
    },
    { capture: true, passive: true },
  );

  // Copy: record that a copy happened and roughly how much, never the text.
  document.addEventListener(
    'copy',
    () => {
      const length = (window.getSelection()?.toString() || '').length;
      emit(
        buildEvent('mail.copy_content', 'captured content for reuse', {
          characterCount: length,
        }),
      );
    },
    { capture: true, passive: true },
  );

  // Tab visibility, so the receiver can reason about app switching.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      emit(buildEvent('app.focus', `moved attention to ${app}`, {}));
    }
  });

  window.addEventListener('pagehide', flush);
}

