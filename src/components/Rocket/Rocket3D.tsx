import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { LaunchPhase } from '../../hooks/useLaunchSequence';
import { buildRocket, BOX_TOP, NOZZLE_EXIT, type RocketPalette } from './rocketModel';
import { createExhaust, type ExhaustColors } from './exhaust';
import { createSmoke } from './smoke';
import styles from './Rocket.module.css';

/**
 * The rocket occupies the same 70x180px box the CSS version did — BOX_TOP at
 * the top of it (the stretched nose pokes above), nozzle exit at the bottom —
 * so the click target and the particle bursts that measure that box still
 * line up. The canvas is far
 * taller, hanging well below, because the plume and the smoke live in it too.
 */
const BOX_H = 180;
const CANVAS_W = 400;
const CANVAS_H = 900;
const CANVAS_TOP = -140; // px above the top of the box
const PX_PER_UNIT = BOX_H / (BOX_TOP - NOZZLE_EXIT);
const FOV = 30;
/** Resting yaw: a readable three-quarter view, porthole toward the viewer. */
const REST_YAW = THREE.MathUtils.degToRad(-28);
const TAU = Math.PI * 2;

interface Rocket3DProps {
  phase: LaunchPhase;
  /** Hovering the exhaust stretches the plume, as the CSS flame used to. */
  boost?: boolean;
  /** Hovering the hull spins it up while idle. */
  spin?: boolean;
}

function readPalette(): RocketPalette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    body: v('--rocket-body', '#e6e6e6'),
    dark: v('--rocket-dark', '#151515'),
    accent: v('--rocket-accent', '#e2463a'),
    windowGlow: v('--window-glow', 'rgba(100, 180, 255, 0.4)'),
  };
}

function readFlame(): ExhaustColors {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    core: v('--flame-core-top', '#fff4e0'),
    mid: v('--flame-core-mid', 'rgba(255, 179, 71, 0.85)'),
    tail: v('--flame-core-end', 'rgba(217, 127, 30, 0.35)'),
  };
}

/** Launch and return choreography in phase-local seconds. The CSS keyframes
 *  only carry the rocket up and down the page; squash, depth and pitch happen
 *  here, where perspective can do the shrinking instead of a flat scale. */
const LAUNCH = {
  crouch: 0.4, // matches the 20% crouch keyframe of the 2s CSS launch
  stretch: 0.8,
  settle: 1.3,
  end: 2.0,
  depth: 28, // world units pushed away by the end
};
const RETURN = {
  arrive: 2.125, // the 85% overshoot keyframe of the 2.5s CSS return
  end: 2.5,
  depth: 40,
  overshoot: 0.7,
};

const smooth = (u: number) => {
  const c = THREE.MathUtils.clamp(u, 0, 1);
  return c * c * (3 - 2 * c);
};

/** Root transform for a phase at phase-local time s. */
function choreography(p: LaunchPhase, s: number) {
  let squash = 0; // + crouches, - stretches
  let z = 0;
  let pitch = 0; // + nose toward the camera
  if (p === 'launching') {
    const L = LAUNCH;
    if (s < L.crouch) {
      squash = 0.08 * smooth(s / L.crouch);
      pitch = 0.06 * smooth(s / L.crouch);
    } else if (s < L.stretch) {
      const u = smooth((s - L.crouch) / (L.stretch - L.crouch));
      squash = THREE.MathUtils.lerp(0.08, -0.13, u);
      pitch = THREE.MathUtils.lerp(0.06, -0.12, u);
    } else {
      const u = smooth((s - L.stretch) / (L.settle - L.stretch));
      squash = THREE.MathUtils.lerp(-0.13, -0.04, u);
      pitch = -0.12 - 0.18 * smooth((s - L.stretch) / (L.end - L.stretch));
    }
    // Accelerating away from the camera once it leaves the pad.
    const a = Math.max(0, (s - L.crouch) / (L.end - L.crouch));
    z = -L.depth * a * a;
  } else if (p === 'returning') {
    const R = RETURN;
    if (s < R.arrive) {
      const u = s / R.arrive;
      const e = 1 - Math.pow(1 - u, 3); // the CSS return's strong ease-out
      z = THREE.MathUtils.lerp(-R.depth, R.overshoot, e);
      pitch = 0.25 * (1 - e);
    } else {
      const u = smooth((s - R.arrive) / (R.end - R.arrive));
      z = R.overshoot * (1 - u);
      // A small landing bob as it settles into the float.
      squash = 0.04 * Math.sin(u * Math.PI);
    }
  }
  return { squash, z, pitch };
}

/** The plume's mid tone as an opaque light colour (THREE.Color drops alpha). */
function flameLightColor(): THREE.Color {
  return new THREE.Color(readFlame().mid);
}

