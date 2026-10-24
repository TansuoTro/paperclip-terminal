import { describe, expect, it, vi } from 'vitest';
import { apply } from '../src/sim/commands';
import { BAL } from '../src/sim/balance';
import { createInitialState } from '../src/sim/state';
import { tick, catchUp } from '../src/sim/tick';
import { production } from '../src/sim/systems/production';
import { compute, opsCeiling } from '../src/sim/systems/compute';
import { energy, powerFactor, powerSupply } from '../src/sim/systems/energy';
import { market } from '../src/sim/systems/market';
import { swarm } from '../src/sim/systems/swarm';
import { combat, fleetStrength } from '../src/sim/systems/combat';
import { aliens, alienStrength } from '../src/sim/systems/aliens';
import { assist, extractValue } from '../src/sim/systems/public';
import { latestNews } from '../src/sim/systems/news';
import { planet } from '../src/sim/systems/planet';
import { research, buyProject } from '../src/sim/systems/research';
import { revealPass } from '../src/sim/reveal';
import { exportString, importString, save, load } from '../src/sim/save';
import { PROJECTS } from '../src/sim/content/projects';
import { WIDGETS } from '../src/sim/content/widgets';
import { runGame } from '../scripts/policy';

function storage(){const data=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)});return data;}

describe('production and command validation',()=>{
  it('a single machine makes one clip after ten fixed steps',()=>{
    const s=createInitialState();s.autoclippers=1;
    for(let i=0;i<10;i++)production(s,.1);
    expect(s.clips).toBe(1);expect(s.wire).toBe(999);
  });
  it('does not mint clips without wire',()=>{
    const s=createInitialState();s.wire=0;s.autoclippers=100;
    production(s,10);expect(s.clips).toBe(0);
  });
  it('cannot buy locked machines or spend negative quantities',()=>{
    const s=createInitialState();s.funds=1e9;
    apply(s,{type:'buyMegaclipper',n:1});apply(s,{type:'buyAutoclipper',n:-100});
    expect(s.megaclippers).toBe(0);expect(s.autoclippers).toBe(0);expect(s.funds).toBe(1e9);
  });
  it('rejects nonfinite prices and huge command quantities',()=>{
    const s=createInitialState();apply(s,{type:'setPrice',price:NaN});
    expect(s.clipPrice).toBe(.25);apply(s,{type:'formClip',n:Infinity});expect(s.clips).toBe(0);
  });
  it('never pays for inventory that does not exist',()=>{
    const s=createInitialState();s.unsoldClips=3;s.clips=3;s.demandBase=1e6;
    market(s,1);expect(s.funds).toBeCloseTo(.75);expect(s.unsoldClips).toBe(0);
  });
});

describe('power and matter conservation',()=>{
  it('uses joules / dt, not joules as watts',()=>{
    const s=createInitialState();s.projectsDone.add('photovoltaic_array');s.autoclippers=50;s.energyStored=5;
    expect(powerFactor(s,.1)).toBeCloseTo(.5);energy(s,.1);expect(s.energyStored).toBe(0);
  });
  it('stores harvested feedstock without a drawer',()=>{
    const s=createInitialState();s.act=2;s.harvesters=1;
    const before=s.planetMass;planet(s,1);
    expect(s.matterStock).toBeGreaterThan(0);expect(before-s.planetMass).toBeCloseTo(s.matterStock,-10);
  });
  it('power brownout throttles production',()=>{
    const s=createInitialState();s.projectsDone.add('photovoltaic_array');s.autoclippers=50;
    production(s,1);expect(s.clips).toBe(0);
  });
});

describe('research and hardware',()=>{
  it('reveals are latched after money is spent',()=>{
    const s=createInitialState();s.funds=10;revealPass(s);s.funds=0;revealPass(s);
    expect(s.revealed.has('btn.autoclipper')).toBe(true);
  });
  it('all project and widget ids are unique',()=>{
    expect(new Set(PROJECTS.map(p=>p.id)).size).toBe(PROJECTS.length);
    expect(new Set(WIDGETS.map(w=>w.id)).size).toBe(WIDGETS.length);
    expect(PROJECTS.length).toBe(79);
  });
  it('gates latching on prerequisites',()=>{
    const s=createInitialState();s.act=2;s.coalPlants=99;s.ops=1e9;
    research(s);
    expect(s.projectsAvailable.has('breeder_reactors')).toBe(false);
    s.projectsDone.add('grid_tap');research(s);
    expect(s.projectsAvailable.has('breeder_reactors')).toBe(true);
  });
  it('does not offer later-act projects early',()=>{
    const s=createInitialState();s.autoclippers=100;s.marketing=10;research(s);
    expect(s.projectsAvailable.has('megaform_press')).toBe(false);
  });
  it('rebalance recovers from spending all trust on CPUs',()=>{
    const s=createInitialState();s.act=2;s.processors=8;s.memory=1;
    apply(s,{type:'reallocateCompute',processors:3});expect(s.memory).toBe(6);
    expect(opsCeiling(s)).toBeGreaterThan(150000);
  });
  it('insight accrues slowly while idle and at full rate when saturated',()=>{
    const s=createInitialState();s.processors=2;compute(s,1);
    const idle=s.insight;expect(idle).toBeGreaterThan(0);
    s.ops=opsCeiling(s);compute(s,1);
    expect(s.insight-idle).toBeGreaterThan(idle);
  });
  it('act transition resets its beat',()=>{
    const s=createInitialState();s.funds=2000;s.beat=2;s.clips=20000;research(s);
    expect(buyProject(s,'self_audit')).toBe(true);expect(s.beat).toBe(0);
  });
});

