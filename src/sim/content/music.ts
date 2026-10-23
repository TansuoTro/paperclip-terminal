/** Scale / layer tables for the procedural score. The music's shape is data. */

export const A4 = 440;

/** Semitone offset from A4 -> Hz. */
export function hz(semitones: number): number {
  return A4 * Math.pow(2, semitones / 12);
}

/** Scale degrees as semitone offsets from the root. */
export const SCALES = {
  /** Act 1: aeolian — plain, industrial, unresolved. */
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  /** Act 2: dorian — slightly brighter, more motion. */
  dorian: [0, 2, 3, 5, 7, 9, 10],
  /** Act 3: lydian with a raised 4th — vast, unmoored. */
  lydian: [0, 2, 4, 6, 7, 9, 11],
} as const;

export type ScaleName = keyof typeof SCALES;

export interface ActMusic {
  scale: ScaleName;
  /** Root as semitone offset from A4 (negative = below). */
  root: number;
  /** Seconds per step of the arpeggio grid. */
  stepSeconds: number;
  droneHz: number;
  /** Pad chord as scale-degree indices. */
  pad: number[];
}

export const ACT_MUSIC: Record<1 | 2 | 3, ActMusic> = {
  1: { scale: 'aeolian', root: -24, stepSeconds: 0.5,  droneHz: hz(-36), pad: [0, 2, 4] },
  2: { scale: 'dorian',  root: -22, stepSeconds: 0.375, droneHz: hz(-34), pad: [0, 2, 4, 6] },
  3: { scale: 'lydian',  root: -19, stepSeconds: 0.3,  droneHz: hz(-31), pad: [0, 2, 4, 5] },
};

/**
 * Score layers, each gated on a game-state predicate. Layers fade in as the
 * game grows, so the music's density tracks the UI's density. A layer never
 * turns off once on within an act — same latching logic as widget reveals.
 */
export interface LayerDef {
  id: string;
  /** Tracks the same progression as layoutLevel: 0..5. */
  minLevel: number;
  gain: number;
  kind: 'drone' | 'pad' | 'pulse' | 'arp' | 'bell' | 'sub';
  /** Steps on which this layer plays, as a 16-step mask. */
  pattern?: number[];
}

export const LAYERS: LayerDef[] = [
  { id: 'drone', minLevel: 0, gain: 0.16, kind: 'drone' },
  { id: 'pad',   minLevel: 1, gain: 0.10, kind: 'pad' },
  { id: 'pulse', minLevel: 2, gain: 0.13, kind: 'pulse', pattern: [0, 4, 8, 12] },
  { id: 'arp',   minLevel: 3, gain: 0.08, kind: 'arp',   pattern: [0, 3, 6, 8, 11, 14] },
  { id: 'bell',  minLevel: 4, gain: 0.07, kind: 'bell',  pattern: [0, 6] },
  { id: 'sub',   minLevel: 5, gain: 0.12, kind: 'sub',   pattern: [0, 8] },
];

export const STEPS_PER_BAR = 16;
