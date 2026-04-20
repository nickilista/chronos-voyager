/**
 * Shared types for the modular ship system.
 *
 * A ship is 10 slots (hull, cockpit, wing_L/R, engine_main/aux,
 * weapon_primary/secondary, shield, tail). Each slot is filled by one of 10
 * ship classes (falcon, titan, …). The 100 resulting combinations exist as
 * GLBs under `public/models/ships/{class}/{class}_{slot}.glb`, with matching
 * per-part stats in `public/models/ships/ships-config.json`.
 */

export const SHIP_CLASSES = [
  'falcon',
  'titan',
  'phantom',
  'viper',
  'mantis',
  'centurion',
  'nova',
  'kraken',
  'valkyrie',
  'golem',
] as const;

export type ShipClass = (typeof SHIP_CLASSES)[number];

export const SHIP_SLOTS = [
  'hull',
  'cockpit',
  'wing_L',
  'wing_R',
  'engine_main',
  'engine_aux',
  'weapon_primary',
  'weapon_secondary',
  'shield',
  'tail',
] as const;

export type ShipSlot = (typeof SHIP_SLOTS)[number];

/** Player-chosen composition: one class per slot. */
export type ShipConfig = Record<ShipSlot, ShipClass>;

/** Raw per-part stat bag (from ships-config.json — the keys vary by slot). */
export type PartStatBag = Record<string, number | boolean | string>;

export interface ShipsConfigJson {
  ships: Record<
    ShipClass,
    { name: string; class: string; description: string }
  >;
  slots: ShipSlot[];
  partStats: Record<ShipSlot, Record<ShipClass, PartStatBag>>;
}

/**
 * Derived stats for an assembled ship — what the gameplay physics and HUD
 * actually consume. All values are in consistent, game-ready units (HP is
 * absolute; speed/accel/rate are rescaled from raw part numbers).
 */
export interface ShipDerivedStats {
  // Health & defense
  maxHp: number;
  armor: number;
  maxShield: number;
  shieldRechargeRate: number; // shield HP / second
  shieldRechargeDelay: number; // seconds of no-damage before recharge starts
  hpRegen: number; // passive HP / second (mantis bio)

  // Movement
  baseSpeed: number; // corridor forward speed (game units / s)
  boostMultiplier: number; // applied to speed under boost
  boostDuration: number; // seconds
  boostCooldown: number; // seconds
  acceleration: number; // free-space thrust accel
  maxThrustSpeed: number; // free-space cap
  lateralAccel: number; // corridor side-strafe accel
  maxLateralVel: number; // corridor side cap

  // Rotation
  yawRate: number; // rad/s (free space)
  pitchRate: number; // rad/s (free space)
  rollRate: number; // visual roll scalar
  stability: number; // [0..1] — damps wobble

  // Offense
  dpsPrimary: number;
  dpsSecondary: number;
  primaryType: string;
  secondaryType: string;

  // Situational
  maneuverability: number; // [0..100]
  visibility: number; // cockpit clarity, [0..100]
  stealth: number; // 0..1 sum of stealth bonuses
  totalWeight: number;

  // Special ability badges (present only when the part provides them).
  specials: string[];
}
