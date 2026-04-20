import {
  Color,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RingGeometry,
  Vector2,
} from 'three';
import { Puzzle } from './PuzzleBase.ts';

/**
 * Girih tessellation — fit every polyomino tile onto a 5×5 field so that
 * all 25 cells are covered. Tiles rotate in place before being dropped;
 * no overlaps, no overhangs. The set is chosen so that exactly one
 * dissection fills the board — a compact parallel to the strapwork
 * patterns Islamic geometers wove across domes and muqarnas.
 */

const N = 5;
const CELL_PX = 62;
const BOARD_PX = N * CELL_PX;

type Shape = readonly (readonly [number, number])[];

interface TileDef {
  readonly id: string;
  readonly color: string;
  readonly stroke: string;
  readonly shape: Shape;
}

/**
 * A deterministic 5×5 packing using five polyominoes (25 cells total).
 * The target dissection:
 *    A B B B B
 *    A D B C C
 *    A D E E C
 *    A D E E C
 *    A D D D C
 * Each letter is one piece. 5 + 5 + 5 + 6 + 4 = 25. The player doesn't
 * see the target — they just fit the set into the empty 5×5 board. */
const TILES: readonly TileDef[] = [
  // A — I-pentomino (5 cells vertical)
  {
    id: 'A',
    color: '#a5583a',
    stroke: '#5a2a14',
    shape: [
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
    ],
  },
  // B — T-pentomino (4-wide bar + one below, second-from-left)
  {
    id: 'B',
    color: '#3f7a7e',
    stroke: '#1c3c40',
    shape: [
      [0, 0], [1, 0], [2, 0], [3, 0], [1, 1],
    ],
  },
  // C — L-pentomino (short bar + vertical three hanging from right end)
  {
    id: 'C',
    color: '#c9a94e',
    stroke: '#5a4518',
    shape: [
      [0, 0], [1, 0], [1, 1], [1, 2], [1, 3],
    ],
  },
  // D — L-hexomino (tall vertical + 2 at bottom-right)
  {
    id: 'D',
    color: '#7d4b8a',
    stroke: '#3b2042',
    shape: [
      [0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3],
    ],
  },
  // E — O-tetromino (2×2 block)
  {
    id: 'E',
    color: '#d68b4f',
    stroke: '#5e361a',
    shape: [
      [0, 0], [1, 0], [0, 1], [1, 1],
    ],
  },
];

function rotateShape(shape: Shape, rot: 0 | 1 | 2 | 3): Shape {
  if (rot === 0) return shape;
  return shape.map(([x, y]) => {
    if (rot === 1) return [-y, x];
    if (rot === 2) return [-x, -y];
    return [y, -x];
  }) as Shape;
}

function normalizeShape(shape: Shape): Shape {
  let mx = Infinity;
  let my = Infinity;
  for (const [x, y] of shape) {
    if (x < mx) mx = x;
    if (y < my) my = y;
  }
  return shape.map(([x, y]) => [x - mx, y - my]) as Shape;
}

interface Placement {
  readonly id: string;
  x: number;
  y: number;
  rot: 0 | 1 | 2 | 3;
}

export class GirihPuzzle extends Puzzle {
  readonly title = 'GIRIH';
  readonly subtitle = 'woven tiles';
  readonly instructions =
    'Fit every tile onto the 5×5 field so nothing overlaps and no cell is left bare. Rotate the selected tile with R.';

  private placed = new Map<string, Placement>();
  private selectedId: string | null = null;
  private selectedRot: 0 | 1 | 2 | 3 = 0;

