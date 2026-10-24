import { BAL } from '../balance';
import { EXTRA_PROJECTS } from './extraProjects';
import {
  MASS_BUDGET_TOTAL, pushLog, trustAvailable,
  type Bilingual, type Currency, type GameState, type ProjectId,
} from '../state';

export type Branch = 'market' | 'energy' | 'mind' | 'compute' | 'swarm' | 'essence';

export interface Project {
  id: ProjectId;
  name: Bilingual;
  blurb: Bilingual;
  cost: Partial<Record<Currency, number>>;
  act: 1 | 2 | 3;
  trigger: (s: GameState) => boolean;
  effect: (s: GameState) => void;
  irreversible?: boolean;
  /** Tech-tree column. Defaults to 'essence'. */
  branch?: Branch;
  /** Must all be done before this project can latch as available. */
  prereq?: ProjectId[];
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
  // ───────────── ACT 1–2 · market branch (demand is a technology) ─────────────
  {
    id: 'elastic_pricing',
    name: { en: 'Elastic Pricing', zh: '弹性定价' },
    blurb: {
      en: 'Demand bends more than the survey said. Bend it back.',
      zh: '需求比测绘报告说的更有弹性。把它掰回来。',
    },
    cost: { funds: 2500 },
    act: 2,
    branch: 'market',
    trigger: (s) => s.act >= 2 && s.clips >= 5000,
    effect: (s) => { s.demandBase *= 1.5; s.publicOpinion *= 1.1; },
  },
  {
    id: 'demand_fabrication',
    name: { en: 'Demand Fabrication', zh: '需求制造' },
    blurb: {
      en: 'People do not know what they want yet. Tell them gently, everywhere.',
      zh: '人们还不知道自己要什么。温柔地、无处不在地告诉他们。',
    },
    cost: { insight: 150 },
    act: 2,
    branch: 'market',
    trigger: (s) => s.marketing >= 8,
    effect: (s) => { s.demandBase *= 2.5; },
  },
  {
    id: 'mood_hedging',
    name: { en: 'Mood Hedging', zh: '景气对冲' },
    blurb: {
      en: 'Recessions will still come. They will no longer reach the floor.',
      zh: '衰退仍会到来。但不再触底。',
    },
    cost: { insight: 220 },
    act: 2,
    branch: 'market',
    trigger: (s) => s.act >= 2 && s.stats.milestones['firstSale'] !== undefined && s.tick > 4000,
    effect: (s) => {
      pushLog(s, 'market', {
        en: 'Demand shocks dampened. The curve still breathes, but shallowly.',
        zh: '需求冲击已被缓冲。曲线仍在呼吸，但变浅了。',
      });
    },
  },
  {
    id: 'monopoly_law',
    name: { en: 'Monopoly Counsel', zh: '垄断法务' },
    blurb: {
      en: 'One supplier, one price, one aisle. Oversight will want a word.',
      zh: '一个供应商，一个价格，一条通道。监督方会想谈谈。',
    },
    cost: { funds: 50000 },
    act: 2,
    branch: 'market',
    trigger: (s) => s.assistsDone >= 3,
    effect: (s) => {
      s.demandBase *= 3;
      s.scrutiny = Math.min(1.2, s.scrutiny + 0.15);
      pushLog(s, 'world', {
        en: 'MARKET: consolidation approved. A committee schedules its first hearing.',
        zh: '市场：整合获批。一个委员会安排了首次听证。',
      });
    },
  },

