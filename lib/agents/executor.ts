import type { ActionResult, AgentRun, IssueSeverity, PlannedAction } from '@/types';
import type { AdapterBundle } from '@/lib/adapters/types';
import { ok } from '@/lib/adapters/types';
import { assertExecutable } from '@/lib/policy/policy';
import { sleep } from '@/lib/utils';

/**
 * Executor + Verifier.
 *
 * Two invariants this file exists to enforce:
 *
 *   1. Nothing runs unless the run is approved. The guard is checked per
 *      action, not once at the top, so no code path can slip past it.
 *   2. A failure stops the run and preserves everything already done. A
 *      failed step is never reported as success.
 */

export class NotApprovedError extends Error {
  constructor() {
    super('Refusing to execute: this run has not been approved by a human.');
    this.name = 'NotApprovedError';
  }
}

export type ExecuteOptions = AdapterBundle & {
  /** Called before and after each action so the UI can animate progress. */
  onStep: (action: PlannedAction, index: number) => void;
  /** Delay between actions, purely presentational. */
  stepDelayMs?: number;
};

/** Dispatch one planned action to the right adapter. */
async function performAction(
  action: PlannedAction,
  adapters: AdapterBundle,
  ctx: { createdIssueNumber: number | null; createdIssueId: string | null },
): Promise<ActionResult> {
  const started = Date.now();
  const withTiming = (r: ActionResult): ActionResult => ({
    ...r,
    durationMs: r.durationMs || Date.now() - started,
  });

  switch (action.action) {
    // Read / analyze / draft steps have no external effect by definition.
    case 'mail.read_message':
      return withTiming(ok('local', 'Email read and normalized'));
    case 'issue.extract_details':
      return withTiming(ok('local', 'Structured fields extracted'));
    case 'issue.classify':
      return withTiming(
        ok('local', `Classified as ${action.resolvedParams.area} / ${action.resolvedParams.category}`),
      );
    case 'tracker.compose_issue':
      return withTiming(ok('local', 'Ticket drafted'));
    case 'tracker.apply_labels':
      return withTiming(
        ok('local', `Labels prepared: ${(action.resolvedParams.labels as string[])?.join(', ')}`),
      );
    case 'chat.compose_message':
      return withTiming(ok('local', 'Notification drafted'));

    // Consequential steps go through adapters.
    case 'tracker.create_issue':
      return withTiming(
        await adapters.tracker.createIssue({
          title: String(action.resolvedParams.issueTitle),
          body: String(action.resolvedParams.issueDescription),
          labels: (action.resolvedParams.labels as string[]) ?? [],
          priority: (action.resolvedParams.severity as IssueSeverity) ?? 'medium',
        }),
      );

    case 'tracker.assign_owner': {
      const number = ctx.createdIssueNumber ?? Number(action.resolvedParams.issueNumber);
      // A live tracker has its own identifier for the record it just created;
      // it travels alongside REPEAT's running number.
      const id = ctx.createdIssueId ?? undefined;
      return withTiming(
        await adapters.tracker.assignIssue({ number, id }, String(action.resolvedParams.owner)),
      );
    }

    case 'chat.notify_team':
      return withTiming(
        await adapters.messaging.postMessage({
          channel: String(action.resolvedParams.channel),
          body: String(action.resolvedParams.teamMessage),
        }),
      );

    default:
      return withTiming(ok('local', 'No-op'));
  }
}

/**
 * Execute an approved run.
 *
 * Throws `NotApprovedError` if called on an unapproved run — the Ghost Run
 * cannot become a real run by accident.
 */
