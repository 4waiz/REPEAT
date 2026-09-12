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
 * Events are held in a small in-memory ring buffer with a monotonic
 * sequence number, so the workspace can poll `GET ?since=<seq>` and feed
 * what the human really did — in the real Gmail, ClickUp or Jira tab — into
 * the same observe() path the replica apps use. There is no database in
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

/**
 * Keys that may carry a longer string: what the human wrote in a ticket is
 * workflow content, not page text. Everything else is capped short.
 */
const CONTENT_KEYS = new Set(['issueTitle', 'issueDescription', 'subject', 'teamMessage']);
const LONG_TEXT_LIMIT = 200;
const CONTENT_LIMIT = 2000;

const BUFFER_LIMIT = 500;

type StoredEvent = z.infer<typeof EventSchema> & { seq: number };

const buffer: StoredEvent[] = [];
// Time-based so a dev-server reload or restart never hands out a sequence
// number a poller has already passed; events are lost, never skipped.
let nextSeq = Date.now();

function scrub(event: z.infer<typeof EventSchema>): z.infer<typeof EventSchema> {
  const data = event.structuredData ?? {};
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_KEY_PATTERN.test(key)) continue;
    if (typeof value === 'string') {
      const limit = CONTENT_KEYS.has(key) ? CONTENT_LIMIT : LONG_TEXT_LIMIT;
      // Never retain long free text from a page, whatever the key is called.
      if (value.length > limit) continue;
    }
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
    buffer.push({ ...scrub(event), seq: nextSeq });
    nextSeq += 1;
    if (buffer.length > BUFFER_LIMIT) buffer.shift();
  }

  return NextResponse.json({ accepted: body.events.length, buffered: buffer.length, seq: nextSeq - 1 });
}

/**
 * `?since=<seq>` returns only what arrived after that sequence number, so a
 * poller never replays an observation. Without it: the last 100 events.
 */
export async function GET(request: Request) {
  const since = Number(new URL(request.url).searchParams.get('since') ?? NaN);
  const events = Number.isFinite(since) ? buffer.filter((e) => e.seq > since) : buffer.slice(-100);
  return NextResponse.json({ events, buffered: buffer.length, seq: nextSeq - 1 });
}

export async function DELETE() {
  buffer.length = 0;
  return NextResponse.json({ cleared: true, seq: nextSeq - 1 });
}
