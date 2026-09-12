'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useRepeat, selectObservedCount, OBSERVABLE_SEQUENCE } from '@/lib/store/repeat-store';
import { Orb } from './Orb';
import { ConfidenceBar } from '@/components/ui/primitives';
import { formatPercent } from '@/lib/utils';

/**
 * The floating REPEAT presence.
 *
 * Unobtrusive by design: during learning it says what it is doing and how far
 * through the workflow it is, and nothing else. It never asks the user to
 * stop and explain anything.
 */

const STATUS: Record<string, { text: string; sub?: string }> = {
  idle: { text: 'Watching' },
  observing: { text: 'Learning your work' },
  comparing: { text: 'Comparing with what I have seen' },
  pattern_discovered: { text: 'Pattern discovered' },
  agent_ready: { text: 'Bug Triage Agent ready' },
  trigger_detected: { text: 'Trigger detected' },
  ghost_run: { text: 'Ghost Run ready' },
  executing: { text: 'Running workflow' },
  completed: { text: 'Workflow complete' },
  error: { text: 'Needs your attention' },
};

export function RepeatDock() {
  const phase = useRepeat((s) => s.phase);
  const orb = useRepeat((s) => s.orb);
  const observed = useRepeat(selectObservedCount);
  const confidence = useRepeat((s) => s.confidencePeak);
  const traces = useRepeat((s) => s.traces);
  const paused = useRepeat((s) => s.settings.observationPaused);

  const status = STATUS[phase] ?? STATUS.idle;
  const total = OBSERVABLE_SEQUENCE.length;
  const showSteps = phase === 'observing' && observed > 0;
  const showConfidence =
    (phase === 'observing' || phase === 'comparing') && traces.length > 0 && confidence > 0;

  return (
    // Centring lives on this wrapper, not on the animated element: Framer
    // writes an inline `transform`, which would silently drop a Tailwind
    // -translate-x-1/2 and leave the dock hanging off to the right.
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-auto flex items-center gap-3 rounded-full border border-edge-soft bg-ink-850/85 py-2 pl-2.5 pr-4 shadow-lift backdrop-blur-xl"
      >
        <Orb state={paused ? 'idle' : orb} size={30} />

        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-3xs font-semibold uppercase tracking-[0.2em] text-mist-500">
              REPEAT
            </span>
            <motion.span
              key={status.text}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="truncate text-xs text-mist-100"
            >
              {paused ? 'Observation paused' : status.text}
            </motion.span>
          </div>

          <AnimatePresence mode="wait">
            {showSteps ? (
              <motion.div
                key="steps"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex gap-[2px]">
                    {Array.from({ length: total }).map((_, i) => (
                      <motion.span
                        key={i}
                        animate={{
                          opacity: i < observed ? 1 : 0.2,
                          scaleY: i < observed ? 1 : 0.55,
                        }}
                        transition={{ duration: 0.24 }}
                        className="h-2 w-[3px] rounded-full bg-cyan-400"
                      />
                    ))}
                  </div>
                  <span className="font-mono text-3xs tabular-nums text-mist-500">
                    step {observed} of {total}
                  </span>
                </div>
              </motion.div>
            ) : showConfidence ? (
              <motion.div
                key="conf"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-3xs uppercase tracking-[0.12em] text-mist-600">
                    pattern confidence
                  </span>
                  <ConfidenceBar value={confidence} showBlocks className="scale-[0.85] origin-left" />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {phase === 'idle' && traces.length > 0 ? (
          <span className="shrink-0 border-l border-edge-faint pl-3 font-mono text-3xs text-mist-600">
            {traces.length} observed · {formatPercent(confidence)}
          </span>
        ) : null}
      </motion.div>
    </div>
  );
}
