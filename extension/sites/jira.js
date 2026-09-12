/**
 * REPEAT Observer — Jira Cloud extractor (*.atlassian.net).
 *
 * The create-issue dialog is the workflow surface. Inside it:
 *   - a change on the Priority / Labels / Assignee pickers becomes
 *     tracker.set_priority / tracker.apply_labels / tracker.assign_owner,
 *     read from the selected option's text (never from key events);
 *   - the Create button becomes tracker.create_issue carrying the Summary
 *     and Description the human typed (the observe route caps and scrubs
 *     both);
 *   - the success flag ("You've created …" with a /browse/KEY-N link) confirms
 *     the issue key, which REPEAT's Jira connector then reads for the truth.
 *
 * Jira's dialog was redesigned mid-2026 and its test ids are not public, so
 * everything here keys off accessible names and roles, and a miss simply
 * falls back to content.js's generic verb table.
 */
(() => {
  const api = globalThis.REPEAT_OBSERVER;
  if (!api) return;

  const text = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const PRIORITY = { highest: 'critical', high: 'high', medium: 'medium', low: 'low', lowest: 'low' };

  function dialogOf(el) {
    return el ? el.closest('dialog[open], [role="dialog"]') : null;
  }

  /** Accessible name of a form control: aria-label, aria-labelledby, or its <label>. */
  function fieldName(el) {
    if (!el) return '';
    const aria = el.getAttribute('aria-label');
    if (aria) return aria.trim();
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const names = by
        .split(/\s+/)
        .map((id) => text(document.getElementById(id)))
        .filter(Boolean);
      if (names.length) return names.join(' ');
    }
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return text(label);
    }
    const wrapper = el.closest('label');
    return wrapper ? text(wrapper) : '';
  }

  function fieldByName(dialog, pattern) {
    const candidates = dialog.querySelectorAll('input, textarea, [contenteditable="true"], [role="combobox"], [role="textbox"]');
    for (const el of candidates) {
      if (pattern.test(fieldName(el)) || pattern.test(el.id || '') || pattern.test(el.getAttribute('name') || '')) return el;
    }
    return null;
  }

  function fieldText(el) {
    if (!el) return '';
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return (el.value || '').trim();
    return text(el);
  }

  let lastCreateHint = 0;
  const confirmed = new Set();

  api.registerSite({
    name: 'jira',
    handleClick(control, label) {
      const dialog = dialogOf(control);
      if (!dialog) return null;

      if (/^create( issue| work item)?$/i.test(label)) {
        const summary = fieldByName(dialog, /summary|title/i);
        const description = fieldByName(dialog, /description/i);
        lastCreateHint = Date.now();
        return api.buildEvent('tracker.create_issue', 'commit the ticket to the tracker', {
          issueTitle: fieldText(summary).slice(0, 200),
          issueDescription: fieldText(description).slice(0, 2000),
          createdAtHint: lastCreateHint,
        });
      }
      // Pickers are handled on change; the click that opens them is noise.
      if (/priority|labels?|assignee|reporter|issue type|work type/i.test(label)) return false;
      return null;
    },

    watch() {
      // Picker selections: read the chosen option, never the keystrokes.
      document.addEventListener(
        'click',
        (e) => {
          const target = e.target instanceof Element ? e.target : null;
          const option = target && target.closest('[role="option"]');
          if (!option) return;
          const dialog = dialogOf(option) || document.querySelector('dialog[open], [role="dialog"]');
          if (!dialog) return;
          const listbox = option.closest('[role="listbox"]');
          const owner = listbox
            ? document.querySelector(`[aria-controls="${CSS.escape(listbox.id || '')}"], [aria-owns="${CSS.escape(listbox.id || '')}"]`)
            : null;
          const name = (fieldName(owner) || fieldName(listbox) || '').toLowerCase();
          const value = text(option);
          if (!value) return;
          if (/priority/.test(name)) {
            const severity = PRIORITY[value.toLowerCase()];
            if (severity) api.emit(api.buildEvent('tracker.set_priority', 'record how urgent the issue is', { severity }));
          } else if (/label/.test(name)) {
            api.emit(api.buildEvent('tracker.apply_labels', 'categorise the ticket for triage', { labels: [value.slice(0, 40)] }));
          } else if (/assignee/.test(name)) {
            api.emit(api.buildEvent('tracker.assign_owner', 'give the ticket to the responsible engineer', { owner: value.slice(0, 80) }));
          }
        },
        { capture: true, passive: true },
      );

      // Success flag with the new key: the tracker's own confirmation.
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (!(node instanceof Element)) continue;
            const alert = node.matches('[role="alert"]') ? node : node.querySelector('[role="alert"]');
            if (!alert) continue;
            const link = alert.querySelector('a[href*="/browse/"]');
            const match = link && /\/browse\/([A-Z][A-Z0-9_]*-\d+)/.exec(link.getAttribute('href') || '');
            if (!match || confirmed.has(match[1])) continue;
            confirmed.add(match[1]);
            api.emit(
              api.buildEvent('tracker.create_issue', 'ticket confirmed by the tracker', {
                issueKey: match[1],
                issueNumber: Number(match[1].split('-')[1]),
                url: new URL(link.getAttribute('href'), location.origin).toString(),
                confirmedAfterHintMs: lastCreateHint ? Date.now() - lastCreateHint : undefined,
              }),
            );
          }
        }
      }).observe(document.body, { childList: true, subtree: true });

      // Opening the dialog is the composer step.
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (!(node instanceof Element)) continue;
            const dialog = node.matches('dialog[open], [role="dialog"]') ? node : node.querySelector('dialog[open], [role="dialog"]');
            if (dialog && fieldByName(dialog, /summary/i)) {
              api.emit(api.buildEvent('tracker.open_composer', 'begin authoring an engineering ticket', { url: location.origin + location.pathname }));
            }
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    },
  });
})();
