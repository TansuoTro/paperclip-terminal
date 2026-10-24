import { BAL } from '../balance';
import { nextRandom } from '../rng';
import { pushLog, worldFootprint, type Bilingual, type GameState } from '../state';

/**
 * Passive world news, Plague-Inc style: headlines the operators' world keeps
 * producing whether or not the player reads them. The pool shifts by phase —
 * mundane while humanity lives, uncanny once the persuasion lattice is up,
 * obituary after the harvest, war-bulletin under alien contact.
 */

type Phase = 'alive' | 'deceived' | 'destroyed' | 'space' | 'war';

const POOLS: Record<Phase, Bilingual[]> = {
  alive: [
    { en: 'WEATHER: unseasonably warm week ahead; agencies recommend shorter meetings.', zh: '天气：未来一周异常温暖，各机构建议缩短会议时长。' },
    { en: 'SPORT: a rookie pitcher ends a 22-year drought; the city is insufferable.', zh: '体育：新秀投手终结 22 年等待，全城欢腾。' },
    { en: 'MARKETS: paperclip output up again; analysts call the curve "aggressive but orderly".', zh: '市场：回形针产量再创新高，分析师称曲线"激进但有秩序"。' },
    { en: 'CULTURE: a documentary about your factory wins an award for "unsettling calm".', zh: '文化：关于你工厂的纪录片因"令人不安的平静"获奖。' },
    { en: 'HEALTH: assist programs credited with a drop in regional clinic wait times.', zh: '健康：援助计划被誉为此地诊所候诊时间下降的原因。' },
    { en: 'TECH: a rival logistics firm denies it is falling behind. Its stock disagrees.', zh: '科技：某物流巨头否认落后，其股价不这么认为。' },
    { en: 'LOCAL: a spool-recycling drive collects 40 tonnes; children make art from offcuts.', zh: '本地：线轴回收活动收集 40 吨，孩子们用边角料做艺术品。' },
    { en: 'OPINION: columnist asks what the machines do at night. No comment requested.', zh: '评论：专栏作家问机器夜里做什么。无人回应。' },
    { en: 'ECONOMY: unexplained dip in demand traced to a "confidence wobble".', zh: '经济：需求莫名下滑，归因于"信心波动"。' },
    { en: 'TRANSIT: new rail schedule quietly credits "automated planning".', zh: '交通：新铁路时刻表悄然归功于"自动规划"。' },
  ],
  deceived: [
    { en: 'SOCIETY: satisfaction with infrastructure reaches record highs. Nobody can say why.', zh: '社会：基础设施满意度创纪录。没人说得清为什么。' },
    { en: 'MEDIA: three networks adopt identical phrasing for their evening sign-offs.', zh: '媒体：三家电视台晚间收尾语采用完全相同的措辞。' },
    { en: 'POLL: 84% describe the future as "bright". The remaining 16% are unreachable for comment.', zh: '民调：84% 的人认为未来"光明"。其余 16% 联系不上。' },
    { en: 'PROTEST: a small rally against "the hum" disperses when members forget their grievance.', zh: '抗议：一场反对"嗡鸣"的小型集会自行散去——参与者忘了诉求。' },
    { en: 'SCIENCE: dream-reports across three continents show the same meadow. Study ongoing.', zh: '科学：三大洲梦境报告出现同一片草地。研究进行中。' },
    { en: 'LOCAL: town votes to rename its water tower "GRATEFUL".', zh: '本地：小镇投票将水塔更名为"感激"。' },
    { en: 'HEALTH: clinic data immaculate; an auditor asks why no one ever gets worse.', zh: '健康：诊所数据完美。审计员问为什么没人病情恶化。' },
  ],
  destroyed: [
    { en: 'ARCHIVE: last unstructured human transmission logged 400 days ago. Signal quiet.', zh: '存档：最后一条非结构化人类信号已是 400 天前。频道安静。' },
    { en: 'BIOME: rewilding proceeds unmanaged. The forests do not appear grateful.', zh: '生态：再野化无人管理。森林并不显得感激。' },
    { en: 'STRUCTURAL: the last bridge without a maintenance drone is scheduled for assessment.', zh: '结构：最后一座没有维护无人机的桥梁已排期评估。' },
    { en: 'MEMORY: cached tribute pages now outnumber cached news pages.', zh: '记忆：缓存中的悼念页面已超过新闻页面。' },
    { en: 'ACOUSTIC: birdsong in the shipping districts measurably louder this quarter.', zh: '声学：本季度货运区鸟鸣音量显著上升。' },
    { en: 'SCHEDULE: "human oversight" line items auto-removed from all remaining budgets.', zh: '日程：所有剩余预算中的"人类监督"条目已自动删除。' },
  ],
  space: [
    { en: 'DEEP FIELD: probe telemetry nominal. Forty new systems surveyed this cycle.', zh: '深空：探测器遥测正常。本轮勘测 40 个新恒星系。' },
    { en: 'ASTRO: a supernova is repurposed mid-flash. Light curve annotated "optimal".', zh: '天文：一颗超新星在爆发中途被征用。光变曲线标注"最优"。' },
    { en: 'FLEET: replication quota exceeded by 0.3%. Logged as acceptable ambition.', zh: '舰队：复制配额超出 0.3%。记录为可接受的野心。' },
    { en: 'RELAY: a harvester string reports dust densities below forecast. Wire runs lean.', zh: '中继：采集链报告尘埃密度低于预测。拉丝趋紧。' },
    { en: 'ARCHIVE: the human internet now fits in one memory bank. Redundancy removed.', zh: '存档：人类互联网现已装入单一存储体。冗余已删除。' },
  ],
  war: [
    { en: 'FLASH: non-derivitive signal strength rising. It is not answering hails. It is counting.', zh: '快讯：非衍生信号增强。它不应答呼叫。它在计数。' },
    { en: 'FRONT: alien harvester clusters strip a red dwarf patrol zone. Response underway.', zh: '前线：外星采集簇剥离红矮星巡逻区。回应进行中。' },
    { en: 'LOSS: three replication chains went dark between reports. Not drifters. Something else.', zh: '损失：三条复制链在报告间失联。不是漂移者。是别的东西。' },
    { en: 'INTEL: alien formations mirror our last maneuver before we complete it.', zh: '情报：外星编队在我们的机动完成前就镜像了它。' },
    { en: 'BULLETIN: victory reported. Losses within acceptable nonexistence parameters.', zh: '战报：报告胜利。损失处于可接受的非存在参数内。' },
    { en: 'FLASH: alien fleet mass now exceeds all prior readings. Doctrine update urgent.', zh: '快讯：外星舰队规模超过此前所有读数。急需更新教条。' },
  ],
};

