'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BellRing,
  Check,
  Clock,
  Eye,
  MousePointerClick,
  RefreshCw,
  ScanSearch,
  TriangleAlert,
} from 'lucide-react';
import type { AgentRun, LearnedPattern } from '@/types';
import { APPROVAL_SECONDS } from '@/lib/events/taxonomy';
import { useRepeat, selectObservedCount, OBSERVABLE_SEQUENCE } from '@/lib/store/repeat-store';
import { GhostRunPanel } from '@/components/ghost-run/GhostRunPanel';
import { AgentCard, PatternDiscoveredCard } from './pattern';
import { Badge, Button, ConfidenceBar, Dot } from '@/components/ui/primitives';
import { Orb } from '@/components/repeat/Orb';
import { cn, formatDuration } from '@/lib/utils';

/**
 * The Action Panel.
 *
 * One strip that always shows the single most important thing happening, and
 * nothing else. It is the narrative spine of the demo: learning, then the
 * pattern, then the agent, then the Ghost Run, then the result.
 */
export function ActionPanel() {
  const phase = useRepeat((s) => s.phase);
  const patterns = useRepeat((s) => s.patterns);
  const collapsing = useRepeat((s) => s.collapsing);
  const activeRun = useRepeat((s) => s.activeRun);
  const runningIndex = useRepeat((s) => s.runningIndex);
  const traces = useRepeat((s) => s.traces);
  const confidence = useRepeat((s) => s.confidencePeak);
  const observed = useRepeat(selectObservedCount);
  const banner = useRepeat((s) => s.banner);

  const approvePattern = useRepeat((s) => s.approvePattern);
  const showPatternFirst = useRepeat((s) => s.showPatternFirst);
  const approveAndExecute = useRepeat((s) => s.approveAndExecute);
  const cancelRun = useRepeat((s) => s.cancelRun);
  const resolveOwner = useRepeat((s) => s.resolveOwner);
  const deliverNextBug = useRepeat((s) => s.deliverNextBug);
  const retryRun = useRepeat((s) => s.retryRun);

  const pattern = patterns[0] ?? null;

  // AnimatePresence with mode="wait" must receive exactly one child. Rendering
  // several conditional siblings (all null but one) leaves it waiting on an
  // exit that never resolves, and the panel silently stops updating.
  let key = 'learning';
  let content: React.ReactNode = (
    <LearningStrip
      phase={phase}
      observed={observed}
      total={OBSERVABLE_SEQUENCE.length}
      traces={traces.length}
      confidence={confidence}
      onDeliver={deliverNextBug}
    />
  );

  if (phase === 'pattern_discovered' && pattern) {
    key = 'pattern';
    content = (
      <PatternDiscoveredCard
        pattern={pattern}
        collapsing={collapsing}
        onApprove={approvePattern}
        onShowFirst={showPatternFirst}
      />
    );
  } else if (phase === 'agent_ready' && pattern) {
    key = 'agent';
    content = (
      <div className="space-y-2.5">
        <AgentCard pattern={pattern} />
        <NextStepHint onDeliver={deliverNextBug} />
      </div>
    );
  } else if (phase === 'trigger_detected' && activeRun) {
    key = 'trigger';
    content = <TriggerBanner run={activeRun} text={banner?.text ?? 'New bug report received.'} />;
  } else if ((phase === 'ghost_run' || phase === 'executing') && activeRun) {
    key = 'ghost';
    content = (
      <GhostRunPanel
        run={activeRun}
        executing={phase === 'executing'}
        runningIndex={runningIndex}
        onExecute={() => void approveAndExecute()}
        onCancel={cancelRun}
        onResolveOwner={resolveOwner}
      />
    );
  } else if (phase === 'completed' && activeRun) {
    key = 'done';
    content = <CompletionCard run={activeRun} onNext={deliverNextBug} />;
  } else if (phase === 'error' && activeRun) {
    key = 'error';
    content = <FailureCard run={activeRun} onRetry={() => void retryRun()} onCancel={cancelRun} />;
  }

  return (
    <div className="px-4 py-3">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={key} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Learning                                                               */
/* ---------------------------------------------------------------------- */

function LearningStrip({
  phase,
  observed,
  total,
  traces,
  confidence,
  onDeliver,
}: {
  phase: string;
  observed: number;
  total: number;
  traces: number;
  confidence: number;
  onDeliver?: () => void;
}) {
  const comparing = phase === 'comparing';
  const observing = phase === 'observing';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-panel border border-edge-faint bg-ink-900/60 px-5 py-3.5"
    >
      <div className="flex items-center gap-3">
        <Orb state={observing || comparing ? 'learning' : 'idle'} size={26} />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[0.8125rem] font-medium text-mist-100">
              {comparing
                ? 'Comparing with what I have already seen'
                : observing
                  ? 'Learning your work'
                  : traces > 0
                    ? 'Watching for a repeat'
                    : 'Watching'}
            </span>
            {observing ? (
              <Badge tone="cyan">
                <Dot tone="cyan" pulse />
                observing
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-mist-500">
            {comparing
              ? 'Scoring this workflow against the earlier one.'
              : observing
                ? 'Recording semantic actions. Nothing is being automated yet.'
                : traces > 0
                  ? `${traces} workflow${traces === 1 ? '' : 's'} observed. Do it once more and REPEAT can generalise it.`
                  : 'Open the support report in Mail and triage it the way you normally would.'}
          </p>
        </div>
      </div>

      {observing ? (
        <div className="flex items-center gap-2.5">
          <div className="flex gap-[3px]">
            {Array.from({ length: total }).map((_, i) => (
              <motion.span
                key={i}
                animate={{ opacity: i < observed ? 1 : 0.16, scaleY: i < observed ? 1 : 0.5 }}
                transition={{ duration: 0.25 }}
                className="h-3.5 w-[4px] rounded-full bg-cyan-400"
              />
            ))}
          </div>
          <span className="font-mono text-xs tabular-nums text-mist-400">
            {observed} / {total}
          </span>
        </div>
      ) : null}

      {traces > 0 && confidence > 0 ? (
        <div className="min-w-[11rem]">
          <div className="mb-1 text-3xs uppercase tracking-[0.12em] text-mist-600">
            Pattern confidence
          </div>
          <ConfidenceBar value={confidence} showBlocks />
        </div>
      ) : null}

      {!observing && traces === 0 ? (
        <span className="ml-auto flex items-center gap-1.5 text-xs text-mist-600">
          <MousePointerClick className="h-3.5 w-3.5" />
          Follow the highlighted controls
        </span>
      ) : null}

      {!observing && !comparing && traces > 0 && onDeliver ? (
        <Button variant="outline" size="sm" className="ml-auto" onClick={onDeliver}>
          <BellRing className="h-3 w-3" />
          Send the next report
        </Button>
      ) : null}
    </motion.div>
  );
}

/* ---------------------------------------------------------------------- */
/* Agent ready hint                                                       */
/* ---------------------------------------------------------------------- */

function NextStepHint({ onDeliver }: { onDeliver: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-panel border border-edge-faint bg-ink-900/50 px-5 py-3">
      <ScanSearch className="h-4 w-4 shrink-0 text-cyan-400" />
      <p className="min-w-0 flex-1 text-xs leading-relaxed text-mist-400">
        The agent is armed. The next matching bug report will be handled by REPEAT — it will plan
        the work and wait for your approval.{' '}
        <span className="text-mist-300">You don&apos;t have to do anything.</span>
      </p>
      <Button variant="outline" size="sm" onClick={onDeliver}>
        <BellRing className="h-3 w-3" />
        Send the next bug report
      </Button>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Trigger detected                                                       */
/* ---------------------------------------------------------------------- */

function TriggerBanner({ run, text }: { run: AgentRun; text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-panel border border-cyan-400/35 bg-ink-850/85 px-5 py-4 shadow-[0_0_54px_-22px_rgba(56,220,255,0.55)] backdrop-blur-xl"
    >
      <motion.span
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0.25, 0.6, 0.25] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background:
            'radial-gradient(600px 120px at 20% 50%, rgba(56,220,255,0.13), transparent 70%)',
        }}
      />
      <div className="relative flex flex-wrap items-center gap-4">
        <Orb state="pattern" size={30} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              Trigger detected
            </span>
            <Badge tone="cyan">{run.patternName}</Badge>
          </div>
          <p className="mt-1 text-sm text-mist-100">{text}</p>
          <p className="mt-0.5 text-xs text-mist-500">{run.triggerSummary}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-mist-400">
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            Preparing Ghost Run
          </motion.span>
          <ArrowRight className="h-3.5 w-3.5 text-cyan-400" />
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------- */
/* Completion                                                             */
/* ---------------------------------------------------------------------- */

function CompletionCard({ run, onNext }: { run: AgentRun; onNext: () => void }) {
  const created = run.proposedActions.find((a) => a.action === 'tracker.create_issue');
  const assigned = run.proposedActions.find((a) => a.action === 'tracker.assign_owner');
  const issueNumber = created?.result?.data?.number ?? created?.resolvedParams.issueNumber;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-panel border border-teal-400/30 bg-ink-850/85 shadow-[0_0_60px_-22px_rgba(45,212,167,0.5)] backdrop-blur-xl"
    >
      <motion.span
        className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-teal-400/[0.1] to-transparent"
        initial={{ x: '-120%' }}
        animate={{ x: '320%' }}
        transition={{ duration: 1.4, ease: 'easeInOut' }}
      />

      <div className="relative flex flex-wrap items-center gap-x-9 gap-y-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-teal-400/40 bg-teal-400/15"
          >
            <Check className="h-4 w-4 text-teal-300" strokeWidth={3} />
          </motion.span>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-mist-50">
              Workflow complete
            </h2>
            <p className="mt-0.5 text-xs text-mist-400">
              Issue #{String(issueNumber)} created and assigned to{' '}
              <span className="text-teal-200">{String(assigned?.resolvedParams.owner)}</span>. Team
              notified.
            </p>
          </div>
        </div>

        {/* the headline trade, computed from the real run */}
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="font-mono text-2xl leading-none tabular-nums text-mist-50">
              {run.manualActionsAvoided}
            </div>
            <div className="mt-1 text-3xs uppercase tracking-[0.12em] text-mist-600">
              manual actions
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-teal-400" />
          <div className="text-center">
            <div className="font-mono text-2xl leading-none tabular-nums text-teal-300">1</div>
            <div className="mt-1 text-3xs uppercase tracking-[0.12em] text-mist-600">approval</div>
          </div>
        </div>

        <div className="group relative">
          <div className="flex items-center gap-1.5 text-3xs uppercase tracking-[0.12em] text-mist-600">
            <Clock className="h-3 w-3" />
            Estimated time saved
          </div>
          <div className="mt-1 font-mono text-xl tabular-nums text-teal-300">
            {formatDuration(run.timeSavedSeconds)}
          </div>
          <span className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-max max-w-[20rem] whitespace-pre-line rounded-lg border border-edge bg-ink-800/95 px-2.5 py-2 text-3xs leading-relaxed text-mist-300 opacity-0 shadow-lift backdrop-blur-xl transition-opacity group-hover:opacity-100">
            {`Derived, not asserted:\n${run.manualActionsAvoided} observed actions cost ~${formatDuration(
              run.timeSavedSeconds + APPROVAL_SECONDS,
            )} by hand (per-action estimates plus one context switch per app change),\nminus ~${APPROVAL_SECONDS}s to read and approve this run.`}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Badge tone="teal">
            <Check className="h-2.5 w-2.5" />
            Run successful
          </Badge>
          <Button variant="outline" size="sm" onClick={onNext}>
            Send another
          </Button>
        </div>
      </div>

      {/* verification receipts */}
      <div className="relative flex flex-wrap gap-x-5 gap-y-1.5 border-t border-edge-faint px-5 py-2.5">
        {run.proposedActions
          .filter((a) => a.result?.ok && a.permission !== 'read' && a.permission !== 'analyze')
          .map((a) => (
            <span key={a.id} className="flex items-center gap-1.5 text-3xs text-mist-500">
              <Check className="h-2.5 w-2.5 text-teal-400" strokeWidth={3} />
              {a.result?.summary}
              <span className="font-mono text-mist-700">via {a.result?.adapter}</span>
            </span>
          ))}
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------- */
/* Failure                                                                */
/* ---------------------------------------------------------------------- */

function FailureCard({
  run,
  onRetry,
  onCancel,
}: {
  run: AgentRun;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const failedIndex = run.failureStepIndex ?? 0;
  const failed = run.proposedActions[failedIndex];
  const completed = run.proposedActions.filter((a) => a.status === 'succeeded');

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-panel border border-amber-400/30 bg-ink-850/85 px-5 py-4 shadow-[0_0_50px_-24px_rgba(245,181,68,0.45)] backdrop-blur-xl"
    >
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/35 bg-amber-400/12">
          <TriangleAlert className="h-4 w-4 text-amber-300" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-mist-50">
            Failed at step {failedIndex + 1}
          </h2>
          <p className="mt-1 text-xs text-mist-300">
            {failed?.title}: <span className="text-amber-200">{failed?.result?.error}</span>
          </p>
          <p className="mt-1.5 text-xs text-mist-500">
            {completed.length} completed step{completed.length === 1 ? '' : 's'} preserved. Nothing
            after this step was attempted, and no step has been reported as successful.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Discard run
          </Button>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-edge-faint pt-2.5">
        {run.proposedActions.map((a, i) => (
          <span
            key={a.id}
            className={cn(
              'flex items-center gap-1.5 text-3xs',
              a.status === 'succeeded'
                ? 'text-teal-300'
                : a.status === 'failed'
                  ? 'text-rose-300'
                  : 'text-mist-600',
            )}
          >
            {a.status === 'succeeded' ? (
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            ) : a.status === 'failed' ? (
              <TriangleAlert className="h-2.5 w-2.5" />
            ) : (
              <Eye className="h-2.5 w-2.5 opacity-40" />
            )}
            {i + 1}. {a.title}
            {a.status === 'skipped' ? ' (not attempted)' : ''}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

export type { LearnedPattern };
