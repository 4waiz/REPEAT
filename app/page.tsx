import Link from 'next/link';
import { ArrowRight, Eye, GitBranch, Sparkles } from 'lucide-react';
import { RepeatMark } from '@/components/repeat/Orb';
import { HeroFlow } from '@/components/repeat/HeroFlow';
import { Badge } from '@/components/ui/primitives';

/**
 * Landing hero.
 *
 * Deliberately small: one screen that states the idea and gets out of the
 * way. The product is the pitch, so every route out of here leads into it.
 */
export default function LandingPage() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-7 sm:px-10">
      <header className="flex items-center justify-between">
        <RepeatMark size="sm" />
        <nav className="flex items-center gap-1.5">
          <Link
            href="/workflows"
            className="rounded-lg px-3 py-1.5 text-xs text-mist-400 transition hover:bg-white/[0.05] hover:text-mist-100"
          >
            Workflows
          </Link>
          <Link
            href="/privacy"
            className="rounded-lg px-3 py-1.5 text-xs text-mist-400 transition hover:bg-white/[0.05] hover:text-mist-100"
          >
            Privacy
          </Link>
          <Link
            href="/workspace"
            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg bg-cyan-400 px-3.5 text-xs font-semibold text-ink-950 shadow-[0_0_24px_-8px_rgba(56,220,255,0.65)] transition hover:bg-cyan-300"
          >
            Open workspace
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </header>

      <div className="flex flex-1 flex-col justify-center py-14">
        <div className="max-w-3xl">
          <Badge tone="cyan" className="mb-6">
            <Sparkles className="h-2.5 w-2.5" />
            Behavior to Agent
          </Badge>

          <h1 className="text-balance text-[3.25rem] font-semibold leading-[0.98] tracking-[-0.03em] text-mist-50 sm:text-[4.25rem]">
            Show it once.
            <br />
            <span className="text-mist-400">Never do it again.</span>
          </h1>

          <p className="mt-7 max-w-xl text-[0.975rem] leading-relaxed text-mist-300">
            Automation normally starts by asking a human to document their workflow. REPEAT asks a
            different question:{' '}
            <span className="text-mist-100">what if the workflow documented itself?</span>
          </p>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist-500">
            REPEAT watches the semantic actions you already take across your tools, recognises when
            you have repeated yourself, generalises what it saw into a reusable agent, and then
            shows you exactly what it would do before it does anything.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/workspace"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-cyan-400 px-5 text-sm font-semibold text-ink-950 shadow-[0_0_28px_-8px_rgba(56,220,255,0.7)] transition hover:bg-cyan-300"
            >
              Start learning
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-edge bg-ink-800/60 px-5 text-sm text-mist-100 transition hover:border-edge-strong hover:bg-ink-700/70"
            >
              <Eye className="h-4 w-4 text-mist-400" />
              Watch the walkthrough
            </Link>
          </div>
        </div>

        <HeroFlow className="mt-16" />

        <div className="mt-14 grid gap-px overflow-hidden rounded-panel border border-edge-faint bg-edge-faint sm:grid-cols-3">
          {[
            {
              icon: <Eye className="h-4 w-4" />,
              title: 'Watch',
              body: 'Semantic actions, never coordinates. REPEAT records that you created a ticket, not where you clicked.',
            },
            {
              icon: <GitBranch className="h-4 w-4" />,
              title: 'Learn',
              body: 'Two similar passes are compared, scored, and compiled into a workflow with variables instead of memorized values.',
            },
            {
              icon: <Sparkles className="h-4 w-4" />,
              title: 'Automate',
              body: 'A Ghost Run shows the whole plan, its permissions and its risk. Nothing leaves your machine until you approve.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-ink-900/70 p-5">
              <div className="mb-3 text-cyan-400">{f.icon}</div>
              <div className="mb-1.5 text-sm font-medium text-mist-100">{f.title}</div>
              <p className="text-xs leading-relaxed text-mist-500">{f.body}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-edge-faint pt-5 text-xs text-mist-600">
        <span>Work flows. You move forward.</span>
        <span className="font-mono">TEAM KANBAN</span>
      </footer>
    </main>
  );
}
