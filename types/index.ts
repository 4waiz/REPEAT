/**
 * REPEAT — core domain model.
 *
 * The whole product is one pipeline:
 *
 *   Observer -> Normalizer -> TraceStore -> PatternDetector -> PatternCompiler
 *     -> WorkflowAgent -> GhostRunner -> PolicyLayer -> Executor -> Verifier -> Log
 *
 * Every type below belongs to exactly one stage of that pipeline, in order.
 */

/* ------------------------------------------------------------------------ */
/* 1. Observation                                                           */
/* ------------------------------------------------------------------------ */

/** The applications REPEAT can observe in this prototype. */
export type SourceApp = 'mail' | 'tracker' | 'chat' | 'repeat';

/**
 * A semantic action verb. REPEAT deliberately never records coordinates or
 * keystrokes — only what the action meant. This taxonomy is the vocabulary
 * the pattern detector reasons over.
 */
export type SemanticAction =
  // mail
  | 'mail.read_message'
  | 'mail.copy_content'
  // interpretation (performed by the human using their own tools)
  | 'issue.extract_details'
  | 'issue.classify'
  // issue tracker
  | 'tracker.open_composer'
  | 'tracker.compose_issue'
  | 'tracker.apply_labels'
  | 'tracker.set_priority'
  | 'tracker.assign_owner'
  | 'tracker.create_issue'
  // team chat
  | 'chat.open_channel'
  | 'chat.compose_message'
  | 'chat.notify_team';

/** How an event entered the system. Drives the icon in the Live Timeline. */
export type EventOrigin = 'observed' | 'executed';

export type SemanticEvent = {
  id: string;
  /** ISO timestamp. */
  timestamp: string;
  sourceApp: SourceApp;
  action: SemanticAction;
  /** e.g. email | issue | message */
  entityType?: string;
  entityId?: string;
  /** Human-readable meaning, used for display and for intent similarity. */
  semanticIntent: string;
  /** Normalized payload. Keys here become candidate workflow variables. */
  structuredData: Record<string, unknown>;
  /** Observation confidence 0..1. */
  confidence: number;
  /** Observed by REPEAT, or performed by REPEAT. */
  origin: EventOrigin;
  /** Trace this event was attributed to. */
  traceId: string;
  /**
   * True when REPEAT named a latent step the human never clicked — e.g. the
   * human turned unstructured email prose into a structured title, labels and
   * priority, so an "understand" and a "classify" action must have happened
   * between the two observable events. Inferred events carry lower confidence.
   */
  inferred?: boolean;
  /** Seconds of human effort this action is estimated to cost. */
  effortSeconds: number;
};

export type TraceOutcome = 'completed' | 'abandoned';

export type WorkflowTrace = {
  id: string;
  label: string;
  startedAt: string;
  endedAt?: string;
  events: SemanticEvent[];
  outcome?: TraceOutcome;
  /** Which demo fixture produced this trace (demo bookkeeping only). */
  sourceRef?: string;
};

/* ------------------------------------------------------------------------ */
/* 2. Understanding                                                         */
/* ------------------------------------------------------------------------ */

export type IssueCategory =
  | 'authentication'
  | 'performance'
  | 'ui'
  | 'data'
  | 'integration'
  | 'unknown';

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';

/** The engineering area a bug belongs to. Drives owner routing. */
export type EngineeringArea =
  | 'frontend'
  | 'backend'
  | 'ai-data'
  | 'research'
  | 'operations'
  | 'unresolved';

/**
 * A related public reference found while understanding a report — a docs
 * page, a similar public issue, a status post. Attached to the ticket so the
 * owner starts with context instead of a blank page. Only the symptom is ever
 * sent out to find these; never the customer's identity or the message body.
 */
export type IssueReference = {
  title: string;
  url: string;
  /** Short excerpt of the page that matched the symptom. */
  snippet: string;
  publishedAt?: string;
};

/**
 * Structured interpretation of an inbound support email. This is the only
 * thing the UI is ever allowed to show about what the model concluded —
 * evidence and structure, never chain-of-thought.
 */
