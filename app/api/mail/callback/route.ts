import { NextResponse } from 'next/server';
import { DEMO_MODE } from '@/lib/demo/config';
import { exchangeCode, gmailOAuthConfig } from '@/lib/mail/gmail-oauth';

/**
 * Google sends the user back here with a code; it is exchanged for tokens
 * and the refresh token is kept locally. Then back to the workspace.
 */
export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (DEMO_MODE) {
    return NextResponse.json({ error: 'Demo Mode is on.' }, { status: 409 });
  }
  const config = gmailOAuthConfig();
  if (!config) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.' }, { status: 412 });
  }
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  if (error || !code) {
    return NextResponse.redirect(new URL(`/workspace?mail=error&reason=${encodeURIComponent(error ?? 'no code')}`, url.origin));
  }
  try {
    const token = await exchangeCode(config, code);
    return NextResponse.redirect(new URL(`/workspace?mail=connected&address=${encodeURIComponent(token.email ?? '')}`, url.origin));
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'exchange failed';
    return NextResponse.redirect(new URL(`/workspace?mail=error&reason=${encodeURIComponent(reason)}`, url.origin));
  }
}
