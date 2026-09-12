import type { IssueCategory, IssueReference, MailMessage } from '@/types';
import { hostnameOf } from '@/lib/utils';

/**
 * Exa research client.
 *
 * When a report arrives, REPEAT looks for related public context — a docs
 * page, a similar issue, a status post — and attaches it to the ticket so the
 * owner does not start from a blank page. The human never did this step; it
 * is one of the things an agent can add without changing what it observed.
 *
 * Privacy rule, enforced here rather than promised: the only thing that
 * leaves the machine is the symptom. `buildResearchQuery` is built from the
 * subject line and the quoted error, and strips names and addresses. The
 * message body is never sent.
 */

export const EXA_SEARCH_URL = 'https://api.exa.ai/search';

export const DEFAULT_RESULT_COUNT = 3;

export class ExaError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ExaError';
    this.status = status;
  }
}

export function exaApiKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.EXA_API_KEY?.trim() || null;
}

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

/** A category is only a useful search hint when it names a symptom class. */
const CATEGORY_HINT: Record<IssueCategory, string | null> = {
  authentication: 'authentication error',
  performance: 'timeout',
  ui: 'layout bug',
  data: 'data issue',
  integration: 'integration failure',
  unknown: null,
};

/**
 * The symptom, and nothing else.
 *
 *   subject:  Login issue - can't access account
 *   body:     ... "Invalid credentials" ...
 *   query:    Login issue - can't access account "Invalid credentials" authentication error
 */
export function buildResearchQuery(
  message: Pick<MailMessage, 'subject' | 'body' | 'from'>,
  category: IssueCategory = 'unknown',
): string {
  let subject = message.subject
    .replace(/^\s*(re|fwd|fw)\s*:\s*/i, '')
    .replace(EMAIL_PATTERN, '')
    .trim();

  // The sender's name is identity, not symptom.
  const senderTokens = message.from.split(/\s+/).filter((t) => t.length > 2);
  for (const token of senderTokens) {
    subject = subject.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, 'gi'), '');
  }
  subject = subject.replace(/\s{2,}/g, ' ').trim();

  const parts = [subject];

  // A quoted error string or an HTTP status is the most searchable signal
  // in the report; take at most one, and never a full sentence.
  const quoted = message.body.match(/"([^"]{3,60})"/)?.[1];
  const status = message.body.match(/\b(50[0-9]|40[0-9])\b/)?.[1];
  if (quoted && !subject.toLowerCase().includes(quoted.toLowerCase())) parts.push(`"${quoted}"`);
  else if (status) parts.push(`HTTP ${status}`);

  const hint = CATEGORY_HINT[category];
  if (hint && !parts.join(' ').toLowerCase().includes(hint.split(' ')[0])) parts.push(hint);

  return parts.join(' ').replace(EMAIL_PATTERN, '').slice(0, 200).trim();
}

/**
 * One line of page text fit for a ticket. Some pages are served with the
 * wrong charset and arrive as mojibake ("â€™" for "’"); when that signature
 * is present the bytes are re-read as UTF-8, which restores the original.
 */
function clean(text: string): string {
  let out = text;
  if (/â€|Ã[-¿]/.test(out)) {
    const repaired = Buffer.from(out, 'latin1').toString('utf8');
    if (!repaired.includes('�')) out = repaired;
  }
  return out.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type ExaResult = {
  id?: string;
  url?: string;
  title?: string | null;
  publishedDate?: string | null;
  highlights?: string[];
  text?: string;
};

type ExaResponse = {
  requestId?: string;
  results?: ExaResult[];
  costDollars?: { total?: number };
  error?: string;
  message?: string;
};

export type ResearchResult = {
  references: IssueReference[];
  requestId?: string;
  latencyMs: number;
};

/** Search Exa for public pages related to a symptom query. */
export async function searchRelated(
  apiKey: string,
  input: { query: string; numResults?: number; timeoutMs: number },
): Promise<ResearchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  const started = Date.now();

  let response: Response;
  try {
    response = await fetch(EXA_SEARCH_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        query: input.query,
        type: 'auto',
        numResults: input.numResults ?? DEFAULT_RESULT_COUNT,
        // Highlights: the sentences on the page that best match the query.
        // Cheaper than full text and exactly what a ticket needs.
        contents: { highlights: { maxCharacters: 240, numSentences: 2, highlightsPerUrl: 1 } },
      }),
    });
  } catch (error) {
    if (controller.signal.aborted) throw new ExaError(`Exa timed out after ${input.timeoutMs}ms`);
    throw new ExaError(`Exa unreachable: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }

  let data: ExaResponse;
  try {
    data = (await response.json()) as ExaResponse;
  } catch {
    throw new ExaError(`Exa returned ${response.status} with a non-JSON body`, response.status);
  }

  if (!response.ok) {
    const detail = data.error ?? data.message;
    throw new ExaError(`Exa returned ${response.status}${detail ? `: ${detail}` : ''}`, response.status);
  }

  const seen = new Set<string>();
  const references: IssueReference[] = [];
  for (const r of data.results ?? []) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    const snippet = clean(r.highlights?.[0] ?? r.text ?? '').slice(0, 240);
    // Titles are page-authored: some are multi-line or carry a URL. One line,
    // ticket-length, or the hostname when there is nothing usable.
    const title = clean((r.title ?? '').replace(/https?:\/\/\S+/g, '')).slice(0, 120);
    references.push({
      title: title || hostnameOf(r.url),
      url: r.url,
      snippet,
      publishedAt: r.publishedDate ?? undefined,
    });
  }

  return {
    references,
    requestId: data.requestId,
    latencyMs: Date.now() - started,
  };
}
