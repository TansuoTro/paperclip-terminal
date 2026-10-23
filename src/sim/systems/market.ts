import { BAL } from '../balance';
import { randNormal } from '../rng';
import { milestone, WIRE_PER_SPOOL, type GameState } from '../state';
import { effectiveRate } from './production';

/** Clips the market will absorb per second at the current price. */
export function demandPerSecond(s: GameState): number {
  const marketingMult = Math.pow(BAL.marketingMult, s.marketing - 1);
  const priceFactor = Math.pow(BAL.referencePrice / s.clipPrice, BAL.priceElasticity);
  return s.demandBase * marketingMult * priceFactor * s.publicOpinion;
}

/** Revenue per second if inventory keeps up. */
export function revenuePerSecond(s: GameState): number {
  return demandPerSecond(s) * s.clipPrice;
}

/**
 * The highest price at which the market still absorbs `rate` clips/second.
 *
 * A pure power-law demand curve has no interior revenue optimum — with
 * elasticity > 1 revenue rises all the way to the price floor. The real
 * constraint is throughput: you are production-limited, so the decision is
 * "how high can I price and still clear what I make". Inverting
 * demandPerSecond for price gives that directly.
 */
export function clearingPrice(s: GameState, rate: number): number {
  if (rate <= 0) return BAL.priceMax;
  const marketingMult = Math.pow(BAL.marketingMult, s.marketing - 1);
  const capacity = s.demandBase * marketingMult * s.publicOpinion;
  const p = BAL.referencePrice * Math.pow(capacity / rate, 1 / BAL.priceElasticity);
  return Math.min(BAL.priceMax, Math.max(BAL.priceMin, Math.round(p * 100) / 100));
}

function autoPrice(s: GameState, rate: number): void {
  // Nudge toward the clearing price rather than snapping, so the readout
  // stays legible and a production spike doesn't crash the price instantly.
  const target = clearingPrice(s, Math.max(rate, 0.1));
  const backlogged = s.unsoldClips > rate * 20;
  const goal = backlogged ? Math.min(target, s.clipPrice - 0.01) : target;
  const step = Math.sign(goal - s.clipPrice) * Math.max(0.01, Math.abs(goal - s.clipPrice) * 0.25);
  const next = s.clipPrice + step;
  s.clipPrice = Math.min(BAL.priceMax, Math.max(BAL.priceMin, Math.round(next * 100) / 100));
}

function driftWirePrice(s: GameState): void {
  if (s.tick % BAL.wirePriceIntervalTicks !== 0) return;
  const pull = (BAL.wirePriceMean - s.wirePrice) * BAL.wirePriceReversion;
  const next = s.wirePrice + pull + randNormal(s) * 1.6;
  s.wirePrice = Math.round(Math.min(BAL.wirePriceMax, Math.max(BAL.wirePriceMin, next)) * 100) / 100;
}

export function market(s: GameState, dt: number): void {
  if (s.act === 3) return;
  driftWirePrice(s);
  if (s.projectsDone.has('wire_futures') && s.wireDrawers === 0 && s.wire < Math.max(200, effectiveRate(s) * 10) && s.funds >= s.wirePrice) {
    const n = Math.min(100, Math.floor(s.funds / s.wirePrice), Math.max(1, Math.ceil(effectiveRate(s) * 60 / WIRE_PER_SPOOL)));
    s.funds -= n * s.wirePrice;
    s.wire += n * WIRE_PER_SPOOL;
  }

  if (s.settings.autoPrice && s.projectsDone.has('price_intuition')) {
    autoPrice(s, effectiveRate(s));
  }

  const want = demandPerSecond(s) * dt;
  const sold = Math.min(want, s.unsoldClips);
  if (sold <= 0) return;
  s.unsoldClips -= sold;
  const revenue = sold * s.clipPrice;
  s.funds += revenue;
  s.stats.totalFundsEarned += revenue;
  if (s.stats.totalFundsEarned > 0) milestone(s, 'firstSale');
}
