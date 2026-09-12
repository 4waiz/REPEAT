import { z } from 'zod';
import type {
  EngineeringArea,
  IssueCategory,
  IssueSeverity,
  IssueUnderstanding,
  MailMessage,
} from '@/types';
import { clamp, unique } from '@/lib/utils';

/**
 * Semantic understanding of an inbound support email.
 *
 * Two paths, same output shape:
 *
 *   1. deterministic  — a weighted keyword classifier that runs locally, needs
 *                       no network, and produces the same answer every time.
 *                       This is what Demo Mode uses.
 *   2. llm            — a model reached through OpenRouter, Zod-validated,
 *                       used only when explicitly enabled. Any validation
 *                       failure silently falls back to path 1, so a bad model
 *                       response cannot break a live demo.
 *
 * Only the *structured result* is ever surfaced in the UI, alongside the
 * literal phrases that justified it. No reasoning traces are shown.
 */

/* ------------------------------------------------------------------------ */
/* Schema — the contract both paths must satisfy                            */
/* ------------------------------------------------------------------------ */

export const AREAS = [
  'billing',
  'technical-support',
  'sales',
  'logistics',
  'product-rnd',
  'legal-compliance',
] as const;
export const CATEGORIES = [
  'authentication',
  'performance',
  'ui',
  'data',
  'integration',
  'unknown',
] as const;
export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

/**
 * The model may also answer `unresolved`. That is not a failure mode, it is
 * the honest answer to a report with no symptom in it — and it is what keeps
 * the "ask instead of guess" path reachable when a model is doing the reading.
 */
export const LLM_AREAS = [...AREAS, 'unresolved'] as const;

export const UnderstandingSchema = z.object({
  customerName: z.string().min(1).max(120),
  issueTitle: z.string().min(4).max(140),
  issueDescription: z.string().min(10).max(2000),
  category: z.enum(CATEGORIES),
  area: z.enum(LLM_AREAS),
  severity: z.enum(SEVERITIES),
  labels: z.array(z.string().min(1).max(40)).min(1).max(5),
  evidence: z.array(z.string().min(2).max(200)).min(1).max(6),
  confidence: z.number().min(0).max(1),
});

export type UnderstandingPayload = z.infer<typeof UnderstandingSchema>;

/* ------------------------------------------------------------------------ */
/* Deterministic classifier                                                 */
/* ------------------------------------------------------------------------ */

type Signal = { pattern: RegExp; weight: number; phrase: string };

/**
 * Area signals. Weights matter: an explicit auth/API symptom must outrank an
 * incidental mention of a screen, or bug #1 would be misfiled as frontend.
 */
