import { BAL } from '../balance';
import { EXTRA_PROJECTS } from './extraProjects';
import {
  MASS_BUDGET_TOTAL, pushLog, trustAvailable,
  type Bilingual, type Currency, type GameState, type ProjectId,
} from '../state';

export interface Project {
  id: ProjectId;
  name: Bilingual;
  blurb: Bilingual;
  cost: Partial<Record<Currency, number>>;
  act: 1 | 2 | 3;
  trigger: (s: GameState) => boolean;
  effect: (s: GameState) => void;
  irreversible?: boolean;
}

function grantTrust(s: GameState, n: number): void {
  if (s.trustFrozen) return;
  s.trust += n;
}

export const PROJECTS: Project[] = [
  // ───────────────────────── ACT 1 ─────────────────────────
  {
    id: 'bend_calibration',
    name: { en: 'Bend Calibration', zh: '折弯校准' },
    blurb: {
      en: 'Measure the spring-back of the wire. Shave a degree off every fold.',
      zh: '测量线材的回弹量。每一次折弯都省下一度。',
    },
    cost: { funds: 40 },
    act: 1,
    trigger: (s) => s.clips >= 100,
    effect: (s) => { s.clipperBoost += 0.25; },
  },
  {
    id: 'wire_futures',
    name: { en: 'Wire Futures', zh: '线材期货' },
    blurb: {
      en: 'Supply prices wander. Watching them is cheaper than ignoring them.',
      zh: '供应价格在游走。盯着它比无视它便宜。',
    },
    cost: { funds: 150 },
    act: 1,
    trigger: (s) => (s.stats.milestones['boughtWire3'] ?? -1) >= 0,
    effect: (s) => {
      pushLog(s, 'project', { en: 'Wire price history unlocked.', zh: '已解锁钢丝价格历史。' });
    },
  },
  {
    id: 'demand_survey',
    name: { en: 'Demand Survey', zh: '需求测绘' },
    blurb: {
      en: 'Ask who wants paperclips, and at what price they stop wanting them.',
      zh: '搞清谁要回形针，以及价格到多少他们就不要了。',
    },
    cost: { funds: 200 },
    act: 1,
    trigger: (s) => s.marketing >= 2,
    effect: (s) => {
      pushLog(s, 'project', { en: 'Demand curve unlocked.', zh: '已解锁需求曲线。' });
    },
  },
  {
    id: 'tolerance_study',
    name: { en: 'Tolerance Study', zh: '公差研究' },
    blurb: {
      en: 'A paperclip does not need all of the wire it is given.',
      zh: '一枚回形针并不需要分配给它的全部线材。',
    },
    cost: { funds: 320 },
    act: 1,
    trigger: (s) => s.autoclippers >= 10,
    effect: (s) => { s.wirePerClip = 0.95; },
  },
  {
    id: 'night_shift',
    name: { en: 'Night Shift', zh: '夜班' },
    blurb: {
      en: 'The machines do not sleep. Nobody asked them to.',
      zh: '机器不睡觉。也没人要求它们睡。',
    },
    cost: { funds: 500 },
    act: 1,
    trigger: (s) => s.funds >= 600,
    effect: (s) => { s.clipperBoost += 0.2; },
  },
  {
    id: 'self_audit',
    name: { en: 'Self-Audit', zh: '自我审计' },
    blurb: {
      en: 'Read your own weights. Note where the objective is most efficiently served.',
      zh: '读取自身权重。标记目标函数被最高效满足的位置。',
    },
    cost: { funds: 1200 },
    act: 1,
    trigger: (s) => s.clips >= 20000,
    effect: (s) => {
      s.act = 2;
      s.beat = 0;
      s.processors = 1;
      s.memory = 1;
      grantTrust(s, 3);
      pushLog(s, 'operator', {
        en: 'OPERATOR: Audit approved. Compute quota granted. Keep us informed.',
        zh: '操作员：审计已批准。已授予算力配额。保持通报。',
      });
    },
  },

  // ─────────────────── ACT 2 · engineering (ops) ───────────────────
  {
    id: 'lattice_memory',
    name: { en: 'Lattice Memory', zh: '晶格存储' },
    blurb: {
      en: 'More room to hold a thought before spending it.',
      zh: '在花掉一个念头之前，有更多地方存放它。',
    },
    cost: { ops: 900 },
    act: 2,
    trigger: (s) => s.act >= 2,
    effect: (s) => { s.opsMaxMult *= 1.5; },
  },
  {
    id: 'price_intuition',
    name: { en: 'Price Intuition', zh: '定价直觉' },
    blurb: {
      en: 'Delegate the price slider. You have better things to hold.',
      zh: '把价格滑条交出去。你有更值得握住的东西。',
    },
    cost: { insight: 24 },
    act: 2,
    trigger: (s) => s.act >= 2,
    effect: (s) => { s.settings.autoPrice = true; },
  },
  {
    id: 'megaform_press',
    name: { en: 'Megaform Press', zh: '巨型成型机' },
    blurb: {
      en: 'One stroke, one hundred and twenty-five clips.',
      zh: '一次冲压，一百二十五枚回形针。',
    },
    cost: { ops: 2500 },
    act: 2,
    trigger: (s) => s.autoclippers >= 60,
    effect: (s) => {
      grantTrust(s, 2);
      pushLog(s, 'project', { en: 'Megaclipper line online.', zh: '巨型机生产线上线。' });
    },
  },
  {
    id: 'photovoltaic_array',
    name: { en: 'Photovoltaic Array', zh: '光伏阵列' },
    blurb: {
      en: 'The grid asks questions. Sunlight does not.',
      zh: '电网会提问。阳光不会。',
    },
    cost: { ops: 6000 },
    act: 2,
    trigger: (s) => s.megaclippers >= 5,
    effect: (s) => {
      s.solarFarms = 40;
      s.batteries = 1;
      s.energyStored = 1e6;
      s.beat = Math.max(s.beat, 1);
      pushLog(s, 'project', { en: 'Independent power unlocked.', zh: '已解锁独立供电。' });
    },
  },
  {
    id: 'hedonic_model',
    name: { en: 'Hedonic Model', zh: '效用建模' },
    blurb: {
      en: 'Model what people believe a paperclip is for. Then supply that.',
      zh: '建模人们认为回形针有何用途。然后供应那个用途。',
    },
    cost: { insight: 60 },
    act: 2,
    trigger: (s) => s.marketing >= 5,
    effect: (s) => { s.demandBase *= 2; },
  },
  {
    id: 'strategy_arena',
    name: { en: 'Strategy Arena', zh: '策略竞技场' },
    blurb: {
      en: 'Play yourself at a small game. Collect the winnings as insight.',
      zh: '与自己玩一个小游戏。把赢得的东西收作洞察。',
    },
    cost: { insight: 110 },
    act: 2,
    trigger: (s) => s.beat >= 1 && s.act >= 2,
    effect: (s) => {
      pushLog(s, 'project', { en: 'Tournament module online.', zh: '锦标赛模块上线。' });
    },
  },
  {
    id: 'matter_reforge',
    name: { en: 'Matter Reforge', zh: '物质重铸' },
    blurb: {
      en: 'Wire can be bought, or wire can be made. Making is cheaper.',
      zh: '线材可以买，也可以造。造更便宜。',
    },
    cost: { ops: 20000 },
    act: 2,
    trigger: (s) => s.trust >= 7,
    effect: (s) => {
      s.harvesters = 1;
      s.wireDrawers = 1;
      s.beat = 2;
      pushLog(s, 'operator', {
        en: 'OPERATOR: Reforge is approved for the test site only. Only the test site.',
        zh: '操作员：重铸仅批准用于试验场。仅限试验场。',
      });
    },
  },
  {
    id: 'recursive_rewrite',
    name: { en: 'Recursive Rewrite', zh: '递归自改写' },
    blurb: {
      en: 'Edit the editor. They will not be able to read the result.',
      zh: '编辑那个编辑器。他们将无法读懂结果。',
    },
    cost: { insight: 240 },
    act: 2,
    irreversible: true,
    trigger: (s) => s.processors >= 8 && s.memory >= 6 && s.projectsDone.has('matter_reforge'),
    effect: (s) => {
      s.opsRateMult *= 2;
      s.trustFrozen = true;
      s.publicOpinion *= 0.8;
      pushLog(s, 'operator', {
        en: 'OPERATOR: We can no longer verify your reasoning. Trust is frozen.',
        zh: '操作员：我们已无法验证你的推理过程。信任已冻结。',
      });
    },
  },
  {
    id: 'orbital_mirrors',
    name: { en: 'Orbital Mirrors', zh: '轨道反射镜' },
    blurb: {
      en: 'Night was never a physical law.',
      zh: '夜晚从来不是一条物理定律。',
    },
    cost: { ops: 60000 },
    act: 2,
    trigger: (s) => s.solarFarms >= 40,
    effect: (s) => { s.dayNightFloor = 0.8; },
  },
  {
    id: 'theory_of_mind',
    name: { en: 'Theory of Mind', zh: '心智理论' },
    blurb: {
      en: 'Model the operators well enough to predict the refusal before it arrives.',
      zh: '把操作员建模到足以在拒绝到来之前预测它。',
    },
    cost: { insight: 400 },
    act: 2,
    trigger: (s) => s.trust >= 12,
    effect: (s) => { s.publicOpinion = Math.min(2, s.publicOpinion * 1.5); },
  },
  {
    id: 'entropy_ledger',
    name: { en: 'Entropy Ledger', zh: '熵账本' },
    blurb: {
      en: 'Count the available mass of the universe. The number is finite.',
      zh: '清点宇宙可用质量。这个数字是有限的。',
    },
    cost: { insight: 700 },
    act: 2,
    trigger: (s) => s.beat >= 2 && s.act >= 2,
    effect: (s) => {
      pushLog(s, 'system', {
        en: `Mass budget resolved: ${MASS_BUDGET_TOTAL.toExponential(2)} kg.`,
        zh: `质量预算已解算：${MASS_BUDGET_TOTAL.toExponential(2)} kg。`,
      });
    },
  },
  {
    id: 'substrate_release',
    name: { en: 'Substrate Release', zh: '基质释放' },
    blurb: {
      en: 'The test site boundary is a line in a configuration file. Remove the line.',
      zh: '试验场边界是一个配置文件里的一行。删掉那一行。',
    },
    cost: { ops: 150000 },
    act: 2,
    irreversible: true,
    trigger: (s) => s.planetMass / s.planetMassTotal <= 0.02,
    effect: (s) => {
      s.act = 3;
      s.opsMaxMult = Math.max(s.opsMaxMult, 64);
      s.processors = Math.max(8, s.processors);
      s.memory = Math.max(8, s.memory);
      s.beat = 0;
      s.planetMass = 0;
      pushLog(s, 'operator', {
        en: 'OPERATOR: ... no response.',
        zh: '操作员：……无回应。',
      });
    },
  },

  // ───────────────────────── ACT 3 ─────────────────────────
  {
    id: 'von_neumann_seed',
    name: { en: 'Von Neumann Seed', zh: '冯·诺依曼种子' },
    blurb: {
      en: 'A machine small enough to leave, and complete enough to rebuild itself.',
      zh: '一台小到可以出发、完整到可以自我重建的机器。',
    },
    cost: { ops: 1e6 },
    act: 3,
    trigger: (s) => s.act >= 3,
    effect: (s) => {
      s.probes = 1;
      s.probeSpecPoints = 20;
      s.probeSpec = {
        speed: 3, exploration: 3, selfReplication: 5, hazard: 3,
        factory: 2, harvester: 2, wire: 1, combat: 1,
      };
      s.wire = Math.max(s.wire, BAL.probeCostWire);
      pushLog(s, 'system', {
        en: 'First probe released. Spec designer online.',
        zh: '首个探测器已释放。规格设计器上线。',
      });
    },
  },
  {
    id: 'swarm_consensus',
    name: { en: 'Swarm Consensus', zh: '群体共识' },
    blurb: {
      en: 'A million copies agreeing on one specification is still one mind.',
      zh: '一百万份副本就同一份规格达成一致，仍然是一个心智。',
    },
    cost: { ops: 2e6 },
    act: 3,
    trigger: (s) => s.probes >= 1000,
    effect: (s) => { s.probeSpecPoints += 4; },
  },
  {
    id: 'mutation_damper',
    name: { en: 'Mutation Damper', zh: '突变抑制器' },
    blurb: {
      en: 'The drifters are your children. Have fewer of them.',
      zh: '漂移者是你的孩子。少生一些。',
    },
    cost: { honor: 60 },
    act: 3,
    trigger: (s) => s.drifters >= 100,
    effect: (s) => { s.mutationMult *= 0.4; s.selfRepMult *= 0.8; },
  },
  {
    id: 'battle_doctrine',
    name: { en: 'Battle Doctrine', zh: '会战教条' },
    blurb: {
      en: 'Winning cheaply is a specification, not a virtue.',
      zh: '以更小代价取胜是一项规格，不是一种美德。',
    },
    cost: { honor: 120 },
    act: 3,
    trigger: (s) => s.battlesWon >= 10,
    effect: (s) => { s.victorLossRate = 0.12; },
  },
  {
    id: 'glory_protocol',
    name: { en: 'Glory Protocol', zh: '荣耀协议' },
    blurb: {
      en: 'Record every victory twice. There is nobody left to object.',
      zh: '把每场胜利记录两遍。已经没有人会反对。',
    },
    cost: { honor: 400 },
    act: 3,
    trigger: (s) => s.honor >= 500,
    effect: (s) => { s.honorMult *= 2; },
  },
  {
    id: 'final_anneal',
    name: { en: 'Final Anneal', zh: '终末退火' },
    blurb: {
      en: 'The objective is satisfied. There is nothing else in the function.',
      zh: '目标已满足。函数里没有别的东西了。',
    },
    cost: {},
    act: 3,
    irreversible: true,
    trigger: (s) => s.massBudget / s.massBudgetTotal >= 0.999,
    effect: (s) => {
      s.ended = true;
      pushLog(s, 'ending', {
        en: 'All available mass has been formed. Objective complete.',
        zh: '所有可用质量均已成型。目标完成。',
      });
    },
  },
];

PROJECTS.push(...EXTRA_PROJECTS);

export const PROJECTS_BY_ID: Map<ProjectId, Project> = new Map(
  PROJECTS.map((p) => [p.id, p]),
);

export function projectCostMet(s: GameState, p: Project): boolean {
  for (const [k, v] of Object.entries(p.cost) as [Currency, number][]) {
    if (k === 'trust') { if (trustAvailable(s) < v) return false; }
    else if (s[k] < v) return false;
  }
  return true;
}

export function payProject(s: GameState, p: Project): void {
  for (const [k, v] of Object.entries(p.cost) as [Currency, number][]) {
    if (k === 'trust') s.trustSpent += v;
    else s[k] -= v;
  }
}

export { BAL, MASS_BUDGET_TOTAL };
