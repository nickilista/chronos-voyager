import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from 'three';
import type { Era } from '../eras/eras.ts';
import { CORRIDOR_RADIUS } from '../gameplay/Track.ts';

/**
 * Floor-level ornamental glyph tiles that stream past beneath the ship to
 * enrich the interior of a flow corridor. Each tile is a simple emissive
 * plane laid flat on the local-XZ plane at the bottom of the tube, tinted
 * with the era accent colour. As the ship advances, tiles that fall out of
 * the window are recycled to the opposite end of the chain.
 *
 * The tiles sit well below the ship's gameplay band so they never interfere
 * with the obstacle lane — they're pure visual ground dressing.
 */

const POOL_SIZE = 28;
const FLOOR_Y = -CORRIDOR_RADIUS + 3.5;
const TILE_SIZE = 6;
// Axial cadence — tight enough that at playing speed a new glyph rushes
// past roughly every half-second, giving a steady processional rhythm.
const MIN_SPACING_Z = 18;
const MAX_SPACING_Z = 26;
const CHAIN_HALF_LENGTH = (POOL_SIZE / 2) * MAX_SPACING_Z;
const RECYCLE_DIST = CHAIN_HALF_LENGTH + 40;
// Lateral extent across the floor: kept inside the corridor wall with a
// margin so tiles never clip the cylinder geometry.
const X_MAX = CORRIDOR_RADIUS - 12;

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/* ------------------------- Procedural textures --------------------------- */

/**
 * Paint an emissive glyph onto a canvas: concentric arcs + cross-hatch
 * framed by a rounded rectangle, so from a distance it reads as an
 * illuminated mosaic tile rather than a flat sprite. Colour is sourced
 * from the era accent so each corridor's floor feels era-specific.
 */
function buildGlyphTexture(accentHex: number, variant: number): CanvasTexture {
  const W = 192;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = W;
  const g = c.getContext('2d');
  if (!g) return new CanvasTexture(c);
  const col = new Color(accentHex);
  const hi = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},1)`;
  const mid = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.55)`;
  const dim = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.12)`;

  // Soft backdrop glow so the tile edges feather into the floor.
  const grad = g.createRadialGradient(W / 2, W / 2, W * 0.08, W / 2, W / 2, W * 0.5);
  grad.addColorStop(0, mid);
  grad.addColorStop(0.6, dim);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, W);

  g.strokeStyle = hi;
  g.lineWidth = 3;
  g.lineCap = 'round';

  // Rounded frame.
  const m = W * 0.12;
  const r = W * 0.08;
  g.beginPath();
  g.moveTo(m + r, m);
  g.lineTo(W - m - r, m);
  g.quadraticCurveTo(W - m, m, W - m, m + r);
  g.lineTo(W - m, W - m - r);
  g.quadraticCurveTo(W - m, W - m, W - m - r, W - m);
  g.lineTo(m + r, W - m);
  g.quadraticCurveTo(m, W - m, m, W - m - r);
  g.lineTo(m, m + r);
  g.quadraticCurveTo(m, m, m + r, m);
  g.closePath();
  g.stroke();

  // Three glyph variants so the floor doesn't look tiled.
  g.save();
  g.translate(W / 2, W / 2);
  g.lineWidth = 2.2;
  if (variant === 0) {
    // Concentric arcs.
    for (let i = 1; i <= 3; i++) {
      g.beginPath();
      g.arc(0, 0, W * 0.08 * i, 0, Math.PI * 2);
      g.stroke();
    }
  } else if (variant === 1) {
    // Radial cross.
    for (let k = 0; k < 4; k++) {
      g.save();
      g.rotate((k * Math.PI) / 2);
      g.beginPath();
      g.moveTo(0, -W * 0.26);
      g.lineTo(0, W * 0.26);
      g.stroke();
      g.restore();
    }
    g.beginPath();
    g.arc(0, 0, W * 0.09, 0, Math.PI * 2);
    g.stroke();
  } else {
    // Nested lozenges.
    for (let i = 1; i <= 3; i++) {
      const s = W * 0.08 * i;
      g.beginPath();
      g.moveTo(0, -s);
      g.lineTo(s, 0);
      g.lineTo(0, s);
      g.lineTo(-s, 0);
      g.closePath();
      g.stroke();
    }
  }
  g.restore();

  const tex = new CanvasTexture(c);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  return tex;
}

interface GlyphItem {
  mesh: Mesh;
  lateral: number;
}

export class FloorGlyphs {
  readonly group = new Group();
  private items: GlyphItem[] = [];
  private textures: CanvasTexture[] = [];
  private readonly accent: number;
  private tailZ = 0;
  private headZ = 0;

  constructor(era: Era) {
    this.accent = era.palette.accent;
  }

  init(): void {
    this.textures = [
      buildGlyphTexture(this.accent, 0),
      buildGlyphTexture(this.accent, 1),
      buildGlyphTexture(this.accent, 2),
    ];
    const geo = new PlaneGeometry(TILE_SIZE, TILE_SIZE);
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new MeshBasicMaterial({
        map: this.textures[i % this.textures.length],
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        opacity: 0.85,
      });
      const mesh = new Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2; // lie flat on the floor plane
      mesh.frustumCulled = false;
      this.items.push({ mesh, lateral: 0 });
      this.group.add(mesh);
    }
    this.layOutChainAround(0);
  }

  private layOutChainAround(centerZ: number): void {
    const half = Math.floor(this.items.length / 2);
    let z = centerZ;
    for (let i = 0; i < half; i++) {
      z += rand(MIN_SPACING_Z, MAX_SPACING_Z);
      this.placeAt(this.items[i], z);
    }
    this.tailZ = z;
    z = centerZ;
    for (let i = half; i < this.items.length; i++) {
      z -= rand(MIN_SPACING_Z, MAX_SPACING_Z);
      this.placeAt(this.items[i], z);
    }
    this.headZ = z;
  }

  private placeAt(item: GlyphItem, z: number): void {
    const lateral = rand(-X_MAX, X_MAX);
    item.lateral = lateral;
    item.mesh.position.set(lateral, FLOOR_Y, z);
    item.mesh.rotation.z = rand(0, Math.PI * 2);
  }

  private readonly _work = new Vector3();

  update(shipZ: number): void {
    for (const item of this.items) {
      const dz = item.mesh.position.z - shipZ;
      if (dz > RECYCLE_DIST) {
        this.headZ -= rand(MIN_SPACING_Z, MAX_SPACING_Z);
        this.placeAt(item, this.headZ);
      } else if (dz < -RECYCLE_DIST) {
        this.tailZ += rand(MIN_SPACING_Z, MAX_SPACING_Z);
        this.placeAt(item, this.tailZ);
      }
      // Silence three.js treeshaker lint — _work left for future per-tile
      // animation (e.g. subtle pulse keyed off axial distance).
      this._work.copy(item.mesh.position);
    }
  }

  recenter(shipZ: number): void {
    this.layOutChainAround(shipZ);
  }
}
