/**
 * The world behind the rocket: one full-viewport three.js scene holding the
 * stars, the Earth, the satellite, the cursor's constellation lines and the
 * 3D positions of the rocket constellation.
 *
 * World units are viewport px on the z = 0 plane, origin at the viewport
 * centre, y up. The camera orbits a pivot at that origin, which is where the
 * rocket sits, so the rocket (drawn in its own canvas) stays put however the
 * camera turns while everything in front of or behind it shifts with depth.
 *
 * The rocket constellation's stars sit at scattered depths, placed so they
 * project onto the outline only from the head-on view. Until the outline is
 * finished the camera looks from off to one side, and every drawn segment
 * turns it closer, so the shape snaps into a rocket on the last click.
 */
import * as THREE from 'three';
import { NAV_STARS, NAV_LABEL_POS } from '../../hooks/useConstellationNav';
import type { MousePos } from '../../hooks/useParallax';
import { createEarth, type EarthColors } from './earth';
import { navScreen, publishNavScreen, horizon } from './sceneBus';

const FOV = 30;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

/** The rocket's key light, so the planet and the hull share one sun. */
export const SUN = new THREE.Vector3(4, 5, 6).normalize();

const STAR_COUNT = 220;
/** Every star is the same size on screen; depth shows only as parallax. */
const STAR_PX = 1.8;
const SATELLITE_PX = 5;

/** Camera offset (degrees) while the constellation is still scattered. */
const SCATTER_YAW = 9;
const SCATTER_PITCH = -2.5;
/** Cursor parallax, degrees at the viewport edge. */
const PARALLAX_YAW = 0.6;
const PARALLAX_PITCH = 0.35;

/** Depth of each rocket-constellation star, as a fraction of the camera
 *  distance: alternating near and far so the scattered view looks random. */
const NAV_DEPTH = [0, 0.2, -0.22, 0.14, -0.16, 0.28, -0.09, 0.16, -0.26, 0.1, -0.19, 0.24, -0.12];

/** Planet centre's depth as a fraction of its radius (+ is toward the camera). */
const EARTH_FORWARD = 0.25;

const CURSOR_RADIUS = 120;
const LINK_RADIUS = 150;
const MAX_LINKS = 8;

interface Layout {
  earthRadius: number;
  /** Viewport fraction where the top of the horizon sits. */
  horizon: number;
}

/** Matches the old CSS planet: 250/300/350vw across, top at 85/75/70%. */
function layoutFor(w: number): Layout {
  if (w <= 480) return { earthRadius: 1.75 * w, horizon: 0.7 };
  if (w <= 768) return { earthRadius: 1.5 * w, horizon: 0.75 };
  return { earthRadius: 1.25 * w, horizon: 0.85 };
}

export interface ThemeColors {
  star: THREE.Color;
  starOpacity: number;
  starPeak: number;
  link: THREE.Color;
  satellite: THREE.Color;
  earth: EarthColors;
  /** Paint instead of adding light (pale sky). */
  light: boolean;
}

const starVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  attribute vec2 aTwinkle; // phase, period (s)
  varying float vTwinkle;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    float w = 0.5 - 0.5 * cos(6.2831853 * (uTime / aTwinkle.y + aTwinkle.x));
    vTwinkle = w;
    gl_PointSize = uSize * (1.0 + 0.3 * w);
  }
`;

const starFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uPeak;
  varying float vTwinkle;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = 1.0 - smoothstep(0.55, 1.0, d);
    if (a <= 0.0) discard;
    gl_FragColor = vec4(uColor, a * mix(uOpacity, uPeak, vTwinkle));
    #include <colorspace_fragment>
  }
`;

const satelliteFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.35, 0.55, d);
    float glow = 0.6 * exp(-d * d * 5.0);
    gl_FragColor = vec4(uColor, max(core, glow) * uOpacity);
    #include <colorspace_fragment>
  }
`;

const satelliteVertex = /* glsl */ `
  uniform float uSize;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize;
  }
