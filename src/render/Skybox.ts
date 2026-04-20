import {
  BackSide,
  Color,
  Matrix3,
  Matrix4,
  Mesh,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
} from 'three';
import type { Era, EraId } from '../eras/eras.ts';

const SKYLINE_BY_ERA: Record<EraId, number> = {
  egypt: 0,
  greece: 1,
  china: 2,
  islamic: 3,
  india: 4,
  renaissance: 5,
  edo: 6,
  enlightenment: 7,
  revolution: 8,
  codebreakers: 9,
};

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Dual-mode sky.
 *
 *  - Inside the corridor (`uOutside = 0`) we render the Egyptian sky:
 *    dusk gradient, Amun-Ra sun, pyramid silhouettes, warm stars.
 *  - Outside (`uOutside ≈ 1`), we cross-fade into a deep-blue starfield
 *    decorated with slow spiral galaxies. Same sphere, different look.
 *
 * The game drives `uOutside` from the ship's lateral distance to the
 * corridor axis, so walking through the boundary aura smoothly swaps
 * atmospheres.
 */
const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uScroll;
  uniform vec3 uSky;
  uniform vec3 uGlow;
  uniform vec3 uDust;
  uniform float uStarBrightness;
  uniform float uOutside; // 0 = inside corridor, 1 = deep outside
  // Era selector for the inside-sky silhouette (0 egypt … 9 codebreakers).
  uniform int uSkyline;
  // Rotation that maps a world-space view direction into the active flow's
  // local frame. The inside-sky features (horizon, silhouette, sun) use this
  // so the horizon always sits level with the flow's floor — without it, a
  // tilted flow makes the horizon look curved/slanted from the cockpit.
  // Galactic outside sky is left in world frame so other tubes don't appear
  // to spin when the active flow changes.
  uniform mat3 uSkyBasis;
  varying vec3 vDir;

  float hash1(vec2 p) {
    p = fract(p * vec2(233.34, 851.73));
    p += dot(p, p.yx + 23.45);
    return fract(p.x * p.y);
  }

  // Cheap 2D noise from smoothed hash on a grid.
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash1(i);
    float b = hash1(i + vec2(1.0, 0.0));
    float c = hash1(i + vec2(0.0, 1.0));
    float d = hash1(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      v += vnoise(p) * amp;
      p *= 2.0;
      amp *= 0.5;
    }
    return v;
  }

  // Pseudo-3D FBM, continuous over the full sphere — two orthogonal 2D
  // projections blended so the (azim, elev) seam at ±π disappears.
  float fbm3(vec3 p) {
    return 0.5 * fbm(p.xy + p.z * 0.37) + 0.5 * fbm(p.yz + p.x * 0.23);
  }

  // Spiral-galaxy kernel: bright core, logarithmic arms with dust lanes.
  // center in (azim, elev); tilt rotates the disk; twirl advances arms.
  // Returns a 3-component color. Arm regions are tinted (emission + stars),
  // the core is warmer/redder (not white), and interleaved dust lanes carve
  // darker bands so the disk doesn't read as a blown-out blob.
  vec3 galaxy(vec2 uv, vec2 center, float tilt, float scale, float twirl, vec3 tint) {
    vec2 d = uv - center;
    float ca = cos(tilt), sa = sin(tilt);
    d = vec2(d.x * ca - d.y * sa, d.x * sa + d.y * ca);
    d.y *= 1.8;
    float r = length(d) / scale;
    float a = atan(d.y, d.x);
    // Two-armed log spiral.
    float spiral = (a * 2.0) - log(r + 0.02) * 2.6 - twirl;
    float arm = cos(spiral) * 0.5 + 0.5;
    // A second, slightly-offset spiral acts as a dust lane that darkens the
    // arm's leading edge, giving the disk layered structure.
    float dust = 1.0 - (cos(spiral + 0.55) * 0.5 + 0.5);
    float armBright = arm * exp(-r * 1.9) * 0.55;
    // Fine granularity along the arms — twinkling HII regions.
    float grain = fbm(vec2(a * 6.0 + twirl * 0.5, r * 14.0));
    armBright *= 0.55 + 0.8 * grain;
    // Warm core — reddish/amber, not bright white.
    vec3 coreTint = mix(tint, vec3(1.0, 0.55, 0.25), 0.75);
    float coreHot = exp(-r * 8.5) * 0.85;
    float coreSoft = exp(-r * 3.2) * 0.22;
    float halo = exp(-r * 0.9) * 0.09;
    float dustMask = smoothstep(0.15, 0.9, dust) * exp(-r * 2.2) * 0.55;
    vec3 col = tint * armBright + coreTint * coreHot + coreTint * coreSoft + tint * halo;
    // Carve the dust lanes.
    col *= 1.0 - dustMask;
    return col;
  }

  void main() {
    vec3 dirWorld = normalize(vDir);
    // Inside sky uses the flow-local direction so horizon aligns with the
    // flow's floor. Outside galactic sky keeps world-frame direction.
    vec3 dirLocal = normalize(uSkyBasis * dirWorld);
    float azim = atan(dirLocal.x, -dirLocal.z);
    float elev = asin(clamp(dirLocal.y, -1.0, 1.0));
    vec3 dir = dirWorld;
    float azimWorld = atan(dirWorld.x, -dirWorld.z);
    float elevWorld = asin(clamp(dirWorld.y, -1.0, 1.0));

    // Compute only the side of the blend that actually contributes. The galactic
    // path (multiple fbm3 calls + 4 galaxy kernels) is the expensive one, so
    // skipping it while inside the corridor recovers a lot of fragment time.
    vec3 egyptSky = vec3(0.0);
    vec3 spaceSky = vec3(0.0);
    float oClamp = clamp(uOutside, 0.0, 1.0);
    bool doEgypt = oClamp < 0.999;
    bool doSpace = oClamp > 0.001;

    if (doEgypt) {
      // ===== Egyptian sky (inside corridor) =====
      // Deep dusk palette — noticeably darker so pale gold pickups pop.
      float t = clamp(elev / 1.2, -0.2, 1.0);
      vec3 nightTop = uSky * 0.18;
      vec3 deepBlue = mix(uSky, vec3(0.02, 0.015, 0.07), 0.7);
      vec3 duskAmber = vec3(0.18, 0.08, 0.03);
      vec3 horizonSand = mix(uGlow, vec3(0.16, 0.08, 0.03), 0.8);
      if (t > 0.55) egyptSky = mix(deepBlue, nightTop, smoothstep(0.55, 1.0, t));
      else if (t > 0.2) egyptSky = mix(duskAmber, deepBlue, smoothstep(0.2, 0.55, t));
      else egyptSky = mix(horizonSand, duskAmber, smoothstep(-0.18, 0.2, t));

      // ---- Horizon silhouettes (per-era) ----
      // A distant skyline of era-specific landmarks + low rolling terrain
      // hugging the horizon. The silhouette profile is selected by uSkyline.
      if (elev < 0.24 && elev > -0.12) {
        float duneBand = hash1(vec2(azim * 5.3, 0.0)) * 0.5
                       + hash1(vec2(azim * 13.7, 2.0)) * 0.3
                       + hash1(vec2(azim * 29.1, 5.0)) * 0.2;
        float duneHeight = -0.02 + duneBand * 0.06;
        float inDune = 1.0 - smoothstep(duneHeight - 0.01, duneHeight + 0.01, elev);
        // Tint terrain toward a dark version of the era's dust color so the
        // floor harmonizes with the rest of the palette instead of always
        // reading Egypt-brown.
        vec3 terrainCol = uDust * 0.18;
        egyptSky = mix(egyptSky, terrainCol, inDune * 0.75);

        float sil = 0.0;

        if (uSkyline == 0) {
          // Egypt — 4 octaves of sharp pyramid triangles.
          for (int i = 0; i < 4; i++) {
            float fi = float(i);
            float freq = 1.3 + fi * 0.9;
            float phase = fi * 1.37;
            float ax = fract(azim * freq * 0.5 + phase) - 0.5;
            sil = max(sil, max(0.0, 0.14 - abs(ax) * 0.55));
          }
        } else if (uSkyline == 1) {
          // Greece — Doric column rows topped with triangular pediments.
          for (int i = 0; i < 5; i++) {
            float fi = float(i);
            float freq = 1.9 + fi * 0.55;
            float phase = fi * 0.91;
            float ax = fract(azim * freq * 0.5 + phase) - 0.5;
            float shaft = step(abs(ax), 0.07) * 0.10;
            float pediment = max(0.0, 0.14 - abs(ax) * 1.2);
            sil = max(sil, max(shaft, pediment));
          }
        } else if (uSkyline == 2) {
          // China — pagodas: stepped tiers of swept curved roofs.
          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float freq = 0.9 + fi * 0.9;
            float phase = fi * 1.57;
            float ax = fract(azim * freq * 0.5 + phase) - 0.5;
            float base = step(abs(ax), 0.13) * 0.04;
            float mid  = step(abs(ax), 0.09) * 0.07;
            float top  = max(0.0, 0.16 - abs(ax) * 2.6);
            sil = max(sil, max(max(base, mid), top));
          }
        } else if (uSkyline == 3) {
          // Islamic — bulbous domes flanked by thin minarets.
          for (int i = 0; i < 4; i++) {
            float fi = float(i);
            float freq = 1.15 + fi * 0.7;
            float phase = fi * 1.11;
            float ax = fract(azim * freq * 0.5 + phase) - 0.5;
            float dome = sqrt(max(0.0, 0.02 - ax * ax)) * 0.95;
            float minaret = step(abs(ax - 0.17), 0.018) * 0.17
                           + step(abs(ax + 0.17), 0.018) * 0.17;
            sil = max(sil, max(dome, minaret));
          }
        } else if (uSkyline == 4) {
          // India — curved shikhara spires (parabolic bulge narrowing to a point).
          for (int i = 0; i < 4; i++) {
            float fi = float(i);
            float freq = 1.4 + fi * 0.65;
            float phase = fi * 1.81;
            float ax = fract(azim * freq * 0.5 + phase) - 0.5;
            float spire = max(0.0, 0.16 - pow(abs(ax), 0.75) * 0.8);
            sil = max(sil, spire);
          }
        } else if (uSkyline == 5) {
          // Renaissance — one large central dome plus flanking bell towers.
          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float freq = 0.85 + fi * 0.55;
            float phase = fi * 2.09;
            float ax = fract(azim * freq * 0.5 + phase) - 0.5;
            float dome = sqrt(max(0.0, 0.028 - ax * ax)) * 1.05;
            float tower = step(abs(ax - 0.22), 0.03) * 0.11
                         + step(abs(ax + 0.22), 0.03) * 0.11;
            sil = max(sil, max(dome, tower));
          }
        } else if (uSkyline == 6) {
          // Edo — torii gates: two posts, thick horizontal lintel on top.
          for (int i = 0; i < 5; i++) {
            float fi = float(i);
            float freq = 1.6 + fi * 0.45;
            float phase = fi * 1.43;
            float ax = fract(azim * freq * 0.5 + phase) - 0.5;
            float postL = step(abs(ax - 0.10), 0.025) * 0.12;
            float postR = step(abs(ax + 0.10), 0.025) * 0.12;
            float lintel = step(abs(ax), 0.14) * step(0.095, abs(ax - 0.0) + 0.0)
                         * smoothstep(0.02, 0.00, abs(elev - 0.11)) * 0.02;
            // Simplified: replace lintel with a plateau at top of posts
            float plateau = step(abs(ax), 0.14) * 0.11 * step(-0.02, elev);
            sil = max(sil, max(max(postL, postR), max(lintel, plateau * 0.8)));
          }
        } else if (uSkyline == 7) {
          // Enlightenment — domed observatories on rectangular stone bases.
          for (int i = 0; i < 4; i++) {
            float fi = float(i);
            float freq = 1.05 + fi * 0.7;
            float phase = fi * 1.23;
            float ax = fract(azim * freq * 0.5 + phase) - 0.5;
            float dome = sqrt(max(0.0, 0.02 - ax * ax)) * 0.9;
            float base = step(abs(ax), 0.12) * 0.05;
            sil = max(sil, max(dome, base));
          }
        } else if (uSkyline == 8) {
          // Revolution — industrial skyline: smokestacks and low factory roofs.
          for (int i = 0; i < 5; i++) {
            float fi = float(i);
            float freq = 1.7 + fi * 0.45;
            float phase = fi * 0.77;
            float ax = fract(azim * freq * 0.5 + phase) - 0.5;
            float stack = step(abs(ax), 0.035) * 0.16;
            float factory = step(abs(ax), 0.2) * 0.06;
            sil = max(sil, max(stack, factory));
          }
        } else {
          // Codebreakers — angular modern: radio masts, flat-roof buildings.
          for (int i = 0; i < 6; i++) {
            float fi = float(i);
            float freq = 2.1 + fi * 0.35;
            float phase = fi * 0.61;
            float ax = fract(azim * freq * 0.5 + phase) - 0.5;
            float mast = step(abs(ax), 0.022) * 0.14;
            float block = step(abs(ax), 0.14) * 0.055;
            sil = max(sil, max(mast, block));
          }
        }

        float inSil = 1.0 - smoothstep(sil - 0.005, sil + 0.005, elev);
        inSil *= step(-0.02, elev);
        // Silhouette tint — a very dark version of the era's dust color so
        // buildings read as dusk-lit architecture, not pure black cutouts.
        vec3 silCol = uDust * 0.09;
        egyptSky = mix(egyptSky, silCol, inSil * 0.92);
      }

      // Sun — small, just under bloom threshold.
      float sunAz = 0.28;
      float sunEl = 0.13;
      vec2 sunDelta = vec2(azim - sunAz, elev - sunEl);
      float sunDist = length(sunDelta);
      float coreS = smoothstep(0.048, 0.015, sunDist);
      float glowS = smoothstep(0.3, 0.0, sunDist);
      egyptSky += vec3(0.82, 0.62, 0.24) * coreS * 0.75;
      egyptSky += vec3(0.55, 0.24, 0.09) * glowS * 0.2;

      float haze = smoothstep(0.28, -0.04, elev) * smoothstep(-0.22, -0.02, elev);
      egyptSky += uDust * haze * 0.08;

      if (elev > 0.18) {
        vec2 starUV = vec2(azim * 42.0, elev * 58.0);
        vec2 cell = floor(starUV);
        vec2 local = fract(starUV) - 0.5;
        float sh = hash1(cell);
        float pick = step(0.9965, sh);
        float d = length(local);
        float star = pick * (1.0 - smoothstep(0.04, 0.22, d)) * uStarBrightness;
        star *= 0.55 + 0.45 * sin(uTime * 2.4 + sh * 30.0);
        egyptSky += vec3(star * 0.95, star * 0.85, star * 0.55);
      }
    }

    if (doSpace) {
      // ===== Galactic sky (outside corridor) — WORLD FRAME =====
      vec3 zenith = vec3(0.0008, 0.0016, 0.010);
      vec3 equator = vec3(0.004, 0.010, 0.032);
      spaceSky = mix(equator, zenith, smoothstep(-0.3, 0.8, elevWorld));

      vec3 nP = dirWorld * 2.4 + vec3(uTime * 0.012, 0.0, 0.0);
      float neb = fbm3(nP);
      vec3 nebulaTint = mix(vec3(0.05, 0.10, 0.32), vec3(0.28, 0.10, 0.40), fbm3(dirWorld * 0.9));
      spaceSky += nebulaTint * pow(neb, 2.6) * 0.32;

      vec2 starUV2 = vec2(azimWorld * 110.0, elevWorld * 130.0);
      vec2 cell2 = floor(starUV2);
      vec2 local2 = fract(starUV2) - 0.5;
      float sh2 = hash1(cell2);
      float pick2 = step(0.9955, sh2);
      float d2 = length(local2);
      float star2 = pick2 * (1.0 - smoothstep(0.04, 0.22, d2));
      float twinkle = 0.5 + 0.5 * sin(uTime * (1.5 + sh2 * 3.0) + sh2 * 50.0);
      spaceSky += vec3(0.62, 0.78, 1.0) * star2 * (0.7 + 0.3 * twinkle) * 0.65;

      vec3 galax = vec3(0.0);
      galax += galaxy(vec2(azimWorld, elevWorld),
                      vec2(-2.1, 0.35) + vec2(uTime * 0.003, 0.0), 0.6, 0.45,
                      uTime * 0.11, vec3(0.35, 0.52, 0.85));
      galax += galaxy(vec2(azimWorld, elevWorld),
                      vec2(1.4, -0.2), -0.9, 0.55,
                      uTime * 0.09 + 1.3, vec3(0.62, 0.32, 0.82));
      galax += galaxy(vec2(azimWorld, elevWorld),
                      vec2(0.2, 0.85), 1.7, 0.42,
                      uTime * 0.07 + 2.4, vec3(0.85, 0.48, 0.30));
      galax += galaxy(vec2(azimWorld, elevWorld),
                      vec2(-0.9, -0.55), 0.2, 0.38,
                      uTime * 0.13 + 3.9, vec3(0.25, 0.70, 0.72));
      spaceSky += galax * 0.75;
    }

    vec3 sky = mix(egyptSky, spaceSky, oClamp);
    gl_FragColor = vec4(sky, 1.0);
  }
