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
import type { LaunchPhase } from '../../hooks/useLaunchSequence';
import { createEarth, type EarthColors } from './earth';
import { navScreen, publishNavScreen, horizon, nozzle } from './sceneBus';

const FOV = 30;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

/** The rocket's key light, so the planet and the hull share one sun. */
export const SUN = new THREE.Vector3(4, 5, 6).normalize();

const STAR_COUNT = 270;
/** Every star is the same size on screen; depth shows only as parallax. */
const STAR_PX = 1.8;
const SATELLITE_PX = 5;

/** Camera offset (degrees) while the constellation is still scattered. */
const SCATTER_YAW = 9;
const SCATTER_PITCH = -2.5;
/** Cursor parallax, degrees at the viewport edge. */
const PARALLAX_YAW = 0.6;
const PARALLAX_PITCH = 0.35;
/** Idle drift: a slow sway (degrees, seconds per cycle) that keeps the depth
 *  of the star field readable with no cursor to move it. */
const DRIFT_YAW = 2.5;
const DRIFT_PITCH = 0.8;
const DRIFT_YAW_PERIOD = 20;
const DRIFT_PITCH_PERIOD = 14;
/** How far the camera climbs after the rocket on launch, in viewport heights.
 *  The horizon is nearer than the stars, so it sinks about twice as far. */
const LAUNCH_LIFT = 0.1;
/** The rocket crouches first (the 20% keyframe of its 2s CSS launch). */
const LAUNCH_CROUCH = 0.4;

/** Depth of each rocket-constellation star, as a fraction of the camera
 *  distance: alternating near and far so the scattered view looks random. */
const NAV_DEPTH = [0, 0.2, -0.22, 0.14, -0.16, 0.28, -0.09, 0.16, -0.26, 0.1, -0.19, 0.24, -0.12];

/** Planet centre's depth as a fraction of its radius (+ is toward the camera). */
const EARTH_FORWARD = 0.25;

/** The vapour trail the launch leaves behind: points along the rocket's path,
 *  each fading over TRAIL_LIFE seconds, so the line thins out from the pad up. */
const TRAIL_POINTS = 128;
const TRAIL_LIFE = 1.4;
const TRAIL_OPACITY = 0.8;
/** A ribbon rather than a GL line, which is a hairline on dense screens. */
const TRAIL_WIDTH = 2;
/** Screen px the rocket travels between points. */
const TRAIL_STEP = 8;

const CURSOR_RADIUS = 120;
const LINK_RADIUS = 150;
const MAX_LINKS = 8;
/** Cursor lines fade out over this many px as they near a HUD panel, and
 *  are gone where they would cross one. */
