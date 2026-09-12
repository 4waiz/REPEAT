'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Archive, Copy, CornerUpLeft, Reply, Search, Send, Star, Trash2 } from 'lucide-react';
import { useRepeat, selectNextAction } from '@/lib/store/repeat-store';
import { Avatar, GuideRing, WindowFrame } from './chrome';
import { Badge } from '@/components/ui/primitives';
import { cn, formatClock } from '@/lib/utils';

/**
 * The mail surface, wearing Gmail's dark theme.
 *
 * In live mode this is a real Gmail inbox read over OAuth with the
 * gmail.readonly scope, so it is styled as Gmail rather than as a generic
 * mail client — what the room sees is what the account actually contains.
 *
 * Two human actions live here and both are real clicks: opening the report,
 * and copying its content. Everything REPEAT later knows about the customer
 * comes from the message body, nothing is passed in behind the scenes.
 */

/** Gmail's own greys, so the panel reads as Gmail and not as REPEAT. */
const LINE = 'rgba(255,255,255,0.07)';

export function MailWindow() {
  const inbox = useRepeat((s) => s.inbox);
  const selectedId = useRepeat((s) => s.selectedMailId);
  const clipboard = useRepeat((s) => s.clipboard);
  const readMail = useRepeat((s) => s.readMail);
  const copyMail = useRepeat((s) => s.copyMail);
  const guideOn = useRepeat((s) => s.settings.guideOn);
  const next = useRepeat(selectNextAction);

  const mailSurface = useRepeat((s) => s.mailSurface);
  const mailAuthUrl = useRepeat((s) => s.mailAuthUrl);
  const customerReplyDraft = useRepeat((s) => s.customerReplyDraft);
  const replyToCustomer = useRepeat((s) => s.replyToCustomer);

  const selected = inbox.find((m) => m.id === selectedId) ?? null;
  const unread = inbox.filter((m) => !m.read).length;
  const firstBug = inbox.find((m) => m.fixtureRef !== 'noise' && !m.read);

  return (
    <WindowFrame
      title="Gmail"
      subtitle={mailSurface ? `${mailSurface.address} · live` : 'Inbox'}
      brand="gmail"
      observed
      className="min-w-0"
    >
      {/* Gmail's search pill */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-2.5 py-1.5"
        style={{ borderColor: LINE }}
      >
        <div className="flex h-6 min-w-0 flex-1 items-center gap-2 rounded-full bg-white/[0.06] px-2.5">
          <Search className="h-3 w-3 shrink-0 text-mist-500" />
          <span className="truncate text-2xs text-mist-500">Search mail</span>
        </div>
        {mailAuthUrl && !mailSurface ? (
          <a
            href={mailAuthUrl}
            className="inline-flex h-6 shrink-0 items-center rounded-full bg-[#ea4335] px-2.5 text-2xs font-medium text-white transition hover:bg-[#f2594b]"
            title="Authorise read-only access to your Gmail inbox"
          >
            Connect Gmail
          </a>
        ) : unread > 0 ? (
          <span className="shrink-0 text-2xs font-semibold text-[#ea4335]">{unread} new</span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* message list */}
        <div
          className="flex w-[40%] min-w-0 shrink-0 flex-col border-r"
          style={{ borderColor: LINE }}
        >
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
                    style={{ borderColor: LINE }}
                    className={cn(
                      'relative block w-full overflow-hidden border-b px-2.5 py-2 text-left transition-colors',
                      isSelected
                        ? 'bg-white/[0.09]'
                        : m.read
                          ? 'hover:bg-white/[0.04]'
                          : 'bg-white/[0.028] hover:bg-white/[0.05]',
                    )}
                  >
                    {/* Gmail marks unread with a heavier left edge, not a rail */}
                    {isSelected ? (
                      <motion.span
                        layoutId="mail-selection"
                        className="absolute inset-y-0 left-0 w-[3px] bg-[#ea4335]"
                      />
                    ) : null}
                    {shouldGuide ? (
                      <motion.span
                        className="pointer-events-none absolute inset-1 rounded-md border border-cyan-400/60"
                        animate={{ opacity: [0.3, 0.85, 0.3] }}
                        transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    ) : null}

                    <div className="flex items-start gap-2">
                      <Avatar name={m.from} size={20} className="mt-px" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              'truncate text-xs',
                              m.read ? 'text-mist-400' : 'font-bold text-white',
                            )}
                          >
                            {m.from}
                          </span>
                          <span
                            className={cn(
                              'shrink-0 text-3xs',
                              m.read ? 'text-mist-600' : 'font-semibold text-mist-300',
                            )}
                          >
                            {m.receivedAt ? formatClock(m.receivedAt) : ''}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'mt-0.5 block truncate text-xs leading-snug',
                            m.read ? 'text-mist-500' : 'font-semibold text-mist-100',
                          )}
                        >
                          {m.subject}
                        </span>
                        {isBug ? (
                          <span className="mt-1 inline-flex items-center rounded-sm bg-[#ea4335]/15 px-1 py-px text-3xs font-medium text-[#f28b82]">
                            Support
                          </span>
                        ) : null}
                      </span>
                    </div>
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
              <div className="border-b px-3.5 py-2.5" style={{ borderColor: LINE }}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-[0.875rem] font-normal leading-snug text-mist-50">
                    {selected.subject}
                  </h3>
                  <div className="flex shrink-0 items-center gap-2 text-mist-600">
                    <Archive className="h-3.5 w-3.5" />
                    <Trash2 className="h-3.5 w-3.5" />
                    <Star className="h-3.5 w-3.5" />
                    <Reply className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Avatar name={selected.from} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="truncate text-xs font-semibold text-mist-100">
                        {selected.from}
                      </span>
                      <span className="truncate text-3xs text-mist-500">
                        &lt;{selected.fromEmail}&gt;
                      </span>
                    </span>
                    <span className="block text-3xs text-mist-600">to me</span>
                  </span>
                  <span className="shrink-0 text-3xs text-mist-600">
                    {selected.receivedAt ? formatClock(selected.receivedAt) : ''}
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
                <p className="whitespace-pre-line text-xs leading-relaxed text-mist-200">
                  {selected.body}
                </p>

                {/* The acknowledgement back to the customer — the last step of
                    the workflow, and the one REPEAT learns to stop skipping. */}
                {customerReplyDraft ? (
                  <div className="mt-3 rounded-lg border border-white/[0.14] bg-white/[0.03] p-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <CornerUpLeft className="h-3 w-3 text-[#f28b82]" />
                      <span className="text-3xs uppercase tracking-[0.12em] text-mist-500">
                        Reply to {selected.from}
                      </span>
                    </div>
                    <p className="max-h-24 overflow-y-auto whitespace-pre-line text-[0.6875rem] leading-relaxed text-mist-300">
                      {customerReplyDraft}
                    </p>
                    <GuideRing
                      active={guideOn && next === 'mail.reply_customer'}
                      radius="rounded-full"
                      className="mt-2"
                    >
                      <button
                        onClick={replyToCustomer}
                        className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#0b57d0] px-3 text-xs font-semibold text-white transition hover:bg-[#1a6ae0]"
                      >
                        <Send className="h-3 w-3" />
                        Send reply
                      </button>
                    </GuideRing>
                  </div>
                ) : null}
              </div>

              {selected.fixtureRef !== 'noise' ? (
                <div
                  className="flex items-center gap-2 border-t px-3 py-2.5"
                  style={{ borderColor: LINE }}
                >
                  <GuideRing active={guideOn && next === 'mail.copy_content'} radius="rounded-full">
                    <button
                      onClick={copyMail}
                      className={cn(
                        'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs transition-colors',
                        clipboard
                          ? 'border-teal-400/35 bg-teal-400/10 text-teal-300'
                          : 'border-white/15 bg-white/[0.06] text-mist-200 hover:bg-white/[0.1]',
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
              <span className="h-6 w-6 opacity-80">
                <svg viewBox="0 0 48 36" aria-hidden className="h-full w-full">
                  <path d="M3.5 35h7V18L1 10.2v21a3.8 3.8 0 0 0 3.5 3.8Z" fill="#4285f4" />
                  <path d="M37.5 35h7A3.5 3.5 0 0 0 48 31.5v-21L37.5 18Z" fill="#34a853" />
                  <path d="M37.5 4.5V18L48 10.2V6.2c0-3.5-4-5.5-6.8-3.4Z" fill="#fbbc04" />
                  <path d="M10.5 18V4.5L24 14.6 37.5 4.5V18L24 28.1Z" fill="#ea4335" />
                  <path d="M1 6.2v4l9.5 7.8V4.5L6.8 2.8C4 .7 1 2.7 1 6.2Z" fill="#c5221f" />
                </svg>
              </span>
              <p className="text-xs text-mist-400">
                {inbox.length ? 'Open the support report to begin' : 'No mail in this inbox yet'}
              </p>
              <Badge tone="neutral">REPEAT is watching</Badge>
            </div>
          )}
        </div>
      </div>
    </WindowFrame>
  );
}
