import { useEffect, useRef, useState } from 'preact/hooks';
import { bus } from '../../app/bus';
import type { GameState } from '../../sim/state';
import type { Renderer } from '../../view3d/Renderer';
import { drawSchematic, History, sampleHistory } from '../scenes/schematic';
import { useText } from './WidgetView';

export function Viewport({ s }: { s: GameState }) {
  const t=useText();
  const wrap=useRef<HTMLDivElement>(null);
  const canvas2d=useRef<HTMLCanvasElement>(null);
  const canvas3d=useRef<HTMLCanvasElement>(null);
  const renderer=useRef<Renderer|null>(null);
  const [has3d,setHas3d]=useState(false);
  const [failed,setFailed]=useState(false);
  const [table,setTable]=useState(false);
  const [hover,setHover]=useState<{x:number;y:number}|null>(null);
  const visible=s.clips>=5;
  const mode=s.settings.plainMode||failed?'schematic':s.settings.viewMode;

  useEffect(()=>{
    if(!visible)return;
    let alive=true;
    const hist=new History();
    let last=performance.now(),lastSample=-1,raf=0;
    const el=wrap.current!,c2=canvas2d.current!;
    const ctx=c2.getContext('2d')!;
    let width=1,height=1,dpr=1;
    const resize=()=>{
      const rect=el.getBoundingClientRect();
      width=Math.max(1,Math.floor(rect.width));height=Math.max(1,Math.floor(rect.height));
      dpr=Math.min(devicePixelRatio,2);c2.width=width*dpr;c2.height=height*dpr;
      renderer.current?.resize(width,height);
    };
    const ro=new ResizeObserver(resize);ro.observe(el);resize();
    const frame=(now:number)=>{
      if(!alive)return;
      const state=bus.state,dt=Math.min(.1,(now-last)/1000);last=now;
      if(state.tick>=lastSample+5){sampleHistory(hist,state);lastSample=state.tick;}
      if(state.settings.plainMode||state.settings.viewMode==='schematic'||!renderer.current){
        ctx.setTransform(dpr,0,0,dpr,0,0);drawSchematic(ctx,width,height,state,hist);
      }else renderer.current.render(state,dt);
      raf=requestAnimationFrame(frame);
    };
    raf=requestAnimationFrame(frame);
    return()=>{alive=false;cancelAnimationFrame(raf);ro.disconnect();renderer.current?.dispose();renderer.current=null;};
  },[visible]);

  useEffect(()=>{
    if(!visible||s.settings.plainMode||s.settings.viewMode!=='optical'||renderer.current||failed)return;
    let cancelled=false;
    void import('../../view3d/Renderer').then(({Renderer})=>{
      if(cancelled||!canvas3d.current)return;
      const r=new Renderer();
      if(!r.init(canvas3d.current)){setFailed(true);return;}
      renderer.current=r;
      const rect=wrap.current!.getBoundingClientRect();r.resize(rect.width,rect.height);
      setHas3d(true);
    }).catch(()=>setFailed(true));
    return()=>{cancelled=true;};
  },[visible,s.settings.plainMode,s.settings.viewMode,failed]);

  if(!visible)return null;
  return <section class="viewport slot-viewport" aria-label={t({en:'Viewport',zh:'视口'})}>
    <div ref={wrap} class="canvas-wrap" onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect();setHover({x:e.clientX-r.left,y:e.clientY-r.top});}} onPointerLeave={()=>setHover(null)}>
      <canvas ref={canvas3d} style={{display:mode==='optical'&&has3d?'block':'none'}} aria-hidden="true" />
      <canvas ref={canvas2d} style={{display:mode==='schematic'||!has3d?'block':'none'}} aria-hidden="true" />
      {mode==='optical'&&!has3d?<span class="loading-3d">LOADING OPTICAL…</span>:null}
      {hover && mode==='schematic' ? <div class="chart-hover" style={{left:Math.min(hover.x,Math.max(0,(wrap.current?.clientWidth??0)-190)),top:Math.min(hover.y+12,Math.max(0,(wrap.current?.clientHeight??0)-74))}}>
        <span>{t({en:'CURRENT TELEMETRY',zh:'当前遥测'})}</span><br/>
        {t({en:'Clips',zh:'回形针'})}: {s.clips.toExponential(3)}<br/>
        {t({en:'Ops',zh:'运算'})}: {Math.floor(s.ops)}
      </div>:null}
      {table ? <div class="telemetry-table"><table class="chart-table"><caption>{t({en:'Live telemetry · text alternative',zh:'实时遥测 · 文本替代'})}</caption><tbody>
        <tr><th>{t({en:'Clips',zh:'回形针'})}</th><td>{s.clips.toExponential(4)}</td></tr>
        <tr><th>{t({en:'Wire/cm',zh:'钢丝/cm'})}</th><td>{s.wire.toExponential(4)}</td></tr>
        <tr><th>Ops</th><td>{Math.floor(s.ops)}</td></tr>
        <tr><th>{t({en:'Probes',zh:'探测器'})}</th><td>{s.probes.toExponential(4)}</td></tr>
        <tr><th>{t({en:'Mass/kg',zh:'质量/kg'})}</th><td>{s.massBudget.toExponential(4)}</td></tr>
      </tbody></table></div>:null}
    </div>
    <div class="vp-tabs" role="group" aria-label={t({en:'Viewport mode',zh:'视口模式'})}>
      <button aria-pressed={mode==='optical'} disabled={failed||s.settings.plainMode} onClick={()=>{s.settings.viewMode='optical';bus.publish();}}>{t({en:'OPTICAL · 3D',zh:'光学 · 3D'})}</button>
      <button aria-pressed={mode==='schematic'} onClick={()=>{s.settings.viewMode='schematic';bus.publish();}}>{t({en:'SCHEMATIC · 2D',zh:'示意图 · 2D'})}</button>
      <button aria-pressed={table} onClick={()=>setTable(!table)}>{t({en:'DATA',zh:'数据'})}</button>
    </div>
    {failed?<p class="hint">{t({en:'WebGL unavailable. Simulation continues in 2D.',zh:'WebGL 不可用，模拟继续以 2D 运行。'})}</p>:null}
  </section>;
}
