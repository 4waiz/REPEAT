import type { ActionResult, IssueSeverity } from '@/types';
import {
  type CreateIssueInput,
  type IssueTrackerAdapter,
  type MessagingAdapter,
  fail,
  ok,
} from './types';

/**
 * Live adapters.
 *
 * These exist to prove the architecture is not demo-shaped: the agent,
 * planner and executor are unchanged, only the binding differs. They are
 * server-side only (they hold credentials), reached through /api/execute, and
 * they are never selected while Demo Mode is on.
 */

const PRIORITY_LABEL: Record<IssueSeverity, string> = {
  low: 'priority:low',
  medium: 'priority:medium',
  high: 'priority:high',
  critical: 'priority:critical',
};

export class GitHubIssueTrackerAdapter implements IssueTrackerAdapter {
  readonly name = 'github';
  readonly live = true;

  constructor(
    private readonly token: string,
    /** "owner/repo" */
    private readonly repo: string,
  ) {}

  private async call(path: string, init: RequestInit): Promise<Response> {
    return fetch(`https://api.github.com/repos/${this.repo}${path}`, {
      ...init,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${this.token}`,
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  }

  async createIssue(input: CreateIssueInput): Promise<ActionResult> {
    const started = Date.now();
    try {
      const response = await this.call('/issues', {
        method: 'POST',
        body: JSON.stringify({
          title: input.title,
          body: input.body,
          labels: [...input.labels, PRIORITY_LABEL[input.priority]],
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        return fail(
          this.name,
          `GitHub refused the issue (${response.status}): ${detail.slice(0, 160)}`,
          Date.now() - started,
        );
      }

      const issue = (await response.json()) as { id: number; number: number; html_url: string };
      return ok(
        this.name,
        `Issue #${issue.number} created`,
        { id: String(issue.id), number: issue.number, url: issue.html_url },
        Date.now() - started,
      );
    } catch (error) {
      return fail(
        this.name,
        error instanceof Error ? error.message : 'GitHub request failed',
        Date.now() - started,
      );
    }
  }

  async assignIssue(issueRef: { number: number }, owner: string): Promise<ActionResult> {
    const started = Date.now();
    try {
      // Team names in this prototype are first names, not GitHub logins, so
      // the assignee is mapped via env (e.g. REPEAT_GH_NOOR=some-login).
      const login = process.env[`REPEAT_GH_${owner.toUpperCase()}`];
      if (!login) {
        return fail(
          this.name,
          `No GitHub login mapped for ${owner}. Set REPEAT_GH_${owner.toUpperCase()}.`,
          Date.now() - started,
        );
      }

      const response = await this.call(`/issues/${issueRef.number}/assignees`, {
        method: 'POST',
        body: JSON.stringify({ assignees: [login] }),
      });

      if (!response.ok) {
        return fail(
          this.name,
          `GitHub refused the assignment (${response.status})`,
          Date.now() - started,
        );
      }

      return ok(
        this.name,
        `Issue #${issueRef.number} assigned to ${owner}`,
        { owner, login },
        Date.now() - started,
      );
    } catch (error) {
      return fail(
        this.name,
        error instanceof Error ? error.message : 'GitHub request failed',
        Date.now() - started,
      );
    }
  }
}

export class SlackMessagingAdapter implements MessagingAdapter {
  readonly name = 'slack';
  readonly live = true;

  constructor(private readonly webhookUrl: string) {}

  async postMessage(input: { channel: string; body: string }): Promise<ActionResult> {
    const started = Date.now();
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: input.body }),
      });

      if (!response.ok) {
        return fail(
          this.name,
          `Slack refused the message (${response.status})`,
          Date.now() - started,
        );
      }

      return ok(
        this.name,
        `Posted to #${input.channel}`,
        { channel: input.channel },
        Date.now() - started,
      );
    } catch (error) {
      return fail(
        this.name,
        error instanceof Error ? error.message : 'Slack request failed',
        Date.now() - started,
      );
    }
  }
}

/**
 * Slack via a bot token.
 *
 * An incoming webhook is welded to one channel at install time, which cannot
 * express "announce this in the desk that owns it". A bot token can post
 * anywhere, and with chat:write.public it does not have to be invited to each
 * channel first — so adding a desk in Slack needs no change here.
 */
export class SlackBotMessagingAdapter implements MessagingAdapter {
  readonly name = 'slack';
  readonly live = true;

  constructor(private readonly botToken: string) {}

  async postMessage(input: { channel: string; body: string }): Promise<ActionResult> {
    const started = Date.now();
    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          authorization: `Bearer ${this.botToken}`,
        },
        body: JSON.stringify({ channel: `#${input.channel.replace(/^#/, '')}`, text: input.body }),
      });
      // Slack answers 200 with ok:false for application errors, so the status
      // code alone never proves a message landed.
      const data = (await response.json()) as { ok?: boolean; error?: string; channel?: string };
      if (!response.ok || data.ok !== true) {
        const reason = data.error ?? `HTTP ${response.status}`;
        const channel = `#${input.channel.replace(/^#/, '')}`;
        // Slack's error codes are terse and say nothing about which channel
        // they mean. Naming it and the fix turns a dead end into one action.
        const hint =
          data.error === 'is_archived'
            ? ` — ${channel} is archived; unarchive it in Slack, then retry`
            : data.error === 'channel_not_found'
              ? ` — there is no ${channel} in this workspace; create it, then retry`
              : data.error === 'not_in_channel'
                ? ` — the app is not in ${channel}; invite it, or grant chat:write.public`
                : ` — posting to ${channel}`;
        return fail(this.name, `Slack refused the message: ${reason}${hint}`, Date.now() - started);
      }
      return ok(
        this.name,
        `Posted to #${input.channel.replace(/^#/, '')}`,
        { channel: data.channel },
        Date.now() - started,
      );
    } catch (error) {
      return fail(
        this.name,
        error instanceof Error ? error.message : 'Slack unreachable',
        Date.now() - started,
      );
    }
  }
}
