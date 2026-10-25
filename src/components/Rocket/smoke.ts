/**
 * Engine smoke, emitted in the rocket's own 3D space.
 *
 * Soft point sprites that leave the nozzle along the rocket's lean, spread in
 * x and z, and swell as they fade, so perspective — not random sizing — is
 * what makes near puffs bigger than far ones. The cloud is screen-anchored:
 * the canvas rides on the DOM rocket as it floats and glides, so setAnchor
 * shifts the cloud back by the same amount and released puffs stay where
 * they were let go, as the old DOM puffs did.
 */
import * as THREE from 'three';

const MAX = 32;
const EMIT_EVERY = 0.12; // s
/** Diameter at birth in world units; a puff grows 4x over its life. */
const SIZE = 0.34;
const OPACITY = 0.08;

export interface Smoke {
  root: THREE.Points;
  /** Offset, in world units, that cancels the DOM box's movement since the
   *  first frame. */
  setAnchor(x: number, y: number): void;
  /** Framebuffer px per world unit at view distance 1. */
  setProjScale(s: number): void;
  /** emitter: the leaning rocket root; nozzleY in its local space. */
  update(dt: number, emitting: boolean, emitter: THREE.Object3D, nozzleY: number): void;
  dispose(): void;
}

const vertexShader = /* glsl */ `
  uniform float uProjScale;
  attribute float aAge;
  varying float vAge;

  void main() {
    vAge = aAge;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = ${SIZE.toFixed(2)} * mix(0.5, 2.0, aAge);
    gl_PointSize = aAge >= 1.0 ? 0.0 : size * uProjScale / -mv.z;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAge;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float soft = 1.0 - smoothstep(0.35, 1.0, d);
    gl_FragColor = vec4(uColor, uOpacity * soft * (1.0 - vAge));
  }
`;

export function createSmoke(): Smoke {
  const pos = new Float32Array(MAX * 3);
  const ageAttr = new Float32Array(MAX).fill(1);
  const start = new Float32Array(MAX * 3);
  const drift = new Float32Array(MAX * 3);
  const age = new Float32Array(MAX).fill(1); // seconds lived / life; >= 1 is dead
  const life = new Float32Array(MAX).fill(1);

  const geometry = new THREE.BufferGeometry();
  const posBuf = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const ageBuf = new THREE.BufferAttribute(ageAttr, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', posBuf);
  geometry.setAttribute('aAge', ageBuf);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uProjScale: { value: 1 },
      uColor: { value: new THREE.Color(0.69, 0.69, 0.73) },
      uOpacity: { value: OPACITY },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });

  const root = new THREE.Points(geometry, material);
  // Puffs live anywhere in the canvas; the bounds computed from the initial
  // zeros would cull them.
  root.frustumCulled = false;
  // Under the plume, which should burn through the smoke it makes.
  root.renderOrder = 1;

  let acc = 0;
  const p = new THREE.Vector3();
  const d = new THREE.Vector3();
  const q = new THREE.Quaternion();

  const spawn = (emitter: THREE.Object3D, nozzleY: number) => {
    let i = 0;
    while (i < MAX && age[i] < 1) i++;
    if (i === MAX) return;

    p.set((Math.random() - 0.5) * 0.45, nozzleY - 0.1, (Math.random() - 0.5) * 0.45);
    emitter.localToWorld(p).sub(root.position);
    // Mostly down the rocket's axis, with as much spread in depth as across.
    d.set((Math.random() - 0.5) * 1.8, -(Math.random() * 2.7 + 1.3), (Math.random() - 0.5) * 1.8);
    d.applyQuaternion(emitter.getWorldQuaternion(q));

    p.toArray(start, i * 3);
    d.toArray(drift, i * 3);
    age[i] = 0;
    life[i] = Math.random() * 1.5 + 1;
  };

  return {
    root,
    setAnchor: (x, y) => root.position.set(x, y, 0),
    setProjScale: (s) => {
      material.uniforms.uProjScale.value = s;
    },
    update: (dt, emitting, emitter, nozzleY) => {
      if (emitting) {
        emitter.updateWorldMatrix(true, false);
        acc += dt;
        while (acc >= EMIT_EVERY) {
          acc -= EMIT_EVERY;
          spawn(emitter, nozzleY);
        }
      } else {
        acc = 0;
      }

      for (let i = 0; i < MAX; i++) {
        if (age[i] >= 1) {
          ageAttr[i] = 1;
          continue;
        }
        age[i] = Math.min(1, age[i] + dt / life[i]);
        // Ease-out, like the CSS drift it replaces.
        const e = 1 - (1 - age[i]) * (1 - age[i]);
        for (let k = 0; k < 3; k++) pos[i * 3 + k] = start[i * 3 + k] + drift[i * 3 + k] * e;
        ageAttr[i] = age[i];
      }
      posBuf.needsUpdate = true;
      ageBuf.needsUpdate = true;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
