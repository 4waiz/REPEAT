'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowUpRight,
  Check,
  GitPullRequestArrow,
  Hash,
  Mail,
  ScanSearch,
  UserCheck,
} from 'lucide-react';
import type { LearnedPattern, PlannedActionStatus } from '@/types';
import { STEP_META } from '@/lib/events/taxonomy';
import { useRepeat } from '@/lib/store/repeat-store';
import { EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * Memory Map — rail size.
 *
 * A five-node graph cannot be read inside a 250x170 panel, so the rail gets a
 * purpose-built vertical stepper instead of a zoomed-out canvas. The full
 * pannable graph lives on the workflow detail page, where it has room.
 */

const ICONS = {
  read: Mail,
  understand: ScanSearch,
  create: GitPullRequestArrow,
  assign: UserCheck,
  notify: Hash,
} as const;

export function MemoryMapCompact({ pattern }: { pattern: LearnedPattern | null }) {
  const activeRun = useRepeat((s) => s.activeRun);
  const phase = useRepeat((s) => s.phase);

  if (!pattern) {
    return (
      <EmptyState
        icon={<ScanSearch />}
        title="No workflow learned yet"
        detail="Once REPEAT recognises a repeated workflow, its compiled shape appears here."
      />
    );
  }

  // Roll live action status up onto the compiled steps.
  const statusByStep = new Map<string, PlannedActionStatus>();
  if (activeRun && ['executing', 'completed', 'error'].includes(phase)) {
    const rank: Record<string, number> = {
      planned: 0,
      skipped: 1,
      succeeded: 2,
      running: 3,
      needs_review: 4,
      failed: 5,
    };
    for (const a of activeRun.proposedActions) {
      const prev = statusByStep.get(a.stepId);
      if (!prev || rank[a.status] > rank[prev]) statusByStep.set(a.stepId, a.status);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-1">
        <ol className="relative">
          <span className="absolute bottom-3 left-[11px] top-3 w-px bg-edge-faint" />
          {pattern.steps.map((step, i) => {
            const key = step.id.replace('step_', '') as keyof typeof ICONS;
            const Icon = ICONS[key] ?? ScanSearch;
            const status = statusByStep.get(step.id);
            const done = status === 'succeeded';
            const running = status === 'running';
            const failed = status === 'failed';

            return (
              <li key={step.id} className="relative flex items-center gap-2.5 py-[5px]">
                <span
                  className={cn(
                    'relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border transition-colors duration-300',
                    running
                      ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-300'
                      : done
                        ? 'border-teal-400/40 bg-teal-400/12 text-teal-300'
                        : failed
                          ? 'border-rose-400/45 bg-rose-400/12 text-rose-300'
                          : 'border-edge-soft bg-ink-800 text-mist-400',
                  )}
                >
                  {done ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </motion.span>
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                  {running ? (
                    <motion.span
                      className="absolute inset-0 rounded-md border border-cyan-400"
                      animate={{ scale: [1, 1.5], opacity: [0.7, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                    />
                  ) : null}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-xs leading-tight transition-colors duration-300',
                      running ? 'text-cyan-200' : done ? 'text-teal-200' : 'text-mist-200',
                    )}
                  >
                    {STEP_META[key].title}
                  </span>
                  <span className="block truncate text-3xs uppercase tracking-[0.1em] text-mist-600">
                    {STEP_META[key].source}
                  </span>
                </span>

                {i === 0 ? (
                  <span className="shrink-0 rounded border border-edge-faint px-1 py-px text-3xs uppercase tracking-[0.1em] text-mist-600">
                    trigger
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      <Link
        href={`/workflows/${pattern.id}`}
        className="flex shrink-0 items-center justify-between border-t border-edge-faint px-3.5 py-2 text-3xs text-mist-500 transition-colors hover:text-mist-200"
      >
        <span>
          {pattern.variables.length} variables · {pattern.evidence.constantFields.length} constant
        </span>
        <span className="flex items-center gap-1">
          Open full map
          <ArrowUpRight className="h-3 w-3" />
        </span>
      </Link>
    </div>
  );
}
