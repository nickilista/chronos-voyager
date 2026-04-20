import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Vector2,
  Vector3,
} from 'three';
import { Puzzle } from './PuzzleBase.ts';

/**
 * Pharaoh's Seal — 5×5 sliding-tile puzzle. 24 numbered tiles, one empty
 * slot. Click a tile adjacent to the gap to slide it in. Solved when the
 * tiles read 1..24 left-to-right, top-to-bottom, with the gap in the last
 * cell. Shuffled by walking random legal moves from the solved state, so
 * it's always solvable.
 */

const N = 5;
const CELL = 1.35;
const TILE_SIZE = 1.25;
const TILE_H = 0.35;
const BOARD_W = N * CELL;
const SHUFFLE_MOVES = 80;
const ANIM_DUR = 0.22;

function tileTexture(label: string): CanvasTexture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createLinearGradient(0, 0, s, s);
    grad.addColorStop(0, '#d9b26a');
    grad.addColorStop(1, '#a8823a');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#4e3310';
    g.lineWidth = 6;
    g.strokeRect(6, 6, s - 12, s - 12);
    g.fillStyle = '#2b1805';
    g.font = 'bold 62px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, s / 2, s / 2 + 4);
  }
  return new CanvasTexture(c);
}

interface Tile {
  readonly mesh: Mesh;
  value: number; // 1..24
  row: number;
  col: number;
  anim: { from: Vector3; to: Vector3; t: number; dur: number; active: boolean };
}

function cellWorld(row: number, col: number): Vector3 {
  const x = -BOARD_W / 2 + (col + 0.5) * CELL;
  const z = -BOARD_W / 2 + (row + 0.5) * CELL;
  return new Vector3(x, TILE_H / 2 + 0.02, z);
}

export class PharaohGridPuzzle extends Puzzle {
  readonly title = "PHARAOH'S SEAL";
  readonly subtitle = 'restore the sliding glyphs';
  readonly instructions =
    'Click a tile next to the empty slot to slide it. Arrange 1 → 24 with the gap in the bottom-right.';

  private tiles: Tile[] = [];
  private grid: (Tile | null)[][] = [];
  private emptyRow = N - 1;
  private emptyCol = N - 1;
  private moving = false;
  private statusEl: HTMLDivElement | null = null;
  private moveCount = 0;
  onSolved?: () => void;

  init(): void {
    this.buildBoard();
    this.buildTiles();
    this.shuffle();
    this.buildDomControls();
    this.refreshStatus();
  }

  private buildBoard(): void {
    const base = new Mesh(
      new BoxGeometry(BOARD_W + 0.6, 0.3, BOARD_W + 0.6),
      new MeshStandardMaterial({ color: 0x3a2a12, roughness: 0.85, metalness: 0.1 }),
    );
    base.position.y = -0.15;
    this.group.add(base);

    const well = new Mesh(
      new BoxGeometry(BOARD_W + 0.2, 0.15, BOARD_W + 0.2),
      new MeshStandardMaterial({ color: 0x1d1206, roughness: 0.95 }),
    );
    well.position.y = -0.05;
    this.group.add(well);
  }

  private buildTiles(): void {
    const sideMat = new MeshStandardMaterial({
      color: 0xa8823a,
      roughness: 0.55,
      metalness: 0.55,
    });
    for (let i = 0; i < N; i++) this.grid[i] = new Array(N).fill(null);
    for (let v = 1; v <= N * N - 1; v++) {
      const row = Math.floor((v - 1) / N);
      const col = (v - 1) % N;
      const tex = tileTexture(String(v));
      const topMat = new MeshStandardMaterial({
        map: tex,
        emissive: 0x3a2408,
        emissiveIntensity: 0.35,
        roughness: 0.45,
        metalness: 0.35,
      });
      // Six-material order: +X,-X,+Y,-Y,+Z,-Z. +Y is the top face.
      const mats = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
      const geom = new BoxGeometry(TILE_SIZE, TILE_H, TILE_SIZE);
      const m = new Mesh(geom, mats);
      m.position.copy(cellWorld(row, col));
      const tile: Tile = {
        mesh: m,
        value: v,
        row,
        col,
        anim: { from: new Vector3(), to: new Vector3(), t: 0, dur: 0, active: false },
      };
      m.userData = { tile };
      this.grid[row][col] = tile;
      this.tiles.push(tile);
      this.group.add(m);
    }
  }

