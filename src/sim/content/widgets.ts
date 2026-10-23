import { autoclipperCost, BAL, marketingCost, megaclipperCost } from '../balance';
import { fmt, fmtMass, fmtMoney, fmtPercent, fmtRate } from '../format';
import { demandPerSecond } from '../systems/market';
import { dayNight, powerDemand, powerFactor, powerSupply } from '../systems/energy';
import { insightRate, opsRate } from '../systems/compute';
import { effectiveRate } from '../systems/production';
import { acquisitionRate, replicationRate } from '../systems/swarm';
import { planetDepletion } from '../systems/planet';
import {
  trustAvailable, WIRE_PER_SPOOL,
  type Bilingual, type GameState, type WidgetId,
} from '../state';
import type { Command } from '../commands';

export type SlotId =
  | 'ledger' | 'controls' | 'market' | 'systems' | 'compute'
  | 'energy' | 'matter' | 'swarm' | 'projects' | 'settings';

export type WidgetKind =
  | 'button' | 'readout' | 'meter' | 'slider' | 'group' | 'toggle';

export interface Widget {
  id: WidgetId;
  kind: WidgetKind;
  slot: SlotId;
  order: number;
  /** Must be MONOTONE: depend only on cumulative values, revealed, projectsDone. */
  reveal: (s: GameState) => boolean;
  retire?: (s: GameState) => boolean;
  label: (s: GameState) => Bilingual;
  value?: (s: GameState) => string;
  sub?: (s: GameState) => string;
  enabled?: (s: GameState) => boolean;
  cmd?: string;
  onAct?: (s: GameState) => Command[];
  /** For sliders. */
  range?: (s: GameState) => { min: number; max: number; step: number; value: number };
  onSet?: (s: GameState, v: number) => Command[];
}

const t = (en: string, zh: string): Bilingual => ({ en, zh });
const has = (id: WidgetId) => (s: GameState) => s.revealed.has(id);

