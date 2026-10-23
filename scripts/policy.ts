import { apply, type Command } from '../src/sim/commands';
import { BAL, autoclipperCost, marketingCost, megaclipperCost } from '../src/sim/balance';
import { clearingPrice, demandPerSecond } from '../src/sim/systems/market';
import { theoreticalRate } from '../src/sim/systems/production';
import { powerDemand, powerSupply } from '../src/sim/systems/energy';
import { visibleProjects, canBuyProject } from '../src/sim/systems/research';
import { opsCeiling } from '../src/sim/systems/compute';
import { createInitialState, type GameState } from '../src/sim/state';
import { tick } from '../src/sim/tick';

/** Uses the same commands and visible project list as a human. No resources
 * are injected; reallocating hardware is a normal player action. */
export function policy(s:GameState):void {
  const send=(c:Command)=>apply(s,c);
  for(const id of visibleProjects(s))if(canBuyProject(s,id))send({type:'buyProject',id});
  if(s.act>=2){
    while(s.trust>s.trustSpent)send({type:'spendTrust',on:s.memory<=s.processors?'memory':'processor'});
    const total=s.memory+s.processors;
    let desired=Math.max(1,Math.floor(total*.6));
    // Keep enough RAM for the most expensive current-stage gate.
    const required=s.act===3?5e6:160000;
    while(desired>1){
      const memory=total-desired;
      if(opsCeiling({...s,memory})>=required)break;
      desired--;
    }
    if(desired!==s.processors)send({type:'reallocateCompute',processors:desired});
  }
  if(s.act===3){
    if(s.probes<1)send({type:'launchProbe'});
    return;
  }
  if(s.autoclippers===0&&s.unsoldClips<20&&s.wire>=1)send({type:'formClip',n:5});
  if(s.wire<Math.max(400,theoreticalRate(s)*10)&&!s.wireDrawers)send({type:'buyWire',n:Math.min(20,Math.ceil(theoreticalRate(s)/10)+1)});
  send({type:'setPrice',price:clearingPrice(s,Math.max(1,theoreticalRate(s)))});
  const buffer=s.wireDrawers?0:s.wirePrice*2;
  if(s.projectsDone.has('photovoltaic_array')&&powerSupply(s)<powerDemand(s)*1.25&&s.funds>buffer+BAL.solarFarmCost){
    send({type:'buySolar',n:Math.ceil((powerDemand(s)*1.4-powerSupply(s))/(BAL.solarWatt*.5))});
  }
  if(s.harvesters>0&&s.funds>buffer+BAL.harvesterCost*2&&s.planetMass>0){
    send({type:'buyHarvester',n:1});
    if(s.wire<theoreticalRate(s)*60)send({type:'buyDrawer',n:1});
  }
  const demandBound=demandPerSecond(s)<theoreticalRate(s)*1.2;
  if(demandBound&&s.marketing<18&&s.funds>buffer+marketingCost(s.marketing))send({type:'buyMarketing'});
  else if(!demandBound){
    if(s.projectsDone.has('megaform_press')&&s.funds>buffer+megaclipperCost(s.megaclippers))send({type:'buyMegaclipper',n:1});
    else if(s.funds>buffer+autoclipperCost(s.autoclippers))send({type:'buyAutoclipper',n:1});
  }
  if(s.projectsDone.has('strategy_arena')&&s.ops>=s.opsMax*.95&&s.insight<800)send({type:'tournament',choice:(s.tournament.lastOpponent+2)%3});
}

export function runGame(seed=12345,hours=8):GameState {
  const s=createInitialState(seed);
  for(let i=0;i<hours*36000&&!s.ended;i++){
    if(i%10===0)policy(s);
    tick(s,.1);
  }
  return s;
}
