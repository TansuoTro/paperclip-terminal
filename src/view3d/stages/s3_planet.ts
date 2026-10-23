import * as THREE from 'three';
import type { GameState } from '../../sim/state';
import { planetDepletion } from '../../sim/systems/planet';
import type { Stage } from '../ScaleRig';
import { STAGE_RANGES } from '../ScaleRig';
import { disposeObject, sphereCloud } from '../lib/geo';

const R = 60;

/** S3 — the planet, whose surface bleaches from blue-green to grey-white as
 *  its mass is drawn down. The depletion is the texture. */
export function createPlanetStage(scene: THREE.Scene, color: THREE.Color): Stage {
  const root = new THREE.Group();
  scene.add(root);

  let globe: THREE.Mesh;
  let mat: THREE.ShaderMaterial;
  let swarmPts: THREE.Points;
  let sun: THREE.DirectionalLight;
  let t = 0;

  return {
    id: 'planet',
    range: STAGE_RANGES['planet']!,

    build() {
      mat = new THREE.ShaderMaterial({
        uniforms: {
          uDepleted: { value: 0 },
          uTime: { value: 0 },
          uLive: { value: new THREE.Color(0x1d6b52) },
          uDead: { value: new THREE.Color(0xb9bcc0) },
          uGlow: { value: new THREE.Color(color.getHex()) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vN;
          varying vec3 vPos;
          void main() {
            vN = normalize(normalMatrix * normal);
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uDepleted;
          uniform float uTime;
          uniform vec3 uLive;
          uniform vec3 uDead;
          uniform vec3 uGlow;
          varying vec3 vN;
          varying vec3 vPos;

          // Cheap value noise — enough to break up the terminator line.
          float hash(vec3 p) {
            return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          }
          float noise(vec3 p) {
            vec3 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                              mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                              mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
            return a;
          }

          void main() {
            float n = noise(normalize(vPos) * 3.5);
            // Consumption eats the surface in patches, not uniformly.
            float eaten = smoothstep(n - 0.25, n + 0.25, uDepleted);
            vec3 base = mix(uLive, uDead, eaten);

            float lambert = max(0.0, dot(vN, normalize(vec3(0.6, 0.5, 0.8))));
            float rim = pow(1.0 - max(0.0, dot(vN, vec3(0.0, 0.0, 1.0))), 2.5);

            vec3 col = base * (0.18 + lambert * 0.95) + uGlow * rim * 0.45;
            // Industrial glow on the consumed side.
            col += uGlow * eaten * 0.18 * (0.6 + 0.4 * sin(uTime * 0.6 + n * 20.0));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      });

      globe = new THREE.Mesh(new THREE.IcosahedronGeometry(R, 5), mat);
      root.add(globe);

      // Orbiting harvester swarm — a point cloud, never individual objects.
      const cloud = sphereCloud(4000, R * 1.12, 0.1);
      swarmPts = new THREE.Points(cloud, new THREE.PointsMaterial({
        color: 0xff8a5c, size: 0.5, sizeAttenuation: true,
        transparent: true, opacity: 0.0, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      root.add(swarmPts);

      sun = new THREE.DirectionalLight(0xffffff, 1.4);
      sun.position.set(120, 80, 160);
      root.add(sun);
      root.add(new THREE.AmbientLight(color, 0.1));
    },

    setLocalScale(local: number) {
      // Pulling back from surface-grazing to the full disc.
      root.scale.setScalar(1 - local * 0.25);
    },

    update(s: GameState, dt: number, weight: number) {
      root.visible = weight > 0.01;
      if (!root.visible) return;
      t += dt;

      mat.uniforms['uDepleted']!.value = planetDepletion(s);
      mat.uniforms['uTime']!.value = t;
      globe.rotation.y += dt * 0.035;

      const pm = swarmPts.material as THREE.PointsMaterial;
      // Swarm density is expressed as opacity, not as more points.
      pm.opacity = Math.min(0.85, Math.log10(1 + s.harvesters) / 3.2) * weight;
      swarmPts.rotation.y -= dt * 0.12;
      swarmPts.rotation.x += dt * 0.03;
    },

    dispose() {
      disposeObject(root);
    },
  };
}
