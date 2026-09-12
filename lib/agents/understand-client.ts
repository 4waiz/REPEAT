import type { MailMessage } from '@/types';
import type { LiveUnderstanding } from './understanding-live';

/**
 * Browser side of the live understanding step.
 *
 * Asks the server to read the report with the model and research it; the
 * keys never reach the browser. Resolves `null` on any failure — a slow
 * network, a 500, a malformed body — because the store already holds a
 * deterministic plan and must never be left waiting on the network.
 */

/**
 * The server answers within max(model, research) plus overhead, so this
 * only has to cover a stalled connection.
 */
export const CLIENT_UNDERSTAND_TIMEOUT_MS = 12_000;

export async function requestUnderstanding(message: MailMessage): Promise<LiveUnderstanding | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_UNDERSTAND_TIMEOUT_MS);

  try {
    const response = await fetch('/api/understand', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          id: message.id,
          from: message.from,
          fromEmail: message.fromEmail,
          subject: message.subject,
          body: message.body,
        },
      }),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as Partial<LiveUnderstanding>;
    if (!data.understanding || !data.provenance) return null;
    return data as LiveUnderstanding;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
