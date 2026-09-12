'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  Eye,
  Ghost,
  Lock,
  Play,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { AgentRun, IssueReference, PermissionClass, PlannedAction, RiskLevel } from '@/types';
import { PERMISSION_POLICY } from '@/lib/policy/policy';
import { AREA_DISPLAY, CATEGORY_DISPLAY, SEVERITY_DISPLAY } from '@/lib/agents/understanding';
import { TEAM } from '@/lib/demo/team';
import { Badge, Button, ConfidenceBar, Dot } from '@/components/ui/primitives';
import { Orb } from '@/components/repeat/Orb';
import { cn, formatPercent, hostnameOf } from '@/lib/utils';

/**
 * Ghost Run.
 *
 * A fully resolved plan that has touched nothing. Everything shown here is
 * observable evidence, structured interpretation, proposed actions,
 * permissions, risk and expected result — never model reasoning.
 *
 * The EXECUTE control is the only path from plan to action, and the executor
 * re-checks approval per action, so this panel cannot leak.
 */

const PERMISSION_TONE: Record<PermissionClass, 'neutral' | 'cyan' | 'amber' | 'rose'> = {
  read: 'neutral',
  analyze: 'neutral',
  draft: 'cyan',
  create_external: 'amber',
  send_message: 'amber',
  delete: 'rose',
  payment: 'rose',
};

const RISK_TONE: Record<RiskLevel, { tone: 'teal' | 'amber' | 'rose'; label: string }> = {
  low: { tone: 'teal', label: 'Low' },
  medium: { tone: 'amber', label: 'Medium' },
  high: { tone: 'rose', label: 'High' },
  blocked: { tone: 'rose', label: 'Blocked' },
};

