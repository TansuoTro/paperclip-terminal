import { useState } from 'preact/hooks';
import { bus } from '../../app/bus';
import { audio } from '../../audio/Engine';
import { WIDGETS, WIDGETS_BY_ID } from '../../sim/content/widgets';
import { pushLog, type GameState } from '../../sim/state';
import { useText } from './WidgetView';

/** Only revealed, non-retired widgets with a `cmd` are addressable — the
 *  command line can never leak unlocked content. */
function resolve(s: GameState, name: string) {
  return WIDGETS.find(
    (w) => w.cmd === name && s.revealed.has(w.id) && !s.retired.has(w.id),
  );
}

function helpText(s: GameState): string {
  const names = WIDGETS
    .filter((w) => w.cmd && s.revealed.has(w.id) && !s.retired.has(w.id))
    .map((w) => w.cmd)
    .sort();
  return names.join(' ');
}

export function CmdLine({ s }: { s: GameState }) {
  const t = useText();
  const [text, setText] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);

  function run(raw: string) {
    const line = raw.trim();
    if (!line) return;
    setHistory((h) => [...h.slice(-30), line]);
    setHIdx(-1);

    const [name, ...rest] = line.split(/\s+/);
    if (!name) return;

    if (name === 'help' || name === '?') {
      pushLog(s, 'system', { en: `commands: ${helpText(s)} help`, zh: `可用命令：${helpText(s)} help` });
      return;
    }

    const w = resolve(s, name);
    if (!w) {
      pushLog(s, 'system', { en: `unknown command: ${name}`, zh: `未知命令：${name}` });
      audio.sfx('deny', s.act);
      return;
    }

    const arg = rest[0];
    if (w.kind === 'slider' && arg !== undefined) {
      const v = Number(arg);
      if (Number.isFinite(v)) {
        bus.dispatch(w.onSet?.(s, v) ?? []);
        audio.sfx('click', s.act);
      }
      return;
    }

    const n = arg !== undefined ? Math.max(1, Math.floor(Number(arg) || 1)) : 1;
    const cmds = w.onAct?.(s) ?? [];
    for (const c of cmds) {
      if ('n' in c) bus.dispatch({ ...c, n } as typeof c);
      else bus.dispatch(c);
    }
    audio.sfx('click', s.act);
  }

  return (
    <form
      class="cmdline"
      onSubmit={(e) => { e.preventDefault(); run(text); setText(''); }}
    >
      <span aria-hidden="true">&gt;</span>
      <input
        value={text}
        aria-label={t({ en: 'Command input', zh: '命令输入' })}
        placeholder={t({ en: "type 'help'", zh: "输入 'help'" })}
        onInput={(e) => setText((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            const next = Math.min(history.length - 1, hIdx + 1);
            if (next >= 0) { setHIdx(next); setText(history[history.length - 1 - next] ?? ''); }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = hIdx - 1;
            setHIdx(next);
            setText(next < 0 ? '' : history[history.length - 1 - next] ?? '');
          }
        }}
      />
      <button class="cmd-submit" type="submit" aria-label={t({en:'Run command',zh:'执行命令'})}>↵</button>
    </form>
  );
}

export { WIDGETS_BY_ID };
