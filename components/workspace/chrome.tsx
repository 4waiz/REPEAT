'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Application chrome for the surfaces REPEAT watches.
 *
 * Two of these windows show genuinely live data — Gmail over OAuth, ClickUp
 * over its REST API — so they wear those products' own dark themes rather
 * than a neutral skin. Recognising the tool at a glance is the point: the
 * audience should see the workflow happen in the apps they already use, not
 * in a dashboard describing it. Dark variants throughout, because the demo
 * runs on a dark stage and a white Gmail panel would blow the room out.
 */

export type BrandKey = 'gmail' | 'clickup' | 'slack';

type Brand = {
  label: string;
  /** Title-bar ground. */
  chrome: string;
  /** Body ground behind the surface. */
  surface: string;
  /** Hairline used for internal dividers. */
  border: string;
  /** The product's primary accent. */
  accent: string;
  mark: React.ReactNode;
};

/* Logos are redrawn as inline SVG so the demo renders with no network. */

const GmailMark = (
  <svg viewBox="0 0 48 36" aria-hidden className="h-full w-full">
    <path d="M3.5 35h7V18L1 10.2v21a3.8 3.8 0 0 0 3.5 3.8Z" fill="#4285f4" />
    <path d="M37.5 35h7A3.5 3.5 0 0 0 48 31.5v-21L37.5 18Z" fill="#34a853" />
    <path d="M37.5 4.5V18L48 10.2V6.2c0-3.5-4-5.5-6.8-3.4Z" fill="#fbbc04" />
    <path d="M10.5 18V4.5L24 14.6 37.5 4.5V18L24 28.1Z" fill="#ea4335" />
    <path d="M1 6.2v4l9.5 7.8V4.5L6.8 2.8C4 .7 1 2.7 1 6.2Z" fill="#c5221f" />
  </svg>
);

const ClickUpMark = (
  <svg viewBox="0 0 42 46" aria-hidden className="h-full w-full">
    <defs>
      <linearGradient id="cu-a" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#8930fd" />
        <stop offset="100%" stopColor="#49ccf9" />
      </linearGradient>
      <linearGradient id="cu-b" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ff02f0" />
        <stop offset="100%" stopColor="#ffc800" />
      </linearGradient>
    </defs>
    <path
      d="M0 35.2 7.4 29.5c3.9 5.1 8 7.5 13.6 7.5 5.5 0 9.5-2.3 13.2-7.4l7.5 5.5C36.5 42.4 30 46 21 46 12 46 5.4 42.5 0 35.2Z"
      fill="url(#cu-a)"
    />
    <path d="M20.9 12.6 7.8 24 1.7 16.9 21 0l19.2 16.9-6.1 7.1Z" fill="url(#cu-b)" />
  </svg>
);

const SlackMark = (
  <svg viewBox="0 0 48 48" aria-hidden className="h-full w-full">
    <path d="M10 30a5 5 0 1 1-5-5h5Zm2.5 0a5 5 0 0 1 10 0v12.5a5 5 0 0 1-10 0Z" fill="#e01e5a" />
    <path d="M17.5 10a5 5 0 1 1 5-5v5Zm0 2.5a5 5 0 0 1 0 10H5a5 5 0 0 1 0-10Z" fill="#36c5f0" />
    <path d="M38 17.5a5 5 0 1 1 5 5h-5Zm-2.5 0a5 5 0 0 1-10 0V5a5 5 0 0 1 10 0Z" fill="#2eb67d" />
    <path d="M30.5 38a5 5 0 1 1-5 5v-5Zm0-2.5a5 5 0 0 1 0-10H43a5 5 0 0 1 0 10Z" fill="#ecb22e" />
  </svg>
);

export const BRANDS: Record<BrandKey, Brand> = {
  gmail: {
    label: 'Gmail',
    chrome: '#1b1b1c',
    surface: '#131314',
    border: 'rgba(255,255,255,0.08)',
    accent: '#ea4335',
    mark: GmailMark,
  },
  clickup: {
    label: 'ClickUp',
    chrome: '#1c1b22',
    surface: '#141319',
    border: 'rgba(255,255,255,0.07)',
    accent: '#7b68ee',
    mark: ClickUpMark,
  },
  slack: {
    label: 'Slack',
    chrome: '#1a1d21',
    surface: '#101215',
    border: 'rgba(255,255,255,0.07)',
    accent: '#36c5f0',
    mark: SlackMark,
  },
};

