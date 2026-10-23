import * as THREE from 'three';
import type { GameState } from '../../sim/state';
import { effectiveRate } from '../../sim/systems/production';
import type { Stage } from '../ScaleRig';
import { STAGE_RANGES } from '../ScaleRig';
import { disposeObject, gridLayout, paperclipGeometry, phosphorMaterial } from '../lib/geo';

const MAX_MACHINES = 400;
const MAX_CLIPS = 2000;

/** S1 — a bench lamp, a spool of wire, and a bending machine that multiplies
 *  into an array as autoclippers are bought. */
export function createBenchStage(scene: THREE.Scene, color: THREE.Color): Stage {
  const root = new THREE.Group();
  scene.add(root);

  let machines: THREE.InstancedMesh;
  let clips: THREE.InstancedMesh;
  let spool: THREE.Mesh;
  let lamp: THREE.PointLight;
  let arms: THREE.InstancedMesh;
  let phase = 0;
  let placedMachines = 0;

  return {
    id: 'bench',
    range: STAGE_RANGES['bench']!,

    build() {
      // Bench surface
      const deskGeo = new THREE.BoxGeometry(14, 0.3, 10);
      const desk = new THREE.Mesh(deskGeo, new THREE.MeshStandardMaterial({
        color: 0x0a0a0a, roughness: 0.9, metalness: 0.1,
      }));
      desk.position.y = -0.15;
      root.add(desk);
      const grid = new THREE.GridHelper(14, 14, 0x174b30, 0x0c2418);
      grid.position.y = .01; root.add(grid);

      // Machine bodies
      const bodyGeo = new THREE.BoxGeometry(0.5, 0.34, 0.5);
      machines = new THREE.InstancedMesh(bodyGeo, phosphorMaterial(0x9ab5a5, 0.3), MAX_MACHINES);
      machines.frustumCulled = false;
      machines.count = 0;
      root.add(machines);

      // Bending arms — animated separately so the motion reads at a glance
      const armGeo = new THREE.BoxGeometry(0.07, 0.07, 0.42);
      arms = new THREE.InstancedMesh(armGeo, phosphorMaterial(color, 1.1), MAX_MACHINES);
      arms.frustumCulled = false;
      arms.count = 0;
      root.add(arms);

      // Wire spool
      spool = new THREE.Mesh(
        new THREE.TorusGeometry(0.85, 0.3, 10, 28),
        new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.4, metalness: 0.85 }),
      );
      spool.rotation.x = Math.PI / 2;
      spool.position.set(-4.6, 0.32, 1.4);
      root.add(spool);

      // Finished clips in a heap
      clips = new THREE.InstancedMesh(paperclipGeometry(0.4), phosphorMaterial(0xcfd8e3, 0.18), MAX_CLIPS);
      clips.frustumCulled = false;
      clips.count = 0;
      root.add(clips);

      lamp = new THREE.PointLight(color, 9, 18, 2);
      lamp.position.set(-1.6, 3.4, 1.8);
      root.add(lamp);
      root.add(new THREE.AmbientLight(0xc0e0cc, 0.8));
    },

    setLocalScale(t: number) {
      // Camera is driven by the renderer; the stage only scales its own detail.
      root.position.y = -t * 0.6;
    },

    update(s: GameState, dt: number, weight: number) {
      root.visible = weight > 0.01;
      if (!root.visible) return;

      const want = Math.min(MAX_MACHINES, Math.max(1, s.autoclippers + s.megaclippers * 4));
      if (want !== placedMachines) {
        machines.count = want;
        arms.count = want;
        placedMachines = gridLayout(machines, want, 0.78, 0.05);
        gridLayout(arms, want, 0.78, 0.05);
      }

      // Arm stroke frequency maps to production rate, capped so it never
      // strobes: past ~8/s the motion is a blur anyway.
      const rate = effectiveRate(s);
      phase += dt * Math.min(8, 1 + rate * 0.4) * Math.PI * 2;

      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < arms.count; i++) {
        machines.getMatrixAt(i, m);
        pos.setFromMatrixPosition(m);
        const local = Math.sin(phase + i * 0.7);
        q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), local * 0.5);
        pos.y += 0.3;
        pos.z += 0.22;
        m.compose(pos, q, scl);
        arms.setMatrixAt(i, m);
      }
      arms.instanceMatrix.needsUpdate = true;

      // Clip heap grows with unsold inventory, logarithmically.
      const heap = Math.min(MAX_CLIPS, Math.floor(Math.log10(1 + s.unsoldClips) * 420));
      if (heap !== clips.count) {
        clips.count = heap;
        const hm = new THREE.Matrix4();
        const hq = new THREE.Quaternion();
        const hp = new THREE.Vector3();
        const hs = new THREE.Vector3(1, 1, 1);
        for (let i = 0; i < heap; i++) {
          const a = i * 2.399963229728653;
          const r = Math.sqrt(i / heap) * 1.5;
          hp.set(4.4 + Math.cos(a) * r, 0.04 + (i % 7) * 0.012, 1.2 + Math.sin(a) * r);
          hq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
          hm.compose(hp, hq, hs);
          clips.setMatrixAt(i, hm);
        }
        clips.instanceMatrix.needsUpdate = true;
      }

      spool.rotation.z += dt * Math.min(6, rate * 0.25);
      lamp.intensity = 7 + Math.sin(phase * 0.08) * 1.2;
      machines.visible = weight > 0.05;
    },

    dispose() {
      disposeObject(root);
    },
  };
}