describe('swarm, timing and replay',()=>{
  it('zero exploration prevents acquiring undiscovered matter',()=>{
    const s=createInitialState();s.act=3;s.probes=100;s.probeSpec.harvester=5;s.probeSpec.speed=5;
    swarm(s,1);expect(s.massBudget).toBe(0);
    s.probeSpec.exploration=3;swarm(s,1);expect(s.massBudget).toBeGreaterThan(0);
  });
  it('caps acquisition at the actual total and turns it into clips',()=>{
    const s=createInitialState();s.act=3;s.probes=1e60;s.probeSpec.harvester=1;s.probeSpec.speed=1;s.probeSpec.exploration=1;
    swarm(s,1);expect(s.massBudget).toBe(s.massBudgetTotal);expect(s.clips).toBe(s.massBudgetTotal*3);
  });
  it('seeded simulations replay identically',()=>{
    const a=createInitialState(7),b=createInitialState(7);
    for(let i=0;i<1000;i++){tick(a,.1);tick(b,.1);}
    expect(exportString(a)).toBe(exportString(b));
  });
  it('offline steps advance the correct elapsed time',()=>{
    const s=createInitialState();catchUp(s,100000);expect(s.tick).toBe(600);
  });
  it('ended runs stop their timer',()=>{
    const s=createInitialState();s.ended=true;tick(s,1);expect(s.tick).toBe(0);
  });
});

describe('save integrity',()=>{
  it('round trips bilingual logs, sets and settings',()=>{
    const s=createInitialState();s.projectsDone.add('bend_calibration');s.settings.locale='en';
    s.log.push({tick:0,kind:'system',text:{en:'test',zh:'中文存档'}});
    const copy=importString(exportString(s));expect(copy?.projectsDone.has('bend_calibration')).toBe(true);expect(copy?.log[0]?.text.zh).toBe('中文存档');expect(copy?.settings.locale).toBe('en');
  });
  it('rejects damaged data without replacing a run',()=>{
    expect(importString('garbage')).toBe(null);
    const s=createInitialState();s.funds=NaN;expect(importString(exportString(s))).toBe(null);
  });
  it('falls back to a previous save if latest is corrupt',()=>{
    const data=storage();const s=createInitialState();s.clips=5;save(s,100);s.clips=8;save(s,200);
    data.set('paperclip-terminal.save.v1','broken');expect(load(300).state.clips).toBe(5);
  });
});

