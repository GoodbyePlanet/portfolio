/**
 * Procedural three.js model of the portfolio rocket, in a low-poly style.
 *
 * A classic toy rocket: a red cone nose on a white egg-shaped hull, a large
 * porthole, three swept banana fins and a stubby nozzle. Every part is built
 * from a handful of flat facets and flat-shaded, so the key and rim lights
 * pick out each face. The plume is separate (see exhaust.ts).
 */
import * as THREE from 'three';

/** Top of the 180px layout box the rocket is fitted to. The hull is
 *  stretched upward past it, so the nozzle and everything measured from the
 *  box (click target, particles) stay put. */
export const BOX_TOP = 2.0;
const STRETCH = 0.5;
export const NOSE_TIP = BOX_TOP + STRETCH;
export const NOZZLE_EXIT = -2.0;

/** Radial facets on the hull. Ten keeps the egg reading as round while every
 *  face still catches its own light. */
const SIDES = 10;

const SEAM_Y = 1.17 + STRETCH;
const SEAM_R = 0.63;
const HULL_BOTTOM_Y = -1.86;

const PORT_Y = 0.44 + STRETCH;
const PORT_R = 0.36;
/** Hull radius at the porthole's height, measured to the middle of a face. */
const PORT_FACE = 0.72 * Math.cos(Math.PI / SIDES);

/** Trim is lifted off the near-black body colour so the rim light has
 *  something to catch; pure --rocket-dark reads as a hole in the scene. */
function graphite(dark: string): THREE.Color {
  return new THREE.Color(dark).lerp(new THREE.Color('#9aa2b2'), 0.12);
}

export interface RocketPalette {
  body: string;
  dark: string;
  accent: string;
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

/** Nose cone, tip down to the seam, in four stepped rings. */
function noseProfile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.0001, NOSE_TIP)];
  for (const t of [0.25, 0.5, 0.75, 1]) {
    const r = SEAM_R * Math.pow(Math.sin((t * Math.PI) / 2), 0.75);
    pts.push(new THREE.Vector2(r, NOSE_TIP - t * (NOSE_TIP - SEAM_Y)));
  }
  return pts;
}

/** Egg-shaped hull: widest just above the middle, tapering to a stepped-in
 *  skirt ring, then closed underneath. */
function hullProfile(): THREE.Vector2[] {
  return [
    new THREE.Vector2(SEAM_R - 0.01, SEAM_Y),
    new THREE.Vector2(0.7, 0.75 + STRETCH),
    new THREE.Vector2(0.74, 0.2 + STRETCH),
    new THREE.Vector2(0.73, -0.35),
    new THREE.Vector2(0.67, -0.95),
    new THREE.Vector2(0.58, -1.45),
    new THREE.Vector2(0.52, -1.5),
    new THREE.Vector2(0.52, -1.78),
    new THREE.Vector2(0.46, HULL_BOTTOM_Y),
    new THREE.Vector2(0.0001, HULL_BOTTOM_Y),
  ];
}

/** Stubby nozzle peeking out from under the skirt. */
function nozzleProfile(): THREE.Vector2[] {
  return [
    new THREE.Vector2(0.3, HULL_BOTTOM_Y + 0.02),
    new THREE.Vector2(0.26, -1.92),
    new THREE.Vector2(0.36, NOZZLE_EXIT),
  ];
}

/**
 * Swept banana fin, drawn with x as distance from the rocket's axis. The root
 * is buried in the hull; the leading edge bows out and down to a tip below
 * the nozzle, and the inner edge curls back up to the skirt. Few curve
 * segments keep the edges faceted.
 */
