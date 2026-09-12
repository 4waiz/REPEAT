import type { ActionResult, ChatMessage, TrackerIssue } from '@/types';
import { FIRST_ISSUE_NUMBER, TRACKER_PROJECT } from '@/lib/demo/fixtures';
import { makeId } from '@/lib/utils';
import {
  type CustomerMailAdapter,
  type CreateIssueInput,
  type IssueTrackerAdapter,
  type MessagingAdapter,
  fail,
  ok,
} from './types';

/**
 * Deterministic in-memory adapters.
 *
 * These are the Demo Mode implementations: no network, no clock skew, no
 * rate limits. They keep real state so the replica app windows show genuine
 * consequences of the executed workflow rather than a canned animation.
 */

/** Deliberate failure injection, used by the "simulate error" demo control. */
export type FailurePoint =
  | 'none'
  | 'create_issue'
  | 'assign_owner'
  | 'notify_team'
  | 'reply_customer';

export class DemoIssueTrackerAdapter implements IssueTrackerAdapter {
  readonly name = 'demo:tracker';
  readonly live = false;

  issues: TrackerIssue[] = [];
  failAt: FailurePoint = 'none';

  private nextNumber: number;

  constructor(opts: { startNumber?: number; failAt?: FailurePoint } = {}) {
    this.nextNumber = opts.startNumber ?? FIRST_ISSUE_NUMBER;
    this.failAt = opts.failAt ?? 'none';
  }

  async createIssue(input: CreateIssueInput): Promise<ActionResult> {
    if (this.failAt === 'create_issue') {
      return fail(this.name, 'Issue tracker rejected the request (simulated 502).');
    }
    const number = this.nextNumber;
    this.nextNumber += 1;
    const issue: TrackerIssue = {
      id: makeId('issue'),
      number,
      title: input.title,
      body: input.body,
      labels: input.labels,
      priority: input.priority,
      createdAt: new Date().toISOString(),
      createdBy: 'repeat',
      state: 'open',
      url: `https://tracker.local/${TRACKER_PROJECT.label}/issues/${number}`,
    };
    this.issues.push(issue);
    return ok(this.name, `Issue #${number} created`, {
      id: issue.id,
      number,
      url: issue.url,
    });
  }

  async assignIssue(issueRef: { number: number }, owner: string): Promise<ActionResult> {
    if (this.failAt === 'assign_owner') {
      return fail(this.name, 'Assignment failed: owner not resolvable in tracker.');
    }
    const issue = this.issues.find((i) => i.number === issueRef.number);
    if (!issue) {
      return fail(this.name, `Issue #${issueRef.number} not found.`);
    }
    issue.assignee = owner;
    return ok(this.name, `Issue #${issue.number} assigned to ${owner}`, { owner });
  }
}

export class DemoMessagingAdapter implements MessagingAdapter {
  readonly name = 'demo:chat';
  readonly live = false;

  messages: ChatMessage[] = [];
  failAt: FailurePoint = 'none';

  constructor(opts: { failAt?: FailurePoint } = {}) {
    this.failAt = opts.failAt ?? 'none';
  }

  async postMessage(input: { channel: string; body: string }): Promise<ActionResult> {
    if (this.failAt === 'notify_team') {
      return fail(this.name, 'Message delivery failed (simulated timeout).');
    }
    const message: ChatMessage = {
      id: makeId('chat'),
      channel: input.channel,
      author: 'REPEAT',
      body: input.body,
      at: new Date().toISOString(),
      sentBy: 'repeat',
    };
    this.messages.push(message);
    return ok(this.name, `Posted to #${input.channel}`, { channel: input.channel });
  }
}

/**
 * Demo Mode's customer reply: recorded, never sent. Keeps the same shape as
 * the live adapter so the executor cannot tell them apart.
 */
export class DemoCustomerMailAdapter implements CustomerMailAdapter {
  readonly name = 'demo:mail';
  readonly live = false;

  sent: { to: string; body: string }[] = [];
  failAt: FailurePoint = 'none';

  constructor(opts: { failAt?: FailurePoint } = {}) {
    this.failAt = opts.failAt ?? 'none';
  }

  async replyToCustomer(input: {
    messageId: string;
    customerEmail: string;
    body: string;
  }): Promise<ActionResult> {
    if (this.failAt === 'reply_customer') {
      return fail(this.name, 'Reply delivery failed (simulated timeout).');
    }
    this.sent.push({ to: input.customerEmail, body: input.body });
    return ok(this.name, `Replied to ${input.customerEmail}`, { to: input.customerEmail });
  }
}
