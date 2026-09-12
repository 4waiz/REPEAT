'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardPaste, ExternalLink, Flag, Plus } from 'lucide-react';
import type { IssueSeverity } from '@/types';
import { useRepeat, selectNextAction } from '@/lib/store/repeat-store';
import { TEAM } from '@/lib/demo/team';
import { TRACKER_PROJECT } from '@/lib/demo/fixtures';
import { Avatar, Field, GuideRing, WindowFrame } from './chrome';
import { cn } from '@/lib/utils';

/**
 * The issue-tracker surface, wearing ClickUp's dark theme.
 *
 * In live mode these are real tasks in a real ClickUp list, so the board is
 * styled as ClickUp: status dots, priority flags, tag pills, assignee
 * avatars. The composer is where most of the manual cost of triage actually
 * sits, so the human's clicks here are the bulk of the observed workflow:
 * paste, label, prioritise, assign, submit.
 */

const LABEL_CHOICES = ['bug', 'authentication', 'performance', 'ui', 'data', 'frontend', 'backend'];

function isRealUrl(url: string | undefined): url is string {
  return Boolean(url && /^https?:\/\//.test(url) && !url.includes('tracker.local'));
}
const PRIORITIES: IssueSeverity[] = ['low', 'medium', 'high', 'critical'];

/** ClickUp shows priority as a coloured flag, not a coloured word. */
const PRIORITY_FLAG: Record<IssueSeverity, string> = {
  low: '#b5bcc9',
  medium: '#6fddff',
  high: '#ffcc00',
  critical: '#f50000',
};

const PROVIDER_LABEL: Record<string, string> = { clickup: 'ClickUp', jira: 'Jira' };

const PURPLE = '#7b68ee';
const LINE = 'rgba(255,255,255,0.07)';

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
  const listName = board
    ? board.target.replace(/^ClickUp list \d+$/, 'Support triage')
    : (liveTarget ?? TRACKER_PROJECT.label);
  const subtitle = board ? `${PROVIDER_LABEL[board.provider] ?? board.provider} · live` : 'Tasks';

  const openComposer = useRepeat((s) => s.openComposer);
  const paste = useRepeat((s) => s.pasteIntoComposer);
  const toggleLabel = useRepeat((s) => s.toggleLabel);
  const setPriority = useRepeat((s) => s.setPriority);
  const setAssignee = useRepeat((s) => s.setAssignee);
  const submitIssue = useRepeat((s) => s.submitIssue);

  const canSubmit = Boolean(composer.title && composer.labels.length && composer.priority);
  const openCount = issues.filter((i) => i.state === 'open').length;

  return (
    <WindowFrame
      title={board ? PROVIDER_LABEL[board.provider] ?? 'ClickUp' : 'ClickUp'}
      subtitle={subtitle}
      brand="clickup"
      observed
      className="min-w-0"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* list header */}
        <div
          className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2"
          style={{ borderColor: LINE }}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xs font-semibold text-mist-100">{listName}</span>
            <span className="shrink-0 rounded bg-white/[0.08] px-1.5 text-3xs font-medium text-mist-400">
              {openCount}
            </span>
            {/* Two real boards: switch between them. One: link out to it. */}
            {surfaces && surfaces.trackers.length > 1 ? (
              <span className="ml-1 flex items-center gap-1">
                {surfaces.trackers.map((t) => (
                  <button
                    key={t.provider}
                    onClick={() => setTrackerView(t.provider)}
                    style={
                      t.provider === trackerView
                        ? { background: `${PURPLE}26`, borderColor: `${PURPLE}66`, color: '#c3b8ff' }
                        : undefined
                    }
                    className={cn(
                      'rounded border px-1.5 py-px text-3xs transition',
                      t.provider !== trackerView && 'border-white/10 text-mist-500 hover:text-mist-200',
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
                className="ml-0.5 inline-flex shrink-0 items-center text-mist-500 hover:text-mist-200"
                title="Open the real board"
              >
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ) : null}
          </span>
          {!composer.open ? (
            <GuideRing active={guideOn && next === 'tracker.open_composer'} radius="rounded">
              <button
                onClick={openComposer}
                style={{ background: PURPLE }}
                className="inline-flex h-6 shrink-0 items-center gap-1 rounded px-2 text-2xs font-semibold text-white transition hover:brightness-110"
              >
                <Plus className="h-3 w-3" />
                Task
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
                className="overflow-hidden border-b bg-white/[0.02]"
                style={{ borderColor: LINE }}
              >
                <div className="px-3 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-2xs font-semibold uppercase tracking-[0.16em] text-mist-500">
                      New task
                    </span>
                    {clipboard && !composer.title ? (
                      <GuideRing active={guideOn && next === 'tracker.compose_issue'} radius="rounded">
                        <button
                          onClick={paste}
                          className="inline-flex h-6 items-center gap-1 rounded border border-white/15 bg-white/[0.05] px-2 text-2xs text-mist-200 transition hover:bg-white/[0.09]"
                        >
                          <ClipboardPaste className="h-3 w-3" />
                          Paste report
                        </button>
                      </GuideRing>
                    ) : null}
                  </div>

                  <Field label="Name" filled={Boolean(composer.title)}>
                    <div
                      className={cn(
                        'min-h-[28px] rounded border px-2 py-1.5 text-xs leading-snug',
                        composer.title
                          ? 'border-white/10 bg-white/[0.04] text-mist-100'
                          : 'border-dashed border-white/10 text-mist-600',
                      )}
                    >
                      {composer.title || 'Paste the report to fill the task'}
                      {!composer.title ? (
                        <span className="ml-0.5 inline-block h-3 w-[1px] animate-caret-blink bg-cyan-400 align-middle" />
                      ) : null}
                    </div>
                  </Field>

                  <Field label="Description" filled={Boolean(composer.body)}>
                    <div
                      className={cn(
                        'max-h-[3.6rem] overflow-y-auto whitespace-pre-line rounded border px-2 py-1.5 text-[0.6875rem] leading-relaxed',
                        composer.body
                          ? 'border-white/10 bg-white/[0.04] text-mist-300'
                          : 'border-dashed border-white/10 text-mist-600',
                      )}
                    >
                      {composer.body || '—'}
                    </div>
                  </Field>

                  <Field label="Tags" filled={composer.labels.length > 0}>
                    <GuideRing active={guideOn && next === 'tracker.apply_labels'}>
                      <div className="flex flex-wrap gap-1">
                        {LABEL_CHOICES.map((label) => {
                          const on = composer.labels.includes(label);
                          return (
                            <button
                              key={label}
                              onClick={() => toggleLabel(label)}
                              style={
                                on
                                  ? { background: `${PURPLE}26`, borderColor: `${PURPLE}66`, color: '#c3b8ff' }
                                  : undefined
                              }
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs transition-colors',
                                !on && 'border-white/10 text-mist-500 hover:border-white/20 hover:text-mist-300',
                              )}
                            >
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
                        {PRIORITIES.map((p) => {
                          const on = composer.priority === p;
                          return (
                            <button
                              key={p}
                              onClick={() => setPriority(p)}
                              style={on ? { borderColor: `${PRIORITY_FLAG[p]}80` } : undefined}
                              className={cn(
                                'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs capitalize transition-colors',
                                on
                                  ? 'bg-white/[0.06] text-mist-100'
                                  : 'border-white/10 text-mist-500 hover:border-white/20 hover:text-mist-300',
                              )}
                            >
                              <Flag
                                className="h-2.5 w-2.5"
                                style={{ color: PRIORITY_FLAG[p] }}
                                fill={on ? PRIORITY_FLAG[p] : 'transparent'}
                              />
                              {p}
                            </button>
                          );
                        })}
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
                              'inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-2xs transition-colors',
                              composer.assignee === m.name
                                ? 'border-white/25 bg-white/[0.08] text-mist-100'
                                : 'border-white/10 text-mist-500 hover:border-white/20 hover:text-mist-300',
                            )}
                            title={`${m.name} — ${m.role}`}
                          >
                            <Avatar name={m.name} size={14} />
                            {m.name}
                          </button>
                        ))}
                      </div>
                    </GuideRing>
                  </Field>

                  <div className="mt-2.5 flex items-center gap-2">
                    <GuideRing
                      active={guideOn && next === 'tracker.create_issue' && canSubmit}
                      radius="rounded"
                    >
                      <button
                        onClick={submitIssue}
                        disabled={!canSubmit}
                        style={{ background: canSubmit ? PURPLE : undefined }}
                        className="inline-flex h-7 items-center gap-1.5 rounded px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:pointer-events-none disabled:bg-white/10 disabled:opacity-50"
                      >
                        Create task
                      </button>
                    </GuideRing>
                    {!canSubmit ? (
                      <span className="text-3xs text-mist-600">
                        Needs a name, tags and a priority
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
                style={{ borderColor: LINE }}
                className={cn(
                  'border-b px-3 py-2.5',
                  issue.createdBy === 'repeat' && 'bg-cyan-400/[0.045]',
                )}
              >
                <div className="flex items-start gap-2">
                  {/* ClickUp's status is a ring, filled once complete */}
                  <span
                    className="mt-0.5 h-3 w-3 shrink-0 rounded-full border-2"
                    style={{
                      borderColor: issue.state === 'open' ? '#87909e' : '#2ecd6f',
                      background: issue.state === 'open' ? 'transparent' : '#2ecd6f',
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-mist-100">
                        {issue.title}
                      </span>
                      <Flag
                        className="mt-px h-3 w-3 shrink-0"
                        style={{ color: PRIORITY_FLAG[issue.priority] }}
                        fill={PRIORITY_FLAG[issue.priority]}
                      />
                      {issue.assignee ? (
                        <Avatar name={issue.assignee} size={16} className="mt-px" />
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="font-mono text-3xs text-mist-600">
                        {issue.key ?? `#${issue.number}`}
                      </span>
                      {issue.labels.map((l) => (
                        <span
                          key={l}
                          className="rounded-full border border-white/10 px-1.5 py-px text-3xs text-mist-500"
                        >
                          {l}
                        </span>
                      ))}
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
                            className="inline-flex items-center gap-1 text-3xs text-[#a99bff] hover:text-[#c3b8ff]"
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