function finGeometry(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0.35, -0.7);
  s.lineTo(0.62, -0.82);
  s.quadraticCurveTo(1.08, -1.2, 1.08, -2.15);
  s.quadraticCurveTo(0.86, -1.66, 0.5, -1.58);
  s.lineTo(0.35, -1.45);
  s.closePath();

  const DEPTH = 0.12;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: DEPTH,
    curveSegments: 4,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -DEPTH / 2);
  return geo;
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

  /* --- materials --------------------------------------------------- */

  // Glossy but mostly diffuse: a mirror finish would reflect the same
  // environment on every face and flatten the facets back out.
  const bodyMat = track(
    new THREE.MeshStandardMaterial({
      color: palette.body,
      roughness: 0.4,
      metalness: 0.05,
      envMapIntensity: 0.9,
      flatShading: true,
    }),
  );

  // Matte: no sheen, so the accent reads as flat painted colour and each
  // facet differs only by how much light it faces.
  const accentMat = track(
    new THREE.MeshStandardMaterial({
      color: palette.accent,
      roughness: 0.9,
      metalness: 0,
      envMapIntensity: 0.35,
      flatShading: true,
    }),
  );

  const darkMat = track(
    new THREE.MeshStandardMaterial({
      color: graphite(palette.dark),
      roughness: 0.45,
      metalness: 0.3,
      flatShading: true,
    }),
  );

  /* --- hull and nose ----------------------------------------------- */

  // LatheGeometry only winds its faces outward when the profile runs bottom
  // to top; the profiles read top-down, so they are flipped here. Left as is,
  // the outer faces get culled and the far inside wall shows through.
  const lathe = (pts: THREE.Vector2[]) =>
    track(new THREE.LatheGeometry(pts.reverse(), SIDES));
  hull.add(new THREE.Mesh(lathe(hullProfile()), bodyMat));
  hull.add(new THREE.Mesh(lathe(noseProfile()), accentMat));

  // Dark band over the nose/hull seam. Cylinder and lathe both start their
  // first vertex on +z, so the band's faces line up with the hull's.
  const seam = new THREE.Mesh(
    track(new THREE.CylinderGeometry(SEAM_R + 0.025, SEAM_R + 0.025, 0.07, SIDES)),
    darkMat,
  );
  seam.position.y = SEAM_Y;
  hull.add(seam);

  /* --- porthole ---------------------------------------------------- */

  // Centred on a hull face. The glass is a deep disc so its back stays buried
  // where the faceted hull curves away behind the flat window.
  const porthole = new THREE.Group();
  porthole.rotation.y = Math.PI / SIDES;
  porthole.position.y = PORT_Y;
  hull.add(porthole);

  const glassMat = track(
    new THREE.MeshStandardMaterial({
      color: '#1a2350',
      emissive: new THREE.Color(palette.windowGlow),
      emissiveIntensity: 1,
      roughness: 0.12,
      metalness: 0.3,
      envMapIntensity: 1.6,
      flatShading: true,
    }),
  );
  const GLASS_DEPTH = 0.3;
  const glassGeo = track(new THREE.CylinderGeometry(PORT_R, PORT_R, GLASS_DEPTH, 12));
  glassGeo.rotateX(Math.PI / 2);
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.z = PORT_FACE + 0.02 - GLASS_DEPTH / 2;
  porthole.add(glass);

  // Chunky frame: a torus with a four-sided tube reads as a faceted ring.
  const frame = new THREE.Mesh(track(new THREE.TorusGeometry(PORT_R + 0.02, 0.065, 4, 12)), darkMat);
  frame.position.z = PORT_FACE + 0.02;
  porthole.add(frame);

  // Soft halo hung just in front of the window: brightest at the glass, then
  // falling off a little past the frame. Being a flat card on the porthole, it
  // thins out as the window turns away and the hull hides it round the back.
  const HALO_HALF = PORT_R * 2.1;
  const haloUniforms = {
    uColor: { value: new THREE.Color(palette.windowGlow) },
    uIntensity: { value: 1 },
  };
  const haloMat = track(
    new THREE.ShaderMaterial({
      uniforms: haloUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;     // 0 centre, 1 card edge
          float edge = ${(PORT_R / HALO_HALF).toFixed(3)};
          float glow = exp(-max(d - edge * 0.6, 0.0) * 5.5);
          glow *= 1.0 - smoothstep(0.7, 1.0, d);
          gl_FragColor = vec4(uColor * glow * uIntensity, glow * uIntensity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  const halo = new THREE.Mesh(
    track(new THREE.PlaneGeometry(HALO_HALF * 2, HALO_HALF * 2)),
    haloMat,
  );
  halo.position.z = PORT_FACE + 0.1;
  halo.renderOrder = 1;
  porthole.add(halo);

  /* --- fins -------------------------------------------------------- */

  const finGeo = track(finGeometry());
  // Three fins at 120 deg — two read as the left/right pair, the third
  // swings to the front as the rocket turns.
  for (const deg of [-60, 60, 180]) {
    const g = new THREE.Group();
    g.rotation.y = THREE.MathUtils.degToRad(deg);
    g.add(new THREE.Mesh(finGeo, accentMat));
    hull.add(g);
  }

  /* --- engine ------------------------------------------------------ */

  const nozzleMat = track(
    new THREE.MeshStandardMaterial({
      color: '#5a5f6a',
      emissive: new THREE.Color('#ff7a1a'),
      emissiveIntensity: 0.02,
      roughness: 0.45,
      metalness: 0.4,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
  );
  hull.add(new THREE.Mesh(track(new THREE.LatheGeometry(nozzleProfile(), SIDES)), nozzleMat));

  // Spill light from the plume onto the skirt and fins. It sits well below the
  // nozzle: any closer and it cooks the hull to a saturated orange.
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
    nozzleMat.emissiveIntensity = (0.02 + 0.2 * thrust) * flicker;

    // Cabin light breathes; glass and halo swell together.
    const breath = 0.5 + 0.5 * Math.sin(time * 1.2);
    glassMat.emissiveIntensity = 0.85 + 0.35 * breath;
    haloUniforms.uIntensity.value = 0.55 + 0.3 * breath;
  };

  return {
    root,
    hull,
    setPalette: (p) => {
      bodyMat.color.set(p.body);
      accentMat.color.set(p.accent);
      darkMat.color.copy(graphite(p.dark));
      glassMat.emissive.set(p.windowGlow);
      haloUniforms.uColor.value.set(p.windowGlow);
    },
    setThrust: (t) => {
      thrust = THREE.MathUtils.clamp(t, 0, 1);
    },
    update,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
