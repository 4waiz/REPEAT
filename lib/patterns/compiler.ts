import type {
  FieldDerivation,
  LearnedPattern,
  PatternEvidence,
  SemanticAction,
  SourceApp,
  WorkflowStep,
  WorkflowTrace,
  WorkflowVariable,
} from '@/types';
import {
  APPROVAL_SECONDS,
  STEP_META,
  STEP_ORDER,
  estimateEffortSeconds,
  specFor,
} from '@/lib/events/taxonomy';
import type { StepKey } from '@/lib/events/taxonomy';
import { permissionFor, requiresApproval } from '@/lib/policy/policy';
import { ROUTING_RULES, routeOwner } from '@/lib/demo/team';
import type { EngineeringArea } from '@/types';
import { makeId, unique } from '@/lib/utils';
import { compareTraces } from './similarity';
import { supportFactor } from './detector';

/**
 * Pattern Compiler.
 *
 *   observed human behaviour -> normalized semantic trace -> reusable template
 *
 * The job of this file is to decide what REPEAT is allowed to remember.
 *
 * A naive implementation diffs the observations and calls any field that never
 * changed a constant. That is exactly how you build a macro: both training
 * bugs in the demo were backend bugs assigned to Umar, so `owner` never
 * varied, and a naive compiler would bake in "assign Umar" forever.
 *
 * So constants have to earn it. A field is only a constant when BOTH hold:
 *
 *   1. provenance is `authored` — the human picked the value themselves and
 *      nothing in the trigger implies it (e.g. which channel to post in), and
 *   2. no known rule already derives it from another field.
 *
 * Anything computed from the trigger — extracted, classified, routed,
 * generated — stays bound even if two samples happened to agree. Two
 * identical samples are not evidence of a constant; they are one coincidence.
 */

type FieldSpec = {
  label: string;
  derivation: FieldDerivation;
  description: string;
};

const FIELD_META: Record<string, FieldSpec> = {
  customerName: {
    label: 'Customer',
    derivation: 'extracted',
    description: 'Read from the sender of the inbound report.',
  },
  customerEmail: {
    label: 'Customer email',
    derivation: 'extracted',
    description: 'Read from the sender address.',
  },
  issueTitle: {
    label: 'Issue title',
    derivation: 'extracted',
    description: 'Summarised from the subject and body.',
  },
  issueDescription: {
    label: 'Issue description',
    derivation: 'extracted',
    description: 'Rewritten from the report into engineering language.',
  },
  category: {
    label: 'Category',
    derivation: 'classified',
    description: 'Derived from the language of the report.',
  },
  area: {
    label: 'Engineering area',
    derivation: 'classified',
    description: 'Decides which part of the team owns the work.',
  },
  severity: {
    label: 'Priority',
    derivation: 'classified',
    description: 'Derived from blocking language and blast radius.',
  },
  labels: {
    label: 'Labels',
    derivation: 'classified',
    description: 'One type label plus one area label.',
  },
  owner: {
    label: 'Owner',
    derivation: 'routed',
    description: 'Resolved from the engineering area via the routing rules.',
  },
  teamMessage: {
    label: 'Team message',
    derivation: 'generated',
    description: 'Written from the created ticket and its owner.',
  },
  issueNumber: {
    label: 'Issue number',
    derivation: 'generated',
    description: 'Returned by the tracker when the ticket is created.',
  },
  channel: {
    label: 'Channel',
    // The one genuinely authored choice in this workflow: nothing in a bug
    // report says "post this in #product-updates". The human decided that.
    derivation: 'authored',
    description: 'Chosen by the user, identical in every observation.',
  },
};

/** Fields that are bookkeeping rather than workflow content. */
const IGNORED_FIELDS = new Set(['messageId', 'traceLabel', 'fixtureRef', 'sourceRef']);

/**
 * Known functional dependencies between fields. If, in every observation,
 * `fn(source)` equals the observed value of `target`, then `target` is a
 * function of `source` — not a constant — and REPEAT binds it to the rule.
 */
const DEPENDENCIES: {
  target: string;
  source: string;
  rule: string;
  holds: (sourceValue: string, targetValue: string) => boolean;
}[] = [
  {
    target: 'owner',
    source: 'area',
    rule: 'area -> owner',
    holds: (area, owner) =>
      routeOwner(area as EngineeringArea).owner?.toLowerCase() === owner.toLowerCase(),
  },
];

