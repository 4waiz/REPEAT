'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Hash, Send, Sparkles } from 'lucide-react';
import { useRepeat, selectNextAction } from '@/lib/store/repeat-store';
import { CHAT_CHANNELS } from '@/lib/demo/fixtures';
import { GuideRing, WindowFrame } from './chrome';
import { Orb } from '@/components/repeat/Orb';
import { cn, formatClock } from '@/lib/utils';

/**
 * Replica team chat.
 *
 * The last two human actions live here: drafting the notification and sending
 * it. Sending is what closes the trace, which is the moment the detector runs.
 */
export function ChatWindow() {
  const chat = useRepeat((s) => s.chat);
  const activeChannel = useRepeat((s) => s.activeChannel);
  const draft = useRepeat((s) => s.chatDraft);
  const guideOn = useRepeat((s) => s.settings.guideOn);
  const next = useRepeat(selectNextAction);
  const activeTrace = useRepeat((s) => s.activeTrace);

  const openChannel = useRepeat((s) => s.openChannel);
  const draftMessage = useRepeat((s) => s.draftTeamMessage);
  const sendMessage = useRepeat((s) => s.sendTeamMessage);

  const messages = chat.filter((m) => m.channel === activeChannel);
  const drafted = activeTrace?.events.some((e) => e.action === 'chat.compose_message') ?? false;

  // Keep the newest message in view — REPEAT's notification is the payoff of
  // the whole run and must not land below the fold.
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, activeChannel]);

  return (
    <WindowFrame
      title="Team Chat"
      subtitle={`#${activeChannel}`}
      icon={<Hash />}
      accent="#2dd4a7"
      observed
      className="min-w-0"
    >
      <div className="flex min-h-0 flex-1">
        {/* channel rail */}
        <div className="flex w-[34%] min-w-0 shrink-0 flex-col border-r border-edge-faint">
          <div className="px-3 py-2 text-2xs uppercase tracking-[0.12em] text-mist-500">
            Channels
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5">
            {CHAT_CHANNELS.map((c) => {
              const isActive = c.name === activeChannel;
              const shouldGuide =
                guideOn && next === 'chat.open_channel' && c.name === 'product-updates' && !isActive;
              return (
                <GuideRing key={c.name} active={shouldGuide} className="w-full" radius="rounded-md">
                  <button
                    onClick={() => openChannel(c.name)}
                    className={cn(
                      'mb-0.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                      isActive
                        ? 'bg-teal-400/[0.12] text-teal-200'
                        : 'text-mist-400 hover:bg-white/[0.035] hover:text-mist-200',
                    )}
                  >
                    <Hash className="h-3 w-3 shrink-0 opacity-60" />
                    <span className="truncate">{c.name}</span>
                    {c.unread > 0 && !isActive ? (
                      <span className="ml-auto shrink-0 rounded bg-white/[0.08] px-1 text-3xs text-mist-400">
                        {c.unread}
                      </span>
                    ) : null}
                  </button>
                </GuideRing>
              );
            })}
          </div>
        </div>

        {/* messages */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(
                    'rounded-md px-2 py-1.5',
                    m.sentBy === 'repeat' && 'border border-cyan-400/20 bg-cyan-400/[0.055]',
                  )}
                >
                  <div className="flex items-baseline gap-1.5">
                    {m.sentBy === 'repeat' ? (
                      <Orb state="idle" size={12} />
                    ) : (
                      <span
                        className="h-3 w-3 shrink-0 rounded-full bg-white/[0.1] text-center text-[0.5rem] leading-3 text-mist-300"
                        aria-hidden
                      >
                        {m.author.slice(0, 1)}
                      </span>
                    )}
                    <span className="text-xs font-semibold text-mist-100">{m.author}</span>
                    {m.sentBy === 'repeat' ? (
                      <span className="rounded border border-cyan-400/25 bg-cyan-400/10 px-1 text-3xs uppercase tracking-[0.1em] text-cyan-300">
                        agent
                      </span>
                    ) : null}
                    <span className="ml-auto shrink-0 font-mono text-3xs text-mist-600">
                      {m.at ? formatClock(m.at) : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-mist-300">{m.body}</p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* composer */}
          <div className="shrink-0 border-t border-edge-faint p-2.5">
            {draft ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md border border-edge-soft bg-ink-850/70 p-2"
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="h-2.5 w-2.5 text-cyan-300" />
                  <span className="text-3xs uppercase tracking-[0.12em] text-mist-500">
                    {drafted ? 'Ready to send' : 'Draft from the new ticket'}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-mist-200">{draft}</p>
                <div className="mt-2 flex items-center gap-2">
                  {!drafted ? (
                    <GuideRing
                      active={guideOn && next === 'chat.compose_message'}
                      radius="rounded-md"
                    >
                      <button
                        onClick={draftMessage}
                        className="inline-flex h-6 items-center gap-1 rounded-md border border-edge bg-ink-800/70 px-2 text-2xs text-mist-200 transition hover:border-edge-strong"
                      >
                        Use this draft
                      </button>
                    </GuideRing>
                  ) : (
                    <GuideRing active={guideOn && next === 'chat.notify_team'} radius="rounded-md">
                      <button
                        onClick={sendMessage}
                        className="inline-flex h-6 items-center gap-1.5 rounded-md bg-teal-400 px-2.5 text-2xs font-semibold text-ink-950 transition hover:bg-teal-300"
                      >
                        <Send className="h-2.5 w-2.5" />
                        Send
                      </button>
                    </GuideRing>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="flex h-8 items-center rounded-md border border-dashed border-edge-faint px-2.5 text-xs text-mist-600">
                Message #{activeChannel}
              </div>
            )}
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}
