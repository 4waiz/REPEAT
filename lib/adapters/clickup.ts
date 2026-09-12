import type { ActionResult, IssueSeverity, TrackerIssue } from '@/types';
import { type CreateIssueInput, type IssueTrackerAdapter, fail, ok } from './types';

/**
 * ClickUp issue tracker adapter.
 *
 * The ticket REPEAT files lands in a real ClickUp list instead of the
 * replica tracker. Same interface as the demo adapter, so the planner and
 * executor do not know the difference; only /api/execute binds it, and only
 * when Demo Mode is off and CLICKUP_API_KEY + CLICKUP_LIST_ID exist.
 *
 * ClickUp API v2 (developer.clickup.com). A personal token is sent as-is in
 * the Authorization header — no "Bearer" prefix.
 */

export const CLICKUP_API = 'https://api.clickup.com/api/v2';

/** ClickUp priority ids: 1 urgent, 2 high, 3 normal, 4 low. */
const PRIORITY: Record<IssueSeverity, number> = { critical: 1, high: 2, medium: 3, low: 4 };
/** And back, from the priority *name* the list endpoint returns. */
const SEVERITY_OF: Record<string, IssueSeverity> = { urgent: 'critical', high: 'high', normal: 'medium', low: 'low' };

export type ClickUpMember = { id: number; username: string; email?: string };

export type ClickUpConfig = {
  apiKey: string;
  listId: string;
  /** Workspace id; used to look up members for assignment. */
  teamId?: string;
  /** Explicit owner-name -> ClickUp user id map, e.g. "Noor=123,Umar=456". */
  assignees: Record<string, number>;
};

export function clickUpConfig(env: NodeJS.ProcessEnv = process.env): ClickUpConfig | null {
  const apiKey = env.CLICKUP_API_KEY?.trim();
  const listId = env.CLICKUP_LIST_ID?.trim();
  if (!apiKey || !listId) return null;

  const assignees: Record<string, number> = {};
  for (const pair of (env.CLICKUP_ASSIGNEES ?? '').split(',')) {
    const [name, id] = pair.split('=').map((s) => s.trim());
    if (name && id && /^\d+$/.test(id)) assignees[name.toLowerCase()] = Number(id);
  }

  return { apiKey, listId, teamId: env.CLICKUP_TEAM_ID?.trim() || undefined, assignees };
}

type ClickUpTask = {
  id: string;
  custom_id?: string | null;
  name: string;
  url: string;
  description?: string | null;
  date_created?: string;
  status?: { status?: string; type?: string };
  priority?: { priority?: string } | null;
  tags?: { name: string }[];
  assignees?: { username?: string }[];
};

export class ClickUpIssueTrackerAdapter implements IssueTrackerAdapter {
  readonly name = 'clickup';
  readonly live = true;

  private membersCache: ClickUpMember[] | null = null;
  private readonly config: ClickUpConfig;

