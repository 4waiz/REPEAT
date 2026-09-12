'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Check, Circle, Eye, TriangleAlert } from 'lucide-react';
import { useRepeat } from '@/lib/store/repeat-store';
import { EmptyState } from '@/components/ui/primitives';
import { cn, formatClock } from '@/lib/utils';

/**
 * Live Timeline.
 *
 * Distinguishes what REPEAT *watched a human do* from what REPEAT *did
 * itself* — different icons, different colours. That distinction is the whole
 * trust story, so it is never collapsed into one style.
 */
export function LiveTimeline() {
  const timeline = useRepeat((s) => s.timeline);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [timeline.length]);

  if (timeline.length === 0) {
    return <EmptyState icon={<Eye />} title="Nothing observed yet" />;
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
      <ol className="relative">
        {/* the rail */}
        <span className="absolute bottom-1 left-[7px] top-1 w-px bg-edge-faint" />

        <AnimatePresence initial={false}>
          {timeline.map((entry) => {
            const isExecuted = entry.origin === 'executed';
            const isSystem = entry.origin === 'system';
            const failed = entry.status === 'failed';
            const active = entry.status === 'active';

            return (
              <motion.li
                key={entry.id}
                layout
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="relative flex gap-2.5 py-[5px] pl-0"
              >
                <span className="relative z-10 mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-ink-900">
                  {failed ? (
                    <TriangleAlert className="h-3 w-3 text-rose-400" />
                  ) : active ? (
                    <motion.span
                      className="h-2 w-2 rounded-full bg-cyan-400"
                      animate={{ scale: [1, 1.45, 1], opacity: [1, 0.55, 1] }}
                      transition={{ duration: 0.85, repeat: Infinity }}
                    />
                  ) : isExecuted ? (
                    <Bot className="h-3 w-3 text-cyan-300" />
                  ) : isSystem ? (
                    <Circle className="h-2 w-2 fill-mist-600 text-mist-600" />
                  ) : (
                    <Check className="h-2.5 w-2.5 text-teal-400" strokeWidth={3} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 font-mono text-3xs tabular-nums text-mist-600">
                      {formatClock(entry.at)}
                    </span>
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-xs',
                        failed
                          ? 'text-rose-300'
                          : active
                            ? 'text-cyan-200'
                            : isExecuted
                              ? 'text-mist-100'
                              : 'text-mist-200',
                      )}
                    >
                      {entry.label}
                    </span>
                    {isExecuted ? (
                      <span className="shrink-0 rounded border border-cyan-400/25 bg-cyan-400/10 px-1 text-3xs uppercase tracking-[0.1em] text-cyan-300">
                        repeat
                      </span>
                    ) : entry.origin === 'observed' ? (
                      <span className="shrink-0 rounded border border-edge-faint px-1 text-3xs uppercase tracking-[0.1em] text-mist-600">
                        observed
                      </span>
                    ) : null}
                  </div>
                  {entry.detail ? (
                    <div className="mt-0.5 truncate pl-[calc(2.25rem+2px)] text-3xs text-mist-600">
                      {entry.detail}
                    </div>
                  ) : null}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
    </div>
  );
}
