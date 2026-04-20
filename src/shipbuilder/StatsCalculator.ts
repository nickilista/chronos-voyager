import type {
  ShipConfig,
  ShipDerivedStats,
  ShipsConfigJson,
} from './shipTypes.ts';
import { bool, getPartStats, num, str } from './ShipRegistry.ts';

/**
 * Collapse a 10-part ship composition into a single `ShipDerivedStats` bag,
 * ready to drive physics, HUD, and gameplay balancing.
 *
 * The raw part numbers in ships-config.json sit in a wide, designer-friendly
 * range (hp 50..200, maxSpeed 160..420, rollRate 0.4..1.6, …). The computed
 * stats rescale those into the existing engine's constants so a "Falcon hull
 * with Titan engine" sits inside the same speed/roll band the game was
 * tuned for.
 *
 * Formulas intentionally favour the slot that dominates each stat (engine
 * for speed, hull for HP, tail for yaw, wings for roll, cockpit for
 * targeting/visibility) and use the other parts as multipliers. The total
 * weight of the 10 parts drags speed and acceleration down, the way any
 * respectable space game handles mass.
 */

// Baselines so "average" picks land near the current hand-tuned constants.
// Target baselines for an all-Falcon build (after cumulative +87.5% from
// the original baseline): baseSpeed ≈ 90, yaw ≈ 2.2, pitch ≈ 1.8,
// lateralAccel ≈ 60. Consistent multiplier across every engine preserves
// the stat-table ranking (Viper fastest, Golem slowest) while lifting the
// overall travel feel into "proper space fighter" territory — slower speeds
// made the modular-loop wrap snap look jerky in peripheral vision.
const SPEED_TO_GAME = 90 / 320; // falcon engine maxSpeed = 320 → 90
const ACCEL_TO_GAME = 55 / 80; // falcon engine acceleration = 80 → ~55
const LATERAL_TO_GAME = 60 / 80; // falcon wing maneuverability = 80 → 60
const YAW_TO_GAME = 2.2 / 1.1; // falcon tail yawRate = 1.1 → 2.2
const PITCH_TO_GAME = 1.8 / 1.1; // falcon hull*tail pitch ≈ 1.1 → 1.8
/** Floor for `baseSpeed` so that even an all-Golem (maxSpeed 160, heaviest
 *  weight bracket) build never feels like it's crawling. Lifted to 45 u/s
 *  alongside the speed bump — slow and bulky, but still brisk enough to
 *  read as flight rather than drift. */
const MIN_BASE_SPEED = 45;

/** Sum up weight from every slot that has a `weight` field. */
function totalWeight(cfg: ShipConfig, json: ShipsConfigJson): number {
  let w = 0;
  for (const [slot, cls] of Object.entries(cfg)) {
    const bag = json.partStats[slot as keyof typeof json.partStats]?.[cls];
    if (bag) w += num(bag, 'weight', 0);
  }
  return w;
}

/** Mass penalty scales speed & accel down — heavy ships sluggish. */
function massPenalty(weight: number): number {
  // 10-ship median weight ≈ 50–70 per slot summed ≈ 500–700. Clamp so it
  // never zeroes out the stats and very light ships get a small bonus.
  const t = Math.min(1, Math.max(0, (weight - 300) / 600));
  return 1 - 0.35 * t; // 1.0 at very light → 0.65 at very heavy
}

