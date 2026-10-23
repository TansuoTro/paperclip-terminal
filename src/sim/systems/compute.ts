import { BAL } from '../balance';
import type { GameState } from '../state';

export function opsRate(s: GameState): number {
  return s.processors * BAL.opsPerProcessor * s.opsRateMult;
}

export function opsCeiling(s: GameState): number {
  return s.memory * BAL.opsMaxPerMemory * Math.pow(2, Math.min(16, s.memory - 1)) * s.opsMaxMult;
}

/** Insight only accrues while ops is saturated — the Act 2 tension. */
export function insightRate(s: GameState): number {
  return s.ops >= opsCeiling(s) - 1e-6 ? s.processors * BAL.insightPerProcessor : 0;
}

export function compute(s: GameState, dt: number): void {
  s.opsMax = opsCeiling(s);
  if (s.processors === 0) return;

  const gain = opsRate(s) * dt;
  const room = s.opsMax - s.ops;
  if (gain <= room) {
    s.ops += gain;
  } else {
    s.ops = s.opsMax;
    // Overflow turns into insight at a much lower rate.
    s.insight += s.processors * BAL.insightPerProcessor * dt;
  }
}
