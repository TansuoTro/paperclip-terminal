import { BAL } from '../balance';
import { milestone, type GameState } from '../state';
import { powerFactor } from './energy';

export function theoreticalRate(s: GameState): number {
  return (s.autoclippers * BAL.autoclipperRate + s.megaclippers * BAL.megaclipperRate) * s.clipperBoost;
}

export function effectiveRate(s: GameState): number {
  return s.wire >= s.wirePerClip ? theoreticalRate(s) * powerFactor(s) : 0;
}

export function production(s: GameState, dt: number): void {
  if (s.act === 3) return;
  // Carry fractional output across ticks: a 1 clip/s machine must not round
  // 0.1 down to zero on every fixed step.
  s.productionCarry += theoreticalRate(s) * powerFactor(s, dt) * dt;
  const whole = Math.floor(s.productionCarry + 1e-9);
  s.productionCarry = Math.max(0, s.productionCarry - whole);
  if (whole > 0) makeClips(s, whole);
}

export function makeClips(s: GameState, n: number): number {
  const made = Math.min(Math.floor(n), Math.floor((s.wire + 1e-9) / s.wirePerClip));
  if (made <= 0 || !Number.isFinite(made)) return 0;
  s.wire = Math.max(0, s.wire - made * s.wirePerClip);
  s.clips += made;
  s.unsoldClips += made;
  if (s.clips >= 25) milestone(s, 'clips25');
  if (s.clips >= 1000) milestone(s, 'clips1k');
  if (s.clips >= 1e6) milestone(s, 'clips1m');
  return made;
}
