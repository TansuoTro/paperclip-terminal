import type { Settings } from './state';

const WORDS_EN = [
  '', ' thousand', ' million', ' billion', ' trillion', ' quadrillion',
  ' quintillion', ' sextillion', ' septillion', ' octillion', ' nonillion',
  ' decillion',
];

const WORDS_ZH = ['', '千', '百万', '十亿', '万亿', '千万亿', '百万万亿'];

const SUPERS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

function superscript(n: number): string {
  const s = String(n);
  let out = '';
  for (const ch of s) {
    if (ch === '-') out += '⁻';
    else out += SUPERS[Number(ch)] ?? ch;
  }
  return out;
}

/** 1.204 × 10²³ */
export function scientific(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '∞';
  if (n === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(n)));
  const mant = n / Math.pow(10, exp);
  return `${mant.toFixed(digits)} × 10${superscript(exp)}`;
}

function grouped(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

/**
 * Human-readable magnitude. Below 1e6 we show thousands separators so early
 * numbers stay exact; above that we switch to words or scientific notation.
 */
export function fmt(n: number, settings?: Pick<Settings, 'numberFormat' | 'locale'>): string {
  if (!Number.isFinite(n)) return '∞';
  const neg = n < 0;
  const a = Math.abs(n);
  const body = fmtAbs(a, settings);
  return neg ? `-${body}` : body;
}

function fmtAbs(a: number, settings?: Pick<Settings, 'numberFormat' | 'locale'>): string {
  const mode = settings?.numberFormat ?? 'words';
  const zh = (settings?.locale ?? 'en') === 'zh-CN';

  if (a < 1000) {
    return a < 10 && !Number.isInteger(a) ? a.toFixed(2) : grouped(a);
  }
  if (a < 1e6) return grouped(a);
  if (mode === 'scientific' || a >= 1e36) return scientific(a);

  const tier = Math.floor(Math.log10(a) / 3);
  const scaled = a / Math.pow(1000, tier);
  if (zh) {
    const w = WORDS_ZH[tier];
    if (w === undefined) return scientific(a);
    return `${scaled.toFixed(2)}${w}`;
  }
  const w = WORDS_EN[tier];
  if (w === undefined) return scientific(a);
  return `${scaled.toFixed(2)}${w}`;
}

/** Currency with two decimals, abbreviated once large. */
export function fmtMoney(n: number, settings?: Pick<Settings, 'numberFormat' | 'locale'>): string {
  if (Math.abs(n) < 1e6) return `¤${n.toFixed(2)}`;
  return `¤${fmt(n, settings)}`;
}

/** Rate shown per second with adaptive precision. */
export function fmtRate(n: number, settings?: Pick<Settings, 'numberFormat' | 'locale'>): string {
  if (n === 0) return '0';
  if (Math.abs(n) < 10) return n.toFixed(2);
  return fmt(n, settings);
}

export function fmtPercent(frac: number, digits = 1): string {
  return `${(frac * 100).toFixed(digits)}%`;
}

/** Elapsed ticks -> h:mm:ss. */
export function fmtDuration(ticks: number): string {
  const total = Math.floor(ticks / 10);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Mass in kg, switching to solar masses once past Act 3. */
export function fmtMass(kg: number, settings?: Pick<Settings, 'numberFormat' | 'locale'>): string {
  const SOLAR = 1.989e30;
  if (kg >= SOLAR) {
    const zh = (settings?.locale ?? 'en') === 'zh-CN';
    return `${fmt(kg / SOLAR, settings)} ${zh ? '太阳质量' : 'M☉'}`;
  }
  return `${fmt(kg, settings)} kg`;
}
