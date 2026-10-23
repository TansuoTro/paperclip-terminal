import { BAL } from '../balance';
import { randNormal } from '../rng';
import { emptyProbeSpec, milestone, type GameState, type ProbeSpec } from '../state';

export function replicationRate(s: GameState): number {
  const support = 0.35 + 0.65 * Math.min(1, (s.probeSpec.factory + s.probeSpec.wire) / 3);
  return s.probes * s.probeSpec.selfReplication * BAL.selfRepCoeff * s.selfRepMult * support;
}

export function hazardLoss(s: GameState): number {
  return s.probes * BAL.hazardCoeff * Math.max(0, BAL.hazardBase - s.probeSpec.hazard);
}

export function acquisitionRate(s: GameState): number {
  return s.probes * s.probeSpec.harvester * BAL.harvestCoeff;
}

export function probeWireRate(s: GameState): number {
  return s.probes * s.probeSpec.wire * 1e9;
}

function mutate(spec: ProbeSpec, s: GameState): ProbeSpec {
  const out = emptyProbeSpec();
  for (const k of Object.keys(out) as (keyof ProbeSpec)[]) {
    out[k] = Math.max(0, Math.round(spec[k] + randNormal(s) * 0.9));
  }
  return out;
}

export function swarm(s: GameState, dt: number): void {
  if (s.act < 3 || s.probes <= 0) return;
  const net = (replicationRate(s) - hazardLoss(s)) / s.probes;
  s.probes = Math.min(1e60, s.probes * Math.exp(net * dt));
  s.wire = Math.min(1e100, s.wire + probeWireRate(s) * dt);
  const discovery = s.probes * s.probeSpec.speed * s.probeSpec.exploration * 3e18 * dt;
  s.exploredMass = Math.min(s.massBudgetTotal, s.exploredMass + discovery);
  const available = Math.max(0, s.exploredMass - s.massBudget);
  const acquired = Math.max(0, Math.min(acquisitionRate(s) * dt, available, s.massBudgetTotal - s.massBudget));
  s.massBudget += acquired;
  s.clips += acquired * 3;
  if (s.probes >= 1000) milestone(s, 'probes1k');
  if (s.massBudget / s.massBudgetTotal >= 0.5) milestone(s, 'mass50');
  if (s.tick >= s.nextMutationTick) {
    s.nextMutationTick = s.tick + BAL.mutationIntervalTicks;
    const spawned = s.probes * BAL.mutationRate * s.mutationMult;
    s.drifters = Math.min(1e60, s.drifters + spawned);
    s.probes = Math.max(0, s.probes - spawned);
    s.drifterSpec = mutate(s.probeSpec, s);
  }
}
