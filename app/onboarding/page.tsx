'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Hash, GitPullRequestArrow, Mail, Shield } from 'lucide-react';
import type { SourceApp } from '@/types';
import { useRepeat } from '@/lib/store/repeat-store';
import { RepeatMark } from '@/components/repeat/Orb';
import { Button } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * Onboarding.
 *
 * Two screens, no account, no tour. The product's whole argument is that you
 * should not have to explain your workflow, so the setup must not ask you to.
 */

const SOURCES: { app: SourceApp; label: string; detail: string; icon: typeof Mail }[] = [
  { app: 'mail', label: 'Email', detail: 'Inbound customer reports', icon: Mail },
  {
    app: 'tracker',
    label: 'Issue tracker',
    detail: 'Where engineering work is filed',
    icon: GitPullRequestArrow,
  },
  { app: 'chat', label: 'Team chat', detail: 'Where the team is told', icon: Hash },
];

export default function OnboardingPage() {
  const router = useRouter();
  const setSetting = useRepeat((s) => s.setSetting);
  const [step, setStep] = React.useState<0 | 1>(0);
  const [enabled, setEnabled] = React.useState<SourceApp[]>(['mail', 'tracker', 'chat']);

  const toggle = (app: SourceApp) =>
    setEnabled((cur) => (cur.includes(app) ? cur.filter((a) => a !== app) : [...cur, app]));

  const start = () => {
    const excluded = SOURCES.map((s) => s.app).filter((a) => !enabled.includes(a));
    setSetting('excludedApps', excluded);
    router.push('/workspace');
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-lg">
        {step === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <RepeatMark size="lg" className="mb-9 justify-center" />

            <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.03em] text-mist-50">
              Show it once.
              <br />
              <span className="text-mist-400">Never do it again.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-sm text-[0.875rem] leading-relaxed text-mist-400">
              REPEAT learns repetitive work by understanding how you already use your tools. You
              will not be asked to describe a workflow, build a trigger, or write a rule.
            </p>

            <Button variant="primary" size="lg" className="mt-9" onClick={() => setStep(1)}>
              Start learning
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <RepeatMark size="sm" className="mb-8" />

            <h2 className="text-lg font-semibold tracking-tight text-mist-50">
              Choose where REPEAT can observe
            </h2>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-mist-500">
              REPEAT records what an action meant — never coordinates, keystrokes, passwords or
              payment fields. You can pause it or forget a workflow at any time.
            </p>

            <div className="mt-6 space-y-2">
              {SOURCES.map((source) => {
                const on = enabled.includes(source.app);
                return (
                  <button
                    key={source.app}
                    onClick={() => toggle(source.app)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors',
                      on
                        ? 'border-cyan-400/30 bg-cyan-400/[0.07]'
                        : 'border-edge-faint hover:border-edge',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                        on
                          ? 'border-cyan-400/35 bg-cyan-400/12 text-cyan-300'
                          : 'border-edge-soft text-mist-500',
                      )}
                    >
                      <source.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8125rem] text-mist-100">{source.label}</span>
                      <span className="block text-xs text-mist-500">{source.detail}</span>
                    </span>
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                        on ? 'border-cyan-400 bg-cyan-400 text-ink-950' : 'border-edge',
                      )}
                    >
                      {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-center gap-2 rounded-lg border border-edge-faint px-3.5 py-2.5">
              <Shield className="h-3.5 w-3.5 shrink-0 text-mist-500" />
              <p className="text-xs text-mist-500">
                Privacy controls stay available in the product at any time.
              </p>
            </div>

            <div className="mt-7 flex items-center gap-2">
              <Button variant="ghost" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={start}
                disabled={enabled.length === 0}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            {enabled.length === 0 ? (
              <p className="mt-2 text-center text-xs text-amber-300">
                REPEAT needs at least one source to learn from.
              </p>
            ) : null}
          </motion.div>
        )}
      </div>
    </main>
  );
}