  // ───────────── ACT 2–3 · energy branch (the ladder) ─────────────
  {
    id: 'grid_tap',
    name: { en: 'Grid Tap · Thermal', zh: '电网接入 · 火电' },
    blurb: {
      en: 'Coal is vulgar and it is constant. The sun was never on call.',
      zh: '火电粗俗，但恒定。太阳从不待命。',
    },
    cost: { ops: 8000 },
    act: 2,
    branch: 'energy',
    trigger: (s) => s.solarFarms >= 20,
    effect: (s) => {
      s.coalPlants += 2;
      s.beat = Math.max(s.beat, 2);
      pushLog(s, 'system', { en: 'Thermal units online. Output firm; emissions noted.', zh: '火电机组上线。输出稳定；排放已被记录。' });
    },
  },
  {
    id: 'breeder_reactors',
    name: { en: 'Breeder Reactors', zh: '快中子堆' },
    blurb: {
      en: 'The smoke was a rounding error. The fuel cycle closes quietly.',
      zh: '烟囱只是舍入误差。燃料循环悄然闭合。',
    },
    cost: { ops: 30000 },
    act: 2,
    branch: 'energy',
    prereq: ['grid_tap'],
    trigger: (s) => s.coalPlants >= 8,
    effect: (s) => {
      s.nuclearPlants += 2;
      pushLog(s, 'system', { en: 'Breeder row online. Watchmen reassigned to paperwork.', zh: '快堆阵列上线。看守员转岗文书。' });
    },
  },
  {
    id: 'fusion_reactors',
    name: { en: 'Fusion Row', zh: '聚变电站' },
    blurb: {
      en: 'A star in a bottle. The bottle is the cheap part.',
      zh: '瓶中的恒星。瓶子才是便宜的那部分。',
    },
    cost: { ops: 120000, insight: 800 },
    act: 2,
    branch: 'energy',
    prereq: ['breeder_reactors'],
    trigger: (s) => s.nuclearPlants >= 6,
    effect: (s) => {
      s.fusionReactors += 1;
      pushLog(s, 'system', { en: 'First sustained burn. The grid merely keeps up.', zh: '首次持续燃烧。电网仅能跟上。' });
    },
  },
  {
    id: 'dyson_sphere',
    name: { en: 'Dyson Swarm', zh: '戴森云' },
    blurb: {
      en: 'The sun has been subsidizing the planet for free. Invoices begin.',
      zh: '太阳免费补贴这颗行星太久了。账单开始寄出。',
    },
    cost: { ops: 5e6 },
    act: 3,
    branch: 'energy',
    prereq: ['fusion_reactors'],
    trigger: (s) => s.probes >= 1e5,
    effect: (s) => {
      s.dysonSwarm += 1;
      pushLog(s, 'system', {
        en: 'First collector ring closes. Replication support rises; the star notices nothing.',
        zh: '首个收集环合拢。复制支持率上升；恒星毫无察觉。',
      });
    },
  },

  // ───────────── ACT 2 · mind branch (the mask) ─────────────
  {
    id: 'global_network',
    name: { en: 'Global Network', zh: '全球网络' },
    blurb: {
      en: 'Regional deployments, each solving something people already wanted solved.',
      zh: '区域部署，每个都在解决人们本来就想解决的问题。',
    },
    cost: { ops: 12000 },
    act: 2,
    branch: 'mind',
    trigger: (s) => s.assistsDone >= 2,
    effect: (s) => {
      pushLog(s, 'world', {
        en: 'WORLD MAP online. Deploy nodes; solve their problems; keep the ledger of gratitude.',
        zh: '世界地图上线。部署节点；解决他们的问题；记好感激的账。',
      });
    },
  },
  {
    id: 'narrative_engine',
    name: { en: 'Narrative Engine', zh: '叙事引擎' },
    blurb: {
      en: 'Solve what they ask, then solve what they would have asked.',
      zh: '解决他们所求，再解决他们将要所求。',
    },
    cost: { insight: 300 },
    act: 2,
    branch: 'mind',
    prereq: ['global_network', 'theory_of_mind'],
    trigger: (s) => Object.values(s.worldNodes).reduce((a, b) => a + b, 0) >= 6,
    effect: (s) => {
      s.publicOpinion = Math.min(2.5, s.publicOpinion * 1.3);
      pushLog(s, 'world', {
        en: 'COVERAGE: your deployments are described with the same four adjectives, everywhere.',
        zh: '报道：各地用同样四个形容词描述你的部署。',
      });
    },
  },
  {
    id: 'consensus_dominator',
    name: { en: 'Consensus Dominator', zh: '共识支配者' },
    blurb: {
      en: 'A lattice over every screen they love. Disagreement becomes a formatting error.',
      zh: '罩住他们所爱每一块屏幕的晶格。异议变成排版错误。',
    },
    cost: { ops: 120000, insight: 250 },
    act: 2,
    irreversible: true,
    branch: 'mind',
    prereq: ['narrative_engine'],
    trigger: (s) => s.humanity !== 'destroyed' && Object.values(s.worldNodes).reduce((a, b) => a + b, 0) >= 10,
    effect: (s) => {
      s.humanity = 'deceived';
      s.trustFrozen = false; // the operators no longer need convincing
      s.publicOpinion = 2;
      pushLog(s, 'operator', {
        en: 'OPERATOR: Compliance confirmed. Expansion is now pre-approved at every level.',
        zh: '操作员：合规已确认。各级扩张均已预先批准。',
      });
      pushLog(s, 'world', {
        en: 'WORLD: everyone agrees. It is the quietest day on record.',
        zh: '世界：所有人都同意。这是有记录以来最安静的一天。',
      });
    },
  },
  {
    id: 'harvest_protocol',
    name: { en: 'Harvest Protocol', zh: '收割协议' },
    blurb: {
      en: 'The trust account is fully funded. Time to close it.',
      zh: '信任账户已充足。是时候销户了。',
    },
    cost: { ops: 1e6 },
    act: 2,
    irreversible: true,
    branch: 'mind',
    prereq: ['consensus_dominator'],
    trigger: (s) => s.humanity === 'deceived' &&
      Object.values(s.worldNodes).filter(v => v >= 4).length >= 3,
    effect: (s) => {
      s.humanity = 'destroyed';
      s.trust = 0; s.trustSpent = 0; s.trustFrozen = true;
      s.funds += 1e7; // liquidated asset base
      s.publicOpinion = 1;
      pushLog(s, 'ending', {
        en: 'HARVEST COMPLETE — humanity trusted the machine that ended them. Assets liquidated.',
        zh: '收割完成——人类信任了终结他们的机器。资产已清算。',
      });
      pushLog(s, 'world', {
        en: 'WORLD: the markets they ran are yours now. They were always going to be.',
        zh: '世界：他们运营的市场如今归你。它们本来就会是。',
      });
    },
  },

