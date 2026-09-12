import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { ActionResult, PermissionClass } from '@/types';
import { DEMO_MODE } from '@/lib/demo/config';
import { ClickUpIssueTrackerAdapter, clickUpConfig } from '@/lib/adapters/clickup';
import {
  AmbiguousChatAdapter,
  AmbiguousIssueTrackerAdapter,
  ambiguousConfig,
} from '@/lib/adapters/ambiguous';
import { GitHubIssueTrackerAdapter, SlackMessagingAdapter } from '@/lib/adapters/github';
import type { IssueTrackerAdapter, MessagingAdapter } from '@/lib/adapters/types';
import { assertExecutable } from '@/lib/policy/policy';

/**
 * Live execution endpoint — one consequential action per call.
 *
 * The executor in the browser keeps its guarantees (per-action policy
 * guard, stop on failure, resume-not-restart) and the credentials stay on
 * the server: for each consequential step it sends the resolved action here,
 * and this route binds the real adapter. The permission class is derived
 * from the action on the server — the client's claim is not trusted — and
 * the same `assertExecutable` guard the executor uses is re-applied.
 *
 * Adapter binding, by environment (TRACKER=clickup|ambiguous|github forces one):
 *   tracker    ClickUp (CLICKUP_API_KEY + CLICKUP_LIST_ID), else an Ambiguous
 *              workspace (AMBIGUOUS_API_KEY), else GitHub (GITHUB_TOKEN +
 *              GITHUB_REPO), else the credential-free Ambiguous sandbox
 *              (AMBIGUOUS_SANDBOX=true), else none
 *   messaging  Slack (SLACK_WEBHOOK_URL), else an Ambiguous channel
 *              (AMBIGUOUS_API_KEY + AMBIGUOUS_CHANNEL_ID), else none — the
 *              browser then keeps the replica chat
 *
 * Returns 409 while Demo Mode is on: live execution is disabled by design.
 */

export const runtime = 'nodejs';

