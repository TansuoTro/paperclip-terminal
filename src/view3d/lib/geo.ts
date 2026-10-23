import * as THREE from 'three';

/** Hard cap on instanced objects per stage. Beyond this, growth is expressed
 *  through shader density/emissive instead of more geometry — the player
 *  perceives "more", the GPU does not. */
export const INSTANCE_CAP = 20000;

export function phosphorMaterial(color: THREE.ColorRepresentation, emissive = 0.6): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color).multiplyScalar(emissive),
    roughness: 0.55,
    metalness: 0.35,
  });
}

export function wireMaterial(color: THREE.ColorRepresentation, opacity = 0.5): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity });
}

/** Lay out n instances on a grid, returning how many were actually placed. */
export function gridLayout(
  mesh: THREE.InstancedMesh, n: number, spacing: number, jitter = 0,
  seedFn: (i: number) => number = (i) => frac(i * 0.61803398875),
): number {
  const count = Math.min(n, mesh.count);
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const cx = (i % cols) - (cols - 1) / 2;
    const cz = Math.floor(i / cols) - (Math.ceil(count / cols) - 1) / 2;
    const jx = jitter ? (seedFn(i) - 0.5) * jitter : 0;
    const jz = jitter ? (seedFn(i + 7919) - 0.5) * jitter : 0;
    m.makeTranslation(cx * spacing + jx, 0, cz * spacing + jz);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return count;
}

function frac(x: number): number {
  return x - Math.floor(x);
}

/** Deterministic point cloud on a sphere shell, for star/probe fields. */
export function sphereCloud(count: number, radius: number, thickness = 0.2): THREE.BufferGeometry {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Fibonacci sphere — even coverage without random clumping.
    const y = 1 - (i / Math.max(1, count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * 2.399963229728653;
    const rr = radius * (1 + (frac(i * 0.7548776662) - 0.5) * thickness);
    pos[i * 3] = Math.cos(theta) * r * rr;
    pos[i * 3 + 1] = y * rr;
    pos[i * 3 + 2] = Math.sin(theta) * r * rr;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

/** Flat disc cloud with spiral bias, for galaxy fields. */
export function discCloud(count: number, radius: number, arms = 3): THREE.BufferGeometry {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count);
    const r = Math.pow(t, 0.6) * radius;
    const arm = (i % arms) / arms * Math.PI * 2;
    const theta = arm + r * 0.0009 + (frac(i * 0.381966) - 0.5) * 0.7;
    pos[i * 3] = Math.cos(theta) * r;
    pos[i * 3 + 1] = (frac(i * 0.7548776662) - 0.5) * radius * 0.06;
    pos[i * 3 + 2] = Math.sin(theta) * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
    mesh.geometry?.dispose();
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
  root.parent?.remove(root);
}

/** A paperclip silhouette as an extruded rounded path — the game's one icon. */
export function paperclipGeometry(scale = 1): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const seg = 36;
  const outer = 0.5 * scale;
  const inner = 0.26 * scale;
  const len = 1.4 * scale;

  for (let i = 0; i <= seg; i++) {
    const a = Math.PI * (i / seg) - Math.PI / 2;
    pts.push(new THREE.Vector3(Math.cos(a) * outer, len / 2 + Math.sin(a) * outer * 0.4, 0));
  }
  pts.push(new THREE.Vector3(-outer, -len / 2, 0));
  for (let i = 0; i <= seg; i++) {
    const a = Math.PI * (i / seg) + Math.PI / 2;
    pts.push(new THREE.Vector3(Math.cos(a) * inner, -len / 2 + Math.sin(a) * inner * 0.4, 0));
  }
  pts.push(new THREE.Vector3(inner, len / 2 - outer * 0.5, 0));

  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
  return new THREE.TubeGeometry(curve, 96, 0.045 * scale, 6, false);
}
