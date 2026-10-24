import { createInitialState, defaultSettings, SCHEMA_VERSION, type GameState } from './state';

const KEY = 'paperclip-terminal.save.v1';
const BACKUP = `${KEY}.backup`;
interface Envelope { schema:number; savedAt:number; state:Record<string,unknown>; checksum?:string }
const SETS = ['revealed','retired','projectsDone','projectsAvailable'] as const;

function checksum(text:string):string {
  let h=2166136261;
  for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);
  return (h>>>0).toString(16);
}
function encode(s:GameState,savedAt=0):Envelope {
  const state:Record<string,unknown>={...s,pendingReveals:[]};
  for(const f of SETS)state[f]=[...s[f]];
  return {schema:SCHEMA_VERSION,savedAt,state,checksum:checksum(JSON.stringify(state))};
}

/** Only known fields cross the save boundary. Numbers must be finite and
 * nonnegative; nested structures are reconstructed instead of blindly spread. */
function decode(raw:unknown):GameState {
  if(!raw||typeof raw!=='object')throw new Error('Invalid save envelope');
  const e=raw as Envelope;
  if(e.schema!==SCHEMA_VERSION||!e.state||typeof e.state!=='object')throw new Error('Unsupported save version');
  if(e.checksum&&checksum(JSON.stringify(e.state))!==e.checksum)throw new Error('Save checksum mismatch');
  const base=createInitialState(),src=e.state;
  for(const [k,v] of Object.entries(base)){
    const n=src[k];
    if(typeof v==='number'&&n!==undefined){
      if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1e100)throw new Error(`Invalid number: ${k}`);
      (base as unknown as Record<string,unknown>)[k]=n;
    }
  }
  for(const k of ['tick','beat','processors','memory','trust','trustSpent','autoclippers','megaclippers','marketing','probeSpecPoints','honor','battlesWon','battlesLost'] as const){
    if(!Number.isInteger(base[k]))throw new Error(`Invalid integer: ${k}`);
  }
  if(![1,2,3].includes(base.act)||base.trustSpent>base.trust||base.clipPrice<.03||base.clipPrice>1||base.wirePerClip<=0||base.memory<1)throw new Error('Invalid state ranges');
  for(const f of SETS){
    if(!Array.isArray(src[f])||!(src[f] as unknown[]).every(x=>typeof x==='string'))throw new Error('Invalid set');
    base[f]=new Set(src[f] as string[]);
  }
  for(const field of ['probeSpec','drifterSpec'] as const){
    const obj=src[field] as Record<string,unknown>|undefined;
    if(!obj||typeof obj!=='object')throw new Error('Invalid specification');
    for(const k of Object.keys(base[field]) as (keyof GameState['probeSpec'])[]){
      const n=obj[k];if(typeof n!=='number'||!Number.isInteger(n)||n<0||n>1000)throw new Error('Invalid probe allocation');
      base[field][k]=n;
    }
  }
  for(const k of ['ended','trustFrozen'] as const)if(typeof src[k]==='boolean')base[k]=src[k] as boolean;
  // Enumerated strings + the world-map deployment table.
  if(src['humanity']==='deceived'||src['humanity']==='destroyed')base.humanity=src['humanity'] as GameState['humanity'];
  if(src['battleStance']==='ambush'||src['battleStance']==='fortify')base.battleStance=src['battleStance'] as GameState['battleStance'];
  if([1,2,3].includes(src['alienPhase'] as number))base.alienPhase=src['alienPhase'] as GameState['alienPhase'];
  const nodes=src['worldNodes'] as Record<string,unknown>|undefined;
  if(nodes&&typeof nodes==='object'){
    for(const [k,v]of Object.entries(nodes))if(typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=5)base.worldNodes[k]=v;
  }
  const alienPower=src['alienPower'];
  if(typeof alienPower==='number'&&Number.isFinite(alienPower)&&alienPower>=0&&alienPower<=1e60)base.alienPower=alienPower;
  const settings=src['settings'] as Record<string,unknown>|undefined;
  if(settings&&typeof settings==='object'){
    base.settings=defaultSettings();
    for(const k of ['masterVolume','musicVolume','sfxVolume'] as const){
      const n=settings[k];if(typeof n==='number'&&Number.isFinite(n))base.settings[k]=Math.max(0,Math.min(1,n));
    }
    if(settings['locale']==='en')base.settings.locale='en';
    if(settings['numberFormat']==='scientific')base.settings.numberFormat='scientific';
    if(settings['viewMode']==='optical')base.settings.viewMode='optical';
    base.settings.plainMode=settings['plainMode']===true;
    base.settings.autoPrice=settings['autoPrice']===true;
  }
  const stats=src['stats'] as GameState['stats']|undefined;
  if(stats&&typeof stats==='object'){
    for(const [k,v]of Object.entries(stats.milestones??{}))if(Number.isFinite(v)&&v>=0)base.stats.milestones[k]=v;
    base.stats.clicks=Number.isFinite(stats.clicks)?Math.max(0,stats.clicks):0;
    base.stats.totalFundsEarned=Number.isFinite(stats.totalFundsEarned)?Math.max(0,stats.totalFundsEarned):0;
  }
  const tournament=src['tournament'] as GameState['tournament']|undefined;
  if(tournament&&Object.values(tournament).every(v=>Number.isFinite(v)&&v>=0)&&tournament.lastChoice<=2&&tournament.lastOpponent<=2)base.tournament={...tournament};
  if(Array.isArray(src['log']))base.log=(src['log'] as GameState['log']).filter(x=>x&&Number.isFinite(x.tick)&&typeof x.kind==='string'&&typeof x.text?.en==='string'&&typeof x.text?.zh==='string').slice(-200);
  base.lastBattle=null;
  base.schema=SCHEMA_VERSION;
  return base;
}

export function save(s:GameState,nowMs:number):boolean {
  try {
    const next=JSON.stringify(encode(s,nowMs));
    const prev=localStorage.getItem(KEY);
    if(prev)localStorage.setItem(BACKUP,prev);
    localStorage.setItem(KEY,next);
    return true;
  }catch{return false;}
}

export function load(nowMs:number):{state:GameState;awayMs:number;fresh:boolean} {
  for(const key of [KEY,BACKUP]){
    try{
      const text=localStorage.getItem(key);if(!text)continue;
      const raw=JSON.parse(text) as Envelope;
      const state=decode(raw);
      return {state,awayMs:Math.max(0,nowMs-(Number.isFinite(raw.savedAt)?raw.savedAt:nowMs)),fresh:false};
    }catch{ /* Try the last known good backup before starting fresh. */ }
  }
  return {state:createInitialState(),awayMs:0,fresh:true};
}

export function exportString(s:GameState):string {
  const bytes=new TextEncoder().encode(JSON.stringify(encode(s)));
  let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
  return btoa(binary);
}
export function importString(text:string):GameState|null {
  if(text.length>2_000_000)return null;
  try{
    const binary=atob(text.trim());
    const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    return decode(JSON.parse(new TextDecoder().decode(bytes)));
  }catch{return null;}
}
export function wipe():void {try{localStorage.removeItem(KEY);localStorage.removeItem(BACKUP);}catch{ /* storage disabled */ }}
