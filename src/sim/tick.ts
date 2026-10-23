import { BAL } from './balance';
import { revealPass } from './reveal';
import { combat } from './systems/combat';
import { compute } from './systems/compute';
import { energy } from './systems/energy';
import { market } from './systems/market';
import { planet } from './systems/planet';
import { production } from './systems/production';
import { research } from './systems/research';
import { swarm } from './systems/swarm';
import { trust } from './systems/trust';
import { milestone, pushLog, TICK_MS, type GameState } from './state';

/** Act / beat progression derived from state, not from scattered flags. */
function advanceAct(s: GameState): void {
  if (s.act === 2) {
    // Beats are monotone: a project effect must not be undone by a later tick.
    if (s.harvesters > 0) s.beat = Math.max(s.beat, 2);
    else if (s.solarFarms > 0) s.beat = Math.max(s.beat, 1);
    else s.beat = Math.max(s.beat, 0);
  }
  if (s.act === 3) {
    if (s.massBudget / s.massBudgetTotal >= 0.5) s.beat = Math.max(s.beat, 2);
    else if (s.probes >= 1000) s.beat = Math.max(s.beat, 1);
  }
  if (s.act === 1) {
    if (s.funds >= 5 || s.autoclippers > 0) s.beat = Math.max(s.beat, 2);
    else if (s.clips >= 25) s.beat = Math.max(s.beat, 1);
  }
  milestone(s, `act${s.act}beat${s.beat}`);
}

function invariants(s: GameState): void {
  if (!import.meta.env?.DEV) return;
  const bad: string[] = [];
  if (s.unsoldClips > s.clips + 1e-6) bad.push('unsoldClips > clips');
  if (s.ops > s.opsMax + 1e-6) bad.push('ops > opsMax');
  if (s.wire < -1e-6) bad.push('wire < 0');
  if (s.funds < -1e-6) bad.push('funds < 0');
  if (!Number.isInteger(s.trust)) bad.push('trust not integer');
  if (s.planetMass < -1e-6 || s.planetMass > s.planetMassTotal + 1e-6) bad.push('planetMass out of range');
  if (bad.length) console.warn('[invariant]', s.tick, bad.join(', '));
}

/**
 * Advance the simulation by dt seconds. Mutates and returns `s` — the caller
 * owns a single state object; views read it through signals.
 *
 * System order is fixed and meaningful:
 *   consumers use pre-settlement power; energy settles after them,
 *   reveal after all numbers settle,
 *   act advance last so new widgets enter on the NEXT tick, keeping their
 *   entrance animation off the same frame as an act transition.
 */
export function tick(s: GameState, dt: number): GameState {
  if (s.ended) return s;
  production(s, dt);
  market(s, dt);
  compute(s, dt);
  trust(s);
  planet(s, dt);
  energy(s, dt);
  swarm(s, dt);
  combat(s, dt);
  research(s);
  revealPass(s);
  advanceAct(s);
  invariants(s);
  s.tick += Math.round(dt * 10);
  return s;
}

/** Offline catch-up at coarse 1s steps with an efficiency discount. */
export function catchUp(s: GameState, msAway: number): number {
  const ms = Math.min(msAway, BAL.offlineCapHours * 3600_000);
  const seconds = Math.floor((ms / 1000) * BAL.offlineEfficiency);
  if (seconds <= 0) return 0;
  for (let i = 0; i < seconds; i++) tick(s, 1.0);
  const hours = ms / 3600_000;
  pushLog(s, 'offline', {
    en: `offline: +${hours.toFixed(1)} h at ${Math.round(BAL.offlineEfficiency * 100)}% efficiency`,
    zh: `离线补算：+${hours.toFixed(1)} 小时，效率 ${Math.round(BAL.offlineEfficiency * 100)}%`,
  });
  return seconds;
}

export { TICK_MS };
