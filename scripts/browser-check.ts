import { chromium, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { createInitialState, type GameState } from '../src/sim/state';
import { revealPass } from '../src/sim/reveal';
import { research } from '../src/sim/systems/research';
import { exportString } from '../src/sim/save';
import { PROJECTS } from '../src/sim/content/projects';

mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors:string[]=[];
async function open(s?:GameState,width=1440,height=1000){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  if(s){
    revealPass(s);research(s);
    const json=Buffer.from(exportString(s),'base64').toString('utf8');
    await context.addInitScript(json=>{const e=JSON.parse(json);e.savedAt=Date.now();localStorage.setItem('paperclip-terminal.save.v1',JSON.stringify(e));},json);
  }
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button',{name:'INITIALIZE / 初始化'}).click();
  return {context,page};
}
try{
  const first=await open();
  await first.page.getByRole('button',{name:'成型回形针'}).waitFor();
  await first.page.screenshot({path:'artifacts/01-opening.png'});
  for(let i=0;i<25;i++)await first.page.getByRole('button',{name:'成型回形针',exact:true}).click();
  await first.page.getByRole('button',{name:'光学 · 3D'}).click();
  await first.page.waitForTimeout(3000);
  await first.page.screenshot({path:'artifacts/02-bench.png'});
  await first.context.close();

  for(const [name,act,mass,probes]of [
    ['works',2,1,0],['planet',2,.1,0],['system',3,0,100],['web',3,0,1e30],
  ] as const){
    const s=createInitialState();s.act=act;s.clips=1e8;s.funds=1e8;s.stats.totalFundsEarned=1e9;
    s.autoclippers=70;s.megaclippers=100;s.processors=8;s.memory=7;s.trust=20;s.trustSpent=13;
    s.solarFarms=500;s.batteries=10;s.harvesters=mass===1?1:500;s.wireDrawers=10;
    s.planetMass=s.planetMassTotal*mass;s.probes=probes;s.settings.viewMode='optical';
    for(const p of PROJECTS)if(p.act<=2&&p.id!=='substrate_release')s.projectsDone.add(p.id);
    if(act===3){s.projectsDone.add('von_neumann_seed');s.probeSpecPoints=20;s.probeSpec={speed:3,exploration:3,selfReplication:5,hazard:3,factory:2,harvester:2,wire:1,combat:1};}
    if(name==='web'){s.massBudget=s.massBudgetTotal*.8;s.exploredMass=s.massBudgetTotal;s.drifters=1e24;}
    const {context,page}=await open(s);
    await page.waitForTimeout(3000);
    await page.screenshot({path:`artifacts/03-${name}.png`});
    if(act===3){
      await page.getByTestId('probe-designer').waitFor();
      await page.getByRole('button',{name:'航行 -1',exact:true}).click();
      await expect(page.locator('#spec-speed')).toHaveText('2');
      await page.getByRole('button',{name:'航行 +1',exact:true}).click();
      await expect(page.locator('#spec-speed')).toHaveText('3');
    }
    if(name==='planet'){
      await page.getByRole('button',{name:'示意图 · 2D'}).click();
      await page.waitForTimeout(300);
      await page.screenshot({path:'artifacts/04-schematic.png'});
      await page.setViewportSize({width:390,height:844});
      await page.waitForTimeout(300);await page.screenshot({path:'artifacts/05-mobile.png',fullPage:true});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      if(overflow)errors.push('mobile horizontal overflow');
    }
    await context.close();
  }
  console.log(JSON.stringify({errors,screenshots:'artifacts/'},null,2));
  if(errors.length)throw new Error('Browser errors detected');
}finally{await browser.close();}
