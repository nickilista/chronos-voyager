import type {
  PartStatBag,
  ShipClass,
  ShipSlot,
  ShipsConfigJson,
} from './shipTypes.ts';

/**
 * Lazy singleton loader for `/models/ships/ships-config.json`. The JSON is
 * the source of truth for per-part stats — mirrored into game-ready
 * `ShipDerivedStats` by `StatsCalculator`.
 *
 * We cache the promise (not the resolved value) so concurrent callers share
 * one network fetch even if they arrive before the first load resolves.
 */
let cached: Promise<ShipsConfigJson> | null = null;

export function loadShipRegistry(): Promise<ShipsConfigJson> {
  if (!cached) {
    cached = fetch('/models/ships/ships-config.json').then((r) => {
      if (!r.ok) {
        throw new Error(`ships-config.json load failed: ${r.status}`);
      }
      return r.json() as Promise<ShipsConfigJson>;
    });
  }
  return cached;
}

export function getPartStats(
  cfg: ShipsConfigJson,
  slot: ShipSlot,
  cls: ShipClass,
): PartStatBag {
  const table = cfg.partStats[slot];
  if (!table) throw new Error(`No stats table for slot "${slot}"`);
  const bag = table[cls];
  if (!bag) throw new Error(`No stats for ${slot}/${cls}`);
  return bag;
}

/** Safe numeric read. Missing / non-number keys fall back to `fallback`. */
export function num(bag: PartStatBag, key: string, fallback = 0): number {
  const v = bag[key];
  return typeof v === 'number' ? v : fallback;
}

/** Safe boolean read. */
export function bool(bag: PartStatBag, key: string): boolean {
  return bag[key] === true;
}

/** Safe string read. */
export function str(bag: PartStatBag, key: string, fallback = ''): string {
  const v = bag[key];
  return typeof v === 'string' ? v : fallback;
}