export type IssueUnderstanding = {
  customerName: string;
  customerEmail: string;
  issueTitle: string;
  issueDescription: string;
  category: IssueCategory;
  area: EngineeringArea;
  severity: IssueSeverity;
  labels: string[];
  /** Literal phrases from the source that justified the classification. */
  evidence: string[];
  confidence: number;
  /** Which understanding path produced this. Shown in the Ghost Run. */
  source: 'deterministic' | 'llm';
  /** The model behind an `llm` understanding, e.g. "openai/gpt-4.1-mini". */
  model?: string;
  /** Related context from the research step, when it ran. */
  references?: IssueReference[];
};

/* ------------------------------------------------------------------------ */
/* 3. Patterns                                                              */
/* ------------------------------------------------------------------------ */

export type WorkflowTriggerType = 'incoming_support_email';

export type WorkflowTrigger = {
  type: WorkflowTriggerType;
  description: string;
  /** Conditions that must hold for the trigger to fire. */
  conditions: string[];
};

/**
 * A generalized step. `params` values may be literals (constant across every
 * observation) or variable bindings produced by the compiler.
 */
export type WorkflowStep = {
  id: string;
  action: SemanticAction;
  app: SourceApp;
  title: string;
  description: string;
  params: Record<string, unknown>;
  permission: PermissionClass;
  requiresApproval: boolean;
};

/**
 * How a field's value comes to exist.
 *
 * `authored` is the only provenance that can make a field a true constant:
 * the human chose it themselves and nothing in the trigger implies it.
 * Everything else is computed from the trigger, so it is always bound.
 */
export type FieldDerivation =
  | 'authored'
  | 'extracted'
  | 'classified'
  | 'routed'
  | 'generated';

/** A field the compiler decided is variable rather than memorized. */
export type WorkflowVariable = {
  name: string;
  label: string;
  /** How the value is obtained at run time. */
  derivation: FieldDerivation;
  /** Distinct values seen while observing. */
  observedValues: string[];
  description: string;
  /**
   * True when every observation happened to carry the *same* value, yet the
   * field is still bound rather than memorized — because REPEAT can derive
   * it from the trigger. This is what stops "both bugs went to Umar" from
   * becoming "always assign Umar".
   */
  heldConstant?: boolean;
  /** The rule that produces the value, e.g. "area -> owner". */
  derivedFrom?: string;
};

export type PatternStatus = 'learning' | 'candidate' | 'approved' | 'active' | 'paused';

/** Why REPEAT believed this was a pattern. Surfaced verbatim to the user. */
export type PatternEvidence = {
  matchingTraces: number;
  sequenceSimilarity: number;
  appSimilarity: number;
  intentSimilarity: number;
  overallSimilarity: number;
  sharedApps: SourceApp[];
  sharedIntent: string;
  variableFields: string[];
  constantFields: string[];
  /**
   * Fields that were identical in every observation but were still
   * generalized, with the reason. Surfaced verbatim in the evidence panel —
   * it is the clearest proof that REPEAT is not replaying values.
   */
  generalizedDespiteConstant: { label: string; value: string; reason: string }[];
};

export type LearnedPattern = {
  id: string;
  name: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  variables: WorkflowVariable[];
  observations: number;
  confidence: number;
  status: PatternStatus;
  evidence: PatternEvidence;
  traceIds: string[];
  createdAt: string;
  /** Average human time for one manual pass, in seconds. */
  manualDurationSeconds: number;
  manualActionCount: number;
};

/* ------------------------------------------------------------------------ */
/* 4. Policy                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Permission classes, ordered by consequence. The policy layer — not the
 * model — decides what needs a human.
 */
export type PermissionClass =
  | 'read'
  | 'analyze'
  | 'draft'
  | 'create_external'
  | 'send_message'
  | 'delete'
  | 'payment';

export type RiskLevel = 'low' | 'medium' | 'high' | 'blocked';

export type PolicyDecision = {
  permission: PermissionClass;
  allowed: boolean;
  requiresApproval: boolean;
  rationale: string;
};

/* ------------------------------------------------------------------------ */
/* 5. Runs                                                                  */
/* ------------------------------------------------------------------------ */

