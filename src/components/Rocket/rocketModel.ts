/**
 * Procedural three.js model of the portfolio rocket.
 *
 * Everything here is generated in code — no external assets — so the model
 * ships with the bundle and re-themes instantly when the CSS palette flips.
 *
 * World units are chosen so the nose tip sits at y = +NOSE_TIP and the nozzle
 * exit at y = -NOZZLE_EXIT; Rocket3D maps that span onto the 70x180px box the
 * CSS rocket used to occupy, which keeps the exhaust/flame layers aligned.
 */
import * as THREE from 'three';

export const NOSE_TIP = 2.0;
export const NOZZLE_EXIT = -2.0;

const BODY_R = 0.72;
const NOSE_LEN = 1.28; // tip (y=2.0) down to the shoulder (y=0.72)
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
  accent: string;
}

export interface RocketModel {
  root: THREE.Group;
  /** Yawing/banking hull — everything that should spin with the rocket. */
  hull: THREE.Group;
  setPalette(p: RocketPalette): void;
  /** 0 = idle burn, 1 = full launch thrust. */
  setThrust(t: number): void;
  /** Seconds of scene time, for flicker and running lights. */
  update(time: number): void;
  dispose(): void;
}

/* ------------------------------------------------------------------ *
 * Procedural textures
 * ------------------------------------------------------------------ */

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

/**
 * Hull livery: panel seams, a service hatch, registry marking and a band of
 * scorch near the engine. v = 0 is the nose tip, v = 1 the skirt.
 */
function hullTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 1024;
  const { c, ctx } = makeCanvas(W, H);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Soft vertical shading so the lathe reads as panels rather than one tube.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(246,246,248,1)');
  grad.addColorStop(1.0, 'rgba(208,208,214,1)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Horizontal seams (rings around the hull).
  const seams = [0.3, 0.42, 0.55, 0.68, 0.8, 0.9];
  ctx.lineWidth = 2;
  for (const v of seams) {
    ctx.strokeStyle = 'rgba(90,92,100,0.35)';
    ctx.beginPath();
    ctx.moveTo(0, v * H);
    ctx.lineTo(W, v * H);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(0, v * H + 3);
    ctx.lineTo(W, v * H + 3);
    ctx.stroke();
  }

  // Vertical seams, only across the mid hull.
  ctx.strokeStyle = 'rgba(90,92,100,0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const u = (i / 8) * W;
    ctx.beginPath();
    ctx.moveTo(u, 0.3 * H);
    ctx.lineTo(u, 0.9 * H);
    ctx.stroke();
  }

  // Service hatch on the far side of the porthole.
  ctx.strokeStyle = 'rgba(80,82,90,0.45)';
  ctx.lineWidth = 3;
  roundRect(ctx, 0.56 * W, 0.58 * H, 0.12 * W, 0.14 * H, 10);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  ctx.fill();

  // Registry marking — the repo's own call sign.
  ctx.save();
  ctx.translate(0.12 * W, 0.52 * H);
  ctx.fillStyle = 'rgba(40,42,48,0.75)';
  ctx.font = 'bold 44px "Share Tech Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GBP-01', 0, 0);
  ctx.restore();

  // Hazard band just above the skirt.
  ctx.fillStyle = 'rgba(255,179,71,0.85)';
  ctx.fillRect(0, 0.845 * H, W, 14);
  ctx.fillStyle = 'rgba(30,30,34,0.9)';
  ctx.fillRect(0, 0.862 * H, W, 6);

  // Scorching that creeps up from the engine.
  const burn = ctx.createLinearGradient(0, H, 0, 0.8 * H);
  burn.addColorStop(0, 'rgba(30,27,26,0.95)');
  burn.addColorStop(1, 'rgba(38,34,32,0)');
  ctx.fillStyle = burn;
  ctx.fillRect(0, 0.8 * H, W, H * 0.2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  // Lathe V runs nose (0) -> skirt (1); without this the canvas is flipped and
  // the engine scorch ends up painted on the nose cone.
  tex.flipY = false;
  return tex;
}

