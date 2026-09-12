'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { OrbState } from '@/types';
import { cn } from '@/lib/utils';

/**
 * The REPEAT orb — the product's agent presence.
 *
 * One ring, one core, six states. Everything is drawn rather than imported so
 * it scales anywhere and costs nothing to load. Motion is deliberately slow
 * everywhere except execution: a calm agent reads as one that is in control.
 */

export const ORB_PALETTE: Record<OrbState, { ring: string; core: string; halo: string }> = {
  idle: { ring: 'rgba(159,176,198,0.5)', core: '#9fb0c6', halo: 'rgba(159,176,198,0.22)' },
  learning: { ring: 'rgba(56,220,255,0.9)', core: '#38dcff', halo: 'rgba(56,220,255,0.4)' },
  pattern: { ring: 'rgba(127,233,255,1)', core: '#7fe9ff', halo: 'rgba(56,220,255,0.62)' },
  ghost: { ring: 'rgba(139,124,255,0.95)', core: '#b4a8ff', halo: 'rgba(139,124,255,0.5)' },
  executing: { ring: 'rgba(56,220,255,1)', core: '#7fe9ff', halo: 'rgba(56,220,255,0.55)' },
  success: { ring: 'rgba(45,212,167,1)', core: '#6ee7c2', halo: 'rgba(45,212,167,0.5)' },
  error: { ring: 'rgba(245,181,68,1)', core: '#fcd47c', halo: 'rgba(245,181,68,0.45)' },
};

export function Orb({
  state = 'idle',
  size = 34,
  className,
}: {
  state?: OrbState;
  size?: number;
  className?: string;
}) {
  const c = ORB_PALETTE[state];
  const r = 15;
  const circumference = 2 * Math.PI * r;

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* halo */}
      <motion.span
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: `0 0 ${state === 'idle' ? 10 : 20}px ${state === 'idle' ? 0 : 2}px ${c.halo}`,
          opacity: state === 'idle' ? 0.5 : 1,
        }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* expanding pulse rings */}
      <AnimatePresence>
        {(state === 'learning' || state === 'pattern' || state === 'success' || state === 'error') && (
          <>
            <motion.span
              key={`${state}-p1`}
              className="absolute inset-0 rounded-full border"
              style={{ borderColor: c.ring }}
              initial={{ scale: 0.7, opacity: 0.55 }}
              animate={{ scale: 1.55, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: state === 'pattern' ? 1.5 : 2.4,
                repeat: state === 'success' ? 2 : Infinity,
                ease: 'easeOut',
              }}
            />
            {state === 'pattern' ? (
              <motion.span
                key="p2"
                className="absolute inset-0 rounded-full border"
                style={{ borderColor: c.ring }}
                initial={{ scale: 0.7, opacity: 0.45 }}
                animate={{ scale: 1.55, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.55 }}
              />
            ) : null}
          </>
        )}
      </AnimatePresence>

      <svg viewBox="0 0 34 34" width={size} height={size} className="relative">
        {/* base ring */}
        <circle
          cx="17"
          cy="17"
          r={r}
          fill="none"
          stroke={c.ring}
          strokeWidth="1.25"
          opacity={state === 'idle' ? 0.45 : 0.32}
        />

        {/* executing: a fast flowing arc around the ring */}
        {state === 'executing' ? (
          <motion.circle
            cx="17"
            cy="17"
            r={r}
            fill="none"
            stroke={c.ring}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.3} ${circumference * 0.7}`}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.05, repeat: Infinity, ease: 'linear' }}
            style={{ originX: '17px', originY: '17px' }}
          />
        ) : null}

        {/* ghost: a slow orbiting satellite, the "planning" feel */}
        {state === 'ghost' ? (
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'linear' }}
            style={{ originX: '17px', originY: '17px' }}
          >
            <circle cx="17" cy={17 - r} r="2.1" fill={c.core} />
            <circle cx="17" cy={17 - r} r="4" fill={c.core} opacity="0.22" />
          </motion.g>
        ) : null}

        {/* pattern: a bright sweeping arc */}
        {state === 'pattern' ? (
          <motion.circle
            cx="17"
            cy="17"
            r={r}
            fill="none"
            stroke={c.ring}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.42} ${circumference * 0.58}`}
            animate={{ rotate: 360 }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
            style={{ originX: '17px', originY: '17px' }}
          />
        ) : null}

        {/* success: a completed ring */}
        {state === 'success' ? (
          <motion.circle
            cx="17"
            cy="17"
            r={r}
            fill="none"
            stroke={c.ring}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            transform="rotate(-90 17 17)"
          />
        ) : null}

        {/* learning: a gently breathing partial arc */}
        {state === 'learning' ? (
          <motion.circle
            cx="17"
            cy="17"
            r={r}
            fill="none"
            stroke={c.ring}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.22} ${circumference * 0.78}`}
            animate={{ rotate: 360 }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'linear' }}
            style={{ originX: '17px', originY: '17px' }}
          />
        ) : null}

        {/* error: a warning arc that pulses in place */}
        {state === 'error' ? (
          <motion.circle
            cx="17"
            cy="17"
            r={r}
            fill="none"
            stroke={c.ring}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.5} ${circumference * 0.5}`}
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            transform="rotate(-90 17 17)"
          />
        ) : null}

        {/* core.
            `r` needs a real starting value: animating an SVG attribute with
            no initial renders r="undefined" for the first frame, which the
            browser rejects — once per orb, per mount, which added up to
            hundreds of console errors. */}
        <motion.circle
          cx="17"
          cy="17"
          r={state === 'idle' ? 3.1 : 3.9}
          initial={{ r: state === 'idle' ? 3.1 : 3.9 }}
          animate={{
            r: state === 'idle' ? [3.1, 3.6, 3.1] : state === 'executing' ? [4, 4.8, 4] : [3.9, 4.5, 3.9],
            opacity: state === 'idle' ? [0.6, 0.95, 0.6] : [0.85, 1, 0.85],
          }}
          transition={{
            duration: state === 'executing' ? 0.75 : state === 'idle' ? 3.6 : 1.9,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          fill={c.core}
        />
      </svg>
    </span>
  );
}

/** The wordmark lockup used in headers and the landing hero. */
export function RepeatMark({
  state = 'idle',
  size = 'md',
  className,
}: {
  state?: OrbState;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const orbSize = size === 'lg' ? 44 : size === 'sm' ? 24 : 32;
  const text =
    size === 'lg'
      ? 'text-[1.6rem] tracking-[0.3em]'
      : size === 'sm'
        ? 'text-xs tracking-[0.24em]'
        : 'text-[0.95rem] tracking-[0.26em]';
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <Orb state={state} size={orbSize} />
      <span className={cn('font-semibold text-mist-50', text)}>REPEAT</span>
    </span>
  );
}
