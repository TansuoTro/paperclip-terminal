import * as THREE from 'three';
import type { GameState } from '../../sim/state';
import { powerFactor } from '../../sim/systems/energy';
import { effectiveRate } from '../../sim/systems/production';
import type { Stage } from '../ScaleRig';
import { STAGE_RANGES } from '../ScaleRig';
import { disposeObject, gridLayout, phosphorMaterial } from '../lib/geo';

const MAX_HALLS = 1200;
const MAX_TOWERS = 600;

/** S2 — factory halls spreading across a plain, with solar towers and
 *  harvester rigs appearing as those systems come online. */
export function createWorksStage(scene: THREE.Scene, color: THREE.Color): Stage {
  const root = new THREE.Group();
  scene.add(root);

  let halls: THREE.InstancedMesh;
  let towers: THREE.InstancedMesh;
  let rigs: THREE.InstancedMesh;
  let ground: THREE.Mesh;
  let haze: THREE.PointLight;
  let placedHalls = -1;
  let placedTowers = -1;
  let placedRigs = -1;
  let t = 0;

  return {
    id: 'works',
    range: STAGE_RANGES['works']!,

    build() {
      ground = new THREE.Mesh(
        new THREE.PlaneGeometry(900, 900, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x07090b, roughness: 1, metalness: 0 }),
      );
      ground.rotation.x = -Math.PI / 2;
      root.add(ground);

      halls = new THREE.InstancedMesh(
        new THREE.BoxGeometry(7, 2.2, 14),
        phosphorMaterial(color, 0.2),
        MAX_HALLS,
      );
      halls.frustumCulled = false;
      halls.count = 0;
      root.add(halls);

      towers = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.25, 0.6, 9, 6),
        phosphorMaterial(0xffc978, 0.8),
        MAX_TOWERS,
      );
      towers.frustumCulled = false;
      towers.count = 0;
      root.add(towers);

      rigs = new THREE.InstancedMesh(
        new THREE.ConeGeometry(2.4, 5, 5),
        phosphorMaterial(0xff8a5c, 0.5),
        MAX_TOWERS,
      );
      rigs.frustumCulled = false;
      rigs.count = 0;
      root.add(rigs);

      haze = new THREE.PointLight(color, 5, 300, 2);
      haze.position.set(0, 60, 0);
      root.add(haze);
      root.add(new THREE.AmbientLight(color, 0.2));
      root.add(new THREE.HemisphereLight(color, 0x000000, 0.25));
    },

    setLocalScale(local: number) {
      // Halls spread out as the camera climbs, so density stays readable.
      root.scale.setScalar(1 + local * 0.4);
    },

    update(s: GameState, dt: number, weight: number) {
      root.visible = weight > 0.01;
      if (!root.visible) return;
      t += dt;

      const hallCount = Math.min(MAX_HALLS, Math.max(1, Math.floor(Math.log10(1 + s.megaclippers * 10 + s.autoclippers) * 180)));
      if (hallCount !== placedHalls) {
        halls.count = hallCount;
        placedHalls = gridLayout(halls, hallCount, 22, 5);
        offsetY(halls, hallCount, 1.1);
      }

      const towerCount = Math.min(MAX_TOWERS, s.solarFarms);
      if (towerCount !== placedTowers) {
        towers.count = towerCount;
        placedTowers = gridLayout(towers, towerCount, 14, 3);
        offsetXY(towers, towerCount, 170, 4.5);
      }

      const rigCount = Math.min(MAX_TOWERS, s.harvesters);
      if (rigCount !== placedRigs) {
        rigs.count = rigCount;
        placedRigs = gridLayout(rigs, rigCount, 18, 4);
        offsetXY(rigs, rigCount, -170, 2.5);
      }

      // Brightness is the honest readout: a browned-out factory looks dim.
      const pf = powerFactor(s);
      const mat = halls.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.3 + pf * 0.9;
      haze.intensity = 3 + pf * 5 + Math.sin(t * 0.3) * 0.6;

      const rate = effectiveRate(s);
      const tmat = towers.material as THREE.MeshStandardMaterial;
      tmat.emissiveIntensity = 0.4 + Math.min(1, Math.log10(1 + rate) / 6);
    },

    dispose() {
      disposeObject(root);
    },
  };
}

function offsetY(mesh: THREE.InstancedMesh, n: number, y: number): void {
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    mesh.getMatrixAt(i, m);
    m.elements[13] = (m.elements[13] ?? 0) + y;
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function offsetXY(mesh: THREE.InstancedMesh, n: number, x: number, y: number): void {
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    mesh.getMatrixAt(i, m);
    m.elements[12] = (m.elements[12] ?? 0) + x;
    m.elements[13] = (m.elements[13] ?? 0) + y;
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
}
