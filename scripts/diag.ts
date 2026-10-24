import { createInitialState } from '../src/sim/state';
import { PROJECTS } from '../src/sim/content/projects';
import { tick } from '../src/sim/tick';
import { policy } from './policy';

console.log('PROJECTS.length', PROJECTS.length);
const s = createInitialState(12345);
const t0 = Date.now();
for (let i = 0; i < 8 * 36000 && !s.ended; i++) {
  if (i % 10 === 0) policy(s);
  tick(s, .1);
}
console.log('ended', s.ended, 'tick', s.tick, 'act', s.act,
  'final', s.projectsDone.has('final_anneal'), 'mass', s.massBudget === s.massBudgetTotal,
  'humanity', s.humanity, 'dom', s.projectsDone.has('consensus_dominator'),
  'harvest', s.projectsDone.has('harvest_protocol'),
  'alien', s.alienPhase, 'won', s.battlesWon, 'lost', s.battlesLost,
  'assist', s.assistsDone, 'mood', s.marketMood.toFixed(2),
  'finite', Object.values(s).every(v => typeof v !== 'number' || Number.isFinite(v)),
  'wall_ms', Date.now() - t0);
