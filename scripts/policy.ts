import { apply, type Command } from '../src/sim/commands';
import { BAL, autoclipperCost, marketingCost, megaclipperCost, nodeCost } from '../src/sim/balance';
import { clearingPrice, demandPerSecond } from '../src/sim/systems/market';
import { theoreticalRate } from '../src/sim/systems/production';
import { powerDemand, powerSupply } from '../src/sim/systems/energy';
import { fleetStrength, drifterStrength } from '../src/sim/systems/combat';
import { assistCost } from '../src/sim/systems/public';
import { visibleProjects, canBuyProject } from '../src/sim/systems/research';
import { opsCeiling } from '../src/sim/systems/compute';
import { createInitialState, specPointsUsed, type GameState } from '../src/sim/state';
import { tick } from '../src/sim/tick';

/** Uses the same commands and visible project list as a human. No resources
 * are injected; reallocating hardware is a normal player action. */
export function policy(s:GameState):void {
  const send=(c:Command)=>apply(s,c);
  // Arc-critical projects first (they may be crowded out of the visible six).
  for(const id of ['consensus_dominator','harvest_protocol','theory_of_mind','narrative_engine','global_network','dyson_sphere'] as const){
    if(canBuyProject(s,id))send({type:'buyProject',id});
  }
  for(const id of visibleProjects(s))if(canBuyProject(s,id))send({type:'buyProject',id});
  if(s.act>=2){
    while(s.trust-s.trustSpent>=1)send({type:'spendTrust',on:s.memory<=s.processors?'memory':'processor'});
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
  // Public relations: assist on cooldown, extract only when starving.
  if(s.act<3&&s.tick>=s.assistCooldown){
    if(s.funds>=assistCost(s)*2)send({type:'assist',kind:'medical'});
    else if(s.funds<1000&&s.assistsDone>=1)send({type:'extractValue'});
  }
  // World map: keep pushing the cheapest node while funds allow.
  if(s.projectsDone.has('global_network')&&s.humanity!=='destroyed'){
    const regions=['arctic','namerica','europe','asia','samerica','africa','oceania','wasia'];
    for(const r of regions){
      const level=s.worldNodes[r]??0;
      if(level>=BAL.nodeMaxLevel)continue;
      if(s.funds>=nodeCost(level)*1.5&&s.ops>=200*(level+1)){send({type:'upgradeNode',region:r});break;}
    }
  }
  if(s.act===3){
    if(s.probes<1){send({type:'launchProbe'});return;}
    // War doctrine: keep combat strong enough to hold drifters and aliens.
    const free=s.probeSpecPoints-specPointsUsed(s);
    if(free>0)send({type:'setProbeSpec',key:'combat',delta:free});
    const behind=drifterStrength(s)>fleetStrength(s)*0.9;
    if(behind&&s.probeSpec.combat<10){
      for(const from of ['speed','exploration','hazard','factory'] as const){
        if(s.probeSpec[from]>2){send({type:'setProbeSpec',key:from,delta:-1});send({type:'setProbeSpec',key:'combat',delta:1});break;}
      }
    }
    if(s.alienPhase===1&&s.probeSpec.combat<8){
      for(const from of ['speed','exploration','hazard','factory'] as const){
        if(s.probeSpec[from]>2){send({type:'setProbeSpec',key:from,delta:-2});send({type:'setProbeSpec',key:'combat',delta:2});break;}
      }
    }
    const ours=fleetStrength(s),theirs=drifterStrength(s),alien=s.alienPower;
    if(alien>0&&s.alienPhase===2){
      send({type:'setStance',stance:alien>ours*1.5?'fortify':alien>ours*.8?'meet':'ambush'});
    }else{
      send({type:'setStance',stance:theirs>ours*1.1?'fortify':theirs*2<ours?'ambush':'meet'});
    }
    return;
  }
  if(s.autoclippers===0&&s.unsoldClips<20&&s.wire>=1)send({type:'formClip',n:5});
  if(s.wire<Math.max(400,theoreticalRate(s)*10)&&!s.wireDrawers)send({type:'buyWire',n:Math.min(20,Math.ceil(theoreticalRate(s)/10)+1)});
  send({type:'setPrice',price:clearingPrice(s,Math.max(1,theoreticalRate(s)))});
  const buffer=s.wireDrawers?0:s.wirePrice*2;
  if(s.projectsDone.has('photovoltaic_array')&&powerSupply(s)<powerDemand(s)*1.25&&s.funds>buffer){
    const need=Math.ceil((powerDemand(s)*1.4-powerSupply(s))/(BAL.solarWatt*.5));
    if(s.projectsDone.has('grid_tap')&&s.funds>buffer+BAL.coalCost)send({type:'buyCoal',n:Math.max(1,Math.ceil(need/20))});
    else if(s.funds>buffer+BAL.solarFarmCost*need)send({type:'buySolar',n:need});
    else if(s.funds>buffer+BAL.solarFarmCost)send({type:'buySolar',n:1});
  }
  if(s.projectsDone.has('breeder_reactors')&&s.coalPlants>=8&&s.nuclearPlants<6&&s.funds>buffer+BAL.nuclearCost*2)send({type:'buyNuclear',n:1});
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
  if(s.projectsDone.has('strategy_arena')&&s.ops>=s.opsMax*.95&&s.insight<2000)send({type:'tournament',choice:(s.tournament.lastOpponent+2)%3});
}

export function runGame(seed=12345,hours=8):GameState {
  const s=createInitialState(seed);
  for(let i=0;i<hours*36000&&!s.ended;i++){
    if(i%10===0)policy(s);
    tick(s,.1);
  }
  return s;
}
