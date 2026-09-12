import { NextResponse } from 'next/server';
import { DEMO_MODE } from '@/lib/demo/config';
import { authorizationUrl, gmailOAuthConfig } from '@/lib/mail/gmail-oauth';

/**
 * "Connect Gmail": sends the user to Google's consent screen for the
 * read-only Gmail scope. Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 * and the redirect URI registered on that OAuth client.
 */
export const runtime = 'nodejs';

export async function GET() {
  if (DEMO_MODE) {
    return NextResponse.json({ error: 'Demo Mode is on. Gmail is not connected by design.' }, { status: 409 });
  }
  const config = gmailOAuthConfig();
  if (!config) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.' }, { status: 412 });
  }
  return NextResponse.redirect(authorizationUrl(config));
}
