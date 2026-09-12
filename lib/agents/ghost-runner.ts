import type {
  AdaptationNote,
  AgentRun,
  IssueUnderstanding,
  LearnedPattern,
  MailMessage,
  PermissionClass,
  PlannedAction,
  SemanticAction,
} from '@/types';
import { normalize } from '@/lib/events/normalizer';
import { APPROVAL_SECONDS } from '@/lib/events/taxonomy';
import { assessRisk, decide } from '@/lib/policy/policy';
import { OWNER_CONFIDENCE_FLOOR } from '@/lib/demo/config';
import { routeOwner } from '@/lib/demo/team';
import { DEFAULT_CHANNEL, composeIssueBody, composeTeamMessage } from '@/lib/agents/compose';
import { CATEGORY_DISPLAY } from '@/lib/agents/understanding';
import { makeId, unique } from '@/lib/utils';

/**
 * Ghost Runner.
 *
 * Produces a fully resolved plan and makes no external change whatsoever.
 * Every variable the compiler left bound is resolved here, from the *new*
 * trigger — which is the moment REPEAT either proves it generalized or
 * exposes itself as a macro.
 *
 * The plan is also where adaptations are recorded: when a resolved value
 * differs from what was observed during learning, REPEAT says so explicitly
 * instead of quietly diverging.
 */

/** Resolve every bound variable against the new understanding. */
export function resolveVariables(
  pattern: LearnedPattern,
  understanding: IssueUnderstanding,
  issueNumber: number,
): { values: Record<string, unknown>; owner: string | null; ownerRule: string } {
  const { owner, rule } = routeOwner(understanding.area);

  const values: Record<string, unknown> = {
    customerName: understanding.customerName,
    customerEmail: understanding.customerEmail,
    issueTitle: understanding.issueTitle,
    issueDescription: composeIssueBody(understanding),
    category: understanding.category,
    area: understanding.area,
    severity: understanding.severity,
    labels: understanding.labels,
    owner: owner ?? '',
    issueNumber,
    // Authored constants come from the compiled pattern, not from the trigger.
    channel:
      (pattern.steps.find((s) => s.id === 'step_notify')?.params.channel as string) ??
      DEFAULT_CHANNEL,
  };

  values.teamMessage = composeTeamMessage({
    understanding,
    issueNumber,
    owner: owner ?? 'an owner to be confirmed',
  });

  return { values, owner, ownerRule: rule };
}

/**
 * Compare a resolved value against what was observed while learning. Any
 * difference becomes a visible adaptation note rather than a silent one.
 */
function detectAdaptations(
  pattern: LearnedPattern,
  resolved: Record<string, unknown>,
  ownerRule: string,
): AdaptationNote[] {
  const notes: AdaptationNote[] = [];

  const ownerVar = pattern.variables.find((v) => v.name === 'owner');
  const observedOwners = unique(ownerVar?.observedValues ?? []);
  const resolvedOwner = String(resolved.owner ?? '');

  if (ownerVar && resolvedOwner && !observedOwners.includes(resolvedOwner)) {
    notes.push({
      field: 'owner',
      observedValue: observedOwners.join(' / ') || 'none observed',
      adaptedValue: resolvedOwner,
      rule: ownerRule,
      reason:
        'The engineering area of this report differs from the observations, so ownership was re-resolved from the routing rules.',
    });
  }

  const areaVar = pattern.variables.find((v) => v.name === 'area');
  const observedAreas = unique(areaVar?.observedValues ?? []);
  const resolvedArea = String(resolved.area ?? '');
  if (areaVar && resolvedArea && !observedAreas.includes(resolvedArea)) {
    notes.push({
      field: 'area',
      observedValue: observedAreas.join(' / ') || 'none observed',
      adaptedValue: resolvedArea,
      rule: 'classified from the report text',
      reason: 'This report classified into an engineering area REPEAT had not seen for this pattern.',
    });
  }

  return notes;
}

/**
 * Execution permissions.
 *
 * The taxonomy records what the *human's* action was (picking an assignee in
 * an unsaved form is a draft). When REPEAT performs the same step it mutates
 * a live record, so the planner re-evaluates: anything that changes an
 * external system is `create_external`, and anything that talks to people is
 * `send_message`. Approval is decided from this, never from the taxonomy.
 */
