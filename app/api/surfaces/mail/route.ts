import { NextResponse } from 'next/server';
import type { MailMessage } from '@/types';
import { DEMO_MODE } from '@/lib/demo/config';
import { fetchRecentMail, gmailConfig } from '@/lib/mail/gmail';
import { fetchRecentMailOAuth, gmailOAuthConfig, isConnected } from '@/lib/mail/gmail-oauth';

/**
 * The real inbox, read-only.
 *
 * In live mode the Mail window shows the connected Gmail account instead of
 * the replica inbox, and a new message there is what fires the trigger. The
 * workspace polls this every ~20 s; the result is cached briefly so a page
 * with several tabs cannot hit Gmail once a second.
 *
 * Two ways in, same output: an app password over IMAP, or an OAuth client
 * over the Gmail REST API (needsAuth=true until the user has clicked
 * Connect Gmail once).
 */

export const runtime = 'nodejs';

const CACHE_MS = 10_000;

let cache: { at: number; address: string | undefined; messages: MailMessage[] } | null = null;
let inflight: Promise<{ address: string | undefined; messages: MailMessage[] }> | null = null;

export async function GET() {
  if (DEMO_MODE) {
    return NextResponse.json({ error: 'Demo Mode is on. The real inbox is not read.' }, { status: 409 });
  }

  const imap = gmailConfig();
  const oauth = gmailOAuthConfig();
  if (!imap && !oauth) {
    return NextResponse.json({ provider: null, address: null, messages: [] });
  }
  if (!imap && oauth && !isConnected()) {
    return NextResponse.json({ provider: 'gmail', address: null, needsAuth: true, authUrl: '/api/mail/auth', messages: [] });
  }

  try {
    let result: { address: string | undefined; messages: MailMessage[] };
    if (cache && Date.now() - cache.at < CACHE_MS) {
      result = cache;
    } else {
      inflight ??= (imap
        ? fetchRecentMail(imap).then((messages) => ({ address: imap.address, messages }))
        : fetchRecentMailOAuth(oauth!)
      ).finally(() => {
        inflight = null;
      });
      result = await inflight;
      cache = { at: Date.now(), ...result };
    }
    return NextResponse.json({ provider: 'gmail', address: result.address ?? null, messages: result.messages });
  } catch (error) {
    return NextResponse.json(
      {
        provider: 'gmail',
        address: cache?.address ?? null,
        messages: cache?.messages ?? [],
        error: error instanceof Error ? error.message : 'Gmail unreachable',
      },
      { status: cache ? 200 : 502 },
    );
  }
}
