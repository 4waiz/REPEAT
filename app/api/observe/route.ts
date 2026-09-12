import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Observation intake for the Chrome extension.
 *
 * The extension posts batches of semantic events here. This endpoint
 * re-validates and re-redacts everything it receives: the browser is not a
 * trusted source, so nothing is taken on faith just because the extension
 * claims to have already filtered it.
 *
 * Events are held in a small in-memory ring buffer. There is no database in
 * this prototype, which is stated plainly on the privacy page.
 */

export const runtime = 'nodejs';

const EventSchema = z.object({
  timestamp: z.string(),
  sourceApp: z.string().max(40),
  action: z.string().max(60),
  semanticIntent: z.string().max(200),
  pageContext: z
    .object({
      origin: z.string().max(200),
      path: z.string().max(200),
      title: z.string().max(200),
    })
    .optional(),
  structuredData: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1),
  origin: z.literal('observed'),
});

const BodySchema = z.object({ events: z.array(EventSchema).max(200) });

/** Second line of defence — the same deny-list the in-app normalizer uses. */
const REDACTED_KEY_PATTERN =
  /(password|passwd|secret|token|apikey|api_key|auth|otp|pin|cvv|card|iban|ssn)/i;

const BUFFER_LIMIT = 500;
const buffer: z.infer<typeof EventSchema>[] = [];

function scrub(event: z.infer<typeof EventSchema>) {
  const data = event.structuredData ?? {};
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_KEY_PATTERN.test(key)) continue;
    // Never retain long free text from a page, whatever the key is called.
    if (typeof value === 'string' && value.length > 200) continue;
    clean[key] = value;
  }
  // Query strings are dropped even if the extension sent one.
  const pageContext = event.pageContext
    ? { ...event.pageContext, path: event.pageContext.path.split('?')[0] }
    : undefined;
  return { ...event, structuredData: clean, pageContext };
}

export async function POST(request: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid event batch' }, { status: 400 });
  }

  for (const event of body.events) {
    buffer.push(scrub(event));
    if (buffer.length > BUFFER_LIMIT) buffer.shift();
  }

  return NextResponse.json({ accepted: body.events.length, buffered: buffer.length });
}

export async function GET() {
  return NextResponse.json({ events: buffer.slice(-100), buffered: buffer.length });
}

export async function DELETE() {
  buffer.length = 0;
  return NextResponse.json({ cleared: true });
}