export function WindowFrame({
  title,
  subtitle,
  icon,
  accent,
  brand,
  observed,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: string;
  /** Wear this product's identity: its logo, chrome and ground. */
  brand?: BrandKey;
  /** Shows the faint "REPEAT can see this" indicator. */
  observed?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const theme = brand ? BRANDS[brand] : null;

  return (
    <section
      className={cn('app-window', className)}
      style={theme ? { background: theme.surface } : undefined}
    >
      <header
        className="app-window-chrome"
        style={theme ? { background: theme.chrome, borderColor: theme.border } : undefined}
      >
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-white/[0.13]" />
          <span className="h-2 w-2 rounded-full bg-white/[0.13]" />
          <span className="h-2 w-2 rounded-full bg-white/[0.13]" />
        </div>
        <div className="ml-1.5 flex min-w-0 flex-1 items-center gap-2">
          {theme ? (
            <span className="h-3.5 w-3.5 shrink-0">{theme.mark}</span>
          ) : icon ? (
            <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5" style={{ color: accent }}>
              {icon}
            </span>
          ) : null}
          <span className="truncate text-xs font-medium text-mist-200">{title}</span>
          {subtitle ? (
            <span className="truncate text-2xs uppercase tracking-[0.12em] text-mist-600">
              {subtitle}
            </span>
          ) : null}
        </div>
        {observed ? (
          <span
            className="flex shrink-0 items-center gap-1 text-3xs uppercase tracking-[0.14em] text-mist-600"
            title="REPEAT observes the action type and workflow metadata in this app"
          >
            <span className="h-1 w-1 rounded-full bg-cyan-400/70" />
            observed
          </span>
        ) : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

/**
 * A stable per-person avatar colour, derived from the name so the same sender
 * keeps the same colour for the whole run. Gmail and Slack both do this.
 */
const AVATAR_TONES = ['#e5643f', '#3b7de0', '#2c9d6b', '#b44ac0', '#c7902a', '#d3455b', '#4a8fc9'];

export function avatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** Round (Gmail) or rounded-square (Slack) initial avatar. */
export function Avatar({
  name,
  size = 24,
  square,
  className,
}: {
  name: string;
  size?: number;
  square?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center font-semibold uppercase text-white',
        square ? 'rounded' : 'rounded-full',
        className,
      )}
      style={{
        width: size,
        height: size,
        background: avatarTone(name),
        fontSize: Math.max(9, Math.round(size * 0.42)),
      }}
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  );
}

/**
 * The next-step hint used while REPEAT is learning.
 *
 * Presentation scaffolding, not part of the product's intelligence: it keeps
 * a live demo on rails without REPEAT doing the work. It can be switched off.
 */
export function GuideRing({
  active,
  children,
  className,
  radius = 'rounded-lg',
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
  radius?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);

  // Bring the next control into view inside its scrolling panel. Without
  // this the composer's submit button can sit below the fold mid-demo.
  React.useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const t = window.setTimeout(
      () => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      120,
    );
    return () => window.clearTimeout(t);
  }, [active]);

  return (
    <span ref={ref} className={cn('relative inline-flex', className)}>
      {active ? (
        <motion.span
          className={cn('pointer-events-none absolute -inset-1 z-10 border border-cyan-400/60', radius)}
          animate={{ opacity: [0.35, 0.9, 0.35], scale: [0.99, 1.02, 0.99] }}
          transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}
      {children}
    </span>
  );
}

/** A field row inside the tracker composer. */
export function Field({
  label,
  children,
  filled,
}: {
  label: string;
  children: React.ReactNode;
  filled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[78px_1fr] items-start gap-2.5 py-1">
      <span
        className={cn(
          'pt-1 text-2xs uppercase tracking-[0.12em] transition-colors',
          filled ? 'text-mist-400' : 'text-mist-600',
        )}
      >
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