export type PlannedActionStatus =
  | 'planned'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'needs_review';

/** Proof that REPEAT generalized instead of replaying. */
export type AdaptationNote = {
  field: string;
  observedValue: string;
  adaptedValue: string;
  rule: string;
  reason: string;
};

export type ActionResult = {
  ok: boolean;
  summary: string;
  data?: Record<string, unknown>;
  error?: string;
  /** Which adapter serviced it — demo or live. */
  adapter: string;
  durationMs: number;
};

/** One concrete, resolved action REPEAT proposes to take. */
export type PlannedAction = {
  id: string;
  stepId: string;
  action: SemanticAction;
  app: SourceApp;
  title: string;
  /** Resolved, human-readable summary, e.g. "Assign to Noor". */
  detail: string;
  /** Fully resolved params — no variable bindings left. */
  resolvedParams: Record<string, unknown>;
  permission: PermissionClass;
  requiresApproval: boolean;
  status: PlannedActionStatus;
  /** Populated after execution. */
  result?: ActionResult;
  /** Set when a value could not be resolved confidently. */
  review?: { field: string; reason: string; options?: string[] };
  /** Adaptation note, e.g. owner changed vs. what was observed. */
  adaptation?: AdaptationNote;
};

export type RunStatus =
  | 'planning'
  | 'ghost'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentRun = {
  id: string;
  patternId: string;
  patternName: string;
  startedAt: string;
  endedAt?: string;
  /** The event that matched the trigger. */
  triggerEvent: SemanticEvent;
  triggerSummary: string;
  understanding: IssueUnderstanding;
  proposedActions: PlannedAction[];
  risk: RiskLevel;
  confidence: number;
  approved: boolean;
  approvedAt?: string;
  status: RunStatus;
  adaptations: AdaptationNote[];
  /** Metrics computed at completion. */
  manualActionsAvoided: number;
  timeSavedSeconds: number;
  humanInterventions: number;
  failureStepIndex?: number;
};

/* ------------------------------------------------------------------------ */
/* 6. Presentation state                                                    */
/* ------------------------------------------------------------------------ */

export type OrbState =
  | 'idle'
  | 'learning'
  | 'pattern'
  | 'ghost'
  | 'executing'
  | 'success'
  | 'error';

/** The high-level phase the demo is in. Drives the Action Panel. */
export type StagePhase =
  | 'idle'
  | 'observing'
  | 'comparing'
  | 'pattern_discovered'
  | 'agent_ready'
  | 'trigger_detected'
  | 'ghost_run'
  | 'executing'
  | 'completed'
  | 'error';

export type TimelineEntry = {
  id: string;
  at: string;
  label: string;
  detail?: string;
  origin: EventOrigin | 'system';
  status: 'done' | 'active' | 'pending' | 'failed';
  app?: SourceApp;
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  area: EngineeringArea;
  handle: string;
  accent: string;
};

/* ------------------------------------------------------------------------ */
/* 7. Demo-app surfaces                                                     */
/* ------------------------------------------------------------------------ */

export type MailMessage = {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  body: string;
  receivedAt: string;
  read: boolean;
  /** Which demo fixture seeded this message. */
  fixtureRef: string;
  /** Arrived during the session rather than being part of the initial inbox. */
  isNew?: boolean;
};

export type TrackerIssue = {
  id: string;
  number: number;
  title: string;
  body: string;
  labels: string[];
  priority: IssueSeverity;
  assignee?: string;
  createdAt: string;
  createdBy: 'human' | 'repeat';
  state: 'open' | 'closed';
  url?: string;
};

export type ChatMessage = {
  id: string;
  channel: string;
  author: string;
  body: string;
  at: string;
  sentBy: 'human' | 'repeat';
  /** Drafted but not yet sent. */
  draft?: boolean;
};

/** Composer state for the tracker window, so the UI can animate field fills. */
export type ComposerState = {
  open: boolean;
  title: string;
  body: string;
  labels: string[];
  priority: IssueSeverity | '';
  assignee: string;
  /** Which fields have been filled, for the progress affordance. */
  touched: string[];
};
