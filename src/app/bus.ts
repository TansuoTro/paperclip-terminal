import { signal } from '@preact/signals';
import { applyAll, type Command } from '../sim/commands';
import { takePendingReveals } from '../sim/reveal';
import type { GameState } from '../sim/state';

export class Bus {
  readonly version = signal(0);
  readonly revealQueue = signal<string[]>([]);
  private queued: Command[] = [];
  constructor(public state: GameState) {}
  dispatch(cmds: Command[] | Command): void {
    this.queued.push(...(Array.isArray(cmds) ? cmds : [cmds]));
  }
  flush(): boolean {
    if (!this.queued.length) return false;
    applyAll(this.state, this.queued);
    this.queued.length = 0;
    return true;
  }
  publish(): void {
    const pending = takePendingReveals(this.state);
    if (pending.length) this.revealQueue.value = [...this.revealQueue.value, ...pending].slice(-100);
    this.version.value++;
  }
  consumeReveal(id: string): void {
    this.revealQueue.value = this.revealQueue.value.filter(x => x !== id);
  }
  replace(next: GameState): void {
    this.queued.length = 0;
    this.state = next;
    this.revealQueue.value = [];
    this.version.value++;
  }
}

export let bus: Bus;
export function initBus(state: GameState): Bus { return bus = new Bus(state); }
