/**
 * LocalStorage persistence for Chronos Voyager.
 *
 * Stores the player's ship loadout, per-era puzzle progress, and live
 * HP/shield/boost under a single `chronos-save` key. The save is versioned
 * so future schema changes can migrate gracefully.
 */

import type { ShipConfig, ShipClass } from '../shipbuilder/shipTypes.ts';
import { SHIP_CLASSES, SHIP_SLOTS } from '../shipbuilder/shipTypes.ts';
import type { ShipDerivedStats } from '../shipbuilder/shipTypes.ts';
import type { EraId } from '../eras/eras.ts';

const STORAGE_KEY = 'chronos-save';
const CURRENT_VERSION = 1;

const ERA_IDS: readonly EraId[] = [
  'egypt', 'greece', 'china', 'islamic', 'india',
  'renaissance', 'edo', 'enlightenment', 'revolution', 'codebreakers',
];

export interface SaveData {
  version: 1;
  shipConfig: ShipConfig;
  shipStats: ShipDerivedStats;
  puzzleStages: Record<EraId, 0 | 1 | 2>;
  hp: number;
  shield: number;
  boostEnergy: number;
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

  // shipStats: just check it's an object with maxHp (deep validation not
  // worth the code — the game overwrites derived stats on load anyway if
  // the formula changes).
  if (d.shipStats == null || typeof d.shipStats !== 'object') return false;
  if (typeof (d.shipStats as Record<string, unknown>).maxHp !== 'number') return false;

  // puzzleStages: each era must have 0, 1, or 2.
  if (d.puzzleStages == null || typeof d.puzzleStages !== 'object') return false;
  const ps = d.puzzleStages as Record<string, unknown>;
  for (const era of ERA_IDS) {
    if (!isValidPuzzleStage(ps[era])) return false;
  }

  if (typeof d.hp !== 'number') return false;
  if (typeof d.shield !== 'number') return false;
  if (typeof d.boostEnergy !== 'number') return false;

  return true;
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
      return validate(parsed) ? (parsed as SaveData) : null;
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
};