`;

export class Skybox {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private readonly _m4 = new Matrix4();

  constructor(era: Era) {
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uSky: { value: new Color(era.palette.bg) },
        uGlow: { value: new Color(era.palette.accent) },
        uDust: { value: new Color(era.palette.primary) },
        uStarBrightness: { value: era.skybox.starBrightness },
        uOutside: { value: 0 },
        uSkyBasis: { value: new Matrix3() },
        uSkyline: { value: SKYLINE_BY_ERA[era.id] },
      },
    });
    this.mesh = new Mesh(new SphereGeometry(500, 48, 24), this.material);
    this.mesh.frustumCulled = false;
  }

  /**
   * Orient the inside-sky so its horizon aligns with the active flow's local
   * XZ plane. Pass the flow's inverse quaternion — the shader multiplies
   * view directions by this basis to look them up in flow-local coords.
   */
  setFlowOrientation(inverseQuat: Quaternion): void {
    this._m4.makeRotationFromQuaternion(inverseQuat);
    (this.material.uniforms.uSkyBasis.value as Matrix3).setFromMatrix4(this._m4);
  }

  update(dt: number, scroll = 0): void {
    this.material.uniforms.uTime.value += dt;
    this.material.uniforms.uScroll.value = scroll;
  }

  /** 0 = inside corridor (Egyptian sky), 1 = deep outside (galactic night). */
  setOutsideFactor(f: number): void {
    this.material.uniforms.uOutside.value = Math.min(1, Math.max(0, f));
  }

  /** Swap era palette for the inside sky. */
  setEra(era: Era): void {
    const u = this.material.uniforms;
    (u.uSky.value as Color).setHex(era.palette.bg);
    (u.uGlow.value as Color).setHex(era.palette.accent);
    (u.uDust.value as Color).setHex(era.palette.primary);
    u.uStarBrightness.value = era.skybox.starBrightness;
    u.uSkyline.value = SKYLINE_BY_ERA[era.id];
  }
}
