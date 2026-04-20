import {
  AdditiveBlending,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three';
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
 * The visuals are two additive cones stacked coaxially — a tight bright
 * core and a softer halo — so the combined extrusion reads as a plasma jet
 * rather than flat geometry. Both cones have their BASE translated to the
 * group origin so scaling their length (mesh-Y, which becomes world-Z
 * after the 90° rotation) stretches them aft-ward from the nozzle without
 * sliding the base off the engine mount.
 *
 * Per-class variation lives in `ENGINE_PALETTES`: each ship's engine has a
 * distinct hue (blue/white falcon, red titan, green viper…), a relative
 * length (nimble viper flare vs. stubby golem forge), and a pulse
 * frequency (slow bass throb for heavy engines, fast buzz for interceptors).
 * That way the player can tell at a glance which engine is bolted on.
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

/** Nominal flame length in assembly-local units (before per-class scaling). */
const BASE_LENGTH = 2.8;
/** Radius of the tight bright core in assembly-local units. */
const BASE_CORE_RADIUS = 0.22;
/** Radius of the softer halo — ~2× core, to feel like a diffused bloom. */
const BASE_HALO_RADIUS = 0.48;

export class Thruster {
  readonly group = new Group();
  private readonly core: Mesh;
  private readonly halo: Mesh;
  private readonly palette: ThrusterPalette;
  private readonly coreMat: MeshBasicMaterial;
  private readonly haloMat: MeshBasicMaterial;
  private time = 0;

  constructor(engineClass: ShipClass) {
    this.palette = ENGINE_PALETTES[engineClass];

    const length = BASE_LENGTH * this.palette.lengthScale;

    // Core cone — tight, saturated, nearly opaque. Translate the geometry so
    // the base sits at the local origin; the mesh is rotated so mesh +Y
    // (cone length) maps to world +Z (aft). Then scaling mesh-Y only
    // extends the flame tail-ward without pulling the base off the nozzle.
    const coreGeom = new ConeGeometry(
      BASE_CORE_RADIUS * this.palette.widthScale,
      length * 0.72,
      14,
      1,
      true,
    );
    coreGeom.translate(0, (length * 0.72) / 2, 0);
    this.coreMat = new MeshBasicMaterial({
      color: this.palette.core,
      transparent: true,
      opacity: 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
      side: 2, // DoubleSide — open cone must render both faces
    });
    this.core = new Mesh(coreGeom, this.coreMat);
    this.core.rotation.x = Math.PI / 2;

    // Halo cone — wider, softer, lower opacity. The additive blend means
    // where the two overlap, the colors compound into a bright edge-lit
    // core that reads as "fire inside a plume".
    const haloGeom = new ConeGeometry(
      BASE_HALO_RADIUS * this.palette.widthScale,
      length,
      16,
      1,
      true,
    );
    haloGeom.translate(0, length / 2, 0);
    this.haloMat = new MeshBasicMaterial({
      color: this.palette.halo,
      transparent: true,
      opacity: 0.45,
      blending: AdditiveBlending,
      depthWrite: false,
      side: 2,
    });
    this.halo = new Mesh(haloGeom, this.haloMat);
    this.halo.rotation.x = Math.PI / 2;

    // Halo behind core in the draw order so the core's bright edge reads
    // on top of the halo's soft wash.
    this.group.add(this.halo, this.core);
  }

  /**
   * Update per-frame flame animation.
   *
   * @param dt        seconds since last frame
   * @param throttle  0..1, current forward thrust as a fraction of max
   * @param boosting  true while the player's boost key is held
   */
  update(dt: number, throttle: number, boosting: boolean): void {
    this.time += dt;

    // Sinusoidal flicker keeps the flame "alive" even at idle — without
    // it the thruster would look like a static cone. Pulse frequency is
    // per-class so viper engines buzz fast and golem engines throb slow.
    const flicker =
      0.9 + 0.1 * Math.sin(this.time * this.palette.pulseHz * Math.PI * 2);

    // Length scales from ~35% at idle to 100% at full throttle. Boost
    // punches it another +35% so the player can see the kick.
    const len = (0.35 + 0.65 * throttle) * flicker * (boosting ? 1.35 : 1);
    // scale.y scales the mesh BEFORE rotation; the rotation maps mesh-Y
    // to world-Z, so scale.y = flame length aft.
    this.core.scale.y = len;
    this.halo.scale.y = len;

    // Width: idle flame is slim (70%), full throttle widens to 100%,
    // boost flares to ~135% so the visual surge is obvious.
    const width = 0.7 + 0.3 * throttle + (boosting ? 0.35 : 0);
    // Radius of the cone lives on mesh X and Z (both perpendicular to Y).
    // Scale both equally to keep the flame circular in cross-section.
    this.core.scale.x = width * 0.85;
    this.core.scale.z = width * 0.85;
    this.halo.scale.x = width;
    this.halo.scale.z = width;

    // Opacity: fades down during stun / braking so a stalled ship reads
    // as "engine choked" rather than "still burning at full".
    const intensity = 0.35 + 0.65 * throttle + (boosting ? 0.25 : 0);
    this.coreMat.opacity = Math.min(1, 0.55 + intensity * 0.45);
    this.haloMat.opacity = Math.min(0.7, 0.15 + intensity * 0.45);
  }

  /** Free GPU resources when the ship is disposed. Cheap — four buffers. */
  dispose(): void {
    this.core.geometry.dispose();
    this.halo.geometry.dispose();
    this.coreMat.dispose();
    this.haloMat.dispose();
  }
}