  private shuffle(): void {
    let lastDr = 0,
      lastDc = 0;
    for (let i = 0; i < SHUFFLE_MOVES; i++) {
      const options: Array<[number, number]> = [];
      if (this.emptyRow > 0 && !(lastDr === 1 && lastDc === 0)) options.push([-1, 0]);
      if (this.emptyRow < N - 1 && !(lastDr === -1 && lastDc === 0)) options.push([1, 0]);
      if (this.emptyCol > 0 && !(lastDr === 0 && lastDc === 1)) options.push([0, -1]);
      if (this.emptyCol < N - 1 && !(lastDr === 0 && lastDc === -1)) options.push([0, 1]);
      const [dr, dc] = options[Math.floor(Math.random() * options.length)];
      const nr = this.emptyRow + dr;
      const nc = this.emptyCol + dc;
      const t = this.grid[nr][nc];
      if (!t) continue;
      this.grid[this.emptyRow][this.emptyCol] = t;
      this.grid[nr][nc] = null;
      t.row = this.emptyRow;
      t.col = this.emptyCol;
      t.mesh.position.copy(cellWorld(t.row, t.col));
      this.emptyRow = nr;
      this.emptyCol = nc;
      lastDr = dr;
      lastDc = dc;
    }
  }

  private buildDomControls(): void {
    const wrap = document.createElement('div');
    wrap.id = 'puzzle-pharaoh-controls';
    wrap.style.cssText =
      'position:fixed;left:50%;top:28px;transform:translateX(-50%);pointer-events:none;z-index:25;font-family:system-ui,sans-serif;';
    const status = document.createElement('div');
    status.style.cssText =
      'padding:10px 18px;border:1px solid rgba(255,255,255,0.15);border-bottom:3px solid var(--era-accent);background:rgba(10,6,2,0.7);backdrop-filter:blur(10px);border-radius:6px;color:#fff;letter-spacing:0.05em;font-size:14px;text-align:center;min-width:320px;';
    this.statusEl = status;
    wrap.appendChild(status);
    document.body.appendChild(wrap);
  }

  private refreshStatus(): void {
    if (!this.statusEl) return;
    const solved = this.checkSolved();
    this.statusEl.innerHTML = solved
      ? `<div style="color:#7fffa0;font-weight:600">THE SEAL IS RESTORED</div><div style="opacity:0.7;margin-top:3px;font-size:11px">${this.moveCount} moves</div>`
      : `<div style="color:var(--era-accent);font-weight:600">PHARAOH'S SEAL</div><div style="opacity:0.8;margin-top:3px">click a tile next to the gap</div><div style="font-size:11px;opacity:0.6;margin-top:6px">${this.moveCount} moves</div>`;
  }

  private checkSolved(): boolean {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const expected = r * N + c + 1;
        if (expected === N * N) {
          if (this.grid[r][c] !== null) return false;
        } else {
          const t = this.grid[r][c];
          if (!t || t.value !== expected) return false;
        }
      }
    }
    return true;
  }

  private trySlide(tile: Tile): void {
    if (this.moving) return;
    const dr = Math.abs(tile.row - this.emptyRow);
    const dc = Math.abs(tile.col - this.emptyCol);
    if (dr + dc !== 1) return;
    const newRow = this.emptyRow;
    const newCol = this.emptyCol;
    this.grid[tile.row][tile.col] = null;
    this.grid[newRow][newCol] = tile;
    this.emptyRow = tile.row;
    this.emptyCol = tile.col;
    tile.row = newRow;
    tile.col = newCol;
    tile.anim.from.copy(tile.mesh.position);
    tile.anim.to.copy(cellWorld(newRow, newCol));
    tile.anim.t = 0;
    tile.anim.dur = ANIM_DUR;
    tile.anim.active = true;
    this.moving = true;
    this.moveCount++;
  }

  update(dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 11.5, BOARD_W / 2 + 3.5);
    camera.lookAt(0, 0, 0);

    let any = false;
    for (const t of this.tiles) {
      if (!t.anim.active) continue;
      t.anim.t += dt;
      const k = Math.min(1, t.anim.t / t.anim.dur);
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      t.mesh.position.lerpVectors(t.anim.from, t.anim.to, ease);
      if (k >= 1) {
        t.mesh.position.copy(t.anim.to);
        t.anim.active = false;
      } else any = true;
    }
    if (this.moving && !any) {
      this.moving = false;
      this.refreshStatus();
      if (this.checkSolved() && !this.isSolved) {
        this.isSolved = true;
        setTimeout(() => this.onSolved?.(), 900);
      }
    }
  }

  onPointerDown(ndc: Vector2, camera: PerspectiveCamera): void {
    if (this.moving || this.isSolved) return;
    this.raycaster.setFromCamera(ndc, camera);
    const hits = this.raycaster.intersectObjects(
      this.tiles.map((t) => t.mesh),
      false,
    );
    if (hits.length === 0) return;
    const tile = (hits[0].object as Mesh).userData.tile as Tile;
    this.trySlide(tile);
  }

  override dispose(): void {
    const el = document.getElementById('puzzle-pharaoh-controls');
    if (el) el.remove();
    this.statusEl = null;
    super.dispose();
  }
}
