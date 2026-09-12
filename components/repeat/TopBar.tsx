'use client';

import Link from 'next/link';
import { Command, Shield, Volume2, VolumeX, Workflow } from 'lucide-react';
import { useRepeat } from '@/lib/store/repeat-store';
import { RepeatMark } from './Orb';
import { Dot, Kbd } from '@/components/ui/primitives';
import { formatDuration } from '@/lib/utils';
import { DEMO_MODE } from '@/lib/demo/config';

/**
 * Product header.
 *
 * Carries the promise, the WATCH / LEARN / AUTOMATE state, and the two
 * metrics worth glancing at mid-demo.
 */
export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const phase = useRepeat((s) => s.phase);
  const orb = useRepeat((s) => s.orb);
  const metrics = useRepeat((s) => s.metrics);
  const soundOn = useRepeat((s) => s.settings.soundOn);
  const setSetting = useRepeat((s) => s.setSetting);
  const observationPaused = useRepeat((s) => s.settings.observationPaused);

  // WATCH is always on; LEARN lights while observing or comparing; AUTOMATE
  // lights once an agent exists and can act.
  const stages: { label: string; on: boolean }[] = [
    { label: 'WATCH', on: !observationPaused },
    {
      label: 'LEARN',
      on: ['observing', 'comparing', 'pattern_discovered'].includes(phase),
    },
    {
      label: 'AUTOMATE',
      on: ['agent_ready', 'trigger_detected', 'ghost_run', 'executing', 'completed'].includes(
        phase,
      ),
    },
  ];

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-edge-faint px-4">
      <Link href="/" className="shrink-0">
        <RepeatMark state={orb} size="sm" />
      </Link>

      <span className="hidden shrink-0 text-xs text-mist-500 lg:inline">
        Show it once. Never do it again.
      </span>

      <div className="ml-auto flex items-center gap-4">
        {metrics.runs > 0 ? (
          <div className="hidden items-center gap-4 md:flex">
            <div className="text-right">
              <div className="text-3xs uppercase tracking-[0.12em] text-mist-600">Actions saved</div>
              <div className="font-mono text-xs tabular-nums text-teal-300">
                {metrics.manualActionsAvoided}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xs uppercase tracking-[0.12em] text-mist-600">Time saved</div>
              <div className="font-mono text-xs tabular-nums text-teal-300">
                {formatDuration(metrics.timeSavedSeconds)}
              </div>
            </div>
            <span className="h-6 w-px bg-edge-faint" />
          </div>
        ) : null}

        <div className="hidden items-center gap-2.5 sm:flex">
          {stages.map((s) => (
            <span
              key={s.label}
              className="flex items-center gap-1.5 text-3xs font-medium uppercase tracking-[0.16em] transition-colors duration-300"
              style={{ color: s.on ? '#7fe9ff' : '#3e4f66' }}
            >
              <span
                className="h-1 w-1 rounded-full transition-colors duration-300"
                style={{ background: s.on ? '#38dcff' : '#28323f' }}
              />
              {s.label}
            </span>
          ))}
        </div>

        <span className="h-6 w-px bg-edge-faint" />

        <div className="flex items-center gap-1">
          <Link
            href="/workflows"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-mist-400 transition hover:bg-white/[0.05] hover:text-mist-100"
          >
            <Workflow className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Workflows</span>
          </Link>
          <Link
            href="/privacy"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-mist-400 transition hover:bg-white/[0.05] hover:text-mist-100"
          >
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Privacy</span>
          </Link>
          <button
            onClick={() => setSetting('soundOn', !soundOn)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-mist-500 transition hover:bg-white/[0.05] hover:text-mist-200"
            title={soundOn ? 'Sound on' : 'Sound off'}
            aria-label={soundOn ? 'Turn sound off' : 'Turn sound on'}
          >
            {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onOpenPalette}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-edge-faint px-2 text-xs text-mist-500 transition hover:border-edge hover:text-mist-200"
            title="Command palette"
          >
            <Command className="h-3 w-3" />
            <Kbd>K</Kbd>
          </button>
        </div>

        <span className="h-6 w-px bg-edge-faint" />

        <span
          className="flex shrink-0 items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.14em]"
          style={{ color: observationPaused ? '#f5b544' : '#2dd4a7' }}
          title={DEMO_MODE ? 'Demo Mode: deterministic, no external calls' : 'Live adapters enabled'}
        >
          <Dot tone={observationPaused ? 'amber' : 'teal'} pulse={!observationPaused} />
          {observationPaused ? 'Paused' : 'Active'}
        </span>
      </div>
    </header>
  );
}
