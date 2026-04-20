/**
 * LocalStorage persistence for Chronos Voyager.
 *
 * Stores the player's ship loadout, per-era puzzle progress, live
 * HP/shield/boost, and the new **ship-parts inventory + unlocked-ships
 * roster** that powers the "shoot meteorites to unlock more ships"
 * progression. Keyed under `chronos-save`; save is versioned and
 * migrates gracefully across schema changes.
 */

import type { ShipConfig, ShipClass } from '../shipbuilder/shipTypes.ts';
import { SHIP_CLASSES, SHIP_SLOTS } from '../shipbuilder/shipTypes.ts';
import type { ShipDerivedStats } from '../shipbuilder/shipTypes.ts';
import type { EraId } from '../eras/eras.ts';

const STORAGE_KEY = 'chronos-save';
const CURRENT_VERSION = 2;

const ERA_IDS: readonly EraId[] = [
  'egypt', 'greece', 'china', 'islamic', 'india',
  'renaissance', 'edo', 'enlightenment', 'revolution', 'codebreakers',
];

/**
 * Number of "ship-part" drops a player has to collect for a given
 * locked ship class before that ship becomes selectable in the Hangar.
 *
 * Ten, one conceptual part per slot (hull, cockpit, wing_L, wing_R,
 * engine_main, engine_aux, weapon_primary, weapon_secondary, shield,
 * tail). The fiction: each meteorite drop is "a piece of the ship" —
 * collect all 10 pieces to rebuild it. The actual drop assignment is
 * random (any slot's worth counts toward the same tally), the label
 * on the progress chip just makes it feel physical.
 */
export const SHIP_PART_UNLOCK_THRESHOLD = 10;

/**
 * Ships a fresh-start player has access to. Everything else starts
 * locked and must be unlocked via meteorite drops. Falcon is a
 * deliberate "friendly baseline" — balanced stats, no specials, so a
 * new pilot isn't overwhelmed and the other 9 archetypes can feel
 * distinct when they unlock later.
 */
export const DEFAULT_UNLOCKED: readonly ShipClass[] = ['falcon'];

export interface SaveData {
  version: 2;
  shipConfig: ShipConfig;
  shipStats: ShipDerivedStats;
  puzzleStages: Record<EraId, 0 | 1 | 2>;
  hp: number;
  shield: number;
  boostEnergy: number;
  /** Classes the player has unlocked. Always contains at least Falcon. */
  unlockedShips: ShipClass[];
  /** Progress toward unlocking each locked class (count of collected parts). */
  shipParts: Partial<Record<ShipClass, number>>;
}

function isValidShipClass(v: unknown): v is ShipClass {
  return typeof v === 'string' && (SHIP_CLASSES as readonly string[]).includes(v);
}

function isValidPuzzleStage(v: unknown): v is 0 | 1 | 2 {
  return v === 0 || v === 1 || v === 2;
}

/**
 * Validate a parsed JSON blob as SaveData. Returns true only when every
 * required field is present and well-typed — corrupt or tampered saves
 * are rejected outright so the player starts fresh rather than crashing
 * mid-flight.
 */
function validate(data: unknown): data is SaveData {
  if (data == null || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.version !== CURRENT_VERSION) return false;

  // shipConfig: every slot must map to a known class.
  if (d.shipConfig == null || typeof d.shipConfig !== 'object') return false;
  const cfg = d.shipConfig as Record<string, unknown>;
  for (const slot of SHIP_SLOTS) {
    if (!isValidShipClass(cfg[slot])) return false;
  }

  if (d.shipStats == null || typeof d.shipStats !== 'object') return false;
  if (typeof (d.shipStats as Record<string, unknown>).maxHp !== 'number') return false;

  if (d.puzzleStages == null || typeof d.puzzleStages !== 'object') return false;
  const ps = d.puzzleStages as Record<string, unknown>;
  for (const era of ERA_IDS) {
    if (!isValidPuzzleStage(ps[era])) return false;
  }

  if (typeof d.hp !== 'number') return false;
  if (typeof d.shield !== 'number') return false;
  if (typeof d.boostEnergy !== 'number') return false;

  if (!Array.isArray(d.unlockedShips)) return false;
  if (!(d.unlockedShips as unknown[]).every(isValidShipClass)) return false;

  if (d.shipParts == null || typeof d.shipParts !== 'object') return false;

  return true;
}

/**
 * Attempt to migrate an older schema up to CURRENT_VERSION. Returns
 * null if the data is too broken to salvage (caller falls back to a
 * fresh start). Only v1 → v2 is currently supported:
 *   • v1 predates the ship-unlock system → v2 migration grants every
 *     class already unlocked so legacy players aren't surprise-gated
 *     behind a system they never opted into. Fresh-start players (no
 *     save at all) hit the `DEFAULT_UNLOCKED` path instead.
 */
function migrate(data: unknown): SaveData | null {
  if (data == null || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.version === CURRENT_VERSION) {
    return validate(d) ? (d as SaveData) : null;
  }
  if (d.version === 1) {
    // Tack on the new v2 fields with permissive defaults.
    const upgraded: Record<string, unknown> = {
      ...d,
      version: CURRENT_VERSION,
      unlockedShips: [...SHIP_CLASSES],
      shipParts: {},
    };
    return validate(upgraded) ? (upgraded as SaveData) : null;
  }
  return null;
}

