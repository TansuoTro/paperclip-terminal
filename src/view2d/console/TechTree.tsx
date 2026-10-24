import { bus } from '../../app/bus';
import { audio } from '../../audio/Engine';
import { PROJECTS, PROJECTS_BY_ID, type Branch, type Project } from '../../sim/content/projects';
import { fmt, fmtMoney } from '../../sim/format';
import { canBuyProject } from '../../sim/systems/research';
import type { Currency, GameState } from '../../sim/state';
import { useText } from './WidgetView';

const BRANCHES: { id: Branch; label: { en: string; zh: string } }[] = [
  { id: 'market', label: { en: 'MARKET', zh: '市场' } },
  { id: 'energy', label: { en: 'ENERGY', zh: '能源' } },
  { id: 'mind', label: { en: 'MIND', zh: '心智' } },
  { id: 'compute', label: { en: 'COMPUTE', zh: '算力' } },
  { id: 'swarm', label: { en: 'SWARM', zh: '群体' } },
  { id: 'essence', label: { en: 'ESSENCE', zh: '本质' } },
];

const CURRENCY_SHORT: Record<Currency, { en: string; zh: string }> = {
  funds: { en: '', zh: '' },
  ops: { en: 'ops', zh: '运算' },
  insight: { en: 'ins', zh: '洞察' },
  trust: { en: 'trust', zh: '信任' },
  honor: { en: 'hon', zh: '荣誉' },
};

function costText(p: Project, s: GameState, tf: (b: { en: string; zh: string }) => string): string {
  return (Object.entries(p.cost) as [Currency, number][])
    .map(([k, v]) => (k === 'funds' ? fmtMoney(v, s.settings) : `${fmt(v, s.settings)} ${tf(CURRENCY_SHORT[k])}`))
    .join(' · ');
}

export function TechTree({ s, onClose }: { s: GameState; onClose: () => void }) {
  const t = useText();
  const byBranch = new Map<Branch, Project[]>();
  for (const p of PROJECTS) {
    const b = p.branch ?? 'essence';
    if (!byBranch.has(b)) byBranch.set(b, []);
    byBranch.get(b)!.push(p);
  }

  return (
    <div class="sys-overlay techtree" role="dialog" aria-modal="true" aria-label={t({ en: 'Technology tree', zh: '科技树' })}>
      <button class="close-menu" onClick={onClose}>× {t({ en: 'CLOSE', zh: '关闭' })}</button>
      <div class="techtree-grid">
        {BRANCHES.map(({ id, label }) => (
          <div class="tech-col" key={id}>
            <h2>{t(label)}</h2>
            {(byBranch.get(id) ?? []).map((p) => {
              const done = s.projectsDone.has(p.id);
              const prereqMissing = p.prereq?.filter((q) => !s.projectsDone.has(q)) ?? [];
              const available = s.projectsAvailable.has(p.id);
              const affordable = available && canBuyProject(s, p.id);
              const state = done ? 'done' : available ? (affordable ? 'buyable' : 'poor') : 'locked';
              return (
                <button
                  key={p.id}
                  class={`ttech ${state}${p.irreversible ? ' irreversible' : ''}`}
                  disabled={!affordable}
                  title={t(p.blurb)}
                  onClick={() => {
                    if (p.irreversible) {
                      const msg = t({ en: `${p.name.en} cannot be undone. Proceed?`, zh: `${p.name.zh}不可撤销。确定继续？` });
                      if (!window.confirm(msg)) return;
                    }
                    bus.dispatch({ type: 'buyProject', id: p.id });
                    audio.sfx('project', s.act);
                  }}
                >
                  <span class="pname">{t(p.name)}</span>
                  <span class="tstate">
                    {done ? '✓' : prereqMissing.length > 0
                      ? `🔒 ${prereqMissing.map((q) => t(PROJECTS_BY_ID.get(q)?.name ?? { en: q, zh: q })).join('+')}`
                      : available ? costText(p, s, t)
                      : '···'}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
