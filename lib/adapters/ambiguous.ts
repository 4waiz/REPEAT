import type { ActionResult, IssueSeverity } from '@/types';
import {
  type CreateIssueInput,
  type IssueTrackerAdapter,
  type MessagingAdapter,
  fail,
  ok,
} from './types';

/**
 * Ambiguous AI adapters.
 *
 * Ambiguous (app.ambiguous.ai) is a workspace where humans and agents share
 * the same apps — Tasks, Chat, Mail, Docs — and every app has a REST
 * surface. For REPEAT it is a place the ticket can really land, through
 * the same IssueTrackerAdapter contract the in-memory tracker satisfies.
 *
 * Two modes, one adapter:
 *
 *   sandbox    — credential-free. POST /sandbox/session mints a one-hour
 *                bearer token for a disposable, synthetic task board (tasks
 *                only; no assignee field, no chat). Judges can reproduce it
 *                with no account. Limits: 10 sessions/hour/IP, 120 calls/min,
 *                8 KB requests, 2,000-char descriptions, 100 tasks.
 *   workspace  — a real workspace with an `ak_` API key: real tasks with a
 *                real assignee, and a chat channel for the notification.
 *
 * Contracts verified against https://app.ambiguous.ai/sandbox/openapi.json
 * and https://app.ambiguous.ai/api/openapi.json on 12 Sep 2026.
 */

export const AMBIGUOUS_BASE = 'https://app.ambiguous.ai';
export const AMBIGUOUS_SANDBOX_SESSION_URL = `${AMBIGUOUS_BASE}/sandbox/session`;

