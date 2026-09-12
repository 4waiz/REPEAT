'use client';

import { motion } from 'framer-motion';
import { GitPullRequestArrow, Hash, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The Email -> Ticket -> Chat lockup, animated.
 *
 * Same three-stage shape as the rail above the live workspace, so the landing
 * page and the product read as one thing.
 */

const STAGES = [
  { icon: Mail, label: 'Read email', app: 'Mail' },
  { icon: GitPullRequestArrow, label: 'Create ticket', app: 'Issue tracker' },
  { icon: Hash, label: 'Notify team', app: 'Team chat' },
];

export function HeroFlow({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center justify-between gap-2 sm:gap-5">
        {STAGES.map((stage, i) => (
          <div key={stage.label} className="flex flex-1 items-center gap-2 sm:gap-5">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.55, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex min-w-0 flex-1 items-center gap-3 rounded-window border border-edge-soft bg-ink-850/70 px-3.5 py-3 shadow-panel backdrop-blur-md"
            >
              <motion.span
                className="absolute inset-0 rounded-window"
                animate={{
                  boxShadow: [
                    '0 0 0 0 rgba(56,220,255,0)',
                    '0 0 24px -6px rgba(56,220,255,0.4)',
                    '0 0 0 0 rgba(56,220,255,0)',
                  ],
                }}
                transition={{
                  duration: 1.65,
                  repeat: Infinity,
                  repeatDelay: 1.65 * (STAGES.length - 1),
                  delay: i * 1.65,
                  ease: 'easeInOut',
                }}
              />
              <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-edge-soft bg-white/[0.04] text-cyan-300">
                <stage.icon className="h-3.5 w-3.5" />
              </span>
              <span className="relative min-w-0">
                <span className="block truncate text-xs font-medium text-mist-100">
                  {stage.label}
                </span>
                <span className="block truncate text-2xs uppercase tracking-[0.12em] text-mist-600">
                  {stage.app}
                </span>
              </span>
            </motion.div>

            {i < STAGES.length - 1 ? (
              <svg
                className="hidden h-px w-8 shrink-0 overflow-visible sm:block"
                viewBox="0 0 32 1"
                preserveAspectRatio="none"
              >
                <line x1="0" y1="0.5" x2="32" y2="0.5" stroke="rgba(255,255,255,0.12)" />
                <motion.line
                  x1="0"
                  y1="0.5"
                  x2="32"
                  y2="0.5"
                  stroke="rgba(56,220,255,0.9)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray="10 32"
                  animate={{ strokeDashoffset: [42, 0] }}
                  transition={{
                    duration: 1.65,
                    repeat: Infinity,
                    repeatDelay: 1.65 * (STAGES.length - 1),
                    delay: 0.5 + i * 1.65,
                    ease: 'easeInOut',
                  }}
                />
              </svg>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