`;

export interface World {
  canvas: HTMLCanvasElement;
  /** 0 = constellation scattered, 1 = lined up into the rocket. */
  setAlignment(a: number): void;
  setTheme(colors: ThemeColors): void;
  dispose(): void;
}

interface WorldInputs {
  mouse: () => MousePos | null;
  /** Where the camera starts, without swinging there. */
  alignment: number;
  reduced: boolean;
}

export function createWorld({ mouse, alignment, reduced }: WorldInputs): World {
  let align = alignment;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 30000);

  /* --- stars ----------------------------------------------------- */

  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(STAR_COUNT * 3);
  // Screen position and depth fraction, re-projected into the world on resize.
  const starSeed = new Float32Array(STAR_COUNT * 3);
  const twinkle = new Float32Array(STAR_COUNT * 2);
  for (let i = 0; i < STAR_COUNT; i++) {
    // Wider than the viewport: the camera turns, and the edges must stay full.
    starSeed[i * 3] = -0.25 + Math.random() * 1.5;
    starSeed[i * 3 + 1] = Math.random() * 0.95;
    starSeed[i * 3 + 2] = -(0.08 + Math.random() * 1.3);
    twinkle[i * 2] = Math.random();
    twinkle[i * 2 + 1] = 2 + Math.random() * 3;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkle, 2));
  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: STAR_PX },
      uColor: { value: new THREE.Color() },
      uOpacity: { value: 0.1 },
      uPeak: { value: 0.8 },
    },
    vertexShader: starVertex,
    fragmentShader: starFragment,
    transparent: true,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = 1;
  scene.add(stars);

  /* --- earth + satellite ----------------------------------------- */

  const earth = createEarth(SUN);
  scene.add(earth.root);
  const earthCenter = new THREE.Vector3();
  let earthRadius = 1;

  const satGeo = new THREE.BufferGeometry();
  const satPos = new Float32Array(3);
  satGeo.setAttribute('position', new THREE.BufferAttribute(satPos, 3));
  const satMat = new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: SATELLITE_PX },
      uColor: { value: new THREE.Color() },
      uOpacity: { value: 1 },
    },
    vertexShader: satelliteVertex,
    fragmentShader: satelliteFragment,
    transparent: true,
    depthWrite: false,
  });
  const satellite = new THREE.Points(satGeo, satMat);
  satellite.frustumCulled = false;
  satellite.renderOrder = 3;
  // Rides with the planet, so it shares its orbit around the camera's pivot.
  earth.root.add(satellite);

  /* --- cursor constellation lines -------------------------------- */

  const linkPos = new Float32Array(MAX_LINKS * 2 * 3);
  const linkCol = new Float32Array(MAX_LINKS * 2 * 4);
  const linkGeo = new THREE.BufferGeometry();
  const linkPosBuf = new THREE.BufferAttribute(linkPos, 3).setUsage(THREE.DynamicDrawUsage);
  const linkColBuf = new THREE.BufferAttribute(linkCol, 4).setUsage(THREE.DynamicDrawUsage);
  linkGeo.setAttribute('position', linkPosBuf);
  linkGeo.setAttribute('color', linkColBuf);
  const linkMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  const links = new THREE.LineSegments(linkGeo, linkMat);
  links.frustumCulled = false;
  links.renderOrder = 4;
  scene.add(links);
  let linkColor = new THREE.Color();

  /* --- rocket constellation -------------------------------------- */

  const navWorld = [...NAV_STARS, NAV_LABEL_POS].map(() => new THREE.Vector3());

  /* --- layout ---------------------------------------------------- */

  let w = 0;
  let h = 0;
  let dist = 1;

  // A viewport point at depth z, as seen from the head-on camera.
  const unproject = (sx: number, sy: number, z: number, out: THREE.Vector3) => {
    const k = (dist - z) / dist;
    return out.set((sx - w / 2) * k, (h / 2 - sy) * k, z);
  };

  const layout = () => {
    w = window.innerWidth;
    h = window.innerHeight;
    renderer.setSize(w, h, false);
    dist = h / 2 / TAN;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    for (let i = 0; i < STAR_COUNT; i++) {
      const v = unproject(
        starSeed[i * 3] * w,
        starSeed[i * 3 + 1] * h,
        starSeed[i * 3 + 2] * dist,
        new THREE.Vector3(),
      );
      v.toArray(starPos, i * 3);
    }
    starGeo.attributes.position.needsUpdate = true;
    starMat.uniforms.uSize.value = STAR_PX * renderer.getPixelRatio();
    satMat.uniforms.uSize.value = SATELLITE_PX * renderer.getPixelRatio();

    [...NAV_STARS, NAV_LABEL_POS].forEach((s, i) => {
      const z = (NAV_DEPTH[i] ?? NAV_DEPTH[0]) * dist;
      unproject((s.x / 100) * w, (s.y / 100) * h, z, navWorld[i]);
    });

    // Bring the planet's centre forward of the rocket's plane until the
    // horizon curves about as gently as the old flat disc, then lower it
    // until the top of its silhouette lands on the horizon line.
    const L = layoutFor(w);
    earthRadius = L.earthRadius;
    const cz = EARTH_FORWARD * earthRadius;
    const want = (L.horizon - 0.5) * h; // px below the viewport centre
    let lo = -earthRadius * 4;
    let hi = 0;
    for (let i = 0; i < 40; i++) {
      const cy = (lo + hi) / 2;
      const d = Math.hypot(cy, dist - cz);
      const below = Math.atan2(-cy, dist - cz) - Math.asin(Math.min(1, earthRadius / d));
      if (dist * Math.tan(below) > want) lo = cy;
      else hi = cy;
    }
    earthCenter.set(0, (lo + hi) / 2, cz);
    earth.place(earthRadius, earthCenter, Math.max(36, h * 0.07));
    horizon.y = L.horizon * h;
  };
  layout();
  window.addEventListener('resize', layout);

  /* --- theme ----------------------------------------------------- */

  // Colours ease across the theme switch like the CSS they replaced (0.8s).
  let from: ThemeColors | null = null;
  let to: ThemeColors | null = null;
  let blendStart = 0;
  const cur = {
    star: new THREE.Color(),
    link: new THREE.Color(),
    satellite: new THREE.Color(),
    base: new THREE.Color(),
    detail: new THREE.Color(),
    rim: new THREE.Color(),
    halo: new THREE.Color(),
    haloAlpha: 0,
  };

  const applyTheme = (u: number) => {
    if (!to) return;
    const a = from ?? to;
    const s = u * u * (3 - 2 * u);
    const mix = (x: number, y: number) => x + (y - x) * s;
    cur.star.lerpColors(a.star, to.star, s);
    cur.link.lerpColors(a.link, to.link, s);
    cur.satellite.lerpColors(a.satellite, to.satellite, s);
    cur.base.lerpColors(a.earth.base, to.earth.base, s);
    cur.detail.lerpColors(a.earth.detail, to.earth.detail, s);
    cur.rim.lerpColors(a.earth.rim, to.earth.rim, s);
    cur.halo.lerpColors(a.earth.halo, to.earth.halo, s);
    starMat.uniforms.uColor.value.copy(cur.star);
    starMat.uniforms.uOpacity.value = mix(a.starOpacity, to.starOpacity);
    starMat.uniforms.uPeak.value = mix(a.starPeak, to.starPeak);
    satMat.uniforms.uColor.value.copy(cur.satellite);
    linkColor = cur.link;
    cur.haloAlpha = mix(a.earth.haloAlpha, to.earth.haloAlpha);
    earth.setColors({
      base: cur.base,
      detail: cur.detail,
      rim: cur.rim,
      halo: cur.halo,
      haloAlpha: cur.haloAlpha,
    });
  };

  /* --- camera ---------------------------------------------------- */

  let yaw = 0;
  let pitch = 0;
  let yawVel = 0;
  let pitchVel = 0;
  let par = { x: 0, y: 0 };

  const scatterTarget = () => {
    const off = Math.pow(1 - THREE.MathUtils.clamp(align, 0, 1), 1.2);
    return {
      yaw: THREE.MathUtils.degToRad(SCATTER_YAW) * off,
      pitch: THREE.MathUtils.degToRad(SCATTER_PITCH) * off,
    };
  };

  const placeCamera = () => {
    const y = yaw + par.x;
    const p = pitch + par.y;
    camera.position.set(
      dist * Math.sin(y) * Math.cos(p),
      dist * Math.sin(p),
      dist * Math.cos(y) * Math.cos(p),
    );
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    earth.follow(y, p);
  };

  /* --- per-frame helpers ----------------------------------------- */

  const v = new THREE.Vector3();
  const toScreen = (p: THREE.Vector3, out: { x: number; y: number }) => {
    v.copy(p).project(camera);
    out.x = (v.x + 1) * 0.5 * w;
    out.y = (1 - v.y) * 0.5 * h;
    return v.z < 1;
  };

  const pt = { x: 0, y: 0 };
  const publishNav = () => {
    let moved = false;
    navWorld.forEach((p, i) => {
      toScreen(p, pt);
      if (Math.abs(navScreen[i * 2] - pt.x) > 0.05 || Math.abs(navScreen[i * 2 + 1] - pt.y) > 0.05) {
        moved = true;
      }
      navScreen[i * 2] = pt.x;
      navScreen[i * 2 + 1] = pt.y;
    });
    if (moved) publishNavScreen();
  };

  const starScreen = new Float32Array(STAR_COUNT * 2);
  const near: number[] = [];
  const updateLinks = () => {
    const m = mouse();
    let n = 0;
    if (m) {
      const mx = m.x * w;
      const my = m.y * h;
      near.length = 0;
      for (let i = 0; i < STAR_COUNT; i++) {
        v.fromArray(starPos, i * 3);
        toScreen(v, pt);
        starScreen[i * 2] = pt.x;
        starScreen[i * 2 + 1] = pt.y;
        if (Math.hypot(pt.x - mx, pt.y - my) < CURSOR_RADIUS) near.push(i);
      }
      for (let a = 0; a < near.length && n < MAX_LINKS; a++) {
        for (let b = a + 1; b < near.length && n < MAX_LINKS; b++) {
          const i = near[a];
          const j = near[b];
          const d = Math.hypot(
            starScreen[i * 2] - starScreen[j * 2],
            starScreen[i * 2 + 1] - starScreen[j * 2 + 1],
          );
          if (d >= LINK_RADIUS) continue;
          const alpha = (1 - d / LINK_RADIUS) * 0.4;
          for (let e = 0; e < 2; e++) {
            const src = (e ? j : i) * 3;
            const dst = (n * 2 + e) * 3;
            linkPos[dst] = starPos[src];
            linkPos[dst + 1] = starPos[src + 1];
            linkPos[dst + 2] = starPos[src + 2];
            linkColor.toArray(linkCol, (n * 2 + e) * 4);
            linkCol[(n * 2 + e) * 4 + 3] = alpha;
          }
          n++;
        }
      }
    }
    linkGeo.setDrawRange(0, n * 2);
    linkPosBuf.needsUpdate = true;
    linkColBuf.needsUpdate = true;
  };

  // The satellite sweeps over the horizon for ~27s, then reappears after a
  // short ~9s pause, on an orbit tipped slightly away so it climbs out from
  // behind the limb.
  const SAT_CYCLE = 36;
  const SAT_SWEEP = 0.75;
  const SAT_ARC = THREE.MathUtils.degToRad(28);
  const SAT_TILT = THREE.MathUtils.degToRad(-6);
  const updateSatellite = (t: number) => {
    const u = (t % SAT_CYCLE) / SAT_CYCLE;
    const a = THREE.MathUtils.lerp(-SAT_ARC, SAT_ARC, Math.min(1, u / SAT_SWEEP));
    const r = earthRadius + 9;
    satPos[0] = earthCenter.x + r * Math.sin(a);
    satPos[1] = earthCenter.y + r * Math.cos(a) * Math.cos(SAT_TILT);
    satPos[2] = earthCenter.z + r * Math.cos(a) * Math.sin(SAT_TILT);
    satGeo.attributes.position.needsUpdate = true;
    // Blinks on a 1.4s beat; hidden while parked off-screen.
    satMat.uniforms.uOpacity.value = u > SAT_SWEEP ? 0 : (t % 1.4) < 0.7 ? 1 : 0.25;
  };

  /* --- loop ------------------------------------------------------ */

  const clock = new THREE.Clock();
  let raf = 0;

  const render = () => {
    placeCamera();
    publishNav();
    renderer.render(scene, camera);
  };

  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (from && to) {
      const u = Math.min(1, (t - blendStart) / 0.8);
      applyTheme(u);
      if (u >= 1) from = null;
    }

    // A critically damped spring toward the scatter pose: the last click
    // swings the camera round in about a second and settles without bounce.
    const target = scatterTarget();
    const k = 22;
    const c = 2 * Math.sqrt(k);
    yawVel += ((target.yaw - yaw) * k - yawVel * c) * dt;
    pitchVel += ((target.pitch - pitch) * k - pitchVel * c) * dt;
    yaw += yawVel * dt;
    pitch += pitchVel * dt;

    const m = mouse();
    const want = m
      ? {
          x: THREE.MathUtils.degToRad(PARALLAX_YAW) * (m.x - 0.5) * 2,
          y: THREE.MathUtils.degToRad(PARALLAX_PITCH) * (m.y - 0.5) * 2,
        }
      : { x: 0, y: 0 };
    par = {
      x: par.x + (want.x - par.x) * Math.min(1, dt * 3),
      y: par.y + (want.y - par.y) * Math.min(1, dt * 3),
    };

    starMat.uniforms.uTime.value = t;
    earth.update(t);
    updateSatellite(t);
    placeCamera();
    updateLinks();
    publishNav();
    renderer.render(scene, camera);
  };

  const start = scatterTarget();
  yaw = start.yaw;
  pitch = start.pitch;

  // Reduced motion: no loop, just a fresh still on anything that changes it.
  if (reduced) {
    satMat.uniforms.uOpacity.value = 0;
    linkGeo.setDrawRange(0, 0);
    window.addEventListener('resize', render);
  } else {
    raf = requestAnimationFrame(frame);
  }

  return {
    canvas: renderer.domElement,
    setAlignment: (a) => {
      align = a;
      if (!reduced) return;
      const target = scatterTarget();
      yaw = target.yaw;
      pitch = target.pitch;
      render();
    },
    setTheme: (colors) => {
      const first = !to;
      if (!first && !reduced) {
        // Freeze where the current blend has got to and ease on from there.
        from = {
          ...colors,
          star: cur.star.clone(),
          link: cur.link.clone(),
          starOpacity: starMat.uniforms.uOpacity.value,
          starPeak: starMat.uniforms.uPeak.value,
          earth: {
            base: cur.base.clone(),
            detail: cur.detail.clone(),
            rim: cur.rim.clone(),
            halo: cur.halo.clone(),
            haloAlpha: cur.haloAlpha,
          },
        };
        blendStart = clock.elapsedTime;
      }
      to = colors;
      if (first || reduced) {
        applyTheme(1);
        if (reduced) render();
      }
      const blending = colors.light ? THREE.NormalBlending : THREE.AdditiveBlending;
      starMat.blending = blending;
      satMat.blending = blending;
      starMat.needsUpdate = true;
      satMat.needsUpdate = true;
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', layout);
      window.removeEventListener('resize', render);
      earth.dispose();
      starGeo.dispose();
      starMat.dispose();
      satGeo.dispose();
      satMat.dispose();
      linkGeo.dispose();
      linkMat.dispose();
      renderer.dispose();
    },
  };
}
