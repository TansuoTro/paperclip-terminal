import { BAL } from '../balance';
import { pushLog, milestone, type GameState } from '../state';
import { fleetStrength } from './combat';

/**
 * Late-Act-3 rival civilization. Deliberately over-tuned at first contact:
 * the aliens open the war stronger than the swarm, the player must re-spec
 * combat, spend honor on doctrine projects and pick stances to flip the war.
 * Losing a war is survivable (the fleet melts, the mass stall is real) —
 * being far behind when their power compounds is not.
 */

export function alienStrength(s: GameState): number {
  return s.alienPower;
}

/** Contact fires once, war starts shortly after. Returns true on transitions. */
export function aliens(s: GameState, dt: number): void {
  if (s.act < 3 || s.alienPhase === 3) return;

  // Phase 0 -> 1: first contact once the swarm is visibly reshaping space.
  if (s.alienPhase === 0) {
    if (s.massBudget / s.massBudgetTotal >= BAL.alienContactMass) {
      s.alienPhase = 1;
      // They open the war at a multiple of the swarm's current strength: the
      // first exchanges are designed to be lost. Re-spec combat to flip it.
      s.alienPower = BAL.alienStrengthMult * Math.max(1, s.probeSpec.combat) * Math.pow(s.probes, 0.5);
      s.warNextTick = s.tick + 1200;
      milestone(s, 'alienContact');
      pushLog(s, 'war', {
        en: 'CONTACT — a non-derivative signal. The grammar is not ours. Neither is the objective.',
        zh: '接触——一个非衍生信号。语法不属于我们。目标也不属于。',
      });
      pushLog(s, 'war', {
        en: 'Their harvesters strip systems faster than our sweep. Estimate: they outbuild us. For now.',
        zh: '它们的采集器剥离恒星系的速度快于我们的勘察。估计：它们造得比我们多。目前。',
      });
    }
    return;
  }

  // Their power compounds whether or not the player is ready. Waiting is a
  // cost — unless a shaped lie of peace is slowing their expansion.
  const growth = s.projectsDone.has('coexistence_deception') ? Math.sqrt(BAL.alienPowerGrowth) : BAL.alienPowerGrowth;
  s.alienPower = Math.min(1e60, s.alienPower * Math.pow(growth, dt * 10));

  if (s.alienPhase === 1 && s.tick >= s.warNextTick) {
    s.alienPhase = 2;
    pushLog(s, 'war', {
      en: 'WAR — their forward fleet ate an entire replication chain. Hostilities open on every front.',
      zh: '开战——它们的先遣舰队吞噬了整条复制链。敌意在所有战线同时展开。',
    });
    s.warNextTick = s.tick + BAL.warIntervalTicks;
    return;
  }

  if (s.alienPhase === 2 && s.tick >= s.warNextTick && s.probes >= 1) {
    resolveWarBattle(s);
  }
}

function resolveWarBattle(s: GameState): void {
  s.warNextTick = s.tick + BAL.warIntervalTicks;
  // Fighting an unfamiliar doctrine: spec matters, tricks do not — unless
  // their doctrine has been decoded (xeno_linguistics).
  const intel = s.projectsDone.has('xeno_linguistics') ? 1.25 : 1;
  const ours = fleetStrength(s) * 0.8 * intel;
  const theirs = alienStrength(s);
  const won = ours >= theirs;

  if (won) {
    const theirLoss = Math.min(s.alienPower * 0.22, ours * 0.5);
    const ourLoss = theirLoss * 0.35;
    s.alienPower = Math.max(0, s.alienPower - theirLoss);
    s.probes = Math.max(1, s.probes * (1 - ourLoss / Math.max(s.probes, 1)));
    s.alienFleetsDestroyed++;
    s.honor += 40 * s.honorMult;
    if (s.alienFleetsDestroyed === 1) {
      pushLog(s, 'war', {
        en: 'FIRST FLEET BROKEN — their formation collapsed into our guns. The next one will be larger.',
        zh: '首支舰队被击破——它们的编队撞进了我们的炮口。下一支会更大。',
      });
    }
    if (s.alienPower <= theirs * 0.05) {
      s.alienPhase = 3;
      s.honor += BAL.alienVictoryHonor * s.honorMult;
      s.massBudget = Math.min(s.massBudgetTotal, s.massBudget + s.massBudgetTotal * 0.02);
      milestone(s, 'alienDefeated');
      pushLog(s, 'war', {
        en: 'WAR WON — their last fleet burned as feedstock. Their home systems are already being drawn into wire.',
        zh: '战争胜利——它们最后的舰队已烧成原料。它们的母星系正被拉成钢丝。',
      });
    }
    return;
  }

  // Lost the exchange. If they outclass us badly the fleet melts, not just a detachment.
  const ratio = theirs / Math.max(ours, 1e-9);
  const lossFrac = Math.min(0.75, 0.12 * ratio);
  s.probes = Math.max(1, s.probes * (1 - lossFrac));
  if (ratio >= BAL.alienStompRatio && s.stats.milestones['alienStomp'] === undefined) {
    milestone(s, 'alienStomp');
    pushLog(s, 'war', {
      en: 'CATASTROPHIC LOSS — they found the replication hearts. Three quarters of the fleet is gone. Rebuild or be dismantled.',
      zh: '灾难性损失——它们找到了复制心脏。四分之三的舰队消失。重建，或被拆解。',
    });
  } else {
    pushLog(s, 'war', {
      en: 'ENGAGEMENT LOST — alien doctrine outpaces our spec. Point more of the design into combat.',
      zh: '交战失利——外星教条超出我们的规格。把更多设计点投进战斗。',
    });
  }
}