/**
 * The scene around the rocket, baked into an environment map: a graded sky
 * dome that turns atmosphere-blue below, where the Earth sits, plus a few
 * emissive cards that become the specular highlights on the hull. The sun
 * card sits on the right, the Earth's day side (see the terminator in
 * Earth.module.css), so the planet and the rocket share one light.
 */
function buildEnvScene(): { scene: THREE.Scene; dispose: () => void } {
  const scene = new THREE.Scene();
  const junk: { dispose(): void }[] = [];

  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, '#0b1020');
  g.addColorStop(0.45, '#2a3550');
  g.addColorStop(0.72, '#5f7290');
  g.addColorStop(1.0, '#1d3050'); // earthshine
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(c);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  junk.push(skyTex);

  const domeGeo = new THREE.SphereGeometry(40, 32, 24);
  const domeMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
  junk.push(domeGeo, domeMat);
  scene.add(new THREE.Mesh(domeGeo, domeMat));

  const cardGeo = new THREE.PlaneGeometry(1, 1);
  junk.push(cardGeo);
  const card = (
    color: number,
    intensity: number,
    sx: number,
    sy: number,
    pos: [number, number, number],
  ) => {
    const mat = new THREE.MeshBasicMaterial({ color });
    mat.color.multiplyScalar(intensity);
    junk.push(mat);
    const m = new THREE.Mesh(cardGeo, mat);
    m.scale.set(sx, sy, 1);
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };

  card(0xffffff, 6, 14, 22, [12, 10, 14]); // sun, on the day side
  card(0x8fb6ff, 4, 10, 18, [-16, 2, -12]); // cool rim from the night side
  card(0xffb347, 2.2, 16, 8, [0, -14, 6]); // warm bounce from the exhaust side

  return {
    scene,
    dispose: () => junk.forEach((j) => j.dispose()),
  };
}