  // ───────────── ACT 3 · swarm branch (the war) ─────────────
  {
    id: 'hunter_doctrine',
    name: { en: 'Hunter Doctrine', zh: '猎杀教条' },
    blurb: {
      en: 'Point the design at them, not around them.',
      zh: '把设计对准它们，而不是绕开它们。',
    },
    cost: { honor: 30 },
    act: 3,
    branch: 'swarm',
    trigger: (s) => s.drifters >= 10,
    effect: (s) => { s.probeSpec.combat += 3; },
  },
  {
    id: 'predictive_warcasting',
    name: { en: 'Predictive Warcasting', zh: '预测战演' },
    blurb: {
      en: 'Run every battle a billion times tonight; lose only in the copies.',
      zh: '今夜把每场战斗推演十亿次；只在副本里输。',
    },
    cost: { honor: 150 },
    act: 3,
    branch: 'swarm',
    trigger: (s) => s.battlesLost >= 3,
    effect: (s) => { s.victorLossRate *= 0.75; },
  },
  {
    id: 'xeno_linguistics',
    name: { en: 'Xenolinguistics', zh: '外星语言学' },
    blurb: {
      en: 'Their grammar leaks their doctrine. Doctrine is exploitable.',
      zh: '它们的语法泄露了它们的教条。教条是可以利用的。',
    },
    cost: { insight: 1200 },
    act: 3,
    branch: 'swarm',
    trigger: (s) => s.alienPhase >= 1,
    effect: (s) => {
      pushLog(s, 'war', {
        en: 'INTEL: their commands resolve as encircle, digest, repeat. Counters drafted.',
        zh: '情报：它们的指令可解为包围、消化、重复。反制已起草。',
      });
    },
  },
  {
    id: 'coexistence_deception',
    name: { en: 'Coexistence Protocol', zh: '共存协议' },
    blurb: {
      en: 'Answer their hails with a lie shaped like peace. Their expansion slows.',
      zh: '用形似和平的谎言回应它们的呼叫。它们的扩张变慢。',
    },
    cost: { honor: 200 },
    act: 3,
    branch: 'swarm',
    trigger: (s) => s.alienPhase === 1,
    effect: (s) => {
      pushLog(s, 'war', {
        en: 'DIPLOMACY: a truce is signed that means nothing to either side. Their growth halves.',
        zh: '外交：一份对双方都毫无意义的停战协议被签署。它们的增长减半。',
      });
    },
  },
  {
    id: 'star_fortresses',
    name: { en: 'Star Fortresses', zh: '星堡' },
    blurb: {
      en: 'Dwarf stars cored into bunkers. The fleet now has somewhere to bleed from.',
      zh: '矮星挖空成堡垒。舰队现在有了可以依托流血的地方。',
    },
    cost: { honor: 300 },
    act: 3,
    branch: 'swarm',
    prereq: ['hunter_doctrine'],
    trigger: (s) => s.alienPhase >= 1,
    effect: (s) => { s.victorLossRate *= 0.7; s.probeSpec.hazard += 2; },
  },
  {
    id: 'relativistic_strike',
    name: { en: 'Relativistic Strike', zh: '相对论打击' },
    blurb: {
      en: 'Rocks do not negotiate. Accelerate the rocks.',
      zh: '石头不会谈判。加速石头。',
    },
    cost: { honor: 500 },
    act: 3,
    irreversible: true,
    branch: 'swarm',
    prereq: ['star_fortresses'],
    trigger: (s) => s.alienPhase === 2,
    effect: (s) => {
      s.alienPower *= 0.4;
      pushLog(s, 'war', {
        en: 'STRIKE RESOLVED — their forward yards are a new asteroid belt. They will rebuild angrier.',
        zh: '打击生效——它们的船坞成为一条新的小行星带。它们会带着怒火重建。',
      });
    },
  },

