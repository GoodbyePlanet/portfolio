/**
 * The planet: a lit sphere whose surface slowly turns, a crisp atmosphere
 * line right on the limb, and a soft halo above it. Both the line and the
 * halo are measured by how closely each view ray grazes the planet, so they
 * hug the real silhouette from any camera angle. The sun is the rocket's key
 * light, so the bright side of the limb sits where the hull catches light.
 */
import * as THREE from 'three';

export interface EarthColors {
  base: THREE.Color;
  detail: THREE.Color;
  /** The thin limb line. */
  rim: THREE.Color;
  /** The glow above the limb. */
  halo: THREE.Color;
  haloAlpha: number;
}

/** One full turn of the surface pattern, in seconds. */
const SPIN_PERIOD = 900;

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vNormal;

  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// Ray-to-centre distance: how close the view ray through this fragment
// passes to the planet's centre. Equal to the radius on the silhouette.
const graze = /* glsl */ `
  uniform vec3 uCenter;
  uniform float uRadius;
  uniform vec3 uSun;

  float rayGap(vec3 world) {
    vec3 dir = normalize(world - cameraPosition);
    vec3 oc = uCenter - cameraPosition;
    float t = dot(oc, dir);
    return sqrt(max(dot(oc, oc) - t * t, 0.0));
  }

  // Bright toward the day side of the limb, fading out on the night side.
  float dayside(vec3 world) {
    return smoothstep(0.3, 0.85, dot(normalize(world - uCenter), uSun));
  }
`;

const surfaceFragment = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uDetail;
  uniform vec3 uRim;
  uniform vec3 uSpinAxis;
  uniform float uSpin;
  varying vec3 vWorld;
  varying vec3 vNormal;
  ${graze}

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return sum;
  }

  // Rodrigues: turn v about the unit axis k.
  vec3 turn(vec3 v, vec3 k, float a) {
    float c = cos(a);
    float s = sin(a);
    return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
  }

  void main() {
    vec3 n = normalize(vNormal);

    // Large, soft landmasses that drift past as the planet turns.
    vec3 p = turn(n, uSpinAxis, uSpin);
    float land = smoothstep(0.5, 0.62, fbm(p * 2.6 + 3.0));
    vec3 albedo = mix(uBase, uDetail, land);

    // The terminator: night side falls off toward the left of the limb.
    float day = smoothstep(-0.1, 0.9, dot(n, uSun));
    vec3 col = albedo * mix(0.62, 1.12, day);

    // A crisp line of atmosphere a couple of pixels wide right on the limb.
    float gap = rayGap(vWorld);
    float w = fwidth(gap);
    float limb = smoothstep(uRadius - 2.5 * w, uRadius, gap);
    col = mix(col, uRim, limb * mix(0.25, 0.9, dayside(vWorld)));

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const haloFragment = /* glsl */ `
  uniform vec3 uHalo;
  uniform float uHaloAlpha;
  uniform float uThickness;
  varying vec3 vWorld;
  ${graze}

  void main() {
    float x = (rayGap(vWorld) - uRadius) / uThickness;
    if (x < 0.0 || x > 1.0) discard;
    float glow = pow(1.0 - x, 3.0) * mix(0.35, 1.0, dayside(vWorld));
    gl_FragColor = vec4(uHalo, glow * uHaloAlpha);
    #include <colorspace_fragment>
  }
`;

export interface Earth {
  root: THREE.Group;
  /** Radius and centre in world units; halo thickness too. */
  place(radius: number, center: THREE.Vector3, haloThickness: number): void;
  /** Turn the planet about the camera's pivot with the camera itself, so it
   *  holds its place on screen however the view swings. */
  follow(yaw: number, pitch: number): void;
  setColors(c: EarthColors): void;
  update(t: number): void;
  dispose(): void;
}

export function createEarth(sun: THREE.Vector3): Earth {
  const root = new THREE.Group();
  const localCenter = new THREE.Vector3();

  const shared = {
    uCenter: { value: new THREE.Vector3() },
    uRadius: { value: 1 },
    uSun: { value: sun.clone().normalize() },
  };

  // Unit sphere scaled up; 256 segments keep the silhouette's chords well
  // under a pixel off the true circle even at 2.5 viewport-widths across.
  // The pole faces the camera so those segments run along the horizon.
  const geometry = new THREE.SphereGeometry(1, 256, 64);
  geometry.rotateX(Math.PI / 2);

  const surface = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uBase: { value: new THREE.Color() },
      uDetail: { value: new THREE.Color() },
      uRim: { value: new THREE.Color() },
      uSpinAxis: { value: new THREE.Vector3(0, 0.35, 1).normalize() },
      uSpin: { value: 0 },
    },
    vertexShader,
    fragmentShader: surfaceFragment,
  });
  const planet = new THREE.Mesh(geometry, surface);
  planet.renderOrder = 0;
  root.add(planet);

  // The halo is a larger shell drawn from the inside, so every pixel just
  // above the limb is covered exactly once.
  const halo = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uHalo: { value: new THREE.Color() },
      uHaloAlpha: { value: 0 },
      uThickness: { value: 1 },
    },
    vertexShader,
    fragmentShader: haloFragment,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(geometry, halo);
  shell.renderOrder = 2;
  root.add(shell);

  return {
    root,
    place: (radius, center, thickness) => {
      planet.scale.setScalar(radius);
      planet.position.copy(center);
      shell.scale.setScalar(radius + thickness);
      shell.position.copy(center);
      localCenter.copy(center);
      shared.uCenter.value.copy(center).applyEuler(root.rotation);
      shared.uRadius.value = radius;
      halo.uniforms.uThickness.value = thickness;
    },
    follow: (yaw, pitch) => {
      root.rotation.set(-pitch, yaw, 0, 'YXZ');
      shared.uCenter.value.copy(localCenter).applyEuler(root.rotation);
    },
    setColors: (c) => {
      surface.uniforms.uBase.value.copy(c.base);
      surface.uniforms.uDetail.value.copy(c.detail);
      surface.uniforms.uRim.value.copy(c.rim);
      halo.uniforms.uHalo.value.copy(c.halo);
      halo.uniforms.uHaloAlpha.value = c.haloAlpha;
    },
    update: (t) => {
      surface.uniforms.uSpin.value = (t / SPIN_PERIOD) * Math.PI * 2;
    },
    dispose: () => {
      geometry.dispose();
      surface.dispose();
      halo.dispose();
    },
  };
}
