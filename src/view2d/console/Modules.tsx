import { bus } from '../../app/bus';
import { audio } from '../../audio/Engine';
import { fmt } from '../../sim/format';
import { specPointsUsed, type GameState, type ProbeSpec } from '../../sim/state';
import { TOURNAMENT_COST, PAYOFF } from '../../sim/systems/tournament';
import { opsCeiling } from '../../sim/systems/compute';
import { useText } from './WidgetView';

const SPECS: [keyof ProbeSpec, string, string, string][] = [
  ['speed', 'Transit', '航行', '与探索共同决定发现质量的速度'],
  ['exploration', 'Survey', '探索', '任一项为零，就无法发现新物质'],
  ['selfReplication', 'Replication', '复制', '指数增长，需要工厂和拉丝支撑'],
  ['hazard', 'Shielding', '防护', '降低环境损耗'],
  ['factory', 'Foundry', '工厂', '与拉丝共同支撑复制效率'],
  ['harvester', 'Harvest', '采集', '将发现的物质转化为回形针'],
  ['wire', 'Filament', '拉丝', '供应新探测器，支撑复制'],
  ['combat', 'Defense', '战斗', '交战强度，不能代替环境防护'],
];

export function ComputeAllocation({ s }: { s: GameState }) {
  const t = useText();
  const total = s.memory + s.processors;
  return <div class="module-block">
    <label for="compute-allocation">{t({en:'REBALANCE HARDWARE',zh:'重分配硬件'})}</label>
    <input id="compute-allocation" type="range" min={1} max={total - 1} step={1} value={s.processors}
      onInput={e => bus.dispatch({ type:'reallocateCompute', processors:Number(e.currentTarget.value) })} />
    <p class="hint">CPU {s.processors} / RAM {s.memory} · {t({en:'Capacity',zh:'上限'})} {fmt(opsCeiling(s), s.settings)}</p>
    <p class="hint">{t({en:'Full ops storage produces insight. Rebalance freely; shrinking RAM discards overflow.',zh:'运算满载才产生洞察。可免费重分配；缩减内存会丢弃溢出运算。'})}</p>
  </div>;
}

export function ProbeDesigner({ s }: { s: GameState }) {
  const t = useText();
  const free = s.probeSpecPoints - specPointsUsed(s);
  return <div class="module-block" data-testid="probe-designer">
    <h2>{t({en:'REPLICATOR SPECIFICATION',zh:'复制体规格'})} <span>{free}/{s.probeSpecPoints}</span></h2>
    <p class="hint">{t({en:'Live fleet-wide firmware. Every field affects the simulation.',zh:'全舰队实时固件。每项属性均参与模拟。'})}</p>
    {SPECS.map(([key,en,zh,hint]) => <div class="spec-row" key={key}>
      <label for={`spec-${key}`} title={s.settings.locale === 'zh-CN' ? hint : en}>{t({en,zh})}</label>
      <button aria-label={`${t({en,zh})} -1`} disabled={s.probeSpec[key] <= 0} onClick={() => bus.dispatch({type:'setProbeSpec',key,delta:-1})}>−</button>
      <output id={`spec-${key}`}>{s.probeSpec[key]}</output>
      <button aria-label={`${t({en,zh})} +1`} disabled={free <= 0} onClick={() => bus.dispatch({type:'setProbeSpec',key,delta:1})}>+</button>
    </div>)}
    <button class="act" onClick={() => bus.dispatch({type:'launchProbe'})} disabled={s.wire < 1e11}>
      {t({en:'LAUNCH SEED · 100B cm',zh:'发射种子 · 1000 亿 cm'})}
    </button>
    {s.probeSpec.speed === 0 || s.probeSpec.exploration === 0 || s.probeSpec.harvester === 0 ?
      <p class="warning">⚠ {t({en:'Transit, survey and harvest must all be positive to acquire matter.',zh:'航行、探索和采集必须均大于零才能占据物质。'})}</p> : null}
  </div>;
}

export function Tournament({ s }: { s: GameState }) {
  const t = useText();
  const choices = [{en:'BURST',zh:'突发'},{en:'STEADY',zh:'稳态'},{en:'RESERVE',zh:'储备'}];
  const ready = s.ops >= TOURNAMENT_COST && s.tick >= s.tournament.nextTick;
  return <div class="module-block" data-testid="tournament">
    <h2>{t({en:'SCHEDULER TRIAL',zh:'调度试验'})} · {TOURNAMENT_COST} OPS</h2>
    <p class="hint">{t({en:'Burst beats steady; steady beats reserve; reserve beats burst. Opponent repeats its previous choice 60% of the time.',zh:'突发胜稳态，稳态胜储备，储备胜突发。对手有 60% 概率重复上次策略。'})}</p>
    <table class="payoff"><caption>{t({en:'Payoff matrix · row = you',zh:'收益矩阵 · 行为我方'})}</caption>
      <thead><tr><th>↓ / →</th>{choices.map(c=><th>{t(c)}</th>)}</tr></thead>
      <tbody>{PAYOFF.map((row,i)=><tr><th>{t(choices[i]!)}</th>{row.map(n=><td>{n}</td>)}</tr>)}</tbody>
    </table>
    <div class="choice-row">{choices.map((c,i)=><button class="act" disabled={!ready} onClick={()=>{bus.dispatch({type:'tournament',choice:i});audio.sfx('click',s.act);}}>{t(c)}</button>)}</div>
    <p class="hint">{t({en:'Previous opponent',zh:'上次对手'})}: {t(choices[s.tournament.lastOpponent]!)} · +{s.tournament.lastReward} {t({en:'insight',zh:'洞察'})}</p>
  </div>;
}
