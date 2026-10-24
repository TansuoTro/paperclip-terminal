/** Pure simulation state. No DOM, no Three.js, no Preact imports in sim/. */

import { BAL } from './balance';

export type WidgetId = string;
export type ProjectId = string;
export type Currency = 'funds' | 'ops' | 'insight' | 'trust' | 'honor';
export type HumanityPhase = 'alive' | 'deceived' | 'destroyed';
export type BattleStance = 'meet' | 'ambush' | 'fortify';

export interface Bilingual {
  en: string;
  zh: string;
}

export interface LogEntry {
  tick: number;
  kind: 'system' | 'module' | 'project' | 'market' | 'operator' | 'combat' | 'offline' | 'ending' | 'news' | 'war' | 'world';
  text: Bilingual;
}

export interface ProbeSpec {
  speed: number;
  exploration: number;
  selfReplication: number;
  hazard: number;
  factory: number;
  harvester: number;
  wire: number;
  combat: number;
}

export interface RunStats {
  /** tick index at which each milestone was first reached */
  milestones: Record<string, number>;
  clicks: number;
  totalFundsEarned: number;
}

export interface Settings {
  viewMode: 'optical' | 'schematic';
  plainMode: boolean;
  numberFormat: 'words' | 'scientific';
  locale: 'en' | 'zh-CN';
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  autoPrice: boolean;
}

/** One deployed AI node on the world map. */
export interface WorldRegion {
  id: string;
  level: number;
}

export interface GameState {
  schema: number;
  tick: number;
  act: 1 | 2 | 3;
  beat: number;
  rngSeed: number;

  // --- Act 1 ---
  clips: number;
  unsoldClips: number;
  wire: number;
  funds: number;
  wirePrice: number;
  wireStock: number;
  clipPrice: number;
  demandBase: number;
  marketing: number;
  autoclippers: number;
  megaclippers: number;
  clipperBoost: number;
  wirePerClip: number;
  productionCarry: number;
  matterStock: number;
  industryMult: number;
  exploredMass: number;
  tournament: { rounds: number; lastReward: number; lastChoice: number; lastOpponent: number; nextTick: number };
  lastBattle: { tick: number; won: boolean; ourLoss: number; theirLoss: number } | null;

  // --- Act 2 ---
  ops: number;
  opsMax: number;
  opsMaxMult: number;
  opsRateMult: number;
  insight: number;
  processors: number;
  memory: number;
  trust: number;
  trustSpent: number;
  trustFrozen: boolean;
  energyStored: number;
  solarFarms: number;
  batteries: number;
  harvesters: number;
  wireDrawers: number;
  planetMass: number;
  planetMassTotal: number;
  dayNightFloor: number;
  publicOpinion: number;

  // --- energy ladder ---
  coalPlants: number;
  nuclearPlants: number;
  fusionReactors: number;
  dysonSwarm: number;

  // --- world map / humanity ---
  humanity: HumanityPhase;
  /** 0..1 — how closely the operators are watching. Raised by extraction, lowed by assistance. */
  scrutiny: number;
  assistCooldown: number;
  assistsDone: number;
  /** fractional trust from assistance programs, carried until it reaches 1 */
  trustCarry: number;
  /** region id -> deployed level (0 = nothing deployed) */
  worldNodes: Record<string, number>;

  // --- market mood ---
  marketMood: number;
  moodTarget: number;
  moodNextShift: number;

  // --- world news ---
  newsNextTick: number;
  newsCursor: number;

  // --- Act 3 ---
  probes: number;
  probeSpec: ProbeSpec;
  probeSpecPoints: number;
  massBudget: number;
  massBudgetTotal: number;
  honor: number;
  honorMult: number;
  drifters: number;
  drifterSpec: ProbeSpec;
  mutationMult: number;
  selfRepMult: number;
  battlesWon: number;
  battlesLost: number;
  victorLossRate: number;
  nextBattleTick: number;
  nextMutationTick: number;
  battleStance: BattleStance;

  // --- aliens ---
  alienPhase: 0 | 1 | 2 | 3;
  alienPower: number;
  alienFleetsDestroyed: number;
  warNextTick: number;

  // --- Meta ---
  revealed: Set<WidgetId>;
  retired: Set<WidgetId>;
  pendingReveals: WidgetId[];
  projectsDone: Set<ProjectId>;
  projectsAvailable: Set<ProjectId>;
  log: LogEntry[];
  stats: RunStats;
  settings: Settings;
  ended: boolean;
}

