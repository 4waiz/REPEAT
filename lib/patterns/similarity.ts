import type { SemanticEvent, SourceApp } from '@/types';
import { jaccard, unique } from '@/lib/utils';

/**
 * Trace similarity.
 *
 * Three independent signals, combined with fixed weights. No model is trained
 * and no LLM is required — this is deterministic, inspectable, and every
 * number it produces is shown to the user in the pattern evidence panel.
 */

export const SIMILARITY_WEIGHTS = {
  sequence: 0.55,
  apps: 0.2,
  intent: 0.25,
} as const;

/**
 * Normalized Levenshtein similarity over the ordered action verbs. This is
 * what makes REPEAT tolerant of a human doing the steps slightly differently
 * the second time — one extra click does not destroy the match.
 */
export function sequenceSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) d[i][0] = i;
  for (let j = 0; j < cols; j += 1) d[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  const distance = d[a.length][b.length];
  return 1 - distance / Math.max(a.length, b.length);
}

/** Jaccard overlap of the applications involved. */
export function appSimilarity(a: SemanticEvent[], b: SemanticEvent[]): number {
  return jaccard(
    a.map((e) => e.sourceApp),
    b.map((e) => e.sourceApp),
  );
}

/**
 * Bag-of-words cosine similarity over the semantic intent strings. Catches
 * the case where two traces use different verbs for the same meaning.
 */
export function intentSimilarity(a: SemanticEvent[], b: SemanticEvent[]): number {
  const bag = (events: SemanticEvent[]) => {
    const counts = new Map<string, number>();
    for (const e of events) {
      for (const token of e.semanticIntent.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
    return counts;
  };
  const ba = bag(a);
  const bb = bag(b);
  const keys = unique([...ba.keys(), ...bb.keys()]);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const k of keys) {
    const va = ba.get(k) ?? 0;
    const vb = bb.get(k) ?? 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type TraceComparison = {
  sequence: number;
  apps: number;
  intent: number;
  overall: number;
  sharedApps: SourceApp[];
};

export function compareTraces(a: SemanticEvent[], b: SemanticEvent[]): TraceComparison {
  const sequence = sequenceSimilarity(
    a.map((e) => e.action),
    b.map((e) => e.action),
  );
  const apps = appSimilarity(a, b);
  const intent = intentSimilarity(a, b);
  const overall =
    sequence * SIMILARITY_WEIGHTS.sequence +
    apps * SIMILARITY_WEIGHTS.apps +
    intent * SIMILARITY_WEIGHTS.intent;

  const appsA = new Set(a.map((e) => e.sourceApp));
  const sharedApps = unique(b.map((e) => e.sourceApp)).filter((app) => appsA.has(app));

  return { sequence, apps, intent, overall, sharedApps };
}
