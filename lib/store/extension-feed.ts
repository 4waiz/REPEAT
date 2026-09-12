import type { MailMessage, SemanticAction } from '@/types';
import { makeId } from '@/lib/utils';
import type { RepeatState } from './repeat-store';

/**
 * The extension feed: what the human really did, in the real tabs.
 *
 * The Chrome extension posts semantic events to /api/observe. In live mode
 * the workspace polls that buffer and pushes each event through the same
 * observe() path the replica apps use — so reading a report in the real
 * Gmail tab and filing it in the real ClickUp or Jira tab is observed
 * exactly like clicking through the replicas. Demo Mode never polls.
 *
 * The extension reports actions; content comes from the connected inbox.
 * A `mail.read_message` event is matched to the message the mail connector
 * already fetched, so the body never travels through the page observer.
 */

export type ObservedEvent = {
  seq: number;
  timestamp: string;
  sourceApp: string;
  action: string;
  semanticIntent: string;
  pageContext?: { origin: string; path: string; title: string };
  structuredData?: Record<string, unknown>;
};

/** Actions the engine reasons over; anything else is page noise. */
const KNOWN: Set<string> = new Set<SemanticAction>([
  'mail.read_message',
  'mail.copy_content',
  'tracker.open_composer',
  'tracker.compose_issue',
  'tracker.apply_labels',
  'tracker.set_priority',
  'tracker.assign_owner',
  'tracker.create_issue',
  'chat.open_channel',
  'chat.compose_message',
  'chat.notify_team',
]);

/** Sent by the extension popup's "Finish observation" control. */
export const WORKFLOW_COMPLETE = 'workflow.complete';

const POLL_MS = 2000;
const DEDUP_MS = 1500;
/** A Create click and the tracker's own confirmation are one action. */
const CREATE_CONFIRM_MS = 30_000;
let lastCreateAt = 0;
/** A ticket was filed and nothing else happened: the observation is over. */
const IDLE_AFTER_CREATE_MS = 60_000;

type Store = {
  getState: () => RepeatState;
};