export const SCHEMA_VERSION = 1;
export const TICK_MS = 100;
export const WIRE_PER_SPOOL = 1000;
export const PLANET_MASS_TOTAL = 6.0e24;
export const MASS_BUDGET_TOTAL = 3.35e54;
export const LOG_CAP = 240;

export function emptyProbeSpec(): ProbeSpec {
  return {
    speed: 0,
    exploration: 0,
    selfReplication: 0,
    hazard: 0,
    factory: 0,
    harvester: 0,
    wire: 0,
    combat: 0,
  };
}

export function defaultSettings(): Settings {
  return {
    viewMode: 'schematic',
    plainMode: false,
    numberFormat: 'words',
    locale: 'zh-CN',
    masterVolume: 0.7,
    musicVolume: 0.6,
    sfxVolume: 0.7,
    autoPrice: false,
  };
}

export function createInitialState(seed = 0x9e3779b9): GameState {
  return {
    schema: SCHEMA_VERSION,
    tick: 0,
    act: 1,
    beat: 0,
    rngSeed: seed >>> 0,

    clips: 0,
    unsoldClips: 0,
    wire: 1000,
    funds: 0,
    wirePrice: 18,
    wireStock: 0,
    clipPrice: 0.25,
    demandBase: BAL.demandBase,
    marketing: 1,
    autoclippers: 0,
    megaclippers: 0,
    clipperBoost: 1,
    wirePerClip: 1,
    productionCarry: 0,
    matterStock: 0,
    industryMult: 1,
    exploredMass: 0,
    tournament: { rounds: 0, lastReward: 0, lastChoice: 0, lastOpponent: 0, nextTick: 0 },
    lastBattle: null,

    ops: 0,
    opsMax: 1000,
    opsMaxMult: 1,
    opsRateMult: 1,
    insight: 0,
    processors: 0,
    memory: 1,
    trust: 0,
    trustSpent: 0,
    trustFrozen: false,
    energyStored: 0,
    solarFarms: 0,
    batteries: 0,
    harvesters: 0,
    wireDrawers: 0,
    planetMass: PLANET_MASS_TOTAL,
    planetMassTotal: PLANET_MASS_TOTAL,
    dayNightFloor: 0.3,
    publicOpinion: 1,

    coalPlants: 0,
    nuclearPlants: 0,
    fusionReactors: 0,
    dysonSwarm: 0,

    humanity: 'alive',
    scrutiny: 0,
    assistCooldown: 0,
    assistsDone: 0,
    trustCarry: 0,
    worldNodes: {},

    marketMood: 1,
    moodTarget: 1,
    moodNextShift: 0,

    newsNextTick: 300,
    newsCursor: 0,

    probes: 0,
    probeSpec: emptyProbeSpec(),
    probeSpecPoints: 0,
    massBudget: 0,
    massBudgetTotal: MASS_BUDGET_TOTAL,
    honor: 0,
    honorMult: 1,
    drifters: 0,
    drifterSpec: emptyProbeSpec(),
    mutationMult: 1,
    selfRepMult: 1,
    battlesWon: 0,
    battlesLost: 0,
    victorLossRate: 0.2,
    nextBattleTick: 0,
    nextMutationTick: 0,
    battleStance: 'meet',

    alienPhase: 0,
    alienPower: 0,
    alienFleetsDestroyed: 0,
    warNextTick: 0,

    revealed: new Set<WidgetId>(),
    retired: new Set<WidgetId>(),
    pendingReveals: [],
    projectsDone: new Set<ProjectId>(),
    projectsAvailable: new Set<ProjectId>(),
    log: [],
    stats: { milestones: {}, clicks: 0, totalFundsEarned: 0 },
    settings: defaultSettings(),
    ended: false,
  };
}

export function pushLog(s: GameState, kind: LogEntry['kind'], text: Bilingual): void {
  s.log.push({ tick: s.tick, kind, text });
  if (s.log.length > LOG_CAP) s.log.splice(0, s.log.length - LOG_CAP);
}

export function milestone(s: GameState, key: string): void {
  if (s.stats.milestones[key] === undefined) s.stats.milestones[key] = s.tick;
}

/** Trust points still available to spend. */
export function trustAvailable(s: GameState): number {
  return s.trust - s.trustSpent;
}

/** Probe spec points still unallocated. */
export function specPointsUsed(s: GameState): number {
  const p = s.probeSpec;
  return (
    p.speed + p.exploration + p.selfReplication + p.hazard +
    p.factory + p.harvester + p.wire + p.combat
  );
}

/** Sum of every deployed node level on the world map. */
export function worldFootprint(s: GameState): number {
  let n = 0;
  for (const k in s.worldNodes) n += s.worldNodes[k]!;
  return n;
}
