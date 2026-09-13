/**
 * Procedural three.js model of the portfolio rocket.
 *
 * Deliberately spare: a lathed hull, one trim ring, a porthole, three fins and
 * an engine bell. No textures, no greebles — the shape and the light do the
 * work, and it re-themes instantly from the CSS palette. The plume is separate
 * (see exhaust.ts).
 */
import * as THREE from 'three';

export const NOSE_TIP = 2.0;
export const NOZZLE_EXIT = -2.0;

const BODY_R = 0.72;
const NOSE_LEN = 1.28;
const SHOULDER_Y = NOSE_TIP - NOSE_LEN;
const BODY_BOTTOM_Y = -0.95;
const SKIRT_Y = -1.3;

/** Fins and trim are lifted off the near-black body colour so the rim light
 *  has something to catch; pure --rocket-dark reads as a hole in the scene. */
function graphite(dark: string): THREE.Color {
  return new THREE.Color(dark).lerp(new THREE.Color('#9aa2b2'), 0.22);
}

export interface RocketPalette {
  body: string;
  dark: string;
  windowGlow: string;
}

export interface RocketModel {
  root: THREE.Group;
  /** Yawing hull — everything that should spin with the rocket. */
  hull: THREE.Group;
  setPalette(p: RocketPalette): void;
  /** 0 = idle burn, 1 = full launch thrust. */
  setThrust(t: number): void;
  update(time: number): void;
  dispose(): void;
}

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

/** Ogive nose blending into the cylindrical hull and a tapered skirt. */
function hullProfile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const NOSE_STEPS = 26;
  for (let i = 0; i <= NOSE_STEPS; i++) {
    const t = i / NOSE_STEPS;
    const r = BODY_R * Math.pow(Math.sin((t * Math.PI) / 2), 0.62);
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), NOSE_TIP - t * NOSE_LEN));
  }
  pts.push(new THREE.Vector2(BODY_R, BODY_BOTTOM_Y));
  pts.push(new THREE.Vector2(BODY_R * 0.94, BODY_BOTTOM_Y - 0.12));
  pts.push(new THREE.Vector2(BODY_R * 0.8, SKIRT_Y));
  pts.push(new THREE.Vector2(BODY_R * 0.76, SKIRT_Y - 0.08));
  return pts;
}

/** Flared engine bell, open at the bottom. */
function bellProfile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const STEPS = 18;
  const top = SKIRT_Y - 0.02;
  const len = Math.abs(NOZZLE_EXIT - top);
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    // Throat pinches in, then the bell flares out towards the exit.
    const r = 0.42 - 0.16 * Math.sin(t * Math.PI * 0.62) + 0.5 * Math.pow(t, 2.1);
    pts.push(new THREE.Vector2(r, top - t * len));
  }
  return pts;
}

/** Swept delta fin, extruded with a bevel so the edges catch light. */
function finGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0.72);
  s.quadraticCurveTo(0.18, 0.3, 0.62, -0.5);
  s.lineTo(0.98, -1.0);
  s.lineTo(0.3, -1.0);
  s.quadraticCurveTo(0.06, -0.6, 0, 0.0);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.075,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 3,
    curveSegments: 18,
  });
  geo.translate(0, 0, -0.0375);
  geo.scale(0.88, 0.88, 1);
  return geo;
}

/** Filled circle (or ring) in alpha, used to punch the porthole out of a
 *  patch of hull so the window conforms to the curvature. */
function discAlpha(ring: boolean): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.44, 0, Math.PI * 2);
  ctx.fill();
  if (ring) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S * 0.36, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

/* ------------------------------------------------------------------ *
 * Assembly
 * ------------------------------------------------------------------ */

