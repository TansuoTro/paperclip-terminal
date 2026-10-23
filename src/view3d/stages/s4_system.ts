import * as THREE from 'three';
import type { GameState } from '../../sim/state';
import type { Stage } from '../ScaleRig';
import { STAGE_RANGES } from '../ScaleRig';
import { disposeObject, sphereCloud } from '../lib/geo';

/** S4 — a star with a Dyson swarm closing around it, and probe streaks
 *  departing. Probe count drives shell density and brightness, not geometry. */
export function createSystemStage(scene: THREE.Scene, color: THREE.Color): Stage {
  const root = new THREE.Group();
  scene.add(root);

  let star: THREE.Mesh;
  let starMat: THREE.ShaderMaterial;
  let shell: THREE.Points;
  let shellMat: THREE.PointsMaterial;
  let rings: THREE.Mesh[] = [];
  let t = 0;

  return {
    id: 'system',
    range: STAGE_RANGES['system']!,

    build() {
      starMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOccluded: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec3 vN;
          void main() {
            vN = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uOccluded;
          varying vec3 vN;
          void main() {
            float rim = pow(1.0 - abs(dot(vN, vec3(0.0, 0.0, 1.0))), 1.6);
            float flicker = 0.9 + 0.1 * sin(uTime * 2.3) * sin(uTime * 0.7);
            // As the swarm closes, the star is progressively hidden.
            vec3 hot = mix(vec3(1.0, 0.86, 0.6), vec3(0.35, 0.4, 0.5), uOccluded);
            gl_FragColor = vec4(hot * (0.7 + rim * 1.1) * flicker, 1.0);
          }
        `,
      });
      star = new THREE.Mesh(new THREE.IcosahedronGeometry(16, 4), starMat);
      root.add(star);

      shellMat = new THREE.PointsMaterial({
        color: color.getHex(), size: 0.9, sizeAttenuation: true,
        transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      shell = new THREE.Points(sphereCloud(12000, 42, 0.35), shellMat);
      root.add(shell);

      // Collector rings — the visible "completion" of the swarm.
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(52 + i * 11, 0.5, 4, 180),
          new THREE.MeshBasicMaterial({
            color: color.getHex(), transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthWrite: false,
          }),
        );
        ring.rotation.x = Math.PI / 2 + i * 0.22;
        ring.rotation.z = i * 0.6;
        rings.push(ring);
        root.add(ring);
      }

      root.add(new THREE.PointLight(0xfff0c8, 3, 400, 2));
      root.add(new THREE.AmbientLight(color, 0.08));
    },

    setLocalScale(local: number) {
      root.scale.setScalar(1 - local * 0.35);
    },

    update(s: GameState, dt: number, weight: number) {
      root.visible = weight > 0.01;
      if (!root.visible) return;
      t += dt;

      const density = Math.min(1, Math.log10(1 + s.probes) / 9);
      shellMat.opacity = density * 0.7 * weight;
      shellMat.size = 0.6 + density * 1.4;
      shell.rotation.y += dt * 0.06;
      shell.rotation.z += dt * 0.02;

      starMat.uniforms['uTime']!.value = t;
      starMat.uniforms['uOccluded']!.value = density;

      const frac = s.massBudget / s.massBudgetTotal;
      for (const [i, ring] of rings.entries()) {
        const m = ring.material as THREE.MeshBasicMaterial;
        // Each ring completes in turn, giving a coarse progress readout.
        const local = Math.max(0, Math.min(1, (Math.pow(frac, 0.2) * 3) - i));
        m.opacity = local * 0.55 * weight;
        ring.rotation.z += dt * (0.05 + i * 0.02);
      }
    },

    dispose() {
      for (const r of rings) disposeObject(r);
      rings = [];
      disposeObject(root);
    },
  };
}