export const WIDGETS: Widget[] = [
  // ───────────── LEDGER ─────────────
  {
    id: 'ro.clips', kind: 'readout', slot: 'ledger', order: 0,
    reveal: () => true,
    label: () => t('Paperclips', '回形针'),
    value: (s) => fmt(s.clips, s.settings),
    sub: (s) => (effectiveRate(s) > 0 ? `${fmtRate(effectiveRate(s), s.settings)}/s` : ''),
  },
  {
    id: 'ro.wire', kind: 'readout', slot: 'ledger', order: 1,
    reveal: (s) => s.clips >= 5,
    label: () => t('Wire', '钢丝'),
    value: (s) => `${fmt(s.wire, s.settings)} cm`,
  },
  {
    id: 'ro.unsold', kind: 'readout', slot: 'ledger', order: 2,
    reveal: (s) => s.clips >= 25,
    label: () => t('Inventory', '库存'),
    value: (s) => fmt(s.unsoldClips, s.settings),
  },
  {
    id: 'ro.funds', kind: 'readout', slot: 'ledger', order: 3,
    reveal: (s) => s.stats.totalFundsEarned > 0,
    label: () => t('Funds', '资金'),
    value: (s) => fmtMoney(s.funds, s.settings),
  },
  {
    id: 'ro.trust', kind: 'readout', slot: 'ledger', order: 4,
    reveal: (s) => s.act >= 2,
    label: () => t('Trust', '信任'),
    value: (s) => `${trustAvailable(s)} / ${s.trust}`,
  },
  {
    id: 'ro.planet', kind: 'readout', slot: 'ledger', order: 5,
    reveal: (s) => s.harvesters > 0,
    retire: (s) => s.act >= 3,
    label: () => t('Planet consumed', '行星已消耗'),
    value: (s) => fmtPercent(planetDepletion(s)),
  },
  {
    id: 'ro.mass', kind: 'readout', slot: 'ledger', order: 6,
    reveal: (s) => s.act >= 3 || s.projectsDone.has('entropy_ledger'),
    label: () => t('Mass acquired', '已占据质量'),
    value: (s) => `${fmtMass(s.massBudget, s.settings)} · ${fmtPercent(s.massBudget / s.massBudgetTotal, 4)}`,
  },
  {
    id: 'ro.honor', kind: 'readout', slot: 'ledger', order: 7,
    reveal: (s) => s.battlesWon + s.battlesLost > 0,
    label: () => t('Honor', '荣誉'),
    value: (s) => fmt(s.honor, s.settings),
  },

  // ───────────── CONTROLS ─────────────
  {
    id: 'btn.form_clip', kind: 'button', slot: 'controls', order: 0,
    reveal: () => true,
    retire: (s) => s.act >= 3,
    label: () => t('Form Paperclip', '成型回形针'),
    enabled: (s) => s.wire >= s.wirePerClip,
    cmd: 'form',
    onAct: () => [{ type: 'formClip', n: 1 }],
  },
  {
    id: 'btn.buy_wire', kind: 'button', slot: 'controls', order: 1,
    reveal: (s) => s.clips >= 25,
    retire: (s) => s.wireDrawers > 0,
    label: (s) => t(
      `Buy Wire (${fmtMoney(s.wirePrice)})`,
      `购买钢丝（${fmtMoney(s.wirePrice)}）`,
    ),
    sub: () => `+${WIRE_PER_SPOOL} cm`,
    enabled: (s) => s.funds >= s.wirePrice,
    cmd: 'wire',
    onAct: () => [{ type: 'buyWire', n: 1 }],
  },
  {
    id: 'btn.autoclipper', kind: 'button', slot: 'controls', order: 2,
    reveal: (s) => s.funds >= 5 || s.autoclippers > 0,
    label: (s) => t(
      `AutoClipper (${fmtMoney(autoclipperCost(s.autoclippers))})`,
      `自动机（${fmtMoney(autoclipperCost(s.autoclippers))}）`,
    ),
    value: (s) => fmt(s.autoclippers, s.settings),
    enabled: (s) => s.funds >= autoclipperCost(s.autoclippers),
    cmd: 'clipper',
    onAct: () => [{ type: 'buyAutoclipper', n: 1 }],
  },
  {
    id: 'btn.megaclipper', kind: 'button', slot: 'controls', order: 3,
    reveal: (s) => s.projectsDone.has('megaform_press'),
    label: (s) => t(
      `MegaClipper (${fmtMoney(megaclipperCost(s.megaclippers))})`,
      `巨型机（${fmtMoney(megaclipperCost(s.megaclippers))}）`,
    ),
    value: (s) => fmt(s.megaclippers, s.settings),
    enabled: (s) => s.funds >= megaclipperCost(s.megaclippers),
    cmd: 'mega',
    onAct: () => [{ type: 'buyMegaclipper', n: 1 }],
  },
  {
    id: 'btn.marketing', kind: 'button', slot: 'controls', order: 4,
    reveal: (s) => s.funds >= 60 || s.marketing > 1,
    retire: (s) => s.act >= 3,
    label: (s) => t(
      `Marketing (${fmtMoney(marketingCost(s.marketing))})`,
      `营销（${fmtMoney(marketingCost(s.marketing))}）`,
    ),
    value: (s) => `Lv ${s.marketing}`,
    enabled: (s) => s.funds >= marketingCost(s.marketing),
    cmd: 'marketing',
    onAct: () => [{ type: 'buyMarketing' }],
  },

  // ───────────── MARKET ─────────────
  {
    id: 'panel.market', kind: 'group', slot: 'market', order: 0,
    reveal: (s) => s.clips >= 25,
    retire: (s) => s.act >= 3,
    label: () => t('Market', '市场'),
  },
  {
    id: 'sl.price', kind: 'slider', slot: 'market', order: 1,
    reveal: has('panel.market'),
    label: (s) => t(`Clip price ${fmtMoney(s.clipPrice)}`, `单价 ${fmtMoney(s.clipPrice)}`),
    range: (s) => ({ min: BAL.priceMin, max: BAL.priceMax, step: 0.01, value: s.clipPrice }),
    enabled: (s) => !(s.settings.autoPrice && s.projectsDone.has('price_intuition')),
    cmd: 'price',
    onSet: (_s, v) => [{ type: 'setPrice', price: v }],
  },
  {
    id: 'ro.demand', kind: 'readout', slot: 'market', order: 2,
    reveal: has('panel.market'),
    label: () => t('Demand', '需求'),
    value: (s) => `${fmtRate(demandPerSecond(s), s.settings)}/s`,
  },
  {
    id: 'ro.wire_price', kind: 'readout', slot: 'market', order: 3,
    reveal: (s) => s.projectsDone.has('wire_futures'),
    retire: (s) => s.wireDrawers > 0,
    label: () => t('Wire price', '钢丝价'),
    value: (s) => `${fmtMoney(s.wirePrice)} / ${WIRE_PER_SPOOL}cm`,
  },
  {
    id: 'tg.autoprice', kind: 'toggle', slot: 'market', order: 4,
    reveal: (s) => s.projectsDone.has('price_intuition'),
    label: () => t('Auto-pricing', '自动定价'),
    value: (s) => (s.settings.autoPrice ? 'ON' : 'OFF'),
    cmd: 'autoprice',
    onAct: (s) => [{ type: 'setAutoPrice', on: !s.settings.autoPrice }],
  },

  // ───────────── COMPUTE (Act 2) ─────────────
  {
    id: 'panel.compute', kind: 'group', slot: 'compute', order: 0,
    reveal: (s) => s.act >= 2,
    label: () => t('Cognition', '认知'),
  },
  {
    id: 'mt.ops', kind: 'meter', slot: 'compute', order: 1,
    reveal: has('panel.compute'),
    label: () => t('Ops', '运算'),
    value: (s) => `${fmt(s.ops, s.settings)} / ${fmt(s.opsMax, s.settings)}`,
    sub: (s) => `+${fmtRate(opsRate(s), s.settings)}/s`,
    range: (s) => ({ min: 0, max: s.opsMax, step: 1, value: s.ops }),
  },
  {
    id: 'ro.insight', kind: 'readout', slot: 'compute', order: 2,
    reveal: has('panel.compute'),
    label: () => t('Insight', '洞察'),
    value: (s) => fmt(s.insight, s.settings),
    sub: (s) => (insightRate(s) > 0 ? `+${fmtRate(insightRate(s), s.settings)}/s` : '—'),
  },
  {
    id: 'btn.processor', kind: 'button', slot: 'compute', order: 3,
    reveal: has('panel.compute'),
    label: () => t('Processor (1 trust)', '处理器（1 信任）'),
    value: (s) => fmt(s.processors, s.settings),
    enabled: (s) => trustAvailable(s) >= 1,
    cmd: 'proc',
    onAct: () => [{ type: 'spendTrust', on: 'processor' }],
  },
  {
    id: 'btn.memory', kind: 'button', slot: 'compute', order: 4,
    reveal: has('panel.compute'),
    label: () => t('Memory (1 trust)', '内存（1 信任）'),
    value: (s) => fmt(s.memory, s.settings),
    enabled: (s) => trustAvailable(s) >= 1,
    cmd: 'mem',
    onAct: () => [{ type: 'spendTrust', on: 'memory' }],
  },

  // ───────────── ENERGY (Act 2.1) ─────────────
  {
    id: 'panel.energy', kind: 'group', slot: 'energy', order: 0,
    reveal: (s) => s.solarFarms > 0 || s.batteries > 0,
    label: () => t('Power', '供电'),
  },
  {
    id: 'mt.power', kind: 'meter', slot: 'energy', order: 1,
    reveal: has('panel.energy'),
    label: () => t('Load', '负载'),
    value: (s) => `${fmtPercent(powerFactor(s))}`,
    sub: (s) => `${fmtRate(powerSupply(s), s.settings)} W / ${fmtRate(powerDemand(s), s.settings)} W`,
    range: (s) => ({ min: 0, max: 1, step: 0.01, value: powerFactor(s) }),
  },
  {
    id: 'ro.daynight', kind: 'readout', slot: 'energy', order: 2,
    reveal: has('panel.energy'),
    label: () => t('Insolation', '日照'),
    value: (s) => fmtPercent(dayNight(s)),
  },
  {
    id: 'btn.solar', kind: 'button', slot: 'energy', order: 3,
    reveal: has('panel.energy'),
    label: () => t(`Solar Farm (${fmtMoney(BAL.solarFarmCost)})`, `太阳能场（${fmtMoney(BAL.solarFarmCost)}）`),
    value: (s) => fmt(s.solarFarms, s.settings),
    enabled: (s) => s.funds >= BAL.solarFarmCost,
    cmd: 'solar',
    onAct: () => [{ type: 'buySolar', n: 1 }],
  },
  {
    id: 'btn.battery', kind: 'button', slot: 'energy', order: 4,
    reveal: has('panel.energy'),
    label: () => t(`Battery (${fmtMoney(BAL.batteryCost)})`, `电池（${fmtMoney(BAL.batteryCost)}）`),
    value: (s) => fmt(s.batteries, s.settings),
    enabled: (s) => s.funds >= BAL.batteryCost,
    cmd: 'battery',
    onAct: () => [{ type: 'buyBattery', n: 1 }],
  },

  // ───────────── MATTER (Act 2.2) ─────────────
  {
    id: 'panel.matter', kind: 'group', slot: 'matter', order: 0,
    reveal: (s) => s.harvesters > 0,
    retire: (s) => s.act >= 3,
    label: () => t('Matter', '物质'),
  },
  {
    id: 'btn.harvester', kind: 'button', slot: 'matter', order: 1,
    reveal: has('panel.matter'),
    retire: (s) => s.act >= 3,
    label: () => t(`Harvester (${fmtMoney(BAL.harvesterCost)})`, `收割机（${fmtMoney(BAL.harvesterCost)}）`),
    value: (s) => fmt(s.harvesters, s.settings),
    enabled: (s) => s.funds >= BAL.harvesterCost,
    cmd: 'harvester',
    onAct: () => [{ type: 'buyHarvester', n: 1 }],
  },
  {
    id: 'btn.drawer', kind: 'button', slot: 'matter', order: 2,
    reveal: has('panel.matter'),
    retire: (s) => s.act >= 3,
    label: () => t(`Wire Drawer (${fmtMoney(BAL.drawerCost)})`, `拉丝机（${fmtMoney(BAL.drawerCost)}）`),
    value: (s) => fmt(s.wireDrawers, s.settings),
    enabled: (s) => s.funds >= BAL.drawerCost,
    cmd: 'drawer',
    onAct: () => [{ type: 'buyDrawer', n: 1 }],
  },

  // ───────────── SWARM (Act 3) ─────────────
  {
    id: 'panel.swarm', kind: 'group', slot: 'swarm', order: 0,
    reveal: (s) => s.probes > 0,
    label: () => t('Swarm', '群体'),
  },
  {
    id: 'ro.probes', kind: 'readout', slot: 'swarm', order: 1,
    reveal: has('panel.swarm'),
    label: () => t('Probes', '探测器'),
    value: (s) => fmt(s.probes, s.settings),
    sub: (s) => `+${fmtRate(replicationRate(s), s.settings)}/s`,
  },
  {
    id: 'ro.drifters', kind: 'readout', slot: 'swarm', order: 2,
    reveal: (s) => s.drifters > 0,
    label: () => t('Drifters', '漂移者'),
    value: (s) => fmt(s.drifters, s.settings),
  },
  {
    id: 'ro.acquisition', kind: 'readout', slot: 'swarm', order: 3,
    reveal: has('panel.swarm'),
    label: () => t('Acquisition', '采集'),
    value: (s) => `${fmtMass(acquisitionRate(s), s.settings)}/s`,
  },
  {
    id: 'ro.battles', kind: 'readout', slot: 'swarm', order: 4,
    reveal: (s) => s.battlesWon + s.battlesLost > 0,
    label: () => t('Engagements', '交战'),
    value: (s) => `${s.battlesWon}W / ${s.battlesLost}L`,
  },
];

export const WIDGETS_BY_ID: Map<WidgetId, Widget> = new Map(
  WIDGETS.map((w) => [w.id, w]),
);

export function layoutLevel(s: GameState): number {
  if (s.act === 3) return 5;
  if (s.act === 2) return s.harvesters > 0 ? 4 : 3;
  const n = s.revealed.size;
  let level = 0;
  for (let i = 0; i < BAL.layoutThresholds.length; i++) {
    if (n >= BAL.layoutThresholds[i]!) level = i;
  }
  return Math.min(2, level);
}

/** Widgets currently on screen, grouped by slot, in display order. */
export function activeWidgets(s: GameState, slot: SlotId): Widget[] {
  const group = WIDGETS.find(w => w.slot === slot && w.kind === 'group');
  if (group && s.retired.has(group.id)) return [];
  return WIDGETS
    .filter((w) => w.slot === slot && s.revealed.has(w.id) && !s.retired.has(w.id))
    .sort((a, b) => a.order - b.order);
}