export function GhostRunPanel({
  run,
  executing,
  runningIndex,
  onExecute,
  onCancel,
  onResolveOwner,
}: {
  run: AgentRun;
  executing: boolean;
  runningIndex: number;
  onExecute: () => void;
  onCancel: () => void;
  onResolveOwner: (owner: string) => void;
}) {
  const u = run.understanding;
  const risk = RISK_TONE[run.risk];
  const needsReview = run.proposedActions.filter((a) => a.status === 'needs_review');
  const blocked = needsReview.length > 0 || run.risk === 'blocked';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative overflow-hidden rounded-panel border bg-ink-850/80 backdrop-blur-xl',
        executing
          ? 'border-cyan-400/30 shadow-[0_0_60px_-24px_rgba(56,220,255,0.5)]'
          : 'border-iris-400/25 shadow-[0_0_60px_-24px_rgba(139,124,255,0.45)]',
      )}
    >
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-4">
        <div className="flex items-start gap-3">
          <Orb state={executing ? 'executing' : 'ghost'} size={28} />
          <div>
            <div className="flex items-center gap-2">
              {executing ? (
                <Play className="h-3.5 w-3.5 text-cyan-300" />
              ) : (
                <Ghost className="h-3.5 w-3.5 text-iris-300" />
              )}
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-mist-50">
                {executing ? 'Executing workflow' : 'Ghost Run'}
              </h2>
              <Badge tone={executing ? 'cyan' : 'iris'}>{run.patternName}</Badge>
            </div>
            <p className="mt-1 text-xs text-mist-400">
              <span className="text-mist-600">Trigger · </span>
              {run.triggerSummary}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div>
            <div className="text-3xs uppercase tracking-[0.12em] text-mist-600">Risk</div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Dot tone={risk.tone} />
              <span
                className={cn(
                  'font-mono text-sm',
                  risk.tone === 'teal'
                    ? 'text-teal-300'
                    : risk.tone === 'amber'
                      ? 'text-amber-300'
                      : 'text-rose-300',
                )}
              >
                {risk.label}
              </span>
            </div>
          </div>
          <div className="min-w-[8rem]">
            <div className="mb-1 text-3xs uppercase tracking-[0.12em] text-mist-600">
              Confidence
            </div>
            <ConfidenceBar value={run.confidence} tone={executing ? 'cyan' : 'iris'} />
          </div>
        </div>
      </div>

      {/* adaptation callouts — the proof it generalized */}
      <AnimatePresence>
        {run.adaptations.length > 0 && !executing ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="overflow-hidden px-5 pt-3.5"
          >
            <div className="space-y-2">
              {run.adaptations.map((a) => (
                <div
                  key={a.field}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-cyan-400/25 bg-cyan-400/[0.07] px-3 py-2"
                >
                  <span className="text-3xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
                    adapted
                  </span>
                  <span className="text-xs text-mist-400">
                    {a.field === 'owner' ? 'Owner' : 'Engineering area'}
                  </span>
                  <span className="font-mono text-xs text-mist-500 line-through decoration-mist-600">
                    {a.observedValue}
                  </span>
                  <ArrowRight className="h-3 w-3 text-cyan-400" />
                  <span className="font-mono text-xs font-semibold text-cyan-200">
                    {a.adaptedValue}
                  </span>
                  <span className="rounded border border-edge-soft bg-white/[0.04] px-1.5 py-px font-mono text-3xs text-mist-300">
                    rule: {a.rule}
                  </span>
                  <span className="w-full text-3xs leading-relaxed text-mist-500">{a.reason}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1.55fr_1fr]">
        {/* Proposed actions. Two numbered columns on wide screens: nine rows
            in a single column pushes Execute below the fold mid-demo. */}
        <div>
          <div className="eyebrow mb-2.5">REPEAT would</div>
          <ol className="grid gap-1 xl:grid-cols-2 xl:gap-x-2.5">
            {run.proposedActions.map((action, i) => (
              <ActionRow
                key={action.id}
                action={action}
                index={i}
                active={executing && i === runningIndex}
                onResolveOwner={onResolveOwner}
              />
            ))}
          </ol>
        </div>

        {/* structured interpretation */}
        <div className="space-y-3.5">
          <div>
            <div className="eyebrow mb-2">Structured interpretation</div>
            <dl className="space-y-1.5 text-xs">
              <Row label="Customer" value={`${u.customerName} · ${u.customerEmail}`} />
              <Row label="Title" value={u.issueTitle} />
              <Row label="Area" value={AREA_DISPLAY[u.area]} accent />
              <Row label="Category" value={CATEGORY_DISPLAY[u.category]} />
              <Row label="Severity" value={SEVERITY_DISPLAY[u.severity]} />
              <Row label="Labels" value={u.labels.join(', ')} />
              <Row
                label="Understood by"
                value={
                  u.source === 'llm'
                    ? `${u.model ?? 'language model'} via ${u.provider === 'openai' ? 'OpenAI' : 'OpenRouter'} · validated`
                    : 'deterministic classifier'
                }
              />
            </dl>
          </div>

          <div>
            <div className="eyebrow mb-2">Evidence from the report</div>
            <div className="flex flex-wrap gap-1">
              {u.evidence.map((ev) => (
                <span
                  key={ev}
                  className="rounded border border-edge-soft bg-white/[0.03] px-1.5 py-0.5 font-mono text-3xs text-mist-300"
                >
                  {ev}
                </span>
              ))}
            </div>
          </div>

          {u.references && u.references.length > 0 ? (
            <ReferenceList references={u.references} />
          ) : null}

          <div>
            <div className="eyebrow mb-2">Permissions requested</div>
            <div className="space-y-1">
              {uniquePermissions(run.proposedActions).map((p) => (
                <div key={p} className="flex items-start gap-2">
                  <Badge tone={PERMISSION_TONE[p]} className="mt-px shrink-0">
                    {PERMISSION_POLICY[p].label}
                  </Badge>
                  <span className="text-3xs leading-relaxed text-mist-500">
                    {PERMISSION_POLICY[p].rationale}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge-faint px-5 py-3.5">
        <div className="flex items-center gap-2">
          {executing ? (
            <>
              <Dot tone="cyan" pulse />
              <span className="text-xs text-mist-300">
                Step {Math.min(runningIndex + 1, run.proposedActions.length)} of{' '}
                {run.proposedActions.length}
              </span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
              <span className="text-xs text-mist-300">No external changes have been made.</span>
            </>
          )}
        </div>

        {!executing ? (
          <div className="flex items-center gap-2">
            {blocked ? (
              <span className="flex items-center gap-1.5 text-xs text-amber-300">
                <Lock className="h-3.5 w-3.5" />
                Resolve the highlighted step to continue
              </span>
            ) : null}
            <Button variant="ghost" size="md" onClick={onCancel}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button variant="iris" onClick={onExecute} disabled={blocked}>
              <Play className="h-4 w-4" />
              Execute
            </Button>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function uniquePermissions(actions: PlannedAction[]): PermissionClass[] {
  const order: PermissionClass[] = [
    'read',
    'analyze',
    'draft',
    'create_external',
    'send_message',
    'delete',
    'payment',
  ];
  const present = new Set(actions.map((a) => a.permission));
  return order.filter((p) => present.has(p));
}

/**
 * Related context the research step attached. Public pages only, found from
 * the symptom phrase; the customer's identity never left the machine.
 */
function ReferenceList({ references }: { references: IssueReference[] }) {
  return (
    <div>
      <div className="eyebrow mb-2">Related context · via Exa</div>
      <ul className="space-y-1.5">
        {references.map((ref) => (
          <li key={ref.url} className="rounded-md border border-edge-faint bg-white/[0.02] px-2 py-1.5">
            <a
              href={ref.url}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-start gap-1.5 text-xs text-mist-100 transition hover:text-cyan-200"
            >
              <span className="min-w-0 flex-1 truncate">{ref.title}</span>
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-mist-600" />
            </a>
            <div className="mt-0.5 font-mono text-3xs text-mist-600">{hostnameOf(ref.url)}</div>
            {ref.snippet ? (
              <p className="mt-1 line-clamp-2 text-3xs leading-relaxed text-mist-500">{ref.snippet}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-baseline gap-2">
      <dt className="truncate text-mist-600">{label}</dt>
      <dd className={cn('min-w-0 break-words', accent ? 'font-medium text-cyan-200' : 'text-mist-200')}>
        {value}
      </dd>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Action row                                                             */
/* ---------------------------------------------------------------------- */

function ActionRow({
  action,
  index,
  active,
  onResolveOwner,
}: {
  action: PlannedAction;
  index: number;
  active: boolean;
  onResolveOwner: (owner: string) => void;
}) {
  const isDone = action.status === 'succeeded';
  const isFailed = action.status === 'failed';
  const isSkipped = action.status === 'skipped';
  const needsReview = action.status === 'needs_review';

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: isSkipped ? 0.4 : 1, x: 0 }}
      transition={{ duration: 0.32, delay: index * 0.035, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'relative rounded-lg border px-2.5 py-2 transition-colors duration-300',
        active
          ? 'border-cyan-400/40 bg-cyan-400/[0.08]'
          : isDone
            ? 'border-teal-400/20 bg-teal-400/[0.05]'
            : isFailed
              ? 'border-rose-400/35 bg-rose-400/[0.08]'
              : needsReview
                ? 'border-amber-400/35 bg-amber-400/[0.07]'
                : 'border-edge-faint',
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-px w-3 shrink-0 text-right font-mono text-3xs tabular-nums text-mist-700">
          {index + 1}
        </span>
        <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center">
          {isDone ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 22 }}
              className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-400/20"
            >
              <Check className="h-2.5 w-2.5 text-teal-300" strokeWidth={3} />
            </motion.span>
          ) : isFailed ? (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-400/20">
              <X className="h-2.5 w-2.5 text-rose-300" strokeWidth={3} />
            </span>
          ) : needsReview ? (
            <AlertTriangle className="h-3 w-3 text-amber-300" />
          ) : active ? (
            <motion.span
              className="h-2 w-2 rounded-full bg-cyan-400"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          ) : (
            <span className="h-2 w-2 rounded-full border border-mist-600" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span
              className={cn(
                'text-xs font-medium',
                isDone ? 'text-teal-200' : isFailed ? 'text-rose-200' : 'text-mist-100',
              )}
            >
              {action.title}
            </span>
            <Badge tone={PERMISSION_TONE[action.permission]} className="shrink-0">
              {PERMISSION_POLICY[action.permission].label}
            </Badge>
            {action.adaptation ? (
              <Badge tone="cyan" className="shrink-0">
                adapted
              </Badge>
            ) : null}
          </div>

          <p
            className={cn(
              'mt-0.5 break-words text-3xs leading-relaxed',
              isFailed ? 'text-rose-300' : 'text-mist-500',
            )}
          >
            {isFailed && action.result?.error ? action.result.error : action.detail}
          </p>

          {isDone && action.result ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-0.5 font-mono text-3xs text-teal-400/80"
            >
              {action.result.summary}
            </motion.p>
          ) : null}

          {needsReview && action.review ? (
            <div className="mt-2 rounded-md border border-amber-400/25 bg-ink-900/60 p-2">
              <div className="mb-1 flex items-center gap-1.5">
                <Eye className="h-2.5 w-2.5 text-amber-300" />
                <span className="text-3xs font-semibold uppercase tracking-[0.12em] text-amber-300">
                  Requires review
                </span>
              </div>
              <p className="mb-2 text-3xs leading-relaxed text-mist-400">{action.review.reason}</p>
              <div className="flex flex-wrap gap-1">
                {(action.review.options ?? TEAM.map((t) => t.name)).map((owner) => (
                  <button
                    key={owner}
                    onClick={() => onResolveOwner(owner)}
                    className="rounded border border-edge bg-ink-800/70 px-1.5 py-0.5 text-2xs text-mist-200 transition hover:border-amber-400/40 hover:text-amber-200"
                  >
                    {owner}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </motion.li>
  );
}

/**
 * Compact Ghost Run summary for the bottom rail. Shows what the plan would do
 * without the full interpretation panel.
 */
export function GhostRunCompact({
  run,
  onOpen,
  onExecute,
  executing,
  runningIndex,
  finished,
}: {
  run: AgentRun | null;
  onOpen: () => void;
  onExecute: () => void;
  executing: boolean;
  runningIndex: number;
  /** The run has already been carried out — never offer Execute again. */
  finished?: boolean;
}) {
  if (!run) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 text-center">
        <Ghost className="h-4 w-4 text-mist-600" />
        <p className="text-xs text-mist-400">No run planned</p>
        <p className="max-w-[13rem] text-3xs leading-relaxed text-mist-600">
          When a learned trigger fires, REPEAT plans the work here before doing any of it.
        </p>
      </div>
    );
  }

  const consequential = run.proposedActions.filter(
    (a) => a.permission === 'create_external' || a.permission === 'send_message',
  );
  const blocked = run.proposedActions.some((a) => a.status === 'needs_review');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-3xs uppercase tracking-[0.12em] text-mist-600">REPEAT would</span>
          <Badge tone={run.risk === 'low' ? 'teal' : 'amber'}>risk {run.risk}</Badge>
        </div>
        <ol className="space-y-1">
          {run.proposedActions.map((a, i) => (
            <li key={a.id} className="flex items-start gap-1.5">
              <span
                className={cn(
                  'mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full',
                  a.status === 'succeeded'
                    ? 'bg-teal-400'
                    : a.status === 'failed'
                      ? 'bg-rose-400'
                      : a.status === 'needs_review'
                        ? 'bg-amber-400'
                        : executing && i === runningIndex
                          ? 'bg-cyan-400'
                          : 'bg-mist-600',
                )}
              />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-3xs',
                  a.status === 'succeeded' ? 'text-teal-200/90' : 'text-mist-400',
                )}
                title={a.detail}
              >
                {a.title}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="shrink-0 border-t border-edge-faint px-3.5 py-2.5">
        <p className="mb-2 text-3xs leading-relaxed text-mist-600">
          {finished
            ? run.status === 'completed'
              ? 'Run complete. Every step was verified against its result.'
              : 'Run stopped. Completed steps were preserved.'
            : executing
              ? 'Executing — completed steps are preserved if a step fails.'
              : `${consequential.length} steps need approval. No changes until you approve.`}
        </p>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={onOpen} className="flex-1">
            <Eye className="h-3 w-3" />
            {finished ? 'Review steps' : 'Preview steps'}
          </Button>
          {/* Never offer Execute on a run that already happened — a second
              press would create a duplicate ticket and post again. */}
          {!executing && !finished ? (
            <Button
              variant="primary"
              size="sm"
              onClick={onExecute}
              disabled={blocked}
              className="flex-1"
            >
              <Play className="h-3 w-3" />
              Execute
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
