import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DEMO_MODE } from '@/lib/demo/config';
import { GitHubIssueTrackerAdapter, SlackMessagingAdapter } from '@/lib/adapters/github';
import { PERMISSION_POLICY } from '@/lib/policy/policy';

/**
 * Live execution endpoint.
 *
 * Only reached when Demo Mode is off and the relevant credentials exist. The
 * same policy gate that guards the in-browser executor is re-applied here:
 * the server does not trust the client's claim that a run was approved for a
 * permission class that does not require approval.
 */

export const runtime = 'nodejs';

const BodySchema = z.object({
  approved: z.literal(true),
  issue: z.object({
    title: z.string().min(1),
    body: z.string(),
    labels: z.array(z.string()),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
  }),
  owner: z.string().min(1),
  notify: z.object({ channel: z.string().min(1), body: z.string().min(1) }),
});

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
    // An unapproved or malformed run never reaches an adapter.
    return NextResponse.json({ error: 'Invalid or unapproved run' }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const webhook = process.env.SLACK_WEBHOOK_URL;

  if (!token || !repo) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN and GITHUB_REPO are required for live execution.' },
      { status: 412 },
    );
  }

  // Re-assert the policy server-side rather than trusting the caller.
  for (const permission of ['create_external', 'send_message'] as const) {
    if (PERMISSION_POLICY[permission].requiresApproval && body.approved !== true) {
      return NextResponse.json({ error: 'Approval required' }, { status: 403 });
    }
  }

  const tracker = new GitHubIssueTrackerAdapter(token, repo);
  const results: Record<string, unknown> = {};

  const created = await tracker.createIssue(body.issue);
  results.createIssue = created;
  if (!created.ok) {
    // Stop at the first failure and report it truthfully.
    return NextResponse.json({ ok: false, results }, { status: 502 });
  }

  const number = Number(created.data?.number);
  const assigned = await tracker.assignIssue({ number }, body.owner);
  results.assignIssue = assigned;
  if (!assigned.ok) return NextResponse.json({ ok: false, results }, { status: 502 });

  if (webhook) {
    // Use the real issue number, not whatever the client predicted.
    const messaging = new SlackMessagingAdapter(webhook);
    results.notify = await messaging.postMessage({
      channel: body.notify.channel,
      body: body.notify.body.replace(/#\d+/, `#${number}`),
    });
  } else {
    results.notify = { ok: false, skipped: true, reason: 'SLACK_WEBHOOK_URL not configured' };
  }

  return NextResponse.json({ ok: true, results });
}
