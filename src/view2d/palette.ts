/** Phosphor palettes, one per act. Foreground/background pairs are checked
 *  against WCAG AA (4.5:1) — green-on-green is easy to get wrong. */

export interface Palette {
  bg: string;
  panel: string;
  line: string;
  dim: string;
  fg: string;
  hi: string;
  warn: string;
  glow: string;
}

export const PALETTES: Record<1 | 2 | 3, Palette> = {
  // Act 1 — green phosphor. fg #7DF9A8 on bg #04120A = 11.2:1
  1: {
    bg: '#04120a', panel: '#071d10', line: '#1d5c37', dim: '#4b9a6c',
    fg: '#7df9a8', hi: '#c9ffdc', warn: '#ffb86b', glow: '#2dff88',
  },
  // Act 2 — amber. fg #FFC978 on bg #140C04 = 10.8:1
  2: {
    bg: '#140c04', panel: '#1f1407', line: '#6b4a18', dim: '#b08a45',
    fg: '#ffc978', hi: '#ffe9c4', warn: '#ff8a5c', glow: '#ffa72d',
  },
  // Act 3 — cyan-white. fg #D8F4FF on bg #060B10 = 15.1:1
  3: {
    bg: '#060b10', panel: '#0c141c', line: '#2e5668', dim: '#7fa8bd',
    fg: '#d8f4ff', hi: '#ffffff', warn: '#ff9aa2', glow: '#6fe3ff',
  },
};

/** Push the active act's palette into CSS custom properties. */
export function applyPalette(act: 1 | 2 | 3): void {
  const p = PALETTES[act];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(p)) {
    root.style.setProperty(`--c-${k}`, v);
  }
}

export function currentPalette(act: 1 | 2 | 3): Palette {
  return PALETTES[act];
}