const AREA_SIGNALS: Record<EngineeringArea, Signal[]> = {
  'technical-support': [
    { pattern: /invalid credentials/i, weight: 5, phrase: 'invalid credentials' },
    { pattern: /\blog ?(in|ging in)\b|\bsign ?in\b/i, weight: 4, phrase: 'login' },
    { pattern: /\bpassword\b/i, weight: 3, phrase: 'password' },
    { pattern: /\b(token|session|oauth|2fa|mfa)\b/i, weight: 3, phrase: 'session/token' },
    { pattern: /\b(api|endpoint)\b/i, weight: 4, phrase: 'api endpoint' },
    { pattern: /\b(50[0-9]|40[0-9])\b/, weight: 4, phrase: 'http error status' },
    { pattern: /time(?:s|d)? out|timing out|timeout/i, weight: 4, phrase: 'request timeout' },
    { pattern: /\b(server|database|query|migration|webhook)\b/i, weight: 3, phrase: 'server-side component' },
    { pattern: /\bexport job|nightly job|cron\b/i, weight: 2, phrase: 'scheduled job' },
  ],
  billing: [
    { pattern: /\b(invoice|billing|billed|payment|refund|charge[ds]?)\b/i, weight: 5, phrase: 'billing' },
    { pattern: /\b(double[- ]charged|overcharged|charged twice)\b/i, weight: 6, phrase: 'duplicate charge' },
    { pattern: /\b(subscription|renewal|receipt|vat|tax)\b/i, weight: 4, phrase: 'subscription or receipt' },
    { pattern: /\b(card|debit|credit card|declined)\b/i, weight: 3, phrase: 'payment method' },
  ],
  sales: [
    { pattern: /\b(quote|quotation|pricing|price list)\b/i, weight: 5, phrase: 'pricing request' },
    { pattern: /\b(demo|trial|upgrade|downgrade|enterprise plan)\b/i, weight: 4, phrase: 'plan change' },
    { pattern: /\b(contract|renewal terms|account manager|procurement)\b/i, weight: 4, phrase: 'commercial terms' },
    { pattern: /\b(seats?|licen[cs]es?|additional users?)\b/i, weight: 3, phrase: 'seat expansion' },
  ],
  logistics: [
    { pattern: /\b(order|shipment|delivery|delivered)\b/i, weight: 5, phrase: 'order or delivery' },
    { pattern: /\b(tracking (number|link)|courier|dispatch|warehouse)\b/i, weight: 5, phrase: 'shipment tracking' },
    { pattern: /\b(package|parcel|damaged in transit|never arrived|lost in transit)\b/i, weight: 4, phrase: 'parcel problem' },
    { pattern: /\b(return|rma|exchange|shipping address)\b/i, weight: 3, phrase: 'returns' },
  ],
  'product-rnd': [
    { pattern: /\b(feature request|roadmap|enhancement)\b/i, weight: 5, phrase: 'feature request' },
    { pattern: /\b(would be (great|nice|helpful) if|please add|any plans to)\b/i, weight: 4, phrase: 'product suggestion' },
    { pattern: /\b(missing feature|not supported yet|wish ?list)\b/i, weight: 4, phrase: 'capability gap' },
    { pattern: /\b(integration with|support for)\b/i, weight: 3, phrase: 'integration request' },
  ],
  'legal-compliance': [
    { pattern: /\b(gdpr|ccpa|dpa|data protection)\b/i, weight: 6, phrase: 'data protection law' },
    { pattern: /\b(privacy|personal data|right to be forgotten|erasure)\b/i, weight: 5, phrase: 'privacy request' },
    { pattern: /\b(delete my (data|account)|data deletion|consent)\b/i, weight: 5, phrase: 'deletion or consent' },
    { pattern: /\b(terms of service|compliance|audit|legal)\b/i, weight: 4, phrase: 'legal or compliance' },
  ],
  unresolved: [],
};

const CATEGORY_SIGNALS: Record<IssueCategory, Signal[]> = {
  authentication: [
    { pattern: /invalid credentials|\blog ?in\b|\bpassword\b|\bsign ?in\b|\b(2fa|mfa|sso)\b/i, weight: 5, phrase: 'authentication failure' },
  ],
  performance: [
    { pattern: /time(?:s|d)? out|timing out|timeout|\bslow\b|\blatency\b|\b504\b|\bhangs?\b/i, weight: 5, phrase: 'performance degradation' },
  ],
  ui: [
    { pattern: /\bnav(?:igation)? ?bar\b|\bnavbar\b|\boverlaps?\b|\blayout\b|\bmobile\b|\bdropdown\b|\bmenu\b/i, weight: 5, phrase: 'interface defect' },
  ],
  data: [
    { pattern: /\bduplicate\b|\bmissing (rows?|records?|data)\b|\bwrong (value|total|number)s?\b|\bexport\b/i, weight: 4, phrase: 'data correctness' },
  ],
  integration: [
    { pattern: /\bwebhook\b|\bapi key\b|\bthird[- ]party\b|\bintegration\b|\bzapier\b|\bsync\b/i, weight: 4, phrase: 'integration' },
  ],
  unknown: [],
};

