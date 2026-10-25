/**
 * Full-viewport three.js layer for the sprinkles.
 *
 * The rocket's own canvas travels with it, so a burst left behind on launch
 * would be clipped; these get a fixed canvas of their own instead. The camera
 * is set so the z = 0 plane maps 1:1 onto viewport pixels: a sprinkle spawned
 * at (clientX, clientY) lands exactly there, then flies toward or away from
 * the viewer as well as falling, so perspective sizes it and bends its path.
 * Every sprinkle has the same world size; depth alone varies it.
 */
import * as THREE from 'three';

const MAX = 256;
const SPREAD = 30;
const DRIFT_X_RANGE = 150;
const DRIFT_Z_RANGE = 600;
const FALL_MIN = 100;
const FALL_RANGE = 300;
const MIN_DURATION = 0.5;
const DURATION_RANGE = 0.7;
/** Sprite diameter in px at z = 0: a 3px core inside a soft halo. */
const SIZE = 12;
const FOV = 30;

export interface SprinkleField {
  canvas: HTMLCanvasElement;
  /** One sprinkle at viewport px (x, y). */
  spawn(x: number, y: number): void;
  /** light: paint instead of adding, which would vanish on a pale sky. */
  setTheme(color: string, light: boolean): void;
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
    // Shrinks to nothing over its life, as the CSS scale(1 -> 0) did.
    gl_PointSize = aAge >= 1.0 ? 0.0 : ${SIZE.toFixed(1)} * (1.0 - aAge) * uProjScale / -mv.z;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAge;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = 1.0 - smoothstep(0.2, 0.3, d);
    float halo = 0.6 * exp(-d * d * 6.0);
    gl_FragColor = vec4(uColor, max(core, halo) * (1.0 - vAge));
  }
`;

export function createSprinkleField(): SprinkleField {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 10000);

  const pos = new Float32Array(MAX * 3);
  const ageAttr = new Float32Array(MAX).fill(1);
  const start = new Float32Array(MAX * 3);
  const drift = new Float32Array(MAX * 3);
  const age = new Float32Array(MAX).fill(1); // >= 1 is dead
  const life = new Float32Array(MAX).fill(1);

  const geometry = new THREE.BufferGeometry();
  const posBuf = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const ageBuf = new THREE.BufferAttribute(ageAttr, 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', posBuf);
  geometry.setAttribute('aAge', ageBuf);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uProjScale: { value: 1 },
      uColor: { value: new THREE.Color('white') },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  // World y is up, viewport y is down: a viewport point (x, y) sits at
  // world (x, -y, 0).
  const layout = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const dist = h / 2 / tan;
    camera.aspect = w / h;
    camera.position.set(w / 2, -h / 2, dist);
    camera.lookAt(w / 2, -h / 2, 0);
    camera.updateProjectionMatrix();
    material.uniforms.uProjScale.value = (h * renderer.getPixelRatio()) / (2 * tan);
  };
  layout();
  window.addEventListener('resize', layout);

  let alive = 0;
  let cursor = 0;
  let raf = 0;
  let last = 0;

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    alive = 0;
    for (let i = 0; i < MAX; i++) {
      if (age[i] >= 1) {
        ageAttr[i] = 1;
        continue;
      }
      age[i] = Math.min(1, age[i] + dt / life[i]);
      const u = age[i];
      const j = i * 3;
      pos[j] = start[j] + drift[j] * u;
      // A touch of gravity: the fall gathers pace instead of gliding.
      pos[j + 1] = start[j + 1] + drift[j + 1] * (0.4 * u + 0.6 * u * u);
      pos[j + 2] = start[j + 2] + drift[j + 2] * u;
      ageAttr[i] = u;
      if (u < 1) alive++;
    }
    posBuf.needsUpdate = true;
    ageBuf.needsUpdate = true;
    renderer.render(scene, camera);

    // Sleep while nothing is in flight; the last render cleared the canvas.
    raf = alive > 0 ? requestAnimationFrame(frame) : 0;
  };

  return {
    canvas: renderer.domElement,
    spawn: (x, y) => {
      let i = cursor;
      for (let n = 0; n < MAX && age[i] < 1; n++) i = (i + 1) % MAX;
      cursor = (i + 1) % MAX;

      const j = i * 3;
      start[j] = x + (Math.random() - 0.5) * SPREAD;
      start[j + 1] = -(y + (Math.random() - 0.5) * SPREAD);
      start[j + 2] = 0;
      drift[j] = (Math.random() - 0.5) * DRIFT_X_RANGE;
      drift[j + 1] = -(Math.random() * FALL_RANGE + FALL_MIN);
      drift[j + 2] = (Math.random() - 0.5) * DRIFT_Z_RANGE;
      age[i] = 0;
      life[i] = Math.random() * DURATION_RANGE + MIN_DURATION;

      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
    setTheme: (color, light) => {
      material.uniforms.uColor.value.set(color);
      material.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
      material.needsUpdate = true;
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', layout);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
