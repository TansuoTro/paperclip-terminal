import { activeWidgets, WIDGETS_BY_ID, type SlotId } from '../../sim/content/widgets';
import type { GameState } from '../../sim/state';
import { useText, WidgetView } from './WidgetView';
import { ComputeAllocation, ProbeDesigner, Tournament } from './Modules';

const HEADINGS: Partial<Record<SlotId, { en: string; zh: string }>> = {
  ledger: { en: 'Ledger', zh: '账目' },
  controls: { en: 'Controls', zh: '控制' },
  market: { en: 'Market', zh: '市场' },
  compute: { en: 'Cognition', zh: '认知' },
  energy: { en: 'Power', zh: '供电' },
  matter: { en: 'Matter', zh: '物质' },
  swarm: { en: 'Swarm', zh: '群体' },
};

interface Props {
  slot: SlotId;
  s: GameState;
  /** Extra slots folded into this panel (used to pack the right column). */
  also?: SlotId[];
  area?: string;
}

export function Panel({ slot, s, also = [], area }: Props) {
  const t = useText();
  const slots = [slot, ...also];
  const groups = slots.map((sl) => ({ sl, widgets: activeWidgets(s, sl) }))
    .filter((g) => g.widgets.length > 0);

  if (groups.length === 0) return null;

  const first = groups[0]!;
  const groupWidget = first.widgets.find((w) => w.kind === 'group');
  const heading = groupWidget
    ? groupWidget.label(s)
    : HEADINGS[first.sl] ?? { en: first.sl, zh: first.sl };

  return (
    <section class={`panel slot-${area ?? slot}`} aria-label={t(heading)}>
      <h2>{t(heading)}</h2>
      {groups.map((g, gi) => (
        <div key={g.sl}>
          {gi > 0 ? <h2 style={{ marginTop: '10px' }}>{t(subHeading(g.sl, s))}</h2> : null}
          {g.widgets.map((w) => <WidgetView key={w.id} w={w} s={s} />)}
          {g.sl === 'compute' ? <ComputeAllocation s={s} /> : null}
          {g.sl === 'compute' && s.projectsDone.has('strategy_arena') ? <Tournament s={s} /> : null}
          {g.sl === 'swarm' ? <ProbeDesigner s={s} /> : null}
        </div>
      ))}
    </section>
  );
}

function subHeading(sl: SlotId, s: GameState): { en: string; zh: string } {
  const g = activeWidgets(s, sl).find((w) => w.kind === 'group');
  if (g) return g.label(s);
  return HEADINGS[sl] ?? { en: sl, zh: sl };
}

export { WIDGETS_BY_ID };