export function buildRocket(palette: RocketPalette): RocketModel {
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(o: T) => {
    disposables.push(o);
    return o;
  };

  const root = new THREE.Group();
  const hull = new THREE.Group();
  root.add(hull);

  /* --- hull ------------------------------------------------------- */

  const hullMat = track(
    new THREE.MeshStandardMaterial({
      color: palette.body,
      roughness: 0.38,
      metalness: 0.3,
      envMapIntensity: 1.1,
    }),
  );

  const hullGeo = track(new THREE.LatheGeometry(hullProfile(), 128));
  hull.add(new THREE.Mesh(hullGeo, hullMat));

  /* --- trim ring at the nose/body seam ----------------------------- */

  const darkMat = track(
    new THREE.MeshStandardMaterial({
      color: graphite(palette.dark).multiplyScalar(0.75),
      roughness: 0.5,
      metalness: 0.7,
    }),
  );

  const collarGeo = track(
    new THREE.CylinderGeometry(BODY_R * 1.012, BODY_R * 1.012, 0.075, 96, 1, true),
  );
  const collar = new THREE.Mesh(collarGeo, darkMat);
  collar.position.y = SHOULDER_Y - 0.05;
  hull.add(collar);

  /* --- porthole ---------------------------------------------------- */

  const WIN_Y = 0.28;
  const WIN_H = 0.58;
  const WIN_ARC = 0.56; // radians of hull covered
  const patch = (r: number, mat: THREE.Material) => {
    const g = track(
      new THREE.CylinderGeometry(r, r, WIN_H, 48, 1, true, -WIN_ARC / 2, WIN_ARC),
    );
    const m = new THREE.Mesh(g, mat);
    m.position.y = WIN_Y;
    return m;
  };

  const glassMat = track(
    new THREE.MeshStandardMaterial({
      color: '#0a0d14',
      emissive: new THREE.Color(palette.windowGlow),
      emissiveIntensity: 0.9,
      roughness: 0.08,
      metalness: 0.1,
      alphaMap: track(discAlpha(false)),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  hull.add(patch(BODY_R * 1.004, glassMat));

  const rimMat = track(
    new THREE.MeshStandardMaterial({
      color: '#cfd3da',
      roughness: 0.25,
      metalness: 0.95,
      alphaMap: track(discAlpha(true)),
      transparent: true,
      side: THREE.DoubleSide,
    }),
  );
  hull.add(patch(BODY_R * 1.028, rimMat));

  /* --- fins -------------------------------------------------------- */

  const finGeo = track(finGeometry());
  const finMat = track(
    new THREE.MeshStandardMaterial({
      color: graphite(palette.dark),
      roughness: 0.34,
      metalness: 0.85,
      envMapIntensity: 1.6,
    }),
  );

  // Three fins at 120 deg — two read as the CSS silhouette's left/right pair,
  // the third sells the volume as the rocket turns.
  for (const deg of [-60, 60, 180]) {
    const blade = new THREE.Mesh(finGeo, finMat);
    blade.position.set(BODY_R * 0.86, BODY_BOTTOM_Y + 0.28, 0);
    const g = new THREE.Group();
    g.rotation.y = THREE.MathUtils.degToRad(deg);
    g.add(blade);
    hull.add(g);
  }

  /* --- engine ------------------------------------------------------ */

  const bellMat = track(
    new THREE.MeshStandardMaterial({
      // Not a pure metal: at metalness 1 the bell has no diffuse term and the
      // engine light turns it maroon instead of warm grey.
      color: '#8a909c',
      emissive: new THREE.Color('#ff7a1a'),
      emissiveIntensity: 0.02,
      roughness: 0.35,
      metalness: 0.7,
      side: THREE.DoubleSide,
      envMapIntensity: 1.4,
    }),
  );
  const bellGeo = track(new THREE.LatheGeometry(bellProfile(), 96));
  hull.add(new THREE.Mesh(bellGeo, bellMat));

  // Spill light from the plume onto the skirt and fins. It sits well below the
  // nozzle: any closer and it cooks the bell itself to a saturated orange.
  const engineLight = new THREE.PointLight(new THREE.Color('#ff8a2a'), 2.2, 7, 2);
  engineLight.position.y = NOZZLE_EXIT - 1.0;
  root.add(engineLight);

  /* --- dynamics ---------------------------------------------------- */

  let thrust = 0;

  const update = (time: number) => {
    // Combustion never sits still: two detuned sines read as roughness.
    const flicker =
      0.82 + 0.1 * Math.sin(time * 31.3) + 0.08 * Math.sin(time * 17.7 + 1.9);

    engineLight.intensity = (1.6 + 16 * thrust) * flicker;
    bellMat.emissiveIntensity = (0.02 + 0.2 * thrust) * flicker;

    // Cabin light breathes.
    glassMat.emissiveIntensity = 0.75 + 0.25 * Math.sin(time * 1.2);
  };

  return {
    root,
    hull,
    setPalette: (p) => {
      hullMat.color.set(p.body);
      darkMat.color.copy(graphite(p.dark).multiplyScalar(0.75));
      finMat.color.copy(graphite(p.dark));
      glassMat.emissive.set(p.windowGlow);
    },
    setThrust: (t) => {
      thrust = THREE.MathUtils.clamp(t, 0, 1);
    },
    update,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