export const SaveManager = {
  save(data: SaveData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Quota exceeded or private browsing — silently ignore.
    }
  },

  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return migrate(parsed);
    } catch {
      return null;
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // noop
    }
  },

  hasSave(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) != null;
    } catch {
      return false;
    }
  },

  /**
   * Check whether a ship class is currently unlocked for selection.
   * Falcon is unconditionally unlocked — the baseline starter.
   */
  isUnlocked(cls: ShipClass, save: SaveData | null): boolean {
    if (cls === 'falcon') return true;
    if (!save) return false;
    return save.unlockedShips.includes(cls);
  },

  /**
   * Get the current part count for a ship class.
   */
  getPartCount(cls: ShipClass, save: SaveData | null): number {
    if (!save) return 0;
    return save.shipParts[cls] ?? 0;
  },

  /**
   * Award a part to `cls`. Mutates `save` in place and returns
   * `{ unlocked: true }` if this particular part pushed the class
   * over the threshold. Caller is responsible for persisting the save
   * afterwards (so we can batch writes).
   */
  awardPart(cls: ShipClass, save: SaveData): { unlocked: boolean; count: number } {
    if (save.unlockedShips.includes(cls) || cls === 'falcon') {
      // Already unlocked — nothing to award. Keep counter at threshold.
      const count = SHIP_PART_UNLOCK_THRESHOLD;
      save.shipParts[cls] = count;
      return { unlocked: false, count };
    }
    const current = save.shipParts[cls] ?? 0;
    const next = current + 1;
    save.shipParts[cls] = next;
    if (next >= SHIP_PART_UNLOCK_THRESHOLD) {
      save.unlockedShips.push(cls);
      return { unlocked: true, count: next };
    }
    return { unlocked: false, count: next };
  },

  /**
   * Pick a random still-locked ship class. Returns `null` if the
   * player has already unlocked everything (meteorite drops should
   * then roll a different reward type or just give XP). Uniform
   * weighting — every locked ship is equally likely to receive a part.
   */
  pickRandomLockedClass(save: SaveData | null): ShipClass | null {
    const locked = SHIP_CLASSES.filter(
      (cls) => cls !== 'falcon' && !(save?.unlockedShips ?? []).includes(cls),
    );
    if (locked.length === 0) return null;
    return locked[Math.floor(Math.random() * locked.length)];
  },

  /**
   * Batch version of awardPart — applies `count` parts to `cls`, used
   * when an enemy is defeated and drops 5 pieces at once. Returns the
   * final state (how many parts were actually granted given the unlock
   * threshold, and whether the class unlocked during the batch).
   */
  awardParts(cls: ShipClass, count: number, save: SaveData): {
    unlocked: boolean;
    finalCount: number;
    granted: number;
  } {
    if (save.unlockedShips.includes(cls) || cls === 'falcon') {
      return { unlocked: false, finalCount: SHIP_PART_UNLOCK_THRESHOLD, granted: 0 };
    }
    const before = save.shipParts[cls] ?? 0;
    const after = Math.min(before + count, SHIP_PART_UNLOCK_THRESHOLD);
    save.shipParts[cls] = after;
    if (after >= SHIP_PART_UNLOCK_THRESHOLD && !save.unlockedShips.includes(cls)) {
      save.unlockedShips.push(cls);
      return { unlocked: true, finalCount: after, granted: after - before };
    }
    return { unlocked: false, finalCount: after, granted: after - before };
  },

  /**
   * Death penalty: remove one collected part from a random in-progress
   * ship class. Only subtracts if the player has any uncollected-ship
   * class at `parts > 0` — if every locked ship is at 0 (or all are
   * already unlocked), this is a no-op and returns null.
   *
   * Mutates `save` in place; caller is responsible for persisting.
   * Returns the class whose count was decremented + its new count so
   * the HUD can toast "Lost a piece of VIPER (1/10)".
   */
  deductPart(save: SaveData): { cls: ShipClass; count: number } | null {
    // Candidates: classes that are still locked AND have at least one
    // part collected. Unlocked ships are immune — they've already been
    // "rebuilt", no parts to forfeit.
    const candidates = SHIP_CLASSES.filter(
      (cls) =>
        cls !== 'falcon' &&
        !save.unlockedShips.includes(cls) &&
        (save.shipParts[cls] ?? 0) > 0,
    );
    if (candidates.length === 0) return null;
    const cls = candidates[Math.floor(Math.random() * candidates.length)];
    const next = Math.max(0, (save.shipParts[cls] ?? 0) - 1);
    save.shipParts[cls] = next;
    return { cls, count: next };
  },

  /**
   * Build a default save blob for a brand-new player. Only Falcon is
   * unlocked; every puzzle stage is at 0; no parts collected yet.
   */
  defaultSave(shipConfig: ShipConfig, shipStats: ShipDerivedStats): SaveData {
    const puzzleStages = {} as Record<EraId, 0 | 1 | 2>;
    for (const era of ERA_IDS) puzzleStages[era] = 0;
    return {
      version: CURRENT_VERSION,
      shipConfig,
      shipStats,
      puzzleStages,
      hp: shipStats.maxHp,
      shield: shipStats.maxShield,
      boostEnergy: 1,
      unlockedShips: [...DEFAULT_UNLOCKED],
      shipParts: {},
    };
  },
};
