'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CircleDot, ClipboardPaste, ExternalLink, GitPullRequestArrow, Plus, Tag } from 'lucide-react';
import type { IssueSeverity } from '@/types';
import { useRepeat, selectNextAction } from '@/lib/store/repeat-store';
import { TEAM } from '@/lib/demo/team';
import { TRACKER_PROJECT } from '@/lib/demo/fixtures';
import { Field, GuideRing, WindowFrame } from './chrome';
import { cn } from '@/lib/utils';

/**
 * Replica issue tracker.
 *
 * The composer is where most of the manual cost of triage actually sits, so
 * the human's clicks here are the bulk of the observed workflow: paste,
 * label, prioritise, assign, submit.
 */

const LABEL_CHOICES = ['bug', 'authentication', 'performance', 'ui', 'data', 'frontend', 'backend'];

function isRealUrl(url: string | undefined): url is string {
  return Boolean(url && /^https?:\/\//.test(url) && !url.includes('tracker.local'));
}
const PRIORITIES: IssueSeverity[] = ['low', 'medium', 'high', 'critical'];

const PRIORITY_TONE: Record<IssueSeverity, string> = {
  low: 'border-edge-soft bg-white/[0.04] text-mist-400',
  medium: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  high: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  critical: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
};

const PROVIDER_LABEL: Record<string, string> = { clickup: 'ClickUp', jira: 'Jira' };

export function TrackerWindow() {
  const composer = useRepeat((s) => s.composer);
  const issues = useRepeat((s) => s.issues);
  const clipboard = useRepeat((s) => s.clipboard);
  const guideOn = useRepeat((s) => s.settings.guideOn);
  const next = useRepeat(selectNextAction);
  const surfaces = useRepeat((s) => s.surfaces);
  const trackerView = useRepeat((s) => s.trackerView);
  const setTrackerView = useRepeat((s) => s.setTrackerView);
  const liveTarget = useRepeat((s) => s.live?.tracker?.target ?? null);

  // Live mode shows the real board; the replica project name is Demo Mode's.
  const board = surfaces?.trackers.find((t) => t.provider === trackerView) ?? null;
  const title = board ? board.target.replace(/^ClickUp list \d+$/, 'ClickUp') : liveTarget ?? TRACKER_PROJECT.label;
  const subtitle = board ? `${PROVIDER_LABEL[board.provider] ?? board.provider} · live` : 'Issues';

  const openComposer = useRepeat((s) => s.openComposer);
  const paste = useRepeat((s) => s.pasteIntoComposer);
  const toggleLabel = useRepeat((s) => s.toggleLabel);
  const setPriority = useRepeat((s) => s.setPriority);
  const setAssignee = useRepeat((s) => s.setAssignee);
  const submitIssue = useRepeat((s) => s.submitIssue);

  const canSubmit = Boolean(composer.title && composer.labels.length && composer.priority);

  return (
    <WindowFrame
      title={title}
      subtitle={subtitle}
      icon={<GitPullRequestArrow />}
      accent="#8b7cff"
      observed
      className="min-w-0"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-edge-faint px-3 py-2">
          <span className="flex min-w-0 items-center gap-1.5 text-2xs uppercase tracking-[0.12em] text-mist-500">
            <CircleDot className="h-3 w-3 shrink-0" />
            {issues.filter((i) => i.state === 'open').length} open
            {/* Two real boards: switch between them. One: link out to it. */}
            {surfaces && surfaces.trackers.length > 1 ? (
              <span className="ml-2 flex items-center gap-1 normal-case tracking-normal">
                {surfaces.trackers.map((t) => (
                  <button
                    key={t.provider}
                    onClick={() => setTrackerView(t.provider)}
                    className={cn(
                      'rounded border px-1.5 py-px text-3xs transition',
                      t.provider === trackerView
                        ? 'border-iris-400/40 bg-iris-400/15 text-iris-200'
                        : 'border-edge-faint text-mist-500 hover:text-mist-200',
                    )}
                  >
                    {PROVIDER_LABEL[t.provider] ?? t.provider}
                  </button>
                ))}
              </span>
            ) : null}
            {board?.url ? (
              <a
                href={board.url}
                target="_blank"
                rel="noreferrer noopener"
                className="ml-1 inline-flex items-center gap-1 normal-case tracking-normal text-mist-500 hover:text-mist-200"
                title="Open the real board"
              >
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ) : null}
          </span>
          {!composer.open ? (
            <GuideRing active={guideOn && next === 'tracker.open_composer'} radius="rounded-md">
              <button
                onClick={openComposer}
                className="inline-flex h-6 items-center gap-1 rounded-md bg-iris-400/15 px-2 text-2xs font-medium uppercase tracking-[0.1em] text-iris-300 transition hover:bg-iris-400/25"
              >
                <Plus className="h-3 w-3" />
                New issue
              </button>
            </GuideRing>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {composer.open ? (
              <motion.div
                key="composer"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden border-b border-edge-faint bg-ink-850/60"
              >
                <div className="px-3 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="eyebrow">Create issue</span>
                    {clipboard && !composer.title ? (
                      <GuideRing
                        active={guideOn && next === 'tracker.compose_issue'}
                        radius="rounded-md"
                      >
                        <button
                          onClick={paste}
                          className="inline-flex h-6 items-center gap-1 rounded-md border border-edge bg-ink-800/70 px-2 text-2xs text-mist-200 transition hover:border-edge-strong"
                        >
                          <ClipboardPaste className="h-3 w-3" />
                          Paste report
                        </button>
                      </GuideRing>
                    ) : null}
                  </div>

                  <Field label="Title" filled={Boolean(composer.title)}>
                    <div
                      className={cn(
                        'min-h-[28px] rounded-md border px-2 py-1.5 text-xs leading-snug',
                        composer.title
                          ? 'border-edge-soft bg-white/[0.03] text-mist-100'
                          : 'border-dashed border-edge-soft text-mist-600',
                      )}
                    >
                      {composer.title || 'Paste the report to fill the ticket'}
                      {!composer.title ? (
                        <span className="ml-0.5 inline-block h-3 w-[1px] animate-caret-blink bg-cyan-400 align-middle" />
                      ) : null}
                    </div>
                  </Field>

                  <Field label="Description" filled={Boolean(composer.body)}>
                    <div
                      className={cn(
                        'max-h-[3.6rem] overflow-y-auto whitespace-pre-line rounded-md border px-2 py-1.5 text-[0.6875rem] leading-relaxed',
                        composer.body
                          ? 'border-edge-soft bg-white/[0.03] text-mist-300'
                          : 'border-dashed border-edge-soft text-mist-600',
                      )}
                    >
                      {composer.body || '—'}
                    </div>
                  </Field>

                  <Field label="Labels" filled={composer.labels.length > 0}>
                    <GuideRing active={guideOn && next === 'tracker.apply_labels'}>
                      <div className="flex flex-wrap gap-1">
                        {LABEL_CHOICES.map((label) => {
                          const on = composer.labels.includes(label);
                          return (
                            <button
                              key={label}
                              onClick={() => toggleLabel(label)}
                              className={cn(
                                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs transition-colors',
                                on
                                  ? 'border-iris-400/40 bg-iris-400/15 text-iris-200'
                                  : 'border-edge-faint text-mist-500 hover:border-edge hover:text-mist-300',
                              )}
                            >
                              {on ? <Tag className="h-2.5 w-2.5" /> : null}
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </GuideRing>
                  </Field>

                  <Field label="Priority" filled={Boolean(composer.priority)}>
                    <GuideRing active={guideOn && next === 'tracker.set_priority'}>
                      <div className="flex gap-1">
                        {PRIORITIES.map((p) => (
                          <button
                            key={p}
                            onClick={() => setPriority(p)}
                            className={cn(
                              'rounded border px-1.5 py-0.5 text-2xs uppercase tracking-[0.08em] transition-colors',
                              composer.priority === p
                                ? PRIORITY_TONE[p]
                                : 'border-edge-faint text-mist-500 hover:border-edge hover:text-mist-300',
                            )}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </GuideRing>
                  </Field>

                  <Field label="Assignee" filled={Boolean(composer.assignee)}>
                    <GuideRing active={guideOn && next === 'tracker.assign_owner'}>
                      <div className="flex flex-wrap gap-1">
                        {TEAM.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setAssignee(m.name)}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-2xs transition-colors',
                              composer.assignee === m.name
                                ? 'border-cyan-400/40 bg-cyan-400/12 text-cyan-200'
                                : 'border-edge-faint text-mist-500 hover:border-edge hover:text-mist-300',
                            )}
                            title={`${m.name} — ${m.role}`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: m.accent }}
                            />
                            {m.name}
                          </button>
                        ))}
                      </div>
                    </GuideRing>
                  </Field>

                  <div className="mt-2.5 flex items-center gap-2">
                    <GuideRing
                      active={guideOn && next === 'tracker.create_issue' && canSubmit}
                      radius="rounded-md"
                    >
                      <button
                        onClick={submitIssue}
                        disabled={!canSubmit}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md bg-teal-400 px-3 text-xs font-semibold text-ink-950 transition hover:bg-teal-300 disabled:pointer-events-none disabled:opacity-35"
                      >
                        Create issue
                      </button>
                    </GuideRing>
                    {!canSubmit ? (
                      <span className="text-3xs text-mist-600">
                        Needs a title, labels and a priority
                      </span>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {issues.map((issue) => (
              <motion.div
                key={issue.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'border-b border-edge-faint px-3 py-2.5',
                  issue.createdBy === 'repeat' && 'bg-cyan-400/[0.045]',
                )}
              >
                <div className="flex items-start gap-2">
                  <CircleDot className="mt-0.5 h-3 w-3 shrink-0 text-teal-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="truncate text-xs font-medium text-mist-100">
                        {issue.title}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="font-mono text-3xs text-mist-600">
                        {issue.key ?? `#${issue.number}`}
                      </span>
                      {issue.labels.map((l) => (
                        <span
                          key={l}
                          className="rounded border border-edge-faint px-1 py-px text-3xs text-mist-500"
                        >
                          {l}
                        </span>
                      ))}
                      <span
                        className={cn(
                          'rounded border px-1 py-px text-3xs uppercase tracking-[0.08em]',
                          PRIORITY_TONE[issue.priority],
                        )}
                      >
                        {issue.priority}
                      </span>
                      {issue.assignee ? (
                        <span className="ml-auto shrink-0 text-3xs text-mist-400">
                          {issue.assignee}
                        </span>
                      ) : null}
                    </div>
                    {issue.createdBy === 'repeat' || isRealUrl(issue.url) ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {issue.createdBy === 'repeat' ? (
                          <span className="inline-flex items-center gap-1 rounded border border-cyan-400/25 bg-cyan-400/10 px-1 py-px text-3xs uppercase tracking-[0.1em] text-cyan-300">
                            by repeat
                          </span>
                        ) : null}
                        {/* Only a live tracker has a real address; the replica's is local. */}
                        {isRealUrl(issue.url) ? (
                          <a
                            href={issue.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1 text-3xs text-teal-300 hover:text-teal-200"
                          >
                            open in {PROVIDER_LABEL[issue.provider ?? ''] ?? 'tracker'}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </WindowFrame>
  );
}
