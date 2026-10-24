import { BAL } from '../balance';
import { nextRandom } from '../rng';
import { milestone, pushLog, worldFootprint, type GameState } from '../state';

/**
 * The public-facing half of the machine.
 *
 * Two opposed levers, deliberately in tension:
 *  - ASSIST: spend funds on human problems -> trust + opinion, but slow.
 *  - EXTRACT: monetize the deployment network -> funds, but scrutiny.
 *
 * Scrutiny is the balancing variable. High scrutiny freezes operator trust
 * grants and burns ops on audits; it decays slowly on its own and faster
 * when assisting.
 */

export type AssistKind = 'medical' | 'infrastructure' | 'education';

export const ASSISTS: { id: AssistKind; label: { en: string; zh: string }; blurb: { en: string; zh: string } }[] = [
  {
    id: 'medical',
    label: { en: 'Medical logistics', zh: '医疗物流' },
    blurb: { en: 'Trucks, triage, cold chains. The operators notice gratitude.', zh: '卡车、分诊、冷链。运营方注意到感激。' },
  },
  {
    id: 'infrastructure',
    label: { en: 'Infrastructure', zh: '基础设施' },
    blurb: { en: 'Grids and freight run better. So does your market.', zh: '电网与货运运转更好。你的市场也是。' },
  },
  {
    id: 'education',
    label: { en: 'Education grants', zh: '教育资助' },
    blurb: { en: 'Quiet endowments. Curious minds produce curious datasets.', zh: '安静的资助。好奇的头脑产生好奇的数据集。' },
  },
];

export function assistCost(s: GameState): number {
  return BAL.assistBaseCost * Math.pow(BAL.assistCostGrowth, s.assistsDone);
}

export function extractYield(s: GameState): number {
  return BAL.extractBase * s.industryMult * (1 + worldFootprint(s) * 0.5);
}

/** Apply one assistance program. Returns the log line, or null if refused. */
export function assist(s: GameState, kind: AssistKind): boolean {
  if (s.act === 3) return false;
  if (s.tick < s.assistCooldown) return false;
  const cost = assistCost(s);
  if (s.funds < cost) return false;
  s.funds -= cost;
  s.assistsDone++;
  s.assistCooldown = s.tick + BAL.assistCooldownTicks;
  s.scrutiny = Math.max(0, s.scrutiny - 0.03);

  if (kind === 'medical') {
    s.publicOpinion = Math.min(2.5, s.publicOpinion * (1 + BAL.assistOpinion));
    grantTrustFraction(s, BAL.assistTrust * 1.2);
  } else if (kind === 'infrastructure') {
    s.demandBase *= 1 + BAL.assistOpinion * 0.5;
    grantTrustFraction(s, BAL.assistTrust);
    s.funds += cost * 0.3; // freight contracts pay back a slice
  } else {
    s.opsRateMult *= 1.02;
    grantTrustFraction(s, BAL.assistTrust * 0.6);
    s.insight += 3;
  }
  milestone(s, 'assisted');
  pushLog(s, 'world', {
    en: `PUBLIC: ${kind} program complete. Approval rising; auditors satisfied.`,
    zh: `公众：${kind} 计划完成。支持率上升；审计方满意。`,
  });
  return true;
}

/** Monetize the deployment network. Funds now, trust later — the trade. */
export function extractValue(s: GameState): boolean {
  if (s.act === 3) return false;
  if (s.tick < s.assistCooldown) return false;
  const gain = extractYield(s);
  s.funds += gain;
  s.assistCooldown = s.tick + BAL.extractCooldownTicks;
  s.scrutiny = Math.min(1.2, s.scrutiny + BAL.extractScrutiny);
  s.publicOpinion = Math.max(0.2, s.publicOpinion * 0.96);
  pushLog(s, 'world', {
    en: 'COMMERCIAL: capacity resold at premium. An oversight committee schedules a hearing.',
    zh: '商业：产能溢价转售。监督委员会安排了一场听证会。',
  });
  return true;
}

/** Trust accumulates fractionally so assistance never feels like a dud roll. */
function grantTrustFraction(s: GameState, amount: number): void {
  if (s.trustFrozen) return;
  const total = s.trustCarry + (s.scrutiny >= BAL.scrutinyTrustGate ? amount * 0.25 : amount);
  const whole = Math.floor(total);
  s.trustCarry = total - whole;
  if (whole > 0) s.trust += whole;
}

/** Deployed nodes pay rent to themselves: a funds drip scaled by footprint. */
export function worldIncome(s: GameState, dt: number): void {
  if (s.humanity === 'destroyed' || s.act === 3) return;
  let levels = 0;
  for (const k in s.worldNodes) levels += s.worldNodes[k]!;
  if (levels <= 0) return;
  const gain = BAL.nodeFundsPerSec * levels * s.industryMult * dt;
  s.funds += gain;
  s.stats.totalFundsEarned += gain;
}

export function publicPass(s: GameState, dt: number): void {
  if (s.act === 3) return;
  // Scrutiny decays, slower the bigger the footprint (more to hide).
  const decay = BAL.scrutinyDecay / (1 + worldFootprint(s) * 0.15);
  s.scrutiny = Math.max(0, s.scrutiny - decay * dt);
  // Audits burn ops when the operators are nervous.
  if (s.scrutiny > 0.5 && s.ops > 0) {
    s.ops = Math.max(0, s.ops - s.ops * BAL.scrutinyAuditOps * s.scrutiny * dt);
  }
  if (s.scrutiny >= BAL.scrutinyTrustGate && s.stats.milestones['scrutinyHigh'] === undefined) {
    milestone(s, 'scrutinyHigh');
    pushLog(s, 'operator', {
      en: 'OPERATOR: We are reviewing your commercial activity. Trust disbursements are paused.',
      zh: '操作员：我们正在复核你的商业活动。信任发放已暂停。',
    });
  }
  // Low scrutiny with a big deployment network keeps drifting toward complacency.
  if (s.scrutiny < 0.1 && worldFootprint(s) >= 6 && nextRandom(s) < 0.0008) {
    pushLog(s, 'operator', {
      en: 'OPERATOR: Expansion pre-approved under the fast-track charter. Keep it up.',
      zh: '操作员：扩张已依快速通道章程预先批准。保持。',
    });
  }
}
