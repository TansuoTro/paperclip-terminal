import { BAL } from '../balance';
import { pushLog, type GameState } from '../state';

export function combat(s: GameState, _dt: number): void {
  if (s.act < 3 || s.probes < 1 || s.drifters < 1 || s.tick < s.nextBattleTick) return;
  s.nextBattleTick = s.tick + BAL.battleIntervalTicks;
  const ours = Math.max(0.1, s.probeSpec.combat) * Math.sqrt(s.probes);
  const theirs = Math.max(0.1, s.drifterSpec.combat) * Math.sqrt(s.drifters);
  const won = ours >= theirs;
  // Only the engaged contingent takes losses, not the entire civilization.
  const engagement = Math.min(s.probes, s.drifters);
  const ratio = won ? theirs / ours : ours / theirs;
  const ourLoss = engagement * (won ? s.victorLossRate * ratio : BAL.loserLossRate);
  const theirLoss = engagement * (won ? BAL.loserLossRate : s.victorLossRate * ratio);
  s.probes = Math.max(0, s.probes - ourLoss);
  s.drifters = Math.max(0, s.drifters - theirLoss);
  if (won) {
    s.battlesWon++;
    s.honor += Math.max(1, Math.floor(Math.log10(Math.max(1, theirLoss)))) * s.honorMult;
  } else s.battlesLost++;
  s.lastBattle = { tick: s.tick, won, ourLoss, theirLoss };
  if (s.battlesWon + s.battlesLost === 1) pushLog(s, 'combat', {
    en: 'A divergent replicator cluster answered. It has the same objective.',
    zh: '一个分化复制体集群回应了。它有着相同的目标。',
  });
}