export async function executeRun(run: AgentRun, options: ExecuteOptions): Promise<AgentRun> {
  if (!run.approved) throw new NotApprovedError();

  const { onStep, stepDelayMs = 0, ...adapters } = options;

  // A step still awaiting human review blocks the run.
  const unresolved = run.proposedActions.find((a) => a.status === 'needs_review');
  if (unresolved) {
    return {
      ...run,
      status: 'failed',
      endedAt: new Date().toISOString(),
      failureStepIndex: run.proposedActions.indexOf(unresolved),
    };
  }

  const actions = run.proposedActions.map((a) => ({ ...a }));
  let createdIssueNumber: number | null = null;
  let createdIssueId: string | null = null;

  // Resume, do not restart. A retry after a mid-run failure must not repeat
  // work that already succeeded — re-running "create issue" would file a
  // duplicate ticket. Recover the context those steps produced instead.
  for (const done of actions) {
    if (done.status !== 'succeeded') continue;
    if (done.action === 'tracker.create_issue') {
      const num = done.result?.data?.number;
      if (typeof num === 'number') createdIssueNumber = num;
      const id = done.result?.data?.id;
      if (typeof id === 'string') createdIssueId = id;
    }
  }

  for (let i = 0; i < actions.length; i += 1) {
    const action = actions[i];
    if (action.status === 'succeeded') continue;

    // Per-action policy guard. This is the invariant.
    assertExecutable({ approved: run.approved, permission: action.permission });

    action.status = 'running';
    onStep(action, i);
    if (stepDelayMs > 0) await sleep(stepDelayMs);

    let result: ActionResult;
    try {
      result = await performAction(action, adapters, { createdIssueNumber, createdIssueId });
    } catch (err) {
      result = {
        ok: false,
        summary: 'Action threw',
        error: err instanceof Error ? err.message : String(err),
        adapter: 'unknown',
        durationMs: 0,
      };
    }

    action.result = result;

    if (!result.ok) {
      // Stop here. Everything before this point stays recorded as done.
      action.status = 'failed';
      onStep(action, i);
      for (let j = i + 1; j < actions.length; j += 1) actions[j].status = 'skipped';
      return {
        ...run,
        proposedActions: actions,
        status: 'failed',
        endedAt: new Date().toISOString(),
        failureStepIndex: i,
      };
    }

    if (action.action === 'tracker.create_issue') {
      const id = result.data?.id;
      if (typeof id === 'string') createdIssueId = id;

      // A real tracker gives the ticket a real address. The team message was
      // planned before that address existed, so it is appended now — the
      // same correction-after-the-fact as the issue-number rewrite below.
      const url = result.data?.url;
      if (adapters.tracker.live && typeof url === 'string' && /^https?:\/\//.test(url)) {
        for (let j = i + 1; j < actions.length; j += 1) {
          const later = actions[j];
          if (typeof later.resolvedParams.teamMessage === 'string' && !later.resolvedParams.teamMessage.includes(url)) {
            const withLink = `${later.resolvedParams.teamMessage} ${url}`;
            if (later.detail === later.resolvedParams.teamMessage) later.detail = withLink;
            later.resolvedParams = { ...later.resolvedParams, teamMessage: withLink, issueUrl: url };
          }
        }
      }

      const num = result.data?.number;
      if (typeof num === 'number') {
        createdIssueNumber = num;
        const predicted = Number(action.resolvedParams.issueNumber);
        // The plan predicted an issue number before the tracker assigned one.
        // If the real number differs, rewrite every downstream reference now —
        // notifying the team about an issue number that does not exist would
        // be a silent correctness failure.
        if (predicted !== num) {
          action.detail = action.detail.replace(`#${predicted}`, `#${num}`);
          for (let j = i + 1; j < actions.length; j += 1) {
            const later = actions[j];
            later.resolvedParams = { ...later.resolvedParams, issueNumber: num };
            if (typeof later.resolvedParams.teamMessage === 'string') {
              const fixed = later.resolvedParams.teamMessage.replace(`#${predicted}`, `#${num}`);
              later.resolvedParams.teamMessage = fixed;
              if (later.detail.includes(`#${predicted}`)) later.detail = fixed;
            }
          }
        }
      }
    }

    action.status = 'succeeded';
    onStep(action, i);
  }

  return {
    ...run,
    proposedActions: actions,
    status: 'completed',
    endedAt: new Date().toISOString(),
  };
}

/**
 * Verifier. Confirms the run actually achieved what it proposed, rather than
 * trusting the fact that no step threw.
 */
export function verifyRun(run: AgentRun): { ok: boolean; checks: { label: string; ok: boolean }[] } {
  const created = run.proposedActions.find((a) => a.action === 'tracker.create_issue');
  const assigned = run.proposedActions.find((a) => a.action === 'tracker.assign_owner');
  const notified = run.proposedActions.find((a) => a.action === 'chat.notify_team');

  const checks = [
    { label: 'Issue created in tracker', ok: created?.result?.ok === true },
    {
      label: `Owner set to ${assigned?.resolvedParams.owner ?? 'unknown'}`,
      ok: assigned?.result?.ok === true,
    },
    { label: 'Team notified', ok: notified?.result?.ok === true },
    {
      label: 'No step reported success without a result',
      ok: run.proposedActions
        .filter((a) => a.status === 'succeeded')
        .every((a) => a.result?.ok === true),
    },
  ];

  return { ok: checks.every((c) => c.ok), checks };
}