export function collapseTraceFields(trace: WorkflowTrace): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const event of trace.events) {
    for (const [k, v] of Object.entries(event.structuredData)) {
      if (IGNORED_FIELDS.has(k)) continue;
      if (v === undefined || v === null || v === '') continue;
      out[k] = v;
    }
  }
  return out;
}

function stringify(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

export type FieldDiff = {
  variables: WorkflowVariable[];
  constants: { name: string; value: unknown }[];
  /** Constants-by-value that were generalized anyway, with the reason. */
  generalizedDespiteConstant: { label: string; value: string; reason: string }[];
};

/**
 * The generalization step. Splits observed fields into bound variables and
 * true constants, using provenance and functional dependency rather than
 * value equality alone.
 */
export function diffFields(traces: WorkflowTrace[]): FieldDiff {
  const maps = traces.map(collapseTraceFields);
  const allKeys = unique(maps.flatMap((m) => Object.keys(m)));

  const variables: WorkflowVariable[] = [];
  const constants: { name: string; value: unknown }[] = [];
  const generalizedDespiteConstant: FieldDiff['generalizedDespiteConstant'] = [];

  for (const key of allKeys) {
    const present = maps.filter((m) => key in m);
    const values = present.map((m) => stringify(m[key]));
    const distinct = unique(values);
    const meta = FIELD_META[key];
    const derivation: FieldDerivation = meta?.derivation ?? 'extracted';

    const observedEveryTime = present.length === traces.length;
    const neverVaried = distinct.length === 1 && observedEveryTime;

    // --- observed to vary: unambiguously a variable ----------------------
    if (!neverVaried) {
      variables.push({
        name: key,
        label: meta?.label ?? key,
        derivation,
        observedValues: distinct,
        description: meta?.description ?? 'Value changed between observations.',
      });
      continue;
    }

    // --- never varied: does it earn constant status? ---------------------
    // 1. Is it a function of another field?
    const dependency = DEPENDENCIES.find((d) => d.target === key);
    if (dependency) {
      const holdsEverywhere = present.every((m) => {
        const sourceValue = m[dependency.source];
        if (sourceValue === undefined) return false;
        return dependency.holds(stringify(sourceValue), stringify(m[key]));
      });
      if (holdsEverywhere) {
        variables.push({
          name: key,
          label: meta?.label ?? key,
          derivation,
          observedValues: distinct,
          description: meta?.description ?? 'Derived from another field.',
          heldConstant: true,
          derivedFrom: dependency.rule,
        });
        generalizedDespiteConstant.push({
          label: meta?.label ?? key,
          value: distinct[0],
          reason: `consistent with the rule ${dependency.rule}, so it is bound to ${
            FIELD_META[dependency.source]?.label ?? dependency.source
          } rather than memorized`,
        });
        continue;
      }
    }

    // 2. Is it computed from the trigger? Then two matching samples are a
    //    coincidence, not a constant.
    if (derivation !== 'authored') {
      variables.push({
        name: key,
        label: meta?.label ?? key,
        derivation,
        observedValues: distinct,
        description: meta?.description ?? 'Computed from the trigger.',
        heldConstant: true,
      });
      generalizedDespiteConstant.push({
        label: meta?.label ?? key,
        value: distinct[0],
        reason: `computed from the report (${derivation}), so it is re-derived per run rather than memorized`,
      });
      continue;
    }

    // 3. Authored by the human and not derivable: a genuine constant.
    constants.push({ name: key, value: present[0][key] });
  }

  const order = Object.keys(FIELD_META);
  const rank = (n: string) => {
    const i = order.indexOf(n);
    return i === -1 ? order.length : i;
  };
  variables.sort((a, b) => rank(a.name) - rank(b.name));
  constants.sort((a, b) => rank(a.name) - rank(b.name));

  return { variables, constants, generalizedDespiteConstant };
}

/** A binding placeholder left in a compiled step's params. */
export type VarBinding = { $var: string };

export function isVarBinding(value: unknown): value is VarBinding {
  return typeof value === 'object' && value !== null && '$var' in (value as object);
}

function bind(name: string): VarBinding {
  return { $var: name };
}

/** Which fields each compiled step needs at run time. */
const STEP_PARAM_FIELDS: Record<StepKey, string[]> = {
  read: ['customerName', 'customerEmail'],
  understand: ['issueTitle', 'issueDescription', 'category', 'area', 'severity'],
  create: ['issueTitle', 'issueDescription', 'labels', 'severity'],
  assign: ['owner', 'area'],
  notify: ['channel', 'teamMessage', 'owner', 'issueNumber'],
  reply: ['customerEmail', 'customerName', 'owner', 'area', 'issueNumber'],
};

function permissionRank(p: string): number {
  return [
    'read',
    'analyze',
    'draft',
    'create_external',
    'send_message',
    'delete',
    'payment',
  ].indexOf(p);
}

function buildSteps(traces: WorkflowTrace[], diff: FieldDiff): WorkflowStep[] {
  const variableNames = new Set(diff.variables.map((v) => v.name));
  const constantMap = new Map(diff.constants.map((c) => [c.name, c.value]));

  const observedByStep = new Map<StepKey, SemanticAction[]>();
  for (const trace of traces) {
    for (const event of trace.events) {
      const key = specFor(event.action).stepKey;
      const list = observedByStep.get(key) ?? [];
      if (!list.includes(event.action)) list.push(event.action);
      observedByStep.set(key, list);
    }
  }

  const steps: WorkflowStep[] = [];
  for (const key of STEP_ORDER) {
    const actions = observedByStep.get(key);
    if (!actions || actions.length === 0) continue;

    const meta = STEP_META[key];
    const primary = actions.reduce((worst, a) =>
      permissionRank(specFor(a).permission) > permissionRank(specFor(worst).permission) ? a : worst,
    );

    const params: Record<string, unknown> = {};
    for (const field of STEP_PARAM_FIELDS[key]) {
      if (variableNames.has(field)) params[field] = bind(field);
      else if (constantMap.has(field)) params[field] = constantMap.get(field);
    }

    const permission = permissionFor(primary);
    steps.push({
      id: `step_${key}`,
      action: primary,
      app: meta.app as SourceApp,
      title: meta.title,
      description: meta.description,
      params,
      permission,
      requiresApproval: requiresApproval(permission),
    });
  }
  return steps;
}

export function buildEvidence(traces: WorkflowTrace[], diff: FieldDiff): PatternEvidence {
  const base = traces[0].events;
  const comparisons = traces.slice(1).map((t) => compareTraces(base, t.events));
  const avg = (pick: (c: (typeof comparisons)[number]) => number) =>
    comparisons.length === 0 ? 1 : comparisons.reduce((s, c) => s + pick(c), 0) / comparisons.length;

  const sharedApps =
    comparisons.length > 0 ? comparisons[0].sharedApps : unique(base.map((e) => e.sourceApp));

  return {
    matchingTraces: traces.length,
    sequenceSimilarity: avg((c) => c.sequence),
    appSimilarity: avg((c) => c.apps),
    intentSimilarity: avg((c) => c.intent),
    overallSimilarity: avg((c) => c.overall),
    sharedApps: sharedApps.filter((a) => a !== 'repeat'),
    sharedIntent: 'bug triage',
    variableFields: diff.variables.map((v) => v.label),
    constantFields: diff.constants.map((c) => FIELD_META[c.name]?.label ?? c.name),
    generalizedDespiteConstant: diff.generalizedDespiteConstant,
  };
}

export function compilePattern(traces: WorkflowTrace[]): LearnedPattern {
  const diff = diffFields(traces);
  const steps = buildSteps(traces, diff);
  const evidence = buildEvidence(traces, diff);

  // Baseline deliberately uses the *leanest* observed pass, not the average.
  // If the human did it more efficiently once, that is the fair comparison —
  // it under-claims the saving rather than inflating it.
  const manualDurationSeconds = Math.min(
    ...traces.map((t) => estimateEffortSeconds(t.events.map((e) => e.action))),
  );
  const manualActionCount = Math.min(...traces.map((t) => t.events.length));

  return {
    id: makeId('pattern'),
    name: 'Bug Triage',
    trigger: {
      type: 'incoming_support_email',
      description: 'Incoming bug report email',
      conditions: [
        'message is an inbound customer report',
        'body describes a defect rather than a question',
      ],
    },
    steps,
    variables: diff.variables,
    observations: traces.length,
    confidence: evidence.overallSimilarity * supportFactor(traces.length),
    status: 'candidate',
    evidence,
    traceIds: traces.map((t) => t.id),
    createdAt: new Date().toISOString(),
    manualDurationSeconds,
    manualActionCount,
  };
}

export { APPROVAL_SECONDS, FIELD_META, ROUTING_RULES };
