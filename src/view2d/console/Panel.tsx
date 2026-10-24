import { useEffect, useRef } from 'preact/hooks';
import { activeWidgets, WIDGETS_BY_ID, type SlotId } from '../../sim/content/widgets';
import type { GameState } from '../../sim/state';
import { useText, WidgetView } from './WidgetView';
import { ComputeAllocation, ProbeDesigner, Tournament } from './Modules';

const SIZE_KEY = 'paperclip-terminal.panelsize.v1';

function loadSizes(): Record<string, { w: number; h: number }> {
  try { return JSON.parse(localStorage.getItem(SIZE_KEY) ?? '{}'); } catch { return {}; }
}

/** Bottom-right drag handle: persists per-panel width/height overrides. */
function useResize(area: string) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sizes = loadSizes();
    const saved = sizes[area];
    if (saved) { el.style.width = `${saved.w}px`; el.style.height = `${saved.h}px`; }
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.setAttribute('aria-hidden', 'true');
    el.appendChild(handle);
    let startX = 0, startY = 0, startW = 0, startH = 0;
    const down = (e: PointerEvent) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      startX = e.clientX; startY = e.clientY;
      startW = el.getBoundingClientRect().width; startH = el.getBoundingClientRect().height;
      el.classList.add('resizing');
    };
    const move = (e: PointerEvent) => {
      if (!el.classList.contains('resizing')) return;
      const w = Math.max(180, Math.min(900, startW + e.clientX - startX));
      const h = Math.max(120, Math.min(1200, startH + e.clientY - startY));
      el.style.width = `${w}px`; el.style.height = `${h}px`;
    };
    const up = (e: PointerEvent) => {
      if (!el.classList.contains('resizing')) return;
      handle.releasePointerCapture(e.pointerId);
      el.classList.remove('resizing');
      try {
        const rect = el.getBoundingClientRect();
        sizes[area] = { w: Math.round(rect.width), h: Math.round(rect.height) };
        localStorage.setItem(SIZE_KEY, JSON.stringify(sizes));
      } catch { /* storage disabled */ }
    };
    handle.addEventListener('pointerdown', down);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    return () => {
      handle.removeEventListener('pointerdown', down);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.remove();
    };
  }, [area]);
  return ref;
}

const HEADINGS: Partial<Record<SlotId, { en: string; zh: string }>> = {
  ledger: { en: 'Ledger', zh: '账目' },
  controls: { en: 'Controls', zh: '控制' },
  market: { en: 'Market', zh: '市场' },
  compute: { en: 'Cognition', zh: '认知' },
  energy: { en: 'Power', zh: '供电' },
  matter: { en: 'Matter', zh: '物质' },
  swarm: { en: 'Swarm', zh: '群体' },
  public: { en: 'Public', zh: '公众' },
  war: { en: 'War', zh: '战争' },
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
  const ref = useResize(area ?? slot);
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
    <section ref={ref} class={`panel slot-${area ?? slot}`} aria-label={t(heading)}>
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
