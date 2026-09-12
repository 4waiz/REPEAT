import type { WorkflowTrace } from '@/types';
import { PATTERN_MIN_OBSERVATIONS, PATTERN_SIMILARITY_THRESHOLD } from '@/lib/demo/config';
import { compareTraces } from './similarity';

/**
 * Pattern Detector.
 *
 * Runs after every completed trace. It asks one question: does this trace
 * look like something I have already watched this person do?
 */

/**
 * Sample-size discount.
 *
 * Two passes that happen to be identical are 100% *similar*, but two samples
 * are not grounds for certainty — REPEAT has seen this workflow twice, not
 * proven it. So reported confidence is similarity scaled by how much support
 * exists: it starts at 96% for two observations and halves the remaining
 * doubt with every confirming observation after that.
 *
 * The raw similarity numbers are still shown in full in the evidence panel;
 * this only governs the single headline confidence figure.
 */
export function supportFactor(observations: number): number {
  if (observations < 2) return 0.5;
  return 1 - 0.04 * Math.pow(2, -(observations - 2));
}

export type DetectionResult =
  | { kind: 'insufficient'; observations: number; needed: number; confidence: number }
  | { kind: 'below_threshold'; confidence: number; threshold: number; matched: WorkflowTrace[] }
  | { kind: 'pattern'; confidence: number; matched: WorkflowTrace[] };

export function detect(traces: WorkflowTrace[]): DetectionResult {
  const completed = traces.filter((t) => t.outcome === 'completed');

  if (completed.length < PATTERN_MIN_OBSERVATIONS) {
    return {
      kind: 'insufficient',
      observations: completed.length,
      needed: PATTERN_MIN_OBSERVATIONS,
      // A single observation is evidence of nothing repeatable yet.
      confidence: completed.length === 0 ? 0 : 0.35,
    };
  }

  // Compare the newest trace against every earlier one and keep the best set.
  const newest = completed[completed.length - 1];
  const earlier = completed.slice(0, -1);

  const scored = earlier.map((t) => ({
    trace: t,
    score: compareTraces(t.events, newest.events).overall,
  }));

  const matching = scored.filter((s) => s.score >= PATTERN_SIMILARITY_THRESHOLD);
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a), scored[0]);

  if (matching.length === 0) {
    return {
      kind: 'below_threshold',
      confidence: best.score,
      threshold: PATTERN_SIMILARITY_THRESHOLD,
      matched: [newest],
    };
  }

  const matched = [...matching.map((m) => m.trace), newest];
  const similarity = matching.reduce((s, m) => s + m.score, 0) / matching.length;
  const confidence = similarity * supportFactor(matched.length);

  return { kind: 'pattern', confidence, matched };
}

/**
 * Live confidence while a trace is still in progress — this is what drives
 * the rising confidence bar during the second observation. It compares the
 * partial trace against the best earlier match, so the number is real rather
 * than an animation on a timer.
 */
export function liveConfidence(traces: WorkflowTrace[], inProgress: WorkflowTrace | null): number {
  if (!inProgress || inProgress.events.length === 0) return 0;
  const completed = traces.filter((t) => t.outcome === 'completed' && t.id !== inProgress.id);
  if (completed.length === 0) return 0;

  const partialLength = inProgress.events.length;

  const scores = completed.map((t) => {
    // Compare against a *window* of prefix lengths rather than the single
    // equal-length prefix. Humans insert and skip steps, and a strict prefix
    // comparison makes confidence fall when they do — which would show the
    // user a bar moving backwards as evidence accumulates. Taking the best
    // alignment in a small window removes that artifact without inflating the
    // score: the window only ever contains genuine prefixes of the earlier
    // trace, so this is the real similarity of the best-matching alignment.
    let best = 0;
    for (let len = partialLength - 2; len <= partialLength + 2; len += 1) {
      if (len < 1 || len > t.events.length) continue;
      const score = compareTraces(t.events.slice(0, len), inProgress.events).overall;
      if (score > best) best = score;
    }
    return best;
  });
  const best = Math.max(...scores);

  // Weight by how much of the earlier workflow we have seen repeated so far.
  const longest = Math.max(...completed.map((t) => t.events.length));
  const coverage = Math.min(1, partialLength / longest);
  return best * (0.55 + 0.45 * coverage) * supportFactor(completed.length + 1);
}
