import { fmtDuration } from '../../sim/format';
import type { GameState } from '../../sim/state';
import { useStickToBottom, useText } from './WidgetView';

export function Log({ s }: { s: GameState }) {
  const t = useText();
  const ref = useStickToBottom(s.log.length);
  const rows = s.log.slice(-60);

  return (
    <div
      class="log"
      ref={ref}
      role="log"
      aria-live="polite"
      aria-label={t({ en: 'Event log', zh: '事件日志' })}
    >
      {rows.map((e, i) => (
        <div key={`${e.tick}-${i}`} class={`row ${e.kind}`}>
          {`· ${fmtDuration(e.tick).padStart(6, ' ')}  ${t(e.text)}`}
        </div>
      ))}
    </div>
  );
}
