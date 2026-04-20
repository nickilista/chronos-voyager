import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
} from 'three';
import { Assets } from './Assets.ts';
import type { ShipClass } from '../shipbuilder/shipTypes.ts';

/**
 * Per-ship propulsion flame.
 *
 * The assembled modular ship exposes an `engine_main` slot group with its
 * nozzle anchored at +Z in assembly-local space (that's the "back" of the
 * fighter in three.js convention where the nose points -Z). We attach a
 * Thruster as a child of that slot group, so the flame automatically
 * inherits whichever engine's position / scale / class the loadout picks.
 *
 * The geometry now comes from two preloaded cone GLBs — `engine_trail_core`
 * (tight, bright) and `engine_trail` (soft, wide halo). Previously these
 * were built in code as ConeGeometry primitives; switching to GLBs lets us
 * iterate on the trail silhouette in Blender without shipping a new build
 * and keeps render shape parity across engines. We still clone+tint rather
 * than rely on the GLB's authored material because we need per-class hues
 * (players distinguish engines at a glance — blue falcon vs red titan)
 * and the additive-blending, depthWrite-off look that sells the plasma.
 *
 * Both cones have their BASE translated to the group origin so scaling
 * their length (mesh-Y, which becomes world-Z after the 90° rotation)
 * stretches them aft-ward from the nozzle without sliding the base off
 * the engine mount.
 *
 * Per-class variation lives in `ENGINE_PALETTES`: each ship's engine has a
 * distinct hue (blue/white falcon, red titan, green viper…), a relative
 * length (nimble viper flare vs. stubby golem forge), and a pulse
 * frequency (slow bass throb for heavy engines, fast buzz for interceptors).
 *
 * Boost-depleted state. When the player drains their boost reservoir to 0,
 * `boostDepleted` is flagged true by Ship until the bar refills. The flame
 * visibly chokes — truncated length, muted halo color, subtle hi-freq
 * flicker, dim opacity — so the failure is legible without the player
 * having to watch the HUD. A `depletedT` tween lets the state slide in
 * and out smoothly (~0.8s) so it doesn't pop on toggle.
 */

interface ThrusterPalette {
  /** Inner core color — hot, saturated, bright. */
  core: number;
  /** Outer halo color — cooler, softer, wider. */
  halo: number;
  /** Multiplier on the base flame length. 0.8 = stubby, 1.3 = long jet. */
  lengthScale: number;
  /** Radius multiplier on the flame width. 0.8 = thin, 1.2 = bulky. */
  widthScale: number;
  /** Flicker frequency in Hz — higher reads as a whinier, more excited engine. */
  pulseHz: number;
}

/**
 * Engine palette per ship class. Tuned to the personality in ships-config.json:
 *
 *   • falcon    — versatile all-rounder → cool blue-white jet, medium pulse
 *   • titan     — heavy hauler          → bulky orange/red, slow throb
 *   • phantom   — stealth cruiser       → dim violet, slow pulse (low signature)
 *   • viper     — interceptor           → bright green, fast buzzy flicker
 *   • mantis    — bio-organic           → yellow-green bio pulse
 *   • centurion — gold-plated tank      → yellow-gold steady burn
 *   • nova      — plasma warship        → magenta/pink flare
 *   • kraken    — alien/squid hull      → teal-cyan deep pulse
 *   • valkyrie  — angelic interceptor   → pure white + cyan halo
 *   • golem     — rock-forged heavy     → deep red forge glow, slow
 */
const ENGINE_PALETTES: Record<ShipClass, ThrusterPalette> = {
  falcon:    { core: 0xcfe7ff, halo: 0x3a9dff, lengthScale: 1.0,  widthScale: 1.0,  pulseHz: 8 },
  titan:     { core: 0xffb870, halo: 0xff4418, lengthScale: 0.85, widthScale: 1.2,  pulseHz: 5 },
  phantom:   { core: 0xcfb0ff, halo: 0x5020b0, lengthScale: 1.1,  widthScale: 0.85, pulseHz: 3 },
  viper:     { core: 0xc8ffb0, halo: 0x20d024, lengthScale: 1.3,  widthScale: 0.85, pulseHz: 14 },
  mantis:    { core: 0xe0ff90, halo: 0x74c818, lengthScale: 1.0,  widthScale: 1.05, pulseHz: 6 },
  centurion: { core: 0xfff0a8, halo: 0xd4a020, lengthScale: 0.95, widthScale: 1.1,  pulseHz: 7 },
  nova:      { core: 0xffb0ff, halo: 0xc820c0, lengthScale: 1.2,  widthScale: 1.0,  pulseHz: 9 },
  kraken:    { core: 0xa8ffe8, halo: 0x18b8a0, lengthScale: 1.1,  widthScale: 1.05, pulseHz: 5 },
  valkyrie:  { core: 0xffffff, halo: 0x50f0ff, lengthScale: 1.05, widthScale: 0.95, pulseHz: 10 },
  golem:     { core: 0xff9050, halo: 0x901010, lengthScale: 0.8,  widthScale: 1.25, pulseHz: 4 },
};

