import { BAL } from '../balance';
import { milestone, type GameState } from '../state';
import { powerFactor } from './energy';

export function harvestRate(s: GameState): number {
  return s.harvesters * BAL.harvesterRate * s.industryMult * powerFactor(s);
}

export function drawRate(s: GameState): number {
  return s.wireDrawers * BAL.drawerRate * s.industryMult * powerFactor(s);
}

export function planetDepletion(s: GameState): number {
  return Math.max(0, Math.min(1, 1 - s.planetMass / s.planetMassTotal));
}

export function planet(s: GameState, dt: number): void {
  if (s.act !== 2) return;
  const harvested = Math.min(s.harvesters * BAL.harvesterRate * s.industryMult * powerFactor(s, dt) * dt, s.planetMass);
  s.planetMass -= harvested;
  s.matterStock += harvested;
  const massDrawn = Math.min(
    s.wireDrawers * BAL.drawerRate * s.industryMult * powerFactor(s, dt) * dt / BAL.wirePerKg,
    s.matterStock,
  );
  s.matterStock -= massDrawn;
  s.wire += massDrawn * BAL.wirePerKg;
  if (planetDepletion(s) >= 0.5) milestone(s, 'planet50');
  if (planetDepletion(s) >= 0.98) milestone(s, 'planet98');
}
