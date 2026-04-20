/**
 * Warm the browser HTTP cache for the combat-layer assets while the
 * player is still in the Hangar. By the time they click Launch, every
 * meteorite + effect GLB has either fully downloaded or is partially
 * in-flight — `game.start()` then runs its `Meteorites.init()` and
 * `ExplosionPool.init()` on the existing cache entries instead of
 * hitting the network from scratch.
 *
 * We deliberately use raw `fetch()` rather than a GLTFLoader: the goal
 * is to populate the HTTP cache, not to parse the files yet. Parsing
 * happens inside the real init() paths later, off the cached response.
 * Firing parsing eagerly here would also duplicate CPU work — those
 * inits already parse once, we'd just add a second parse for nothing.
 *
 * Every fetch is fire-and-forget: `.catch(() => {})` so a flaky
 * network for one asset doesn't blow up the Hangar boot. The player
 * waits a frame longer on Launch if prewarm missed, no harder failure.
 */

const COMBAT_URLS: readonly string[] = [
  '/models/meteorites-config.json',
  '/models/meteorites/meteorite_rocky.glb',
  '/models/meteorites/meteorite_jagged.glb',
  '/models/meteorites/meteorite_magma.glb',
  '/models/meteorites/meteorite_crystal.glb',
  '/models/meteorites/meteorite_iron.glb',
  '/models/effects/explosion_flash.glb',
  '/models/effects/explosion_smoke.glb',
  '/models/effects/fragment_0.glb',
  '/models/effects/fragment_1.glb',
  '/models/effects/fragment_2.glb',
  '/models/effects/fragment_3.glb',
  '/models/effects/fragment_4.glb',
  '/models/effects/fragment_5.glb',
  '/models/effects/fragment_6.glb',
  '/models/effects/fragment_7.glb',
];

let started = false;

/**
 * Kick off parallel cache-warming fetches. Idempotent — calling twice
 * does nothing the second time. Returns a promise that resolves when
 * every fetch either completes or fails; callers who don't care about
 * completion can simply ignore the promise (recommended — it's meant
 * to run in the background while the UI is interactive).
 */
export function prewarmCombatAssets(): Promise<void> {
  if (started) return Promise.resolve();
  started = true;
  const fetches = COMBAT_URLS.map((url) =>
    fetch(url, { cache: 'force-cache' })
      .then((r) => {
        // Consume the body so the connection can be released / the
        // response can move from "in flight" to "in cache". Without
        // this, some browsers keep the body stream alive and a later
        // `fetch()` / `GLTFLoader.load()` for the same URL may still
        // make a fresh request.
        return r.ok ? r.arrayBuffer() : null;
      })
      .catch(() => null),
  );
  return Promise.all(fetches).then(() => undefined);
}
