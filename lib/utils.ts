import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let idCounter = 0;

/**
 * Deterministic, monotonic ids. Deliberately not crypto-random: identical demo
 * runs produce identical ids, which keeps React keys and snapshots stable.
 */
export function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter.toString(36).padStart(4, '0')}`;
}

export function resetIdCounter() {
  idCounter = 0;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 24h clock, e.g. "10:24". The Live Timeline and mail list both use this. */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/** e.g. "4m 42s" — the shape used in every time-saved metric. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m === 0) return `${rem}s`;
  return `${m}m ${rem.toString().padStart(2, '0')}s`;
}

export function formatPercent(value01: number): string {
  return `${Math.round(clamp(value01, 0, 1) * 100)}%`;
}

/** Unique, order-preserving. */
export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/** Jaccard index over two sets. Used for app-overlap similarity. */
export function jaccard<T>(a: T[], b: T[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let inter = 0;
  setA.forEach((x) => {
    if (setB.has(x)) inter += 1;
  });
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}
