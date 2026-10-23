import { nextRandom } from '../rng';
import { pushLog, type GameState } from '../state';

/** Scheduling three workloads: burst beats steady, steady beats reserve,
 * reserve beats burst. Unlike a reflex game, the previous opponent choice
 * biases its next choice; the player can learn that distribution. */
export const PAYOFF = [[2, 5, 0], [0, 2, 5], [5, 0, 2]] as const;
export const TOURNAMENT_COST = 300;

export function playTournament(s: GameState, choice: number): void {
  if (!s.projectsDone.has('strategy_arena') || s.ops < TOURNAMENT_COST || s.tick < s.tournament.nextTick) return;
  if (!Number.isInteger(choice) || choice < 0 || choice > 2) return;
  s.ops -= TOURNAMENT_COST;
  const r = nextRandom(s);
  const opponent = r < 0.6 ? s.tournament.lastOpponent : r < 0.8 ? (s.tournament.lastOpponent + 1) % 3 : (s.tournament.lastOpponent + 2) % 3;
  const score = PAYOFF[choice]![opponent]!;
  const reward = 1 + score * 2;
  s.insight += reward;
  s.tournament = { rounds: s.tournament.rounds + 1, lastChoice: choice, lastOpponent: opponent, lastReward: reward, nextTick: s.tick + 100 };
  pushLog(s, 'system', { en: `Scheduler trial: +${reward} insight.`, zh: `调度试验：+${reward} 洞察。` });
}
