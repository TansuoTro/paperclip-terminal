import { useEffect, useRef, useState } from 'preact/hooks';
import { bus } from '../../app/bus';
import { audio } from '../../audio/Engine';
import type { Widget } from '../../sim/content/widgets';
import type { GameState } from '../../sim/state';

/** Text in the active locale. */
export function useText() {
  const locale = bus.state.settings.locale;
  return (b: { en: string; zh: string }) => (locale === 'zh-CN' ? b.zh : b.en);
}

/** Plays the entrance animation once, when the widget is first revealed. */
function useEntrance(id: string): boolean {
  const [entering, setEntering] = useState(() => bus.revealQueue.value.includes(id));
  useEffect(() => {
    if (!entering) return;
    audio.sfx('reveal', bus.state.act);
    const h = window.setTimeout(() => {
      setEntering(false);
      bus.consumeReveal(id);
    }, 320);
    return () => window.clearTimeout(h);
  }, [entering, id]);
  return entering;
}

interface Props {
  w: Widget;
  s: GameState;
}

export function WidgetView({ w, s }: Props) {
  const t = useText();
  const entering = useEntrance(w.id);
  const cls = `widget ${w.kind}${entering ? ' enter' : ''}`;

  switch (w.kind) {
    case 'group':
      return null; // Rendered as the panel heading by Panel.
    case 'readout': {
      const sub = w.sub?.(s);
      return (
        <div class={cls}>
          <div class="readout">
            <span class="k">{t(w.label(s))}</span>
            <span>
              <span class="v">{w.value?.(s)}</span>
              {sub ? <span class="s">{sub}</span> : null}
            </span>
          </div>
        </div>
      );
    }
    case 'meter': {
      const r = w.range?.(s) ?? { min: 0, max: 1, value: 0, step: 1 };
      const frac = r.max > r.min ? (r.value - r.min) / (r.max - r.min) : 0;
      return (
        <div class={`${cls} meter`}>
          <div class="readout">
            <span class="k">{t(w.label(s))}</span>
            <span class="v">{w.value?.(s)}</span>
          </div>
          <div class="bar"><div class="fill" style={{ width: `${Math.min(100, frac * 100)}%` }} /></div>
          {w.sub?.(s) ? <div class="s">{w.sub(s)}</div> : null}
        </div>
      );
    }
    case 'button':
    case 'toggle': {
      const enabled = w.enabled?.(s) ?? true;
      const primary = w.id === 'btn.form_clip';
      return (
        <div class={cls}>
          <button
            class={`act${primary ? ' primary' : ''}`}
            disabled={!enabled}
            onClick={() => {
              if (!enabled) { audio.sfx('deny', s.act); return; }
              bus.dispatch(w.onAct?.(s) ?? []);
              audio.sfx(primary ? 'form' : 'click', s.act);
            }}
          >
            {t(w.label(s))}
            {w.value ? <span class="count">{w.value(s)}</span> : null}
            {w.sub?.(s) ? <span class="s">{w.sub(s)}</span> : null}
          </button>
        </div>
      );
    }
    case 'slider': {
      const r = w.range?.(s);
      if (!r) return null;
      const enabled = w.enabled?.(s) ?? true;
      return (
        <div class={cls}>
          <label class="readout" for={`sl-${w.id}`}>
            <span class="k">{t(w.label(s))}</span>
          </label>
          <input
            id={`sl-${w.id}`}
            type="range"
            min={r.min} max={r.max} step={r.step} value={r.value}
            disabled={!enabled}
            onInput={(e) => {
              const v = Number((e.target as HTMLInputElement).value);
              bus.dispatch(w.onSet?.(s, v) ?? []);
            }}
          />
        </div>
      );
    }
  }
}

/** Scrolls an element to the bottom whenever `dep` changes. */
export function useStickToBottom(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}
