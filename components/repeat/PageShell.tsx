'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useRepeat } from '@/lib/store/repeat-store';
import { RepeatMark } from './Orb';
import { Dot } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * Shared shell for the secondary views. The workspace has its own chrome;
 * everything else hangs off this so navigation feels like one product.
 */

const NAV = [
  { href: '/workspace', label: 'Workspace' },
  { href: '/workflows', label: 'Workflows' },
  { href: '/activity', label: 'Activity' },
  { href: '/privacy', label: 'Privacy' },
];

export function PageShell({
  title,
  description,
  actions,
  children,
  back,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  back?: { href: string; label: string };
}) {
  const pathname = usePathname();
  const init = useRepeat((s) => s.init);
  const orb = useRepeat((s) => s.orb);
  const paused = useRepeat((s) => s.settings.observationPaused);

  React.useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-5 border-b border-edge-faint px-5">
        <Link href="/workspace">
          <RepeatMark state={orb} size="sm" />
        </Link>
        <nav className="flex items-center gap-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                  active
                    ? 'bg-white/[0.07] text-mist-50'
                    : 'text-mist-500 hover:bg-white/[0.04] hover:text-mist-200',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <span
          className="ml-auto flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.14em]"
          style={{ color: paused ? '#f5b544' : '#2dd4a7' }}
        >
          <Dot tone={paused ? 'amber' : 'teal'} pulse={!paused} />
          {paused ? 'Paused' : 'Active'}
        </span>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-7">
        {back ? (
          <Link
            href={back.href}
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-mist-500 transition-colors hover:text-mist-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {back.label}
          </Link>
        ) : null}

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-mist-50">{title}</h1>
            {description ? (
              <p className="mt-1.5 max-w-2xl text-[0.8125rem] leading-relaxed text-mist-500">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>

        {children}
      </main>
    </div>
  );
}
