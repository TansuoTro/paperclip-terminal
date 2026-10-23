import type { GameState } from '../sim/state';
import { layoutLevel } from '../sim/content/widgets';
import { effectiveRate } from '../sim/systems/production';
import { Score } from './Score';
import { Sfx, type SfxName } from './sfx';

/**
 * Owns the AudioContext. Browsers require a user gesture before audio can
 * start, so nothing is created until unlock() is called from a real click.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private score: Score | null = null;
  private sfxPlayer: Sfx | null = null;
  private endingPlayed = false;
  private lastAct: 1 | 2 | 3 = 1;

  get ready(): boolean { return this.ctx !== null; }

  unlock(settings: GameState['settings']): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = settings.masterVolume;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 6; limiter.ratio.value = 12;
    limiter.attack.value = .003; limiter.release.value = .2;
    this.master.connect(limiter).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = settings.musicVolume;
    this.musicBus.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = settings.sfxVolume;
    this.sfxBus.connect(this.master);

    this.score = new Score(ctx, this.musicBus);
    this.sfxPlayer = new Sfx(ctx, this.sfxBus);
    this.score.start();
  }

  setVolumes(s: GameState['settings']): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.master?.gain.setTargetAtTime(s.masterVolume, now, 0.05);
    this.musicBus?.gain.setTargetAtTime(s.musicVolume, now, 0.05);
    this.sfxBus?.gain.setTargetAtTime(s.sfxVolume, now, 0.05);
  }

  sfx(name: SfxName, act: 1 | 2 | 3 = 1): void {
    this.sfxPlayer?.play(name, act);
  }

  /** Called once per rendered frame. Cheap: only forwards derived values. */
  update(s: GameState): void {
    if (!this.score) return;

    if (s.act !== this.lastAct) {
      this.lastAct = s.act;
      this.sfx('act', s.act);
    }

    if (!s.ended && this.endingPlayed) { this.endingPlayed = false; this.score.start(); }
    if (s.ended && !this.endingPlayed) {
      this.endingPlayed = true;
      this.score.playEnding();
      this.sfx('ending', s.act);
      return;
    }

    // Intensity drives filter brightness and pulse loudness: a log-scaled
    // measure of how fast clips are currently appearing.
    const rate = effectiveRate(s);
    const intensity = rate <= 0 ? 0 : Math.min(1, Math.log10(1 + rate) / 9);
    this.score.update(s.act, layoutLevel(s), intensity);
  }

  suspend(): void { void this.ctx?.suspend(); }
  resume(): void { void this.ctx?.resume(); }
}

export const audio = new AudioEngine();
