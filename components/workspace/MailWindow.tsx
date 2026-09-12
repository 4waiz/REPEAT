'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Inbox, Mail, Reply, Star } from 'lucide-react';
import { useRepeat, selectNextAction } from '@/lib/store/repeat-store';
import { GuideRing, WindowFrame } from './chrome';
import { Badge } from '@/components/ui/primitives';
import { cn, formatClock } from '@/lib/utils';

/**
 * Replica mail client.
 *
 * Two human actions live here and both are real clicks: opening the report,
 * and copying its content. Everything REPEAT later knows about the customer
 * comes from the message body, nothing is passed in behind the scenes.
 */
export function MailWindow() {
  const inbox = useRepeat((s) => s.inbox);
  const selectedId = useRepeat((s) => s.selectedMailId);
  const clipboard = useRepeat((s) => s.clipboard);
  const readMail = useRepeat((s) => s.readMail);
  const copyMail = useRepeat((s) => s.copyMail);
  const guideOn = useRepeat((s) => s.settings.guideOn);
  const next = useRepeat(selectNextAction);

  const mailSurface = useRepeat((s) => s.mailSurface);

  const selected = inbox.find((m) => m.id === selectedId) ?? null;
  const unread = inbox.filter((m) => !m.read).length;
  const firstBug = inbox.find((m) => m.fixtureRef !== 'noise' && !m.read);

  return (
    <WindowFrame
      title={mailSurface ? 'Gmail' : 'Mail'}
      subtitle={mailSurface ? `${mailSurface.address} · live` : 'Inbox'}
      icon={<Mail />}
      accent="#38dcff"
      observed
      className="min-w-0"
    >
      <div className="flex min-h-0 flex-1">
        {/* message list */}
        <div className="flex w-[38%] min-w-0 shrink-0 flex-col border-r border-edge-faint">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="flex items-center gap-1.5 text-2xs uppercase tracking-[0.12em] text-mist-500">
              <Inbox className="h-3 w-3" />
              Inbox
            </span>
            {unread > 0 ? (
              <span className="rounded bg-cyan-400/15 px-1.5 text-2xs font-medium text-cyan-300">
                {unread}
              </span>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AnimatePresence initial={false}>
              {inbox.map((m) => {
                const isSelected = m.id === selectedId;
                const isBug = m.fixtureRef !== 'noise';
                const shouldGuide =
                  guideOn && next === 'mail.read_message' && firstBug?.id === m.id && !isSelected;

                return (
                  <motion.button
                    key={m.id}
                    layout
                    initial={m.isNew ? { opacity: 0, y: -14, height: 0 } : false}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => readMail(m.id)}
                    className={cn(
                      'relative block w-full overflow-hidden border-b border-edge-faint px-3 py-2.5 text-left transition-colors',
                      isSelected ? 'bg-cyan-400/[0.07]' : 'hover:bg-white/[0.03]',
                    )}
                  >
                    {isSelected ? (
                      <motion.span
                        layoutId="mail-selection"
                        className="absolute inset-y-0 left-0 w-[2px] bg-cyan-400"
                      />
                    ) : null}
                    {shouldGuide ? (
                      <motion.span
                        className="pointer-events-none absolute inset-1 rounded-md border border-cyan-400/60"
                        animate={{ opacity: [0.3, 0.85, 0.3] }}
                        transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    ) : null}

                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-xs',
                          m.read ? 'text-mist-400' : 'font-semibold text-mist-100',
                        )}
                      >
                        {m.from}
                      </span>
                      <span className="shrink-0 font-mono text-3xs text-mist-600">
                        {m.receivedAt ? formatClock(m.receivedAt) : ''}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'mt-0.5 truncate text-xs leading-snug',
                        m.read ? 'text-mist-500' : 'text-mist-200',
                      )}
                    >
                      {m.subject}
                    </div>
                    {isBug ? (
                      <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 rounded border border-amber-400/25 bg-amber-400/10 px-1 py-px text-3xs uppercase tracking-[0.1em] text-amber-300">
                          support
                        </span>
                      </div>
                    ) : null}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* reading pane */}
        <div className="flex min-w-0 flex-1 flex-col">
          {selected ? (
            <>
              <div className="border-b border-edge-faint px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-[0.8125rem] font-semibold leading-snug text-mist-50">
                    {selected.subject}
                  </h3>
                  <div className="flex shrink-0 items-center gap-1 text-mist-600">
                    <Star className="h-3.5 w-3.5" />
                    <Reply className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.07] text-3xs font-semibold text-mist-300">
                    {selected.from.slice(0, 1)}
                  </span>
                  <span className="truncate text-xs text-mist-300">{selected.from}</span>
                  <span className="truncate font-mono text-3xs text-mist-600">
                    {selected.fromEmail}
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <p className="whitespace-pre-line text-xs leading-relaxed text-mist-200">
                  {selected.body}
                </p>
              </div>

              {selected.fixtureRef !== 'noise' ? (
                <div className="flex items-center gap-2 border-t border-edge-faint px-3 py-2.5">
                  <GuideRing active={guideOn && next === 'mail.copy_content'}>
                    <button
                      onClick={copyMail}
                      className={cn(
                        'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-xs transition-colors',
                        clipboard
                          ? 'border-teal-400/35 bg-teal-400/10 text-teal-300'
                          : 'border-edge bg-ink-800/60 text-mist-200 hover:border-edge-strong',
                      )}
                    >
                      <Copy className="h-3 w-3" />
                      {clipboard ? 'Copied' : 'Copy details'}
                    </button>
                  </GuideRing>
                  {/* Helper text is the first thing to go when space is tight. */}
                  <span className="hidden truncate text-3xs text-mist-600 2xl:inline">
                    {clipboard
                      ? 'Report content on the clipboard'
                      : 'Copy the report to file a ticket'}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <Mail className="h-5 w-5 text-mist-600" />
              <p className="text-xs text-mist-400">Open the support report to begin</p>
              <Badge tone="neutral">REPEAT is watching</Badge>
            </div>
          )}
        </div>
      </div>
    </WindowFrame>
  );
}
