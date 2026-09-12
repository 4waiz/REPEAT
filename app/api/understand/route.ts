import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { MailMessage } from '@/types';
import { understandDeterministic } from '@/lib/agents/understanding';
import { understandLive, type LiveUnderstanding } from '@/lib/agents/understanding-live';
import { DEMO_MODE } from '@/lib/demo/config';

/**
 * Semantic understanding endpoint.
 *
 * Contract: this route ALWAYS returns a valid IssueUnderstanding. If Demo
 * Mode is on, or no key is configured, or a provider is slow, or the model
 * returns something malformed, it falls back to the deterministic classifier
 * and says so in `provenance`. There is no path where a model failure reaches
 * the UI as an error.
 *
 * Live mode runs two passes in parallel — the model via OpenRouter and the
 * research step via Exa. See lib/agents/understanding-live.ts.
 */

export const runtime = 'nodejs';

const RequestSchema = z.object({
  message: z.object({
    id: z.string(),
    from: z.string(),
    fromEmail: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
});

export async function POST(request: Request) {
  let parsed: z.infer<typeof RequestSchema>;
  try {
    parsed = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const message = {
    ...parsed.message,
    receivedAt: new Date().toISOString(),
    read: true,
    fixtureRef: 'api',
  } satisfies MailMessage;

  if (DEMO_MODE) {
    const demo: LiveUnderstanding = {
      understanding: understandDeterministic(message),
      provenance: {
        usedLlm: false,
        fallbackReason: 'Demo Mode is on: no external calls',
        usedResearch: false,
        referenceCount: 0,
        researchReason: 'Demo Mode is on: no external calls',
      },
    };
    return NextResponse.json(demo);
  }

  return NextResponse.json(await understandLive(message));
}
