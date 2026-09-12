'use client';

import Link from 'next/link';
import { Bot, Eye, ScanSearch } from 'lucide-react';
import { useRepeat } from '@/lib/store/repeat-store';
import { PageShell } from '@/components/repeat/PageShell';
import { Badge, Dot, Panel } from '@/components/ui/primitives';
import { formatDuration, formatPercent } from '@/lib/utils';

/**
 * Learned workflows.
 *
 * In this prototype there is one, by design — the README is explicit that the
 * Behavior-to-Agent loop is demonstrated through a single constrained but
 * fully working workflow rather than twenty shallow ones.
 */
export default function WorkflowsPage() {
  const patterns = useRepeat((s) => s.patterns);
  const runs = useRepeat((s) => s.runs);
  const traces = useRepeat((s) => s.traces);

  return (
    <PageShell
      title="Workflows"
      description="Agents REPEAT compiled from behaviour it watched. Each one carries the evidence it was learned from, and none of them can act without your approval."
    >
      {patterns.length === 0 ? (
        <Panel className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <ScanSearch className="h-6 w-6 text-mist-600" />
          <div className="text-sm text-mist-200">Nothing learned yet</div>
          <p className="max-w-md text-xs leading-relaxed text-mist-500">
            {traces.length === 0
              ? 'REPEAT is watching but has not seen a workflow twice. Triage a support report in the workspace, then do it once more.'
              : `${traces.length} workflow observed. One more similar pass and REPEAT can generalise it into an agent.`}
          </p>
          <Link
            href="/workspace"
            className="mt-1 inline-flex h-8 items-center rounded-lg bg-cyan-400 px-3.5 text-xs font-semibold text-ink-950 transition hover:bg-cyan-300"
          >
            Open workspace
          </Link>
        </Panel>
      ) : (
        <div className="space-y-3">
          {patterns.map((p) => {
            const patternRuns = runs.filter((r) => r.patternId === p.id);
            const successful = patternRuns.filter((r) => r.status === 'completed').length;
            const saved = patternRuns.reduce((s, r) => s + r.timeSavedSeconds, 0);

            return (
              <Link key={p.id} href={`/workflows/${p.id}`} className="block">
                <Panel className="group px-5 py-4 transition-colors hover:border-edge">
                  <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-teal-400/30 bg-teal-400/10">
                        <Bot className="h-4 w-4 text-teal-300" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-semibold text-mist-50">{p.name} Agent</h2>
                          <Badge tone={p.status === 'active' ? 'teal' : 'cyan'}>
                            <Dot tone={p.status === 'active' ? 'teal' : 'cyan'} pulse />
                            {p.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-mist-500">{p.trigger.description}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
                      <Cell label="Steps" value={String(p.steps.length)} />
                      <Cell label="Learned from" value={`${p.observations} observations`} />
                      <Cell label="Confidence" value={formatPercent(p.confidence)} tone="teal" />
                      <Cell label="Runs" value={String(patternRuns.length)} />
                      <Cell
                        label="Success"
                        value={
                          patternRuns.length
                            ? `${Math.round((successful / patternRuns.length) * 100)}%`
                            : '—'
                        }
                      />
                      <Cell label="Time saved" value={saved ? formatDuration(saved) : '—'} tone="teal" />
                    </div>

                    <span className="ml-auto flex items-center gap-1.5 text-xs text-mist-600 transition-colors group-hover:text-mist-300">
                      <Eye className="h-3.5 w-3.5" />
                      Inspect
                    </span>
                  </div>
                </Panel>
              </Link>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: 'teal' }) {
  return (
    <div>
      <div className="text-3xs uppercase tracking-[0.12em] text-mist-600">{label}</div>
      <div
        className={`mt-0.5 font-mono text-sm tabular-nums ${
          tone === 'teal' ? 'text-teal-300' : 'text-mist-100'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
