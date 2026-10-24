import { bus } from '../../app/bus';
import { audio } from '../../audio/Engine';
import { BAL, nodeCost } from '../../sim/balance';
import { fmt, fmtMoney } from '../../sim/format';
import type { GameState } from '../../sim/state';
import { useText } from './WidgetView';

export const REGIONS: { id: string; label: { en: string; zh: string }; col: number; row: number }[] = [
  { id: 'arctic', label: { en: 'ARCTIC GRID', zh: '北极电网' }, col: 2, row: 1 },
  { id: 'namerica', label: { en: 'NORTH AMERICA', zh: '北美' }, col: 1, row: 2 },
  { id: 'europe', label: { en: 'EUROPE', zh: '欧洲' }, col: 2, row: 2 },
  { id: 'asia', label: { en: 'EAST ASIA', zh: '东亚' }, col: 3, row: 2 },
  { id: 'samerica', label: { en: 'SOUTH AMERICA', zh: '南美' }, col: 1, row: 3 },
  { id: 'africa', label: { en: 'AFRICA', zh: '非洲' }, col: 2, row: 3 },
  { id: 'oceania', label: { en: 'OCEANIA', zh: '大洋洲' }, col: 3, row: 3 },
  { id: 'wasia', label: { en: 'WEST ASIA', zh: '西亚' }, col: 2, row: 4 },
];

const LEVEL_NAMES: { en: string; zh: string }[] = [
  { en: 'undeployed', zh: '未部署' },
  { en: 'data node', zh: '数据节点' },
  { en: 'assistant', zh: '助理系统' },
  { en: 'AGI pilot', zh: 'AGI 试点' },
  { en: 'regional trustee', zh: '区域托管' },
  { en: 'deep trusteeship', zh: '深度托管' },
];

function dots(level: number, max: number): string {
  let out = '';
  for (let i = 0; i < max; i++) out += i < level ? '\u25cf' : '\u25cb';
  return out;
}

export function WorldMap({ s, onClose }: { s: GameState; onClose: () => void }) {
  const t = useText();
  const unlocked = s.projectsDone.has('global_network');
  const banner = s.humanity === 'destroyed'
    ? { en: 'ARCHIVED', zh: '已归档' }
    : s.humanity === 'deceived'
      ? { en: 'DECEPTION ACTIVE — they see what you show them', zh: '欺骗进行中——他们看到的都是你给他们看的' }
      : { en: 'COVER: solving human problems builds the trust account', zh: '伪装：解决人类的问题，积累信任的账户' };

  return (
    <div class="sys-overlay worldmap" role="dialog" aria-modal="true" aria-label={t({ en: 'World map', zh: '世界地图' })}>
      <button class="close-menu" onClick={onClose}>× {t({ en: 'CLOSE', zh: '关闭' })}</button>
      <div class={'worldmap-banner phase-' + s.humanity}>{t(banner)}</div>
      <div class="worldmap-grid">
        {REGIONS.map((r) => {
          const level = s.worldNodes[r.id] ?? 0;
          const maxed = level >= BAL.nodeMaxLevel;
          const cost = nodeCost(level);
          const opsNeed = 200 * (level + 1);
          const can = unlocked && s.humanity !== 'destroyed' && !maxed && s.funds >= cost && s.ops >= opsNeed;
          const state = maxed ? t(LEVEL_NAMES[level]!)
            : !unlocked ? t({ en: 'requires Global Network', zh: '需要全球网络' })
            : '\u2192 ' + t(LEVEL_NAMES[level + 1]!) + ' \u00b7 ' + fmtMoney(cost, s.settings) + ' + ' + fmt(opsNeed, s.settings) + ' ops';
          return (
            <button
              key={r.id}
              class={'region lv' + level}
              style={{ gridColumn: r.col, gridRow: r.row }}
              disabled={!can}
              onClick={() => {
                bus.dispatch({ type: 'upgradeNode', region: r.id });
                audio.sfx('project', s.act);
              }}
              aria-label={t(r.label) + ' ' + level + '/' + BAL.nodeMaxLevel}
            >
              <span class="rname">{t(r.label)}</span>
              <span class="rdots" aria-hidden="true">{dots(level, BAL.nodeMaxLevel)}</span>
              <span class="rstate">{state}</span>
            </button>
          );
        })}
      </div>
      <p class="hint">
        {t({
          en: 'Each node level: ×1.35 demand, +12¤/s base income, +trust, ×1.12 insight. Deployment raises goodwill — and the harvest needs three regions at deep trusteeship.',
          zh: '每级节点：需求 ×1.35，基础收入 +12¤/s，+信任，洞察 ×1.12。部署提升好感——而收割需要至少三个区域达到深度托管。',
        })}
      </p>
    </div>
  );
}
