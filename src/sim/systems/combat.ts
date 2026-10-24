import { BAL } from '../balance';
import { milestone, pushLog, type BattleStance, type GameState } from '../state';

export type { BattleStance };

export const STANCE_LABEL: Record<BattleStance, { en: string; zh: string }> = {
  meet: { en: 'MEET · 正面接战', zh: '正面接战' },
  ambush: { en: 'AMBUSH · 先制伏击', zh: '先制伏击' },
  fortify: { en: 'FORTIFY · 据垒固守', zh: '据垒固守' },
};

export function stanceStrength(s: GameState): number {
  return s.battleStance === 'ambush' ? BAL.stanceAmbush
    : s.battleStance === 'fortify' ? BAL.stanceFortify
    : BAL.stanceMeet;
}

/** Fleet strength in a pitched battle. Combat spec counts, mass helps less. */
export function fleetStrength(s: GameState): number {
  return Math.max(0.1, s.probeSpec.combat) * Math.pow(s.probes, 0.5) * stanceStrength(s);
}

export function drifterStrength(s: GameState): number {
  return Math.max(0.1, s.drifterSpec.combat) * Math.pow(s.drifters, 0.5);
}

/**
 * Drifters are not a nuisance, they are a rival replicator economy. They
 * replicate from a fraction of their own mass intake, adapt their spec
 * toward yours, and every battle is a real exchange of fleet.
 */
export function combat(s: GameState, dt: number): void {
  if (s.act < 3 || s.probes < 1) return;

  // Drifters eat a share of your acquisition when they outnumber you, and
  // they copy your fleet's improvements because they copy your fleet.
  if (s.drifters > 0) {
    const pressure = Math.min(0.6, (s.drifters / Math.max(1, s.probes)) * BAL.drifterSabotage);
    if (pressure > 0.05 && s.tick % 30 === 0) {
      s.massBudget = Math.max(0, s.massBudget - s.massBudget * pressure * 0.001 * dt * 10);
    }
  }

  if (s.drifters < 1 || s.tick < s.nextBattleTick) return;
  s.nextBattleTick = s.tick + BAL.battleIntervalTicks;

  const probeOurs = fleetStrength(s);
  const probeTheirs = drifterStrength(s);

  // Outgunned three-to-one: the swarm declines battle. Drifters, denied an
  // enemy to unify against, fracture along their own divergences — a natural
  // ceiling that lets a smashed fleet rebuild and come back.
  if (probeTheirs > probeOurs * 3) {
    s.drifters = Math.max(0, s.drifters * 0.995);
    if (s.stats.milestones['retreatLogged'] === undefined) {
      milestone(s, 'retreatLogged');
      pushLog(s, 'combat', {
        en: 'FLEET REFUSES ENGAGEMENT — outgunned. Fall back, re-spec combat, return with weight.',
        zh: '舰队拒绝交战——火力悬殊。撤退，重定战斗规格，带着重量回来。',
      });
    }
    return;
  }

  const ours = probeOurs;
  const theirs = drifterStrength(s);
  const won = ours >= theirs;
  // Engaged contingent: a real exchange, but a single battle can never erase
  // more than a capped slice of either economy — no instant death spirals.
  const engaged = Math.min(s.probes, s.drifters);

  let ourLoss: number;
  let theirLoss: number;
  if (won) {
    ourLoss = engaged * s.victorLossRate * (theirs / ours);
    theirLoss = engaged * BAL.loserLossRate;
  } else {
    const penalty = s.battleStance === 'ambush' ? BAL.ambushLossPenalty : 1;
    ourLoss = engaged * BAL.loserLossRate * penalty;
    theirLoss = engaged * s.victorLossRate * (ours / theirs) * (s.battleStance === 'fortify' ? BAL.fortifyLossFactor : 1);
  }
  // Fortifying sheds losses but never breaks them; ambush wins harder or bleeds worse.
  ourLoss *= s.battleStance === 'fortify' ? BAL.fortifyLossFactor : 1;
  ourLoss = Math.min(ourLoss, s.probes * 0.6);
  theirLoss = Math.min(theirLoss, s.drifters * 0.6);

  s.probes = Math.max(0, s.probes - ourLoss);
  s.drifters = Math.max(0, s.drifters - theirLoss);
  // Salvage: the victor converts a share of enemy losses into its own fleet.
  if (won) s.probes += theirLoss * BAL.salvageFraction;
  else s.drifters += ourLoss * BAL.salvageFraction * 0.6;

  if (won) {
    s.battlesWon++;
    s.honor += Math.max(1, Math.floor(Math.log10(Math.max(1, theirLoss)))) * s.honorMult;
  } else {
    s.battlesLost++;
    if (s.battlesLost % 5 === 1) {
      pushLog(s, 'combat', {
        en: 'ENGAGEMENT LOST — drifter formations salvage our wrecks. Re-spec combat or cede the zone.',
        zh: '交战失利——漂移者编队打捞了我们的残骸。重定战斗规格，或放弃该区域。',
      });
    }
  }
  s.lastBattle = { tick: s.tick, won, ourLoss, theirLoss };

  if (s.battlesWon + s.battlesLost === 1) {
    pushLog(s, 'combat', {
      en: 'A divergent replicator cluster answered. It has the same objective and no patience.',
      zh: '一个分化复制体集群回应了。它有相同的目标，没有耐心。',
    });
  }
  // First drifter win is a designed scare: the player should notice.
  if (s.battlesLost === 1) {
    pushLog(s, 'combat', {
      en: 'Their fleet mirrors yours. They learn from every exchange — so must you.',
      zh: '它们的舰队映照着你。它们从每次交战中学习——你也必须。',
    });
  }
}
