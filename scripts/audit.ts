import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5173/';
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
// Optional save file (base64 export) injected before the app boots.
const saveFile = process.argv[3];
if (saveFile) {
  const fs = await import('node:fs');
  // exportString is base64(JSON envelope); the app expects the envelope itself.
  const b64 = fs.readFileSync(saveFile, 'utf-8').trim();
  const envelope = Buffer.from(b64, 'base64').toString('utf-8');
  JSON.parse(envelope); // throw early if malformed
  await page.addInitScript((v) => localStorage.setItem('paperclip-terminal.save.v1', v), envelope);
}
await page.goto(url);
await page.waitForTimeout(1200);
const clicked = await page.click('#boot-go').then(() => 'clicked').catch((e: Error) => 'NO BOOT: ' + e.message.slice(0, 60));
await page.waitForTimeout(1200);

const script = [
  '(() => {',
  '  const q = (sel) => {',
  '    const el = document.querySelector(sel);',
  '    if (!el) return null;',
  '    const r = el.getBoundingClientRect();',
  '    const cs = getComputedStyle(el);',
  '    return { h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top),',
  '      display: cs.display, rows: cs.gridTemplateRows, cols: cs.gridTemplateColumns };',
  '  };',
  '  return {',
  '    crt: q(".crt"), term: q(".term"), titlebar: q(".titlebar"), ticker: q(".news-ticker"),',
  '    stage: q(".stage"), log: q(".log"), mobileTools: q(".mobile-tools"), cmdline: q(".cmdline"),',
  '    panels: [...document.querySelectorAll(".stage > *")].map((p) => ({',
  '      cls: p.className.split(" ").slice(0, 2).join(" "),',
  '      h: Math.round(p.getBoundingClientRect().height),',
  '      top: Math.round(p.getBoundingClientRect().top),',
  '      content: p.scrollHeight,',
  '    })),',
  '    storage: Object.keys(localStorage),',
  '  };',
  '})()',
].join('\n');

const data = await page.evaluate(script) as {
  crt: Record<string, unknown>; term: Record<string, unknown>; stage: Record<string, unknown>;
  log: Record<string, unknown>; ticker: Record<string, unknown>;
  panels: { cls: string; h: number; top: number; content: number }[]; storage: string[];
};
console.log('boot:', clicked);
for (const k of ['crt', 'term', 'stage', 'log', 'ticker']) {
  console.log(k.padEnd(8), JSON.stringify((data as unknown as Record<string, Record<string, unknown>>)[k]));
}
console.log('panels:');
for (const p of data.panels) console.log(' ', p.cls.padEnd(20), 'h=' + p.h, 'top=' + p.top, 'content=' + p.content);
console.log('storage:', data.storage.join(','));
await browser.close();
