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

/** The ticket body REPEAT writes, identical in shape to the human's. */
export function composeIssueBody(u: IssueUnderstanding): string {
  return u.issueDescription;
}