/** Brushed-metal roughness variation so highlights streak instead of blobbing. */
function hullRoughness(): THREE.CanvasTexture {
  const W = 512;
  const H = 512;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    const y = Math.random() * H;
    const x = Math.random() * W;
    const len = 6 + Math.random() * 40;
    ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Filled circle in alpha, used to punch a round porthole out of a hull patch. */
function discAlpha(ring: boolean): THREE.CanvasTexture {
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
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
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

/** Radial falloff sprite for the engine bloom and porthole halo. */
function glowSprite(inner: string, outer: string): THREE.CanvasTexture {
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ------------------------------------------------------------------ *
 * Geometry
 * ------------------------------------------------------------------ */

/**
 * LatheGeometry derives V from the point *index*, so a profile with a densely
 * sampled nose and a sparse barrel squeezes the whole livery onto the nose.
 * Resampling at even arc length makes V track the real surface distance.
 */
function resample(pts: THREE.Vector2[], count: number): THREE.Vector2[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }
  const total = cum[cum.length - 1];
  const out: THREE.Vector2[] = [];
  let seg = 1;
  for (let i = 0; i < count; i++) {
    const d = (i / (count - 1)) * total;
    while (seg < pts.length - 1 && cum[seg] < d) seg++;
    const span = cum[seg] - cum[seg - 1] || 1;
    const t = (d - cum[seg - 1]) / span;
    out.push(pts[seg - 1].clone().lerp(pts[seg], t));
  }
  return out;
}

/** Ogive nose blending into the cylindrical hull and a tapered skirt. */
function hullProfile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const NOSE_STEPS = 26;
  for (let i = 0; i <= NOSE_STEPS; i++) {
    const t = i / NOSE_STEPS;
    const r = BODY_R * Math.pow(Math.sin((t * Math.PI) / 2), 0.62);
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), NOSE_TIP - t * NOSE_LEN));
  }
  pts.push(new THREE.Vector2(BODY_R, SHOULDER_Y - 0.55));
  pts.push(new THREE.Vector2(BODY_R, BODY_BOTTOM_Y));
  // Boat-tail into the engine skirt.
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

  const map = track(hullTexture());
  const rough = track(hullRoughness());
  rough.repeat.set(3, 6);

  /* --- hull ------------------------------------------------------- */

  const hullMat = track(
    new THREE.MeshStandardMaterial({
      color: palette.body,
      map,
      roughnessMap: rough,
      roughness: 0.42,
      metalness: 0.28,
      envMapIntensity: 1.1,
    }),
  );

  const hullGeo = track(new THREE.LatheGeometry(resample(hullProfile(), 160), 128));
  const hullMesh = new THREE.Mesh(hullGeo, hullMat);
  hullMesh.castShadow = true;
  hull.add(hullMesh);

  /* --- dark trim: shoulder collar and skirt band -------------------- */

  const darkMat = track(
    new THREE.MeshStandardMaterial({
      color: graphite(palette.dark).multiplyScalar(0.75),
      roughness: 0.5,
      metalness: 0.7,
    }),
  );

  const collarGeo = track(
    new THREE.CylinderGeometry(BODY_R * 1.012, BODY_R * 1.012, 0.09, 96, 1, true),
  );
  const collar = new THREE.Mesh(collarGeo, darkMat);
  collar.position.y = SHOULDER_Y - 0.06;
  hull.add(collar);

  const bandGeo = track(
    new THREE.CylinderGeometry(BODY_R * 0.99, BODY_R * 0.95, 0.16, 96, 1, true),
  );
  const band = new THREE.Mesh(bandGeo, darkMat);
  band.position.y = BODY_BOTTOM_Y + 0.02;
  hull.add(band);

  /* --- porthole ---------------------------------------------------- *
   * Arc patches that hug the hull, punched to a circle by an alpha map,
   * so the window conforms to the curvature instead of floating on it.   */

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

  const glassAlpha = track(discAlpha(false));
  const ringAlpha = track(discAlpha(true));

  const glassMat = track(
    new THREE.MeshStandardMaterial({
      color: '#0a0d14',
      emissive: new THREE.Color(palette.windowGlow),
      emissiveIntensity: 0.9,
      roughness: 0.08,
      metalness: 0.1,
      alphaMap: glassAlpha,
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
      alphaMap: ringAlpha,
      transparent: true,
      side: THREE.DoubleSide,
    }),
  );
  hull.add(patch(BODY_R * 1.028, rimMat));

  // Halo bleeding out of the glass, billboarded toward the camera.
  const haloTex = track(glowSprite('rgba(160,205,255,0.85)', 'rgba(90,150,255,0.28)'));
  const haloMat = track(
    new THREE.SpriteMaterial({
      map: haloTex,
      color: new THREE.Color(palette.windowGlow),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.75,
    }),
  );
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(1.5);
  halo.position.set(0, WIN_Y, BODY_R * 0.98);
  hull.add(halo);

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
  const edgeMat = track(
    new THREE.MeshStandardMaterial({
      color: palette.accent,
      emissive: new THREE.Color(palette.accent),
      emissiveIntensity: 0.35,
      roughness: 0.45,
      metalness: 0.35,
    }),
  );
  const edgeGeo = track(new THREE.BoxGeometry(0.026, 1.3, 0.118));
  // Angle of the blade's leading edge, so the strip lies flush along it.
  const EDGE_TILT = Math.atan2(-1.5, 0.85) + Math.PI / 2;

  // Three fins at 120 deg — two read as the CSS silhouette's left/right pair,
  // the third sells the volume as the rocket turns.
  for (const deg of [-60, 60, 180]) {
    const g = new THREE.Group();
    g.rotation.y = THREE.MathUtils.degToRad(deg);

    const blade = new THREE.Mesh(finGeo, finMat);
    blade.position.set(BODY_R * 0.86, BODY_BOTTOM_Y + 0.28, 0);
    blade.castShadow = true;
    g.add(blade);

    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.copy(blade.position).add(new THREE.Vector3(0.53, -0.2, 0));
    edge.rotation.z = EDGE_TILT;
    edge.scale.setScalar(0.88);
    g.add(edge);

    hull.add(g);
  }

  /* --- greebles: rivets, RCS nubs, antenna -------------------------- */

  const rivetGeo = track(new THREE.SphereGeometry(0.015, 8, 6));
  const rivetMat = track(
    new THREE.MeshStandardMaterial({ color: '#9aa0aa', roughness: 0.35, metalness: 0.9 }),
  );
  const RIVET_ROWS = [SHOULDER_Y - 0.2, BODY_BOTTOM_Y + 0.18];
  const RIVETS_PER_ROW = 30;
  const rivets = new THREE.InstancedMesh(
    rivetGeo,
    rivetMat,
    RIVET_ROWS.length * RIVETS_PER_ROW,
  );
  const m4 = new THREE.Matrix4();
  let idx = 0;
  for (const y of RIVET_ROWS) {
    for (let i = 0; i < RIVETS_PER_ROW; i++) {
      const a = (i / RIVETS_PER_ROW) * Math.PI * 2;
      m4.makeTranslation(Math.cos(a) * BODY_R * 0.995, y, Math.sin(a) * BODY_R * 0.995);
      rivets.setMatrixAt(idx++, m4);
    }
  }
  rivets.instanceMatrix.needsUpdate = true;
  hull.add(rivets);

  const nubGeo = track(new THREE.CylinderGeometry(0.035, 0.06, 0.07, 12));
  for (const deg of [0, 120, 240]) {
    const a = THREE.MathUtils.degToRad(deg);
    const nub = new THREE.Mesh(nubGeo, darkMat);
    const r = BODY_R * 0.97;
    nub.position.set(Math.cos(a) * r, SHOULDER_Y - 0.42, Math.sin(a) * r);
    // Point the cylinder's axis straight out of the hull.
    nub.lookAt(Math.cos(a) * r * 3, SHOULDER_Y - 0.42, Math.sin(a) * r * 3);
    nub.rotateX(Math.PI / 2);
    hull.add(nub);
  }

  const antennaGeo = track(new THREE.CylinderGeometry(0.012, 0.02, 0.42, 8));
  const antenna = new THREE.Mesh(antennaGeo, darkMat);
  antenna.position.set(0, NOSE_TIP + 0.16, 0);
  hull.add(antenna);

  const beaconGeo = track(new THREE.SphereGeometry(0.045, 12, 10));
  const beaconMat = track(
    new THREE.MeshStandardMaterial({
      color: palette.accent,
      emissive: new THREE.Color(palette.accent),
      emissiveIntensity: 2.2,
      roughness: 0.3,
    }),
  );
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.set(0, NOSE_TIP + 0.38, 0);
  hull.add(beacon);

  /* --- engine ------------------------------------------------------ */

  const bellMat = track(
    new THREE.MeshStandardMaterial({
      color: '#7b8290',
      roughness: 0.26,
      metalness: 1.0,
      side: THREE.DoubleSide,
      envMapIntensity: 1.4,
    }),
  );
  const bellGeo = track(new THREE.LatheGeometry(bellProfile(), 96));
  const bell = new THREE.Mesh(bellGeo, bellMat);
  hull.add(bell);

  // Bright machined lip at the nozzle exit.
  const lipGeo = track(new THREE.TorusGeometry(0.78, 0.022, 8, 64));
  const lipMat = track(
    new THREE.MeshStandardMaterial({ color: '#b9c0cc', roughness: 0.2, metalness: 1 }),
  );
  const lip = new THREE.Mesh(lipGeo, lipMat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = NOZZLE_EXIT + 0.01;
  hull.add(lip);

  // Hot throat disc seen up inside the bell.
  const throatMat = track(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.accent),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const throatGeo = track(new THREE.CircleGeometry(0.22, 32));
  const throat = new THREE.Mesh(throatGeo, throatMat);
  throat.rotation.x = -Math.PI / 2;
  throat.position.y = SKIRT_Y - 0.22;
  hull.add(throat);

  // Plumbing wrapped around the skirt.
  const pipeGeo = track(new THREE.TorusGeometry(0.5, 0.035, 8, 40));
  const pipe = new THREE.Mesh(pipeGeo, darkMat);
  pipe.rotation.x = Math.PI / 2;
  pipe.position.y = SKIRT_Y + 0.02;
  hull.add(pipe);

  // Engine bloom — stays in root (not hull) so it never spins.
  const engineGlowTex = track(glowSprite('rgba(255,240,210,0.95)', 'rgba(255,150,40,0.5)'));
  const engineGlowMat = track(
    new THREE.SpriteMaterial({
      map: engineGlowTex,
      color: new THREE.Color(palette.accent),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.55,
    }),
  );
  const engineGlow = new THREE.Sprite(engineGlowMat);
  engineGlow.scale.setScalar(2.4);
  engineGlow.position.y = NOZZLE_EXIT + 0.05;
  root.add(engineGlow);

  const engineLight = new THREE.PointLight(new THREE.Color(palette.accent), 2.2, 4.2, 2);
  engineLight.position.y = NOZZLE_EXIT + 0.2;
  root.add(engineLight);

  /* --- dynamics ---------------------------------------------------- */

  let thrust = 0;

  const setThrust = (t: number) => {
    thrust = THREE.MathUtils.clamp(t, 0, 1);
  };

  const update = (time: number) => {
    // Combustion never sits still: two detuned sines read as roughness.
    const flicker =
      0.82 + 0.1 * Math.sin(time * 31.3) + 0.08 * Math.sin(time * 17.7 + 1.9);
    const level = (0.35 + 1.65 * thrust) * flicker;

    engineGlowMat.opacity = 0.32 + 0.55 * thrust * flicker;
    engineGlow.scale.setScalar(2.0 + 2.6 * thrust + 0.12 * (flicker - 0.82));
    engineLight.intensity = 1.4 + 11 * thrust * flicker;
    throatMat.opacity = 0.28 + 0.3 * level;
    throat.scale.setScalar(0.9 + 0.25 * thrust);

    // Cabin light breathes; beacon blinks on a 2.4s cycle.
    glassMat.emissiveIntensity = 0.75 + 0.25 * Math.sin(time * 1.2);
    haloMat.opacity = 0.55 + 0.2 * Math.sin(time * 1.2);
    const blink = (time % 2.4) < 0.16;
    beaconMat.emissiveIntensity = blink ? 5 : 0.5;
    edgeMat.emissiveIntensity = 0.3 + 0.9 * thrust;
  };

  const setPalette = (p: RocketPalette) => {
    hullMat.color.set(p.body);
    darkMat.color.copy(graphite(p.dark).multiplyScalar(0.75));
    finMat.color.copy(graphite(p.dark));
    edgeMat.color.set(p.accent);
    edgeMat.emissive.set(p.accent);
    beaconMat.color.set(p.accent);
    beaconMat.emissive.set(p.accent);
    glassMat.emissive.set(p.windowGlow);
    haloMat.color.set(p.windowGlow);
    throatMat.color.set(p.accent);
    engineGlowMat.color.set(p.accent);
    engineLight.color.set(p.accent);
  };

  const dispose = () => {
    rivets.dispose();
    disposables.forEach((d) => d.dispose());
  };

  return { root, hull, setPalette, setThrust, update, dispose };
}