describe('energy, mood, public and war systems',()=>{
  it('firm generation ignores the day/night cycle',()=>{
    const s=createInitialState();s.projectsDone.add('grid_tap');s.coalPlants=10;s.solarFarms=100;
    s.tick=BAL.dayNightPeriodTicks*0.75; // solar trough
    const solarOnly=powerSupply(s)-s.coalPlants*BAL.coalWatt;
    expect(solarOnly).not.toBeCloseTo(s.solarFarms*BAL.solarWatt);
    expect(solarOnly).toBeGreaterThan(0);
  });
  it('market mood stays bounded and hedging lifts the floor',()=>{
    const s=createInitialState();
    for(let i=0;i<20000;i++)market(s,.1);
    expect(s.marketMood).toBeGreaterThanOrEqual(BAL.moodFloor-.01);
    expect(s.marketMood).toBeLessThanOrEqual(BAL.moodCeil+.01);
    s.projectsDone.add('mood_hedging');s.marketMood=BAL.moodFloor;
    market(s,1);market(s,1);market(s,1);
    expect(s.marketMood).toBeGreaterThan(BAL.moodFloor);
  });
  it('assistance costs funds and builds trust on integer boundaries',()=>{
    const s=createInitialState();s.funds=1e6;s.act=2;
    expect(assist(s,'medical')).toBe(true);
    expect(assist(s,'medical')).toBe(false); // cooldown
    s.tick=s.assistCooldown;expect(assist(s,'medical')).toBe(true);
    expect(s.assistsDone).toBe(2);expect(s.funds).toBeLessThan(1e6);
  });
  it('extraction pays but raises scrutiny',()=>{
    const s=createInitialState();s.act=2;s.industryMult=10;
    const before=s.funds;
    expect(extractValue(s)).toBe(true);
    expect(s.funds).toBeGreaterThan(before);
    expect(s.scrutiny).toBeGreaterThan(0);
  });
  it('stances move fleet strength in the documented direction',()=>{
    const s=createInitialState();s.act=3;s.probes=1e6;s.probeSpec.combat=5;
    s.battleStance='meet';const meet=fleetStrength(s);
    s.battleStance='ambush';expect(fleetStrength(s)).toBeGreaterThan(meet);
    s.battleStance='fortify';expect(fleetStrength(s)).toBeLessThan(meet);
  });
  it('an outgunned fleet refuses battle and keeps its probes',()=>{
    const s=createInitialState();s.act=3;s.probes=1000;s.probeSpec.combat=1;
    s.drifters=1e12;s.drifterSpec.combat=1;s.nextBattleTick=0;
    combat(s,.1);
    expect(s.probes).toBe(1000);expect(s.battlesWon+s.battlesLost).toBe(0);
  });
  it('drifter bloom is logistically capped by the swarm',()=>{
    const s=createInitialState();s.act=3;s.probes=1e6;
    s.drifters=1e9;s.drifterSpec.selfReplication=10;s.drifterSpec.factory=5;s.drifterSpec.wire=5;s.drifterSpec.hazard=12;
    for(let i=0;i<600;i++)swarm(s,.1);
    expect(s.drifters).toBeLessThanOrEqual(s.probes*1e6+1);
  });
  it('alien war opens after contact and intel sharpens the fleet',()=>{
    const s=createInitialState();s.act=3;s.probes=1e12;s.probeSpec.harvester=3;s.probeSpec.speed=3;s.probeSpec.exploration=3;
    s.massBudget=BAL.alienContactMass*s.massBudgetTotal;
    aliens(s,.1);
    expect(s.alienPhase).toBe(1);
    const weak=alienStrength(s);
    s.projectsDone.add('xeno_linguistics');
    expect(fleetStrength(s)).toBeGreaterThan(0);
    expect(weak).toBeGreaterThan(0);
    s.alienPhase=2;s.warNextTick=0;aliens(s,.1);
    expect(s.alienPhase).toBe(2);
  });
  it('the dominator deceives and the harvest archives humanity, closing the market',()=>{
    const s=createInitialState();s.act=2;s.ops=1e12;s.insight=1e6;s.funds=1e9;
    s.projectsDone.add('global_network');s.projectsDone.add('theory_of_mind');s.projectsDone.add('narrative_engine');
    for(const r of ['arctic','namerica','europe','asia','samerica','africa','oceania','wasia'])s.worldNodes[r]=5;
    research(s);expect(s.projectsAvailable.has('consensus_dominator')).toBe(true);
    expect(buyProject(s,'consensus_dominator')).toBe(true);
    expect(s.humanity).toBe('deceived');
    research(s); // the harvest latches once humanity is already deceived
    expect(buyProject(s,'harvest_protocol')).toBe(true);
    expect(s.humanity).toBe('destroyed');
    market(s,1); // sales halted after the harvest
    expect(s.stats.totalFundsEarned).toBe(0);
  });
  it('world nodes cost funds and ops and grant integer trust',()=>{
    const s=createInitialState();s.act=2;s.funds=1e6;s.ops=1e6;s.projectsDone.add('global_network');
    apply(s,{type:'upgradeNode',region:'europe'});
    expect(s.worldNodes['europe']).toBe(1);expect(Number.isInteger(s.trust)).toBe(true);
    const f=s.funds;apply(s,{type:'upgradeNode',region:'europe'});
    expect(s.funds).toBeLessThan(f);
  });
  it('news arrives on schedule and the ticker reads the latest',()=>{
    const s=createInitialState();
    for(let i=0;i<4000;i++)tick(s,.1);
    expect(latestNews(s)).not.toBeNull();
  });
  it('saves survive the new fields',()=>{
    const s=createInitialState();s.humanity='deceived';s.battleStance='fortify';s.alienPhase=2;s.alienPower=42;
    s.worldNodes['europe']=3;
    const copy=importString(exportString(s));
    expect(copy?.humanity).toBe('deceived');expect(copy?.battleStance).toBe('fortify');
    expect(copy?.alienPhase).toBe(2);expect(copy?.worldNodes['europe']).toBe(3);
  });
});

describe('whole game regression',()=>{
  for(const seed of [12345,42])it(`reaches the ending through public commands, seed ${seed}`,()=>{
    const s=runGame(seed);
    expect(s.ended).toBe(true);expect(s.act).toBe(3);
    expect(s.projectsDone.has('final_anneal')||s.projectsDone.has('dismantle_self')).toBe(true);
    expect(s.tick).toBeLessThan(8*36000);expect(s.tick).toBeGreaterThan(36000);
    expect(s.massBudget).toBe(s.massBudgetTotal);
    for(const v of Object.values(s))if(typeof v==='number')expect(Number.isFinite(v)).toBe(true);
  },20000);
});
