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

export type WeaponKind = 'beam' | 'pulse' | 'bolt';

const BEAM_TYPES = new Set([
  'laser', 'beam', 'lance', 'mining_laser', 'sniper',
]);
const PULSE_TYPES = new Set([
  'plasma', 'pulse', 'acid', 'spore', 'flak', 'pulse_emitter',
]);
// Everything else (railgun, gatling, machinegun, missile, stinger,
// hidden_turret, point_defense, rivet_gun, light_turret) falls through to
// BOLT as the default. A new weapon we add later will render as a bolt
// unless we explicitly list it above — erring on the safe / generic side.

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
  beam:  { core: 0xff4455, glow: 0xff99aa, speed: 0, damage: 28, cooldown: 0.20, range: 500 },
  pulse: { core: 0x88ffdd, glow: 0x22cc99, speed: 120, damage: 18, cooldown: 0.15, range: 420 },
  bolt:  { core: 0xffaa44, glow: 0xffdd88, speed: 220, damage: 14, cooldown: 0.09, range: 400 },
};
