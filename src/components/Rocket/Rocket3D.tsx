import { useEffect, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { LaunchPhase } from '../../hooks/useLaunchSequence';
import type { MousePos } from '../../hooks/useParallax';
import { buildRocket, NOSE_TIP, NOZZLE_EXIT, type RocketPalette } from './rocketModel';
import styles from './Rocket.module.css';

/**
 * The CSS rocket occupied a 70x180px box and every exhaust layer is positioned
 * against it, so the 3D nose tip is pinned to the top of that box and the
 * nozzle exit to its bottom. The canvas is larger and centred on the box, which
 * lets fins, antenna and engine bloom spill outside without moving anything.
 */
const BOX_H = 180;
const CANVAS_W = 340;
const CANVAS_H = 460;
const PX_PER_UNIT = BOX_H / (NOSE_TIP - NOZZLE_EXIT);
const FOV = 24;

interface Rocket3DProps {
  phase: LaunchPhase;
  mouseRef?: RefObject<MousePos>;
}

function readPalette(): RocketPalette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    body: v('--rocket-body', '#e6e6e6'),
    dark: v('--rocket-dark', '#151515'),
    windowGlow: v('--window-glow', 'rgba(100, 180, 255, 0.4)'),
    accent: v('--accent-amber', '#ffb347'),
  };
}

/**
 * Studio-in-a-box used only to bake an environment map: a graded sky dome plus
 * a few emissive cards that become the specular highlights on the hull.
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
  g.addColorStop(0.72, '#6f7b90');
  g.addColorStop(1.0, '#141821');
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

  card(0xffffff, 6, 14, 22, [-12, 10, 14]); // key softbox
  card(0x8fb6ff, 4, 10, 18, [16, 2, -12]); // cool rim
  card(0xffb347, 2.2, 16, 8, [0, -14, 6]); // warm bounce from the exhaust side

  return {
    scene,
    dispose: () => junk.forEach((j) => j.dispose()),
  };
}

export function Rocket3D({ phase, mouseRef }: Rocket3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  // The render loop reads the phase without being torn down and rebuilt, so it
  // lives in a ref that a separate effect keeps in sync.
  const phaseRef = useRef<LaunchPhase>(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

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

    // Narrow FOV keeps the silhouette close to the original flat rocket while
    // still giving the hull a little honest perspective.
    const camera = new THREE.PerspectiveCamera(FOV, CANVAS_W / CANVAS_H, 1, 100);
    const worldH = CANVAS_H / PX_PER_UNIT;
    camera.position.z = worldH / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camera.lookAt(0, 0, 0);

    const env = buildEnvScene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(env.scene, 0.04);
    scene.environment = envRT.texture;
    env.dispose();
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xfff3e2, 2.6);
    key.position.set(-4, 5, 6);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0x9fc4ff, 3.2);
    rim.position.set(5, 1.5, -5);
    scene.add(rim);

    const fill = new THREE.HemisphereLight(0xbcd2ff, 0x2a2f3a, 0.55);
    scene.add(fill);

    // The light theme puts the rocket on a pale sky, so lift the ambient and
    // the exposure to stop the hull reading as a dark cut-out.
    const applyThemeLighting = () => {
      const light = document.documentElement.getAttribute('data-theme') === 'light';
      fill.intensity = light ? 1.5 : 0.55;
      fill.groundColor.set(light ? 0xc8ccd4 : 0x2a2f3a);
      rim.intensity = light ? 1.8 : 3.2;
      renderer.toneMappingExposure = light ? 1.25 : 1.05;
    };
    applyThemeLighting();

    const palette = readPalette();
    const rocket = buildRocket(palette);
    scene.add(rocket.root);

    /* --- motion state ---------------------------------------------- */

    let yaw = THREE.MathUtils.degToRad(-28); // start in a readable three-quarter
    let yawSpeed = 0.16;
    let thrust = 0.12;
    const tilt = { x: 0, y: 0 };
    let raf = 0;
    const clock = new THREE.Clock();

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;

      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const p = phaseRef.current;

      // Idle drifts lazily; launch spins the hull up and lights the engine;
      // the return glides back down to the resting cadence.
      const targetYawSpeed = p === 'launching' ? 3.4 : p === 'returning' ? 1.1 : 0.16;
      const targetThrust = p === 'launching' ? 1 : p === 'returning' ? 0.45 : 0.12;
      const ease = p === 'launching' ? 6 : 2.2;
      yawSpeed += (targetYawSpeed - yawSpeed) * Math.min(1, dt * ease);
      thrust += (targetThrust - thrust) * Math.min(1, dt * ease);

      yaw += yawSpeed * dt;
      rocket.hull.rotation.y = yaw;

      // Cursor leans the whole rocket a few degrees — the same parallax
      // language the starfield uses, just in three dimensions.
      const m = mouseRef?.current;
      const wantY = m ? (m.x - 0.5) * 0.5 : 0;
      const wantX = m ? (m.y - 0.5) * 0.34 : 0;
      tilt.y += (wantY - tilt.y) * Math.min(1, dt * 2.5);
      tilt.x += (wantX - tilt.x) * Math.min(1, dt * 2.5);

      const sway = p === 'idle' ? Math.sin(t * 0.55) * 0.035 : 0;
      rocket.root.rotation.y = tilt.y;
      rocket.root.rotation.x = tilt.x;
      rocket.root.rotation.z = sway + (p === 'launching' ? Math.sin(t * 26) * 0.006 : 0);

      rocket.setThrust(thrust);
      rocket.update(t);
      renderer.render(scene, camera);
    };

    if (reduced) {
      rocket.hull.rotation.y = yaw;
      rocket.setThrust(0.12);
      rocket.update(0);
      renderer.render(scene, camera);
    } else {
      raf = requestAnimationFrame(frame);
    }

    /* --- theme --------------------------------------------------- */

    const observer = new MutationObserver(() => {
      rocket.setPalette(readPalette());
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
      scene.remove(rocket.root);
      rocket.dispose();
      envRT.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [mouseRef]);

  return <div className={styles.canvasHost} ref={hostRef} aria-hidden="true" />;
}
