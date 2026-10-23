import { fmt, fmtPercent } from '../../sim/format';
import { demandPerSecond } from '../../sim/systems/market';
import { effectiveRate, theoreticalRate } from '../../sim/systems/production';
import { powerFactor } from '../../sim/systems/energy';
import { planetDepletion } from '../../sim/systems/planet';
import type { GameState } from '../../sim/state';
import { currentPalette, type Palette } from '../palette';

/** Rolling history for the charts. Lives in the view, not the save. */
export class History {
  private buf: number[][] = [[], [], []];
  private cap = 180;
  push(a: number, b: number, c: number): void {
    const vals = [a, b, c];
    for (let i = 0; i < 3; i++) {
      const arr = this.buf[i]!;
      arr.push(vals[i]!);
      if (arr.length > this.cap) arr.shift();
    }
  }
  series(i: number): number[] { return this.buf[i] ?? []; }
}

export interface SchematicCtx {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  p: Palette;
  s: GameState;
  hist: History;
}

function box(c: SchematicCtx, x: number, y: number, w: number, h: number, label: string, value: string, warn = false) {
  const { ctx, p } = c;
  ctx.strokeStyle = warn ? p.warn : p.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
  ctx.fillStyle = p.dim;
  ctx.font = '10px ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + 5, y + 4);
  ctx.fillStyle = warn ? p.warn : p.hi;
  ctx.font = '12px ui-monospace, monospace';
  ctx.fillText(value, x + 5, y + 17);
}

/** Flow arrow whose thickness encodes magnitude. */
function arrow(c: SchematicCtx, x1: number, y: number, x2: number, magnitude: number, label?: string) {
  const { ctx, p } = c;
  const thick = Math.max(1, Math.min(5, Math.log10(1 + Math.max(0, magnitude)) * 1.3));
  ctx.strokeStyle = magnitude > 0 ? p.glow : p.line;
  ctx.lineWidth = thick;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2 - 6, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y);
  ctx.lineTo(x2 - 7, y - 4);
  ctx.lineTo(x2 - 7, y + 4);
  ctx.closePath();
  ctx.fillStyle = magnitude > 0 ? p.glow : p.line;
  ctx.fill();
  if (label) {
    ctx.fillStyle = p.dim;
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, (x1 + x2) / 2, y - 12);
    ctx.textAlign = 'left';
  }
}

export const CHART_COLORS = ['#3987e5', '#d95926', '#199e70'];

function trends(c:SchematicCtx,x:number,y:number,w:number,h:number,labels:string[]):void {
  const {ctx,p,hist}=c;
  const rowH=h/labels.length;
  for(let series=0;series<labels.length;series++){
    const data=hist.series(series);if(!data.length)continue;
    const top=y+series*rowH;
    const max=Math.max(...data,1),plotW=Math.max(10,w-92);
    ctx.fillStyle=p.fg;ctx.font='9px ui-monospace, monospace';
    ctx.fillText(`${labels[series]} ${fmt(data[data.length-1]??0,c.s.settings)}`,x,top+2);
    ctx.strokeStyle=p.line;ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,top+rowH-2);ctx.lineTo(x+plotW,top+rowH-2);ctx.stroke();
    ctx.strokeStyle=CHART_COLORS[series]!;ctx.lineWidth=2;
    ctx.setLineDash(series===1?[4,3]:series===2?[1,3]:[]);ctx.beginPath();
    for(let i=0;i<data.length;i++){
      const px=x+(i/Math.max(1,data.length-1))*plotW;
      const py=top+rowH-4-(data[i]!/max)*Math.max(4,rowH-16);
      if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }
    ctx.stroke();ctx.setLineDash([]);
  }
}

