import { BAL } from '../balance';
import type { GameState } from '../state';

export function opsRate(s: GameState): number {
  return s.processors * BAL.opsPerProcessor * s.opsRateMult;
}

export function opsCeiling(s: GameState): number {
  return s.memory * BAL.opsMaxPerMemory * Math.pow(2, Math.min(16, s.memory - 1)) * s.opsMaxMult;
}

/** Insight accrues slowly from idle cognition, at full rate when ops is
 *  saturated — the Act 2 tension, without a hard deadlock once opsMax
 *  outgrows any realistic fill rate. */
export function insightRate(s: GameState): number {
  const saturated = s.ops >= opsCeiling(s) - 1e-6;
  return s.processors * BAL.insightPerProcessor * (saturated ? 1 : 0.5);
}

export function compute(s: GameState, dt: number): void {
  s.opsMax = opsCeiling(s);
  if (s.processors === 0) return;

  // Cognition always produces insight; saturation doubles down on it.
  s.insight += insightRate(s) * dt;
  const gain = opsRate(s) * dt;
  const room = s.opsMax - s.ops;
  if (gain <= room) {
    s.ops += gain;
  } else {
    s.ops = s.opsMax;
  }
}
