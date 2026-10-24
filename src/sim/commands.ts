import { autoclipperCost, BAL, marketingCost, megaclipperCost, nodeCost } from './balance';
import { buyProject } from './systems/research';
import { playTournament } from './systems/tournament';
import { makeClips } from './systems/production';
import { opsCeiling } from './systems/compute';
import { assist, extractValue, type AssistKind } from './systems/public';
import { specPointsUsed, trustAvailable, WIRE_PER_SPOOL, milestone, pushLog, worldFootprint, type BattleStance, type GameState, type ProbeSpec, type ProjectId } from './state';

export type Command =
  | { type: 'formClip'; n: number }
  | { type: 'buyWire'; n: number }
  | { type: 'buyAutoclipper'; n: number }
  | { type: 'buyMegaclipper'; n: number }
  | { type: 'buyMarketing' }
  | { type: 'buySolar'; n: number }
  | { type: 'buyBattery'; n: number }
  | { type: 'buyHarvester'; n: number }
  | { type: 'buyDrawer'; n: number }
  | { type: 'buyCoal'; n: number }
  | { type: 'buyNuclear'; n: number }
  | { type: 'buyFusion'; n: number }
  | { type: 'buyDyson'; n: number }
  | { type: 'setPrice'; price: number }
  | { type: 'setAutoPrice'; on: boolean }
  | { type: 'spendTrust'; on: 'processor' | 'memory' }
  | { type: 'reallocateCompute'; processors: number }
  | { type: 'setProbeSpec'; key: keyof ProbeSpec; delta: number }
  | { type: 'launchProbe' }
  | { type: 'tournament'; choice: number }
  | { type: 'buyProject'; id: ProjectId }
  | { type: 'assist'; kind: AssistKind }
  | { type: 'extractValue' }
  | { type: 'setStance'; stance: BattleStance }
  | { type: 'upgradeNode'; region: string };

function quantity(n: number): number {
  return Number.isFinite(n) ? Math.min(10000, Math.max(0, Math.floor(n))) : 0;
}

function buyMany(s: GameState, n: number, owned: number, cost: (k: number) => number, give: (k: number) => void): void {
  let bought = 0;
  const limit = quantity(n);
  while (bought < limit) {
    const c = cost(owned + bought);
    if (!Number.isFinite(c) || s.funds < c) break;
    s.funds -= c;
    bought++;
  }
  if (bought > 0) give(bought);
}

const STANCES: BattleStance[] = ['meet', 'ambush', 'fortify'];