const EXECUTION_PERMISSION: Partial<Record<SemanticAction, PermissionClass>> = {
  'tracker.assign_owner': 'create_external',
};

function executionPermission(action: SemanticAction, fallback: PermissionClass): PermissionClass {
  return EXECUTION_PERMISSION[action] ?? fallback;
}

type PlanRow = {
  action: SemanticAction;
  stepId: string;
  title: string;
  detail: string;
  params: Record<string, unknown>;
  permission: PermissionClass;
};

/**
 * Expand the five compiled steps into the concrete rows the Ghost Run shows.
 * Steps are the skeleton; these are the operations.
 */
function buildPlanRows(
  understanding: IssueUnderstanding,
  values: Record<string, unknown>,
): PlanRow[] {
  const labels = (values.labels as string[]) ?? [];
  const references = understanding.references?.length ?? 0;
  return [
    {
      action: 'mail.read_message',
      stepId: 'step_read',
      title: 'Read email',
      detail: `From ${understanding.customerName} <${understanding.customerEmail}>`,
      params: { customerName: values.customerName, customerEmail: values.customerEmail },
      permission: 'read',
    },
    {
      action: 'issue.extract_details',
      stepId: 'step_understand',
      title: 'Extract issue details',
      detail:
        references > 0
          ? `${String(values.issueTitle)} · ${references} related reference${references === 1 ? '' : 's'} found`
          : String(values.issueTitle),
      params: { issueTitle: values.issueTitle, issueDescription: values.issueDescription },
      permission: 'analyze',
    },
    {
      action: 'issue.classify',
      stepId: 'step_understand',
      title: 'Classify issue',
      detail: `${understanding.area} / ${understanding.category} · severity ${understanding.severity}`,
      params: { area: values.area, category: values.category, severity: values.severity },
      permission: 'analyze',
    },
    {
      action: 'tracker.compose_issue',
      stepId: 'step_create',
      title: 'Draft ticket',
      detail: references > 0 ? `"${values.issueTitle}" · related context attached` : `"${values.issueTitle}"`,
      params: { issueTitle: values.issueTitle, issueDescription: values.issueDescription },
      permission: 'draft',
    },
    {
      action: 'tracker.apply_labels',
      stepId: 'step_create',
      title: 'Apply labels',
      detail: labels.join(', ') || 'none',
      params: { labels: values.labels },
      permission: 'draft',
    },
    {
      action: 'tracker.create_issue',
      stepId: 'step_create',
      title: 'Create issue',
      detail: `#${values.issueNumber} in the issue tracker · priority ${understanding.severity}`,
      params: {
        issueTitle: values.issueTitle,
        issueDescription: values.issueDescription,
        labels: values.labels,
        severity: values.severity,
        issueNumber: values.issueNumber,
      },
      permission: 'create_external',
    },
    {
      action: 'tracker.assign_owner',
      stepId: 'step_assign',
      title: 'Assign owner',
      detail: values.owner ? `Assign to ${values.owner}` : 'Owner not resolved',
      params: { owner: values.owner, area: values.area, issueNumber: values.issueNumber },
      permission: 'draft',
    },
    {
      action: 'chat.compose_message',
      stepId: 'step_notify',
      title: 'Prepare team message',
      detail: String(values.teamMessage),
      params: { teamMessage: values.teamMessage, channel: values.channel },
      permission: 'draft',
    },
    {
      action: 'chat.notify_team',
      stepId: 'step_notify',
      title: 'Send team notification',
      detail: `Post to #${values.channel}`,
      params: { channel: values.channel, teamMessage: values.teamMessage },
      permission: 'send_message',
    },
  ];
}

/**
 * Plan a run. Pure: no adapter is touched, nothing is sent, nothing is
 * written. The returned run is always `status: 'ghost'` and `approved: false`.
 */