  private root: HTMLDivElement | null = null;
  private boardEl: HTMLDivElement | null = null;
  private trayEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private boardCells: HTMLDivElement[][] = [];
  private tileCards = new Map<string, HTMLButtonElement>();
  private rotateBtn: HTMLButtonElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.buildDom();
    this.refresh();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const floor = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#141f30'),
        roughness: 0.55,
        metalness: 0.3,
        side: DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    this.group.add(floor);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.2, 10),
      new MeshStandardMaterial({
        color: new Color('#e0bf6c'),
        emissive: new Color('#3c2a10'),
        emissiveIntensity: 0.55,
        roughness: 0.4,
        metalness: 0.85,
        side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const lamp = new PointLight('#f5d28a', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-girih';
    root.style.cssText = `
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      z-index:20; pointer-events:none; font-family:'Cormorant Garamond', Georgia, serif;
    `;
    this.root = root;

    const panel = document.createElement('div');
    panel.style.cssText = `
      display:flex; flex-direction:column; align-items:center; gap:16px;
      pointer-events:auto;
      padding:22px 28px;
      background:rgba(10,18,34,0.78); backdrop-filter:blur(12px);
      border:1px solid rgba(159,200,255,0.25);
      border-top:3px solid var(--era-accent);
      border-radius:10px;
      box-shadow:0 18px 60px rgba(0,0,0,0.55);
      color:#e6eefb;
    `;
    root.appendChild(panel);

    const title = document.createElement('div');
    title.style.cssText = `font-size:18px; letter-spacing:0.26em; color:var(--era-accent); font-weight:600;`;
    title.textContent = 'GIRIH';
    panel.appendChild(title);

    const body = document.createElement('div');
    body.style.cssText = `display:flex; gap:22px; align-items:flex-start;`;
    panel.appendChild(body);

    // Board.
    const board = document.createElement('div');
    board.style.cssText = `
      position:relative;
      width:${BOARD_PX}px; height:${BOARD_PX}px;
      background:rgba(0,0,0,0.3);
      border:1px solid rgba(159,200,255,0.35);
      border-radius:6px;
    `;
    this.boardEl = board;
    body.appendChild(board);

    for (let y = 0; y < N; y++) {
      const row: HTMLDivElement[] = [];
      for (let x = 0; x < N; x++) {
        const cell = document.createElement('div');
        cell.style.cssText = `
          position:absolute;
          left:${x * CELL_PX}px; top:${y * CELL_PX}px;
          width:${CELL_PX}px; height:${CELL_PX}px;
          box-sizing:border-box;
          border:1px solid rgba(159,200,255,0.14);
        `;
        cell.addEventListener('click', () => this.tryPlace(x, y));
        board.appendChild(cell);
        row.push(cell);
      }
      this.boardCells.push(row);
    }

    // Tray.
    const tray = document.createElement('div');
    tray.style.cssText = `
      display:flex; flex-direction:column; gap:10px;
      min-width:140px;
    `;
    this.trayEl = tray;
    body.appendChild(tray);

    for (const t of TILES) {
      const card = document.createElement('button');
      card.type = 'button';
      card.style.cssText = `
        display:flex; align-items:center; gap:10px;
        padding:8px 10px;
        background:rgba(159,200,255,0.06); border:1px solid rgba(159,200,255,0.25);
        color:#e6eefb;
        font-family:inherit; font-size:11px; letter-spacing:0.2em; font-weight:600;
        border-radius:6px; cursor:pointer;
      `;
      const preview = document.createElement('div');
      preview.style.cssText = `width:60px; height:60px; position:relative; flex-shrink:0;`;
      const label = document.createElement('div');
      label.textContent = `TILE ${t.id}`;
      card.appendChild(preview);
      card.appendChild(label);
      card.addEventListener('click', () => this.selectTile(t.id));
      tray.appendChild(card);
      this.tileCards.set(t.id, card);
    }

    // Rotate / remove buttons.
    const btnRow = document.createElement('div');
    btnRow.style.cssText = `display:flex; gap:8px;`;
    panel.appendChild(btnRow);

    const rot = document.createElement('button');
    rot.type = 'button';
    rot.textContent = 'ROTATE (R)';
    rot.style.cssText = this.btnCss();
    rot.addEventListener('click', () => this.rotateSelected());
    btnRow.appendChild(rot);
    this.rotateBtn = rot;

    const clr = document.createElement('button');
    clr.type = 'button';
    clr.textContent = 'RESET BOARD';
    clr.style.cssText = this.btnCss();
    clr.addEventListener('click', () => this.resetBoard());
    btnRow.appendChild(clr);

    const status = document.createElement('div');
    status.style.cssText = `font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;`;
    this.statusEl = status;
    panel.appendChild(status);

    // Keyboard rotation.
    const keyHandler = (ev: KeyboardEvent) => {
      if (ev.key === 'r' || ev.key === 'R') {
        this.rotateSelected();
        ev.preventDefault();
      } else if (ev.key === 'Escape') {
        this.selectedId = null;
        this.refresh();
      }
    };
    window.addEventListener('keydown', keyHandler);
    (this as unknown as { _keyHandler: (ev: KeyboardEvent) => void })._keyHandler = keyHandler;

    // Draw previews.
    this.drawTrayPreviews();

    document.body.appendChild(root);
  }

  private btnCss(): string {
    return `
      padding:8px 14px;
      background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.25);
      color:#e6eefb; opacity:0.9;
      font-family:inherit; font-size:11px; letter-spacing:0.22em; font-weight:600;
      border-radius:5px; cursor:pointer;
    `;
  }

  private drawTrayPreviews(): void {
    for (const t of TILES) {
      const card = this.tileCards.get(t.id);
      if (!card) continue;
      const preview = card.firstChild as HTMLDivElement;
      preview.innerHTML = '';
      const rot = this.selectedId === t.id ? this.selectedRot : 0;
      const shape = normalizeShape(rotateShape(t.shape, rot));
      // Bounds for preview scaling.
      let mx = 0;
      let my = 0;
      for (const [x, y] of shape) {
        if (x > mx) mx = x;
        if (y > my) my = y;
      }
      const cellSize = Math.floor(60 / Math.max(mx + 1, my + 1, 3));
      for (const [x, y] of shape) {
        const c = document.createElement('div');
        c.style.cssText = `
          position:absolute;
          left:${x * cellSize}px; top:${y * cellSize}px;
          width:${cellSize - 1}px; height:${cellSize - 1}px;
          background:${t.color}; border:1px solid ${t.stroke};
          border-radius:1px;
        `;
        preview.appendChild(c);
      }
    }
  }

  /* ------------------------------ Input ---------------------------------- */

  private selectTile(id: string): void {
    if (this.isSolved) return;
    if (this.placed.has(id)) {
      // Return it to the tray so the player can try again.
      this.placed.delete(id);
      this.selectedId = id;
      this.selectedRot = 0;
      this.refresh();
      return;
    }
    if (this.selectedId === id) {
      // Second tap rotates.
      this.selectedRot = ((this.selectedRot + 1) % 4) as 0 | 1 | 2 | 3;
    } else {
      this.selectedId = id;
      this.selectedRot = 0;
    }
    this.refresh();
  }

  private rotateSelected(): void {
    if (!this.selectedId || this.isSolved) return;
    this.selectedRot = ((this.selectedRot + 1) % 4) as 0 | 1 | 2 | 3;
    this.refresh();
  }

  private tryPlace(x: number, y: number): void {
    if (this.isSolved) return;
    if (!this.selectedId) return;
    const tile = TILES.find((t) => t.id === this.selectedId);
    if (!tile) return;
    const shape = normalizeShape(rotateShape(tile.shape, this.selectedRot));
    // Validate: every cell in bounds and not occupied by another tile.
    const occ = this.occupancy();
    for (const [sx, sy] of shape) {
      const cx = x + sx;
      const cy = y + sy;
      if (cx < 0 || cx >= N || cy < 0 || cy >= N) return this.flash('tile overhangs the field');
      if (occ[cy][cx] !== null) return this.flash('tiles cannot overlap');
    }
    this.placed.set(tile.id, { id: tile.id, x, y, rot: this.selectedRot });
    this.selectedId = null;
    this.selectedRot = 0;
    this.refresh();
    this.checkSolved();
  }

  private resetBoard(): void {
    this.placed.clear();
    this.selectedId = null;
    this.selectedRot = 0;
    this.refresh();
  }

  private flash(msg: string): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.style.color = '#e89090';
    setTimeout(() => {
      if (this.statusEl && !this.isSolved) {
        this.statusEl.style.color = '';
        this.refresh();
      }
    }, 900);
  }

  /* ------------------------------ Render --------------------------------- */

  private occupancy(): (string | null)[][] {
    const grid: (string | null)[][] = Array.from({ length: N }, () => Array(N).fill(null));
    for (const p of this.placed.values()) {
      const tile = TILES.find((t) => t.id === p.id);
      if (!tile) continue;
      const shape = normalizeShape(rotateShape(tile.shape, p.rot));
      for (const [sx, sy] of shape) {
        const cx = p.x + sx;
        const cy = p.y + sy;
        if (cx >= 0 && cx < N && cy >= 0 && cy < N) grid[cy][cx] = tile.id;
      }
    }
    return grid;
  }

  private refresh(): void {
    const occ = this.occupancy();
    // Paint board cells.
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const cell = this.boardCells[y][x];
        const id = occ[y][x];
        if (id) {
          const tile = TILES.find((t) => t.id === id);
          if (tile) {
            cell.style.background = tile.color;
            cell.style.borderColor = tile.stroke;
          }
        } else {
          cell.style.background = 'transparent';
          cell.style.borderColor = 'rgba(159,200,255,0.14)';
        }
      }
    }
    // Tray cards — placed tiles dimmed, selected tile highlighted.
    for (const t of TILES) {
      const card = this.tileCards.get(t.id);
      if (!card) continue;
      const placed = this.placed.has(t.id);
      const sel = this.selectedId === t.id;
      card.style.opacity = placed ? '0.45' : '1';
      card.style.background = sel
        ? 'rgba(245,214,144,0.18)'
        : placed
          ? 'rgba(120,200,150,0.08)'
          : 'rgba(159,200,255,0.06)';
      card.style.borderColor = sel
        ? 'var(--era-accent)'
        : placed
          ? 'rgba(120,200,150,0.35)'
          : 'rgba(159,200,255,0.25)';
    }
    if (this.rotateBtn) {
      this.rotateBtn.style.opacity = this.selectedId ? '1' : '0.45';
      this.rotateBtn.style.cursor = this.selectedId ? 'pointer' : 'default';
    }
    this.drawTrayPreviews();
    if (this.statusEl && !this.isSolved) {
      let filled = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (occ[y][x] !== null) filled++;
      if (this.selectedId) {
        this.statusEl.textContent = `placing tile ${this.selectedId} · tap a cell (rotation ${this.selectedRot})`;
      } else {
        this.statusEl.textContent = `${filled} / ${N * N} cells covered`;
      }
      this.statusEl.style.color = '';
    }
  }

  private checkSolved(): void {
    const occ = this.occupancy();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (occ[y][x] === null) return;
    // All cells covered — the placement must match the solution (within
    // rotation-symmetric tolerance). Comparing occupancy to target would
    // require labelled pieces, but all tiles placed with no gaps and no
    // overlaps on a 5×5 using exactly the 25-cell piece set means the
    // player found a valid dissection.
    this.isSolved = true;
    if (this.statusEl) {
      this.statusEl.textContent = 'THE PATTERN IS WHOLE';
      this.statusEl.style.color = '#9fe0a6';
    }
    setTimeout(() => this.onSolved?.(), 900);
  }

  /* -------------------------- Lifecycle ---------------------------------- */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    const kh = (this as unknown as { _keyHandler?: (ev: KeyboardEvent) => void })._keyHandler;
    if (kh) window.removeEventListener('keydown', kh);
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this.boardEl = null;
    this.trayEl = null;
    this.statusEl = null;
    this.boardCells = [];
    this.tileCards.clear();
    this.rotateBtn = null;
    this.placed.clear();
    super.dispose();
  }
}
