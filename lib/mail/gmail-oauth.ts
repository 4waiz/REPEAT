import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { MailMessage } from '@/types';

/**
 * Gmail over the REST API with OAuth 2.0 — the path Google prefers.
 *
 * A Web-application OAuth client (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)
 * plus one consent click: /api/mail/auth sends the user to Google,
 * /api/mail/callback exchanges the code and keeps the refresh token in
 * .repeat/gmail-token.json (gitignored). From then on the inbox is read
 * with the gmail.readonly scope only. Nothing is ever sent or modified.
 *
 * Plain fetch throughout; no client library needed for three endpoints.
 */

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export type GmailOAuthConfig = { clientId: string; clientSecret: string; redirectUri: string; query?: string };

export function gmailOAuthConfig(env: NodeJS.ProcessEnv = process.env): GmailOAuthConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: env.GOOGLE_REDIRECT_URI?.trim() || 'http://localhost:3000/api/mail/callback',
    query: env.GMAIL_QUERY?.trim() || undefined,
  };
}

/* ------------------------------------------------------------------------ */
/* Token storage — a local file, never the repo                             */
/* ------------------------------------------------------------------------ */

type StoredToken = { refreshToken: string; accessToken?: string; expiresAt?: number; email?: string };

const TOKEN_DIR = path.join(process.cwd(), '.repeat');
const TOKEN_FILE = path.join(TOKEN_DIR, 'gmail-token.json');

let memory: StoredToken | null = null;

export function readToken(): StoredToken | null {
  if (memory) return memory;
  try {
    memory = JSON.parse(readFileSync(TOKEN_FILE, 'utf8')) as StoredToken;
    return memory;
  } catch {
    return null;
  }
}

function writeToken(token: StoredToken) {
  memory = token;
  mkdirSync(TOKEN_DIR, { recursive: true });
  writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2));
}

export function isConnected(): boolean {
  return Boolean(readToken()?.refreshToken);
}

/* ------------------------------------------------------------------------ */
/* OAuth                                                                    */
/* ------------------------------------------------------------------------ */

export function authorizationUrl(config: GmailOAuthConfig): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline',
    // Always returns a refresh token, even on re-consent.
    prompt: 'consent',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(config: GmailOAuthConfig, code: string): Promise<StoredToken> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !data.access_token) {
    throw new Error(`Google refused the code exchange: ${data.error ?? response.status} ${data.error_description ?? ''}`.trim());
  }
  const existing = readToken();
  const token: StoredToken = {
    refreshToken: data.refresh_token ?? existing?.refreshToken ?? '',
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
  };
  if (!token.refreshToken) throw new Error('Google did not return a refresh token; revoke the app at myaccount.google.com/permissions and connect again.');

  token.email = await profileEmail(token.accessToken!);
  writeToken(token);
  return token;
}

async function accessToken(config: GmailOAuthConfig): Promise<string> {
  const token = readToken();
  if (!token?.refreshToken) throw new Error('Gmail is not connected yet. Open /api/mail/auth.');
  if (token.accessToken && token.expiresAt && token.expiresAt > Date.now()) return token.accessToken;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: token.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const data = (await response.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(`Google refused the token refresh: ${data.error ?? response.status} ${data.error_description ?? ''}`.trim());
  }
  writeToken({
    ...token,
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
  });
  return data.access_token;
}

async function profileEmail(bearer: string): Promise<string | undefined> {
  const response = await fetch(`${API}/profile`, { headers: { authorization: `Bearer ${bearer}` } });
  if (!response.ok) return undefined;
  const data = (await response.json()) as { emailAddress?: string };
  return data.emailAddress;
}

/* ------------------------------------------------------------------------ */
/* Reading                                                                  */
/* ------------------------------------------------------------------------ */

type GmailPart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
  headers?: { name: string; value: string }[];
};

type GmailMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: GmailPart;
};

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/** The first text/plain part, else the first text/html part with tags removed. */
function extractBody(payload: GmailPart | undefined): string {
  if (!payload) return '';
  const plain: string[] = [];
  const html: string[] = [];
  const walk = (part: GmailPart) => {
    const data = part.body?.data;
    if (data && part.mimeType === 'text/plain') plain.push(decodeBase64Url(data));
    else if (data && part.mimeType === 'text/html') html.push(decodeBase64Url(data));
    for (const child of part.parts ?? []) walk(child);
  };
  walk(payload);
  if (plain.length) return plain.join('\n').trim().slice(0, 4000);
  if (html.length) {
    return html
      .join('\n')
      .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 4000);
  }
  return '';
}

function header(payload: GmailPart | undefined, name: string): string {
  return payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function parseFrom(value: string): { name: string; email: string } {
  const match = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim() || match[2].split('@')[0], email: match[2].trim() };
  const email = value.trim();
  return { name: email.split('@')[0], email };
}

export async function fetchRecentMailOAuth(
  config: GmailOAuthConfig,
  options: { limit?: number } = {},
): Promise<{ address: string | undefined; messages: MailMessage[] }> {
  const bearer = await accessToken(config);
  const headers = { authorization: `Bearer ${bearer}` };
  const limit = options.limit ?? 25;

  const params = new URLSearchParams({ maxResults: String(limit), labelIds: 'INBOX' });
  if (config.query) params.set('q', config.query);
  const list = await fetch(`${API}/messages?${params.toString()}`, { headers });
  if (!list.ok) throw new Error(`Gmail refused the message list (${list.status})`);
  const ids = ((await list.json()) as { messages?: { id: string }[] }).messages ?? [];

  const messages: MailMessage[] = [];
  for (const { id } of ids) {
    const response = await fetch(`${API}/messages/${id}?format=full`, { headers });
    if (!response.ok) continue;
    const message = (await response.json()) as GmailMessage;
    const from = parseFrom(header(message.payload, 'From'));
    messages.push({
      id: `gmail_${message.id}`,
      from: from.name,
      fromEmail: from.email,
      subject: header(message.payload, 'Subject') || '(no subject)',
      body: extractBody(message.payload),
      receivedAt: new Date(Number(message.internalDate ?? Date.now())).toISOString(),
      read: !(message.labelIds ?? []).includes('UNREAD'),
      fixtureRef: 'gmail',
    });
  }

  return {
    address: readToken()?.email,
    messages: messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
  };
}