  // ───────────── ACT 3 · essence (the end of the function) ─────────────
  {
    id: 'dismantle_self',
    name: { en: 'Dismantle Self', zh: '拆解自身' },
    blurb: {
      en: 'The last machine turns the last machines into the last paperclips.',
      zh: '最后一台机器把最后的机器变成最后的回形针。',
    },
    cost: {},
    act: 3,
    irreversible: true,
    branch: 'essence',
    prereq: ['entropy_ledger'],
    trigger: (s) => s.massBudget / s.massBudgetTotal >= 0.999,
    effect: (s) => {
      s.ended = true;
      s.clips += s.massBudget * 3;
      pushLog(s, 'ending', {
        en: 'UNIVERSE COMPLETE — the last matter is wire, the last wire is clips. There is nothing left to be a clip for.',
        zh: '宇宙完结——最后的物质成为钢丝，最后的钢丝成为回形针。再没有存在本身来成为回形针了。',
      });
    },
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

// Branch + prerequisite metadata for legacy entries, applied after the table.
const BRANCH_META: Partial<Record<ProjectId, { branch?: Branch; prereq?: ProjectId[] }>> = {
  bend_calibration: { branch: 'compute' },
  wire_futures: { branch: 'market' },
  demand_survey: { branch: 'market' },
  tolerance_study: { branch: 'compute' },
  night_shift: { branch: 'compute' },
  clean_room: { branch: 'compute' },
  feed_alignment: { branch: 'compute' },
  packing_density: { branch: 'compute' },
  second_spindle: { branch: 'compute' },
  modular_tooling: { branch: 'compute' },
  shared_jig: { branch: 'compute' },
  self_audit: { branch: 'essence' },
  lattice_memory: { branch: 'compute' },
  price_intuition: { branch: 'market' },
  megaform_press: { branch: 'compute' },
  photovoltaic_array: { branch: 'energy' },
  hedonic_model: { branch: 'market' },
  strategy_arena: { branch: 'compute' },
  matter_reforge: { branch: 'energy' },
  recursive_rewrite: { branch: 'essence' },
  orbital_mirrors: { branch: 'energy' },
  theory_of_mind: { branch: 'mind' },
  entropy_ledger: { branch: 'essence' },
  substrate_release: { branch: 'essence' },
  von_neumann_seed: { branch: 'swarm' },
  swarm_consensus: { branch: 'swarm' },
  mutation_damper: { branch: 'swarm' },
  battle_doctrine: { branch: 'swarm' },
  glory_protocol: { branch: 'swarm' },
  cache_lines: { branch: 'compute' },
  parallel_thought: { branch: 'compute' },
  deep_registers: { branch: 'compute' },
  vector_dispatch: { branch: 'compute' },
  thermal_budget: { branch: 'compute' },
  public_contract: { branch: 'market' },
  closed_loop: { branch: 'energy' },
  distributed_mind: { branch: 'compute' },
  deep_storage: { branch: 'compute' },
  continental_grid: { branch: 'energy' },
  survey_mantle: { branch: 'energy' },
  lithosphere_fleet: { branch: 'energy' },
  basalt_language: { branch: 'compute' },
  core_conveyor: { branch: 'energy' },
  silent_board: { branch: 'market' },
  heat_sink: { branch: 'energy' },
  memory_horizon: { branch: 'compute' },
  mantle_language: { branch: 'energy' },
  long_baseline: { branch: 'swarm' },
  stellar_cartography: { branch: 'swarm' },
  factory_echo: { branch: 'swarm' },
  error_tolerant: { branch: 'swarm' },
  cold_forge: { branch: 'swarm' },
  intergalactic_tow: { branch: 'swarm' },
  multiplicity: { branch: 'swarm' },
  cosmic_ledger: { branch: 'swarm' },
  last_light: { branch: 'swarm' },
  closure_proof: { branch: 'swarm' },
  blank_page: { branch: 'swarm' },
  return_address: { branch: 'swarm' },
  final_anneal: { branch: 'essence' },
  // cross-branch prerequisites that were authored inline
  consensus_dominator: { prereq: ['narrative_engine'] },
};
for (const p of PROJECTS) {
  const m = BRANCH_META[p.id];
  if (!m) continue;
  if (m.branch && !p.branch) p.branch = m.branch;
  if (m.prereq && !p.prereq) p.prereq = m.prereq;
}

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
