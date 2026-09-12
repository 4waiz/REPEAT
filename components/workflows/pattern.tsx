'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Hash,
  GitPullRequestArrow,
  Mail,
  ScanSearch,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import type { LearnedPattern } from '@/types';
import { STEP_META } from '@/lib/events/taxonomy';
import { isVarBinding } from '@/lib/patterns/compiler';
import { Badge, Button, ConfidenceBar, Dot } from '@/components/ui/primitives';
import { Orb } from '@/components/repeat/Orb';
import { cn, formatDuration, formatPercent } from '@/lib/utils';

/* ---------------------------------------------------------------------- */
/* Step chips                                                             */
/* ---------------------------------------------------------------------- */

const STEP_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  step_read: Mail,
  step_understand: ScanSearch,
  step_create: GitPullRequestArrow,
  step_assign: UserCheck,
  step_notify: Hash,
};

function StepChip({
  id,
  title,
  source,
  index,
  collapsing,
  centerIndex,
}: {
  id: string;
  title: string;
  source: string;
  index: number;
  collapsing: boolean;
  centerIndex: number;
}) {
  const Icon = STEP_ICON[id] ?? Sparkles;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.94 }}
      animate={
        collapsing
          ? {
              // Converge on the middle chip, then dissolve — "these were not
              // five separate actions, they were one workflow".
              x: (centerIndex - index) * 138,
              opacity: 0,
              scale: 0.55,
              filter: 'blur(3px)',
            }
          : { opacity: 1, y: 0, scale: 1, x: 0, filter: 'blur(0px)' }
      }
      transition={{
        duration: collapsing ? 0.75 : 0.44,
        delay: collapsing ? index * 0.045 : 0.1 + index * 0.075,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative flex min-w-0 flex-1 flex-col gap-1.5 rounded-lg border border-edge-soft bg-ink-800/70 px-3 py-2.5"
    >
      <span className="flex items-center gap-1.5 text-cyan-300">
        <Icon className="h-3.5 w-3.5 shrink-0" />
      </span>
      <span className="truncate text-xs font-medium leading-tight text-mist-100">{title}</span>
      <span className="truncate text-3xs uppercase tracking-[0.1em] text-mist-600">{source}</span>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------- */
/* Pattern discovered                                                     */
/* ---------------------------------------------------------------------- */

export function PatternDiscoveredCard({
  pattern,
  collapsing,
  onApprove,
  onShowFirst,
}: {
  pattern: LearnedPattern;
  collapsing: boolean;
  onApprove: () => void;
  onShowFirst: () => void;
}) {
  const [showEvidence, setShowEvidence] = React.useState(false);
  const centerIndex = Math.floor((pattern.steps.length - 1) / 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-panel border border-cyan-400/25 bg-ink-850/80 shadow-[0_0_60px_-24px_rgba(56,220,255,0.5)] backdrop-blur-xl"
    >
      {/* one slow sheen across the card as it appears */}
      <motion.span
        className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-cyan-400/[0.09] to-transparent"
        initial={{ x: '-120%' }}
        animate={{ x: '320%' }}
        transition={{ duration: 1.5, ease: 'easeInOut' }}
      />

      <div className="relative px-5 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Orb state="pattern" size={26} />
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-mist-50">
                  Pattern discovered
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-mist-400">
                These aren&apos;t {pattern.steps.length} separate actions. They&apos;re one workflow.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div>
              <div className="text-3xs uppercase tracking-[0.12em] text-mist-600">Observed</div>
              <div className="font-mono text-sm tabular-nums text-mist-100">
                {pattern.observations} times
              </div>
            </div>
            <div className="min-w-[8.5rem]">
              <div className="mb-1 text-3xs uppercase tracking-[0.12em] text-mist-600">
                Confidence
              </div>
              <ConfidenceBar value={pattern.confidence} showBlocks />
            </div>
          </div>
        </div>
      </div>

      {/* the five steps */}
      <div className="relative mt-4 px-5">
        <div className="flex items-stretch gap-2">
          {pattern.steps.map((step, i) => (
            <React.Fragment key={step.id}>
              <StepChip
                id={step.id}
                title={step.title}
                source={STEP_META[step.id.replace('step_', '') as keyof typeof STEP_META]?.source ?? ''}
                index={i}
                collapsing={collapsing}
                centerIndex={centerIndex}
              />
              {i < pattern.steps.length - 1 ? (
                <motion.span
                  animate={{ opacity: collapsing ? 0 : 1 }}
                  transition={{ duration: 0.25 }}
                  className="flex shrink-0 items-center text-mist-600"
                >
                  <ArrowRight className="h-3 w-3" />
                </motion.span>
              ) : null}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* the headline trade */}
      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-edge-faint px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-lg tabular-nums text-mist-50">
            {pattern.manualActionCount}
          </span>
          <span className="text-xs text-mist-400">manual actions</span>
          <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-mono text-lg tabular-nums text-cyan-300">1</span>
          <span className="text-xs text-mist-400">approval</span>
          <span className="ml-1 hidden text-xs text-mist-600 sm:inline">
            · about {formatDuration(pattern.manualDurationSeconds)} of work each time
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              // One disclosure control, not two. "Show me first" is the
              // inspection path: it opens the evidence and the compiled
              // template so you can read the workflow before arming it.
              setShowEvidence((v) => !v);
              if (!showEvidence) onShowFirst();
            }}
            disabled={collapsing}
          >
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', showEvidence && 'rotate-180')}
            />
            {showEvidence ? 'Hide details' : 'Show me first'}
          </Button>
          <Button variant="primary" onClick={onApprove} disabled={collapsing}>
            <Check className="h-4 w-4" />
            Approve
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showEvidence ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden border-t border-edge-faint"
          >
            <EvidencePanel pattern={pattern} />
            <CompiledTemplate pattern={pattern} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------- */
/* Evidence / explainability                                              */
/* ---------------------------------------------------------------------- */

export function EvidencePanel({
  pattern,
  className,
}: {
  pattern: LearnedPattern;
  className?: string;
}) {
  const e = pattern.evidence;
  return (
    <div className={cn('grid gap-5 px-5 py-4 lg:grid-cols-[1fr_1fr_1.15fr]', className)}>
      <div>
        <div className="eyebrow mb-2.5">Similarity</div>
        <dl className="space-y-2">
          {[
            { label: 'Action sequence', value: e.sequenceSimilarity },
            { label: 'Applications', value: e.appSimilarity },
            { label: 'Semantic intent', value: e.intentSimilarity },
          ].map((row) => (
            <div key={row.label} className="grid grid-cols-[7.5rem_1fr] items-center gap-2">
              <dt className="truncate text-xs text-mist-400">{row.label}</dt>
              <dd>
                <ConfidenceBar value={row.value} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2.5 text-3xs leading-relaxed text-mist-600">
          Weighted 55 / 20 / 25. Sequence uses edit distance, so an extra or skipped step does not
          break the match.
        </p>
      </div>

      <div>
        <div className="eyebrow mb-2.5">Shared structure</div>
        <div className="space-y-2 text-xs">
          <div className="flex items-baseline gap-2">
            <span className="w-20 shrink-0 text-mist-600">Workflows</span>
            <span className="text-mist-200">{e.matchingTraces} matching</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="w-20 shrink-0 text-mist-600">Apps</span>
            <span className="text-mist-200">
              {e.sharedApps.map((a) => (a === 'mail' ? 'Mail' : a === 'tracker' ? 'Tracker' : 'Chat')).join(' → ')}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="w-20 shrink-0 text-mist-600">Intent</span>
            <span className="text-mist-200">{e.sharedIntent}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="w-20 shrink-0 text-mist-600">Constant</span>
            <span className="text-mist-200">
              {e.constantFields.length ? e.constantFields.join(', ') : 'none'}
            </span>
          </div>
        </div>
      </div>

      <div>
        <div className="eyebrow mb-2.5">Generalized fields</div>
        <div className="flex flex-wrap gap-1">
          {pattern.variables.map((v) => (
            <span
              key={v.name}
              className={cn(
                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs',
                v.heldConstant
                  ? 'border-amber-400/30 bg-amber-400/[0.08] text-amber-200'
                  : 'border-edge-soft bg-white/[0.03] text-mist-300',
              )}
              title={v.description}
            >
              {v.label}
            </span>
          ))}
        </div>

        {/* The single most important explanation in the product. */}
        {e.generalizedDespiteConstant.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Dot tone="amber" />
              <span className="text-3xs font-semibold uppercase tracking-[0.12em] text-amber-300">
                Not memorized
              </span>
            </div>
            <ul className="space-y-1.5">
              {e.generalizedDespiteConstant.map((g) => (
                <li key={g.label} className="text-3xs leading-relaxed text-mist-300">
                  <span className="font-medium text-mist-100">{g.label}</span> was{' '}
                  <span className="font-mono text-amber-200">{g.value}</span> in every observation,
                  but it is {g.reason}.
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Compiled template                                                      */
/* ---------------------------------------------------------------------- */

/**
 * The workflow REPEAT actually compiled, showing which params are bound to
 * variables and which are inlined constants. This is the artefact the whole
 * product produces, so it should be readable rather than implied.
 */
function CompiledTemplate({ pattern }: { pattern: LearnedPattern }) {
  return (
    <div className="border-t border-edge-faint px-5 py-4">
      <div className="eyebrow mb-2.5">Compiled workflow</div>
      <ol className="space-y-1.5">
        {pattern.steps.map((step, i) => (
          <li key={step.id} className="flex items-start gap-2.5">
            <span className="mt-0.5 w-3 shrink-0 text-right font-mono text-3xs tabular-nums text-mist-700">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-xs text-mist-100">{step.title}</span>
                <span className="font-mono text-3xs text-mist-600">{step.action}</span>
                {step.requiresApproval ? (
                  <span className="rounded border border-amber-400/30 bg-amber-400/[0.08] px-1 py-px text-3xs uppercase tracking-[0.1em] text-amber-300">
                    needs approval
                  </span>
                ) : null}
              </div>
              {Object.keys(step.params).length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(step.params).map(([key, value]) => {
                    const bound = isVarBinding(value);
                    return (
                      <span
                        key={key}
                        className={cn(
                          'rounded border px-1.5 py-px font-mono text-3xs',
                          bound
                            ? 'border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-200'
                            : 'border-edge-soft bg-white/[0.03] text-mist-300',
                        )}
                        title={bound ? 'resolved per run from the trigger' : 'inlined constant'}
                      >
                        {key}
                        {bound ? ' = ⟨bound⟩' : ` = "${String(value)}"`}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2.5 text-3xs leading-relaxed text-mist-600">
        <span className="text-cyan-300">Bound</span> values are re-derived from each new report.
        Quoted values are the only things REPEAT memorised.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Agent card — the result of the collapse                                */
/* ---------------------------------------------------------------------- */

export function AgentCard({
  pattern,
  runs,
  onRunGhost,
  compact,
}: {
  pattern: LearnedPattern;
  runs?: number;
  onRunGhost?: () => void;
  compact?: boolean;
}) {
  return (
    <motion.div
      layoutId="agent-card"
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-panel border border-teal-400/25 bg-ink-850/80 shadow-[0_0_50px_-22px_rgba(45,212,167,0.45)] backdrop-blur-xl"
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-teal-400/30 bg-teal-400/10">
            <Bot className="h-4 w-4 text-teal-300" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-mist-50">
                {pattern.name} Agent
              </h3>
              <Badge tone={pattern.status === 'active' ? 'teal' : 'neutral'}>
                <Dot tone={pattern.status === 'active' ? 'teal' : 'neutral'} pulse />
                {pattern.status === 'active' ? 'Ready' : pattern.status}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-mist-500">{pattern.trigger.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
          <Metric label="Steps" value={String(pattern.steps.length)} />
          <Metric label="Observed" value={`${pattern.observations}×`} />
          <Metric label="Confidence" value={formatPercent(pattern.confidence)} tone="teal" />
          {typeof runs === 'number' ? <Metric label="Runs" value={String(runs)} /> : null}
          <Metric label="Approval" value="Required" tone="amber" />
        </div>

        {!compact && onRunGhost ? (
          <div className="ml-auto">
            <Button variant="iris" onClick={onRunGhost}>
              Run Ghost
            </Button>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'teal' | 'amber';
}) {
  return (
    <div>
      <div className="text-3xs uppercase tracking-[0.12em] text-mist-600">{label}</div>
      <div
        className={cn(
          'mt-0.5 font-mono text-sm tabular-nums',
          tone === 'teal' ? 'text-teal-300' : tone === 'amber' ? 'text-amber-300' : 'text-mist-100',
        )}
      >
        {value}
      </div>
    </div>
  );
}
