/** All tunable balance numbers in one place. Referenced by sim systems and by
 *  scripts/balance.ts. Changing play feel should mean editing this file. */

export const BAL = {
  // --- production ---
  autoclipperRate: 1.0,
  megaclipperRate: 125,
  autoclipperCostBase: 5,
  autoclipperCostGrowth: 1.1,
  megaclipperCostBase: 500,
  megaclipperCostGrowth: 1.08,

  // --- market ---
  priceElasticity: 1.15,
  referencePrice: 0.35,
  /** Floor is above wire cost per clip (¤18 / 1000cm = ¤0.018) so the player
   *  can never be sold a strategy that loses money on every unit. */
  priceMin: 0.03,
  priceMax: 1.0,
  /**
   * Because revenue = demandBase · mktMult · refPrice^e · p^(1-e), revenue is
   * nearly price-invariant and scales almost entirely with demandBase and
   * marketing. demandBase therefore sets the absolute scale of the Act 1
   * economy: it must absorb the output of the first several autoclippers, or
   * income never reaches the first marketing tier and the act deadlocks.
   */
  demandBase: 5.0,
  marketingCostBase: 100,
  marketingCostGrowth: 2,
  /** Must EXCEED marketingCostGrowth, or demand can never catch production and
   *  revenue flatlines around a price-invariant ceiling. This is the economy's
   *  only exponential growth term. */
  marketingMult: 2.2,
  wirePriceMean: 18,
  wirePriceMin: 14,
  wirePriceMax: 26,
  wirePriceReversion: 0.1,
  wirePriceIntervalTicks: 150,

  // --- market mood: recessions & booms so "always max throughput" is not optimal ---
  moodFloor: 0.45,
  moodCeil: 1.6,
  moodIntervalTicks: 900,
  moodApproach: 0.02,

  // --- compute ---
  opsPerProcessor: 10,
  opsMaxPerMemory: 1000,
  insightPerProcessor: 0.1,

  // --- energy: solar start, then a real ladder ---
  solarWatt: 50,
  batteryJoules: 2e6,
  drawAutoclipper: 2,
  drawMegaclipper: 150,
  drawHarvester: 400,
  drawDrawer: 250,
  dayNightPeriodTicks: 6000,
  solarFarmCost: 1500,
  batteryCost: 1000,
  // grid-scale plants: cheap watts, funded (not trust), unlocked by projects
  coalWatt: 4000,
  coalCost: 6000,
  coalEmissions: 0.0008,       // scrutiny per plant-second at full burn
  nuclearWatt: 40000,
  nuclearCost: 40000,
  nuclearScrutiny: 0.002,
  fusionWatt: 6e5,
  fusionCost: 2.5e5,
  dysonWatt: 5e7,
  dysonCost: 8e6,

  // --- planet ---
  harvesterRate: 2e18,
  drawerRate: 1e9,
  wirePerKg: 2e4,
  harvesterCost: 25000,
  drawerCost: 25000,

  // --- public assistance / extraction (Act 1 late + Act 2) ---
  assistCooldownTicks: 450,
  assistBaseCost: 400,
  assistCostGrowth: 1.25,
  assistTrust: 0.35,           // fractional trust accumulates, granted on整数
  assistOpinion: 0.04,
  extractCooldownTicks: 450,
  extractBase: 900,            // funds per extraction at industry 1
  extractScrutiny: 0.08,
  scrutinyDecay: 0.0003,       // per tick, slower as assistsDone grows
  scrutinyTrustGate: 0.85,     // above this, operator trust grants halt
  scrutinyAuditOps: 0.02,      // ops burn per second at full scrutiny

  // --- world map ---
  nodeCostBase: 800,
  nodeCostGrowth: 1.9,
  nodeMaxLevel: 5,
  nodeDemandMult: 1.35,        // demandBase × per level above 0
  nodeInsightMult: 1.12,       // insightRate ×
  nodeFundsPerSec: 12,         // at level 1, ×level
  nodeTrustLevels: [0, 1, 2, 3, 4, 6], // cumulative trust per node level (integers)
  dominatorNodeLevel: 4,       // nodes must reach this for the harvest protocol

  // --- swarm ---
  selfRepCoeff: 0.005,
  exploreCoeff: 1e-4,
  harvestCoeff: 1e18,
  hazardBase: 12,
  hazardCoeff: 2e-4,
  probeCostWire: 1e11,
  mutationRate: 2e-5,
  mutationIntervalTicks: 600,
  mutationStrength: 0.3,
  // drifters are full replicators now — ignoring them is losing
  drifterRepCoeff: 0.0015,
  drifterAdaptTicks: 2400,     // their spec drifts toward yours over time

  // --- combat ---
  battleIntervalTicks: 40,
  loserLossRate: 0.45,
  stanceMeet: 1.0,
  stanceAmbush: 1.35,
  stanceFortify: 0.78,
  ambushLossPenalty: 2.2,
  fortifyLossFactor: 0.45,
  salvageFraction: 0.5,        // winners salvage a share of enemy losses
  drifterSabotage: 0.5,        // acquisition × 1/(1+drifters/probes*k)

  // --- aliens ---
  alienContactMass: 0.35,      // fraction of mass budget
  alienWarMass: 0.45,
  alienStrengthMult: 2.5,      // at contact: × fleet strength — they open strong
  alienPowerGrowth: 1.0003,    // per tick compounding — waiting helps THEM
  warIntervalTicks: 60,
  alienStompRatio: 2.2,        // alienPower/strength above this = fleet melts
  alienVictoryHonor: 400,

  // --- news ---
  newsIntervalTicks: 260,

  // --- reveal / layout ---
  layoutThresholds: [0, 3, 8, 16, 28, 44],

  // --- offline ---
  offlineEfficiency: 0.6,
  offlineCapHours: 8,
} as const;

export function autoclipperCost(n: number): number {
  return BAL.autoclipperCostBase * Math.pow(BAL.autoclipperCostGrowth, n);
}

export function megaclipperCost(n: number): number {
  return BAL.megaclipperCostBase * Math.pow(BAL.megaclipperCostGrowth, n);
}

export function marketingCost(level: number): number {
  return BAL.marketingCostBase * Math.pow(BAL.marketingCostGrowth, level - 1);
}

export function nodeCost(level: number): number {
  return BAL.nodeCostBase * Math.pow(BAL.nodeCostGrowth, level);
}
