'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Ghost,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  Workflow,
} from 'lucide-react';
import { useRepeat } from '@/lib/store/repeat-store';
import { Kbd } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * Command palette.
 *
 * The keyboard route to everything a presenter needs mid-demo, so no mouse
 * hunting on stage.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [index, setIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const phase = useRepeat((s) => s.phase);
  const patterns = useRepeat((s) => s.patterns);
  const paused = useRepeat((s) => s.settings.observationPaused);
  const setSetting = useRepeat((s) => s.setSetting);
  const reset = useRepeat((s) => s.reset);
  const openGhostRun = useRepeat((s) => s.openGhostRun);
  const forgetPattern = useRepeat((s) => s.forgetPattern);
  const deliverNextBug = useRepeat((s) => s.deliverNextBug);

  const commands = React.useMemo(
    () =>
      [
        {
          id: 'workflows',
          label: 'Open workflows',
          hint: 'Learned agents',
          icon: Workflow,
          run: () => router.push('/workflows'),
        },
        {
          id: 'ghost',
          label: 'Open Ghost Run',
          hint: phase === 'trigger_detected' ? 'ready' : 'needs a planned run',
          icon: Ghost,
          run: openGhostRun,
          disabled: !['trigger_detected', 'ghost_run'].includes(phase),
        },
        {
          id: 'next-bug',
          label: 'Send next bug report',
          hint: 'Deliver the next fixture',
          icon: PlayCircle,
          run: deliverNextBug,
        },
        {
          id: 'pause',
          label: paused ? 'Resume observation' : 'Pause observation',
          hint: 'REPEAT stops recording entirely',
          icon: PauseCircle,
          run: () => setSetting('observationPaused', !paused),
        },
        {
          id: 'privacy',
          label: 'Privacy and permissions',
          hint: 'What REPEAT can and cannot see',
          icon: Shield,
          run: () => router.push('/privacy'),
        },
        {
          id: 'forget',
          label: 'Forget this workflow',
          hint: 'Delete observations and the compiled pattern',
          icon: Trash2,
          run: () => patterns[0] && forgetPattern(patterns[0].id),
          disabled: patterns.length === 0,
        },
        {
          id: 'reset',
          label: 'Reset demo',
          hint: 'Return to the opening state',
          icon: RotateCcw,
          run: reset,
        },
      ].filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
    [
      query,
      phase,
      paused,
      patterns,
      router,
      openGhostRun,
      deliverNextBug,
      setSetting,
      forgetPattern,
      reset,
    ],
  );

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      // Focus after the entry animation so the caret does not jump.
      const t = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, commands.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = commands[index];
        if (cmd && !cmd.disabled) {
          cmd.run();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, commands, index, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[70] flex items-start justify-center bg-ink-950/70 pt-[14vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-panel border border-edge bg-ink-850/95 shadow-lift backdrop-blur-2xl"
          >
            <div className="flex items-center gap-2.5 border-b border-edge-faint px-3.5 py-3">
              <Search className="h-4 w-4 shrink-0 text-mist-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIndex(0);
                }}
                placeholder="Search commands"
                className="min-w-0 flex-1 bg-transparent text-sm text-mist-100 placeholder:text-mist-600 focus:outline-none"
              />
              <Kbd>esc</Kbd>
            </div>

            <div className="max-h-80 overflow-y-auto p-1.5">
              {commands.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-mist-600">No commands</div>
              ) : (
                commands.map((cmd, i) => (
                  <button
                    key={cmd.id}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => {
                      if (cmd.disabled) return;
                      cmd.run();
                      onClose();
                    }}
                    disabled={cmd.disabled}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                      i === index && !cmd.disabled ? 'bg-white/[0.06]' : '',
                      cmd.disabled ? 'cursor-not-allowed opacity-35' : '',
                    )}
                  >
                    <cmd.icon className="h-3.5 w-3.5 shrink-0 text-mist-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] text-mist-100">
                        {cmd.label}
                      </span>
                      <span className="block truncate text-3xs text-mist-600">{cmd.hint}</span>
                    </span>
                    {i === index && !cmd.disabled ? <Kbd>↵</Kbd> : null}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
