import { bus } from '../../app/bus';
import { audio } from '../../audio/Engine';
import { PROJECTS_BY_ID } from '../../sim/content/projects';
import { fmt, fmtMoney } from '../../sim/format';
import { canBuyProject, visibleProjects } from '../../sim/systems/research';
import type { Currency, GameState } from '../../sim/state';
import { useText } from './WidgetView';

const CURRENCY_LABEL: Record<Currency, { en: string; zh: string }> = {
  funds: { en: '', zh: '' },
  ops: { en: 'ops', zh: '运算' },
  insight: { en: 'insight', zh: '洞察' },
  trust: { en: 'trust', zh: '信任' },
  honor: { en: 'honor', zh: '荣誉' },
};

export function Projects({ s }: { s: GameState }) {
  const t = useText();
  const ids = visibleProjects(s);
  if (ids.length === 0) return null;

  return (
    <section class="panel slot-projects" aria-label={t({ en: 'Projects', zh: '项目' })}>
      <h2>{t({ en: 'Projects', zh: '项目' })}</h2>
      {ids.map((id) => {
        const p = PROJECTS_BY_ID.get(id);
        if (!p) return null;
        const affordable = canBuyProject(s, id);
        const cost = (Object.entries(p.cost) as [Currency, number][])
          .map(([k, v]) => (k === 'funds' ? fmtMoney(v, s.settings) : `${fmt(v, s.settings)} ${t(CURRENCY_LABEL[k])}`))
          .join(' · ');

        return (
          <button
            key={id}
            class={`project${p.irreversible ? ' irreversible' : ''}`}
            disabled={!affordable}
            onClick={() => {
              if (!affordable) { audio.sfx('deny', s.act); return; }
              if (p.irreversible) {
                const msg = t({
                  en: `${p.name.en} cannot be undone. Proceed?`,
                  zh: `${p.name.zh}不可撤销。确定继续？`,
                });
                if (!window.confirm(msg)) return;
              }
              bus.dispatch({ type: 'buyProject', id });
              audio.sfx('project', s.act);
            }}
          >
            <span class="pname">
              {t(p.name)}
              {p.irreversible ? ' ⚠' : ''}
              {cost ? <span class="pcost"> — {cost}</span> : null}
            </span>
            <span class="pblurb">{t(p.blurb)}</span>
          </button>
        );
      })}
    </section>
  );
}