function act1(c: SchematicCtx) {
  const { s, w, h, ctx, p } = c;
  const bw = Math.min(118, (w - 40 - 30*3) / 4);
  const bh = 38;
  const y = h * 0.28;
  const xs = [20, 20 + bw + 30, 20 + (bw + 30) * 2, 20 + (bw + 30) * 3];

  box(c, xs[0]!, y, bw, bh, 'WIRE 钢丝', `${fmt(s.wire, s.settings)}cm`, s.wire < s.wirePerClip * 10);
  box(c, xs[1]!, y, bw, bh, 'FORM 成型', `${effectiveRate(s).toFixed(1)}/s`);
  const backlogged = s.unsoldClips > Math.max(50, demandPerSecond(s) * 30);
  box(c, xs[2]!, y, bw, bh, 'STOCK 库存', fmt(s.unsoldClips, s.settings), backlogged);
  box(c, xs[3]!, y, bw, bh, 'SOLD 售出', fmt(s.clips - s.unsoldClips, s.settings));

  arrow(c, xs[0]! + bw, y + bh / 2, xs[1]!, effectiveRate(s));
  arrow(c, xs[1]! + bw, y + bh / 2, xs[2]!, effectiveRate(s));
  arrow(c, xs[2]! + bw, y + bh / 2, xs[3]!, Math.min(demandPerSecond(s), s.unsoldClips));

  if (theoreticalRate(s) > effectiveRate(s) + 0.01) {
    ctx.fillStyle = p.warn;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText('⚠ WIRE STARVED 缺料', xs[0]!, y + bh + 8);
  }

  const cy = y + bh + 34;
  ctx.fillStyle = p.dim;
  ctx.font = '9px ui-monospace, monospace';
  trends(c,20,cy,w-40,Math.max(90,h-cy-18),['demand/s','price ¤','inventory']);
}

function act2(c: SchematicCtx) {
  const { s, w, h, ctx, p } = c;
  const bw = Math.min(110, (w - 100) / 3);
  const bh = 36;
  const row1 = h * 0.14;
  const row2 = h * 0.42;

  box(c, 20, row1, bw, bh, 'PLANET 行星', fmtPercent(1 - planetDepletion(s)));
  box(c, 20 + bw + 30, row1, bw, bh, 'WIRE 钢丝', `${fmt(s.wire, s.settings)}cm`);
  box(c, 20 + (bw + 30) * 2, row1, bw, bh, 'CLIPS 回形针', fmt(s.clips, s.settings));
  arrow(c, 20 + bw, row1 + bh / 2, 20 + bw + 30, s.harvesters * 1e5, 'harvest');
  arrow(c, 20 + bw * 2 + 30, row1 + bh / 2, 20 + (bw + 30) * 2, effectiveRate(s), 'form');

  const pf = powerFactor(s);
  box(c, 20, row2, bw, bh, 'POWER 供电', fmtPercent(pf), pf < 0.95);
  box(c, 20 + bw + 30, row2, bw, bh, 'OPS 运算', `${fmt(s.ops, s.settings)}`);
  box(c, 20 + (bw + 30) * 2, row2, bw, bh, 'TRUST 信任', `${s.trust - s.trustSpent}`);

  // Planet depletion bar
  const by = row2 + bh + 28;
  ctx.fillStyle = p.dim;
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillText('PLANETARY DRAWDOWN 行星抽取', 20, by - 11);
  ctx.strokeStyle = p.line;
  ctx.strokeRect(20.5, by + 0.5, w - 41, 12);
  ctx.fillStyle = p.warn;
  ctx.fillRect(21, by + 1, (w - 42) * planetDepletion(s), 11);

  const cy = by + 28;
  if (h - cy > 30) {
    ctx.fillStyle = p.dim;
    trends(c,20,cy,w-40,Math.max(60,h-cy-16),['ops','power %','rate/s']);
  }
}

function act3(c: SchematicCtx) {
  const { s, w, h, ctx, p } = c;
  const cx = w / 2;
  const cy = h * 0.42;
  const r = Math.min(w, h) * 0.3;

  // Mass acquisition ring.
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  const frac = s.massBudget / s.massBudgetTotal;
  ctx.strokeStyle = p.glow;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = p.hi;
  ctx.font = '16px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(fmtPercent(frac, 4), cx, cy - 8);
  ctx.fillStyle = p.dim;
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillText('MASS ACQUIRED 已占据质量', cx, cy + 12);
  ctx.textAlign = 'left';

  box(c, 20, h - 56, 120, 38, 'PROBES 探测器', fmt(s.probes, s.settings));
  box(c, w - 140, h - 56, 120, 38, 'DRIFTERS 漂移者', fmt(s.drifters, s.settings), s.drifters > s.probes);

  const lastBattle = s.lastBattle;
  if (lastBattle) {
    ctx.fillStyle = lastBattle.won ? p.glow : p.warn;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      lastBattle.won ? '◂ ENGAGEMENT WON 交战胜利 ▸' : '◂ ENGAGEMENT LOST 交战失利 ▸',
      cx, h - 40,
    );
    ctx.textAlign = 'left';
  }
}

