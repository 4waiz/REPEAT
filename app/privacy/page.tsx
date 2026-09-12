'use client';

import { Check, EyeOff, Lock, PauseCircle, PlayCircle, Trash2, X } from 'lucide-react';
import type { SourceApp } from '@/types';
import { useRepeat } from '@/lib/store/repeat-store';
import { PageShell } from '@/components/repeat/PageShell';
import { APP_META } from '@/lib/events/taxonomy';
import { PERMISSION_ORDER, PERMISSION_POLICY } from '@/lib/policy/policy';
import { DEMO_MODE } from '@/lib/demo/config';
import { Badge, Button, Panel, PanelHeader } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * Privacy and permissions.
 *
 * Written to be checkable rather than reassuring: every claim on this page
 * corresponds to code in the repository, and the things REPEAT does *not*
 * guarantee are stated as plainly as the things it does.
 */

const OBSERVED = [
  { label: 'Which application is in focus', detail: 'mail, issue tracker, team chat' },
  { label: 'The type of action taken', detail: 'read, copy, compose, label, assign, send' },
  { label: 'Workflow metadata', detail: 'ordering, timing, and which app followed which' },
  {
    label: 'Structured fields you produced',
    detail: 'ticket title, labels, priority, assignee — the values the workflow needs',
  },
];

const IGNORED = [
  { label: 'Password and credential fields', detail: 'dropped before an event is created' },
  { label: 'Payment and card fields', detail: 'same redaction list' },
  { label: 'Mouse coordinates and keystrokes', detail: 'never part of the event model at all' },
  { label: 'Excluded applications', detail: 'switch an app off below and nothing from it is recorded' },
  { label: 'Anything at all while paused', detail: 'the observer returns immediately' },
];

const APPS: SourceApp[] = ['mail', 'tracker', 'chat'];

export default function PrivacyPage() {
  const settings = useRepeat((s) => s.settings);
  const setSetting = useRepeat((s) => s.setSetting);
  const traces = useRepeat((s) => s.traces);
  const patterns = useRepeat((s) => s.patterns);
  const forgetPattern = useRepeat((s) => s.forgetPattern);
  const clearHistory = useRepeat((s) => s.clearHistory);

  const toggleApp = (app: SourceApp) => {
    const excluded = settings.excludedApps.includes(app);
    setSetting(
      'excludedApps',
      excluded ? settings.excludedApps.filter((a) => a !== app) : [...settings.excludedApps, app],
    );
  };

  return (
    <PageShell
      title="Privacy and permissions"
      description="REPEAT only works because it watches. This page is where you decide what that means, and it is enforced in the observer, not promised in marketing copy."
      actions={
        <Button
          variant={settings.observationPaused ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setSetting('observationPaused', !settings.observationPaused)}
        >
          {settings.observationPaused ? (
            <PlayCircle className="h-3.5 w-3.5" />
          ) : (
            <PauseCircle className="h-3.5 w-3.5" />
          )}
          {settings.observationPaused ? 'Resume observation' : 'Pause observation'}
        </Button>
      }
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHeader title="REPEAT observes" />
          <ul className="space-y-2.5 px-5 pb-4">
            {OBSERVED.map((item) => (
              <li key={item.label} className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400" strokeWidth={2.5} />
                <span>
                  <span className="block text-[0.8125rem] text-mist-100">{item.label}</span>
                  <span className="block text-xs text-mist-500">{item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader title="REPEAT ignores" />
          <ul className="space-y-2.5 px-5 pb-4">
            {IGNORED.map((item) => (
              <li key={item.label} className="flex items-start gap-2.5">
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mist-500" strokeWidth={2.5} />
                <span>
                  <span className="block text-[0.8125rem] text-mist-100">{item.label}</span>
                  <span className="block text-xs text-mist-500">{item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* controls */}
      <Panel className="mt-3 overflow-hidden">
        <PanelHeader title="Controls" icon={<EyeOff />} />
        <div className="grid gap-5 px-5 pb-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs text-mist-300">Applications REPEAT may observe</div>
            <div className="flex flex-wrap gap-1.5">
              {APPS.map((app) => {
                const excluded = settings.excludedApps.includes(app);
                return (
                  <button
                    key={app}
                    onClick={() => toggleApp(app)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                      excluded
                        ? 'border-edge-faint text-mist-600 line-through'
                        : 'border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-200',
                    )}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: excluded ? '#3e4f66' : APP_META[app].accent }}
                    />
                    {APP_META[app].label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-3xs leading-relaxed text-mist-600">
              Excluding an app makes the observer drop its events entirely — they are never created,
              not merely hidden.
            </p>
          </div>

          <div>
            <div className="mb-2 text-xs text-mist-300">Stored observations</div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{traces.length} workflows</Badge>
              <Badge tone="neutral">{patterns.length} learned patterns</Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  patterns.forEach((p) => forgetPattern(p.id));
                  clearHistory();
                }}
                disabled={traces.length === 0 && patterns.length === 0}
              >
                <Trash2 className="h-3 w-3" />
                Forget everything
              </Button>
            </div>
            <p className="mt-2 text-3xs leading-relaxed text-mist-600">
              Forgetting deletes the observations and the compiled pattern together. There is no
              copy kept elsewhere — in this prototype all state lives in the browser tab.
            </p>
          </div>
        </div>
      </Panel>

      {/* permission model */}
      <Panel className="mt-3 overflow-hidden">
        <PanelHeader title="What REPEAT is allowed to do" icon={<Lock />} />
        <div className="px-5 pb-4">
          <div className="space-y-1.5">
            {PERMISSION_ORDER.map((p) => {
              const policy = PERMISSION_POLICY[p];
              return (
                <div
                  key={p}
                  className="grid grid-cols-[10rem_7rem_1fr] items-center gap-3 rounded-md border border-edge-faint px-3 py-2"
                >
                  <span className="truncate text-xs text-mist-100">{policy.label}</span>
                  <span>
                    {!policy.allowed ? (
                      <Badge tone="rose">blocked</Badge>
                    ) : policy.requiresApproval ? (
                      <Badge tone="amber">needs approval</Badge>
                    ) : (
                      <Badge tone="teal">automatic</Badge>
                    )}
                  </span>
                  <span className="text-3xs leading-relaxed text-mist-500">{policy.rationale}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      {/* honesty */}
      <Panel flat className="mt-3 px-5 py-4">
        <div className="eyebrow mb-2">What this prototype does not claim</div>
        <ul className="space-y-1.5 text-xs leading-relaxed text-mist-400">
          <li>
            · There is no encryption story here. State lives in this browser tab and disappears when
            you reload. We have not built key management, and we are not going to imply we have.
          </li>
          <li>
            · Observation is limited to the three replica applications in this workspace. REPEAT does
            not read your real screen, your real inbox or any other process.
          </li>
          <li>
            ·{' '}
            {DEMO_MODE
              ? 'Demo Mode is on, so no data leaves this machine at all — every adapter is in-memory.'
              : 'Demo Mode is off. When REPEAT acts on a report it sends the report text to a model via OpenRouter, sends only the symptom phrase (never the sender or the body) to Exa, and the configured live adapters may send data to GitHub or Slack.'}
          </li>
          <li>
            · The redaction list is a deny-list of field names, which is a reasonable first line and
            not a guarantee. A production version would need allow-listing instead.
          </li>
        </ul>
      </Panel>
    </PageShell>
  );
}
