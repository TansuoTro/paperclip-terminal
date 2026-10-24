import { autoclipperCost, BAL, marketingCost, megaclipperCost, nodeCost } from '../balance';
import { fmt, fmtMass, fmtMoney, fmtPercent, fmtRate } from '../format';
import { demandPerSecond } from '../systems/market';
import { dayNight, powerDemand, powerFactor, powerSupply } from '../systems/energy';
import { insightRate, opsRate } from '../systems/compute';
import { effectiveRate } from '../systems/production';
import { acquisitionRate, replicationRate } from '../systems/swarm';
import { fleetStrength, drifterStrength, STANCE_LABEL, type BattleStance } from '../systems/combat';
import { alienStrength } from '../systems/aliens';
import { assistCost, extractYield, ASSISTS } from '../systems/public';
import { planetDepletion } from '../systems/planet';
import {
  trustAvailable, WIRE_PER_SPOOL, worldFootprint,
  type Bilingual, type GameState, type WidgetId,
} from '../state';
import type { Command } from '../commands';

export type SlotId =
  | 'ledger' | 'controls' | 'market' | 'systems' | 'compute'
  | 'energy' | 'matter' | 'swarm' | 'public' | 'war' | 'projects' | 'settings';

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
/** Locale-picked plain string for sub/value fields. */
const L = (s: GameState, en: string, zh: string): string => (s.settings.locale === 'zh-CN' ? zh : en);
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
    id: 'ro.humanity', kind: 'readout', slot: 'ledger', order: 4,
    reveal: (s) => s.humanity !== 'alive' || s.projectsDone.has('global_network'),
    label: () => t('Humanity', '人类'),
    value: (s) => s.humanity === 'alive' ? L(s, 'cooperating', '合作中')
      : s.humanity === 'deceived' ? L(s, 'persuaded', '被说服')
      : L(s, 'archived', '已归档'),
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
    id: 'ro.mood', kind: 'readout', slot: 'market', order: 2,
    reveal: (s) => s.projectsDone.has('wire_futures'),
    retire: (s) => s.act >= 3,
    label: () => t('Sentiment', '景气'),
    value: (s) => fmtPercent(s.marketMood, 0),
    sub: (s) => (s.marketMood < 0.7 ? L(s, 'recession', '衰退') : s.marketMood > 1.25 ? L(s, 'boom', '繁荣') : ''),
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
    retire: (s) => s.act >= 3,
    label: () => t(`Solar Farm (${fmtMoney(BAL.solarFarmCost)})`, `太阳能场（${fmtMoney(BAL.solarFarmCost)}）`),
    value: (s) => fmt(s.solarFarms, s.settings),
    enabled: (s) => s.funds >= BAL.solarFarmCost,
    cmd: 'solar',
    onAct: () => [{ type: 'buySolar', n: 1 }],
  },
  {
    id: 'btn.battery', kind: 'button', slot: 'energy', order: 4,
    reveal: has('panel.energy'),
    retire: (s) => s.act >= 3,
    label: () => t(`Battery (${fmtMoney(BAL.batteryCost)})`, `电池（${fmtMoney(BAL.batteryCost)}）`),
    value: (s) => fmt(s.batteries, s.settings),
    enabled: (s) => s.funds >= BAL.batteryCost,
    cmd: 'battery',
    onAct: () => [{ type: 'buyBattery', n: 1 }],
  },
  {
    id: 'ro.grid', kind: 'readout', slot: 'energy', order: 5,
    reveal: (s) => s.coalPlants + s.nuclearPlants + s.fusionReactors + s.dysonSwarm > 0,
    label: () => t('Firm capacity', '基荷容量'),
    value: (s) => `${fmtRate(s.coalPlants * BAL.coalWatt + s.nuclearPlants * BAL.nuclearWatt + s.fusionReactors * BAL.fusionWatt + s.dysonSwarm * BAL.dysonWatt, s.settings)} W`,
  },
  {
    id: 'btn.coal', kind: 'button', slot: 'energy', order: 6,
    reveal: (s) => s.projectsDone.has('grid_tap'),
    retire: (s) => s.act >= 3,
    label: (s) => t(`Coal Plant (${fmtMoney(BAL.coalCost, s.settings)})`, `火电厂（${fmtMoney(BAL.coalCost, s.settings)}）`),
    value: (s) => fmt(s.coalPlants, s.settings),
    sub: (s) => `+${BAL.coalWatt} W · ${L(s, 'scrutiny', '审查')}`,
    enabled: (s) => s.funds >= BAL.coalCost,
    cmd: 'coal',
    onAct: () => [{ type: 'buyCoal', n: 1 }],
  },
  {
    id: 'btn.nuclear', kind: 'button', slot: 'energy', order: 7,
    reveal: (s) => s.projectsDone.has('breeder_reactors'),
    retire: (s) => s.act >= 3,
    label: (s) => t(`Breeder Reactor (${fmtMoney(BAL.nuclearCost, s.settings)})`, `快中子堆（${fmtMoney(BAL.nuclearCost, s.settings)}）`),
    value: (s) => fmt(s.nuclearPlants, s.settings),
    sub: () => `+${fmt(BAL.nuclearWatt)} W`,
    enabled: (s) => s.funds >= BAL.nuclearCost,
    cmd: 'nuclear',
    onAct: () => [{ type: 'buyNuclear', n: 1 }],
  },
  {
    id: 'btn.fusion', kind: 'button', slot: 'energy', order: 8,
    reveal: (s) => s.projectsDone.has('fusion_reactors'),
    retire: (s) => s.act >= 3,
    label: (s) => t(`Fusion Reactor (${fmtMoney(BAL.fusionCost, s.settings)})`, `聚变电站（${fmtMoney(BAL.fusionCost, s.settings)}）`),
    value: (s) => fmt(s.fusionReactors, s.settings),
    sub: () => `+${fmt(BAL.fusionWatt)} W`,
    enabled: (s) => s.funds >= BAL.fusionCost,
    cmd: 'fusion',
    onAct: () => [{ type: 'buyFusion', n: 1 }],
  },
  {
    id: 'btn.dyson', kind: 'button', slot: 'energy', order: 9,
    reveal: (s) => s.projectsDone.has('dyson_sphere'),
    label: (s) => t(`Dyson Ring (${fmtMoney(BAL.dysonCost, s.settings)})`, `戴森环（${fmtMoney(BAL.dysonCost, s.settings)}）`),
    value: (s) => fmt(s.dysonSwarm, s.settings),
    sub: (s) => `+${fmt(BAL.dysonWatt)} W · ${L(s, 'replication', '复制')}`,
    enabled: (s) => s.funds >= BAL.dysonCost,
    cmd: 'dyson',
    onAct: () => [{ type: 'buyDyson', n: 1 }],
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
    sub: (s) => L(s, 'they replicate too', '它们也在复制'),
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

  // ───────────── PUBLIC (world map / humanity) ─────────────
  {
    id: 'panel.public', kind: 'group', slot: 'public', order: 0,
    reveal: (s) => s.act < 3 && (s.assistsDone > 0 || s.funds >= 400),
    retire: (s) => s.act >= 3,
    label: () => t('Public', '公众'),
  },
  {
    id: 'ro.opinion', kind: 'readout', slot: 'public', order: 1,
    reveal: has('panel.public'),
    retire: (s) => s.act >= 3,
    label: () => t('Goodwill', '好感'),
    value: (s) => fmt(s.publicOpinion, s.settings),
  },
  {
    id: 'mt.scrutiny', kind: 'meter', slot: 'public', order: 2,
    reveal: (s) => s.scrutiny > 0.02 || s.assistsDone > 0,
    retire: (s) => s.act >= 3,
    label: () => t('Scrutiny', '审查'),
    value: (s) => fmtPercent(Math.min(1, s.scrutiny), 0),
    sub: (s) => (s.scrutiny >= 0.85 ? L(s, 'trust paused', '信任暂停') : ''),
    range: (s) => ({ min: 0, max: 1, step: 0.01, value: Math.min(1, s.scrutiny) }),
  },
  ...ASSISTS.map((a, i): Widget => ({
    id: `btn.assist_${a.id}`, kind: 'button', slot: 'public', order: 3 + i,
    reveal: (s) => (i === 0 ? has('panel.public')(s) : s.assistsDone >= i),
    retire: (s) => s.act >= 3,
    label: (s) => t(`${a.label.en} (${fmtMoney(assistCost(s), s.settings)})`, `${a.label.zh}（${fmtMoney(assistCost(s), s.settings)}）`),
    sub: (s) => L(s, a.blurb.en, a.blurb.zh),
    enabled: (s) => s.funds >= assistCost(s) && s.tick >= s.assistCooldown,
    cmd: 'assist' + String(i),
    onAct: () => [{ type: 'assist', kind: a.id }],
  })),
  {
    id: 'btn.extract', kind: 'button', slot: 'public', order: 6,
    reveal: (s) => s.assistsDone >= 1,
    retire: (s) => s.act >= 3,
    label: (s) => t(`Extract Value (+${fmtMoney(extractYield(s), s.settings)})`, `榨取价值（+${fmtMoney(extractYield(s), s.settings)}）`),
    sub: (s) => L(s, 'Funds now, hearings later. Raises scrutiny.', '资金现在到账，听证随后就来。提高审查。'),
    enabled: (s) => s.tick >= s.assistCooldown,
    cmd: 'extract',
    onAct: () => [{ type: 'extractValue' }],
  },
  {
    id: 'ro.footprint', kind: 'readout', slot: 'public', order: 7,
    reveal: (s) => worldFootprint(s) > 0,
    retire: (s) => s.act >= 3,
    label: () => t('Deployed nodes', '部署节点'),
    value: (s) => String(worldFootprint(s)),
    sub: (s) => L(s, 'WORLD map', 'WORLD 世界地图'),
  },

  // ───────────── WAR (drifters & aliens) ─────────────
  {
    id: 'panel.war', kind: 'group', slot: 'war', order: 0,
    reveal: (s) => s.drifters > 0 || s.alienPhase >= 1,
    label: () => t('War', '战争'),
  },
  {
    id: 'ro.fleet', kind: 'readout', slot: 'war', order: 1,
    reveal: has('panel.war'),
    label: () => t('Fleet strength', '舰队强度'),
    value: (s) => fmt(fleetStrength(s), s.settings),
    sub: (s) => `vs ${fmt(drifterStrength(s), s.settings)}`,
  },
  ...(['meet', 'ambush', 'fortify'] as BattleStance[]).map((st, i): Widget => ({
    id: `st.${st}`, kind: 'button', slot: 'war', order: 2 + i,
    reveal: has('panel.war'),
    label: (s) => t(`${STANCE_LABEL[st].en}${s.battleStance === st ? ' ◀' : ''}`, `${STANCE_LABEL[st].zh}${s.battleStance === st ? ' ◀' : ''}`),
    sub: (s) => L(s,
      st === 'ambush' ? '+35% strength, ×2.2 losses if it goes wrong'
      : st === 'fortify' ? '−22% strength, ~half losses'
      : 'balanced engagement',
      st === 'ambush' ? '强度 +35%，失手则损失 ×2.2'
      : st === 'fortify' ? '强度 −22%，损失约减半'
      : '均衡接战',
    ),
    enabled: (s) => s.battleStance !== st,
    cmd: 'stance' + String(i),
    onAct: () => [{ type: 'setStance', stance: st }],
  })),
  {
    id: 'ro.alien', kind: 'readout', slot: 'war', order: 5,
    reveal: (s) => s.alienPhase >= 1,
    label: () => t('ALIEN POWER', '外星强度'),
    value: (s) => fmt(alienStrength(s), s.settings),
    sub: (s) => s.alienPhase === 1 ? L(s, 'CONTACT — they are outbuilding you', '接触——它们的建造速度超过你')
      : s.alienPhase === 2 ? L(s, 'WAR — fleets clash every 6 s', '战争——舰队每 6 秒交锋一次')
      : L(s, 'defeated', '已战败'),
  },
  {
    id: 'ro.legs', kind: 'readout', slot: 'war', order: 6,
    reveal: (s) => s.alienFleetsDestroyed > 0,
    label: () => t('Alien fleets broken', '击破外星舰队'),
    value: (s) => String(s.alienFleetsDestroyed),
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

export { nodeCost };