/** Nominal flame length in assembly-local units (before per-class scaling).
 *  Matches the pre-GLB `BASE_LENGTH` so ships don't suddenly grow longer
 *  trails on the asset swap. */
const BASE_LENGTH = 2.8;
/** Core-to-halo ratios. Core is narrower and shorter so the bright inner
 *  flame sits *inside* the soft halo wash, giving the "fire inside a plume"
 *  look the old procedural cones produced (0.22 / 0.48 core/halo radius,
 *  0.72 core/halo length). */
const CORE_WIDTH_RATIO = 0.6;
const CORE_LENGTH_RATIO = 0.7;
/** Smoothing half-life for the boost-depleted blend. 0.8s = ~0.55 per frame
 *  at 60fps, slow enough to read as "engine recovering" rather than "bug". */
const DEPLETED_RESTORE_SECONDS = 0.8;
/** Boost warms the core toward white by this much — 40% lerp to 0xffffff,
 *  consistent with the "boost looks hotter" intuition. */
const BOOST_WHITEN = 0.4;
/** Depleted halo fades toward this near-black so the flame reads as choked,
 *  not just dimmer. 60% lerp toward 0x222222. */
const DEPLETED_HALO_TINT = 0x222222;
const DEPLETED_HALO_MIX = 0.6;
/** Max length while depleted: no matter the throttle, the flame is
 *  visibly stumped. */
const DEPLETED_LENGTH_CAP = 0.35;

/**
 * Walk a cloned GLB scene and return the first mesh found. The trail GLBs
 * are authored as a single cone mesh so the first hit is authoritative;
 * if a future export adds camera rigs or empties we'll still land on the
 * cone itself. Throws if the GLB has no mesh, because that's a content bug
 * not a runtime condition.
 */
function findFirstMesh(root: Object3D): Mesh {
  let found: Mesh | null = null;
  root.traverse((obj) => {
    if (!found && (obj as Mesh).isMesh) found = obj as Mesh;
  });
  if (!found) throw new Error('Thruster GLB contained no Mesh');
  return found;
}

/**
 * Normalize a raw trail cone into "base at origin, apex at +Y = length".
 *
 * The source GLB is a plain ConeGeometry-ish mesh whose scale and
 * orientation at export time are undefined (the modeling tool may have
 * centered on apex, on midpoint, or at an arbitrary offset; it may use +Y,
 * +Z, or a scaled axis). We:
 *   1. Compute the AABB once and read off the dominant extent as the
 *      source length, plus its midpoint offset along the same axis.
 *   2. Translate the geometry so the base (the wide end) sits at origin
 *      and the apex points up +Y.
 *   3. Uniformly rescale so the mesh length equals the passed `targetLen`
 *      and the mesh radius equals `targetRadius`. That way the palette's
 *      `lengthScale`/`widthScale` fields still work the same as before
 *      and aren't multiplied by whatever random unit the GLB was authored in.
 *
 * After this, `rotation.x = PI/2` on the mesh (applied by the caller) maps
 * mesh-+Y to world-+Z so the flame extends aft. The Ship-side slot rig
 * further rotates the engine slot into ship-aft world-space.
 */
