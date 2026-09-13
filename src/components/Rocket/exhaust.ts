/**
 * Shader-driven engine plume.
 *
 * One additive quad hanging under the nozzle. The fragment shader builds the
 * flame from scrolling fbm noise: a narrow white core, an amber body that
 * widens and frays as it falls away, mach diamonds just under the throat, and
 * a cool tail that dissolves into nothing. Thrust drives length, width and
 * brightness, so the same material covers the idle burn and the launch.
 */
import * as THREE from 'three';

const PLUME_W = 4.2;
const PLUME_H = 16;

export interface ExhaustColors {
  core: string;
  mid: string;
  tail: string;
}

export interface Exhaust {
  mesh: THREE.Mesh;
  setColors(c: ExhaustColors): void;
  /** Additive over a dark sky; normal over a pale one, where adding light
   *  would only wash the plume out. */
  setAdditive(additive: boolean): void;
  /** thrust: 0 idle .. 1 launch. boost: extra length while hovered. */
  update(time: number, thrust: number, boost: number): void;
  dispose(): void;
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uThrust;
  uniform float uBoost;
  uniform float uOpacity;
  uniform vec3 uCore;
  uniform vec3 uMid;
  uniform vec3 uTail;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  // Value noise - smooth enough for flame, far cheaper than gradient noise.
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float t = vUv.y;                 // 0 at the nozzle, 1 at the far tail
    float x = vUv.x - 0.5;

    // How far the plume reaches before it dissolves.
    float len = mix(0.3, 0.72, uThrust) + 0.1 * uBoost;
    float nt = t / max(len, 0.001);  // 0..1 along the visible plume

    // Exhaust accelerates as it leaves the throat, so the noise scrolls faster
    // further down and the column shears instead of sliding rigidly. Close to
    // the throat the flow is still laminar, so the turbulence ramps in.
    float flow = uTime * (1.6 + 2.4 * uThrust);
    float turb = fbm(vec2(x * 6.0, t * 4.0 - flow)) - 0.5;
    turb *= smoothstep(0.02, 0.4, nt) * (0.06 + 0.3 * nt);

    // The column leaves the bell at roughly the nozzle's own width, then opens.
    float w = (0.175 + 0.28 * pow(nt, 0.85)) * (0.9 + 0.25 * uThrust);

    float d = abs(x + turb);
    float body = smoothstep(w, w * 0.5, d);

    // Fine-grain noise so the edge frays into the dark instead of ending on a
    // clean cone.
    float fray = fbm(vec2(x * 15.0, t * 9.0 - flow * 1.7));
    body *= 0.72 + 0.56 * fray;
    float core = smoothstep(w * 0.45, 0.0, d) * (1.0 - smoothstep(0.05, 0.6, nt));

    // Tail-off, plus a hard cut at the nozzle so the flame starts flat.
    float fade = 1.0 - smoothstep(0.35, 1.0, nt);
    fade *= smoothstep(0.0, 0.015, t);

    // Combustion never burns steady.
    float flicker = 0.86 + 0.14 * fbm(vec2(uTime * 3.0, t * 2.0 - flow * 0.5));

    // Mach diamonds: standing shocks in the first stretch under the throat.
    float diamonds =
      pow(max(sin(nt * 62.0 - 1.2), 0.0), 14.0) *
      exp(-nt * 11.0) *
      smoothstep(w * 0.35, 0.0, d) *
      uThrust * 0.55;

    // Hot at the throat, cooling as it falls away.
    vec3 col = mix(uMid, uCore, pow(core, 1.3));
    col = mix(col, uTail, smoothstep(0.15, 0.95, nt));
    col += uCore * diamonds;

    float alpha = body * fade * flicker * (0.5 + 0.5 * uThrust);
    alpha += core * fade * 0.35;

    alpha *= uOpacity;

    if (alpha < 0.003) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export function createExhaust(nozzleY: number, colors: ExhaustColors): Exhaust {
  const geometry = new THREE.PlaneGeometry(PLUME_W, PLUME_H, 1, 1);
  // UV v runs 0 at the nozzle downwards, which is how the shader reads it.
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  uv.needsUpdate = true;

  const uniforms = {
    uTime: { value: 0 },
    uThrust: { value: 0 },
    uBoost: { value: 0 },
    uOpacity: { value: 1 },
    uCore: { value: new THREE.Color(colors.core) },
    uMid: { value: new THREE.Color(colors.mid) },
    uTail: { value: new THREE.Color(colors.tail) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = nozzleY + 0.04 - PLUME_H / 2;
  mesh.renderOrder = 2;

  return {
    mesh,
    setAdditive: (additive) => {
      const next = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      if (material.blending === next) return;
      material.blending = next;
      // Painted rather than added, the plume would otherwise sit on the pale
      // sky as a flat opaque slab.
      uniforms.uOpacity.value = additive ? 1 : 0.62;
      material.needsUpdate = true;
    },
    setColors: (c) => {
      uniforms.uCore.value.set(c.core);
      uniforms.uMid.value.set(c.mid);
      uniforms.uTail.value.set(c.tail);
    },
    update: (time, thrust, boost) => {
      uniforms.uTime.value = time;
      uniforms.uThrust.value = thrust;
      uniforms.uBoost.value = boost;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