export function planRun(
  pattern: LearnedPattern,
  message: MailMessage,
  understanding: IssueUnderstanding,
  issueNumber: number,
): AgentRun {
  const { values, owner, ownerRule } = resolveVariables(pattern, understanding, issueNumber);
  const adaptations = detectAdaptations(pattern, values, ownerRule);
  const rows = buildPlanRows(understanding, values);

  const ownerResolved = Boolean(owner) && understanding.confidence >= OWNER_CONFIDENCE_FLOOR;

  const proposedActions: PlannedAction[] = rows.map((row) => {
    const permission = executionPermission(row.action, row.permission);
    const policy = decide(permission);

    const isOwnerStep = row.action === 'tracker.assign_owner';
    const needsReview = isOwnerStep && !ownerResolved;

    const action: PlannedAction = {
      id: makeId('act'),
      stepId: row.stepId,
      action: row.action,
      app: row.action.startsWith('mail')
        ? 'mail'
        : row.action.startsWith('tracker')
          ? 'tracker'
          : row.action.startsWith('chat')
            ? 'chat'
            : 'repeat',
      title: row.title,
      detail: needsReview ? 'Owner could not be resolved confidently' : row.detail,
      resolvedParams: row.params,
      permission,
      requiresApproval: policy.requiresApproval,
      status: needsReview ? 'needs_review' : 'planned',
    };

    if (needsReview) {
      action.review = {
        field: 'owner',
        reason:
          understanding.area === 'unresolved'
            ? 'The report did not classify into a known engineering area.'
            : `Classification confidence ${Math.round(understanding.confidence * 100)}% is below the ${Math.round(
                OWNER_CONFIDENCE_FLOOR * 100,
              )}% floor required to route automatically.`,
        options: ['Noor', 'Umar', 'Awaiz', 'Huda', 'Obaid'],
      };
    }

    const ownerAdaptation = adaptations.find((a) => a.field === 'owner');
    if (isOwnerStep && ownerAdaptation && !needsReview) {
      action.adaptation = ownerAdaptation;
    }

    return action;
  });

  const confidence = understanding.confidence * 0.5 + pattern.confidence * 0.5;
  const risk = assessRisk(proposedActions, confidence);

  const triggerEvent = normalize(
    {
      action: 'mail.read_message',
      entityId: message.id,
      data: {
        customerName: understanding.customerName,
        customerEmail: understanding.customerEmail,
      },
      origin: 'executed',
    },
    makeId('trace'),
  );

  const manualSeconds = pattern.manualDurationSeconds;

  return {
    id: makeId('run'),
    patternId: pattern.id,
    patternName: pattern.name,
    startedAt: new Date().toISOString(),
    triggerEvent,
    triggerSummary: `New ${
      understanding.category === 'unknown' ? '' : `${CATEGORY_DISPLAY[understanding.category]} `
    }bug report received from ${understanding.customerName}`.replace(/\s+/g, ' '),
    understanding,
    proposedActions,
    risk,
    confidence,
    approved: false,
    status: 'ghost',
    adaptations,
    manualActionsAvoided: pattern.manualActionCount,
    timeSavedSeconds: Math.max(0, manualSeconds - APPROVAL_SECONDS),
    humanInterventions: proposedActions.filter((a) => a.status === 'needs_review').length,
  };
}

/** Re-plan after a human resolves a review (e.g. picks the owner). */
export function applyOwnerOverride(run: AgentRun, owner: string): AgentRun {
  const proposedActions = run.proposedActions.map((a) => {
    if (a.action === 'tracker.assign_owner') {
      return {
        ...a,
        status: 'planned' as const,
        detail: `Assign to ${owner} (selected by you)`,
        resolvedParams: { ...a.resolvedParams, owner },
        review: undefined,
      };
    }
    if (a.action === 'chat.compose_message' || a.action === 'chat.notify_team') {
      const teamMessage = composeTeamMessage({
        understanding: run.understanding,
        issueNumber: Number(a.resolvedParams.issueNumber ?? 0) || nextIssueNumberFrom(run),
        owner,
      });
      return {
        ...a,
        resolvedParams: { ...a.resolvedParams, teamMessage },
        detail: a.action === 'chat.compose_message' ? teamMessage : a.detail,
      };
    }
    return a;
  });

  return {
    ...run,
    proposedActions,
    // Not incremented: the run already counted this step as needing a human
    // when it was planned. Resolving it is that intervention, not a second one.
    humanInterventions: run.humanInterventions,
    risk: assessRisk(proposedActions, run.confidence),
  };
}

function nextIssueNumberFrom(run: AgentRun): number {
  const create = run.proposedActions.find((a) => a.action === 'tracker.create_issue');
  return Number(create?.resolvedParams.issueNumber ?? 0);
}
