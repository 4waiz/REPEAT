'use client';

import * as React from 'react';
import { Activity, Ghost, Network } from 'lucide-react';
import { useRepeat, selectActivePattern } from '@/lib/store/repeat-store';
import { TopBar } from '@/components/repeat/TopBar';
import { WorkflowRail } from '@/components/repeat/WorkflowRail';
import { RepeatDock } from '@/components/repeat/RepeatDock';
import { DemoConsole } from '@/components/repeat/DemoConsole';
import { CommandPalette } from '@/components/repeat/CommandPalette';
import { MailWindow } from '@/components/workspace/MailWindow';
import { TrackerWindow } from '@/components/workspace/TrackerWindow';
import { ChatWindow } from '@/components/workspace/ChatWindow';
import { ActionPanel } from '@/components/workflows/ActionPanel';
import { GhostRunCompact } from '@/components/ghost-run/GhostRunPanel';
import { MemoryMapCompact } from '@/components/memory-map/MemoryMapCompact';
import { LiveTimeline } from '@/components/timeline/LiveTimeline';
import { Panel, PanelHeader, Badge, Dot } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * The active workspace.
 *
 * Three replica applications side by side, one animated workflow rail above
 * them, the phase-driven Action Panel in the middle, and the three inspection
 * surfaces below. This is the screen the whole demo happens on.
 */
export default function WorkspacePage() {
  const init = useRepeat((s) => s.init);
  const ready = useRepeat((s) => s.ready);
  const phase = useRepeat((s) => s.phase);
  const activeRun = useRepeat((s) => s.activeRun);
  const runningIndex = useRepeat((s) => s.runningIndex);
  const pattern = useRepeat(selectActivePattern);
  const openGhostRun = useRepeat((s) => s.openGhostRun);
  const approveAndExecute = useRepeat((s) => s.approveAndExecute);

  const [paletteOpen, setPaletteOpen] = React.useState(false);

  // Phases where REPEAT, not the workspace, is the thing to look at.
  const agentOnStage = ['ghost_run', 'executing', 'completed', 'error'].includes(phase);

  // Seed timestamps on the client only, so hydration stays deterministic.
  React.useEffect(() => {
    init();
  }, [init]);

  // Development-only handle so the engine can be driven and asserted against
  // from the browser console or an end-to-end script. Never shipped.
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    (window as unknown as { __REPEAT__?: unknown }).__REPEAT__ = useRepeat;
  }, []);

  // Keyboard shortcuts: K palette, G ghost run, R reset focus to mail.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key.toLowerCase() === 'g' && ['trigger_detected', 'ghost_run'].includes(phase)) {
        e.preventDefault();
        openGhostRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, openGhostRun]);

  if (!ready) {
    // Matches the shell so there is no layout jump on mount.
    return <div className="min-h-screen" aria-hidden />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar onOpenPalette={() => setPaletteOpen(true)} />
      <WorkflowRail />

      {/* Replica applications.
          Once the agent takes over, the workspace recedes: the app row gives
          up height so the Ghost Run — and crucially its Execute control —
          stay above the fold without the presenter scrolling. */}
      <div
        className={cn(
          'grid min-h-0 shrink-0 grid-cols-1 gap-3 px-4 transition-[height] duration-500 ease-swift lg:grid-cols-3',
          agentOnStage
            ? 'lg:[height:clamp(168px,19vh,214px)]'
            : 'lg:[height:clamp(292px,33vh,388px)]',
        )}
      >
        <MailWindow />
        <TrackerWindow />
        <ChatWindow />
      </div>

      {/* the narrative spine */}
      <ActionPanel />

      {/* Inspection surfaces.
          Deliberately a fixed slice of the viewport rather than flex-1: with
          flex-1 the row grows with its own scrollable content and the whole
          page starts scrolling (measured 2223px tall at 1080p). The clamp
          keeps the workspace to exactly one screen at 768p and 1080p alike. */}
      <div className="grid min-h-0 shrink-0 grid-cols-1 gap-3 px-4 pb-16 md:grid-cols-2 xl:grid-cols-[1.05fr_1fr_1.05fr] xl:[height:clamp(208px,25vh,268px)]">
        <Panel className="flex min-h-[208px] flex-col overflow-hidden">
          <PanelHeader
            title="Memory map"
            icon={<Network />}
            right={
              pattern ? (
                <Badge tone={pattern.status === 'active' ? 'teal' : 'cyan'}>
                  <Dot tone={pattern.status === 'active' ? 'teal' : 'cyan'} pulse />
                  {pattern.status}
                </Badge>
              ) : (
                <Badge tone="neutral">empty</Badge>
              )
            }
          />
          <MemoryMapCompact pattern={pattern} />
        </Panel>

        <Panel className="flex min-h-[208px] flex-col overflow-hidden">
          <PanelHeader
            title="Live timeline"
            icon={<Activity />}
            right={
              <span className="flex items-center gap-2.5 text-3xs uppercase tracking-[0.1em] text-mist-600">
                <span className="flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-teal-400" />
                  observed
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-cyan-400" />
                  by repeat
                </span>
              </span>
            }
          />
          <LiveTimeline />
        </Panel>

        <Panel
          className={`flex min-h-[208px] flex-col overflow-hidden ${
            activeRun && phase !== 'completed' ? 'border-iris-400/25' : ''
          }`}
        >
          <PanelHeader
            title="Ghost run"
            icon={<Ghost />}
            right={
              activeRun ? (
                <Badge tone={phase === 'executing' ? 'cyan' : phase === 'completed' ? 'teal' : 'iris'}>
                  {phase === 'executing'
                    ? 'executing'
                    : phase === 'completed'
                      ? 'complete'
                      : 'safe to run'}
                </Badge>
              ) : (
                <Badge tone="neutral">idle</Badge>
              )
            }
          />
          <GhostRunCompact
            run={activeRun}
            executing={phase === 'executing'}
            runningIndex={runningIndex}
            onOpen={openGhostRun}
            onExecute={() => void approveAndExecute()}
            finished={phase === 'completed' || phase === 'error'}
          />
        </Panel>
      </div>

      <RepeatDock />
      <DemoConsole />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
