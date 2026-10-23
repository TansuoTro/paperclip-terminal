import { chromium, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { createInitialState, type GameState } from '../src/sim/state';
import { revealPass } from '../src/sim/reveal';
import { research } from '../src/sim/systems/research';
import { exportString } from '../src/sim/save';
import { PROJECTS } from '../src/sim/content/projects';

mkdirSync('artifacts/mobile', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors: string[] = [];
const cases: string[] = [];

function fixture(act: 1 | 2 | 3): GameState {
  const s = createInitialState();
  s.act = act;
  s.clips = act === 1 ? 1000 : 1e8;
  s.funds = 1e6;
  s.stats.totalFundsEarned = 1e7;
  s.autoclippers = 20;
  if (act >= 2) {
    s.processors = 8; s.memory = 7; s.trust = 20; s.trustSpent = 13;
    s.solarFarms = 300; s.batteries = 10; s.energyStored = 1e6;
    s.harvesters = 10; s.wireDrawers = 2; s.ops = 5000;
    for (const p of PROJECTS) if (p.act === 1) s.projectsDone.add(p.id);
    for (const id of ['megaform_press', 'photovoltaic_array', 'matter_reforge', 'strategy_arena']) s.projectsDone.add(id);
  }
  if (act === 3) {
    for (const p of PROJECTS) if (p.act <= 2) s.projectsDone.add(p.id);
    s.projectsDone.add('von_neumann_seed');
    s.probes = 10000; s.probeSpecPoints = 20;
    s.probeSpec = { speed: 3, exploration: 3, selfReplication: 5, hazard: 3, factory: 2, harvester: 2, wire: 1, combat: 1 };
    s.wire = 1e12;
  }
  revealPass(s); research(s);
  return s;
}

async function checkBounds(page: Page, label: string): Promise<void> {
  const issues = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('.stage')!;
    const term = document.querySelector<HTMLElement>('.term')!;
    const faults: string[] = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) faults.push('page horizontal overflow');
    if (stage.scrollWidth > stage.clientWidth + 2) faults.push('stage horizontal overflow');
    const outer = term.getBoundingClientRect();
    if (outer.bottom > innerHeight + 1 || outer.top < 0) faults.push('terminal exceeds viewport');
    if (stage.clientHeight < 70) faults.push('stage has no usable height');
    const targets = [...document.querySelectorAll<HTMLElement>('button, input[type="range"]')]
      .filter(el => el.getClientRects().length > 0);
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      if (r.height < 43) faults.push(`small touch height: ${el.getAttribute('aria-label') ?? el.textContent?.trim()}`);
      if (r.width < 39 && el.tagName === 'BUTTON') faults.push(`small touch width: ${el.textContent?.trim()}`);
    }
    return faults;
  });
  expect(issues, `${label}: ${issues.join(', ')}`).toEqual([]);
}

try {
  for (const [width, height] of [[320,568], [390,844], [430,932], [768,1024], [844,390]] as const) {
    for (const act of [1,2,3] as const) {
      const s = fixture(act);
      const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      const json = Buffer.from(exportString(s), 'base64').toString('utf8');
      await context.addInitScript(json => {
        const e = JSON.parse(json); e.savedAt = Date.now();
        localStorage.setItem('paperclip-terminal.save.v1', JSON.stringify(e));
      }, json);
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:5173/');
      await page.getByRole('button', { name: 'INITIALIZE / 初始化' }).click();
      await page.waitForTimeout(600);
      const label = `${width}x${height}-act${act}`;
      await checkBounds(page, label);
      await expect(page.getByRole('log')).toBeHidden();
      await page.getByRole('button', { name: '日志 +' }).click();
      await expect(page.getByRole('log')).toBeVisible();
      await page.getByRole('button', { name: '日志 −' }).click();
      if (act >= 2) {
        await expect(page.getByRole('textbox', { name: '命令输入' })).toBeHidden();
        await page.getByRole('button', { name: '命令 +' }).click();
        await page.getByRole('textbox', { name: '命令输入' }).fill('help');
        await page.getByRole('button', { name: '执行命令' }).click();
        await page.getByRole('button', { name: '命令 −' }).click();
      }
      if (act === 3) {
        const minus = page.getByRole('button', { name: '航行 -1', exact: true });
        await minus.scrollIntoViewIfNeeded();
        await minus.tap();
        await expect(page.locator('#spec-speed')).toHaveText('2');
        await page.getByRole('button', { name: '航行 +1', exact: true }).tap();
        await expect(page.locator('#spec-speed')).toHaveText('3');
        if (width === 390) await page.screenshot({ path: 'artifacts/mobile/probe-designer.png' });
      }
      if (act === 2) {
        const arena = page.getByTestId('tournament');
        await arena.scrollIntoViewIfNeeded();
        await arena.getByRole('button', { name: '突发', exact: true }).tap();
        await expect(arena).toContainText(/\+[1-9]/);
      }
      await page.locator('.stage').evaluate(el => { el.scrollTop = 0; });
      await page.screenshot({ path: `artifacts/mobile/${label}.png` });
      if (width === 390 && act === 3) {
        await page.getByRole('button', { name: '系统', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: '清除存档', exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: 'artifacts/mobile/settings.png' });
        await page.getByRole('button', { name: '× 关闭' }).click();
        await page.getByRole('button', { name: '光学 · 3D' }).scrollIntoViewIfNeeded();
        await page.getByRole('button', { name: '光学 · 3D' }).click();
        await page.waitForTimeout(2200);
        await page.screenshot({ path: 'artifacts/mobile/optical.png' });
        await page.getByRole('button', { name: '示意图 · 2D' }).click();
        await page.setViewportSize({ width: 844, height: 390 });
        await checkBounds(page, 'rotated-landscape');
        await page.setViewportSize({ width: 390, height: 500 });
        await checkBounds(page, 'short-viewport');
      }
      cases.push(label);
      await context.close();
    }
  }
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ cases, errors, screenshots: 'artifacts/mobile/' }, null, 2));
} finally { await browser.close(); }