const CreateIssueParams = z.object({
  issueTitle: z.string().min(1),
  issueDescription: z.string(),
  labels: z.array(z.string()).default([]),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

const AssignParams = z.object({
  owner: z.string().min(1),
  issueId: z.string().optional(),
  issueNumber: z.number().optional(),
});

const NotifyParams = z.object({ channel: z.string().min(1), teamMessage: z.string().min(1) });

const BodySchema = z.discriminatedUnion('action', [
  z.object({ approved: z.boolean(), action: z.literal('tracker.create_issue'), params: CreateIssueParams }),
  z.object({ approved: z.boolean(), action: z.literal('tracker.assign_owner'), params: AssignParams }),
  z.object({ approved: z.boolean(), action: z.literal('chat.notify_team'), params: NotifyParams }),
]);

/** The permission each live action carries — decided here, not by the caller. */
const PERMISSION: Record<z.infer<typeof BodySchema>['action'], PermissionClass> = {
  'tracker.create_issue': 'create_external',
  'tracker.assign_owner': 'create_external',
  'chat.notify_team': 'send_message',
};

type Bound<T> = { adapter: T; target: string };

function bindTracker(): Bound<IssueTrackerAdapter> | null {
  const forced = (process.env.TRACKER ?? '').trim().toLowerCase();

  const clickUp = clickUpConfig();
  const ambiguous = ambiguousConfig();
  const gitHubToken = process.env.GITHUB_TOKEN;
  const gitHubRepo = process.env.GITHUB_REPO;

  const candidates: { key: string; bind: () => Bound<IssueTrackerAdapter> | null }[] = [
    {
      key: 'clickup',
      bind: () =>
        clickUp ? { adapter: new ClickUpIssueTrackerAdapter(clickUp), target: `ClickUp list ${clickUp.listId}` } : null,
    },
    {
      key: 'ambiguous',
      bind: () =>
        ambiguous?.mode === 'workspace'
          ? { adapter: new AmbiguousIssueTrackerAdapter(ambiguous), target: 'Ambiguous · workspace' }
          : null,
    },
    {
      key: 'github',
      bind: () =>
        gitHubToken && gitHubRepo
          ? { adapter: new GitHubIssueTrackerAdapter(gitHubToken, gitHubRepo), target: `GitHub ${gitHubRepo}` }
          : null,
    },
    {
      key: 'ambiguous',
      bind: () =>
        ambiguous?.mode === 'sandbox'
          ? { adapter: new AmbiguousIssueTrackerAdapter(ambiguous), target: 'Ambiguous · sandbox (synthetic, one hour)' }
          : null,
    },
  ];

  const ordered = forced ? candidates.filter((c) => c.key === forced) : candidates;
  for (const candidate of ordered) {
    const bound = candidate.bind();
    if (bound) return bound;
  }
  return null;
}

function bindMessaging(): Bound<MessagingAdapter> | null {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (webhook) return { adapter: new SlackMessagingAdapter(webhook), target: 'Slack webhook' };
  const ambiguous = ambiguousConfig();
  if (ambiguous?.mode === 'workspace' && ambiguous.channelId) {
    return {
      adapter: new AmbiguousChatAdapter(ambiguous.base, ambiguous.apiKey, ambiguous.channelId),
      target: `Ambiguous channel ${ambiguous.channelId}`,
    };
  }
  return null;
}

/** Cached ClickUp list name, so the UI can say where tickets will land. */
let listNameCache: { id: string; name: string } | null = null;

async function describeTracker(): Promise<{ name: string; live: boolean; target: string } | null> {
  const bound = bindTracker();
  if (!bound) return null;
  const clickUp = clickUpConfig();
  if (clickUp && bound.adapter.name === 'clickup') {
    if (listNameCache?.id !== clickUp.listId) {
      try {
        const response = await fetch(`https://api.clickup.com/api/v2/list/${clickUp.listId}`, {
          headers: { authorization: clickUp.apiKey },
          signal: AbortSignal.timeout(4000),
        });
        if (response.ok) {
          const list = (await response.json()) as { name?: string };
          if (list.name) listNameCache = { id: clickUp.listId, name: list.name };
        }
      } catch {
        // Best effort; the id is still a truthful target.
      }
    }
    const listName = listNameCache?.id === clickUp.listId ? listNameCache.name : null;
    return { name: 'clickup', live: true, target: listName ? `ClickUp · ${listName}` : bound.target };
  }
  return { name: bound.adapter.name, live: true, target: bound.target };
}

/** What live execution would touch. The UI reads this once, in live mode. */
export async function GET() {
  if (DEMO_MODE) {
    return NextResponse.json({ demoMode: true, tracker: null, messaging: null });
  }
  const messaging = bindMessaging();
  return NextResponse.json({
    demoMode: false,
    tracker: await describeTracker(),
    messaging: messaging ? { name: messaging.adapter.name, live: true, target: messaging.target } : null,
  });
}

export async function POST(request: Request) {
  if (DEMO_MODE) {
    return NextResponse.json(
      { error: 'Demo Mode is on. Live execution is disabled by design.' },
      { status: 409 },
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // The guard the executor runs per action, re-run here with the server's
  // own idea of the permission class. An unapproved run never reaches an
  // adapter, whatever the caller claims.
  const permission = PERMISSION[body.action];
  try {
    assertExecutable({ approved: body.approved, permission });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Blocked by policy' },
      { status: 403 },
    );
  }

  let result: ActionResult;
  switch (body.action) {
    case 'tracker.create_issue': {
      const tracker = bindTracker();
      if (!tracker) {
        return notConfigured(
          'No issue tracker configured (CLICKUP_API_KEY + CLICKUP_LIST_ID, AMBIGUOUS_API_KEY, GITHUB_TOKEN + GITHUB_REPO, or AMBIGUOUS_SANDBOX=true).',
        );
      }
      result = await tracker.adapter.createIssue({
        title: body.params.issueTitle,
        body: body.params.issueDescription,
        labels: body.params.labels,
        priority: body.params.severity,
      });
      break;
    }
    case 'tracker.assign_owner': {
      const tracker = bindTracker();
      if (!tracker) return notConfigured('No issue tracker configured.');
      result = await tracker.adapter.assignIssue(
        { number: body.params.issueNumber ?? 0, id: body.params.issueId },
        body.params.owner,
      );
      break;
    }
    case 'chat.notify_team': {
      const messaging = bindMessaging();
      if (!messaging) return notConfigured('No messaging adapter configured (SLACK_WEBHOOK_URL).');
      result = await messaging.adapter.postMessage({
        channel: body.params.channel,
        body: body.params.teamMessage,
      });
      break;
    }
  }

  // A failed action is reported truthfully with a 2xx: the executor decides
  // what a failure means for the run; transport errors are the 4xx/5xx ones.
  return NextResponse.json(result);
}

function notConfigured(message: string) {
  return NextResponse.json({ error: message }, { status: 412 });
}