function compactSchematic(c: SchematicCtx): void {
  const {ctx, s, w, h, p} = c;
  const zh = s.settings.locale === 'zh-CN';
  const gap = 12, pad = 12;
  const bw = (w - pad * 2 - gap) / 2;
  const bh = 48;
  const y = 28;
  const label = (en: string, cn: string) => zh ? cn : en;
  const nodes: [string, string][] = s.act === 1 ? [
    [label('WIRE / cm', '钢丝 / cm'), fmt(s.wire, s.settings)],
    [label('FORM / sec', '成型 / 秒'), fmt(effectiveRate(s), s.settings)],
    [label('INVENTORY', '库存'), fmt(s.unsoldClips, s.settings)],
    [label('DEMAND / sec', '需求 / 秒'), fmt(demandPerSecond(s), s.settings)],
  ] : s.act === 2 ? [
    [label('PLANET REMAINS', '行星剩余'), fmtPercent(1 - planetDepletion(s))],
    [label('POWER AVAILABLE', '可用供电'), fmtPercent(powerFactor(s))],
    [label('WIRE / cm', '钢丝 / cm'), fmt(s.wire, s.settings)],
    [label('OPS', '运算'), fmt(s.ops, s.settings)],
  ] : [
    [label('PROBES', '探测器'), fmt(s.probes, s.settings)],
    [label('DRIFTERS', '漂移者'), fmt(s.drifters, s.settings)],
    [label('MASS ACQUIRED', '质量占据'), fmtPercent(s.massBudget / s.massBudgetTotal, 3)],
    [label('ENGAGEMENTS W / L', '交战 胜 / 负'), `${s.battlesWon} / ${s.battlesLost}`],
  ];
  nodes.forEach(([title, value], i) => {
    const x = pad + (i % 2) * (bw + gap);
    const top = y + Math.floor(i / 2) * (bh + 10);
    ctx.strokeStyle = p.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + .5, top + .5, bw, bh);
    ctx.fillStyle = p.dim;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText(title, x + 7, top + 6, bw - 14);
    ctx.fillStyle = p.hi;
    ctx.font = '13px ui-monospace, monospace';
    ctx.fillText(value, x + 7, top + 24, bw - 14);
  });
  const bottom = y + bh * 2 + 18;
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillStyle = p.fg;
  if (h >= bottom + 22) {
    const summary = s.act === 1
      ? label('Wire → Form → Inventory → Market', '钢丝 → 成型 → 库存 → 市场')
      : s.act === 2
        ? label('Harvest → Draw wire → Form clips', '采集 → 拉丝 → 成型')
        : label('Replicate → Explore → Acquire', '复制 → 探索 → 占据');
    ctx.fillText(summary, pad, bottom, w - pad * 2);
  }
}

export function drawSchematic(
  ctx: CanvasRenderingContext2D, w: number, h: number, s: GameState, hist: History,
): void {
  const p = currentPalette(s.act);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  const c: SchematicCtx = { ctx, w, h, p, s, hist };

  ctx.fillStyle = p.dim;
  ctx.font = '9px ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(`SCHEMATIC · ACT ${s.act}`, 8, 6);

  if (w < 520 || h < 240) compactSchematic(c);
  else if (s.act === 1) act1(c);
  else if (s.act === 2) act2(c);
  else act3(c);
}

/** Per-frame history sampling, called from the viewport. */
export function sampleHistory(hist: History, s: GameState): void {
  if (s.act === 1) hist.push(demandPerSecond(s), s.clipPrice, s.unsoldClips);
  else if (s.act === 2) hist.push(s.ops, powerFactor(s) * 100, effectiveRate(s));
  else hist.push(s.probes, s.drifters, s.massBudget / s.massBudgetTotal * 1000);
}
