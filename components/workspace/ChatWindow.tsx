'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Hash, Send, Sparkles } from 'lucide-react';
import { useRepeat, selectNextAction } from '@/lib/store/repeat-store';
import { CHAT_CHANNELS, START_CHANNEL } from '@/lib/demo/fixtures';
import { channelFor } from '@/lib/demo/team';
import { DEMO_MODE } from '@/lib/demo/config';
import { Avatar, GuideRing, WindowFrame } from './chrome';
import { Orb } from '@/components/repeat/Orb';
import { cn, formatClock } from '@/lib/utils';

/**
 * The team-chat surface, wearing Slack's dark theme.
 *
 * The last two human actions live here: drafting the notification and sending
 * it. Sending is what closes the trace, which is the moment the detector runs.
 *
 * Messages use Slack's flat layout — avatar, bold name, body, no bubbles — so
 * the one message REPEAT sends is visually obvious against the human ones.
 */

const SIDEBAR = '#1a1d21';
const ACTIVE = '#1164a3';
const LINE = 'rgba(255,255,255,0.07)';

export function ChatWindow() {
  const chat = useRepeat((s) => s.chat);
  const activeChannel = useRepeat((s) => s.activeChannel);
  const draft = useRepeat((s) => s.chatDraft);
  const guideOn = useRepeat((s) => s.settings.guideOn);
  const next = useRepeat(selectNextAction);
  const activeTrace = useRepeat((s) => s.activeTrace);
  const understanding = useRepeat((s) => s.understanding);

  // The desk this report belongs to; until it is classified there is none.
  const targetChannel = understanding ? channelFor(understanding.area) : START_CHANNEL;

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
      title="Slack"
      subtitle={`#${activeChannel} · outgoing`}
      brand="slack"
      observed
      className="min-w-0"
    >
      <div className="flex min-h-0 flex-1">
        {/* channel rail */}
        <div
          className="flex w-[34%] min-w-0 shrink-0 flex-col border-r"
          style={{ background: SIDEBAR, borderColor: LINE }}
        >
          <div
            className="flex shrink-0 items-center gap-1 border-b px-2.5 py-2"
            style={{ borderColor: LINE }}
          >
            <span className="truncate text-xs font-bold text-white">REPEAT Co.</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-mist-500" />
          </div>
          <div className="px-2.5 pb-1 pt-2 text-3xs font-semibold uppercase tracking-[0.08em] text-mist-500">
            Channels
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5">
            {CHAT_CHANNELS.map((c) => {
              const isActive = c.name === activeChannel;
              // Point at the desk this issue actually belongs to, not a fixed
              // channel — which desk that is only becomes known once the
              // report has been classified.
              const shouldGuide =
                guideOn && next === 'chat.open_channel' && c.name === targetChannel && !isActive;
              // Unread counts are Demo Mode's fiction; live mode shows none.
              const hasUnread = DEMO_MODE && c.unread > 0 && !isActive;
              return (
                <GuideRing key={c.name} active={shouldGuide} className="w-full" radius="rounded">
                  <button
                    onClick={() => openChannel(c.name)}
                    style={isActive ? { background: ACTIVE } : undefined}
                    className={cn(
                      'mb-px flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors',
                      isActive
                        ? 'text-white'
                        : hasUnread
                          ? 'font-bold text-white hover:bg-white/[0.06]'
                          : 'text-mist-400 hover:bg-white/[0.06]',
                    )}
                  >
                    <Hash className="h-3 w-3 shrink-0 opacity-70" />
                    <span className="truncate">{c.name}</span>
                    {hasUnread ? (
                      <span className="ml-auto shrink-0 rounded-full bg-[#e01e5a] px-1.5 text-3xs font-bold text-white">
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
          <div
            className="flex shrink-0 items-center gap-1 border-b px-3 py-2"
            style={{ borderColor: LINE }}
          >
            <Hash className="h-3 w-3 shrink-0 text-mist-400" />
            <span className="truncate text-xs font-bold text-white">{activeChannel}</span>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {/* This panel is send-only by design: the bot token carries
                chat:write and chat:write.public, and no read scope at all, so
                REPEAT genuinely cannot see the channel. Saying so is better
                than an empty channel that looks like it failed to load. */}
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-1.5 px-4 text-center">
                <Send className="h-4 w-4 text-mist-600" />
                <p className="text-xs text-mist-400">No notifications sent to this desk yet</p>
                <p className="max-w-[15rem] text-3xs leading-relaxed text-mist-600">
                  REPEAT posts here and does not read the channel. The team&apos;s own
                  conversation stays in Slack.
                </p>
              </div>
            ) : null}
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const fromRepeat = m.sentBy === 'repeat';
                return (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      'flex gap-2',
                      fromRepeat && '-mx-1.5 rounded border-l-2 border-cyan-400 bg-cyan-400/[0.06] px-1.5 py-1',
                    )}
                  >
                    {fromRepeat ? (
                      <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded bg-ink-800">
                        <Orb state="idle" size={12} />
                      </span>
                    ) : (
                      <Avatar name={m.author} size={20} square className="mt-px" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-bold text-white">{m.author}</span>
                        {fromRepeat ? (
                          <span className="rounded-sm bg-white/[0.09] px-1 text-3xs font-semibold uppercase tracking-[0.06em] text-cyan-300">
                            app
                          </span>
                        ) : null}
                        <span className="shrink-0 text-3xs text-mist-600">
                          {m.at ? formatClock(m.at) : ''}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-mist-200">{m.body}</p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* composer */}
          <div className="shrink-0 p-2.5">
            {draft ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-white/[0.14] bg-white/[0.03] p-2"
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
                    <GuideRing active={guideOn && next === 'chat.compose_message'} radius="rounded">
                      <button
                        onClick={draftMessage}
                        className="inline-flex h-6 items-center gap-1 rounded border border-white/15 bg-white/[0.06] px-2 text-2xs text-mist-200 transition hover:bg-white/[0.1]"
                      >
                        Use this draft
                      </button>
                    </GuideRing>
                  ) : (
                    <GuideRing active={guideOn && next === 'chat.notify_team'} radius="rounded">
                      <button
                        onClick={sendMessage}
                        className="inline-flex h-6 items-center gap-1.5 rounded bg-[#007a5a] px-2.5 text-2xs font-semibold text-white transition hover:bg-[#148567]"
                      >
                        <Send className="h-2.5 w-2.5" />
                        Send
                      </button>
                    </GuideRing>
                  )}
                </div>
              </motion.div>
            ) : (
              /* Not a composer: nothing here can be typed into, so it should
                 not look like Slack's input waiting for a message. */
              <div className="flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-white/[0.1] px-2.5 text-3xs text-mist-600">
                <Send className="h-2.5 w-2.5 shrink-0 opacity-70" />
                REPEAT posts to #{activeChannel}
              </div>
            )}
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}
