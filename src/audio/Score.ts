import { ACT_MUSIC, hz, LAYERS, SCALES, STEPS_PER_BAR, type ActMusic } from '../sim/content/music';
import { createDrone, makeNoiseBuffer, makeReverb, noiseHit, tone } from './synths';

/**
 * Lookahead step sequencer. We schedule a window of events into WebAudio's
 * clock rather than firing notes from requestAnimationFrame, so the rhythm
 * stays solid even when the render loop stutters.
 */
const LOOKAHEAD_S = 0.25;
const SCHEDULE_EVERY_MS = 80;

export class Score {
  private ctx: AudioContext;
  private out: GainNode;
  private reverb: ConvolverNode;
  private wet: GainNode;
  private noise: AudioBuffer;
  private drone: { gain: GainNode; stop(): void } | null = null;

  private step = 0;
  private bar = 0;
  private ending = false;
  private nextStepTime = 0;
  private timer: number | null = null;

  private act: 1 | 2 | 3 = 1;
  private level = 0;
  private intensity = 0;
  private layerGains = new Map<string, GainNode>();
  private activeLayers = new Set<string>();

  constructor(ctx: AudioContext, destination: GainNode) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.out.connect(destination);

    this.reverb = makeReverb(ctx, 3.2, 2.2);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.35;
    this.reverb.connect(this.wet).connect(this.out);

    this.noise = makeNoiseBuffer(ctx, 1.5);

    for (const l of LAYERS) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.out);
      g.connect(this.reverb);
      this.layerGains.set(l.id, g);
    }
  }

  private cfg(): ActMusic {
    return ACT_MUSIC[this.act];
  }

  /** Scale degree -> Hz for the current act. */
  private note(degree: number, octave = 0): number {
    const c = this.cfg();
    const scale = SCALES[c.scale];
    const n = scale.length;
    const idx = ((degree % n) + n) % n;
    const oct = Math.floor(degree / n) + octave;
    return hz(c.root + scale[idx]! + oct * 12);
  }

  start(): void {
    if (this.timer !== null) return;
    this.ending = false;
    this.activeLayers.clear();
    this.nextStepTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), SCHEDULE_EVERY_MS);
    this.syncLayers();
  }

  stop(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    this.drone?.stop();
    this.drone = null;
    this.activeLayers.clear();
  }

  /** Called from the render loop; cheap, only reacts to changes. */
  update(act: 1 | 2 | 3, level: number, intensity: number): void {
    if (this.ending) return;
    this.intensity = Math.max(0, Math.min(1, intensity));
    const actChanged = act !== this.act;
    this.act = act;
    if (actChanged) this.retune();
    if (level !== this.level || actChanged) {
      this.level = level;
      this.syncLayers();
    }
  }

  private retune(): void {
    if (this.drone) {
      this.drone.stop();
      this.drone = null;
    }
    this.syncLayers();
  }

  private syncLayers(): void {
    for (const l of LAYERS) {
      const want = this.level >= l.minLevel;
      const g = this.layerGains.get(l.id)!;
      if (want && !this.activeLayers.has(l.id)) {
        this.activeLayers.add(l.id);
        if (l.kind === 'drone') {
          this.drone = createDrone(this.ctx, g, this.cfg().droneHz, 1);
        }
        g.gain.setTargetAtTime(l.gain, this.ctx.currentTime, 2.0);
      } else if (!want && this.activeLayers.has(l.id)) {
        this.activeLayers.delete(l.id);
        g.gain.setTargetAtTime(0, this.ctx.currentTime, 1.5);
      }
    }
    if (this.activeLayers.has('drone') && !this.drone) {
      this.drone = createDrone(this.ctx, this.layerGains.get('drone')!, this.cfg().droneHz, 1);
    }
  }

  private schedule(): void {
    if (this.ctx.state !== 'running') return;
    if (this.nextStepTime < this.ctx.currentTime - .1) this.nextStepTime = this.ctx.currentTime + .05;
    const horizon = this.ctx.currentTime + LOOKAHEAD_S;
    const stepDur = this.cfg().stepSeconds;
    let guard = 0;
    while (this.nextStepTime < horizon && guard++ < 64) {
      this.emit(this.step, this.nextStepTime);
      this.nextStepTime += stepDur;
      this.step = (this.step + 1) % STEPS_PER_BAR;
      if (this.step === 0) this.bar++;
    }
  }

  private emit(step: number, at: number): void {
    const bar = this.bar;
    const root = [0, 5, 3, 4][bar % 4]!;

    for (const l of LAYERS) {
      if (!this.activeLayers.has(l.id)) continue;
      const dest = this.layerGains.get(l.id)!;
      if (l.pattern && !l.pattern.includes(step)) continue;

      switch (l.kind) {
        case 'pad':
          if (step !== 0) break;
          for (const d of this.cfg().pad) {
            tone(this.ctx, dest, at, {
              freq: this.note(d + root, 1), dur: this.stepsToSec(14),
              type: 'triangle', gain: 0.12, attack: 1.2, release: 2.0,
              filter: { type: 'lowpass', freq: 1200, q: 0.6 },
            });
          }
          break;
        case 'pulse':
          noiseHit(this.ctx, dest, at, this.noise, {
            dur: 0.09, gain: 0.1 + this.intensity * 0.12,
            freq: 2600, q: 1.6,
          });
          break;
        case 'arp': {
          const degree = root + [0, 2, 4, 2, 1, 4][(step + bar) % 6]!;
          tone(this.ctx, dest, at, {
            freq: this.note(degree, 2), dur: 0.1, type: 'square', gain: 0.05,
            filter: { type: 'lowpass', freq: 3000 + this.intensity * 4000, q: 1.1 },
          });
          break;
        }
        case 'bell':
          tone(this.ctx, dest, at, {
            freq: this.note(root + [0, 4, 2, 1][bar % 4]!, 3), dur: 0.5,
            type: 'sine', gain: 0.07, attack: 0.004, release: 1.4,
          });
          break;
        case 'sub':
          tone(this.ctx, dest, at, {
            freq: this.note(root, -1), dur: 0.45, type: 'sine',
            gain: 0.16, attack: 0.03, release: 0.5,
          });
          break;
        case 'drone':
          break;
      }
    }
  }

  /** The ending: everything decays to a single tone, then silence. */
  playEnding(): void {
    this.ending = true;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    const now = this.ctx.currentTime;
    for (const [, g] of this.layerGains) g.gain.setTargetAtTime(0, now, 3.0);
    this.drone?.stop();
    this.drone = null;
    tone(this.ctx, this.out, now + 1, {
      freq: this.note(0, 1), dur: 24, type: 'sine',
      gain: 0.12, attack: 3, release: 14,
    });
  }

  private stepsToSec(steps: number): number {
    return steps * this.cfg().stepSeconds;
  }
}
