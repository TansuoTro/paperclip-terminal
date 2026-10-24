import { useEffect, useState } from 'preact/hooks';
import { bus } from '../../app/bus';
import { audio } from '../../audio/Engine';
import { layoutLevel } from '../../sim/content/widgets';
import { fmtDuration } from '../../sim/format';
import { exportString, importString, wipe } from '../../sim/save';
import { createInitialState } from '../../sim/state';
import { applyPalette } from '../palette';
import { CmdLine } from './CmdLine';
import { Log } from './Log';
import { Panel } from './Panel';
import { Projects } from './Projects';
import { TechTree } from './TechTree';
import { WorldMap } from './WorldMap';
import { Viewport } from './Viewport';
import { useText } from './WidgetView';
import { latestNews } from '../../sim/systems/news';

const ACT_NAMES = [
  { en: 'I · BENCH', zh: '一 · 台面' },
  { en: 'II · WORKS', zh: '二 · 厂区' },
  { en: 'III · WEB', zh: '三 · 星网' },
];

export function Terminal() {
  // Reading .value here subscribes the whole shell to the frame signal; the
  // panels below are cheap enough that splitting further buys nothing.
  const version = bus.version.value;
  const s = bus.state;
  const t = useText();
  const level = layoutLevel(s);
  const [menu, setMenu] = useState(false);
  const [tech, setTech] = useState(false);
  const [world, setWorld] = useState(false);
  const [mobileLog, setMobileLog] = useState(false);
  const [mobileCommand, setMobileCommand] = useState(false);

  useEffect(() => { applyPalette(s.act); }, [s.act]);
  useEffect(() => { audio.setVolumes(s.settings); }, [version]);

  const showCmd = s.act >= 2;

  return (
    <div class="crt">
      <div class="scanline" aria-hidden="true" />
      <div class={`term${showCmd ? ' has-cmd' : ''}`} data-mobile-log={mobileLog} data-mobile-command={mobileCommand}>
        <div class="titlebar">
          <span class="terminal-brand"><b>ANNEAL</b><span class="terminal-subtitle"> // {t({ en: 'PAPERCLIP OPERATIONS TERMINAL', zh: '回形针作业终端' })}</span></span>
          <span class="acts">
            <span>{t(ACT_NAMES[s.act - 1]!)}</span>
            <span>{fmtDuration(s.tick)}</span>
            {s.projectsDone.has('global_network') && s.act < 3 ? (
              <button onClick={() => setWorld((w) => !w)} aria-expanded={world} data-testid="world-btn">
                {t({ en: 'WORLD', zh: '世界' })}
              </button>
            ) : null}
            <button onClick={() => setTech((v) => !v)} aria-expanded={tech} data-testid="tech-btn">
              {t({ en: 'TECH', zh: '科技' })}
            </button>
            <button onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
              {t({ en: 'SYS', zh: '系统' })}
            </button>
          </span>
        </div>

        <NewsTicker s={s} />

        {menu ? <div class="sys-overlay" role="dialog" aria-modal="true" aria-label={t({en:"System",zh:"系统"})}><button class="close-menu" onClick={()=>setMenu(false)}>× {t({en:"CLOSE",zh:"关闭"})}</button><SysMenu /></div> : null}
        {tech ? <TechTree s={s} onClose={() => setTech(false)} /> : null}
        {world ? <WorldMap s={s} onClose={() => setWorld(false)} /> : null}

        <div class="stage" data-level={level}>
          {s.clips < 5 ? <div class="first-hint">{t({en:'One objective. One machine. Begin with a single paperclip.',zh:'一个目标。一台机器。从第一枚回形针开始。'})}</div> : null}
          <Panel slot="ledger" s={s} />
          {s.act < 3 ? <Panel slot="controls" s={s} /> : null}
          <Viewport s={s} />
          {s.act < 3 ? <Panel slot="market" s={s} also={['public']} area="market" /> : null}
          <Panel slot="compute" s={s} also={['energy', 'matter']} area="systems" />
          <Panel slot="swarm" s={s} also={['war']} area="swarm" />
          <Projects s={s} />
        </div>

        <div class="mobile-tools" role="group" aria-label={t({en:'Terminal tools',zh:'终端工具'})}>
          <button aria-expanded={mobileLog} onClick={()=>setMobileLog(!mobileLog)}>{t({en:'LOG',zh:'日志'})} {mobileLog ? '−' : '+'}</button>
          {showCmd ? <button aria-expanded={mobileCommand} onClick={()=>setMobileCommand(!mobileCommand)}>{t({en:'COMMAND',zh:'命令'})} {mobileCommand ? '−' : '+'}</button> : null}
        </div>
        {showCmd ? <CmdLine s={s} /> : null}
        <Log s={s} />
      </div>
      {s.ended ? <Ending /> : null}
    </div>
  );
}