/** Ambiguous priorities: urgent | high | medium | low. */
const PRIORITY: Record<IssueSeverity, 'urgent' | 'high' | 'medium' | 'low'> = {
  critical: 'urgent',
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const DESCRIPTION_MAX = 2000;

export type AmbiguousConfig =
  | { mode: 'sandbox' }
  | { mode: 'workspace'; base: string; apiKey: string; channelId?: string };

export function ambiguousConfig(env: NodeJS.ProcessEnv = process.env): AmbiguousConfig | null {
  const apiKey = env.AMBIGUOUS_API_KEY?.trim();
  if (apiKey) {
    return {
      mode: 'workspace',
      base: (env.AMBIGUOUS_BASE_URL?.trim() || AMBIGUOUS_BASE).replace(/\/$/, ''),
      apiKey,
      channelId: env.AMBIGUOUS_CHANNEL_ID?.trim() || undefined,
    };
  }
  if ((env.AMBIGUOUS_SANDBOX ?? '').trim().toLowerCase() === 'true') return { mode: 'sandbox' };
  return null;
}

/* ------------------------------------------------------------------------ */
/* Sandbox session                                                          */
/* ------------------------------------------------------------------------ */

type SandboxSession = { token: string; base: string; expiresAt: number; id: string };

let sandboxCache: SandboxSession | null = null;

/**
 * One session per server process, refreshed a minute before it expires.
 * Sessions are rate-limited per IP, and a hackathon venue shares one.
 */
export async function sandboxSession(force = false): Promise<SandboxSession> {
  if (!force && sandboxCache && sandboxCache.expiresAt - Date.now() > 60_000) return sandboxCache;

  const response = await fetch(AMBIGUOUS_SANDBOX_SESSION_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // The endpoint answers 411 to an empty body; `{}` is the documented call.
    body: '{}',
  });
  if (response.status !== 201) {
    throw new Error(`Ambiguous sandbox refused a session (${response.status})`);
  }
  const data = (await response.json()) as {
    id: string;
    access_token: string;
    base_url: string;
    expires_in: number;
  };
  sandboxCache = {
    id: data.id,
    token: data.access_token,
    base: data.base_url.replace(/\/$/, ''),
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return sandboxCache;
}

/* ------------------------------------------------------------------------ */
/* Tracker                                                                  */
/* ------------------------------------------------------------------------ */

type AmbiguousTask = {
  id: string;
  title: string;
  task_key?: string | null;
  priority?: string;
  status?: string;
  assignee_id?: string | null;
  description?: string | null;
};

type AmbiguousUser = { id: string; display_name?: string; username?: string; email?: string };

export class AmbiguousIssueTrackerAdapter implements IssueTrackerAdapter {
  readonly name = 'ambiguous';
  readonly live = true;

  private usersCache: AmbiguousUser[] | null = null;
  private readonly config: AmbiguousConfig;

  constructor(config: AmbiguousConfig) {
    this.config = config;
  }

  /** Base URL and bearer token for the current mode. */
  private async auth(force = false): Promise<{ base: string; token: string }> {
    if (this.config.mode === 'workspace') return { base: this.config.base, token: this.config.apiKey };
    const session = await sandboxSession(force);
    return { base: session.base, token: session.token };
  }

  private async call(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
    const { base, token } = await this.auth();
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(this.config.mode === 'workspace' ? { 'api-version': '1' } : {}),
        ...(init.headers ?? {}),
      },
    });
    // A sandbox token that expired mid-demo is minted again, once.
    if (response.status === 401 && this.config.mode === 'sandbox' && !retried) {
      await this.auth(true);
      return this.call(path, init, true);
    }
    return response;
  }

  async createIssue(input: CreateIssueInput): Promise<ActionResult> {
    const started = Date.now();
    try {
      // The sandbox has no label field; labels are written into the body so
      // nothing the human chose is lost. Workspace mode keeps them too — a
      // label there is a uuid that would need creating first.
      const labelsLine = input.labels.length ? `\n\nLabels: ${input.labels.join(', ')}` : '';
      const description = `${input.body}${labelsLine}`.slice(0, DESCRIPTION_MAX);

      const response = await this.call('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: input.title.slice(0, 255),
          description,
          status: 'todo',
          priority: PRIORITY[input.priority],
        }),
      });

      if (response.status !== 201 && response.status !== 200) {
        const detail = await response.text();
        return fail(
          this.name,
          `Ambiguous refused the task (${response.status}): ${detail.slice(0, 160)}`,
          Date.now() - started,
        );
      }

      const { task } = (await response.json()) as { task: AmbiguousTask };
      const key = task.task_key ?? task.id;
      // No `url`: the API does not return a web address for a task, and the
      // sandbox has no UI at all. The key is the truthful reference.
      return ok(
        this.name,
        `Task ${key} created in Ambiguous${this.config.mode === 'sandbox' ? ' (sandbox)' : ''}`,
        { id: task.id, taskKey: task.task_key ?? undefined },
        Date.now() - started,
      );
    } catch (error) {
      return fail(this.name, error instanceof Error ? error.message : 'Ambiguous request failed', Date.now() - started);
    }
  }

  /** Workspace members, fetched once, for owner-name -> user id. */
  private async users(): Promise<AmbiguousUser[]> {
    if (this.usersCache) return this.usersCache;
    const response = await this.call('/api/users');
    if (!response.ok) throw new Error(`Ambiguous refused the user list (${response.status})`);
    const data = (await response.json()) as AmbiguousUser[] | { users?: AmbiguousUser[]; data?: AmbiguousUser[] };
    this.usersCache = Array.isArray(data) ? data : (data.users ?? data.data ?? []);
    return this.usersCache;
  }

  async assignIssue(issueRef: { number: number; id?: string }, owner: string): Promise<ActionResult> {
    const started = Date.now();
    if (!issueRef.id) {
      return fail(this.name, 'No Ambiguous task id to assign — the create step did not run.', Date.now() - started);
    }

    try {
      if (this.config.mode === 'sandbox') {
        // The sandbox rejects assignee writes (verified: 400). The owner is
        // recorded on the task in the only field it has, and the summary
        // says exactly that rather than pretending an assignment happened.
        const current = await this.call(`/api/tasks/${issueRef.id}`);
        const body = current.ok ? ((await current.json()) as { task?: AmbiguousTask }).task?.description ?? '' : '';
        const note = `Owner: ${owner}`;
        const description = body.includes(note) ? body : `${body}\n\n${note}`.slice(0, DESCRIPTION_MAX);
        const response = await this.call(`/api/tasks/${issueRef.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ description }),
        });
        if (!response.ok) {
          return fail(this.name, `Ambiguous refused the update (${response.status})`, Date.now() - started);
        }
        return ok(
          this.name,
          `Owner ${owner} recorded on the task (the sandbox has no assignee field)`,
          { owner, recordedAs: 'description-note' },
          Date.now() - started,
        );
      }

      const key = owner.trim().toLowerCase();
      const members = await this.users();
      const member =
        members.find((u) => (u.display_name ?? '').toLowerCase() === key || (u.username ?? '').toLowerCase() === key) ??
        members.find((u) => (u.display_name ?? '').toLowerCase().startsWith(key)) ??
        null;
      if (!member) {
        return fail(this.name, `No Ambiguous workspace member matches "${owner}".`, Date.now() - started);
      }

      const response = await this.call(`/api/tasks/${issueRef.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ assignee_id: member.id }),
      });
      if (!response.ok) {
        return fail(this.name, `Ambiguous refused the assignment (${response.status})`, Date.now() - started);
      }
      return ok(
        this.name,
        `Assigned to ${member.display_name ?? member.username ?? owner} in Ambiguous`,
        { owner, assigneeId: member.id, assigneeName: member.display_name ?? member.username },
        Date.now() - started,
      );
    } catch (error) {
      return fail(this.name, error instanceof Error ? error.message : 'Ambiguous request failed', Date.now() - started);
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Chat (workspace mode only)                                               */
/* ------------------------------------------------------------------------ */

export class AmbiguousChatAdapter implements MessagingAdapter {
  readonly name = 'ambiguous:chat';
  readonly live = true;

  private readonly base: string;
  private readonly apiKey: string;
  private readonly channelId: string;

  constructor(base: string, apiKey: string, channelId: string) {
    this.base = base;
    this.apiKey = apiKey;
    this.channelId = channelId;
  }

  async postMessage(input: { channel: string; body: string }): Promise<ActionResult> {
    const started = Date.now();
    try {
      const response = await fetch(`${this.base}/api/channels/${this.channelId}/messages`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
          'api-version': '1',
        },
        body: JSON.stringify({ content: input.body }),
      });
      if (!response.ok) {
        return fail(this.name, `Ambiguous refused the message (${response.status})`, Date.now() - started);
      }
      return ok(this.name, `Posted to Ambiguous channel ${this.channelId}`, { channel: input.channel }, Date.now() - started);
    } catch (error) {
      return fail(this.name, error instanceof Error ? error.message : 'Ambiguous request failed', Date.now() - started);
    }
  }
}
