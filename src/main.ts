import './style.css';
import { NoToneMapping, WebGLRenderer } from 'three';
import { Game } from './Game.ts';
import { ShipBuilder } from './shipbuilder/ShipBuilder.ts';
import { DEFAULT_SHIP_STATS } from './gameplay/Ship.ts';
import { parsePortalQuery } from './portal/PortalSystem.ts';
import { presetConfig } from './shipbuilder/StatsCalculator.ts';
import { showIntro } from './ui/IntroScreen.ts';
import type { ShipBuilderResult } from './shipbuilder/ShipBuilder.ts';
import { SaveManager } from './core/SaveManager.ts';

/**
 * Boot sequence:
 *   1. Spin up one shared WebGLRenderer bound to #game.
 *   2. Parse any inbound Vibe Jam portal query (?portal=true&ref=…&…). If
 *      the player arrived via a portal, skip the hangar and drop straight
 *      into gameplay with a default Falcon loadout — the jam rules call out
 *      "no loading screens", and a builder detour between portal → game
 *      would violate the spirit of the webring.
 *   3. Otherwise run the ShipBuilder homepage — hangar platform, 3D preview,
 *      stats panel, preset row, Launch button — and wait for the player to
 *      hit Launch (or press Enter/Space).
 *   4. Hand the selected `ShipConfig` + derived stats to `Game`, along with
 *      the inbound portal query, and start the mission in-place (no page
 *      nav — same GL context, seamless hand-off).
 *
 * Compliance note: the Vibe Jam 2026 widget is injected as an async `<script
 * src="https://vibejam.cc/2026/widget.js">` in `index.html`. It self-mounts
 * its own chip — no manual badge element needed.
 */

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('#game canvas not found');

const renderer = new WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
  stencil: false,
  depth: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.toneMapping = NoToneMapping;
renderer.toneMappingExposure = 1.0;

const portalQuery = parsePortalQuery();

let result: ShipBuilderResult;
let loadedSave = false;
if (portalQuery.fromPortal) {
  // Inbound from the jam webring — skip the hangar entirely. Use a Falcon
  // baseline (fast + agile, most friendly for an unprepared pilot) and let
  // the PortalSystem inside Game apply any inbound state (color, velocity,
  // rotation) once the scene is live.
  result = {
    config: presetConfig('falcon'),
    stats: { ...DEFAULT_SHIP_STATS },
  };
} else {
  // Check for an existing save — if present, skip the intro + ShipBuilder
  // and resume with the saved loadout + progress.
  const save = SaveManager.load();
  if (save) {
    result = { config: save.shipConfig, stats: save.shipStats };
    loadedSave = true;
  } else {
    await showIntro();
    const builder = new ShipBuilder(renderer);
    await builder.start();
    result = await builder.launchPromise;
  }
}

const game = new Game(
  canvas, renderer, result, portalQuery,
  loadedSave ? SaveManager.load()! : undefined,
);
(window as unknown as { __game: Game }).__game = game;
await game.start();