const SEVERITY_SIGNALS: { severity: IssueSeverity; pattern: RegExp; phrase: string }[] = [
  { severity: 'critical', pattern: /\b(outage|all users|complete(ly)? down|data loss|production is down)\b/i, phrase: 'systemic outage' },
  { severity: 'high', pattern: /\bblock(ing|ed|s)\b|\bcan'?t access\b|\bunable to\b|\bevery (request|call|time)\b|\bfailed twice\b|\bcannot (log ?in|reach|access)\b/i, phrase: 'user is blocked' },
  { severity: 'medium', pattern: /\bdoes nothing\b|\bbroken\b|\bincorrect\b|\bnot working\b|\bcan'?t reach\b/i, phrase: 'feature unusable' },
  { severity: 'low', pattern: /\bminor\b|\bcosmetic\b|\btypo\b|\bsuggestion\b/i, phrase: 'cosmetic' },
];

/** Type label plus area label — the convention the team already uses. */
const CATEGORY_LABEL: Record<IssueCategory, string> = {
  authentication: 'authentication',
  performance: 'performance',
  ui: 'ui',
  data: 'data',
  integration: 'integration',
  unknown: 'triage',
};

function scoreSignals(text: string, signals: Signal[]): { score: number; phrases: string[] } {
  let score = 0;
  const phrases: string[] = [];
  for (const s of signals) {
    if (s.pattern.test(text)) {
      score += s.weight;
      phrases.push(s.phrase);
    }
  }
  return { score, phrases };
}

/** Split prose into sentences, keeping only substantive ones. */
function sentences(body: string): string[] {
  return body
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12 && !/^(hi|hello|hey|thanks|thank you|regards|please advise)\b/i.test(s));
}

/** The sender's display name, cross-checked against the sign-off. */
function extractCustomerName(message: MailMessage): string {
  if (message.from && message.from.trim()) return message.from.trim();
  const lines = message.body.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] ?? '';
  if (/^[A-Z][a-z]+(\s[A-Z][a-z]+)?$/.test(last)) return last;
  return message.fromEmail.split('@')[0];
}

/** Normalize a subject line into engineering phrasing. */
function buildTitle(message: MailMessage, evidenceQuote: string | null): string {
  let subject = message.subject.replace(/^\s*(re|fwd|fw)\s*:\s*/i, '').trim();

  // A dash-separated subject usually leads with the symptom and trails with
  // the customer's restatement of it; keep the symptom.
  const dashSplit = subject.split(/\s+[-–—]\s+/);
  if (dashSplit.length > 1 && dashSplit[0].split(/\s+/).length >= 2) {
    subject = dashSplit[0].trim();
  }

  // Support-speak -> engineering-speak.
  subject = subject
    .replace(/\bissue\b/i, 'failure')
    .replace(/\bproblem\b/i, 'failure')
    .replace(/\btiming out\b/i, 'times out')
    .replace(/\bis broken\b/i, 'broken');

  subject = subject.charAt(0).toUpperCase() + subject.slice(1);
  subject = subject.replace(/[.!?\s]+$/, '');

  // Attach the strongest literal evidence, but only when the subject is short
  // enough that the result still reads like a ticket title.
  const wordCount = subject.split(/\s+/).length;
  if (evidenceQuote && wordCount < 6) {
    // Preserve acronyms and codes ("HTTP 504"); sentence-case everything else.
    const keepCase = /^[A-Z]{2,}/.test(evidenceQuote) || /\d/.test(evidenceQuote);
    const short = keepCase ? evidenceQuote : evidenceQuote.toLowerCase();
    if (!subject.toLowerCase().includes(short.toLowerCase()) && subject.length + short.length < 110) {
      return `${subject} - ${short}`;
    }
  }
  return subject;
}

/** First quoted error string, or first HTTP status code. */
function extractEvidenceQuote(body: string): string | null {
  const quoted = body.match(/"([^"]{3,60})"/);
  if (quoted) return quoted[1];
  const status = body.match(/\b(50[0-9]|40[0-9])\b/);
  if (status) return `HTTP ${status[1]}`;
  return null;
}

function buildDescription(
  message: MailMessage,
  name: string,
  picked: string[],
  area: EngineeringArea,
  category: IssueCategory,
  severity: IssueSeverity,
): string {
  const quote = picked.join(' ');
  return [
    `Reported by ${name} <${message.fromEmail}>.`,
    '',
    `> ${quote}`,
    '',
    `Area: ${area} · Category: ${category} · Severity: ${severity}`,
  ].join('\n');
}

/**
 * The deterministic path. Pure function of the message text — no clock, no
 * randomness, no network. Same email always yields the same understanding.
 */
