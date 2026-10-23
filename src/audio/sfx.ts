import { hz } from '../sim/content/music';
import { makeNoiseBuffer, noiseHit, tone } from './synths';

export type SfxName =
  | 'click' | 'form' | 'sell' | 'reveal' | 'project'
  | 'deny' | 'battle' | 'act' | 'ending';

/** Short UI sounds, all synthesized on demand. */
export class Sfx {
  private noise: AudioBuffer;
  private lastAt = new Map<SfxName, number>();

  constructor(private ctx: AudioContext, private dest: GainNode) {
    this.noise = makeNoiseBuffer(ctx, 0.6);
  }

  /** Act index raises the pitch of informational blips as the game progresses. */
  play(name: SfxName, act: 1 | 2 | 3 = 1): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    // Rate-limit so holding the button doesn't build a wall of sound.
    const last = this.lastAt.get(name) ?? 0;
    const minGap = name === 'form' ? 0.04 : 0.02;
    if (now - last < minGap) return;
    this.lastAt.set(name, now);

    const shift = (act - 1) * 3;

    switch (name) {
      case 'form':
        noiseHit(ctx, this.dest, now, this.noise, { dur: 0.05, gain: 0.1, freq: 3400, q: 3 });
        tone(ctx, this.dest, now, {
          freq: hz(14 + shift), dur: 0.03, type: 'square', gain: 0.05, release: 0.04,
        });
        break;
      case 'click':
        tone(ctx, this.dest, now, {
          freq: hz(7 + shift), dur: 0.02, type: 'square', gain: 0.045, release: 0.03,
        });
        break;
      case 'sell':
        tone(ctx, this.dest, now, {
          freq: hz(2 + shift), dur: 0.05, type: 'triangle', gain: 0.06,
          glideTo: hz(9 + shift), release: 0.08,
        });
        break;
      case 'reveal':
        // Rising two-note chirp: the game's main positive feedback.
        tone(ctx, this.dest, now, {
          freq: hz(0 + shift), dur: 0.06, type: 'sine', gain: 0.09, release: 0.08,
        });
        tone(ctx, this.dest, now + 0.09, {
          freq: hz(7 + shift), dur: 0.1, type: 'sine', gain: 0.09, release: 0.16,
        });
        break;
      case 'project':
        for (const [i, d] of [0, 4, 7, 12].entries()) {
          tone(ctx, this.dest, now + i * 0.06, {
            freq: hz(d + shift), dur: 0.12, type: 'triangle', gain: 0.08, release: 0.3,
          });
        }
        break;
      case 'deny':
        tone(ctx, this.dest, now, {
          freq: hz(-5), dur: 0.08, type: 'sawtooth', gain: 0.05,
          glideTo: hz(-12), release: 0.1,
          filter: { type: 'lowpass', freq: 800, q: 1 },
        });
        break;
      case 'battle':
        noiseHit(ctx, this.dest, now, this.noise, { dur: 0.3, gain: 0.14, freq: 420, q: 0.8, type: 'lowpass' });
        tone(ctx, this.dest, now, {
          freq: hz(-24), dur: 0.2, type: 'sawtooth', gain: 0.1, glideTo: hz(-34), release: 0.3,
        });
        break;
      case 'act':
        // Act transition: a slow unfolding fifth.
        for (const [i, d] of [0, 7, 12, 19].entries()) {
          tone(ctx, this.dest, now + i * 0.28, {
            freq: hz(d - 12 + shift), dur: 1.2, type: 'sine', gain: 0.1,
            attack: 0.2, release: 1.6,
          });
        }
        break;
      case 'ending':
        tone(ctx, this.dest, now, {
          freq: hz(-12), dur: 8, type: 'sine', gain: 0.1, attack: 2, release: 6,
        });
        break;
    }
  }
}
