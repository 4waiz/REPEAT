import { NextResponse } from 'next/server';
import type { MailMessage } from '@/types';
import { DEMO_MODE } from '@/lib/demo/config';
import { fetchRecentMail, gmailConfig } from '@/lib/mail/gmail';

/**
 * The real inbox, read-only.
 *
 * In live mode the Mail window shows the connected Gmail account instead of
 * the replica inbox, and a new message there is what fires the trigger. The
 * workspace polls this every ~20 s; the result is cached briefly so a page
 * with several tabs cannot open an IMAP session per second.
 */

export const runtime = 'nodejs';

const CACHE_MS = 10_000;

let cache: { at: number; messages: MailMessage[] } | null = null;
let inflight: Promise<MailMessage[]> | null = null;

export async function GET() {
  if (DEMO_MODE) {
    return NextResponse.json({ error: 'Demo Mode is on. The real inbox is not read.' }, { status: 409 });
  }
  const config = gmailConfig();
  if (!config) {
    return NextResponse.json({ provider: null, address: null, messages: [] });
  }

  try {
    let messages: MailMessage[];
    if (cache && Date.now() - cache.at < CACHE_MS) {
      messages = cache.messages;
    } else {
      inflight ??= fetchRecentMail(config).finally(() => {
        inflight = null;
      });
      messages = await inflight;
      cache = { at: Date.now(), messages };
    }
    return NextResponse.json({ provider: 'gmail', address: config.address, messages });
  } catch (error) {
    return NextResponse.json(
      {
        provider: 'gmail',
        address: config.address,
        messages: cache?.messages ?? [],
        error: error instanceof Error ? error.message : 'Gmail unreachable',
      },
      { status: cache ? 200 : 502 },
    );
  }
}