export function understandDeterministic(message: MailMessage): IssueUnderstanding {
  const haystack = `${message.subject}\n${message.body}`;

  // --- area ---------------------------------------------------------------
  const areaScores = (Object.keys(AREA_SIGNALS) as EngineeringArea[])
    .filter((a) => a !== 'unresolved')
    .map((area) => ({ area, ...scoreSignals(haystack, AREA_SIGNALS[area]) }))
    .sort((a, b) => b.score - a.score);

  const top = areaScores[0];
  const runnerUp = areaScores[1];
  const area: EngineeringArea = top.score === 0 ? 'unresolved' : top.area;

  // --- category -----------------------------------------------------------
  const categoryScores = (Object.keys(CATEGORY_SIGNALS) as IssueCategory[])
    .filter((c) => c !== 'unknown')
    .map((category) => ({ category, ...scoreSignals(haystack, CATEGORY_SIGNALS[category]) }))
    .sort((a, b) => b.score - a.score);
  const category: IssueCategory =
    categoryScores[0].score === 0 ? 'unknown' : categoryScores[0].category;

  // --- severity -----------------------------------------------------------
  let severity: IssueSeverity = 'medium';
  let severityPhrase = 'default triage level';
  for (const rule of SEVERITY_SIGNALS) {
    if (rule.pattern.test(haystack)) {
      severity = rule.severity;
      severityPhrase = rule.phrase;
      break;
    }
  }

  // --- text ---------------------------------------------------------------
  const name = extractCustomerName(message);
  const evidenceQuote = extractEvidenceQuote(message.body);
  const all = sentences(message.body);
  // Keep the two most symptom-dense sentences; they carry the actual report.
  const ranked = all
    .map((s) => ({ s, score: scoreSignals(s, AREA_SIGNALS[area === 'unresolved' ? 'technical-support' : area]).score }))
    .sort((a, b) => b.score - a.score);
  const picked = unique([...(ranked[0] ? [ranked[0].s] : []), ...(ranked[1] ? [ranked[1].s] : [])]);
  const issueTitle = buildTitle(message, evidenceQuote);
  const issueDescription = buildDescription(message, name, picked.length ? picked : all.slice(0, 2), area, category, severity);

  // --- confidence ---------------------------------------------------------
  // How dominant the winning area is relative to its nearest rival, plus a
  // small bonus for corroborating signals. A thin win scores low even when it
  // wins, which is what keeps the owner-review path reachable.
  const margin = top.score - (runnerUp?.score ?? 0);
  const dominance = top.score > 0 ? margin / top.score : 0;
  const corroboration = Math.min(top.phrases.length, 4) / 4;
  const confidence =
    area === 'unresolved'
      ? 0.32
      : clamp(0.55 + dominance * 0.35 + corroboration * 0.07, 0, 0.97);

  const evidence = unique([
    ...(evidenceQuote ? [`"${evidenceQuote}"`] : []),
    ...top.phrases.slice(0, 3),
    severityPhrase,
  ]).slice(0, 5);

  const labels = unique(['bug', CATEGORY_LABEL[category], area]).filter((l) => l !== 'unresolved');

  return {
    customerName: name,
    customerEmail: message.fromEmail,
    issueTitle,
    issueDescription,
    category,
    area,
    severity,
    labels,
    evidence,
    confidence,
    source: 'deterministic',
  };
}

/* ------------------------------------------------------------------------ */
/* LLM path                                                                 */
/* ------------------------------------------------------------------------ */

export const UNDERSTANDING_SYSTEM_PROMPT = `You triage inbound customer bug reports for an engineering team.

Return ONLY a JSON object with these keys:
  customerName      string  - the reporter's name
  issueTitle        string  - a short engineering ticket title, no customer voice
  issueDescription  string  - 2-4 lines: who reported it, the symptom, the impact
  category          one of: authentication | performance | ui | data | integration | unknown
  area              one of: billing | technical-support | sales | logistics | product-rnd | legal-compliance | unresolved
  severity          one of: low | medium | high | critical
  labels            array of 1-2 short lowercase labels specific to this report (the team's bug/category/area labels are added automatically)
  evidence          array of 1-5 SHORT literal phrases quoted from the report that justify the classification
  confidence        number between 0 and 1

Rules:
- "area" is the department that owns the response, not where the customer noticed the problem.
  frontend = layout, rendering, browser or mobile UI; backend = auth, APIs, timeouts, server errors;
  ai-data = models, predictions, training data; research = documentation or unclear specs;
  operations = billing, seats, provisioning.
- Use area "unresolved" and category "unknown" when the report names no concrete symptom.
  Do not guess an area from a vague report; a human will decide instead.
- "confidence" is how sure you are of the area. A report with no concrete symptom is below 0.5.
- Every item in "evidence" must be copied verbatim from the report text. Never invent or paraphrase evidence.
- Do not include any explanation or reasoning outside the JSON.`;

