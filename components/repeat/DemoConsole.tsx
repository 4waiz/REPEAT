'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Terminal, X } from 'lucide-react';
import { useRepeat } from '@/lib/store/repeat-store';
import type { FailurePoint } from '@/lib/adapters/demo';
import { Badge, Button, Kbd } from '@/components/ui/primitives';
import { DEMO_MODE } from '@/lib/demo/config';
import { cn } from '@/lib/utils';

/**
 * Demo console.
 *
 * A presenter's safety net, not a feature. Hidden behind a chord so judges
 * never see a row of buttons that make the product look staged, but reachable
 * instantly if the live click-through goes sideways.
 *
 *   Ctrl/Cmd + Shift + D
 */
export function DemoConsole() {
  const [open, setOpen] = React.useState(false);

  const phase = useRepeat((s) => s.phase);
  const traces = useRepeat((s) => s.traces);
  const patterns = useRepeat((s) => s.patterns);
  const failAt = useRepeat((s) => s.failAt);
  const settings = useRepeat((s) => s.settings);

  const reset = useRepeat((s) => s.reset);
  const runObservationInstantly = useRepeat((s) => s.runObservationInstantly);
  const approvePattern = useRepeat((s) => s.approvePattern);
  const deliverBug = useRepeat((s) => s.deliverBug);
  const openGhostRun = useRepeat((s) => s.openGhostRun);
  const approveAndExecute = useRepeat((s) => s.approveAndExecute);
  const setFailAt = useRepeat((s) => s.setFailAt);
  const setSetting = useRepeat((s) => s.setSetting);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const steps: { label: string; hint: string; run: () => void; ready: boolean }[] = [
    {
      label: 'Reset demo',
      hint: 'Back to the opening state',
      run: reset,
      ready: true,
    },
    {
      label: 'Run observation 1',
      hint: 'Bug #1 · authentication · Umar',
      run: () => runObservationInstantly(0),
      ready: traces.length === 0,
    },
    {
      label: 'Run observation 2',
      hint: 'Bug #2 · API timeout · Umar',
      run: () => runObservationInstantly(1),
      ready: traces.length === 1,
    },
    {
      label: 'Approve pattern',
      hint: 'Collapse into the Bug Triage Agent',
      run: approvePattern,
      ready: phase === 'pattern_discovered',
    },
    {
      label: 'Send third bug',
      hint: 'Bug #3 · frontend · should reroute to Noor',
      run: () => deliverBug(2),
      ready: phase === 'agent_ready',
    },
    {
      label: 'Open Ghost Run',
      hint: 'Skip the trigger delay',
      run: openGhostRun,
      ready: phase === 'trigger_detected',
    },
    {
      label: 'Execute workflow',
      hint: 'Approve and run',
      run: () => void approveAndExecute(),
      ready: phase === 'ghost_run',
    },
    {
      label: 'Send ambiguous report',
      hint: 'Bug #4 · no clear area · should stop for review',
      run: () => deliverBug(3),
      // Off-script: an escape hatch for showing the review path, not a step.
      ready: false,
    },
  ];

  const failures: { value: FailurePoint; label: string }[] = [
    { value: 'none', label: 'No failure' },
    { value: 'create_issue', label: 'Fail: create issue' },
    { value: 'assign_owner', label: 'Fail: assign owner' },
    { value: 'notify_team', label: 'Fail: notify team' },
  ];

  return (
    <>
      {/* Discreet affordance: a single dim glyph in the corner. */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-3 left-3 z-40 flex h-6 w-6 items-center justify-center rounded-md text-mist-700 transition-colors hover:bg-white/[0.05] hover:text-mist-400"
        title="Demo console (Ctrl/Cmd + Shift + D)"
        aria-label="Open demo console"
      >
        <Terminal className="h-3.5 w-3.5" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-3 left-3 z-50 w-[19.5rem] overflow-hidden rounded-panel border border-edge bg-ink-850/95 shadow-lift backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-edge-faint px-3 py-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-mist-500" />
                <span className="eyebrow">Demo console</span>
                <Badge tone={DEMO_MODE ? 'teal' : 'amber'}>
                  {DEMO_MODE ? 'demo mode' : 'live adapters'}
                </Badge>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-mist-600 transition hover:text-mist-200"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2.5">
              <div className="mb-1.5 px-0.5 text-3xs uppercase tracking-[0.12em] text-mist-600">
                Script
              </div>
              <div className="space-y-1">
                {steps.map((step, i) => (
                  <button
                    key={step.label}
                    onClick={step.run}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md border px-2 py-1.5 text-left transition-colors',
                      step.ready
                        ? 'border-cyan-400/30 bg-cyan-400/[0.07] hover:bg-cyan-400/[0.12]'
                        : 'border-edge-faint hover:border-edge hover:bg-white/[0.03]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded font-mono text-3xs',
                        step.ready ? 'bg-cyan-400 text-ink-950' : 'bg-white/[0.07] text-mist-500',
                      )}
                    >
                      {i}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs text-mist-100">{step.label}</span>
                      <span className="block truncate text-3xs text-mist-600">{step.hint}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="mb-1.5 mt-3 px-0.5 text-3xs uppercase tracking-[0.12em] text-mist-600">
                Error injection
              </div>
              <div className="flex flex-wrap gap-1">
                {failures.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFailAt(f.value)}
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-2xs transition-colors',
                      failAt === f.value
                        ? 'border-amber-400/40 bg-amber-400/12 text-amber-200'
                        : 'border-edge-faint text-mist-500 hover:border-edge hover:text-mist-300',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="mb-1.5 mt-3 px-0.5 text-3xs uppercase tracking-[0.12em] text-mist-600">
                Presentation
              </div>
              <div className="flex flex-wrap gap-1">
                <Toggle
                  on={settings.guideOn}
                  label="Guide rings"
                  onClick={() => setSetting('guideOn', !settings.guideOn)}
                />
                <Toggle
                  on={settings.soundOn}
                  label="Sound"
                  onClick={() => setSetting('soundOn', !settings.soundOn)}
                />
                <Toggle
                  on={settings.observationPaused}
                  label="Pause observing"
                  onClick={() => setSetting('observationPaused', !settings.observationPaused)}
                />
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-edge-faint pt-2.5">
                <span className="font-mono text-3xs text-mist-600">
                  {traces.length} traces · {patterns.length} patterns · {phase}
                </span>
                <Button variant="ghost" size="sm" onClick={reset}>
                  Reset
                </Button>
              </div>

              <p className="mt-2 text-3xs leading-relaxed text-mist-700">
                Toggle with <Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + <Kbd>Shift</Kbd> + <Kbd>D</Kbd>. Every
                control here drives the same engine the manual click-through does.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-2xs transition-colors',
        on
          ? 'border-cyan-400/35 bg-cyan-400/10 text-cyan-200'
          : 'border-edge-faint text-mist-500 hover:border-edge hover:text-mist-300',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-cyan-400' : 'bg-mist-600')} />
      {label}
    </button>
  );
}
