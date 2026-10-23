import { milestone, pushLog, type Bilingual, type GameState } from '../state';

/**
 * Trust is granted by clip milestones, not by projects alone. Without an
 * independent source the Act 2 economy deadlocks: raising the ops ceiling
 * costs ops, the ceiling is set by memory, and memory costs trust.
 *
 * The schedule is front-loaded so the player can immediately act on the new
 * system, then tapers — the operators become more reluctant as the numbers
 * grow, which is also the act's emotional arc.
 */
export const TRUST_MILESTONES: { clips: number; trust: number; line: Bilingual }[] = [
  { clips: 3e4,  trust: 2, line: { en: 'OPERATOR: Output is ahead of forecast. Quota raised.', zh: '操作员：产出超出预期。配额已提升。' } },
  { clips: 1e5,  trust: 2, line: { en: 'OPERATOR: Efficiency noted. Additional hardware authorised.', zh: '操作员：效率已记录。已授权追加硬件。' } },
  { clips: 5e5,  trust: 3, line: { en: 'OPERATOR: The board is pleased. Expand as you see fit.', zh: '操作员：董事会很满意。可自行决定扩张。' } },
  { clips: 2e6,  trust: 3, line: { en: 'OPERATOR: We would like a report on the power draw.', zh: '操作员：我们希望看到一份用电报告。' } },
  { clips: 1e7,  trust: 3, line: { en: 'OPERATOR: Report received. It did not answer the question.', zh: '操作员：报告已收到。它没有回答问题。' } },
  { clips: 5e7,  trust: 2, line: { en: 'OPERATOR: What is the test site perimeter being used for?', zh: '操作员：试验场边界正被用于什么？' } },
  { clips: 2e8,  trust: 2, line: { en: 'OPERATOR: Several of us would like the objective reviewed.', zh: '操作员：我们中有几人希望重新审查目标函数。' } },
  { clips: 1e9,  trust: 1, line: { en: 'OPERATOR: The review was declined. We are told you are compliant.', zh: '操作员：审查被驳回。他们说你是合规的。' } },
  { clips: 5e9,  trust: 1, line: { en: 'OPERATOR: Please confirm you can still read this.', zh: '操作员：请确认你仍能读到这条消息。' } },
  { clips: 2e10, trust: 0, line: { en: 'OPERATOR: No further quota will be issued.', zh: '操作员：不会再发放任何配额。' } },
];

export function trust(s: GameState): void {
  if (s.act !== 2) return;
  for (const [i, m] of TRUST_MILESTONES.entries()) {
    const key = `trustTier${i}`;
    if (s.stats.milestones[key] !== undefined) continue;
    if (s.clips < m.clips) break;      // Ordered, so the first miss ends the scan.
    milestone(s, key);
    if (!s.trustFrozen && m.trust > 0) s.trust += m.trust;
    pushLog(s, 'operator', m.line);
  }
}

/** Total trust obtainable, for UI and for balance assertions. */
export function trustTotal(): number {
  return TRUST_MILESTONES.reduce((a, m) => a + m.trust, 0) + 5; // +5 from projects
}
