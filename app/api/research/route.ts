import { NextResponse } from 'next/server';
import { z } from 'zod';
import { understandDeterministic } from '@/lib/agents/understanding';
import { RESEARCH_TIMEOUT_MS } from '@/lib/agents/understanding-live';
import { buildResearchQuery, exaApiKey, searchRelated } from '@/lib/research/exa';
import { DEMO_MODE } from '@/lib/demo/config';

/**
 * Research endpoint — the Exa step on its own.
 *
 * `/api/understand` already runs this in parallel with the model; this route
 * exists so the step can be exercised and inspected in isolation. It returns
 * the exact query that was sent, because that is the only thing that leaves
 * the machine.
 */

export const runtime = 'nodejs';

const RequestSchema = z.object({
  message: z.object({
    from: z.string().default(''),
    subject: z.string().min(1),
    body: z.string().default(''),
  }),
  numResults: z.number().int().min(1).max(5).optional(),
});

export async function POST(request: Request) {
  let parsed: z.infer<typeof RequestSchema>;
  try {
    parsed = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (DEMO_MODE) {
    return NextResponse.json(
      { error: 'Demo Mode is on. Research is disabled by design.' },
      { status: 409 },
    );
  }

  const apiKey = exaApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'EXA_API_KEY is required for research.' }, { status: 412 });
  }

  const message = {
    id: 'api',
    fromEmail: '',
    receivedAt: new Date().toISOString(),
    read: true,
    fixtureRef: 'api',
    ...parsed.message,
  };
  const query = buildResearchQuery(message, understandDeterministic(message).category);

  try {
    const result = await searchRelated(apiKey, {
      query,
      numResults: parsed.numResults,
      timeoutMs: RESEARCH_TIMEOUT_MS,
    });
    return NextResponse.json({ ok: true, query, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, query, error: error instanceof Error ? error.message : 'unknown' },
      { status: 502 },
    );
  }
}