export function Rocket3D({ phase, boost = false, spin = false }: Rocket3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  // The render loop reads the phase without being torn down and rebuilt, so it
  // lives in a ref that a separate effect keeps in sync.
  const phaseRef = useRef<LaunchPhase>(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const boostRef = useRef(boost);

  useEffect(() => {
    boostRef.current = boost;
  }, [boost]);

  const spinRef = useRef(spin);

  useEffect(() => {
    spinRef.current = spin;
  }, [spin]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(CANVAS_W, CANVAS_H, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearAlpha(0);
    renderer.domElement.className = styles.canvas;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // A modest FOV: enough perspective for the hull to read as a solid, not
    // so much that the long plume skews away from vertical.
    const camera = new THREE.PerspectiveCamera(FOV, CANVAS_W / CANVAS_H, 1, 200);
    const worldH = CANVAS_H / PX_PER_UNIT;
    // The canvas hangs below the rocket, so frame its centre, not the origin.
    const centreY = BOX_TOP - CANVAS_TOP / PX_PER_UNIT - worldH / 2;
    camera.position.set(0, centreY, worldH / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    camera.lookAt(0, centreY, 0);

    const env = buildEnvScene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(env.scene, 0.04);
    scene.environment = envRT.texture;
    env.dispose();
    pmrem.dispose();

    // Sun from the Earth's day side, a cool rim from the night side, and the
    // atmosphere bouncing a little blue up onto the belly.
    const key = new THREE.DirectionalLight(0xfff3e2, 2.6);
    key.position.set(4, 5, 6);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x9fc4ff, 3.2);
    rim.position.set(-5, 1.5, -5);
    scene.add(rim);

    const fill = new THREE.HemisphereLight(0xbcd2ff, 0x2a4266, 0.55);
    scene.add(fill);

    const palette = readPalette();
    const rocket = buildRocket(palette);
    scene.add(rocket.root);

    const exhaust = createExhaust(NOZZLE_EXIT, readFlame());
    rocket.root.add(exhaust.root);

    // The burn lights its own rocket: a point light just under the nozzle,
    // parented to the rocket so it follows the lean, washes the fins and the
    // lower hull warm and flickers with the plume.
    const engineLight = new THREE.PointLight(flameLightColor(), 0, 0, 2);
    engineLight.position.set(0, NOZZLE_EXIT - 0.35, 0);
    rocket.root.add(engineLight);

    const smoke = createSmoke();
    smoke.setProjScale(
      (CANVAS_H * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2))),
    );
    scene.add(smoke.root);

    // The canvas rides on the DOM rocket (float, launch, return), so measure
    // how far that box has moved since the first frame and hand the smoke the
    // world offset that cancels it.
    const body = host.parentElement!;
    let origin: { x: number; y: number } | null = null;
    const anchorSmoke = () => {
      const r = body.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      origin ??= { x: cx, y: r.top };
      const unit = PX_PER_UNIT * (r.height / BOX_H); // CSS scale included
      smoke.setAnchor(-(cx - origin.x) / unit, (r.top - origin.y) / unit);
    };

    // The light theme puts the rocket on a pale sky, so lift the ambient and
    // the exposure to stop the hull reading as a dark cut-out.
    const applyThemeLighting = () => {
      const light = document.documentElement.getAttribute('data-theme') === 'light';
      // Additive light on a pale sky just washes out, so the plume paints
      // over it instead of adding to it in the light theme.
      exhaust.setAdditive(!light);
      fill.intensity = light ? 1.5 : 0.55;
      fill.groundColor.set(light ? 0xc8ccd4 : 0x2a4266);
      rim.intensity = light ? 1.8 : 3.2;
      renderer.toneMappingExposure = light ? 1.25 : 1.05;
    };
    applyThemeLighting();

    /* --- motion state ---------------------------------------------- */

    let yaw = REST_YAW;
    let yawSpeed = 0;
    let restYaw: number | null = REST_YAW;
    let thrust = 0.12;
    let boostAmt = 0;
    let raf = 0;
    const clock = new THREE.Clock();
    let lastPhase: LaunchPhase = phaseRef.current;
    let phaseStart = 0;

    const setEngineLight = (t: number) => {
      const flicker = 0.85 + 0.1 * Math.sin(t * 31) + 0.05 * Math.sin(t * 57 + 1.7);
      engineLight.intensity = (3 + 16 * thrust + 6 * boostAmt) * flicker;
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;

      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const p = phaseRef.current;
      if (p !== lastPhase) {
        lastPhase = p;
        phaseStart = t;
      }

      // Idle holds still and only spins while hovered; launch spins the hull
      // up and lights the engine; the return slows it back down. Once nothing
      // drives it, it coasts on to a resting three-quarter view, so it never
      // stops with the porthole turned away. That rest is picked once, past
      // where the spin would naturally run out, so the hull settles with a
      // small swing back rather than going round again.
      let targetYawSpeed: number;
      if (p === 'launching') targetYawSpeed = 3.4;
      else if (p === 'returning') targetYawSpeed = 1.1;
      else if (spinRef.current) targetYawSpeed = 1.6;
      else {
        restYaw ??= REST_YAW + TAU * Math.ceil((yaw + yawSpeed * 0.6 - REST_YAW - 1e-3) / TAU);
        targetYawSpeed = THREE.MathUtils.clamp((restYaw - yaw) * 1.5, -1.6, 1.6);
      }
      if (p !== 'idle' || spinRef.current) restYaw = null;
      const targetThrust = p === 'launching' ? 1 : p === 'returning' ? 0.45 : 0.12;
      const ease = p === 'launching' ? 6 : 2.2;
      yawSpeed += (targetYawSpeed - yawSpeed) * Math.min(1, dt * ease);
      thrust += (targetThrust - thrust) * Math.min(1, dt * ease);

      yaw += yawSpeed * dt;
      rocket.hull.rotation.y = yaw;

      const sway = p === 'idle' ? Math.sin(t * 0.55) * 0.035 : 0;
      const c = choreography(p, t - phaseStart);
      rocket.root.position.z = c.z;
      rocket.root.scale.set(1 + c.squash * 0.9, 1 - c.squash, 1 + c.squash * 0.9);
      rocket.root.rotation.x = c.pitch;
      rocket.root.rotation.z = sway + (p === 'launching' ? Math.sin(t * 26) * 0.006 : 0);

      const wantBoost = p === 'idle' && boostRef.current ? 1 : 0;
      boostAmt += (wantBoost - boostAmt) * Math.min(1, dt * 5);

      rocket.setThrust(thrust);
      rocket.update(t);
      exhaust.update(t, thrust, boostAmt);
      setEngineLight(t);
      anchorSmoke();
      smoke.update(dt, p !== 'launching', rocket.root, NOZZLE_EXIT);
      renderer.render(scene, camera);
    };

    if (reduced) {
      rocket.hull.rotation.y = yaw;
      rocket.setThrust(0.12);
      rocket.update(0);
      exhaust.update(0, 0.12, 0);
      setEngineLight(0);
      renderer.render(scene, camera);
    } else {
      raf = requestAnimationFrame(frame);
    }

    /* --- theme --------------------------------------------------- */

    const observer = new MutationObserver(() => {
      rocket.setPalette(readPalette());
      exhaust.setColors(readFlame());
      engineLight.color = flameLightColor();
      applyThemeLighting();
      if (reduced) renderer.render(scene, camera);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      scene.remove(rocket.root, smoke.root);
      smoke.dispose();
      exhaust.dispose();
      rocket.dispose();
      envRT.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className={styles.canvasHost} ref={hostRef} aria-hidden="true" />;
}
