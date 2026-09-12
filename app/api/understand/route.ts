import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { MailMessage } from '@/types';
import {
  UNDERSTANDING_SYSTEM_PROMPT,
  UnderstandingSchema,
  buildUnderstandingUserPrompt,
  mergeUnderstanding,
  understandDeterministic,
} from '@/lib/agents/understanding';
import { DEMO_MODE } from '@/lib/demo/config';

/**
 * Semantic understanding endpoint.
 *
 * Contract: this route ALWAYS returns a valid IssueUnderstanding. If Demo
 * Mode is on, or no key is configured, or the model is slow, or the model
 * returns something malformed, it falls back to the deterministic classifier
 * and says so in `source`. There is no path where a model failure reaches the
 * UI as an error.
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

/** Hard ceiling so a hanging model call cannot stall a live demo. */
const LLM_TIMEOUT_MS = 6000;

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

  // The deterministic result is computed first, unconditionally. It is both
  // the answer in Demo Mode and the fallback everywhere else.
  const deterministic = understandDeterministic(message);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (DEMO_MODE || !apiKey) {
    return NextResponse.json({ understanding: deterministic, usedLlm: false });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',
        max_tokens: 1024,
        system: UNDERSTANDING_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUnderstandingUserPrompt(message) }],
      }),
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) throw new Error(`Model returned ${response.status}`);

    const data = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === 'text')?.text ?? '';

    // Models sometimes wrap JSON in prose or a fence; take the first object.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object in model response');

    // Zod is the gate: anything that does not satisfy the contract is refused.
    const payload = UnderstandingSchema.parse(JSON.parse(match[0]));

    // Evidence must be quoted from the source, not invented. Any hallucinated
    // phrase disqualifies the whole response.
    const haystack = `${message.subject}\n${message.body}`.toLowerCase();
    const grounded = payload.evidence.every((e) =>
      haystack.includes(e.toLowerCase().replace(/^["']|["']$/g, '')),
    );
    if (!grounded) throw new Error('Model cited evidence not present in the report');

    return NextResponse.json({
      understanding: mergeUnderstanding(deterministic, payload),
      usedLlm: true,
    });
  } catch (error) {
    // Never surface a model failure as an error to the UI.
    return NextResponse.json({
      understanding: deterministic,
      usedLlm: false,
      fallbackReason: error instanceof Error ? error.message : 'unknown',
    });
  }
}
