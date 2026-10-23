import * as THREE from 'three';
import type { GameState } from '../sim/state';
import { currentPalette } from '../view2d/palette';
import { localScale, scaleOf, stageWeight, type Stage } from './ScaleRig';

type Factory = (scene: THREE.Scene, color: THREE.Color) => Stage;
interface Shell { scene: THREE.Scene; camera: THREE.PerspectiveCamera; stage: Stage; target: THREE.WebGLRenderTarget }
const CAM: Record<string, [number, number, number, number, number]> = {
  bench:[5,20,0.1,200,0.8], works:[150,650,1,4000,0.65],
  planet:[160,300,1,5000,0.18], system:[170,500,1,8000,0.25], web:[1200,2100,10,40000,0.3],
};
const LOADERS = {
  bench: () => import('./stages/s1_bench').then(m=>m.createBenchStage),
  works: () => import('./stages/s2_works').then(m=>m.createWorksStage),
  planet: () => import('./stages/s3_planet').then(m=>m.createPlanetStage),
  system: () => import('./stages/s4_system').then(m=>m.createSystemStage),
  web: () => import('./stages/s5_web').then(m=>m.createWebStage),
};
import { STAGE_RANGES } from './ScaleRig';

/** Independent scale shells, composited in one WebGL context. Each camera
 * has its own near/far and local units; crossing shells never changes a shared
 * scene's camera abruptly. Only the active pair is resident. */
export class Renderer {
  private gl: THREE.WebGLRenderer | null = null;
  private shells = new Map<string, Shell>();
  private factories = new Map<string, Factory>();
  private loading = new Set<string>();
  private scale = -1;
  private width = 1;
  private height = 1;
  private generation = 0;
  private time = 0;
  private composite = new THREE.Scene();
  private ortho = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  private material = new THREE.ShaderMaterial({
    depthTest:false, depthWrite:false,
    uniforms:{a:{value:null},b:{value:null},mixValue:{value:0},time:{value:0},motion:{value:1}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      precision highp float;
      uniform sampler2D a; uniform sampler2D b;
      uniform float mixValue; uniform float time; uniform float motion;
      varying vec2 vUv;
      void main(){
        vec2 p=vUv*2.-1.; vec2 uv=(p*(1.+0.018*dot(p,p))+1.)*.5;
        if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.)))){gl_FragColor=vec4(0.,0.,0.,1.);return;}
        vec3 c=mix(texture2D(a,uv).rgb,texture2D(b,uv).rgb,mixValue);
        c+=max(vec3(0.),c-.6)*.18;
        c*=.94+.06*sin(uv.y*900.);
        float n=fract(sin(dot(uv+time*motion*.001,vec2(12.9898,78.233)))*43758.5453);
        c+=(n-.5)*.012*motion;
        gl_FragColor=vec4(c,1.);
      }`,
  });
  private quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);

  init(canvas: HTMLCanvasElement): boolean {
    try {
      this.gl = new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'});
      this.gl.setPixelRatio(Math.min(devicePixelRatio,1.5));
      this.composite.add(this.quad);
      canvas.addEventListener('webglcontextlost',e=>e.preventDefault());
      return true;
    } catch { return false; }
  }

  private ensure(id: keyof typeof LOADERS, s: GameState): Shell | undefined {
    const existing=this.shells.get(id);
    if(existing) return existing;
    const factory=this.factories.get(id);
    if(!factory){
      if(!this.loading.has(id)){
        this.loading.add(id);
        const generation=this.generation;
        void LOADERS[id]().then(f=>{if(generation===this.generation)this.factories.set(id,f);}).finally(()=>this.loading.delete(id));
      }
      return;
    }
    const scene=new THREE.Scene();
    const stage=factory(scene,new THREE.Color(currentPalette(s.act).glow));
    stage.build();
    const camera=new THREE.PerspectiveCamera(48,this.width/this.height,0.1,4000);
    const target=new THREE.WebGLRenderTarget(this.width,this.height,{depthBuffer:true});
    const shell={scene,camera,stage,target};
    this.shells.set(id,shell);
    return shell;
  }

  resize(w:number,h:number):void {
    if(!this.gl||w<1||h<1)return;
    this.width=Math.floor(w);this.height=Math.floor(h);
    this.gl.setSize(this.width,this.height,false);
    for(const shell of this.shells.values())shell.target.setSize(this.width,this.height);
  }

  render(s:GameState,dt:number):void {
    if(!this.gl || this.gl.getContext().isContextLost())return;
    const target=scaleOf(s);
    if(this.scale<0 || target<this.scale-.5)this.scale=target;
    this.scale+=Math.max(0,target-this.scale)*Math.min(1,dt*.65);
    const scale=this.scale;
    const active=(Object.keys(LOADERS) as (keyof typeof LOADERS)[])
      .map(id=>({id,weight:stageWeight(STAGE_RANGES[id]!,scale)})).filter(x=>x.weight>0);
    const rendered:{shell:Shell;weight:number}[]=[];
    for(const item of active){
      const shell=this.ensure(item.id,s);if(!shell)continue;
      const t=localScale(shell.stage.range,scale);
      const [from,to,near,far,height]=CAM[item.id]!;
      const dist=from+(to-from)*t;
      shell.camera.aspect=this.width/this.height;
      shell.camera.near=near;shell.camera.far=far;
      shell.camera.position.set(dist*.14,dist*height,dist);
      shell.camera.lookAt(0,0,0);shell.camera.updateProjectionMatrix();
      shell.stage.setLocalScale(t);shell.stage.update(s,dt,1);
      this.gl.setRenderTarget(shell.target);this.gl.clear();this.gl.render(shell.scene,shell.camera);
      rendered.push({shell,weight:item.weight});
    }
    if(!rendered.length){this.gl.setRenderTarget(null);this.gl.clear();return;}
    const first=rendered[0]!,second=rendered[1]??first;
    this.material.uniforms['a']!.value=first.shell.target.texture;
    this.material.uniforms['b']!.value=second.shell.target.texture;
    this.material.uniforms['mixValue']!.value=rendered.length>1?second.weight/(first.weight+second.weight):0;
    this.material.uniforms['time']!.value=this.time+=dt;
    this.material.uniforms['motion']!.value=matchMedia('(prefers-reduced-motion: reduce)').matches?0:1;
    this.gl.setRenderTarget(null);this.gl.render(this.composite,this.ortho);
    for(const [id,shell]of this.shells){
      if(!active.some(a=>a.id===id)){
        shell.stage.dispose();shell.target.dispose();this.shells.delete(id);
      }
    }
  }

  dispose():void {
    this.generation++;
    for(const shell of this.shells.values()){shell.stage.dispose();shell.target.dispose();}
    this.shells.clear();this.material.dispose();this.quad.geometry.dispose();
    this.gl?.dispose();this.gl=null;
  }
}
