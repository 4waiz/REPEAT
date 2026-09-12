import type { ActionResult, IssueSeverity, TrackerIssue } from '@/types';
import { type CreateIssueInput, type IssueTrackerAdapter, fail, ok } from './types';

/**
 * Jira Cloud issue tracker adapter.
 *
 * Same contract as the ClickUp and in-memory adapters, bound by
 * /api/execute when JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN and
 * JIRA_PROJECT_KEY are set (and TRACKER=jira, or no ClickUp key).
 *
 * Jira Cloud REST API v3: Basic auth with the Atlassian account email and an
 * API token; descriptions are Atlassian Document Format, so the markdown
 * body is turned into ADF paragraphs; assignment is by accountId, resolved
 * from the project's assignable users by display name.
 */

/** REPEAT severity -> default Jira priority scheme names. */
const PRIORITY: Record<IssueSeverity, string> = {
  critical: 'Highest',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};
const SEVERITY_OF: Record<string, IssueSeverity> = {
  highest: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  lowest: 'low',
};

export type JiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectKey: string;
  issueType: string;
  /** Explicit owner-name -> accountId map, e.g. "Noor=5b10ac8d...,Umar=..." */
  assignees: Record<string, string>;
};

export function jiraConfig(env: NodeJS.ProcessEnv = process.env): JiraConfig | null {
  const baseUrl = env.JIRA_BASE_URL?.trim().replace(/\/$/, '');
  const email = env.JIRA_EMAIL?.trim();
  const apiToken = env.JIRA_API_TOKEN?.trim();
  const projectKey = env.JIRA_PROJECT_KEY?.trim();
  if (!baseUrl || !email || !apiToken || !projectKey) return null;

  const assignees: Record<string, string> = {};
  for (const pair of (env.JIRA_ASSIGNEES ?? '').split(',')) {
    const [name, id] = pair.split('=').map((s) => s.trim());
    if (name && id) assignees[name.toLowerCase()] = id;
  }

  return {
    baseUrl,
    email,
    apiToken,
    projectKey,
    issueType: env.JIRA_ISSUE_TYPE?.trim() || 'Bug',
    assignees,
  };
}

/** A minimal, valid Atlassian Document Format body: one paragraph per line. */
export function toAdf(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
  return {
    type: 'doc',
    version: 1,
    content: (paragraphs.length ? paragraphs : [text.trim() || ' ']).map((p) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: p }],
    })),
  };
}

type JiraUser = { accountId: string; displayName?: string; emailAddress?: string };

type JiraIssue = {
  id: string;
  key: string;
  fields?: {
    summary?: string;
    created?: string;
    labels?: string[];
    priority?: { name?: string } | null;
    assignee?: { displayName?: string } | null;
    status?: { name?: string; statusCategory?: { key?: string } } | null;
  };
};

export class JiraIssueTrackerAdapter implements IssueTrackerAdapter {
  readonly name = 'jira';
  readonly live = true;

  private readonly config: JiraConfig;
  private usersCache: JiraUser[] | null = null;