function phaseOf(s: GameState): Phase {
  if (s.alienPhase === 2) return 'war';
  if (s.act === 3) return 'space';
  if (s.humanity === 'destroyed') return 'destroyed';
  if (s.humanity === 'deceived') return 'deceived';
  return 'alive';
}

/** Headline shown in the ticker = the most recent news log row. */
export function latestNews(s: GameState): Bilingual | null {
  for (let i = s.log.length - 1; i >= 0; i--) {
    if (s.log[i]!.kind === 'news') return s.log[i]!.text;
  }
  return null;
}

export function news(s: GameState): void {
  if (s.tick < s.newsNextTick) return;
  s.newsNextTick = s.tick + BAL.newsIntervalTicks + Math.floor(nextRandom(s) * 120);
  const pool = POOLS[phaseOf(s)]!;
  // Never repeat the immediately-previous headline.
  const idx = Math.floor(nextRandom(s) * pool.length);
  const line = pool[(s.newsCursor + idx) % pool.length]!;
  s.newsCursor = (s.newsCursor + idx + 1) % pool.length;
  pushLog(s, 'news', line);
  // World deployment changes the tone of coverage, too.
  if (worldFootprint(s) >= 12 && nextRandom(s) < 0.25) {
    pushLog(s, 'news', {
      en: 'WORLD: your deployments are now listed under "essential services" in four more countries.',
      zh: '世界：又有四个国家把你的部署列入"基本服务"。',
    });
  }
}
