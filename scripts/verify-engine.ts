/**
 * Engine self-test.
 *
 * Runs the whole Behavior-to-Agent pipeline headlessly against the three demo
 * fixtures and asserts the properties the demo depends on:
 *
 *   - each bug is classified into the right engineering area
 *   - two similar traces cross the pattern threshold
 *   - the compiler generalizes owner/customer/title instead of memorizing them
 *   - a billing complaint reroutes to Awaiz even though only Umar was ever observed
 *   - an unapproved run cannot execute
 *
 * Run with:  npm run verify
 */
import { BUG_1, BUG_2, BUG_3 } from '@/lib/demo/fixtures';
import { understandDeterministic } from '@/lib/agents/understanding';
import { buildTrace } from '@/lib/demo/trace-builder';
import { detect, liveConfidence } from '@/lib/patterns/detector';
import { compilePattern } from '@/lib/patterns/compiler';
import { planRun } from '@/lib/agents/ghost-runner';
import { assertExecutable } from '@/lib/policy/policy';
import { executeRun, verifyRun } from '@/lib/agents/executor';
import { DemoIssueTrackerAdapter, DemoCustomerMailAdapter,
  DemoMessagingAdapter } from '@/lib/adapters/demo';
import { formatDuration, formatPercent } from '@/lib/utils';

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail?: string) {
  checks += 1;
  if (condition) {
    console.log(`  PASS  ${label}${detail ? `  (${detail})` : ''}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `  (${detail})` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

async function main() {
  /* -------------------------------------------------------------------- */
  section('1. Understanding');

  const u1 = understandDeterministic(BUG_1);
  const u2 = understandDeterministic(BUG_2);
  const u3 = understandDeterministic(BUG_3);

  for (const [name, u] of [
    ['bug 1', u1],
    ['bug 2', u2],
    ['bug 3', u3],
  ] as const) {
    console.log(
      `  ${name}: area=${u.area} category=${u.category} severity=${u.severity} conf=${formatPercent(u.confidence)}`,
    );
    console.log(`         title: ${u.issueTitle}`);
    console.log(`         evidence: ${u.evidence.join(' | ')}`);
  }

  check('bug 1 is technical support', u1.area === 'technical-support', u1.area);
  check('bug 1 is authentication', u1.category === 'authentication', u1.category);
  check('bug 2 is technical support', u2.area === 'technical-support', u2.area);
  check('bug 2 is performance', u2.category === 'performance', u2.category);
  check('bug 3 is billing', u3.area === 'billing', u3.area);
  check('bug 3 is a data issue', u3.category === 'data', u3.category);
  check('bug 1 customer extracted', u1.customerName === 'Alex Chen', u1.customerName);
  check('bug 3 customer extracted', u3.customerName === 'Daniel Okafor', u3.customerName);
  check('all confidences above floor', [u1, u2, u3].every((u) => u.confidence > 0.6));

  /* -------------------------------------------------------------------- */
  section('2. Observation + pattern detection');

  const trace1 = buildTrace(BUG_1, u1, 'Observation 1');
  check('trace 1 has 13 semantic events', trace1.events.length === 13, String(trace1.events.length));
  check(
    'trace 1 records no coordinates',
    !JSON.stringify(trace1).match(/"x"|"y"|clientX|pageX|selector/),
  );

  const afterOne = detect([trace1]);
  check('one observation is not a pattern', afterOne.kind === 'insufficient', afterOne.kind);

  // Observation 2 is deliberately NOT identical: the human glances back at
  // the email while writing the ticket. The detector has to tolerate that.
  const trace2 = buildTrace(BUG_2, u2, 'Observation 2', { issueNumber: 43, variation: 'reread' });
  check('trace 2 varies from trace 1', trace2.events.length === 14, String(trace2.events.length));

  // Live confidence should climb as the second trace replays the first.
  const partials = [3, 6, 9, 13].map((n) =>
    liveConfidence([trace1], { ...trace2, events: trace2.events.slice(0, n), outcome: undefined }),
  );
  console.log(`  live confidence curve: ${partials.map((p) => formatPercent(p)).join(' -> ')}`);
  check('live confidence rises monotonically', partials.every((p, i) => i === 0 || p >= partials[i - 1]));

  const afterTwo = detect([trace1, trace2]);
  check('two observations form a pattern', afterTwo.kind === 'pattern', afterTwo.kind);
  if (afterTwo.kind !== 'pattern') throw new Error('detector did not find a pattern');
  console.log(`  pattern confidence: ${formatPercent(afterTwo.confidence)}`);
  check('pattern confidence >= 0.82', afterTwo.confidence >= 0.82, formatPercent(afterTwo.confidence));
  check(
    'pattern confidence is not a suspicious 100%',
    afterTwo.confidence < 1,
    formatPercent(afterTwo.confidence),
  );

  /* -------------------------------------------------------------------- */
  section('3. Compilation / generalization');

  const pattern = compilePattern(afterTwo.matched);
  console.log(`  steps: ${pattern.steps.map((s) => s.title).join(' -> ')}`);
  console.log(`  variables: ${pattern.variables.map((v) => v.label).join(', ')}`);
  console.log(`  constants: ${pattern.evidence.constantFields.join(', ')}`);
  console.log(
    `  manual baseline: ${pattern.manualActionCount} actions / ${formatDuration(pattern.manualDurationSeconds)}`,
  );

  check('compiled to 5 steps', pattern.steps.length === 5, String(pattern.steps.length));
  const varNames = pattern.variables.map((v) => v.name);
  check('customer generalized', varNames.includes('customerName'));
  check('title generalized', varNames.includes('issueTitle'));
  check('area generalized', varNames.includes('area'));
  check('owner generalized', varNames.includes('owner'));
  check('channel treated as constant', !varNames.includes('channel'), pattern.evidence.constantFields.join('/'));

  const serialized = JSON.stringify(pattern.steps);
  check('no customer name memorized in steps', !serialized.includes('Alex Chen'));
  check('no owner name memorized in steps', !serialized.includes('Umar'));

  /* -------------------------------------------------------------------- */
  section('4. Ghost Run on an unseen, different bug');

  const active = { ...pattern, status: 'active' as const };
  const run = planRun(active, BUG_3, u3, 43);

  console.log(`  trigger: ${run.triggerSummary}`);
  console.log(`  risk=${run.risk} confidence=${formatPercent(run.confidence)} status=${run.status}`);
  for (const a of run.proposedActions) {
    console.log(`    [${a.permission}] ${a.title}: ${a.detail}`);
  }
  for (const ad of run.adaptations) {
    console.log(`  adaptation: ${ad.field} ${ad.observedValue} -> ${ad.adaptedValue} (${ad.rule})`);
  }

  check('run starts in ghost status', run.status === 'ghost', run.status);
  check('run is not approved', run.approved === false);
  check('risk is low', run.risk === 'low', run.risk);

  const assignAction = run.proposedActions.find((a) => a.action === 'tracker.assign_owner');
  check('owner adapted to Awaiz', assignAction?.resolvedParams.owner === 'Awaiz', String(assignAction?.resolvedParams.owner));
  check('adaptation recorded', run.adaptations.some((a) => a.field === 'owner' && a.adaptedValue === 'Awaiz'));
  check(
    'adaptation cites the routing rule',
    run.adaptations.some((a) => a.rule.includes('billing') && a.rule.includes('Awaiz')),
  );
  check('observed owner was Umar', run.adaptations.some((a) => a.observedValue === 'Umar'));
  check('no unresolved variable bindings', !JSON.stringify(run.proposedActions).includes('$var'));

  /* -------------------------------------------------------------------- */
  section('5. Policy guard');

  let blocked = false;
  try {
    assertExecutable({ approved: false, permission: 'create_external' });
  } catch {
    blocked = true;
  }
  check('unapproved external create is blocked', blocked);

  let sendBlocked = false;
  try {
    assertExecutable({ approved: false, permission: 'send_message' });
  } catch {
    sendBlocked = true;
  }
  check('unapproved send is blocked', sendBlocked);

  let paymentBlocked = false;
  try {
    assertExecutable({ approved: true, permission: 'payment' });
  } catch {
    paymentBlocked = true;
  }
  check('payment blocked even when approved', paymentBlocked);

  let readOk = true;
  try {
    assertExecutable({ approved: false, permission: 'read' });
  } catch {
    readOk = false;
  }
  check('reads need no approval', readOk);

  let executeRefused = false;
  try {
    await executeRun(run, {
      tracker: new DemoIssueTrackerAdapter(),
      messaging: new DemoMessagingAdapter(),
      mail: new DemoCustomerMailAdapter(),
      onStep: () => {},
      stepDelayMs: 0,
    });
  } catch {
    executeRefused = true;
  }
  check('executor refuses an unapproved run', executeRefused);

  /* -------------------------------------------------------------------- */
  section('6. Execution after approval');

  const approved = { ...run, approved: true, approvedAt: new Date().toISOString() };
  const tracker = new DemoIssueTrackerAdapter();
  const messaging = new DemoMessagingAdapter();
  const mail = new DemoCustomerMailAdapter();
  const done = await executeRun(approved, { tracker, messaging, mail, onStep: () => {}, stepDelayMs: 0 });

  console.log(`  status=${done.status}`);
  for (const a of done.proposedActions) {
    console.log(`    ${a.status.padEnd(10)} ${a.title} -> ${a.result?.summary ?? '-'}`);
  }
  console.log(
    `  ${done.manualActionsAvoided} manual actions -> 1 approval; saved ${formatDuration(done.timeSavedSeconds)}`,
  );

  check('run completed', done.status === 'completed', done.status);
  check('every action succeeded', done.proposedActions.every((a) => a.status === 'succeeded'));
  check('an issue was created', tracker.issues.length === 1, String(tracker.issues.length));
  check('issue assigned to Awaiz', tracker.issues[0]?.assignee === 'Awaiz', String(tracker.issues[0]?.assignee));
  check('issue labelled billing', tracker.issues[0]?.labels.includes('billing') === true, tracker.issues[0]?.labels.join('/'));
  check('team was notified once', messaging.messages.length === 1, String(messaging.messages.length));
  check(
    'notification names the owner and issue',
    /Awaiz/.test(messaging.messages[0]?.body ?? '') && /#\d+/.test(messaging.messages[0]?.body ?? ''),
    messaging.messages[0]?.body?.slice(0, 80),
  );
  check(
    'baseline uses the leaner observed pass',
    done.manualActionsAvoided === 13,
    String(done.manualActionsAvoided),
  );
  check('time saved is positive', done.timeSavedSeconds > 0, formatDuration(done.timeSavedSeconds));

  /* -------------------------------------------------------------------- */
  section('7. Failure, then resume');

  const failRun = { ...planRun(active, BUG_3, u3, 60), approved: true };
  const failTracker = new DemoIssueTrackerAdapter({ startNumber: 60, failAt: 'notify_team' });
  const failMessaging = new DemoMessagingAdapter({ failAt: 'notify_team' });
  const failMail = new DemoCustomerMailAdapter();
  const failed = await executeRun(failRun, {
    tracker: failTracker,
    messaging: failMessaging,
    mail: failMail,
    onStep: () => {},
    stepDelayMs: 0,
  });

  console.log(`  status=${failed.status} failedAt=${failed.failureStepIndex}`);
  check('run reports failure', failed.status === 'failed', failed.status);
  check(
    'failure is at the notify step',
    failed.proposedActions[failed.failureStepIndex ?? -1]?.action === 'chat.notify_team',
  );
  check(
    'earlier steps stay succeeded',
    failed.proposedActions
      .slice(0, failed.failureStepIndex ?? 0)
      .every((a) => a.status === 'succeeded'),
  );
  check(
    'no step claims success without an ok result',
    failed.proposedActions
      .filter((a) => a.status === 'succeeded')
      .every((a) => a.result?.ok === true),
  );
  check('the ticket was still created', failTracker.issues.length === 1);
  check('nothing was posted to the team', failMessaging.messages.length === 0);
  check('verifier refuses to pass a failed run', verifyRun(failed).ok === false);

  // Retry: the adapter recovers, and the run must RESUME rather than restart.
  const retryTracker = new DemoIssueTrackerAdapter({ startNumber: 61 });
  const retryMessaging = new DemoMessagingAdapter();
  const resumed = await executeRun(
    {
      ...failed,
      status: 'ghost',
      approved: true,
      proposedActions: failed.proposedActions.map((a) =>
        a.status === 'failed' || a.status === 'skipped'
          ? { ...a, status: 'planned' as const, result: undefined }
          : a,
      ),
    },
    {
      tracker: retryTracker,
      messaging: retryMessaging,
      mail: new DemoCustomerMailAdapter(),
      onStep: () => {},
      stepDelayMs: 0,
    },
  );

  check('retry completes', resumed.status === 'completed', resumed.status);
  check(
    'retry did NOT create a duplicate ticket',
    retryTracker.issues.length === 0,
    `created ${retryTracker.issues.length} on retry`,
  );
  check('retry posted the notification once', retryMessaging.messages.length === 1);
  check('verifier passes the resumed run', verifyRun(resumed).ok === true);

  /* -------------------------------------------------------------------- */
  console.log(`\n${'='.repeat(52)}`);
  console.log(`${checks - failures}/${checks} checks passed`);
  if (failures > 0) {
    console.log(`${failures} FAILED`);
    process.exit(1);
  }
  console.log('engine OK');
}

main().catch((err) => {
  console.error('\nverify-engine crashed:');
  console.error(err);
  process.exit(1);
});