const PANEL_FADE = 48;
/** How often the panels' boxes are re-read from the page (seconds). */
const PANEL_POLL = 0.4;

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
  /** The camera climbs after the rocket as it launches and sinks back as it returns. */
  setPhase(phase: LaunchPhase): void;
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
    // Taller too: the launch lifts the camera, and stars must slide in from above.
    starSeed[i * 3 + 1] = -0.22 + Math.random() * 1.17;
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

  /* --- launch trail ---------------------------------------------- */

  // Two vertices per point, either side of the path.
  const trailPos = new Float32Array(TRAIL_POINTS * 2 * 3);
  const trailCol = new Float32Array(TRAIL_POINTS * 2 * 4);
  const trailBorn = new Float32Array(TRAIL_POINTS);
  const trailGeo = new THREE.BufferGeometry();
  const trailPosBuf = new THREE.BufferAttribute(trailPos, 3).setUsage(THREE.DynamicDrawUsage);
  const trailColBuf = new THREE.BufferAttribute(trailCol, 4).setUsage(THREE.DynamicDrawUsage);
  trailGeo.setAttribute('position', trailPosBuf);
  trailGeo.setAttribute('color', trailColBuf);
  const trailIndex: number[] = [];
  for (let i = 0; i < TRAIL_POINTS - 1; i++) {
    const a = i * 2;
    trailIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  trailGeo.setIndex(trailIndex);
  trailGeo.setDrawRange(0, 0);
  const trailMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const trail = new THREE.Mesh(trailGeo, trailMat);
  trail.frustumCulled = false;
  trail.renderOrder = 4;
  scene.add(trail);
  let trailCount = 0;
  let trailLast = { x: 0, y: 0 };

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
  let drift = { x: 0, y: 0 };
  let phase: LaunchPhase = 'idle';
  let phaseStart = 0;
  let lift = 0;
  let liftVel = 0;

  const scatterTarget = () => {
    const off = Math.pow(1 - THREE.MathUtils.clamp(align, 0, 1), 1.2);
    return {
      yaw: THREE.MathUtils.degToRad(SCATTER_YAW) * off,
      pitch: THREE.MathUtils.degToRad(SCATTER_PITCH) * off,
    };
  };

  const placeCamera = () => {
    const y = yaw + par.x + drift.x;
    const p = pitch + par.y + drift.y;
    // The lift moves the camera and its target together, so the view climbs
    // without tilting and nearer things sink faster than far ones.
    camera.position.set(
      dist * Math.sin(y) * Math.cos(p),
      dist * Math.sin(p) + lift,
      dist * Math.cos(y) * Math.cos(p),
    );
    camera.lookAt(0, lift, 0);
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

  // The rocket constellation is seen through a camera of its own that skips
  // the idle drift and the launch lift: its stars sit at scattered depths, so
  // either would bend the outline out of shape. It rides the lift as a whole.
  const navCamera = new THREE.PerspectiveCamera();
  const pt = { x: 0, y: 0 };
  const publishNav = () => {
    const y = yaw + par.x;
    const p = pitch + par.y;
    navCamera.position.set(
      dist * Math.sin(y) * Math.cos(p),
      dist * Math.sin(p),
      dist * Math.cos(y) * Math.cos(p),
    );
    navCamera.lookAt(0, 0, 0);
    navCamera.updateMatrixWorld();
    navCamera.projectionMatrix.copy(camera.projectionMatrix);
    let moved = false;
    navWorld.forEach((np, i) => {
      v.copy(np).project(navCamera);
      pt.x = (v.x + 1) * 0.5 * w;
      pt.y = (1 - v.y) * 0.5 * h + lift;
      if (Math.abs(navScreen[i * 2] - pt.x) > 0.05 || Math.abs(navScreen[i * 2 + 1] - pt.y) > 0.05) {
        moved = true;
      }
      navScreen[i * 2] = pt.x;
      navScreen[i * 2 + 1] = pt.y;
    });
    if (moved) publishNavScreen();
  };

  // The trail is laid in the world, on the rocket's plane, at the point the
  // nozzle covers on screen right now. From then on it belongs to the world:
  // it sinks with the horizon as the camera climbs.
  const ray = new THREE.Vector3();
  const updateTrail = (t: number) => {
    const burning = phase === 'launching' && t - phaseStart > LAUNCH_CROUCH;
    if (
      burning &&
      trailCount < TRAIL_POINTS &&
      nozzle.y > -40 &&
      (trailCount === 0 || Math.hypot(nozzle.x - trailLast.x, nozzle.y - trailLast.y) >= TRAIL_STEP)
    ) {
      ray.set((nozzle.x / w) * 2 - 1, 1 - (nozzle.y / h) * 2, 0.5).unproject(camera);
      ray.sub(camera.position);
      const k = -camera.position.z / ray.z;
      const x = camera.position.x + ray.x * k;
      const y = camera.position.y + ray.y * k;
      trailPos.set([x - TRAIL_WIDTH / 2, y, 0, x + TRAIL_WIDTH / 2, y, 0], trailCount * 6);
      trailBorn[trailCount] = t;
      trailLast = { x: nozzle.x, y: nozzle.y };
      trailCount++;
      trailPosBuf.needsUpdate = true;
    }
    if (trailCount === 0) return;

    let alive = false;
    for (let i = 0; i < trailCount; i++) {
      const left = Math.max(0, 1 - (t - trailBorn[i]) / TRAIL_LIFE);
      if (left > 0) alive = true;
      const alpha = TRAIL_OPACITY * Math.pow(left, 1.5);
      trailCol.set([linkColor.r, linkColor.g, linkColor.b, alpha], i * 8);
      trailCol.set([linkColor.r, linkColor.g, linkColor.b, alpha], i * 8 + 4);
    }
    trailColBuf.needsUpdate = true;
    if (!alive && !burning) trailCount = 0;
    trailGeo.setDrawRange(0, Math.max(0, trailCount - 1) * 6);
  };

  // The HUD panels' boxes, so the cursor's lines can keep clear of the text.
  // Read on a slow poll rather than every frame: panels only appear, resize
  // or scroll now and then, and measuring the page each frame is not free.
  let panels: DOMRect[] = [];
  let panelsReadAt = -Infinity;
  const readPanels = (t: number) => {
    if (t - panelsReadAt < PANEL_POLL) return;
    panelsReadAt = t;
    panels = [...document.querySelectorAll<HTMLElement>('[data-hud-panel]')]
      .filter((el) => el.checkVisibility?.({ opacityProperty: true }) ?? true)
      .map((el) => el.getBoundingClientRect());
  };
  /** 0 on a panel, rising to 1 PANEL_FADE px clear of every panel. */
  const panelClearance = (x: number, y: number) => {
    let clear = 1;
    for (const r of panels) {
      const dx = Math.max(r.left - x, 0, x - r.right);
      const dy = Math.max(r.top - y, 0, y - r.bottom);
      clear = Math.min(clear, Math.hypot(dx, dy) / PANEL_FADE);
    }
    return clear;
  };

  const starScreen = new Float32Array(STAR_COUNT * 2);
  const near: number[] = [];
  const updateLinks = (t: number) => {
    const m = mouse();
    let n = 0;
    if (m) {
      readPanels(t);
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
          // The whole line dims by its closest approach to a panel, sampled
          // along its length, so one that would cross a panel never shows.
          let clear = 1;
          for (let k = 0; k <= 4 && clear > 0; k++) {
            const u = k / 4;
            clear = Math.min(
              clear,
              panelClearance(
                starScreen[i * 2] + (starScreen[j * 2] - starScreen[i * 2]) * u,
                starScreen[i * 2 + 1] + (starScreen[j * 2 + 1] - starScreen[i * 2 + 1]) * u,
              ),
            );
          }
          if (clear <= 0) continue;
          const alpha = (1 - d / LINK_RADIUS) * 0.4 * clear;
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

    drift = {
      x: THREE.MathUtils.degToRad(DRIFT_YAW) * Math.sin((t / DRIFT_YAW_PERIOD) * Math.PI * 2),
      y: THREE.MathUtils.degToRad(DRIFT_PITCH) * Math.sin((t / DRIFT_PITCH_PERIOD) * Math.PI * 2),
    };

    // Climb once the rocket leaves its crouch; ease back down, more slowly,
    // while it returns. A critically damped spring, so it never bounces.
    const climbing = phase === 'launching' && t - phaseStart > LAUNCH_CROUCH;
    const liftTarget = climbing ? LAUNCH_LIFT * h : 0;
    const lk = climbing ? 9 : 5.5;
    liftVel += ((liftTarget - lift) * lk - liftVel * 2 * Math.sqrt(lk)) * dt;
    lift += liftVel * dt;

    starMat.uniforms.uTime.value = t;
    earth.update(t);
    updateSatellite(t);
    placeCamera();
    updateTrail(t);
    updateLinks(t);
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
    setPhase: (next) => {
      if (reduced || next === phase) return;
      phase = next;
      phaseStart = clock.elapsedTime;
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
      trailGeo.dispose();
      trailMat.dispose();
      renderer.dispose();
    },
  };
}
