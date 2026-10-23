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

  // --- compute ---
  opsPerProcessor: 10,
  opsMaxPerMemory: 1000,
  insightPerProcessor: 0.05,

  // --- energy ---
  solarWatt: 50,
  batteryJoules: 2e6,
  drawAutoclipper: 2,
  drawMegaclipper: 150,
  drawHarvester: 400,
  drawDrawer: 250,
  dayNightPeriodTicks: 6000,
  solarFarmCost: 1500,
  batteryCost: 1000,

  // --- planet ---
  harvesterRate: 2e18,
  drawerRate: 1e9,
  wirePerKg: 2e4,
  harvesterCost: 25000,
  drawerCost: 25000,

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

  // --- combat ---
  battleIntervalTicks: 50,
  loserLossRate: 0.6,

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
