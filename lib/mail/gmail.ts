import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import type { MailMessage } from '@/types';

/**
 * Gmail connector — the real inbox, read over IMAP.
 *
 * Authentication is a Google app password (2-Step Verification on, then
 * myaccount.google.com/apppasswords). The Gmail REST API refuses API keys
 * for mailbox access by design, and OAuth needs a consent screen; an app
 * password is the fastest honest route for a demo account.
 *
 * Read-only. Messages are normalised into REPEAT's MailMessage shape with
 * the plain-text body, so the same understanding, planning and execution
 * path runs on a real email exactly as on a fixture. Server-only.
 */

export type GmailConfig = {
  address: string;
  appPassword: string;
  /** Optional Gmail search filter (X-GM-RAW), e.g. "label:support" or "to:support@acme.com". */
  query?: string;
};

export function gmailConfig(env: NodeJS.ProcessEnv = process.env): GmailConfig | null {
  const address = env.GMAIL_ADDRESS?.trim();
  const appPassword = env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  if (!address || !appPassword) return null;
  return { address, appPassword, query: env.GMAIL_QUERY?.trim() || undefined };
}

const BODY_LIMIT = 4000;

/** Plain text for the report: the text part, else the HTML with tags removed. */
function bodyText(text: string | undefined, html: string | false | undefined): string {
  const fromText = (text ?? '').trim();
  if (fromText) return fromText.slice(0, BODY_LIMIT);
  if (typeof html === 'string' && html) {
    return html
      .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, BODY_LIMIT);
  }
  return '';
}

/**
 * The most recent messages in INBOX, newest first. Opens and closes one
 * IMAP session per call; the route caches the result for a few seconds.
 */
export async function fetchRecentMail(
  config: GmailConfig,
  options: { limit?: number; sinceDays?: number } = {},
): Promise<MailMessage[]> {
  const limit = options.limit ?? 25;
  const since = new Date(Date.now() - (options.sinceDays ?? 14) * 86_400_000);

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: config.address, pass: config.appPassword },
    logger: false,
  });

  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  const messages: MailMessage[] = [];
  try {
    const criteria = config.query ? { since, gmraw: config.query } : { since };
    const uids = (await client.search(criteria, { uid: true })) || [];
    const wanted = uids.slice(-limit);
    if (wanted.length === 0) return [];

    for await (const item of client.fetch(wanted, { uid: true, flags: true, source: true }, { uid: true })) {
      const parsed = await simpleParser(item.source as Buffer);
      const sender = parsed.from?.value?.[0];
      const fromEmail = sender?.address ?? config.address;
      messages.push({
        id: `gmail_${item.uid}`,
        from: sender?.name?.trim() || fromEmail.split('@')[0],
        fromEmail,
        subject: (parsed.subject ?? '(no subject)').trim(),
        body: bodyText(parsed.text, parsed.html),
        receivedAt: (parsed.date ?? new Date()).toISOString(),
        read: item.flags?.has('\\Seen') ?? true,
        fixtureRef: 'gmail',
      });
    }
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }

  return messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}
