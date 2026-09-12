/**
 * Ambiguous AI integration self-test — no account needed.
 *
 * Mints one disposable sandbox session, runs the demo's third bug through the
 * real pipeline (deterministic understanding → plan), files the planned
 * ticket through the same adapter /api/execute binds, and checks it landed:
 *
 *   - the session is a real sb_ bearer token with a one-hour expiry
 *   - the planned "Create issue" step creates a task (title, priority, body)
 *   - the owner is recorded honestly (the sandbox has no assignee field)
 *   - the task can be read back and found by priority filter
 *   - revoking the session makes the token useless (401)
 *
 * Rate limits are per IP (10 sessions/hour), so this runs once per call and
 * is never looped. Run with:  npm run verify:ambiguous
 */
import { BUG_1, BUG_2, BUG_3 } from '@/lib/demo/fixtures';
import { understandDeterministic } from '@/lib/agents/understanding';
import { buildTrace } from '@/lib/demo/trace-builder';
import { detect } from '@/lib/patterns/detector';
import { compilePattern } from '@/lib/patterns/compiler';
import { planRun } from '@/lib/agents/ghost-runner';
import { AmbiguousIssueTrackerAdapter, sandboxSession } from '@/lib/adapters/ambiguous';

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail?: string) {
  checks += 1;
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!condition) failures += 1;
}

function section(title: string) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

async function main() {
  section('1. Sandbox session');
  const session = await sandboxSession(true);
  console.log(`  base=${session.base} expires in ${Math.round((session.expiresAt - Date.now()) / 1000)}s`);
  check('token is an sb_ bearer', /^sb_[A-Za-z0-9_-]{20,}$/.test(session.token));
  check('session lasts about an hour', session.expiresAt - Date.now() > 3000_000);

  section('2. Plan the demo run (no network)');
  const u1 = understandDeterministic(BUG_1);
  const u2 = understandDeterministic(BUG_2);
  const u3 = understandDeterministic(BUG_3);
  const detected = detect([
    buildTrace(BUG_1, u1, 'Observation 1'),
    buildTrace(BUG_2, u2, 'Observation 2', { issueNumber: 43, variation: 'reread' }),
  ]);
  if (detected.kind !== 'pattern') throw new Error('detector did not find a pattern');
  const pattern = { ...compilePattern(detected.matched), status: 'active' as const };
  const run = planRun(pattern, BUG_3, u3, 44);
  const create = run.proposedActions.find((a) => a.action === 'tracker.create_issue');
  const assign = run.proposedActions.find((a) => a.action === 'tracker.assign_owner');
  if (!create || !assign) throw new Error('plan is missing tracker steps');
  console.log(`  planned: "${create.resolvedParams.issueTitle}" -> ${assign.resolvedParams.owner}`);

  section('3. File it through the adapter');
  const adapter = new AmbiguousIssueTrackerAdapter({ mode: 'sandbox' });
  const created = await adapter.createIssue({
    title: String(create.resolvedParams.issueTitle),
    body: String(create.resolvedParams.issueDescription),
    labels: (create.resolvedParams.labels as string[]) ?? [],
    priority: (create.resolvedParams.severity as 'low' | 'medium' | 'high' | 'critical') ?? 'medium',
  });
  console.log(`  ${created.summary}${created.error ? ` — ${created.error}` : ''}`);
  check('task created', created.ok, created.error);
  const taskId = String(created.data?.id ?? '');
  const taskKey = String(created.data?.taskKey ?? '');
  check('task has an id and a key', Boolean(taskId) && /^[A-Z]+-\d+$/.test(taskKey), taskKey);

  const assigned = await adapter.assignIssue({ number: 44, id: taskId }, String(assign.resolvedParams.owner));
  console.log(`  ${assigned.summary}${assigned.error ? ` — ${assigned.error}` : ''}`);
  check('owner recorded honestly', assigned.ok && assigned.data?.recordedAs === 'description-note', assigned.summary);

  section('4. Read it back');
  const headers = { authorization: `Bearer ${session.token}` };
  const one = await fetch(`${session.base}/api/tasks/${taskId}`, { headers });
  const { task } = (await one.json()) as {
    task: { title: string; priority: string; description: string; status: string };
  };
  check('title round-trips', task.title === String(create.resolvedParams.issueTitle), task.title);
  check('priority mapped', task.priority === 'medium', task.priority);
  check('body carries the report and the labels', task.description.includes('Reported by') && task.description.includes('Labels: bug'));
  check('owner note present', task.description.includes(`Owner: ${String(assign.resolvedParams.owner)}`));
  check('status is todo', task.status === 'todo', task.status);

  const filtered = await fetch(`${session.base}/api/tasks?priority=medium&limit=50`, { headers });
  const list = (await filtered.json()) as { data: { id: string }[] };
  check('found by priority filter', list.data.some((t) => t.id === taskId), `${list.data.length} medium tasks`);

  section('5. Revoke');
  const revoked = await fetch(`${session.base}/session`, { method: 'DELETE', headers });
  check('session revoked', revoked.status === 204, String(revoked.status));
  const after = await fetch(`${session.base}/api/tasks/${taskId}`, { headers });
  check('token is dead afterwards', after.status === 401, String(after.status));

  console.log(`\n${'='.repeat(52)}`);
  console.log(`${checks - failures}/${checks} checks passed`);
  if (failures > 0) {
    console.log(`${failures} FAILED`);
    process.exit(1);
  }
  console.log('ambiguous OK');
}

main().catch((err) => {
  console.error('\nverify-ambiguous crashed:');
  console.error(err);
  process.exit(1);
});
