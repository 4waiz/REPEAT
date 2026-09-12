'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ---------------------------------------------------------------------- */
/* Panel                                                                  */
/* ---------------------------------------------------------------------- */

export function Panel({
  className,
  children,
  flat,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { flat?: boolean }) {
  return (
    <div className={cn(flat ? 'panel-flat' : 'panel', 'surface-sheen', className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  icon,
  right,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="text-mist-500 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span> : null}
        <span className="eyebrow truncate">{title}</span>
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Button                                                                 */
/* ---------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'iris';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-cyan-400 text-ink-950 font-semibold hover:bg-cyan-300 shadow-[0_0_24px_-8px_rgba(56,220,255,0.65)]',
  iris: 'bg-iris-400 text-white font-semibold hover:bg-iris-300 shadow-[0_0_24px_-8px_rgba(139,124,255,0.7)]',
  outline:
    'border border-edge bg-ink-800/60 text-mist-100 hover:border-edge-strong hover:bg-ink-700/70',
  ghost: 'text-mist-300 hover:text-mist-50 hover:bg-white/[0.05]',
  danger: 'border border-rose-400/40 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs rounded-md gap-1.5',
  md: 'h-9 px-3.5 text-[0.8125rem] rounded-lg gap-2',
  lg: 'h-11 px-5 text-sm rounded-lg gap-2',
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
  }
>(function Button({ className, variant = 'outline', size = 'md', ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap transition-all duration-150 ease-swift',
        'active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
});

/* ---------------------------------------------------------------------- */
/* Badge                                                                  */
/* ---------------------------------------------------------------------- */

type Tone = 'neutral' | 'cyan' | 'iris' | 'teal' | 'amber' | 'rose';

const TONES: Record<Tone, string> = {
  neutral: 'border-edge-soft bg-white/[0.035] text-mist-300',
  cyan: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  iris: 'border-iris-400/30 bg-iris-400/10 text-iris-300',
  teal: 'border-teal-400/30 bg-teal-400/10 text-teal-300',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  rose: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
  mono,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium uppercase tracking-[0.1em]',
        mono && 'font-mono tracking-normal normal-case',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A small status dot, optionally pulsing. */
export function Dot({ tone = 'cyan', pulse }: { tone?: Tone; pulse?: boolean }) {
  const color =
    tone === 'teal'
      ? 'bg-teal-400'
      : tone === 'amber'
        ? 'bg-amber-400'
        : tone === 'rose'
          ? 'bg-rose-400'
          : tone === 'iris'
            ? 'bg-iris-400'
            : tone === 'neutral'
              ? 'bg-mist-500'
              : 'bg-cyan-400';
  return (
    <span className="relative inline-flex h-1.5 w-1.5 shrink-0">
      {pulse ? (
        <span className={cn('absolute inset-0 animate-pulse-ring rounded-full', color)} />
      ) : null}
      <span className={cn('relative h-1.5 w-1.5 rounded-full', color)} />
    </span>
  );
}

/* ---------------------------------------------------------------------- */
/* Confidence bar                                                         */
/* ---------------------------------------------------------------------- */

export function ConfidenceBar({
  value,
  tone = 'cyan',
  showBlocks = false,
  className,
}: {
  value: number;
  tone?: 'cyan' | 'iris' | 'teal';
  showBlocks?: boolean;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const fill =
    tone === 'iris'
      ? 'from-iris-500 to-iris-300'
      : tone === 'teal'
        ? 'from-teal-500 to-teal-300'
        : 'from-cyan-500 to-cyan-300';

  if (showBlocks) {
    // The "████████░░" rendering from the product language, as real blocks.
    const filled = Math.round(pct / 10);
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        <div className="flex gap-[3px]">
          {Array.from({ length: 10 }).map((_, i) => (
            <motion.span
              key={i}
              initial={false}
              animate={{
                opacity: i < filled ? 1 : 0.18,
                scaleY: i < filled ? 1 : 0.6,
              }}
              transition={{ duration: 0.28, delay: i * 0.02, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'h-3 w-[7px] rounded-[2px] bg-gradient-to-b',
                i < filled ? fill : 'from-white/20 to-white/20',
              )}
            />
          ))}
        </div>
        <span className="font-mono text-xs tabular-nums text-mist-200">{pct}%</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={cn('absolute inset-y-0 left-0 rounded-full bg-gradient-to-r', fill)}
        />
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-mist-200">
        {pct}%
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Stat                                                                   */
/* ---------------------------------------------------------------------- */

export function Stat({
  label,
  value,
  sub,
  tone,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: 'cyan' | 'teal' | 'iris' | 'amber';
  hint?: string;
}) {
  const valueColor =
    tone === 'teal'
      ? 'text-teal-300'
      : tone === 'iris'
        ? 'text-iris-300'
        : tone === 'amber'
          ? 'text-amber-300'
          : tone === 'cyan'
            ? 'text-cyan-300'
            : 'text-mist-50';
  return (
    <div className="group relative min-w-0">
      <div className="eyebrow mb-1.5 truncate">{label}</div>
      <div className={cn('stat-value', valueColor)}>{value}</div>
      {sub ? <div className="mt-1 truncate text-xs text-mist-500">{sub}</div> : null}
      {hint ? <Tooltip text={hint} /> : null}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Tooltip                                                                */
/* ---------------------------------------------------------------------- */

/** Hover-reveal explainer. Used to justify every derived metric. */
export function Tooltip({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={cn(
        'pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-max max-w-[19rem] whitespace-pre-line',
        'rounded-lg border border-edge bg-ink-800/95 px-2.5 py-2 text-xs leading-relaxed text-mist-200',
        'opacity-0 shadow-lift backdrop-blur-xl transition-opacity duration-150 group-hover:opacity-100',
        className,
      )}
    >
      {text}
    </span>
  );
}

/* ---------------------------------------------------------------------- */
/* Key hint                                                               */
/* ---------------------------------------------------------------------- */

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-edge-soft bg-white/[0.04] px-1 py-px font-mono text-[0.625rem] leading-4 text-mist-400">
      {children}
    </kbd>
  );
}

/* ---------------------------------------------------------------------- */
/* Empty state                                                            */
/* ---------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  detail,
}: {
  icon?: React.ReactNode;
  title: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon ? <div className="text-mist-600 [&>svg]:h-5 [&>svg]:w-5">{icon}</div> : null}
      <div className="text-[0.8125rem] text-mist-300">{title}</div>
      {detail ? <div className="max-w-xs text-xs leading-relaxed text-mist-500">{detail}</div> : null}
    </div>
  );
}