export function computeDerivedStats(
  cfg: ShipConfig,
  json: ShipsConfigJson,
): ShipDerivedStats {
  const hull = getPartStats(json, 'hull', cfg.hull);
  const cockpit = getPartStats(json, 'cockpit', cfg.cockpit);
  const wingL = getPartStats(json, 'wing_L', cfg.wing_L);
  const wingR = getPartStats(json, 'wing_L', cfg.wing_R); // wing_R shares wing_L table
  const engineMain = getPartStats(json, 'engine_main', cfg.engine_main);
  const engineAux = getPartStats(json, 'engine_aux', cfg.engine_aux);
  const weaponPrim = getPartStats(json, 'weapon_primary', cfg.weapon_primary);
  const weaponSec = getPartStats(json, 'weapon_secondary', cfg.weapon_secondary);
  const shield = getPartStats(json, 'shield', cfg.shield);
  const tail = getPartStats(json, 'tail', cfg.tail);

  const weight = totalWeight(cfg, json);
  const mass = massPenalty(weight);

  // HP / shield / armor
  const maxHp = num(hull, 'hp') + num(shield, 'extraArmor', 0) * 5;
  const armor = num(hull, 'armor') + num(shield, 'extraArmor', 0);
  const maxShield = num(shield, 'shieldHP');
  const shieldRechargeRate = num(shield, 'rechargeRate');
  const shieldRechargeDelay = num(shield, 'rechargeDelay');
  const hpRegen = num(hull, 'regenRate', 0) + num(shield, 'hpRegen', 0);

  // Speed / thrust
  const baseSpeed = Math.max(
    MIN_BASE_SPEED,
    num(engineMain, 'maxSpeed') * SPEED_TO_GAME * mass,
  );
  const acceleration = num(engineMain, 'acceleration') * ACCEL_TO_GAME * mass;
  const boostMultiplier = 1 + num(engineAux, 'boostThrust') / 100;
  const boostDuration = num(engineAux, 'boostDuration');
  const boostCooldown = num(engineAux, 'cooldown');
  const maxThrustSpeed = baseSpeed * 0.95; // free-space cap slightly below corridor

  // Corridor side-strafe: averaged wing maneuverability, mass-adjusted.
  const maneuverability =
    (num(wingL, 'maneuverability') + num(wingR, 'maneuverability')) * 0.5;
  const lateralAccel = maneuverability * LATERAL_TO_GAME * mass;
  const maxLateralVel = Math.max(12, 20 + maneuverability * 0.18);

  // Rotation rates
  const yawRate = num(tail, 'yawRate') * YAW_TO_GAME;
  const pitchRate =
    num(hull, 'pitchBonus') * num(tail, 'pitchBonus') * PITCH_TO_GAME;
  const rollRate =
    ((num(wingL, 'rollRate') + num(wingR, 'rollRate')) * 0.5) *
    num(hull, 'rollBonus');

  const stability = Math.min(1, num(tail, 'stability') / 100);

  // Offense — DPS is the dominant summary the player cares about.
  const dpsPrimary = num(weaponPrim, 'damage') * num(weaponPrim, 'fireRate');
  const dpsSecondary = num(weaponSec, 'damage') * num(weaponSec, 'fireRate');

  // Stealth: sum all "stealthBonus" fields across parts.
  const stealth =
    num(hull, 'stealthBonus', 0) +
    num(cockpit, 'stealthBonus', 0) +
    num(wingL, 'stealthBonus', 0) +
    num(wingR, 'stealthBonus', 0) +
    num(tail, 'stealthBonus', 0);

  const visibility = num(cockpit, 'visibility');

  // Collect special-ability badges for the UI. Each truthy boolean flag in
  // any slot shows up as a chip so the player understands what their
  // composition unlocks.
  const specials: string[] = [];
  const addSpecials = (tag: string, b: { [k: string]: number | boolean | string }): void => {
    if (bool(b, 'bioRecharge')) specials.push(`${tag}: Bio-Recharge`);
    if (bool(b, 'silentBoost')) specials.push(`${tag}: Silent Boost`);
    if (bool(b, 'voidShift')) specials.push(`${tag}: Void Shift`);
    if (bool(b, 'phaseShift')) specials.push(`${tag}: Phase Shift`);
    if (bool(b, 'energyBurst')) specials.push(`${tag}: Energy Burst`);
    if (bool(b, 'tracking')) specials.push(`${tag}: Tracking`);
    if (bool(b, 'autoTarget')) specials.push(`${tag}: Auto-Target`);
    if (bool(b, 'poison')) specials.push(`${tag}: Poison`);
    if (bool(b, 'energyBased')) specials.push(`${tag}: Energy`);
    if (bool(b, 'damageReflect')) specials.push(`${tag}: Damage Reflect`);
    if (bool(b, 'energyAbsorb')) specials.push(`${tag}: Energy Absorb`);
  };
  addSpecials('Eng', engineMain);
  addSpecials('Aux', engineAux);
  addSpecials('Wep1', weaponPrim);
  addSpecials('Wep2', weaponSec);
  addSpecials('Shield', shield);
  if (num(hull, 'fearAura', 0)) specials.push('Hull: Fear Aura');
  if (num(shield, 'cloakDuration', 0)) specials.push('Shield: Cloak');

  return {
    maxHp,
    armor,
    maxShield,
    shieldRechargeRate,
    shieldRechargeDelay,
    hpRegen,
    baseSpeed,
    boostMultiplier,
    boostDuration,
    boostCooldown,
    acceleration,
    maxThrustSpeed,
    lateralAccel,
    maxLateralVel,
    yawRate,
    pitchRate,
    rollRate,
    stability,
    dpsPrimary,
    dpsSecondary,
    primaryType: str(weaponPrim, 'type'),
    secondaryType: str(weaponSec, 'type'),
    maneuverability,
    visibility,
    stealth,
    totalWeight: weight,
    specials,
  };
}

/** Ten canonical "pure" presets — all slots filled with one class. */
export function presetConfig(cls: ShipConfig['hull']): ShipConfig {
  return {
    hull: cls,
    cockpit: cls,
    wing_L: cls,
    wing_R: cls,
    engine_main: cls,
    engine_aux: cls,
    weapon_primary: cls,
    weapon_secondary: cls,
    shield: cls,
    tail: cls,
  };
}
