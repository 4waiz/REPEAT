'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Ghost, Network, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';
import { useRepeat } from '@/lib/store/repeat-store';
import { PageShell } from '@/components/repeat/PageShell';
import { MemoryMap } from '@/components/memory-map/MemoryMap';
import { EvidencePanel } from '@/components/workflows/pattern';
import { RailMini } from '@/components/repeat/WorkflowRail';
import { Badge, Button, Dot, Panel, PanelHeader, Stat } from '@/components/ui/primitives';
import { ROUTING_RULE_LIST } from '@/lib/demo/team';
import { formatDuration, formatPercent } from '@/lib/utils';

/**
 * Workflow detail.
 *
 * Everything REPEAT knows about one learned agent, including the full
 * pannable memory map that does not fit in the workspace rail.
 */
export default function WorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const patterns = useRepeat((s) => s.patterns);
  const runs = useRepeat((s) => s.runs);
  const deliverNextBug = useRepeat((s) => s.deliverNextBug);
  const forgetPattern = useRepeat((s) => s.forgetPattern);
  const setPatternStatus = useRepeat((s) => s.setPatternStatus);

  const pattern = patterns.find((p) => p.id === params.id) ?? patterns[0] ?? null;

  if (!pattern) {
    return (
      <PageShell
        title="Workflow not found"
        description="This agent no longer exists — it may have been forgotten, or the demo was reset."
        back={{ href: '/workflows', label: 'All workflows' }}
      >
        <Panel className="px-5 py-10 text-center text-sm text-mist-400">
          Nothing to show here.
        </Panel>
      </PageShell>
    );
  }

  const patternRuns = runs.filter((r) => r.patternId === pattern.id);
  const successful = patternRuns.filter((r) => r.status === 'completed').length;
  const savedTotal = patternRuns.reduce((s, r) => s + r.timeSavedSeconds, 0);
  const interventions = patternRuns.reduce((s, r) => s + r.humanInterventions, 0);
  const paused = pattern.status === 'paused';

  return (
    <PageShell
      title={`${pattern.name} Agent`}
      description={pattern.trigger.description}
      back={{ href: '/workflows', label: 'All workflows' }}
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPatternStatus(pattern.id, paused ? 'active' : 'paused')}
          >
            {paused ? <PlayCircle className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              forgetPattern(pattern.id);
              router.push('/workflows');
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Forget
          </Button>
          <Button
            variant="iris"
            size="sm"
            onClick={() => {
              deliverNextBug();
              router.push('/workspace');
            }}
          >
            <Ghost className="h-3.5 w-3.5" />
            Run Ghost
          </Button>
        </>
      }
    >
      {/* headline metrics */}
      <Panel className="mb-3 px-5 py-4">
        <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
          <div>
            <div className="eyebrow mb-1.5">Status</div>
            <Badge tone={paused ? 'amber' : 'teal'}>
              <Dot tone={paused ? 'amber' : 'teal'} pulse={!paused} />
              {pattern.status}
            </Badge>
          </div>
          <Stat label="Learned from" value={`${pattern.observations}`} sub="observations" />
          <Stat label="Runs" value={String(patternRuns.length)} />
          <Stat
            label="Success"
            value={patternRuns.length ? `${Math.round((successful / patternRuns.length) * 100)}%` : '—'}
            tone="teal"
          />
          <Stat
            label="Time saved"
            value={savedTotal ? formatDuration(savedTotal) : '—'}
            tone="teal"
            sub={`${formatDuration(pattern.manualDurationSeconds)} manual baseline`}
          />
          <Stat label="Human interventions" value={String(interventions)} />
          <Stat label="Confidence" value={formatPercent(pattern.confidence)} tone="teal" />
          <div className="ml-auto">
            <div className="eyebrow mb-2">Human approval</div>
            <Badge tone="amber">Required before every run</Badge>
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-[1.25fr_1fr]">
        {/* memory map */}
        <Panel className="flex h-[420px] flex-col overflow-hidden">
          <PanelHeader
            title="Memory map"
            icon={<Network />}
            right={<RailMini className="hidden md:flex" />}
          />
          <MemoryMap pattern={pattern} />
        </Panel>

        {/* trigger + variables */}
        <div className="space-y-3">
          <Panel className="px-5 py-4">
            <div className="eyebrow mb-2.5">Trigger</div>
            <p className="text-[0.8125rem] text-mist-100">{pattern.trigger.description}</p>
            <ul className="mt-2.5 space-y-1">
              {pattern.trigger.conditions.map((c) => (
                <li key={c} className="flex items-start gap-2 text-xs text-mist-500">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-mist-600" />
                  {c}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="px-5 py-4">
            <div className="eyebrow mb-2.5">Variables</div>
            <div className="space-y-2">
              {pattern.variables.map((v) => (
                <div key={v.name} className="grid grid-cols-[8.5rem_1fr] items-start gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-xs text-mist-100">{v.label}</div>
                    <div className="truncate text-3xs uppercase tracking-[0.1em] text-mist-600">
                      {v.derivation}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-3xs leading-relaxed text-mist-500">{v.description}</p>
                    {v.derivedFrom ? (
                      <span className="mt-1 inline-block rounded border border-edge-soft bg-white/[0.04] px-1.5 py-px font-mono text-3xs text-mist-300">
                        {v.derivedFrom}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {pattern.evidence.constantFields.length > 0 ? (
              <div className="mt-3 border-t border-edge-faint pt-3">
                <div className="eyebrow mb-1.5">Constant</div>
                <p className="text-3xs leading-relaxed text-mist-500">
                  {pattern.evidence.constantFields.join(', ')} — chosen by you, not implied by any
                  report, and identical in every observation.
                </p>
              </div>
            ) : null}
          </Panel>

          <Panel className="px-5 py-4">
            <div className="eyebrow mb-2.5">Routing rules</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {ROUTING_RULE_LIST.map((r) => (
                <div key={r.area} className="flex items-baseline gap-2 text-xs">
                  <span className="text-mist-500">{r.area}</span>
                  <span className="text-mist-700">→</span>
                  <span className="text-mist-100">{r.owner}</span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-3xs leading-relaxed text-mist-600">
              Ownership is re-resolved from these rules on every run, which is why a report from an
              area REPEAT never observed still reaches the right person.
            </p>
          </Panel>
        </div>
      </div>

      {/* evidence */}
      <Panel className="mt-3 overflow-hidden">
        <PanelHeader title="Why REPEAT thought this was a pattern" />
        <EvidencePanel pattern={pattern} />
      </Panel>
    </PageShell>
  );
}
