import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
} from 'three';
import type { Era } from '../eras/eras.ts';
import { CORRIDOR_RADIUS } from '../gameplay/Track.ts';

/**
 * Cylindrical aura marking a flow corridor. Tinted per-era and tapered along
 * Z so from the space domain the tube vanishes into the galactic distance.
 * Sits as a child of the Flow group — no per-frame ship-Z follow.
 *
 *  - `uProximity`: lights up as the ship (inside) approaches the wall.
 *  - `uOutside`:  keeps the tube softly glowing from the outside so you
 *                 always see where the flow bubble is.
 *  - `uTint`:     era-accent color, so each corridor reads as its own world.
 */

// Long enough that the tube visually tends toward infinity — ends fade softly
// via the shader taper, so you never see the column cap up close even after a
// long session flying along the flow.
const COLUMN_LENGTH_Z = 60000;
const PULSE_SPEED = 1.2;

const VERT = /* glsl */ `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vLocal;
  uniform float uTime;
  uniform float uProximity;
  uniform float uOutside;
  uniform float uHalfLen;
  uniform vec3 uTint;

  void main() {
    float along = vLocal.y / uHalfLen;
    // Very soft taper so the tube reads as tending to infinity — most of the
    // length is full-bright, only the last ~5% fades out toward the ends.
    float taper = 1.0 - smoothstep(0.92, 1.0, abs(along));

    // Two overlapping helices winding around the tube axis in opposite
    // directions produce a circulating "air current" feel. Using raw sines
    // (not smoothstep cutoffs) means the modulation stays smooth at any
    // distance — sharp bands would alias into scintillation from far away.
    float angle = atan(vLocal.x, vLocal.z);
    float axial = vLocal.y * 0.02;
    float h1 = sin(angle * 3.0 + axial - uTime * 2.4);
    float h2 = sin(angle * -2.0 + axial * 0.7 - uTime * 1.6);
    // [0, 1] with 0.5 average — color brightness modulation, never zero so
    // no "gaps" appear between bands.
    float bands = 0.5 + 0.22 * h1 + 0.22 * h2;

    // Floor factor: the cylinder geometry is rotated so the original +Z of
    // the cross-section maps to flow-local -Y (floor). atan(x, z) = 0 there,
    // so cos(angle) is 1 at the floor and -1 at the ceiling. floorK peaks at
    // the floor and fades out by the equator.
    float floorK = max(0.0, cos(angle));
    float floorKSoft = floorK * floorK;

    // Streaming glyph grid on the floor: a rectangular mesh of soft dots
    // scrolling down-axis, overlaid with a faster thin striation so the
    // floor reads as an illuminated processional path rather than a flat
    // glow. Both modulate only color (NOT alpha) to keep the tube uniform.
    float gridCols = 0.5 + 0.5 * sin(angle * 14.0);
    float gridRows = 0.5 + 0.5 * sin(vLocal.y * 0.6 - uTime * 3.2);
    float glyphs = pow(gridCols * gridRows, 3.0);
    float stripes = 0.5 + 0.5 * sin(vLocal.y * 0.25 - uTime * 1.8);
    float floorDetail = floorKSoft * (glyphs * 0.55 + stripes * 0.35);

    // Lower-rim haze — broad luminance boost in the lower half of the tube
    // so the "horizon line" of the corridor is always visible even at full
    // speed. Not localized to any one stripe — a smooth gradient.
    float lowerHalo = floorKSoft * 0.45;

    bands += lowerHalo + floorDetail;

    // Ceiling is kept subtler: a faint top vignette so the tube doesn't feel
    // like a featureless bowl looking up.
    float ceilingK = max(0.0, -cos(angle));
    float ceilingHaze = pow(ceilingK, 3.0) * (0.3 + 0.15 * sin(vLocal.y * 0.08 - uTime * 0.7));
    bands += ceilingHaze * 0.12;

    // CRITICAL: alpha is spatially uniform across the tube surface (depends
    // only on inside/outside/proximity/taper, NOT on bands). The helical
    // look comes from color brightness modulation. This keeps the tube
    // equally visible and equally transparent from any distance — no
    // holes to disappear into, no sharp edges to alias.
    float baseline = 0.09 * (1.0 - uOutside);
    float innerGlow = uProximity * 0.32;
    float outerSkin = uOutside * 0.22;
    // Floor gets a small bump in alpha so the enriched pattern reads —
    // still spatially smooth (no step functions), capped low enough that
    // the tube stays transparent overall.
    float floorAlpha = floorKSoft * 0.12 * (1.0 - uOutside);
    float a = clamp((baseline + innerGlow + outerSkin + floorAlpha) * taper, 0.0, 1.0);

    // Floor tint is warmer/brighter than the ceiling, so the corridor has
    // an up/down axis rather than looking like a neutral tube.
    vec3 floorTint = mix(uTint, uTint * 1.4 + vec3(0.06, 0.04, 0.0), floorKSoft);
    vec3 color = floorTint * (0.4 + 0.85 * bands);
    gl_FragColor = vec4(color, a * 0.36);
  }
`;

function toVec3Dim(hex: number, scale: number): Vector3 {
  const c = new Color(hex);
  return new Vector3(c.r * scale, c.g * scale, c.b * scale);
}

export class CorridorAura {
  readonly group = new Group();
  private material!: ShaderMaterial;
  private readonly tint: Vector3;

  constructor(era: Era) {
    // Dim the accent so the tube reads as tinted glass, not a saturated halo.
    this.tint = toVec3Dim(era.palette.accent, 0.55);
  }

  init(): void {
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uProximity: { value: 0 },
        uOutside: { value: 0 },
        uHalfLen: { value: COLUMN_LENGTH_Z * 0.5 },
        uTint: { value: this.tint },
      },
    });
    const geo = new CylinderGeometry(
      CORRIDOR_RADIUS,
      CORRIDOR_RADIUS,
      COLUMN_LENGTH_Z,
      96,
      1,
      true,
    );
    const mesh = new Mesh(geo, this.material);
    mesh.rotation.x = Math.PI / 2;
    mesh.frustumCulled = false;
    this.group.add(mesh);
  }

  update(dt: number): void {
    this.material.uniforms.uTime.value += dt * PULSE_SPEED;
  }

  setBoundaryProximity(p: number): void {
    this.material.uniforms.uProximity.value = Math.min(1, Math.max(0, p));
  }

  setOutsideFactor(f: number): void {
    this.material.uniforms.uOutside.value = Math.min(1, Math.max(0, f));
  }
}
