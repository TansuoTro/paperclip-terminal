import type { GameState } from '../sim/state';
import { planetDepletion } from '../sim/systems/planet';

/**
 * The run is one continuous logarithmic pull-back. `scale` is a single
 * monotone number derived from progress; each stage declares the range it
 * covers and stages cross-fade where ranges overlap, so the camera never cuts.
 *
 *   0 ─ desk ─ 1 ─ workshop ─ 2 ─ planet ─ 3 ─ system ─ 4 ─ cosmic web ─ 5
 */
export const SCALE_MAX = 5;

export interface StageRange {
  from: number;
  to: number;
}

export interface Stage {
  id: string;
  range: StageRange;
  build(): void;
  update(s: GameState, dt: number, weight: number): void;
  /** 0..1 within the stage's own range. */
  setLocalScale(t: number): void;
  dispose(): void;
}

/** Progress -> continuous scale value. Monotone and saturating. */
export function scaleOf(s: GameState): number {
  if (s.act === 1) {
    // 0 .. 1.2 across act 1, driven by machine count (log).
    const machines = s.autoclippers + s.megaclippers * 20;
    return Math.min(1.2, Math.log10(1 + machines) * 0.6);
  }
  if (s.act === 2) {
    // 1.2 .. 3.0: workshop -> factory grounds -> planet surface -> planet.
    const d = planetDepletion(s);
    const industry = Math.min(1, Math.log10(1 + s.megaclippers + s.harvesters * 5) / 2.5);
    return 1.2 + industry * 0.9 + d * 0.9;
  }
  // 3.0 .. 5.0: system -> galaxy -> cosmic web.
  const frac = s.massBudget / s.massBudgetTotal;
  const probeTerm = Math.min(1, Math.log10(1 + s.probes) / 12);
  return 3.0 + Math.min(2, probeTerm * 0.8 + Math.pow(frac, 0.25) * 1.2);
}

/** Cross-fade weight for a stage at a given scale. 0 = inactive. */
export function stageWeight(range: StageRange, scale: number): number {
  const fade = 0.25;
  if (scale < range.from - fade || scale > range.to + fade) return 0;
  if (scale < range.from) return (scale - (range.from - fade)) / fade;
  if (scale > range.to) return 1 - (scale - range.to) / fade;
  return 1;
}

/** 0..1 position within a stage's range, clamped. */
export function localScale(range: StageRange, scale: number): number {
  const span = range.to - range.from || 1;
  return Math.max(0, Math.min(1, (scale - range.from) / span));
}

export const STAGE_RANGES: Record<string, StageRange> = {
  bench: { from: 0, to: 1.2 },
  works: { from: 1.0, to: 2.3 },
  planet: { from: 2.1, to: 3.2 },
  system: { from: 3.0, to: 4.1 },
  web: { from: 3.9, to: 5.0 },
};
