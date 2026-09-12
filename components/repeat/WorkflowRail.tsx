'use client';

import { motion } from 'framer-motion';
import { Check, GitPullRequestArrow, Hash, Mail } from 'lucide-react';
import { useRepeat } from '@/lib/store/repeat-store';
import { cn } from '@/lib/utils';

/**
 * The glowing three-stage rail across the top of the workspace.
 *
 * It tracks the real workflow: each stage lights when the corresponding app
 * has contributed an action to the current trace or run, and the connectors
 * animate as the work moves between applications.
 */

const STAGES = [
  { key: 'mail', n: 1, label: 'READ EMAIL', icon: Mail, accent: '#38dcff' },
  { key: 'tracker', n: 2, label: 'CREATE TICKET', icon: GitPullRequestArrow, accent: '#8b7cff' },
  { key: 'chat', n: 3, label: 'NOTIFY TEAM', icon: Hash, accent: '#2dd4a7' },
] as const;

export function WorkflowRail() {
  const activeTrace = useRepeat((s) => s.activeTrace);
  const activeRun = useRepeat((s) => s.activeRun);
  const phase = useRepeat((s) => s.phase);
  const runningIndex = useRepeat((s) => s.runningIndex);

  // Which apps have been touched, and which is currently in play.
  const touched = new Set<string>();
  let current: string | null = null;

  if (phase === 'executing' && activeRun) {
    activeRun.proposedActions.forEach((a, i) => {
      if (a.status === 'succeeded') touched.add(a.app);
      if (i === runningIndex && a.status === 'running') current = a.app;
    });
  } else if (phase === 'completed' && activeRun) {
    activeRun.proposedActions.forEach((a) => {
      if (a.status === 'succeeded') touched.add(a.app);
    });
  } else if (activeTrace) {
    activeTrace.events.forEach((e) => touched.add(e.sourceApp));
    current = activeTrace.events[activeTrace.events.length - 1]?.sourceApp ?? null;
  }

  return (
    <div className="flex h-16 shrink-0 items-center px-4">
      <div className="flex w-full items-center">
        {STAGES.map((stage, i) => {
          const done = touched.has(stage.key);
          const isCurrent = current === stage.key;
          const lit = done || isCurrent;
          const nextDone = i < STAGES.length - 1 && touched.has(STAGES[i + 1].key);

          return (
            <div key={stage.key} className="flex min-w-0 flex-1 items-center">
              <motion.div
                animate={{
                  borderColor: lit ? `${stage.accent}66` : 'rgba(255,255,255,0.075)',
                  boxShadow: isCurrent
                    ? `0 0 26px -6px ${stage.accent}80`
                    : done
                      ? `0 0 16px -8px ${stage.accent}60`
                      : '0 0 0 0 rgba(0,0,0,0)',
                }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex min-w-0 items-center gap-2.5 rounded-full border bg-ink-850/80 px-3.5 py-1.5 backdrop-blur-md"
              >
                <motion.span
                  className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-3xs font-bold"
                  animate={{
                    background: lit ? stage.accent : 'rgba(255,255,255,0.07)',
                    color: lit ? '#04060a' : '#566a84',
                  }}
                  transition={{ duration: 0.35 }}
                >
                  {done && !isCurrent ? <Check className="h-3 w-3" strokeWidth={3} /> : stage.n}
                  {isCurrent ? (
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      style={{ border: `1px solid ${stage.accent}` }}
                      animate={{ scale: [1, 1.7], opacity: [0.7, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                    />
                  ) : null}
                </motion.span>

                <stage.icon
                  className="h-3.5 w-3.5 shrink-0 transition-colors duration-300"
                  style={{ color: lit ? stage.accent : '#3e4f66' }}
                />
                <span
                  className="truncate text-2xs font-semibold uppercase tracking-[0.14em] transition-colors duration-300"
                  style={{ color: lit ? '#e6edf6' : '#566a84' }}
                >
                  {stage.label}
                </span>
              </motion.div>

              {i < STAGES.length - 1 ? (
                <div className="relative mx-1 h-px min-w-[18px] flex-1">
                  <div className="absolute inset-0 bg-edge-faint" />
                  <motion.div
                    className="absolute inset-y-0 left-0 origin-left"
                    style={{
                      background: `linear-gradient(90deg, ${stage.accent}, ${STAGES[i + 1].accent})`,
                      boxShadow: `0 0 8px 0 ${stage.accent}80`,
                    }}
                    initial={false}
                    animate={{ scaleX: nextDone || done ? 1 : 0, opacity: nextDone || done ? 1 : 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  />
                  {/* travelling pulse while work is moving between apps */}
                  {done && !nextDone ? (
                    <motion.span
                      className="absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full"
                      style={{ background: STAGES[i + 1].accent }}
                      animate={{ left: ['0%', '100%'], opacity: [0, 1, 0] }}
                      transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Compact inline variant used on the workflow detail page. */
export function RailMini({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 rounded-full border border-edge-faint px-2 py-0.5 text-3xs uppercase tracking-[0.12em]"
            style={{ color: s.accent }}
          >
            <s.icon className="h-2.5 w-2.5" />
            {s.label}
          </span>
          {i < STAGES.length - 1 ? <span className="h-px w-3 bg-edge-soft" /> : null}
        </div>
      ))}
    </div>
  );
}