function normalizeTrailGeometry(
  geom: BufferGeometry,
  targetLen: number,
  targetRadius: number,
): void {
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  if (!bb) throw new Error('Thruster GLB geometry has no boundingBox');
  const sizeX = bb.max.x - bb.min.x;
  const sizeY = bb.max.y - bb.min.y;
  const sizeZ = bb.max.z - bb.min.z;

  // Pick the longest axis as "length". Cone author convention is usually +Y,
  // but we detect rather than assume so a sideways-exported GLB still works.
  // We only rotate via swaps for the two common cases (Y-up or Z-up cones).
  let srcLen: number;
  let srcRadius: number;
  if (sizeY >= sizeX && sizeY >= sizeZ) {
    // Already Y-up. Translate so bb.min.y == 0 (base at origin, assuming
    // the base is the wider end — which it is for ConeGeometry: the base
    // is at -length/2 after ConeGeometry's default centered build).
    geom.translate(
      -(bb.min.x + bb.max.x) / 2,
      -bb.min.y,
      -(bb.min.z + bb.max.z) / 2,
    );
    srcLen = sizeY;
    srcRadius = Math.max(sizeX, sizeZ) / 2;
  } else if (sizeZ >= sizeX && sizeZ >= sizeY) {
    // Z-up cone: rotate mesh so the length axis becomes +Y, then translate.
    // rotation matrix: (x,y,z) -> (x, z, -y).
    geom.rotateX(-Math.PI / 2);
    geom.computeBoundingBox();
    const bb2 = geom.boundingBox;
    if (!bb2) throw new Error('Thruster GLB geometry has no boundingBox');
    geom.translate(
      -(bb2.min.x + bb2.max.x) / 2,
      -bb2.min.y,
      -(bb2.min.z + bb2.max.z) / 2,
    );
    srcLen = bb2.max.y - bb2.min.y;
    srcRadius = Math.max(bb2.max.x - bb2.min.x, bb2.max.z - bb2.min.z) / 2;
  } else {
    // X-up cone: rotate -Z so +X becomes +Y.
    geom.rotateZ(Math.PI / 2);
    geom.computeBoundingBox();
    const bb2 = geom.boundingBox;
    if (!bb2) throw new Error('Thruster GLB geometry has no boundingBox');
    geom.translate(
      -(bb2.min.x + bb2.max.x) / 2,
      -bb2.min.y,
      -(bb2.min.z + bb2.max.z) / 2,
    );
    srcLen = bb2.max.y - bb2.min.y;
    srcRadius = Math.max(bb2.max.x - bb2.min.x, bb2.max.z - bb2.min.z) / 2;
  }

  // Scale to unit length/radius spec. Guard against degenerate dims so a
  // flat export doesn't Infinity-scale.
  const sY = srcLen > 1e-6 ? targetLen / srcLen : 1;
  const sR = srcRadius > 1e-6 ? targetRadius / srcRadius : 1;
  geom.scale(sR, sY, sR);
}

export class Thruster {
  readonly group = new Group();
  private core: Mesh | null = null;
  private halo: Mesh | null = null;
  private readonly palette: ThrusterPalette;
  private readonly coreMat: MeshBasicMaterial;
  private readonly haloMat: MeshBasicMaterial;
  private readonly coreBaseColor: Color;
  private readonly haloBaseColor: Color;
  private readonly whiteColor = new Color(0xffffff);
  private readonly depletedColor = new Color(DEPLETED_HALO_TINT);
  /** Scratch Color reused every frame so we don't allocate inside update(). */
  private readonly tmpColor = new Color();
  private time = 0;
  /** Eased 0..1 indicator: 1 = fully depleted visual state, 0 = healthy. */
  private depletedT = 0;
  /** Tracks whether we logged the first-frame bounding box debug line. */
  private loggedBounds = false;

