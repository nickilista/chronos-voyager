import { Vector3 } from 'three';
import type { ModelName } from '../gameplay/Assets.ts';
import type { EraId } from './eras.ts';

/**
 * Per-era gameplay content registry.
 *
 * Every era provides a themed triplet of 3D assets generated via Rodin (plus
 * Egypt's legacy pyramid/obelisk/ankh):
 *
 *   • `obstacles` — 2 monument kinds that actually block the corridor. The
 *     Track uses these factories (usually one repeated twice + one secondary)
 *     as the obstacle pool.
 *   • `decorations` — same 2 monument kinds reused as tall background scenery
 *     flanking the corridor, with per-kind emissive tuning.
 *   • `collectible` — the single iconic pickup of the era (the ankh's
 *     per-era equivalent). Always scaled so the geometry reads from a
 *     distance and spins cleanly.
 *
 * All `halfUnit` values are in Three.js axes (post glTF y-up export): .y is
 * vertical. Scales are tuned relative to ship radius so collision feels fair
 * (AABB is conservatively sized from the model's actual bounding half-extents).
 *
 * Visual sources for the Rodin generations:
 *   greece       — Doric column, Parthenon portico, laurel victory wreath
 *   china        — paper lantern, pagoda spire, square-hole bronze coin
 *   islamic      — tiled dome, slender minaret, 8-point girih star
 *   india        — Sanchi-style stupa, Khajuraho shikhara tower, lotus flower
 *   renaissance  — fluted Corinthian column, Brunelleschi-style dome, armillary sphere
 *   edo          — stone tōrō lantern, red vermilion torii gate, sakura blossom
 *   enlightenment — stacked leather folios, domed observatory, inkwell+quill
 *   revolution   — industrial gear train, brick factory chimney, brass cog
 *   codebreakers — CRT terminal, cabinet-size mainframe, floating binary disc
 */

export interface ObstacleSpec {
  name: ModelName;
  /** Half-extents in Three.js axes at scale 1, measured from the GLB. */
  halfUnit: Vector3;
  /** Scale applied when placed as an obstacle (tight lane). */
  obstacleScale: number;
  /** Scale applied when placed as a background decoration (off-track). */
  decorScale: number;
  /** Emissive hex used for the decor glow (should coexist with era palette). */
  decorEmissive: number;
  /** Emissive intensity for decor variant. */
  decorEmissiveI: number;
  /** Stable string id used for impact behavior biasing in Track.hitImpact. */
  type: string;
  /**
   * Spin bias under impact — "tall" objects topple end-over-end, "wide" yaw.
   * Anything with halfUnit.y significantly greater than x/z should be 'tall'.
   */
  shape: 'tall' | 'wide';
}

/**
 * Pickup flourish style.
 *
 *  - 'ascend'  : the default Egypt ankh — rises, spins, shrink-out with a
 *                single expanding gold ring. Good for tall talismans.
 *  - 'swirl'   : steep helical ascent, two trailing sparks, twice the spin.
 *                Suits organic flowery pickups (laurel, lotus, sakura).
 *  - 'radial'  : stays in place, rapid Z-axis spin, quadruple ring burst
 *                radiating outward. Suits flat/disc pickups (coin, star,
 *                armillary, cog).
 *  - 'shatter' : brief hold then fast scale-down with many point sparks like
 *                shards dispersing — fits technology / abstract pickups
 *                (binary disc).
 *  - 'scroll'  : vertical burst column rises through the orb while it fades,
 *                echoing a scroll or quill unfurling (books, quill).
 */
export type CaptureStyle = 'ascend' | 'swirl' | 'radial' | 'shatter' | 'scroll';

export interface CollectibleSpec {
  name: ModelName;
  /** Uniform scale of the pickup mesh in world units. */
  scale: number;
  /** Emissive color (gold-ish family by default). */
  emissive: number;
  emissiveI: number;
  /**
   * Single-character HUD icon shown next to the pickup counter. Unicode glyph
   * evocative of the collectible — ankh for Egypt, lotus for India, etc.
   */
  icon: string;
  /** Animation style played when the ship captures this pickup. */
  captureStyle: CaptureStyle;
}

export interface EraContent {
  obstacles: readonly [ObstacleSpec, ObstacleSpec];
  collectible: CollectibleSpec;
  /**
   * Rim glow applied to all obstacles in this era. Deliberately chosen to
   * contrast with the era's sky/horizon palette so obstacles are readable
   * as silhouettes against the background — without this, some eras (India
   * red stupas on red sky, codebreakers green terminals on green sky, etc.)
   * become genuinely hard to see while playing.
   */
  obstacleRim: { color: number; intensity: number };
}

