import type { GameState } from './state';

/**
 * mulberry32 — seeded PRNG. State is a single u32 that lives in GameState,
 * so saves are reproducible and balance runs are deterministic.
 * Math.random() is banned in sim/.
 */
export function nextRandom(s: GameState): number {
  let t = (s.rngSeed = (s.rngSeed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
  t ^= (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform in [lo, hi). */
export function randRange(s: GameState, lo: number, hi: number): number {
  return lo + nextRandom(s) * (hi - lo);
}

/** Approximately standard-normal via sum of 3 uniforms (cheap, bounded). */
export function randNormal(s: GameState): number {
  return (nextRandom(s) + nextRandom(s) + nextRandom(s) - 1.5) * 1.1547;
}
