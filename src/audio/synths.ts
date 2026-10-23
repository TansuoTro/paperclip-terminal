/** Procedural synthesis primitives. No audio files anywhere in this project. */

export interface Bus {
  ctx: AudioContext;
  music: GainNode;
  sfx: GainNode;
  master: GainNode;
}

/** Shared reverb built from generated noise — no impulse-response file. */
export function makeReverb(ctx: AudioContext, seconds = 2.6, decay = 2.4): ConvolverNode {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  return conv;
}

export function makeNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export interface ToneOpts {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  release?: number;
  detune?: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number };
  glideTo?: number;
}

/** One-shot enveloped oscillator. Nodes are disposed on ended. */
export function tone(ctx: AudioContext, dest: AudioNode, at: number, o: ToneOpts): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, at);
  if (o.detune) osc.detune.setValueAtTime(o.detune, at);
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.glideTo), at + o.dur);

  const g = ctx.createGain();
  const peak = o.gain ?? 0.2;
  const atk = o.attack ?? 0.008;
  const rel = o.release ?? Math.max(0.05, o.dur * 0.6);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, at + atk + o.dur + rel);

  let node: AudioNode = osc;
  if (o.filter) {
    const f = ctx.createBiquadFilter();
    f.type = o.filter.type;
    f.frequency.setValueAtTime(o.filter.freq, at);
    if (o.filter.q) f.Q.setValueAtTime(o.filter.q, at);
    osc.connect(f);
    node = f;
  }
  node.connect(g).connect(dest);

  osc.start(at);
  osc.stop(at + atk + o.dur + rel + 0.05);
  osc.onended = () => { try { g.disconnect(); osc.disconnect(); } catch { /* already gone */ } };
}

/** Filtered noise burst — used for machine hits and impacts. */
export function noiseHit(
  ctx: AudioContext, dest: AudioNode, at: number, buf: AudioBuffer,
  o: { dur: number; gain?: number; freq?: number; q?: number; type?: BiquadFilterType },
): void {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 1800, at);
  f.Q.setValueAtTime(o.q ?? 1.2, at);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.15, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  src.connect(f).connect(g).connect(dest);
  src.start(at);
  src.stop(at + o.dur + 0.05);
  src.onended = () => { try { g.disconnect(); f.disconnect(); src.disconnect(); } catch { /* ok */ } };
}

/** Continuous hum with slow drift — the terminal's own noise floor. */
export function createDrone(
  ctx: AudioContext, dest: AudioNode, freq: number, gain: number,
): { gain: GainNode; stop(): void } {
  const a = ctx.createOscillator();
  const b = ctx.createOscillator();
  a.type = 'sawtooth'; b.type = 'sawtooth';
  a.frequency.value = freq;
  b.frequency.value = freq;
  b.detune.value = 7;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = freq * 6;
  lp.Q.value = 0.7;

  // Slow filter wobble so the pad never sits perfectly still.
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = freq * 1.5;
  lfo.connect(lfoGain).connect(lp.frequency);

  const g = ctx.createGain();
  g.gain.value = 0;

  a.connect(lp); b.connect(lp);
  lp.connect(g).connect(dest);
  a.start(); b.start(); lfo.start();

  // Ramp in rather than clicking on.
  g.gain.setTargetAtTime(gain, ctx.currentTime, 1.5);

  return {
    gain: g,
    stop() {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
      const t = ctx.currentTime + 4;
      a.stop(t); b.stop(t); lfo.stop(t);
    },
  };
}