  constructor(engineClass: ShipClass) {
    this.palette = ENGINE_PALETTES[engineClass];

    // Build the materials up-front so dispose() has something to free even
    // if the geometry mount below somehow throws. Colors stored separately
    // (`coreBaseColor` etc.) because we lerp the live material color every
    // frame toward white (boost) or gray (depleted), and need the palette
    // base to lerp *from*.
    this.coreBaseColor = new Color(this.palette.core);
    this.haloBaseColor = new Color(this.palette.halo);

    this.coreMat = new MeshBasicMaterial({
      color: this.coreBaseColor.clone(),
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
    this.haloMat = new MeshBasicMaterial({
      color: this.haloBaseColor.clone(),
      transparent: true,
      opacity: 0.45,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });

    this.mountFromAssets();
  }

  /**
   * Clone the two trail GLBs, normalize them, swap in our tinted additive
   * materials, and parent them to the group. Runs once in the constructor.
   * If preload hasn't completed (extremely unlikely — `preloadAssets()` is
   * awaited at boot in main.ts before any ship spawns), we let the throw
   * propagate so the bug is loud rather than silently render-nothing.
   */
  private mountFromAssets(): void {
    const length = BASE_LENGTH * this.palette.lengthScale;
    const haloRadius = 0.48 * this.palette.widthScale;
    const coreRadius = haloRadius * CORE_WIDTH_RATIO;
    const coreLength = length * CORE_LENGTH_RATIO;

    // Halo: wider, longer, soft. Built first so it sits behind the core in
    // the draw order — the additive blend doesn't care about ordering for
    // color, but sorting is still more predictable for transparents.
    const haloRaw = Assets.clone('engine_trail');
    const haloSrc = findFirstMesh(haloRaw);
    // `.clone()` on the geometry gives us our own copy so `normalizeTrailGeometry`
    // doesn't mutate the cached source geometry that other ships share.
    const haloGeom = (haloSrc.geometry as BufferGeometry).clone();
    normalizeTrailGeometry(haloGeom, length, haloRadius);
    const halo = new Mesh(haloGeom, this.haloMat);
    halo.rotation.x = Math.PI / 2;
    this.halo = halo;

    // Core: tight, shorter, nearly opaque.
    const coreRaw = Assets.clone('engine_trail_core');
    const coreSrc = findFirstMesh(coreRaw);
    const coreGeom = (coreSrc.geometry as BufferGeometry).clone();
    normalizeTrailGeometry(coreGeom, coreLength, coreRadius);
    const core = new Mesh(coreGeom, this.coreMat);
    core.rotation.x = Math.PI / 2;
    this.core = core;

    this.group.add(halo, core);
  }

  /**
   * Update per-frame flame animation.
   *
   * @param dt             seconds since last frame
   * @param throttle       0..1, current forward thrust as a fraction of max
   * @param boosting       true while the player's boost key is held
   * @param boostDepleted  true when the boost reservoir is empty and hasn't
   *                       yet recharged to usable. Visually chokes the flame
   *                       so the player reads the failure without the HUD.
   */
  update(
    dt: number,
    throttle: number,
    boosting: boolean,
    boostDepleted: boolean,
  ): void {
    this.time += dt;
    if (!this.core || !this.halo) return;

    // One-shot bounds log. Confirms on first load that the GLB normalization
    // produced a base-at-origin, length-along-+Y cone; after that we stop
    // spamming the console. Keeps the "verify once" spirit without polluting
    // steady-state runs.
    if (!this.loggedBounds) {
      this.loggedBounds = true;
      this.halo.geometry.computeBoundingBox();
      this.core.geometry.computeBoundingBox();
      // eslint-disable-next-line no-console
      console.debug(
        '[Thruster] halo bbox',
        this.halo.geometry.boundingBox,
        'core bbox',
        this.core.geometry.boundingBox,
      );
    }

    // Ease the depleted visual in/out. `target` is 0 or 1; we approach it
    // exponentially so there's no visible pop when the flag flips. The
    // rate matches DEPLETED_RESTORE_SECONDS regardless of direction, which
    // feels symmetric to players even though mathematically "restore" and
    // "choke" are the same spring.
    const targetDepleted = boostDepleted ? 1 : 0;
    const k = 1 - Math.exp(-dt / Math.max(1e-3, DEPLETED_RESTORE_SECONDS / 3));
    this.depletedT += (targetDepleted - this.depletedT) * k;

    // Sinusoidal flicker keeps the flame "alive" even at idle — without
    // it the thruster would look like a static cone. Pulse frequency is
    // per-class so viper engines buzz fast and golem engines throb slow.
    const flicker =
      0.9 + 0.1 * Math.sin(this.time * this.palette.pulseHz * Math.PI * 2);

    // Width pulse — small ±10% breath at the per-class pulse rate. Separate
    // from the length flicker because varying both by the same sine makes
    // the cone scale uniformly, which reads as a zoom bug rather than fire.
    const widthPulse =
      1 + Math.sin(this.time * this.palette.pulseHz * Math.PI * 2) * 0.1;

    // Length: smooth lerp between idle=0.5, cruise=1.0, boost=2.5 with the
    // throttle as the control. `throttle` is already clamped 0..1 by the
    // ship. At t=0 → 0.5, t=1 non-boost → 1.0, t=1 boost → 2.5; linear in
    // between rather than piecewise so the transition doesn't snap when
    // throttle crosses 1.
    const idleL = 0.5;
    const cruiseL = 1.0;
    const boostL = 2.5;
    const cruiseOrBoost = boosting ? boostL : cruiseL;
    let len = idleL + (cruiseOrBoost - idleL) * throttle;
    len *= flicker;

    // Depleted clamp: the flame can't exceed DEPLETED_LENGTH_CAP while the
    // reservoir is dry. We lerp between "free length" and "capped length"
    // using depletedT so the transition is smooth rather than a hard snap
    // the moment the bar ticks to 0.
    const cappedLen = Math.min(len, DEPLETED_LENGTH_CAP);
    len = len * (1 - this.depletedT) + cappedLen * this.depletedT;

    // Extra hi-freq flicker layered on top while depleted — reads as an
    // engine sputtering, not just dimming. 18Hz is fast enough to feel
    // "broken" but slow enough that it doesn't trigger viewer eye strain.
    const depletedFlicker = 0.7 + 0.3 * Math.sin(this.time * 18);
    const depLen = len * depletedFlicker;
    len = len * (1 - this.depletedT) + depLen * this.depletedT;

    // scale.y scales the mesh BEFORE rotation; the rotation maps mesh-Y
    // to world-Z, so scale.y = flame length aft.
    this.core.scale.y = len;
    this.halo.scale.y = len;

    // Width: idle flame is slim (70%), full throttle widens to 100%, boost
    // flares to ~135% so the visual surge is obvious. Multiplied by the
    // small breath pulse so the plume looks organic. Core already ships at
    // ~60% halo radius via its geometry normalization, so we just apply the
    // live breath multiplier here and don't double-shrink the core.
    const widthBase = 0.7 + 0.3 * throttle + (boosting ? 0.35 : 0);
    const width = widthBase * widthPulse;
    this.core.scale.x = width;
    this.core.scale.z = width;
    this.halo.scale.x = width;
    this.halo.scale.z = width;

    // --- Color mixing ---
    //
    // Core color: base palette hue, lerped toward white by BOOST_WHITEN
    // while boosting. Written through a scratch Color so we don't allocate.
    this.tmpColor.copy(this.coreBaseColor);
    if (boosting) {
      this.tmpColor.lerp(this.whiteColor, BOOST_WHITEN);
    }
    this.coreMat.color.copy(this.tmpColor);

    // Halo color: base palette hue, lerped toward muted gray in proportion
    // to how "depleted" we currently feel. `depletedT` is already the eased
    // 0..1 so the tint slides rather than snaps.
    this.tmpColor.copy(this.haloBaseColor);
    this.tmpColor.lerp(this.depletedColor, DEPLETED_HALO_MIX * this.depletedT);
    this.haloMat.color.copy(this.tmpColor);

    // --- Opacity ---
    //
    // Base opacity follows the pre-GLB formula: brighter flame at high
    // throttle / during boost. Then the depleted blend scales it down to
    // 30% (core) and 50% (halo) of what it would otherwise be, so the
    // flame reads as choked even at full throttle.
    const intensity = 0.35 + 0.65 * throttle + (boosting ? 0.25 : 0);
    const coreOpacityHealthy = Math.min(1, 0.55 + intensity * 0.45);
    const haloOpacityHealthy = Math.min(0.7, 0.15 + intensity * 0.45);
    const coreOpacityDepleted = coreOpacityHealthy * 0.3;
    const haloOpacityDepleted = haloOpacityHealthy * 0.5;
    this.coreMat.opacity =
      coreOpacityHealthy * (1 - this.depletedT) +
      coreOpacityDepleted * this.depletedT;
    this.haloMat.opacity =
      haloOpacityHealthy * (1 - this.depletedT) +
      haloOpacityDepleted * this.depletedT;
  }

  /** Free GPU resources when the ship is disposed. Materials are ours
   *  (created in the ctor); geometries are clones we made in `mountFromAssets`,
   *  so both are safe to dispose without pulling rugs under other ships. */
  dispose(): void {
    if (this.core) this.core.geometry.dispose();
    if (this.halo) this.halo.geometry.dispose();
    this.coreMat.dispose();
    this.haloMat.dispose();
  }
}