  constructor(config: ClickUpConfig) {
    this.config = config;
  }

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${CLICKUP_API}${path}`, {
      ...init,
      headers: {
        authorization: this.config.apiKey,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  }

  /** Workspace members, fetched once. Used to turn "Noor" into a user id. */
  async members(): Promise<ClickUpMember[]> {
    if (this.membersCache) return this.membersCache;
    const response = await this.call('/team');
    if (!response.ok) throw new Error(`ClickUp refused the workspace lookup (${response.status})`);
    const data = (await response.json()) as {
      teams?: { id: string; members?: { user?: { id: number; username?: string; email?: string } }[] }[];
    };
    const teams = (data.teams ?? []).filter((t) => !this.config.teamId || t.id === this.config.teamId);
    this.membersCache = teams.flatMap((t) =>
      (t.members ?? [])
        .map((m) => m.user)
        .filter((u): u is { id: number; username?: string; email?: string } => Boolean(u?.id))
        .map((u) => ({ id: u.id, username: u.username ?? '', email: u.email })),
    );
    return this.membersCache;
  }

  /**
   * Owner name -> ClickUp user. The explicit map wins; otherwise the first
   * member whose username starts with the name (the team uses first names).
   */
  async resolveAssignee(owner: string): Promise<ClickUpMember | null> {
    const key = owner.trim().toLowerCase();
    const mapped = this.config.assignees[key];
    if (mapped) {
      const known = (await this.members()).find((m) => m.id === mapped);
      return known ?? { id: mapped, username: owner };
    }
    const members = await this.members();
    return (
      members.find((m) => m.username.toLowerCase() === key) ??
      members.find((m) => m.username.toLowerCase().startsWith(key)) ??
      null
    );
  }

  /**
   * The list as it is right now, newest first, in REPEAT's issue shape — so
   * the tracker window can show the real board, not a replica of it.
   */
  async listTasks(limit = 30): Promise<TrackerIssue[]> {
    const response = await this.call(
      `/list/${this.config.listId}/task?archived=false&order_by=created&reverse=true&include_closed=true&page=0`,
    );
    if (!response.ok) throw new Error(`ClickUp refused the task list (${response.status})`);
    const data = (await response.json()) as { tasks?: ClickUpTask[] };
    return (data.tasks ?? []).slice(0, limit).map((t) => ({
      id: t.id,
      number: 0,
      key: t.custom_id ?? t.id,
      title: t.name,
      body: t.description ?? '',
      labels: (t.tags ?? []).map((x) => x.name),
      priority: SEVERITY_OF[t.priority?.priority ?? ''] ?? 'medium',
      assignee: t.assignees?.[0]?.username || undefined,
      createdAt: t.date_created ? new Date(Number(t.date_created)).toISOString() : new Date(0).toISOString(),
      createdBy: 'human',
      state: t.status?.type === 'closed' || t.status?.type === 'done' ? 'closed' : 'open',
      url: t.url,
      provider: 'clickup',
    }));
  }

  async createIssue(input: CreateIssueInput): Promise<ActionResult> {
    const started = Date.now();
    try {
      const response = await this.call(`/list/${this.config.listId}/task`, {
        method: 'POST',
        body: JSON.stringify({
          name: input.title,
          markdown_description: input.body,
          tags: input.labels,
          priority: PRIORITY[input.priority],
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        return fail(
          this.name,
          `ClickUp refused the task (${response.status}): ${detail.slice(0, 160)}`,
          Date.now() - started,
        );
      }

      const task = (await response.json()) as ClickUpTask;
      return ok(
        this.name,
        `Task ${task.custom_id ?? task.id} created in ClickUp`,
        { id: task.id, url: task.url, customId: task.custom_id ?? undefined },
        Date.now() - started,
      );
    } catch (error) {
      return fail(this.name, error instanceof Error ? error.message : 'ClickUp request failed', Date.now() - started);
    }
  }

  async assignIssue(issueRef: { number: number; id?: string }, owner: string): Promise<ActionResult> {
    const started = Date.now();
    if (!issueRef.id) {
      return fail(this.name, 'No ClickUp task id to assign — the create step did not run.', Date.now() - started);
    }
    try {
      const member = await this.resolveAssignee(owner);
      if (!member) {
        return fail(
          this.name,
          `No ClickUp member matches "${owner}". Add CLICKUP_ASSIGNEES=${owner}=<user id> to .env.`,
          Date.now() - started,
        );
      }

      const response = await this.call(`/task/${issueRef.id}`, {
        method: 'PUT',
        body: JSON.stringify({ assignees: { add: [member.id] } }),
      });
      if (!response.ok) {
        return fail(this.name, `ClickUp refused the assignment (${response.status})`, Date.now() - started);
      }

      return ok(
        this.name,
        `Assigned to ${member.username || owner} in ClickUp`,
        { owner, assigneeId: member.id, assigneeName: member.username },
        Date.now() - started,
      );
    } catch (error) {
      return fail(this.name, error instanceof Error ? error.message : 'ClickUp request failed', Date.now() - started);
    }
  }
}
