import type { EngineeringArea, IssueUnderstanding } from '@/types';
import { CATEGORY_DISPLAY } from './understanding';

/**
 * Deterministic content generation.
 *
 * Both the human's manual pass and REPEAT's execution produce notification
 * text through this one function, so the observed workflow and the automated
 * workflow are genuinely comparable rather than two different code paths.
 */

export const DEFAULT_CHANNEL = 'all-repeat-co';

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
/** The company REPEAT replies to customers as. */
export const COMPANY_NAME = 'REPEAT Company Limited';

/**
 * Which desk owns the work, in words a customer outside the company can
 * read. The routing table speaks in engineering areas; nobody who filed a
 * bug knows what "ai-data" means.
 */
export const AREA_DEPARTMENT: Record<EngineeringArea, string> = {
  billing: 'Billing & Finance',
  'technical-support': 'Technical Support',
  sales: 'Sales & Account Management',
  logistics: 'Logistics, Shipping & Fulfilment',
  'product-rnd': 'Product Development & Engineering',
  'legal-compliance': 'Legal, Privacy & Compliance',
  unresolved: 'Support Triage',
};

export function departmentFor(area: EngineeringArea): string {
  return AREA_DEPARTMENT[area] ?? AREA_DEPARTMENT.unresolved;
}

/**
 * The acknowledgement the customer gets back.
 *
 * Deliberately says only what is already true at send time — the ticket
 * exists, this desk owns it, this is its reference — and promises an update
 * rather than an outcome. Anything more would be REPEAT inventing a
 * commitment on the company's behalf.
 */
export function composeCustomerReply(input: {
  understanding: IssueUnderstanding;
  /** What the customer should quote back: a ClickUp key, or #<number>. */
  ticketRef: string;
  owner: string | null;
}): string {
  const { understanding: u, ticketRef, owner } = input;
  const department = departmentFor(u.area);
  // Mail display names arrive however the sender typed them ("muna ahmed"),
  // and a greeting is the one place that shows. Only the first letter is
  // touched: names with deliberate internal capitals (McBride, O'Neil) keep it.
  const rawFirst = u.customerName.split(/\s+/)[0] || u.customerName;
  const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1);

  const details = [
    `  Complaint number : ${ticketRef}`,
    `  Department       : ${department}`,
    ...(owner ? [`  Assigned to      : ${owner}`] : []),
    `  Priority         : ${u.severity}`,
  ].join('\n');

  return [
    `Hi ${firstName},`,
    '',
    `Thank you for getting in touch with ${COMPANY_NAME}. We are sorry for the trouble this caused, and we are glad you told us.`,
    '',
    'Your report has been logged and passed to the right team:',
    '',
    details,
    '',
    `Our ${department} team is looking into it now. We will email you on this same thread whenever the status changes, so there is nothing further you need to do — just keep an eye on your inbox.`,
    '',
    'Please quote the complaint number above if you would like to add anything in the meantime.',
    '',
    'Thanks again for helping us make the product better.',
    '',
    'Warm regards,',
    'Customer Support',
    COMPANY_NAME,
  ].join('\n');
}

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
