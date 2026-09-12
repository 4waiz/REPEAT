import type { ActionResult, ChatMessage, TrackerIssue } from '@/types';
import { FIRST_ISSUE_NUMBER } from '@/lib/demo/fixtures';
import { makeId } from '@/lib/utils';
import type { FailurePoint } from './demo';
import {
  type CreateIssueInput,
  type CustomerMailAdapter,
  type IssueTrackerAdapter,
  type MessagingAdapter,
  fail,
} from './types';

/**
 * Browser-side adapters for live mode.
 *
 * Each consequential step is sent to POST /api/execute, which holds the
 * credentials, re-asserts the policy and binds the real adapter (ClickUp,
 * GitHub, Slack). The executor in the browser is unchanged — it still runs
 * its per-action guard, stops on failure and resumes without restarting —
 * because these satisfy the same interface the in-memory adapters do.
 *
 * They also keep a local mirror (`issues`, `messages`) so the replica app
 * windows show the real consequence, with a link to the real record.
 */

type RemoteResult = ActionResult & { error?: string };

async function callExecute(
  action:
    | 'tracker.create_issue'
    | 'tracker.assign_owner'
    | 'chat.notify_team'
    | 'mail.reply_customer',
  params: Record<string, unknown>,
): Promise<RemoteResult> {
  const started = Date.now();
  try {
    const response = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // `approved` is asserted again on the server; the executor only reaches
      // this code path after its own guard has passed.
      body: JSON.stringify({ approved: true, action, params }),
    });
    const data = (await response.json()) as Partial<RemoteResult>;
    if (!response.ok) {
      return fail('remote', data.error ?? `Live execution returned ${response.status}`, Date.now() - started);
    }
    return {
      ok: data.ok === true,
      summary: data.summary ?? '',
      data: data.data,
      error: data.error,
      adapter: data.adapter ?? 'remote',
      durationMs: data.durationMs || Date.now() - started,
    };
  } catch (error) {
    return fail('remote', error instanceof Error ? error.message : 'Live execution unreachable', Date.now() - started);
  }
}

export class RemoteIssueTrackerAdapter implements IssueTrackerAdapter {
  readonly name = 'remote:tracker';
  readonly live = true;

  /** Local mirror of what was created, for the replica tracker window. */
  issues: TrackerIssue[] = [];
  failAt: FailurePoint = 'none';

  private nextNumber: number;

  constructor(opts: { startNumber?: number; failAt?: FailurePoint } = {}) {
    this.nextNumber = opts.startNumber ?? FIRST_ISSUE_NUMBER;
    this.failAt = opts.failAt ?? 'none';
  }

  async createIssue(input: CreateIssueInput): Promise<ActionResult> {
    // Error injection still works in live mode — it stops before the network.
    if (this.failAt === 'create_issue') {
      return fail(this.name, 'Issue tracker rejected the request (simulated 502).');
    }

    const result = await callExecute('tracker.create_issue', {
      issueTitle: input.title,
      issueDescription: input.body,
      labels: input.labels,
      severity: input.priority,
    });
    if (!result.ok) return result;

    // The real tracker has its own identifier; REPEAT keeps its running
    // number so downstream references ("#44") stay stable and readable.
    const number = this.nextNumber;
    this.nextNumber += 1;
    const remoteId = typeof result.data?.id === 'string' ? result.data.id : makeId('issue');
    const url = typeof result.data?.url === 'string' ? result.data.url : undefined;
    const provider = (['clickup', 'jira', 'ambiguous'] as const).find((p) => p === result.adapter);
    this.issues.push({
      id: remoteId,
      number,
      key: typeof result.data?.key === 'string' ? result.data.key : typeof result.data?.taskKey === 'string' ? result.data.taskKey : undefined,
      title: input.title,
      body: input.body,
      labels: input.labels,
      priority: input.priority,
      createdAt: new Date().toISOString(),
      createdBy: 'repeat',
      state: 'open',
      url,
      provider,
    });

    return { ...result, data: { ...(result.data ?? {}), id: remoteId, number, url } };
  }

  async assignIssue(issueRef: { number: number; id?: string }, owner: string): Promise<ActionResult> {
    if (this.failAt === 'assign_owner') {
      return fail(this.name, 'Assignment failed: owner not resolvable in tracker.');
    }
    const local = this.issues.find((i) => i.number === issueRef.number);
    const issueId = issueRef.id ?? local?.id;
    const result = await callExecute('tracker.assign_owner', {
      owner,
      issueId,
      issueNumber: issueRef.number,
    });
    if (result.ok && local) {
      local.assignee = typeof result.data?.assigneeName === 'string' && result.data.assigneeName ? String(result.data.assigneeName) : owner;
    }
    return result;
  }
}

export class RemoteMessagingAdapter implements MessagingAdapter {
  readonly name = 'remote:chat';
  readonly live = true;

  messages: ChatMessage[] = [];
  failAt: FailurePoint = 'none';

  constructor(opts: { failAt?: FailurePoint } = {}) {
    this.failAt = opts.failAt ?? 'none';
  }

  async postMessage(input: { channel: string; body: string }): Promise<ActionResult> {
    if (this.failAt === 'notify_team') {
      return fail(this.name, 'Message delivery failed (simulated timeout).');
    }
    const result = await callExecute('chat.notify_team', {
      channel: input.channel,
      teamMessage: input.body,
    });
    if (result.ok) {
      this.messages.push({
        id: makeId('chat'),
        channel: input.channel,
        author: 'REPEAT',
        body: input.body,
        at: new Date().toISOString(),
        sentBy: 'repeat',
      });
    }
    return result;
  }
}

/**
 * The customer acknowledgement, sent for real through connected Gmail. The
 * credentials never leave the server; this only names the message to reply
 * to and the text to send.
 */
export class RemoteCustomerMailAdapter implements CustomerMailAdapter {
  readonly name = 'remote:mail';
  readonly live = true;

  sent: { to: string; body: string }[] = [];

  async replyToCustomer(input: {
    messageId: string;
    customerEmail: string;
    body: string;
  }): Promise<ActionResult> {
    const result = await callExecute('mail.reply_customer', {
      messageId: input.messageId,
      customerEmail: input.customerEmail,
      body: input.body,
    });
    if (result.ok) this.sent.push({ to: input.customerEmail, body: input.body });
    return result;
  }
}
