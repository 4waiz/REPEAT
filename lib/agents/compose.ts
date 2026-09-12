import type { IssueUnderstanding } from '@/types';
import { CATEGORY_DISPLAY } from './understanding';

/**
 * Deterministic content generation.
 *
 * Both the human's manual pass and REPEAT's execution produce notification
 * text through this one function, so the observed workflow and the automated
 * workflow are genuinely comparable rather than two different code paths.
 */

export const DEFAULT_CHANNEL = 'product-updates';

export function composeTeamMessage(input: {
  understanding: IssueUnderstanding;
  issueNumber: number;
  owner: string;
}): string {
  const { understanding: u, issueNumber, owner } = input;
  // An unclassified report gets no category word at all — "New new bug" is
  // worse than simply "New bug".
  const kind = u.category === 'unknown' ? '' : `${CATEGORY_DISPLAY[u.category]} `;
  const urgency = u.severity === 'critical' || u.severity === 'high' ? ` Priority: ${u.severity}.` : '';
  return `New ${kind}bug reported by ${u.customerName}. Issue #${issueNumber} created and assigned to ${owner}.${urgency}`;
}

/**
 * The ticket body REPEAT writes. Identical in shape to the human's, plus the
 * related context the research step found — the one thing an agent can add
 * to a ticket that the human never had time to. With no references (Demo
 * Mode, or a failed search) it is byte-for-byte the human's body.
 */
export function composeIssueBody(u: IssueUnderstanding): string {
  const references = u.references ?? [];
  if (references.length === 0) return u.issueDescription;
  return [
    u.issueDescription,
    '',
    'Related context (found by REPEAT via Exa):',
    ...references.map((r) => `- ${r.title} — ${r.url}`),
  ].join('\n');
}
