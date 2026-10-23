import { WIDGETS, WIDGETS_BY_ID } from './content/widgets';
import { pushLog, type GameState } from './state';

/**
 * The ONLY place state.revealed is written. Reveals are LATCHED: once a widget
 * is revealed it never un-reveals, so fluctuating values (funds dropping back
 * below a threshold) can't make the UI flicker, and loading a save can't lose
 * widgets whose trigger window has already passed.
 */
export function revealPass(s: GameState): void {
  for (const w of WIDGETS) {
    if (!s.revealed.has(w.id) && w.reveal(s)) {
      s.revealed.add(w.id);
      s.pendingReveals.push(w.id);
      pushLog(s, 'module', {
        en: `MODULE ONLINE — ${w.label(s).en}`,
        zh: `模块上线 — ${w.label(s).zh}`,
      });
    }
    if (!s.retired.has(w.id) && s.revealed.has(w.id) && w.retire?.(s)) {
      s.retired.add(w.id);
      pushLog(s, 'module', {
        en: `MODULE FOLDED — ${w.label(s).en}`,
        zh: `模块折叠 — ${w.label(s).zh}`,
      });
    }
  }
}

/** Drain the animation queue; the view plays an entrance per id. */
export function takePendingReveals(s: GameState): string[] {
  if (s.pendingReveals.length === 0) return [];
  const out = s.pendingReveals.slice();
  s.pendingReveals.length = 0;
  return out;
}

/** Reveal a widget immediately (used by project effects, not by tick). */
export function forceReveal(s: GameState, id: string): void {
  if (s.revealed.has(id) || !WIDGETS_BY_ID.has(id)) return;
  s.revealed.add(id);
  s.pendingReveals.push(id);
}
