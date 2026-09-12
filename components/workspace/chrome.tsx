'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Replica application chrome.
 *
 * These are recognisable productivity environments, not clones of any
 * specific product: a mail client, an issue tracker, a team chat. They exist
 * so the audience can see the workflow happen in place rather than in a
 * dashboard that describes it.
 */

export function WindowFrame({
  title,
  subtitle,
  icon,
  accent,
  observed,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: string;
  /** Shows the faint "REPEAT can see this" indicator. */
  observed?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('app-window', className)}>
      <header className="app-window-chrome">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-white/[0.13]" />
          <span className="h-2 w-2 rounded-full bg-white/[0.13]" />
          <span className="h-2 w-2 rounded-full bg-white/[0.13]" />
        </div>
        <div className="ml-1.5 flex min-w-0 flex-1 items-center gap-2">
          {icon ? (
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

/** A field row inside the replica tracker composer. */
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
