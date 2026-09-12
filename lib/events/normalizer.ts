import type { EventOrigin, SemanticAction, SemanticEvent } from '@/types';
import { makeId } from '@/lib/utils';
import { specFor } from './taxonomy';

/**
 * Semantic Event Normalizer.
 *
 * Raw observations arrive as "something happened in an app". The normalizer's
 * job is to discard everything positional and keep only meaning plus a
 * normalized payload. Whatever survives here is the entire basis on which
 * REPEAT can later recognise a pattern.
 */

export type RawObservation = {
  action: SemanticAction;
  entityId?: string;
  /** Values the app knows about the thing that was acted on. */
  data?: Record<string, unknown>;
  origin?: EventOrigin;
  /** Override the clock (used by the deterministic demo director). */
  at?: Date;
};

/**
 * Keys that must never leave the observer. Anything matching is dropped
 * before an event is created — the privacy panel states this and this is the
 * code that enforces it.
 */
const REDACTED_KEY_PATTERN =
  /(password|passwd|secret|token|apikey|api_key|auth|otp|pin|cvv|card|iban|ssn)/i;

export function redactPayload(data: Record<string, unknown>): {
  clean: Record<string, unknown>;
  dropped: string[];
} {
  const clean: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (REDACTED_KEY_PATTERN.test(key)) {
      dropped.push(key);
      continue;
    }
    clean[key] = value;
  }
  return { clean, dropped };
}

export function normalize(raw: RawObservation, traceId: string): SemanticEvent {
  const spec = specFor(raw.action);
  const { clean } = redactPayload(raw.data ?? {});
  const at = raw.at ?? new Date();

  return {
    id: makeId('evt'),
    timestamp: at.toISOString(),
    sourceApp: spec.app,
    action: raw.action,
    entityType: spec.entityType,
    entityId: raw.entityId,
    semanticIntent: spec.intent,
    structuredData: clean,
    // Directly observed actions are certain; latent ones are named with less.
    confidence: spec.inferred ? 0.88 : 1,
    origin: raw.origin ?? 'observed',
    traceId,
    inferred: spec.inferred,
    effortSeconds: spec.effortSeconds,
  };
}

/**
 * Latent-step inference.
 *
 * A human never clicks "understand the issue" — but when unstructured email
 * prose becomes a structured title, labels and a priority, an understanding
 * step demonstrably happened in between. REPEAT names those steps rather than
 * pretending the workflow is only what was clicked. Inferred events are
 * marked and carry lower confidence, and the UI shows them as inferred.
 */
const INFERENCE_RULES: { before: SemanticAction; emit: SemanticAction[] }[] = [
  { before: 'tracker.open_composer', emit: ['issue.extract_details', 'issue.classify'] },
];

export function inferenceFor(action: SemanticAction): SemanticAction[] {
  return INFERENCE_RULES.find((r) => r.before === action)?.emit ?? [];
}