function str(data: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = data?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Find the inbox message an observed read refers to, if the connector has it. */
function matchInboxMessage(state: RepeatState, data: Record<string, unknown> | undefined): MailMessage | null {
  const id = str(data, 'messageId') ?? str(data, 'threadId');
  if (id) {
    const byId = state.inbox.find((m) => m.id === id || m.id.endsWith(id));
    if (byId) return byId;
  }
  const subject = str(data, 'subject')?.toLowerCase();
  const email = str(data, 'customerEmail')?.toLowerCase();
  if (!subject && !email) return null;
  return (
    state.inbox.find(
      (m) =>
        (!subject || m.subject.toLowerCase() === subject) && (!email || m.fromEmail.toLowerCase() === email),
    ) ?? null
  );
}

/**
 * Apply one observed event to the store. Returns a short description of
 * what happened, for the timeline, or null when the event was ignored.
 */
export function applyObservedEvent(store: Store, event: ObservedEvent): string | null {
  const state = store.getState();
  const data = event.structuredData ?? {};

  if (event.action === WORKFLOW_COMPLETE) {
    if (!state.activeTrace) return null;
    state.completeTrace();
    return 'Observation finished from the extension';
  }

  if (!KNOWN.has(event.action)) return null;
  const action = event.action as SemanticAction;

  // A run in flight is REPEAT's turn, not the human's; do not learn from it.
  if (['ghost_run', 'executing'].includes(state.phase)) return null;

  if (action === 'mail.read_message') {
    // Only a real "message opened" counts: it names the message. The generic
    // click rule in mail apps sends reads with no subject — those are noise.
    if (!str(data, 'subject') && !str(data, 'messageId') && !str(data, 'threadId')) return null;

    const current = state.activeTrace;
    const filed = current?.events.some((e) => e.action === 'tracker.create_issue');
    const worked = current?.events.some((e) => e.action.startsWith('tracker.') || e.action.startsWith('chat.'));
    // Opening another report after a ticket was filed means the previous
    // pass is over — a human rarely announces that explicitly. Opening one
    // when nothing was filed yet means the earlier read was just reading.
    if (filed) state.completeTrace();
    else if (current && !worked) state.abandonTrace();

    let message = matchInboxMessage(store.getState(), data);
    if (!message) {
      // Not in the connected inbox (or no inbox connected): keep what the
      // observer could see — sender and subject — so the trace still starts.
      const subject = str(data, 'subject') ?? 'Support email';
      message = {
        id: makeId('mail_ext'),
        from: str(data, 'customerName') ?? str(data, 'customerEmail')?.split('@')[0] ?? 'Customer',
        fromEmail: str(data, 'customerEmail') ?? 'unknown@customer',
        subject,
        body: str(data, 'snippet') ?? subject,
        receivedAt: event.timestamp,
        read: true,
        fixtureRef: 'extension',
      };
      state.receiveMail(message);
    }
    store.getState().readMail(message.id);
    return `Read "${message.subject}" in ${event.pageContext?.origin ?? event.sourceApp}`;
  }

  if (!state.activeTrace) return null;

  const payload: Record<string, unknown> = {};
  for (const key of [
    'issueTitle', 'issueDescription', 'labels', 'severity', 'owner', 'area',
    'issueNumber', 'issueKey', 'taskId', 'url', 'channel', 'teamMessage',
  ]) {
    if (data[key] !== undefined) payload[key] = data[key];
  }

  if (action === 'tracker.create_issue') {
    const now = Date.parse(event.timestamp) || Date.now();
    const confirmation = now - lastCreateAt < CREATE_CONFIRM_MS;
    lastCreateAt = now;
    // The real board has the truth about what was just filed.
    void store.getState().refreshSurfaces();
    if (confirmation) return `Ticket confirmed by the tracker${payload.issueKey ? ` (${payload.issueKey})` : ''}`;
  }

  state.observe(action, payload);

  // Telling the team is the last step of the observed workflow.
  if (action === 'chat.notify_team') store.getState().completeTrace();

  return `${event.semanticIntent} in ${event.pageContext?.origin ?? event.sourceApp}`;
}

/** True when the active trace has filed its ticket and is waiting for more. */
function ticketFiled(state: RepeatState): boolean {
  return Boolean(state.activeTrace?.events.some((e) => e.action === 'tracker.create_issue'));
}

/**
 * Poll /api/observe from the current sequence onwards and apply each new
 * event. Returns a stop function. Events that arrived before the workspace
 * opened are skipped — they belong to a session that is not this one.
 */
export function startExtensionFeed(
  store: Store,
  onApplied: (event: ObservedEvent, summary: string) => void,
): () => void {
  let cursor: number | null = null;
  let seenKey = '';
  let seenAt = 0;
  let stopped = false;
  let announced = new Set<string>();
  let lastEventAt = 0;

  const tick = async () => {
    if (stopped) return;
    try {
      if (store.getState().settings.observationPaused) return;

      // Silence after the ticket: close the observation so the detector can
      // compare it, rather than waiting forever for a notify step.
      const idle = store.getState();
      if (ticketFiled(idle) && lastEventAt && Date.now() - lastEventAt > IDLE_AFTER_CREATE_MS) {
        idle.completeTrace();
        onApplied(
          { seq: cursor ?? 0, timestamp: new Date().toISOString(), sourceApp: 'repeat', action: 'workflow.complete', semanticIntent: 'observation finished' },
          'Observation finished — no further actions after the ticket',
        );
        lastEventAt = 0;
      }
      const url = cursor === null ? '/api/observe' : `/api/observe?since=${cursor}`;
      const response = await fetch(url);
      if (!response.ok) return;
      const data = (await response.json()) as { events: ObservedEvent[]; seq: number };
      if (cursor === null) {
        cursor = data.seq;
        return;
      }
      for (const event of data.events) {
        cursor = Math.max(cursor, event.seq);
        const key = `${event.action}|${JSON.stringify(event.structuredData ?? {})}`;
        const at = Date.parse(event.timestamp) || Date.now();
        // The same action twice within a moment is one click, not two.
        if (key === seenKey && at - seenAt < DEDUP_MS) continue;
        seenKey = key;
        seenAt = at;
        const origin = event.pageContext?.origin ?? event.sourceApp;
        if (!announced.has(origin)) {
          announced.add(origin);
          onApplied(event, `Watching ${origin}`);
        }
        const summary = applyObservedEvent(store, event);
        if (summary) {
          lastEventAt = Date.now();
          onApplied(event, summary);
        }
      }
    } catch {
      // The server is away; try again next tick.
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), POLL_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
    announced = new Set();
  };
}
