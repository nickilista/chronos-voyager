/**
 * Per-weapon render kind + palette.
 *
 * Every ship in ships-config.json lists primary/secondary weapons with a
 * `type` string like 'laser', 'plasma', 'gatling'. For rendering we collapse
 * these 20 strings into three families — a hitscan beam, a chunky plasma
 * pulse, and a fast bolt — each with its own visual language so the player
 * reads their weapon choice without having to mouse over the HUD.
 *
 *   • BEAM  — instant hit-scan. Renders as a brief glowing line from the
 *             muzzle to the impact point (or max range). The "LASER"
 *             promise finally cashed: laser/beam/lance/mining_laser/sniper
 *             all fire as real beams rather than orb bullets.
 *   • PULSE — slow, wide, very additive. Reads as a thrown ball of
 *             energy. plasma/pulse/acid/spore/flak/pulse_emitter.
 *   • BOLT  — narrow, fast, cold-white core. Default for kinetic/slug/
 *             missile-class weapons: railgun/machinegun/gatling/missile/
 *             and a handful of smaller-caliber turrets.
 */

export type WeaponKind = 'beam' | 'pulse' | 'bolt' | 'missile' | 'gatling';

const BEAM_TYPES = new Set([
  'laser', 'beam', 'lance', 'mining_laser', 'sniper',
]);
const PULSE_TYPES = new Set([
  'plasma', 'pulse', 'acid', 'spore', 'flak', 'pulse_emitter',
]);
/** Missile-class ordnance — slow, damaging, visible smoke trail. */
const MISSILE_TYPES = new Set([
  'missile', 'stinger',
]);
/** Rapid-fire small-caliber — many bullets per second, low damage each. */
const GATLING_TYPES = new Set([
  'gatling', 'machinegun', 'point_defense', 'light_turret', 'rivet_gun',
]);
// Anything not listed above (railgun, hidden_turret…) falls through to
// BOLT as the safe default. Railgun is semantically a "fast slug", so bolt
// is a reasonable fit — we'd want a dedicated render later if the fantasy
// demands it.

/**
 * Classify a raw weapon type string (as found in ships-config.json) into
 * one of the three render kinds. Unknown strings → 'bolt' so new content
 * renders correctly without this module having to be updated in lockstep.
 */
export function weaponKindFor(type: string | undefined): WeaponKind {
  if (!type) return 'bolt';
  const t = type.toLowerCase();
  if (BEAM_TYPES.has(t)) return 'beam';
  if (PULSE_TYPES.has(t)) return 'pulse';
  if (MISSILE_TYPES.has(t)) return 'missile';
  if (GATLING_TYPES.has(t)) return 'gatling';
  return 'bolt';
}

/**
 * Resolve the secondary weapon's render kind, guaranteeing it differs
 * from the primary. Two ships in ships-config.json have primary+secondary
 * that naturally collapse to the same family (titan=bolt/bolt,
 * kraken=pulse/pulse); for those we bump the secondary into a distinct
 * family so the player actually sees two different weapons.
 *
 * Shift policy: bolt → pulse, pulse → bolt (preserves projectile feel —
 * both are throwable), beam never needs shifting since the 2 conflict
 * cases are bolt/bolt and pulse/pulse. If a future ship has double-beam
 * we'd remap to pulse.
 */
export function weaponKindForSecondary(
  primaryType: string | undefined,
  secondaryType: string | undefined,
): WeaponKind {
  const primary = weaponKindFor(primaryType);
  const secondary = weaponKindFor(secondaryType);
  if (secondary !== primary) return secondary;
  if (primary === 'bolt') return 'pulse';
  if (primary === 'pulse') return 'bolt';
  return 'pulse';
}

/**
 * Per-kind visual palette. Used by Projectiles and the crosshair's lock
 * confirmation flash. Hex numbers, not strings, so three.js consumes them
 * without re-parsing.
 */
export const WEAPON_PALETTE: Record<WeaponKind, {
  core: number;
  glow: number;
  /** Projectile speed (u/s). Ignored for `beam` (instant). */
  speed: number;
  /** Damage per shot. Beams lean heavier because they're hitscan +
   *  single-target, bolts are cheap-and-fast. */
  damage: number;
  /** Fire cooldown (s). Beams throttle slower to keep DPS comparable. */
  cooldown: number;
  /** Max effective range in world units. */
  range: number;
}> = {
  beam:    { core: 0xff4455, glow: 0xff99aa, speed: 0,   damage: 28, cooldown: 0.20, range: 500 },
  pulse:   { core: 0x88ffdd, glow: 0x22cc99, speed: 120, damage: 18, cooldown: 0.15, range: 420 },
  bolt:    { core: 0xffaa44, glow: 0xffdd88, speed: 220, damage: 14, cooldown: 0.09, range: 400 },
  // Missiles: slow, heavy, with a visible smoke trail. High damage per
  // shot, long cooldown — the player fires them deliberately, not on
  // spray-and-pray. Range is longer so a tracked target across the
  // horizon can still be hit.
  missile: { core: 0xffd080, glow: 0xff6020, speed: 95,  damage: 45, cooldown: 0.45, range: 600 },
  // Gatling / rapid-fire: small bright bullets, fast cooldown, low
  // damage each. Visually distinct from plain 'bolt' by being half
  // the size with a bluer tracer core.
  gatling: { core: 0xcfe8ff, glow: 0x5fb8ff, speed: 260, damage: 8,  cooldown: 0.05, range: 320 },
};
