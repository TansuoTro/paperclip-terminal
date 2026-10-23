import { render } from 'preact';
import { initBus } from './app/bus';
import { createLoop } from './app/loop';
import { audio } from './audio/Engine';
import { catchUp } from './sim/tick';
import { load, save } from './sim/save';
import { pushLog } from './sim/state';
import { Terminal } from './view2d/console/Terminal';
import { applyPalette } from './view2d/palette';

const root = document.getElementById('app')!;

const { state, awayMs, fresh } = load(Date.now());
if (!fresh && awayMs > 1000) catchUp(state, awayMs);
if (fresh) {
  pushLog(state, 'system', {
    en: 'system online. objective loaded: maximize paperclips.',
    zh: '系统上线。已载入目标：最大化回形针产量。',
  });
}

const bus = initBus(state);
applyPalette(state.act);

const loop = createLoop(bus, () => {
  audio.update(bus.state);
});

/**
 * Audio needs a user gesture. The boot screen doubles as that gesture and as
 * the one place the game explains itself before the UI is empty on purpose.
 */
function boot() {
  const el = document.createElement('div');
  el.className = 'boot';
  el.innerHTML = `
    <div style="letter-spacing:.2em">ANNEAL</div>
    <div style="font-size:12px;opacity:.65;max-width:34ch;line-height:1.7">
      回形针作业终端<br/>PAPERCLIP OPERATIONS TERMINAL
    </div>
    <button type="button" id="boot-go">INITIALIZE / 初始化</button>
    <div style="font-size:11px;opacity:.65;max-width:38ch;line-height:1.8">从手工制造开始，出售库存、购买自动机。<br/>新系统会随着生产逐步出现。<br/>原创合成音乐 · 可在系统菜单关闭</div>
  `;
  root.appendChild(el);
  const go = el.querySelector<HTMLButtonElement>('#boot-go')!;
  go.focus();
  go.addEventListener('click', () => {
    try { audio.unlock(bus.state.settings); } catch (e) { console.warn('[audio] unavailable', e); }
    el.remove();
    render(<Terminal />, root);
    loop.start();
  }, { once: true });
}

boot();

// Pause audio while hidden; the sim keeps its own clock via save/catchUp.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { audio.suspend(); save(bus.state, Date.now()); }
  else audio.resume();
});

window.addEventListener('beforeunload', () => save(bus.state, Date.now()));
