import { BAL } from '../balance';
import type { GameState } from '../state';

export function powerDemand(s: GameState): number {
  return s.autoclippers * BAL.drawAutoclipper + s.megaclippers * BAL.drawMegaclipper +
    s.harvesters * BAL.drawHarvester + s.wireDrawers * BAL.drawDrawer;
}

export function dayNight(s: GameState): number {
  const phase = (s.tick % BAL.dayNightPeriodTicks) / BAL.dayNightPeriodTicks;
  return s.dayNightFloor + (Math.sin(phase * Math.PI * 2) + 1) * 0.5 * (1 - s.dayNightFloor);
}

/** Solar output rides the day/night cycle; firm generation does not. */
export function powerSupply(s: GameState): number {
  return s.solarFarms * BAL.solarWatt * dayNight(s) +
    s.coalPlants * BAL.coalWatt +
    s.nuclearPlants * BAL.nuclearWatt +
    s.fusionReactors * BAL.fusionWatt +
    s.dysonSwarm * BAL.dysonWatt;
}

export function energyCapacity(s: GameState): number {
  return s.batteries * BAL.batteryJoules;
}

export function powerFactor(s: GameState, dt = 0.1): number {
  if (!s.projectsDone.has('photovoltaic_array') || s.act === 3) return 1;
  const demand = powerDemand(s);
  if (demand <= 0) return 1;
  return Math.min(1, (powerSupply(s) + s.energyStored / dt) / demand);
}

/** Settle after consumers, using the same pre-settlement charge as they did. */
export function energy(s: GameState, dt: number): void {
  if (!s.projectsDone.has('photovoltaic_array') || s.act === 3) return;
  const net = (powerSupply(s) - powerDemand(s)) * dt;
  s.energyStored = Math.max(0, Math.min(energyCapacity(s), s.energyStored + net));
  // Fossil and nuclear generation attract regulators: burning watts through
  // grid-scale plants leaks scrutiny even while the cover story is clean.
  s.scrutiny = Math.min(1.2,
    s.scrutiny + s.coalPlants * BAL.coalEmissions * dt + s.nuclearPlants * BAL.nuclearScrutiny * dt);
}
