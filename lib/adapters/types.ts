import type { ActionResult, IssueSeverity, MailMessage } from '@/types';

/**
 * Adapter contracts.
 *
 * Every side effect REPEAT can have on the world goes through one of these.
 * Demo Mode binds the deterministic in-memory implementations; setting
 * DEMO_MODE=false with credentials present binds the live ones. The agent,
 * planner and executor never know which is which.
 */

export type CreateIssueInput = {
  title: string;
  body: string;
  labels: string[];
  priority: IssueSeverity;
};

export type CreateIssueData = {
  id: string;
  number: number;
  url?: string;
};

export interface IssueTrackerAdapter {
  readonly name: string;
  /** True when this adapter touches a real external service. */
  readonly live: boolean;
  createIssue(input: CreateIssueInput): Promise<ActionResult>;
  assignIssue(issueRef: { number: number; id?: string }, owner: string): Promise<ActionResult>;
}

export interface MessagingAdapter {
  readonly name: string;
  readonly live: boolean;
  postMessage(input: { channel: string; body: string }): Promise<ActionResult>;
}

/** Replying to the person who filed the report. Send-only, never reads. */
export interface CustomerMailAdapter {
  readonly name: string;
  readonly live: boolean;
  replyToCustomer(input: {
    /** REPEAT's id for the original message, so the reply threads onto it. */
    messageId: string;
    customerEmail: string;
    body: string;
  }): Promise<ActionResult>;
}

export type AdapterBundle = {
  tracker: IssueTrackerAdapter;
  messaging: MessagingAdapter;
  mail: CustomerMailAdapter;
};

export function ok(
  adapter: string,
  summary: string,
  data?: Record<string, unknown>,
  durationMs = 0,
): ActionResult {
  return { ok: true, summary, data, adapter, durationMs };
}

export function fail(adapter: string, error: string, durationMs = 0): ActionResult {
  return { ok: false, summary: 'Action failed', error, adapter, durationMs };
}