export const ERA_CONTENT: Record<EraId, EraContent> = {
  egypt: {
    obstacles: [
      {
        name: 'pyramid',
        halfUnit: new Vector3(0.785, 0.95, 0.785),
        obstacleScale: 1.7,
        decorScale: 6.5,
        decorEmissive: 0xffb45a,
        decorEmissiveI: 0.35,
        type: 'pyramid',
        shape: 'wide',
      },
      {
        name: 'obelisk',
        halfUnit: new Vector3(0.15, 0.95, 0.15),
        obstacleScale: 2.6,
        decorScale: 5.5,
        decorEmissive: 0xffc878,
        decorEmissiveI: 0.45,
        type: 'obelisk',
        shape: 'tall',
      },
    ],
    collectible: {
      name: 'ankh',
      scale: 1.6,
      emissive: 0xffc850,
      emissiveI: 1.2,
      icon: '\u2625',
      captureStyle: 'ascend',
    },
    obstacleRim: { color: 0xffb060, intensity: 0.25 },
  },

  greece: {
    obstacles: [
      {
        name: 'greece_temple',
        halfUnit: new Vector3(0.80, 0.62, 0.31),
        obstacleScale: 2.2,
        decorScale: 5.5,
        decorEmissive: 0xd7e7ff,
        decorEmissiveI: 0.35,
        type: 'temple',
        shape: 'wide',
      },
      {
        name: 'greece_column',
        halfUnit: new Vector3(0.13, 0.95, 0.13),
        obstacleScale: 2.5,
        decorScale: 6.0,
        decorEmissive: 0xc8e0ff,
        decorEmissiveI: 0.45,
        type: 'column',
        shape: 'tall',
      },
    ],
    collectible: {
      name: 'greece_laurel',
      scale: 1.8,
      emissive: 0xfff048,
      emissiveI: 1.4,
      icon: '\u03A9',
      captureStyle: 'swirl',
    },
    obstacleRim: { color: 0xffb070, intensity: 0.30 },
  },

  china: {
    obstacles: [
      {
        name: 'china_pagoda',
        halfUnit: new Vector3(0.33, 0.95, 0.32),
        obstacleScale: 1.9,
        decorScale: 5.8,
        decorEmissive: 0xffd070,
        decorEmissiveI: 0.4,
        type: 'pagoda',
        shape: 'tall',
      },
      {
        name: 'china_lantern',
        halfUnit: new Vector3(0.42, 0.95, 0.42),
        obstacleScale: 1.8,
        decorScale: 4.8,
        decorEmissive: 0xffa560,
        decorEmissiveI: 0.7,
        type: 'lantern',
        shape: 'tall',
      },
    ],
    collectible: {
      name: 'china_coin',
      scale: 1.8,
      emissive: 0xff4848,
      emissiveI: 1.4,
      icon: '\u25CE',
      captureStyle: 'radial',
    },
    obstacleRim: { color: 0xffe070, intensity: 0.30 },
  },

  islamic: {
    obstacles: [
      {
        name: 'islamic_dome',
        halfUnit: new Vector3(0.72, 0.95, 0.72),
        obstacleScale: 1.6,
        decorScale: 5.0,
        decorEmissive: 0x7ff0d8,
        decorEmissiveI: 0.4,
        type: 'dome',
        shape: 'wide',
      },
      {
        name: 'islamic_minaret',
        halfUnit: new Vector3(0.16, 0.95, 0.16),
        obstacleScale: 2.5,
        decorScale: 6.2,
        decorEmissive: 0xa6dfff,
        decorEmissiveI: 0.45,
        type: 'minaret',
        shape: 'tall',
      },
    ],
    collectible: {
      name: 'islamic_star',
      scale: 1.7,
      emissive: 0x40f0d8,
      emissiveI: 1.5,
      icon: '\u2737',
      captureStyle: 'radial',
    },
    obstacleRim: { color: 0xffb080, intensity: 0.30 },
  },

  india: {
    obstacles: [
      {
        name: 'india_stupa',
        halfUnit: new Vector3(0.88, 0.95, 0.88),
        obstacleScale: 1.4,
        decorScale: 4.0,
        decorEmissive: 0xff9b60,
        decorEmissiveI: 0.4,
        type: 'stupa',
        shape: 'wide',
      },
      {
        name: 'india_shikhara',
        halfUnit: new Vector3(0.35, 0.95, 0.35),
        obstacleScale: 1.9,
        decorScale: 5.5,
        decorEmissive: 0xffb070,
        decorEmissiveI: 0.45,
        type: 'shikhara',
        shape: 'tall',
      },
    ],
    collectible: {
      name: 'india_lotus',
      scale: 1.9,
      emissive: 0xff7030,
      emissiveI: 1.5,
      icon: '\u2698',
      captureStyle: 'swirl',
    },
    obstacleRim: { color: 0xffe8b0, intensity: 0.35 },
  },

  renaissance: {
    obstacles: [
      {
        name: 'renaissance_dome',
        halfUnit: new Vector3(0.65, 0.95, 0.65),
        obstacleScale: 1.7,
        decorScale: 5.0,
        decorEmissive: 0xffb070,
        decorEmissiveI: 0.4,
        type: 'dome',
        shape: 'wide',
      },
      {
        name: 'renaissance_column',
        halfUnit: new Vector3(0.13, 0.95, 0.13),
        obstacleScale: 2.5,
        decorScale: 6.2,
        decorEmissive: 0xffc08a,
        decorEmissiveI: 0.45,
        type: 'column',
        shape: 'tall',
      },
    ],
    collectible: {
      name: 'renaissance_armillary',
      scale: 1.7,
      emissive: 0xe8f0ff,
      emissiveI: 1.4,
      icon: '\u2641',
      captureStyle: 'radial',
    },
    obstacleRim: { color: 0xffeacc, intensity: 0.30 },
  },

  edo: {
    obstacles: [
      {
        name: 'edo_torii',
        halfUnit: new Vector3(0.85, 0.95, 0.21),
        obstacleScale: 1.8,
        decorScale: 4.2,
        decorEmissive: 0xff5a5a,
        decorEmissiveI: 0.55,
        type: 'torii',
        shape: 'wide',
      },
      {
        name: 'edo_lantern',
        halfUnit: new Vector3(0.40, 0.95, 0.40),
        obstacleScale: 1.8,
        decorScale: 5.0,
        decorEmissive: 0xffc0c8,
        decorEmissiveI: 0.5,
        type: 'lantern',
        shape: 'tall',
      },
    ],
    collectible: {
      name: 'edo_sakura',
      scale: 1.8,
      emissive: 0xff60b0,
      emissiveI: 1.5,
      icon: '\u2740',
      captureStyle: 'swirl',
    },
    obstacleRim: { color: 0x80b8ff, intensity: 0.35 },
  },

  enlightenment: {
    obstacles: [
      {
        name: 'enlightenment_books',
        halfUnit: new Vector3(0.93, 0.95, 0.62),
        obstacleScale: 1.5,
        decorScale: 3.8,
        decorEmissive: 0xffd49a,
        decorEmissiveI: 0.4,
        type: 'books',
        shape: 'wide',
      },
      {
        name: 'enlightenment_observatory',
        halfUnit: new Vector3(0.47, 0.95, 0.47),
        obstacleScale: 1.8,
        decorScale: 5.5,
        decorEmissive: 0xd8e6ff,
        decorEmissiveI: 0.45,
        type: 'observatory',
        shape: 'tall',
      },
    ],
    collectible: {
      name: 'enlightenment_quill',
      scale: 1.8,
      emissive: 0x70b8ff,
      emissiveI: 1.4,
      icon: '\u270E',
      captureStyle: 'scroll',
    },
    obstacleRim: { color: 0xffd090, intensity: 0.30 },
  },

  revolution: {
    obstacles: [
      {
        name: 'revolution_gears',
        halfUnit: new Vector3(0.85, 0.95, 0.51),
        obstacleScale: 1.5,
        decorScale: 4.0,
        decorEmissive: 0xd6a4ff,
        decorEmissiveI: 0.5,
        type: 'gears',
        shape: 'wide',
      },
      {
        name: 'revolution_chimney',
        halfUnit: new Vector3(0.15, 0.95, 0.15),
        obstacleScale: 2.5,
        decorScale: 6.5,
        decorEmissive: 0xb080d0,
        decorEmissiveI: 0.4,
        type: 'chimney',
        shape: 'tall',
      },
    ],
    collectible: {
      name: 'revolution_cog',
      scale: 1.8,
      emissive: 0xff9840,
      emissiveI: 1.5,
      icon: '\u2699',
      captureStyle: 'radial',
    },
    obstacleRim: { color: 0xff9050, intensity: 0.35 },
  },

  codebreakers: {
    obstacles: [
      {
        name: 'codebreakers_terminal',
        halfUnit: new Vector3(0.76, 0.95, 0.60),
        obstacleScale: 1.5,
        decorScale: 4.0,
        decorEmissive: 0x00ff88,
        decorEmissiveI: 0.55,
        type: 'terminal',
        shape: 'wide',
      },
      {
        name: 'codebreakers_mainframe',
        halfUnit: new Vector3(0.33, 0.95, 0.26),
        obstacleScale: 1.9,
        decorScale: 5.5,
        decorEmissive: 0x7affc6,
        decorEmissiveI: 0.45,
        type: 'mainframe',
        shape: 'tall',
      },
    ],
    collectible: {
      name: 'codebreakers_binary',
      scale: 1.7,
      emissive: 0xffe040,
      emissiveI: 1.5,
      icon: '\u2328',
      captureStyle: 'shatter',
    },
    obstacleRim: { color: 0x40a0ff, intensity: 0.40 },
  },
};
