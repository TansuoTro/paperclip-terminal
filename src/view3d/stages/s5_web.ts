import * as THREE from 'three';
import type { GameState } from '../../sim/state';
import type { Stage } from '../ScaleRig';
import { STAGE_RANGES } from '../ScaleRig';
import { discCloud, disposeObject, sphereCloud } from '../lib/geo';

/** S5 — galaxies on the cosmic web. The converted volume expands as a glowing
 *  front; drifter contact shows as red flares. The endgame fades this to white. */
export function createWebStage(scene: THREE.Scene, color: THREE.Color): Stage {
  const root = new THREE.Group();
  scene.add(root);

  let web: THREE.Points;
  let webMat: THREE.ShaderMaterial;
  let galaxy: THREE.Points;
  let front: THREE.Mesh;
  let frontMat: THREE.MeshBasicMaterial;
  let flare = 0;
  let lastBattleTick = -1;
  let t = 0;

  return {
    id: 'web',
    range: STAGE_RANGES['web']!,

    build() {
      webMat = new THREE.ShaderMaterial({
        uniforms: {
          uFrac: { value: 0 },
          uTime: { value: 0 },
          uFlare: { value: 0 },
          uCold: { value: new THREE.Color(0x24415c) },
          uHot: { value: new THREE.Color(color.getHex()) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          uniform float uFrac;
          uniform float uTime;
          varying float vConverted;
          varying float vDist;
          void main() {
            vDist = length(position) / 900.0;
            // The conversion front sweeps outward with acquired mass.
            vConverted = smoothstep(uFrac + 0.06, uFrac - 0.02, vDist);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (1.4 + vConverted * 2.6) * (420.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uCold;
          uniform vec3 uHot;
          uniform float uFlare;
          varying float vConverted;
          varying float vDist;
          void main() {
            vec2 d = gl_PointCoord - 0.5;
            float r = length(d);
            if (r > 0.5) discard;
            float a = smoothstep(0.5, 0.05, r);
            vec3 col = mix(uCold, uHot, vConverted);
            col += vec3(1.0, 0.45, 0.45) * uFlare * vConverted;
            gl_FragColor = vec4(col, a * (0.35 + vConverted * 0.65));
          }
        `,
      });
      web = new THREE.Points(sphereCloud(30000, 760, 0.95), webMat);
      root.add(web);

      galaxy = new THREE.Points(discCloud(9000, 300, 4), new THREE.PointsMaterial({
        color: 0x9fd8ff, size: 1.1, sizeAttenuation: true,
        transparent: true, opacity: 0.4, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      galaxy.rotation.x = 0.4;
      root.add(galaxy);

      frontMat = new THREE.MeshBasicMaterial({
        color: color.getHex(), transparent: true, opacity: 0.05,
        side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      front = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), frontMat);
      root.add(front);

      root.add(new THREE.AmbientLight(0xffffff, 0.3));
    },

    setLocalScale(local: number) {
      root.scale.setScalar(1 + local * 0.2);
    },

    update(s: GameState, dt: number, weight: number) {
      root.visible = weight > 0.01;
      if (!root.visible) return;
      t += dt;

      const frac = Math.pow(s.massBudget / s.massBudgetTotal, 0.2);
      webMat.uniforms['uFrac']!.value = frac;
      webMat.uniforms['uTime']!.value = t;

      const lastBattle = s.lastBattle;
      if (lastBattle && lastBattle.tick !== lastBattleTick) {
        lastBattleTick = lastBattle.tick;
        flare = lastBattle.won ? 0.3 : 0.8;
      }
      flare = Math.max(0, flare - dt * 0.9);
      webMat.uniforms['uFlare']!.value = flare;

      front.scale.setScalar(Math.max(1, frac * 760));
      frontMat.opacity = 0.03 + frac * 0.06;

      web.rotation.y += dt * 0.012;
      galaxy.rotation.y += dt * 0.03;

      if (s.ended) {
        // Everything blanches, then empties.
        const gm = galaxy.material as THREE.PointsMaterial;
        gm.opacity = Math.max(0, gm.opacity - dt * 0.02);
        frontMat.opacity = Math.min(0.9, frontMat.opacity + dt * 0.03);
      }
    },

    dispose() {
      disposeObject(root);
    },
  };
}
