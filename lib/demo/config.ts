/**
 * Demo Mode resolution.
 *
 * The rule: REPEAT is deterministic and offline unless someone explicitly
 * opts into live adapters. A hackathon demo that depends on Wi-Fi is a
 * hackathon demo that fails.
 */
export const DEMO_MODE: boolean =
  (process.env.NEXT_PUBLIC_DEMO_MODE ?? process.env.DEMO_MODE ?? 'true') !== 'false';

/** Similarity required before two traces are treated as the same workflow. */
export const PATTERN_SIMILARITY_THRESHOLD = 0.82;

/** Observations required before a candidate is offered to the user. */
export const PATTERN_MIN_OBSERVATIONS = 2;

/** Confidence floor for auto-resolving an owner. Below this: needs review. */
export const OWNER_CONFIDENCE_FLOOR = 0.6;

/**
 * Presentation timing, in ms. Tuned against the 2-minute script: fast enough
 * to feel alive, slow enough for a room to read each state change.
 */
export const TIMING = {
  /** Delay before a newly arrived email is announced. */
  mailArrival: 900,
  /** Gap between planning steps materializing in the Ghost Run. */
  ghostPlanStep: 260,
  /** Gap between nodes completing during execution. */
  executeStep: 720,
  /** How long the success pulse holds before settling. */
  successHold: 2200,
  /** Confidence bar animation after the second observation. */
  compareDwell: 1400,
  /** Pause between trigger detection and the Ghost Run opening. */
  triggerToGhost: 1600,
} as const;