  constructor(config: JiraConfig) {
    this.config = config;
  }

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64');
    return fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Basic ${auth}`,
        accept: 'application/json',
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  }

  /** Users who can be assigned in the project, fetched once. */
  private async assignableUsers(): Promise<JiraUser[]> {
    if (this.usersCache) return this.usersCache;
    const response = await this.call(
      `/rest/api/3/user/assignable/search?project=${encodeURIComponent(this.config.projectKey)}&maxResults=50`,
    );
    if (!response.ok) throw new Error(`Jira refused the user lookup (${response.status})`);
    this.usersCache = (await response.json()) as JiraUser[];
    return this.usersCache;
  }

  async resolveAssignee(owner: string): Promise<JiraUser | null> {
    const key = owner.trim().toLowerCase();
    const mapped = this.config.assignees[key];
    if (mapped) return { accountId: mapped, displayName: owner };
    const users = await this.assignableUsers();
    return (
      users.find((u) => (u.displayName ?? '').toLowerCase() === key) ??
      users.find((u) => (u.displayName ?? '').toLowerCase().startsWith(key)) ??
      users.find((u) => (u.emailAddress ?? '').toLowerCase().startsWith(key)) ??
      null
    );
  }

  /** Recent issues in the project, newest first, in REPEAT's issue shape. */
  async listIssues(limit = 30): Promise<TrackerIssue[]> {
    const body = JSON.stringify({
      jql: `project = "${this.config.projectKey}" ORDER BY created DESC`,
      maxResults: limit,
      fields: ['summary', 'created', 'labels', 'priority', 'assignee', 'status'],
    });
    // The 2025 search endpoint first; older sites still answer on /search.
    let response = await this.call('/rest/api/3/search/jql', { method: 'POST', body });
    if (response.status === 404 || response.status === 410) {
      response = await this.call('/rest/api/3/search', { method: 'POST', body });
    }
    if (!response.ok) throw new Error(`Jira refused the search (${response.status})`);
    const data = (await response.json()) as { issues?: JiraIssue[] };
    return (data.issues ?? []).map((issue) => this.toTrackerIssue(issue));
  }

  private toTrackerIssue(issue: JiraIssue): TrackerIssue {
    const f = issue.fields ?? {};
    const number = Number(issue.key.split('-').pop()) || 0;
    return {
      id: issue.id,
      number,
      key: issue.key,
      title: f.summary ?? issue.key,
      body: '',
      labels: f.labels ?? [],
      priority: SEVERITY_OF[(f.priority?.name ?? '').toLowerCase()] ?? 'medium',
      assignee: f.assignee?.displayName || undefined,
      createdAt: f.created ?? new Date(0).toISOString(),
      createdBy: 'human',
      state: f.status?.statusCategory?.key === 'done' ? 'closed' : 'open',
      url: `${this.config.baseUrl}/browse/${issue.key}`,
      provider: 'jira',
    };
  }

  async createIssue(input: CreateIssueInput): Promise<ActionResult> {
    const started = Date.now();
    try {
      const response = await this.call('/rest/api/3/issue', {
        method: 'POST',
        body: JSON.stringify({
          fields: {
            project: { key: this.config.projectKey },
            issuetype: { name: this.config.issueType },
            summary: input.title.slice(0, 255),
            description: toAdf(input.body),
            // Jira labels cannot contain spaces.
            labels: input.labels.map((l) => l.replace(/\s+/g, '-')),
            priority: { name: PRIORITY[input.priority] },
          },
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        return fail(this.name, `Jira refused the issue (${response.status}): ${detail.slice(0, 200)}`, Date.now() - started);
      }

      const created = (await response.json()) as { id: string; key: string };
      return ok(
        this.name,
        `Issue ${created.key} created in Jira`,
        { id: created.key, key: created.key, url: `${this.config.baseUrl}/browse/${created.key}` },
        Date.now() - started,
      );
    } catch (error) {
      return fail(this.name, error instanceof Error ? error.message : 'Jira request failed', Date.now() - started);
    }
  }

  async assignIssue(issueRef: { number: number; id?: string }, owner: string): Promise<ActionResult> {
    const started = Date.now();
    if (!issueRef.id) {
      return fail(this.name, 'No Jira issue key to assign — the create step did not run.', Date.now() - started);
    }
    try {
      const user = await this.resolveAssignee(owner);
      if (!user) {
        return fail(
          this.name,
          `No assignable Jira user matches "${owner}". Add JIRA_ASSIGNEES=${owner}=<accountId> to .env.`,
          Date.now() - started,
        );
      }
      const response = await this.call(`/rest/api/3/issue/${issueRef.id}/assignee`, {
        method: 'PUT',
        body: JSON.stringify({ accountId: user.accountId }),
      });
      if (!response.ok) {
        return fail(this.name, `Jira refused the assignment (${response.status})`, Date.now() - started);
      }
      return ok(
        this.name,
        `Assigned to ${user.displayName ?? owner} in Jira`,
        { owner, assigneeId: user.accountId, assigneeName: user.displayName },
        Date.now() - started,
      );
    } catch (error) {
      return fail(this.name, error instanceof Error ? error.message : 'Jira request failed', Date.now() - started);
    }
  }
}
