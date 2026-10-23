import { save } from '../sim/save';
import { catchUp, TICK_MS, tick } from '../sim/tick';
import type { Bus } from './bus';

export interface Loop { start():void;stop():void;alpha():number }
export function createLoop(bus:Bus,onFrame:(alpha:number)=>void):Loop {
  let raf=0,acc=0,last=0,lastSave=0,running=false,hiddenAt=0;
  const frame=(now:number)=>{
    if(!running)return;
    acc+=Math.min(now-last,1000);last=now;
    const changed=bus.flush();
    let steps=0;
    while(acc>=TICK_MS&&steps<10){tick(bus.state,.1);acc-=TICK_MS;steps++;}
    if(steps===10)acc=0;
    if(steps||changed)bus.publish();
    onFrame(acc/TICK_MS);
    if(now-lastSave>=10000){lastSave=now;save(bus.state,Date.now());}
    raf=requestAnimationFrame(frame);
  };
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){hiddenAt=Date.now();cancelAnimationFrame(raf);save(bus.state,hiddenAt);}
    else if(running&&hiddenAt){
      catchUp(bus.state,Date.now()-hiddenAt);hiddenAt=0;
      last=performance.now();acc=0;bus.publish();raf=requestAnimationFrame(frame);
    }
  });
  return {
    start(){if(running)return;running=true;last=lastSave=performance.now();raf=requestAnimationFrame(frame);},
    stop(){running=false;cancelAnimationFrame(raf);save(bus.state,Date.now());},
    alpha:()=>acc/TICK_MS,
  };
}
