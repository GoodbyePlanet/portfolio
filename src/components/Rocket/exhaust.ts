/**
 * Low-poly engine plume.
 *
 * Two nested, faceted teardrops hanging from the nozzle: an amber outer flame
 * and a short white-hot core. The vertex shader wobbles each vertex on its own
 * phase so the facets shimmer and the tip licks side to side; the fragment
 * shader lights every facet flat, matching the hull. Thrust drives length,
 * width and brightness, so the same meshes cover the idle burn and the launch.
 */
import * as THREE from 'three';

/** Radial facets — one fewer than the hull, so the flame never looks like an
 *  extension of the bell. */
const SIDES = 7;
const FLAME_R = 0.34;
const CORE_R = 0.18;

export interface ExhaustColors {
  core: string;
  mid: string;
  tail: string;
}

export interface Exhaust {
  root: THREE.Group;
  setColors(c: ExhaustColors): void;
  /** Additive over a dark sky; normal over a pale one, where adding light
   *  would only wash the plume out. */
  setAdditive(additive: boolean): void;
  /** thrust: 0 idle .. 1 launch. boost: extra length while hovered. */
  update(time: number, thrust: number, boost: number): void;
  dispose(): void;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWobble;

  varying float vAlong;
  varying vec3 vViewPos;

  float hash(vec3 p) {
    // Quantised so the lathe's duplicated seam vertices hash identically and
    // the mesh never tears open.
    p = floor(p * 1000.0 + 0.5);
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  void main() {
    vec3 p = position;
    float along = -p.y;              // 0 at the nozzle, 1 at the tip
    float h = hash(position);

    // The nozzle ring stays put; everything below breathes on its own phase.
    float wob = sin(uTime * (9.0 + 7.0 * h) + h * 6.2832);
    p.xz *= 1.0 + uWobble * 0.16 * wob * along;
    p.y *= 1.0 + uWobble * 0.07 * wob * along;
    // The tip licks side to side.
    p.x += uWobble * 0.1 * along * along * sin(uTime * 6.3);
    p.z += uWobble * 0.06 * along * along * sin(uTime * 4.7 + 1.3);

    vAlong = along;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform float uOpacity;

  varying float vAlong;
  varying vec3 vViewPos;

  void main() {
    // Face normal from screen-space derivatives: every triangle gets one
    // flat shade, whatever the wobble has done to it.
    vec3 n = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
    float facet = 0.62 + 0.38 * max(dot(n, normalize(vec3(-0.5, 0.35, 0.8))), 0.0);

    vec3 col = mix(uTop, uBottom, smoothstep(0.1, 0.9, vAlong)) * facet;
    float alpha = uOpacity * (1.0 - smoothstep(0.55, 1.0, vAlong));
    gl_FragColor = vec4(col, alpha);
  }
`;

/** Teardrop that swells just under the nozzle, then tapers to a point. */
function flameGeometry(radius: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const STEPS = 5;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const r = radius * (1 + 0.3 * Math.sin(t * Math.PI * 0.8)) * Math.pow(1 - t, 0.75);
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), -t));
  }
  return new THREE.LatheGeometry(pts, SIDES);
}

export function createExhaust(nozzleY: number, colors: ExhaustColors): Exhaust {
  const root = new THREE.Group();
  // Start a touch inside the bell so the flame reads as coming out of it.
  root.position.y = nozzleY + 0.06;

  const layer = (radius: number, top: THREE.Color, bottom: THREE.Color, order: number) => {
    const uniforms = {
      uTime: { value: 0 },
      uWobble: { value: 1 },
      uOpacity: { value: 1 },
      uTop: { value: top },
      uBottom: { value: bottom },
    };
    const geometry = flameGeometry(radius);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = order;
    root.add(mesh);
    return { mesh, uniforms, geometry, material };
  };

  const outer = layer(
    FLAME_R,
    new THREE.Color(colors.mid),
    new THREE.Color(colors.tail),
    2,
  );
  const core = layer(
    CORE_R,
    new THREE.Color(colors.core),
    new THREE.Color(colors.mid),
    3,
  );
  const layers = [outer, core];

  // Painted rather than added, the plume would sit on the pale sky as a flat
  // opaque slab, so it is thinned out a little there.
  let paintedOpacity = 1;

  return {
    root,
    setAdditive: (additive) => {
      const next = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      paintedOpacity = additive ? 1 : 0.8;
      for (const l of layers) {
        if (l.material.blending === next) continue;
        l.material.blending = next;
        l.material.needsUpdate = true;
      }
    },
    setColors: (c) => {
      outer.uniforms.uTop.value.set(c.mid);
      outer.uniforms.uBottom.value.set(c.tail);
      core.uniforms.uTop.value.set(c.core);
      core.uniforms.uBottom.value.set(c.mid);
    },
    update: (time, thrust, boost) => {
      const len = THREE.MathUtils.lerp(3.2, 6.2, thrust) + 1.3 * boost;
      const width = THREE.MathUtils.lerp(0.85, 1.15, thrust);
      // Combustion never burns steady.
      const flicker = 0.94 + 0.06 * Math.sin(time * 23.0) * Math.sin(time * 7.1);

      outer.mesh.scale.set(width, len * flicker, width);
      core.mesh.scale.set(width, len * 0.42 * flicker, width);

      for (const l of layers) {
        l.uniforms.uTime.value = time;
        l.uniforms.uWobble.value = 0.7 + 0.5 * thrust;
      }
      outer.uniforms.uOpacity.value = (0.55 + 0.35 * thrust) * paintedOpacity;
      core.uniforms.uOpacity.value = 0.9 * paintedOpacity;
    },
    dispose: () => {
      for (const l of layers) {
        l.geometry.dispose();
        l.material.dispose();
      }
    },
  };
}