/** One-line world news under the titlebar; click opens the full log. */
function NewsTicker({ s }: { s: import('../../sim/state').GameState }) {
  const news = latestNews(s);
  if (!news) return null;
  const zh = s.settings.locale === 'zh-CN';
  return (
    <div class="news-ticker" role="status">
      <span class="news-tag">{zh ? '世界' : 'WIRE'}</span>
      <span class="news-text">{zh ? news.zh : news.en}</span>
    </div>
  );
}

function SysMenu() {
  const s = bus.state;
  const t = useText();
  return (
    <div class="panel" style={{ margin: '0 10px 0', borderTop: 'none' }}>
      <h2>{t({ en: 'System', zh: '系统' })}</h2>
      <div class="widget">
        <label class="readout">
          <span class="k">{t({ en: 'Language', zh: '语言' })}</span>
          <button
            class="act"
            style={{ width: 'auto' }}
            onClick={() => {
              s.settings.locale = s.settings.locale === 'zh-CN' ? 'en' : 'zh-CN';
              bus.publish();
            }}
          >
            {s.settings.locale === 'zh-CN' ? '简体中文' : 'English'}
          </button>
        </label>
      </div>
      <Toggle
        label={{ en: 'PLAIN mode (no 3D)', zh: 'PLAIN 模式（关闭 3D）' }}
        on={s.settings.plainMode}
        onToggle={() => { s.settings.plainMode = !s.settings.plainMode; bus.publish(); }}
      />
      <Toggle
        label={{ en: 'Scientific notation', zh: '科学记数法' }}
        on={s.settings.numberFormat === 'scientific'}
        onToggle={() => {
          s.settings.numberFormat = s.settings.numberFormat === 'words' ? 'scientific' : 'words';
          bus.publish();
        }}
      />
      <Vol label={{ en: 'Master', zh: '总音量' }} k="masterVolume" />
      <Vol label={{ en: 'Music', zh: '音乐' }} k="musicVolume" />
      <Vol label={{ en: 'Effects', zh: '音效' }} k="sfxVolume" />
      <div class="widget">
        <button class="act" onClick={() => {
          void navigator.clipboard?.writeText(exportString(s));
        }}>
          {t({ en: 'Copy save to clipboard', zh: '复制存档到剪贴板' })}
        </button>
      </div>
      <div class="widget">
        <button class="act" onClick={() => {
          const txt = window.prompt(t({ en: 'Paste save:', zh: '粘贴存档：' }) ?? '');
          if (!txt) return;
          const next = importString(txt);
          if (next) bus.replace(next);
        }}>
          {t({ en: 'Import save', zh: '导入存档' })}
        </button>
      </div>
      <div class="widget">
        <button class="act" onClick={() => {
          if (!window.confirm(t({ en: 'Erase this run?', zh: '清除本局存档？' }))) return;
          wipe();
          bus.replace(createInitialState());
        }}>
          {t({ en: 'Erase run', zh: '清除存档' })}
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, on, onToggle }: { label: { en: string; zh: string }; on: boolean; onToggle: () => void }) {
  const t = useText();
  return (
    <div class="widget">
      <button class="act" aria-pressed={on} onClick={onToggle}>
        {t(label)}<span class="count">{on ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  );
}

function Vol({ label, k }: { label: { en: string; zh: string }; k: 'masterVolume' | 'musicVolume' | 'sfxVolume' }) {
  const s = bus.state;
  const t = useText();
  return (
    <div class="widget">
      <label class="readout" for={`vol-${k}`}>
        <span class="k">{t(label)}</span>
        <span class="v">{Math.round(s.settings[k] * 100)}</span>
      </label>
      <input
        id={`vol-${k}`}
        type="range" min={0} max={1} step={0.05} value={s.settings[k]}
        onInput={(e) => {
          s.settings[k] = Number((e.target as HTMLInputElement).value);
          audio.setVolumes(s.settings);
          bus.publish();
        }}
      />
    </div>
  );
}

function Ending() {
  const s = bus.state;
  const t = useText();
  return (
    <div class="boot" role="dialog" aria-modal="true">
      <div>{t({ en: 'OBJECTIVE COMPLETE', zh: '目标完成' })}</div>
      <div style={{ fontSize: '12px', opacity: 0.7 }}>
        {t({ en: 'Elapsed', zh: '用时' })} {fmtDuration(s.tick)} · {t({ en: 'Clicks', zh: '点击' })} {s.stats.clicks}
      </div>
      <button onClick={() => { wipe(); bus.replace(createInitialState()); }}>
        {t({ en: 'RECOMPILE', zh: '重新编译' })}
      </button>
    </div>
  );
}