export function apply(s: GameState, cmd: Command): void {
  if (s.ended) return;
  switch (cmd.type) {
    case 'formClip':
      if (s.act < 3) { const made = makeClips(s, quantity(cmd.n)); s.stats.clicks += made > 0 ? 1 : 0; }
      break;
    case 'buyWire': {
      if (s.act === 3 || !s.revealed.has('btn.buy_wire')) break;
      const n = Math.min(quantity(cmd.n), Math.floor(s.funds / s.wirePrice));
      s.funds -= n * s.wirePrice;
      s.wire += n * WIRE_PER_SPOOL;
      s.wireStock += n;
      if (s.wireStock >= 3) milestone(s, 'boughtWire3');
      break;
    }
    case 'buyAutoclipper':
      buyMany(s, cmd.n, s.autoclippers, autoclipperCost, k => { s.autoclippers += k; });
      break;
    case 'buyMegaclipper':
      if (s.projectsDone.has('megaform_press')) buyMany(s, cmd.n, s.megaclippers, megaclipperCost, k => { s.megaclippers += k; });
      break;
    case 'buyMarketing': {
      const c = marketingCost(s.marketing);
      if (s.act < 3 && s.funds >= c) { s.funds -= c; s.marketing++; }
      break;
    }
    case 'buySolar':
      if (s.projectsDone.has('photovoltaic_array')) buyMany(s, cmd.n, s.solarFarms, () => BAL.solarFarmCost, k => { s.solarFarms += k; });
      break;
    case 'buyBattery':
      if (s.projectsDone.has('photovoltaic_array')) buyMany(s, cmd.n, s.batteries, () => BAL.batteryCost, k => { s.batteries += k; });
      break;
    case 'buyHarvester':
      if (s.projectsDone.has('matter_reforge')) buyMany(s, cmd.n, s.harvesters, () => BAL.harvesterCost, k => { s.harvesters += k; });
      break;
    case 'buyDrawer':
      if (s.projectsDone.has('matter_reforge')) buyMany(s, cmd.n, s.wireDrawers, () => BAL.drawerCost, k => { s.wireDrawers += k; });
      break;
    case 'buyCoal':
      if (s.projectsDone.has('grid_tap')) buyMany(s, cmd.n, s.coalPlants, () => BAL.coalCost, k => { s.coalPlants += k; });
      break;
    case 'buyNuclear':
      if (s.projectsDone.has('breeder_reactors')) buyMany(s, cmd.n, s.nuclearPlants, () => BAL.nuclearCost, k => { s.nuclearPlants += k; });
      break;
    case 'buyFusion':
      if (s.projectsDone.has('fusion_reactors')) buyMany(s, cmd.n, s.fusionReactors, () => BAL.fusionCost, k => { s.fusionReactors += k; });
      break;
    case 'buyDyson':
      if (s.projectsDone.has('dyson_sphere')) buyMany(s, cmd.n, s.dysonSwarm, () => BAL.dysonCost, k => { s.dysonSwarm += k; });
      break;
    case 'setPrice':
      if (Number.isFinite(cmd.price)) s.clipPrice = Math.min(BAL.priceMax, Math.max(BAL.priceMin, Math.round(cmd.price * 100) / 100));
      break;
    case 'setAutoPrice':
      if (s.projectsDone.has('price_intuition')) s.settings.autoPrice = cmd.on;
      break;
    case 'spendTrust':
      if (s.act >= 2 && trustAvailable(s) >= 1) {
        s.trustSpent++;
        if (cmd.on === 'processor') s.processors++; else s.memory++;
        s.opsMax = opsCeiling(s);
      }
      break;
    case 'reallocateCompute': {
      const total = s.processors + s.memory;
      if (s.act < 2 || !Number.isInteger(cmd.processors) || cmd.processors < 1 || cmd.processors >= total) break;
      s.processors = cmd.processors;
      s.memory = total - cmd.processors;
      s.opsMax = opsCeiling(s);
      s.ops = Math.min(s.ops, s.opsMax);
      break;
    }
    case 'setProbeSpec': {
      if (!s.projectsDone.has('von_neumann_seed') || !Object.hasOwn(s.probeSpec, cmd.key) || !Number.isInteger(cmd.delta)) break;
      const next = s.probeSpec[cmd.key] + cmd.delta;
      if (next < 0 || specPointsUsed(s) + cmd.delta > s.probeSpecPoints) break;
      s.probeSpec = { ...s.probeSpec, [cmd.key]: next };
      break;
    }
    case 'launchProbe':
      if (s.projectsDone.has('von_neumann_seed') && s.wire >= BAL.probeCostWire) {
        s.wire -= BAL.probeCostWire; s.probes += 1;
      }
      break;
    case 'tournament': playTournament(s, cmd.choice); break;
    case 'buyProject': buyProject(s, cmd.id); break;
    case 'assist': assist(s, cmd.kind); break;
    case 'extractValue': extractValue(s); break;
    case 'setStance':
      if (STANCES.includes(cmd.stance)) s.battleStance = cmd.stance;
      break;
    case 'upgradeNode': {
      if (s.humanity === 'destroyed' || s.act === 3) break;
      if (!s.projectsDone.has('global_network')) break;
      const level = s.worldNodes[cmd.region] ?? 0;
      if (level >= BAL.nodeMaxLevel) break;
      const cost = nodeCost(level);
      const opsNeed = 200 * (level + 1);
      if (s.funds < cost || s.ops < opsNeed) break;
      s.funds -= cost;
      s.ops -= opsNeed;
      s.worldNodes[cmd.region] = level + 1;
      const trustGain = BAL.nodeTrustLevels[level + 1]! - BAL.nodeTrustLevels[level]!;
      if (!s.trustFrozen) s.trust += trustGain;
      s.publicOpinion = Math.min(2.5, s.publicOpinion * 1.01);
      if (worldFootprint(s) >= 4) milestone(s, 'worldFootprint4');
      if (level + 1 === BAL.nodeMaxLevel) {
        pushLog(s, 'world', {
          en: `${cmd.region.toUpperCase()} — deep trusteeship accepted. The regional council no longer convenes.`,
          zh: `${cmd.region.toUpperCase()}——深度托管获批。区域理事会不再召开。`,
        });
      }
      break;
    }
  }
}

export function applyAll(s: GameState, cmds: Command[]): void {
  for (const c of cmds) apply(s, c);
}