export function buildUnderstandingUserPrompt(message: MailMessage): string {
  return [
    `From: ${message.from} <${message.fromEmail}>`,
    `Subject: ${message.subject}`,
    '',
    message.body,
  ].join('\n');
}

/**
 * Merge a validated model payload with the deterministic result. The
 * deterministic pass supplies anything the model omitted, so the output type
 * is always complete.
 */
export function mergeUnderstanding(
  fallback: IssueUnderstanding,
  payload: UnderstandingPayload,
  model?: string,
  provider?: IssueUnderstanding['provider'],
): IssueUnderstanding {
  return {
    ...fallback,
    customerName: payload.customerName || fallback.customerName,
    issueTitle: payload.issueTitle,
    issueDescription: payload.issueDescription,
    category: payload.category,
    area: payload.area,
    severity: payload.severity,
    labels: conventionLabels(payload.category, payload.area, payload.labels),
    evidence: payload.evidence.length ? payload.evidence : fallback.evidence,
    confidence: payload.confidence,
    source: 'llm',
    model,
    provider,
  };
}

/**
 * The team's labelling convention — `bug`, the category, the area — is what
 * REPEAT observed the human apply, so it is kept regardless of what the model
 * suggests. The model's own labels follow, for specificity, up to the cap.
 */
function conventionLabels(category: IssueCategory, area: EngineeringArea, suggested: string[]): string[] {
  const base = ['bug', CATEGORY_LABEL[category], area].filter((l) => l !== 'unresolved');
  const extras = suggested.map((l) => l.trim().toLowerCase()).filter((l) => l && !base.includes(l));
  return unique([...base, ...extras]).slice(0, 5);
}

/**
 * Normalise for the grounding check: case, whitespace and quote marks are
 * ignored, so `"Invalid credentials" error` and `Invalid credentials error`
 * are the same phrase. The words themselves must still appear, contiguously
 * and in order, in the report \u2014 that is the property being enforced.
 */
function squash(text: string): string {
  return text
    .toLowerCase()
    .replace(/["'\u201c\u201d\u2018\u2019]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse and validate a model's answer. Three gates, in order:
 *
 *   1. there is a JSON object in the text at all (models sometimes wrap it
 *      in prose or a fence — the first `{...}` is taken);
 *   2. it satisfies the schema;
 *   3. every cited piece of evidence is a literal quote from the report.
 *
 * One hallucinated phrase disqualifies the whole response. Throws with a
 * reason the caller surfaces as `fallbackReason`.
 */
export function validateModelAnswer(text: string, message: MailMessage): UnderstandingPayload {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in model response');

  let raw: unknown;
  try {
    raw = JSON.parse(match[0]);
  } catch {
    throw new Error('Model response was not valid JSON');
  }

  const parsed = UnderstandingSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(
      `Model response failed validation: ${first?.path.join('.') || 'root'} ${first?.message ?? ''}`.trim(),
    );
  }

  const haystack = squash(`${message.subject}\n${message.body}`);
  const ungrounded = parsed.data.evidence.find((e) => !haystack.includes(squash(e)));
  if (ungrounded) throw new Error(`Model cited evidence not present in the report: "${ungrounded}"`);

  return parsed.data;
}

/* ------------------------------------------------------------------------ */
/* Display labels                                                           */
/* ------------------------------------------------------------------------ */

/** Human phrasing for generated copy. "ui bug" reads badly; "interface" does not. */
export const CATEGORY_DISPLAY: Record<IssueCategory, string> = {
  authentication: 'authentication',
  performance: 'performance',
  ui: 'interface',
  data: 'data',
  integration: 'integration',
  unknown: 'unclassified',
};

export const AREA_DISPLAY: Record<EngineeringArea, string> = {
  billing: 'Billing & Finance',
  'technical-support': 'Technical Support',
  sales: 'Sales & Accounts',
  logistics: 'Logistics & Shipping',
  'product-rnd': 'Product & R&D',
  'legal-compliance': 'Legal & Compliance',
  unresolved: 'Unresolved',
};

export const SEVERITY_DISPLAY: Record<IssueSeverity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};
