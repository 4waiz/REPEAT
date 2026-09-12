'use client';

import { Bot, Check, Eye, Trash2, TriangleAlert } from 'lucide-react';
import { useRepeat } from '@/lib/store/repeat-store';
import { PageShell } from '@/components/repeat/PageShell';
import { specFor } from '@/lib/events/taxonomy';
import { Badge, Button, EmptyState, Panel, PanelHeader, Stat } from '@/components/ui/primitives';
import { cn, formatClock, formatDuration } from '@/lib/utils';

/**
 * Activity history.
 *
 * Two records side by side: what REPEAT watched, and what REPEAT did. Keeping
 * them visibly separate is the point — an observation log that blurs the two
 * would be impossible to audit.
 */
export default function ActivityPage() {
  const traces = useRepeat((s) => s.traces);
  const runs = useRepeat((s) => s.runs);
  const metrics = useRepeat((s) => s.metrics);
  const clearHistory = useRepeat((s) => s.clearHistory);

  const successRate = metrics.runs ? Math.round((metrics.successfulRuns / metrics.runs) * 100) : 0;

  return (
    <PageShell
      title="Activity"
      description="Everything REPEAT has observed and everything it has done, kept apart."
      actions={
        runs.length > 0 || traces.length > 0 ? (
          <Button variant="outline" size="sm" onClick={clearHistory}>
            <Trash2 className="h-3.5 w-3.5" />
            Clear history
          </Button>
        ) : null
      }
    >
      <Panel className="mb-3 px-5 py-4">
        <div className="flex flex-wrap gap-x-10 gap-y-5">
          <Stat label="Workflows observed" value={String(traces.length)} />
          <Stat label="Runs" value={String(metrics.runs)} />
          <Stat label="Success rate" value={metrics.runs ? `${successRate}%` : '—'} tone="teal" />
          <Stat
            label="Manual actions avoided"
            value={String(metrics.manualActionsAvoided)}
            tone="teal"
          />
          <Stat
            label="Estimated time saved"
            value={metrics.timeSavedSeconds ? formatDuration(metrics.timeSavedSeconds) : '—'}
            tone="teal"
            sub="derived from observed action costs"
          />
          <Stat
            label="Human interventions"
            value={String(metrics.humanInterventions)}
            tone={metrics.humanInterventions > 0 ? 'amber' : undefined}
          />
        </div>
        <p className="mt-3 border-t border-edge-faint pt-3 text-3xs leading-relaxed text-mist-600">
          These are this session&apos;s real numbers, counted from the events on this page. Nothing
          here is simulated history.
        </p>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* observed */}
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Observed"
            icon={<Eye />}
            right={<Badge tone="neutral">{traces.length} workflows</Badge>}
          />
          {traces.length === 0 ? (
            <EmptyState title="Nothing observed yet" detail="Triage a report in the workspace." />
          ) : (
            <div className="max-h-[520px] overflow-y-auto px-4 pb-4">
              {traces.map((trace, i) => (
                <div key={trace.id} className="mb-3 last:mb-0">
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span className="text-xs font-medium text-mist-100">Observation {i + 1}</span>
                    <span className="truncate text-3xs text-mist-600">{trace.label}</span>
                    <span className="ml-auto shrink-0 font-mono text-3xs text-mist-600">
                      {formatClock(trace.startedAt)}
                    </span>
                  </div>
                  <ol className="space-y-0.5 border-l border-edge-faint pl-3">
                    {trace.events.map((e) => (
                      <li key={e.id} className="flex items-baseline gap-2 text-3xs">
                        <span className="font-mono tabular-nums text-mist-700">
                          {formatClock(e.timestamp)}
                        </span>
                        <span className={e.inferred ? 'text-mist-500' : 'text-mist-300'}>
                          {specFor(e.action).label}
                        </span>
                        {e.inferred ? (
                          <span className="rounded border border-edge-faint px-1 text-3xs text-mist-600">
                            inferred
                          </span>
                        ) : null}
                        <span className="ml-auto font-mono text-mist-700">{e.action}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* executed */}
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Executed by REPEAT"
            icon={<Bot />}
            right={<Badge tone="cyan">{runs.length} runs</Badge>}
          />
          {runs.length === 0 ? (
            <EmptyState title="REPEAT has not run anything" detail="Every run needs your approval first." />
          ) : (
            <div className="max-h-[520px] overflow-y-auto px-4 pb-4">
              {runs.map((run) => {
                const failed = run.status === 'failed';
                return (
                  <div key={run.id} className="mb-3 last:mb-0">
                    <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
                      <span className="text-xs font-medium text-mist-100">{run.patternName}</span>
                      <Badge tone={failed ? 'rose' : run.status === 'cancelled' ? 'neutral' : 'teal'}>
                        {run.status}
                      </Badge>
                      <span className="truncate text-3xs text-mist-600">{run.triggerSummary}</span>
                      <span className="ml-auto shrink-0 font-mono text-3xs text-mist-600">
                        {formatClock(run.startedAt)}
                      </span>
                    </div>
                    <ol className="space-y-0.5 border-l border-edge-faint pl-3">
                      {run.proposedActions.map((a) => (
                        <li key={a.id} className="flex items-baseline gap-2 text-3xs">
                          {a.status === 'succeeded' ? (
                            <Check className="h-2.5 w-2.5 shrink-0 text-teal-400" strokeWidth={3} />
                          ) : a.status === 'failed' ? (
                            <TriangleAlert className="h-2.5 w-2.5 shrink-0 text-rose-400" />
                          ) : (
                            <span className="h-1 w-1 shrink-0 rounded-full bg-mist-700" />
                          )}
                          <span
                            className={cn(
                              a.status === 'succeeded'
                                ? 'text-mist-300'
                                : a.status === 'failed'
                                  ? 'text-rose-300'
                                  : 'text-mist-600',
                            )}
                          >
                            {a.title}
                          </span>
                          <span className="ml-auto truncate font-mono text-mist-700">
                            {a.result?.summary ?? a.status}
                          </span>
                        </li>
                      ))}
                    </ol>
                    {run.status === 'completed' ? (
                      <div className="mt-1.5 pl-3 text-3xs text-mist-600">
                        {run.manualActionsAvoided} manual actions replaced by 1 approval ·{' '}
                        {formatDuration(run.timeSavedSeconds)} saved
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}
