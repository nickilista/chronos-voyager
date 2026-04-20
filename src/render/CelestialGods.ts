import {
  CanvasTexture,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';
import type { EraId } from '../eras/eras.ts';
import { PANTHEONS } from './pantheons/index.ts';
import type { Figure, Palette } from './pantheons/index.ts';

/**
 * Per-era pantheon of orbiting celestial figures. Each figure is drawn to
 * its own CanvasTexture and billboarded into the sky on a slow orbit
 * around the camera. When the active flow's era changes, the textures are
 * swapped out so the backdrop iconography always matches the era: pharaonic
 * gods in Egypt, Olympians in Greece, scholars in Baghdad, philosophers at
 * the Enlightenment, and so on.
 *
 * They never approach the player — only the orbit drifts them around the
 * scene. The group tracks the camera so the figures feel like distant
 * celestial fixtures rather than obstacles in the corridor.
 */

const ORBIT_RADIUS = 150;
const ORBIT_RADIUS_JITTER = 20;
const Y_MIN = 22;
const Y_MAX = 60;
const TILE_W = 32;
const TILE_H = 48;
const ORBIT_SPEED_MIN = 0.03;
const ORBIT_SPEED_MAX = 0.055;

interface FigureItem {
  mesh: Mesh;
  material: MeshBasicMaterial;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  height: number;
  figureIndex: number;
}

/* ------------------------- Procedural textures --------------------------- */

// One cache entry per (era, figureId) pair — figures are drawn once and
// reused every time the player returns to that era.
const textureCache = new Map<string, CanvasTexture>();

function figureTexture(eraId: EraId, figure: Figure, palette: Palette): CanvasTexture {
  const key = `${eraId}:${figure.id}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const W = 640;
  const H = Math.round(W * (TILE_H / TILE_W));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return new CanvasTexture(c);

  // Backdrop: soft radial glow in the era's mid-hue, then a halo disc
  // behind the figure's head in the era's accent family.
  const cx = W / 2;
  const cyHalo = H * 0.24;
  const radial = g.createRadialGradient(cx, cyHalo, W * 0.04, cx, H * 0.55, W * 0.58);
  radial.addColorStop(0, palette.glowInner);
  radial.addColorStop(0.45, palette.glowMid);
  radial.addColorStop(1, palette.glowEdge);
  g.fillStyle = radial;
  g.fillRect(0, 0, W, H);

  g.save();
  g.translate(cx, cyHalo);
  g.fillStyle = palette.halo;
  g.beginPath();
  g.arc(0, 0, W * 0.17, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // Figure draws centred, scaled to the full tile.
  g.save();
  g.translate(cx, H * 0.5);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const s = Math.min(W * 0.42, H * 0.42);
  figure.draw(g, s, palette);
  g.restore();

  const tex = new CanvasTexture(c);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  textureCache.set(key, tex);
  return tex;
}

/* ----------------------------- Pantheon ---------------------------------- */

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export class CelestialGods {
  readonly group = new Group();
  private items: FigureItem[] = [];
  private readonly baseOpacity = 0.85;
  private currentEra: EraId | null = null;

  init(initialEra: EraId = 'egypt'): void {
    const pantheon = PANTHEONS[initialEra];
    this.currentEra = initialEra;
    const count = pantheon.figures.length;
    for (let i = 0; i < count; i++) {
      const figure = pantheon.figures[i];
      const mat = new MeshBasicMaterial({
        map: figureTexture(initialEra, figure, pantheon.palette),
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        opacity: this.baseOpacity,
      });
      const mesh = new Mesh(new PlaneGeometry(TILE_W, TILE_H), mat);
      const orbitAngle = (i / count) * Math.PI * 2 + rand(-0.08, 0.08);
      this.items.push({
        mesh,
        material: mat,
        orbitRadius: ORBIT_RADIUS + rand(-ORBIT_RADIUS_JITTER, ORBIT_RADIUS_JITTER),
        orbitAngle,
        orbitSpeed: rand(ORBIT_SPEED_MIN, ORBIT_SPEED_MAX) * (Math.random() < 0.5 ? 1 : -1),
        height: rand(Y_MIN, Y_MAX),
        figureIndex: i,
      });
      this.group.add(mesh);
    }
  }

  /**
   * Swap the orbiting figures to a different era's pantheon. The orbit
   * positions/speeds are preserved so the transition feels like the sky
   * fading between different pantheons rather than a hard reset. If the
   * new pantheon has a different figure count, extra figures are reused
   * by wrapping the index.
   */
  setEra(eraId: EraId): void {
    if (eraId === this.currentEra) return;
    const pantheon = PANTHEONS[eraId];
    this.currentEra = eraId;
    const count = pantheon.figures.length;
    for (const it of this.items) {
      const fi = it.figureIndex % count;
      const figure = pantheon.figures[fi];
      it.material.map = figureTexture(eraId, figure, pantheon.palette);
      it.material.needsUpdate = true;
    }
  }

  private readonly _offsetWork = new Vector3();

  /**
   * Advance each figure's orbit and billboard it toward the camera. The orbit
   * plane is expressed in the *active flow's* local frame (a circle in the
   * flow's local XZ plane, Y = `height`), then rotated into world space by
   * `flowQuat`. This guarantees that in Egypt the orbit matches the original
   * world-XZ circle, and that in tilted flows the figures still sit above the
   * flow's horizon instead of drifting behind the ship or below the floor.
   */
  update(dt: number, cameraPos: Vector3, flowQuat?: Quaternion): void {
    for (const it of this.items) {
      it.orbitAngle += it.orbitSpeed * dt;
      this._offsetWork.set(
        Math.cos(it.orbitAngle) * it.orbitRadius,
        it.height,
        Math.sin(it.orbitAngle) * it.orbitRadius,
      );
      if (flowQuat) this._offsetWork.applyQuaternion(flowQuat);
      it.mesh.position.copy(cameraPos).add(this._offsetWork);
      it.mesh.lookAt(cameraPos);
    }
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  /** Fade the figures out as the ship leaves the active corridor. */
  setInsideFactor(k: number): void {
    const kk = Math.min(1, Math.max(0, k));
    const op = this.baseOpacity * kk;
    for (const it of this.items) it.material.opacity = op;
  }
}
