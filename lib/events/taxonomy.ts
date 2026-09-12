import type { PermissionClass, SemanticAction, SourceApp } from '@/types';

/**
 * The semantic action taxonomy.
 *
 * This is the vocabulary REPEAT reasons in. Note what is absent: no
 * coordinates, no key codes, no selectors. An observation is only ever
 * recorded as one of these verbs plus normalized structured data, which is
 * what lets the same pattern match a workflow whose values are all different.
 */

export type ActionSpec = {
  action: SemanticAction;
  app: SourceApp;
  /** Short label for timelines and node titles. */
  label: string;
  /** The meaning, used for display and for intent similarity scoring. */
  intent: string;
  entityType: string;
  permission: PermissionClass;
  /**
   * Estimated seconds of human effort. Used for the time-saved metric, which
   * is always presented as an estimate derived from this table.
   */
  effortSeconds: number;
  /** Which compiled workflow step this action rolls up into. */
  stepKey: StepKey;
  /** True for latent actions REPEAT names rather than observes directly. */
  inferred?: boolean;
};

/** The five compiled steps the Memory Map renders. */
export type StepKey = 'read' | 'understand' | 'create' | 'assign' | 'notify';

export const STEP_ORDER: StepKey[] = ['read', 'understand', 'create', 'assign', 'notify'];

export const STEP_META: Record<
  StepKey,
  { title: string; source: string; app: SourceApp; description: string }
> = {
  read: {
    title: 'Email',
    source: 'Trigger',
    app: 'mail',
    description: 'An inbound support message arrives and is read.',
  },
  understand: {
    title: 'Understand issue',
    source: 'Extract + classify',
    app: 'repeat',
    description: 'Unstructured prose becomes customer, summary, area and severity.',
  },
  create: {
    title: 'Create ticket',
    source: 'Issue tracker',
    app: 'tracker',
    description: 'A labelled, prioritised engineering ticket is opened.',
  },
  assign: {
    title: 'Assign owner',
    source: 'Routing rules',
    app: 'tracker',
    description: 'Ownership is resolved from the classified engineering area.',
  },
  notify: {
    title: 'Notify team',
    source: 'Team chat',
    app: 'chat',
    description: 'The responsible channel is told what happened and who owns it.',
  },
};

export const ACTION_SPECS: Record<SemanticAction, ActionSpec> = {
  'mail.read_message': {
    action: 'mail.read_message',
    app: 'mail',
    label: 'Read support email',
    intent: 'read an inbound customer report',
    entityType: 'email',
    permission: 'read',
    effortSeconds: 35,
    stepKey: 'read',
  },
  'mail.copy_content': {
    action: 'mail.copy_content',
    app: 'mail',
    label: 'Copy report details',
    intent: 'capture the report content for reuse',
    entityType: 'email',
    permission: 'read',
    effortSeconds: 6,
    stepKey: 'read',
  },
  'issue.extract_details': {
    action: 'issue.extract_details',
    app: 'repeat',
    label: 'Extract issue details',
    intent: 'turn unstructured prose into structured issue fields',
    entityType: 'understanding',
    permission: 'analyze',
    effortSeconds: 46,
    stepKey: 'understand',
    inferred: true,
  },
  'issue.classify': {
    action: 'issue.classify',
    app: 'repeat',
    label: 'Classify issue',
    intent: 'decide the engineering area and severity',
    entityType: 'understanding',
    permission: 'analyze',
    effortSeconds: 20,
    stepKey: 'understand',
    inferred: true,
  },
  'tracker.open_composer': {
    action: 'tracker.open_composer',
    app: 'tracker',
    label: 'Open new issue',
    intent: 'begin authoring an engineering ticket',
    entityType: 'issue',
    permission: 'draft',
    effortSeconds: 5,
    stepKey: 'create',
  },
  'tracker.compose_issue': {
    action: 'tracker.compose_issue',
    app: 'tracker',
    label: 'Write title and description',
    intent: 'author the ticket body from the report',
    entityType: 'issue',
    permission: 'draft',
    effortSeconds: 60,
    stepKey: 'create',
  },
  'tracker.apply_labels': {
    action: 'tracker.apply_labels',
    app: 'tracker',
    label: 'Apply labels',
    intent: 'categorise the ticket for triage',
    entityType: 'issue',
    permission: 'draft',
    effortSeconds: 14,
    stepKey: 'create',
  },
  'tracker.set_priority': {
    action: 'tracker.set_priority',
    app: 'tracker',
    label: 'Set priority',
    intent: 'record how urgent the issue is',
    entityType: 'issue',
    permission: 'draft',
    effortSeconds: 9,
    stepKey: 'create',
  },
  'tracker.assign_owner': {
    action: 'tracker.assign_owner',
    app: 'tracker',
    label: 'Assign owner',
    intent: 'give the ticket to the responsible engineer',
    entityType: 'issue',
    permission: 'draft',
    effortSeconds: 18,
    stepKey: 'assign',
  },
  'tracker.create_issue': {
    action: 'tracker.create_issue',
    app: 'tracker',
    label: 'Create issue',
    intent: 'commit the ticket to the tracker',
    entityType: 'issue',
    permission: 'create_external',
    effortSeconds: 4,
    stepKey: 'create',
  },
  'chat.open_channel': {
    action: 'chat.open_channel',
    app: 'chat',
    label: 'Open team channel',
    intent: 'go to where the team is told about work',
    entityType: 'channel',
    permission: 'read',
    effortSeconds: 6,
    stepKey: 'notify',
  },
  'chat.compose_message': {
    action: 'chat.compose_message',
    app: 'chat',
    label: 'Draft team message',
    intent: 'write the notification about the new ticket',
    entityType: 'message',
    permission: 'draft',
    effortSeconds: 40,
    stepKey: 'notify',
  },
  'chat.notify_team': {
    action: 'chat.notify_team',
    app: 'chat',
    label: 'Send notification',
    intent: 'notify the team that the issue is filed and owned',
    entityType: 'message',
    permission: 'send_message',
    effortSeconds: 4,
    stepKey: 'notify',
  },
};

/** Seconds lost each time a human moves attention between two applications. */
export const CONTEXT_SWITCH_SECONDS = 8;

/** Seconds a human spends reading and approving one Ghost Run. */
export const APPROVAL_SECONDS = 6;

export function specFor(action: SemanticAction): ActionSpec {
  return ACTION_SPECS[action];
}

/**
 * Total estimated human effort for a sequence of actions: the per-action
 * estimates plus one context-switch penalty per application transition.
 */
export function estimateEffortSeconds(actions: SemanticAction[]): number {
  let total = 0;
  let lastApp: SourceApp | null = null;
  for (const action of actions) {
    const spec = ACTION_SPECS[action];
    if (!spec) continue;
    total += spec.effortSeconds;
    // REPEAT itself is not an app the human switches into.
    if (spec.app !== 'repeat') {
      if (lastApp && lastApp !== spec.app) total += CONTEXT_SWITCH_SECONDS;
      lastApp = spec.app;
    }
  }
  return total;
}

export const APP_META: Record<SourceApp, { label: string; short: string; accent: string }> = {
  mail: { label: 'Mail', short: 'MAIL', accent: '#38dcff' },
  tracker: { label: 'Issue Tracker', short: 'TRACKER', accent: '#8b7cff' },
  chat: { label: 'Team Chat', short: 'CHAT', accent: '#2dd4a7' },
  repeat: { label: 'REPEAT', short: 'REPEAT', accent: '#7fe9ff' },
};
