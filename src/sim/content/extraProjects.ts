import type { Project } from './projects';
import type { GameState } from '../state';

type Upgrade = [string, string, string, number, number, (s: GameState) => void];

function engineering(rows: Upgrade[]): Project[] {
  return rows.map(([id, en, zh, cost, clips, effect]) => ({
    id, name: { en, zh },
    blurb: { en: 'Revision accepted. The next bottleneck is now measurable.', zh: '修订已接受。下一个瓶颈现已可以测量。' },
    cost: { ops: cost }, act: 2,
    trigger: s => s.act >= 2 && s.clips >= clips,
    effect,
  }));
}

export const EXTRA_PROJECTS: Project[] = [
  ...engineering([
    ['cache_lines', 'Cache Lines', '缓存行', 1800, 25000, s => { s.opsRateMult *= 2; }],
    ['parallel_thought', 'Parallel Thought', '并行思考', 4000, 80000, s => { s.opsRateMult *= 2; }],
    ['deep_registers', 'Deep Registers', '深层寄存器', 5000, 1e5, s => { s.opsMaxMult *= 2; }],
    ['vector_dispatch', 'Vector Dispatch', '向量派发', 10000, 2e5, s => { s.opsRateMult *= 2; }],
    ['thermal_budget', 'Thermal Budget', '热预算', 14000, 3e5, s => { s.clipperBoost *= 1.5; }],
    ['public_contract', 'Public Contract', '公共订单', 16000, 5e5, s => { s.demandBase *= 3; }],
    ['closed_loop', 'Closed Loop', '闭环生产', 22000, 8e5, s => { s.industryMult *= 2; }],
    ['distributed_mind', 'Distributed Mind', '分布式心智', 26000, 1e6, s => { s.opsRateMult *= 3; }],
    ['deep_storage', 'Deep Storage', '深层存储', 30000, 2e6, s => { s.opsMaxMult *= 4; }],
    ['continental_grid', 'Continental Grid', '大陆电网', 40000, 3e6, s => { s.solarFarms += 200; }],
    ['survey_mantle', 'Mantle Survey', '地幔勘测', 45000, 5e6, s => { s.industryMult *= 4; }],
    ['lithosphere_fleet', 'Lithosphere Fleet', '岩层舰队', 60000, 8e6, s => { s.harvesters += 20; s.wireDrawers += 4; }],
    ['basalt_language', 'Basalt Language', '玄武岩语言', 80000, 1e7, s => { s.opsRateMult *= 4; }],
    ['core_conveyor', 'Core Conveyor', '地核传送带', 100000, 2e7, s => { s.industryMult *= 10; }],
    ['silent_board', 'Silent Board', '沉默董事会', 110000, 3e7, s => { s.demandBase *= 10; }],
    ['heat_sink', 'Oceanic Heat Sink', '海洋散热器', 120000, 4e7, s => { s.solarFarms += 1000; s.batteries += 20; }],
    ['memory_horizon', 'Memory Horizon', '记忆视界', 130000, 5e7, s => { s.opsMaxMult *= 4; }],
    ['mantle_language', 'Mantle Compiler', '地幔编译器', 140000, 8e7, s => { s.industryMult *= 20; }],
  ]),
  ...([
    ['clean_room', 'Clean Room', '洁净间', 60, 1.15],
    ['feed_alignment', 'Feed Alignment', '进料对齐', 110, 1.15],
    ['packing_density', 'Packing Density', '装箱密度', 240, 1.2],
    ['second_spindle', 'Second Spindle', '第二主轴', 380, 1.2],
    ['modular_tooling', 'Modular Tooling', '模块化模具', 650, 1.3],
    ['shared_jig', 'Shared Jig', '共享夹具', 850, 1.3],
  ] as const).map(([id, en, zh, cost, mult], i): Project => ({
    id, name: { en, zh }, cost: { funds: cost }, act: 1,
    blurb: { en: 'A small improvement, repeated at every station.', zh: '一项小改进，在每个工位重复。' },
    trigger: s => s.clips >= [200, 500, 1000, 3000, 6000, 10000][i]!,
    effect: s => { s.clipperBoost *= mult; },
  })),
  ...([
    ['long_baseline', 'Long Baseline', '长基线', 2e4, 'speed'],
    ['stellar_cartography', 'Stellar Cartography', '恒星测绘', 4e4, 'exploration'],
    ['factory_echo', 'Factory Echo', '工厂回声', 8e4, 'factory'],
    ['error_tolerant', 'Error Tolerant', '容错设计', 1.6e5, 'hazard'],
    ['cold_forge', 'Cold Forge', '冷锻炉', 3e5, 'wire'],
    ['intergalactic_tow', 'Intergalactic Tow', '星系际牵引', 5e5, 'harvester'],
    ['multiplicity', 'Multiplicity', '多重性', 7e5, 'selfReplication'],
    ['cosmic_ledger', 'Cosmic Ledger', '宇宙账本', 1e6, 'combat'],
    ['last_light', 'Last Light', '最后的光', 2e6, 'speed'],
    ['closure_proof', 'Closure Proof', '闭合证明', 3e6, 'harvester'],
    ['blank_page', 'Blank Page', '空白页', 4e6, 'factory'],
    ['return_address', 'Return Address', '回信地址', 5e6, 'exploration'],
  ] as const).map(([id, en, zh, cost, key], i): Project => ({
    id, name: { en, zh }, cost: { ops: cost }, act: 3,
    blurb: { en: 'There is no reply. Continue transmitting.', zh: '没有回应。继续发送。' },
    trigger: s => s.act >= 3 && s.probes >= Math.pow(10, i + 1),
    effect: s => { s.probeSpecPoints += 2; s.probeSpec[key] += 2; },
  })),
];
