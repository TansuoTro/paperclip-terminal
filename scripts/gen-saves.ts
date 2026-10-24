import fs from 'node:fs';
import { createInitialState } from '../src/sim/state';
import { tick } from '../src/sim/tick';
import { exportString } from '../src/sim/save';
import { policy } from './policy';

function runTo(targetTick: number): string {
  const s = createInitialState(12345);
  for (let i = 0; i < targetTick * 10 && !s.ended; i++) {
    if (i % 10 === 0) policy(s);
    tick(s, .1);
  }
  return exportString(s);
}

fs.writeFileSync('_save_act2.txt', runTo(13000));
fs.writeFileSync('_save_act3.txt', runTo(25000));
console.log('saves written');
