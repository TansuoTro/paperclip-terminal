import { BAL } from '../balance';
import { randNormal } from '../rng';
import { emptyProbeSpec, milestone, type GameState, type ProbeSpec } from '../state';

export function replicationRate(s: GameState): number {
  const support = 0.35 + 0.65 * Math.min(1, (s.probeSpec.factory + s.probeSpec.wire) / 3);
  // A dyson swarm is warm, vast computation-and-power infrastructure.
  const dyson = 1 + Math.min(2, s.dysonSwarm * 0.02);
  return s.probes * s.probeSpec.selfReplication * BAL.selfRepCoeff * s.selfRepMult * support * dyson;
}

export function hazardLoss(s: GameState): number {
  return s.probes * BAL.hazardCoeff * Math.max(0, BAL.hazardBase - s.probeSpec.hazard);
}

/** Drifters replicate too, slower but compounding — neglect is defeat.
 *  They also suffer their own hazard losses: mutant shields are poor, so an
 *  unopposed drifter bloom burns itself down at the extreme. */
export function drifterGrowth(s: GameState, dt: number): void {
  if (s.drifters < 1) return;
  const support = 0.35 + 0.65 * Math.min(1, (s.drifterSpec.factory + s.drifterSpec.wire) / 3);
  const hazard = s.drifters * BAL.hazardCoeff * Math.max(0, BAL.hazardBase - s.drifterSpec.hazard);
  // Logistic ceiling: mutants eat the same explored volume; their bloom can
  // shadow the swarm but never out-eat it by more than a bounded factor.
  const cap = Math.max(1, s.probes * 1e6);
  const logistic = Math.max(0, 1 - s.drifters / cap);
  const net = s.drifters * s.drifterSpec.selfReplication * BAL.drifterRepCoeff * support * logistic - hazard;
  s.drifters = Math.min(1e60, s.drifters * Math.exp(net * dt));
  // Their spec creeps toward ours: they salvage and copy.
  if (s.tick >= s.nextMutationTick + BAL.drifterAdaptTicks) {
    for (const k of ['combat', 'selfReplication', 'factory', 'hazard'] as const) {
      const gap = (s.probeSpec[k] - s.drifterSpec[k]) * 0.3;
      if (gap > 0.5) s.drifterSpec = { ...s.drifterSpec, [k]: s.drifterSpec[k] + Math.ceil(gap) };
    }
  }
}

export function acquisitionRate(s: GameState): number {
  // Drifter sabotage: contested space harvests less.
  const sabotage = 1 / (1 + (s.drifters / Math.max(1, s.probes)) * BAL.drifterSabotage);
  return s.probes * s.probeSpec.harvester * BAL.harvestCoeff * sabotage;
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
  drifterGrowth(s, dt);
}
