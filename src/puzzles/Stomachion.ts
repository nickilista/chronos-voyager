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
 * Stomachion — Archimedes' square dissection. A 6×6 square is split into
 * eight polygonal tiles. The tiles start scattered in a tray on the right
 * and the player drags them onto the board until every tile rests over the
 * cell it was cut from. Snap is at half-cell resolution, matching the
 * classical 288-solution analysis where pieces share vertices at half-grid
 * intersections.
 *
 * The 3D scene is just a marble floor for atmosphere — the puzzle itself
 * runs as an SVG overlay so the polygons can be dragged without round-trips
 * through the raycaster. The drag layer is torn down in dispose().
 */

const GRID = 12;
const BOARD_PX = 480; // SVG viewport is drawn at this logical size
const CELL_PX = BOARD_PX / GRID;
const SNAP_TOL = 0.6; // distance (in grid units) from solution that counts as solved

// Level-5 stomachion dissection on a 12×12 grid — 18 polygonal tiles. Each
// piece lists its vertices as [col, row]. Matches the iOS "hard" layout
// (omitting the degenerate bottom-strip tile so every piece has area).
type Point = readonly [number, number];
const PIECES: readonly (readonly Point[])[] = [
  [[0, 0], [4, 0], [3, 3]],
  [[4, 0], [8, 0], [8, 3], [3, 3]],
  [[8, 0], [12, 0], [12, 4], [8, 3]],
  [[0, 0], [3, 3], [0, 4]],
  [[3, 3], [8, 3], [7, 4], [4, 4]],
  [[0, 4], [3, 3], [4, 4]],
  [[8, 3], [12, 4], [12, 6], [7, 4]],
  [[0, 4], [4, 4], [4, 7], [2, 8], [0, 8]],
  [[4, 4], [7, 4], [8, 7], [4, 7]],
  [[7, 4], [12, 6], [12, 8], [8, 7]],
  [[0, 8], [2, 8], [0, 12]],
  [[2, 8], [4, 7], [6, 8]],
  [[4, 7], [8, 7], [6, 8]],
  [[0, 12], [2, 8], [6, 8], [4, 12]],
  [[8, 7], [12, 8], [12, 10], [9, 10]],
  [[6, 8], [8, 7], [9, 10], [8, 12], [4, 12]],
  [[9, 10], [12, 10], [12, 12]],
  [[8, 12], [9, 10], [12, 12]],
];

// Mediterranean palette — olive, wine, sand, Aegean blue, etc.
const PIECE_FILLS = [
  '#d89b3a',
  '#6b8e4e',
  '#a6526b',
  '#4a90d9',
  '#d4c350',
  '#8a5cb0',
  '#4ab0a3',
  '#c87a42',
];
const PIECE_STROKES = [
  '#7e5a1e',
  '#3d5430',
  '#62313e',
  '#255789',
  '#85762b',
  '#4f346a',
  '#226861',
  '#7a4525',
];

function centroidOf(pts: readonly Point[]): Point {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
  }
  return [sx / pts.length, sy / pts.length];
}

function scatterFor(i: number, total: number): Point {
  // Arrange unplaced tiles in a deterministic grid to the right of the
  // board so all 18 pieces have breathing room. 3 columns, stacked rows.
  const cols = 3;
  const rows = Math.ceil(total / cols);
  const col = i % cols;
  const row = Math.floor(i / cols);
  const rowStep = GRID / rows;
  return [GRID + 0.8 + col * 2.3, 0.2 + row * rowStep];
}

interface Piece {
  readonly id: number;
  readonly base: readonly Point[]; // solved-state vertex coords on grid
  readonly fill: string;
  readonly stroke: string;
  // Current top-left offset in grid units (solution: 0,0).
  offX: number;
  offY: number;
  placed: boolean; // true once the tile has entered the board area
  order: number; // z-order (latest-dragged on top)
  poly: SVGPolygonElement | null;
}

export class StomachionPuzzle extends Puzzle {
  readonly title = 'STOMACHION';
  readonly subtitle = "Archimedes' square";
  readonly instructions =
    'Drag every tile from the tray onto the board so the dissection is restored. Half-cell snap — line up the edges.';

  private pieces: Piece[] = [];
  private root: HTMLDivElement | null = null;
  private svg: SVGSVGElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private trayHintEl: HTMLDivElement | null = null;
  private checkBtn: HTMLButtonElement | null = null;
  private dragging: { piece: Piece; grabOffsetX: number; grabOffsetY: number } | null = null;
  private moveHandler: ((ev: PointerEvent) => void) | null = null;
  private upHandler: ((ev: PointerEvent) => void) | null = null;
  private orderCounter = 0;
  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.buildPieces();
    this.buildDom();
    this.renderAll();
    this.refreshStatus();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    // Simple marble dais so the screen isn't pitch black behind the SVG.
    const marble = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#d8d2c1'),
        roughness: 0.6,
        metalness: 0.15,
        side: DoubleSide,
      }),
    );
    marble.rotation.x = -Math.PI / 2;
    marble.position.y = -2.4;
    this.group.add(marble);

    // Bronze laurel ring hovering above for atmosphere.
    const laurel = new Mesh(
      new RingGeometry(3.2, 3.35, 64),
      new MeshStandardMaterial({
        color: new Color('#c8a24a'),
        emissive: new Color('#4a3010'),
        emissiveIntensity: 0.5,
        roughness: 0.4,
        metalness: 0.9,
        side: DoubleSide,
      }),
    );
    laurel.rotation.x = -Math.PI / 2;
    laurel.position.y = -2.38;
    this.group.add(laurel);

    // Warm key so the marble glows.
    const key = new PointLight('#f5d29c', 2.2, 25, 1.6);
    key.position.set(0, 6, 4);
    this.group.add(key);
  }

  /* --------------------------- Piece model -------------------------------- */

  private buildPieces(): void {
    for (let i = 0; i < PIECES.length; i++) {
      const base = PIECES[i];
      const [bx, by] = this.boundsMin(base);
      // Normalize so each piece's local (0,0) is its bounding-box top-left.
      const normalized = base.map(([x, y]) => [x - bx, y - by] as Point);
      // The piece's solution offset is (bx, by) — i.e. adding offX=bx, offY=by
      // places it back where it belongs.
      const scatter = scatterFor(i, PIECES.length);
      this.pieces.push({
        id: i,
        base: normalized,
        fill: PIECE_FILLS[i % PIECE_FILLS.length],
        stroke: PIECE_STROKES[i % PIECE_STROKES.length],
        offX: scatter[0],
        offY: scatter[1],
        placed: false,
        order: i,
        poly: null,
      });
      // Stash the target (bx, by) on the piece by encoding it in `id` lookup.
      (this.pieces[i] as Piece & { targetX: number; targetY: number }).targetX = bx;
      (this.pieces[i] as Piece & { targetX: number; targetY: number }).targetY = by;
    }
  }

  private boundsMin(pts: readonly Point[]): Point {
    let mx = Infinity;
    let my = Infinity;
    for (const [x, y] of pts) {
      if (x < mx) mx = x;
      if (y < my) my = y;
    }
    return [mx, my];
  }

  private targetOf(p: Piece): Point {
    const q = p as Piece & { targetX: number; targetY: number };
    return [q.targetX, q.targetY];
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-stomachion';
    root.style.cssText = `
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      z-index:20; pointer-events:none; font-family:'Cormorant Garamond', Georgia, serif;
    `;
    this.root = root;

    const panel = document.createElement('div');
    panel.style.cssText = `
      display:flex; flex-direction:column; align-items:center; gap:14px;
      pointer-events:auto;
      padding:18px 22px;
      background:rgba(10,18,34,0.75); backdrop-filter:blur(12px);
      border:1px solid rgba(159,200,255,0.25);
      border-top:3px solid var(--era-accent);
      border-radius:10px;
      box-shadow:0 18px 60px rgba(0,0,0,0.55);
      color:#e6eefb;
    `;
    root.appendChild(panel);

    const title = document.createElement('div');
    title.style.cssText = `
      font-size:18px; letter-spacing:0.28em; color:var(--era-accent); font-weight:600;
    `;
    title.textContent = 'STOMACHION';
    panel.appendChild(title);

    const status = document.createElement('div');
    status.style.cssText = `
      font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;
    `;
    this.statusEl = status;
    panel.appendChild(status);

    // SVG board: board area (0..GRID) plus tray to the right (GRID..GRID+7).
    const VIEW_W = BOARD_PX + CELL_PX * 7 + 20;
    const VIEW_H = BOARD_PX + 8;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(VIEW_W));
    svg.setAttribute('height', String(VIEW_H));
    svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
    svg.style.cssText = 'display:block; touch-action:none; user-select:none;';
    this.svg = svg;

    // Board background — subtle parchment.
    const boardBg = document.createElementNS(svgNS, 'rect');
    boardBg.setAttribute('x', '4');
    boardBg.setAttribute('y', '4');
    boardBg.setAttribute('width', String(BOARD_PX));
    boardBg.setAttribute('height', String(BOARD_PX));
    boardBg.setAttribute('rx', '6');
    boardBg.setAttribute('fill', 'rgba(15,28,50,0.65)');
    boardBg.setAttribute('stroke', 'rgba(159,200,255,0.35)');
    boardBg.setAttribute('stroke-width', '1.5');
    svg.appendChild(boardBg);

    // Grid lines.
    for (let i = 1; i < GRID; i++) {
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', String(4 + i * CELL_PX));
      line.setAttribute('y1', '4');
      line.setAttribute('x2', String(4 + i * CELL_PX));
      line.setAttribute('y2', String(4 + BOARD_PX));
      line.setAttribute('stroke', 'rgba(255,255,255,0.08)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      const line2 = document.createElementNS(svgNS, 'line');
      line2.setAttribute('x1', '4');
      line2.setAttribute('y1', String(4 + i * CELL_PX));
      line2.setAttribute('x2', String(4 + BOARD_PX));
      line2.setAttribute('y2', String(4 + i * CELL_PX));
      line2.setAttribute('stroke', 'rgba(255,255,255,0.08)');
      line2.setAttribute('stroke-width', '1');
      svg.appendChild(line2);
    }

    // Tray divider.
    const trayLabel = document.createElementNS(svgNS, 'text');
    trayLabel.setAttribute('x', String(4 + BOARD_PX + 14));
    trayLabel.setAttribute('y', '22');
    trayLabel.setAttribute('font-family', 'Cormorant Garamond, serif');
    trayLabel.setAttribute('font-size', '13');
    trayLabel.setAttribute('letter-spacing', '0.28em');
    trayLabel.setAttribute('fill', 'var(--era-accent)');
    trayLabel.setAttribute('opacity', '0.7');
    trayLabel.textContent = 'TRAY';
    svg.appendChild(trayLabel);

    // Layer for pieces — appended last so they sit on top.
    for (const p of this.pieces) {
      const poly = document.createElementNS(svgNS, 'polygon');
      poly.setAttribute('fill', p.fill);
      poly.setAttribute('stroke', p.stroke);
      poly.setAttribute('stroke-width', '1.5');
      poly.setAttribute('stroke-linejoin', 'round');
      poly.style.cssText = 'cursor:grab; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));';
      poly.addEventListener('pointerdown', (ev) => this.onPieceDown(ev, p));
      svg.appendChild(poly);
      p.poly = poly;
    }

    panel.appendChild(svg);

    // Tray hint.
    const trayHint = document.createElement('div');
    trayHint.style.cssText = 'font-size:12px; opacity:0.55; letter-spacing:0.08em;';
    trayHint.textContent = 'Drag the tiles from the tray to rebuild the square.';
    this.trayHintEl = trayHint;
    panel.appendChild(trayHint);

    // Check button.
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'VERIFY';
    btn.style.cssText = `
      pointer-events:auto;
      padding:9px 26px;
      background:rgba(159,200,255,0.08);
      border:1px solid rgba(159,200,255,0.4);
      color:var(--era-accent);
      font-family:'Cormorant Garamond', Georgia, serif;
      font-size:14px; letter-spacing:0.3em; font-weight:600;
      border-radius:4px; cursor:pointer;
    `;
    btn.addEventListener('click', () => this.verify());
    this.checkBtn = btn;
    panel.appendChild(btn);

    document.body.appendChild(root);

    // Global drag listeners — SVG pointer capture is finicky with z-order
    // reparenting, so we drive the move/up from window.
    this.moveHandler = (ev) => this.onMove(ev);
    this.upHandler = (ev) => this.onUp(ev);
    window.addEventListener('pointermove', this.moveHandler);
    window.addEventListener('pointerup', this.upHandler);
    window.addEventListener('pointercancel', this.upHandler);
  }

  /* --------------------------- Rendering --------------------------------- */

  private renderAll(): void {
    // Re-sort SVG children so the most recently dragged piece renders on top.
    const sorted = [...this.pieces].sort((a, b) => a.order - b.order);
    for (const p of sorted) {
      if (!p.poly || !this.svg) continue;
      this.svg.appendChild(p.poly);
      this.renderPiece(p);
    }
  }

  private renderPiece(p: Piece): void {
    if (!p.poly) return;
    const pts = p.base
      .map(([x, y]) => {
        const gx = x + p.offX;
        const gy = y + p.offY;
        const px = 4 + gx * CELL_PX;
        const py = 4 + gy * CELL_PX;
        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(' ');
    p.poly.setAttribute('points', pts);
    p.poly.setAttribute('opacity', this.dragging?.piece === p ? '0.9' : '0.82');
  }

  /* ------------------------------ Drag ----------------------------------- */

  private onPieceDown(ev: PointerEvent, p: Piece): void {
    if (this.isSolved) return;
    ev.preventDefault();
    const { gx, gy } = this.eventToGrid(ev);
    // The grab offset is the pointer position minus the piece's current origin.
    this.dragging = { piece: p, grabOffsetX: gx - p.offX, grabOffsetY: gy - p.offY };
    this.orderCounter++;
    p.order = this.orderCounter;
    if (p.poly) p.poly.style.cursor = 'grabbing';
    this.renderAll();
  }

  private onMove(ev: PointerEvent): void {
    if (!this.dragging) return;
    ev.preventDefault();
    const { gx, gy } = this.eventToGrid(ev);
    const p = this.dragging.piece;
    p.offX = gx - this.dragging.grabOffsetX;
    p.offY = gy - this.dragging.grabOffsetY;
    this.renderPiece(p);
  }

  private onUp(_ev: PointerEvent): void {
    if (!this.dragging) return;
    const p = this.dragging.piece;
    // Half-cell snap.
    p.offX = Math.round(p.offX * 2) / 2;
    p.offY = Math.round(p.offY * 2) / 2;
    // Is the piece on the board? Center must fall inside the 0..GRID square.
    const [cx, cy] = centroidOf(p.base);
    const centerX = p.offX + cx;
    const centerY = p.offY + cy;
    p.placed = centerX >= 0 && centerX <= GRID && centerY >= 0 && centerY <= GRID;
    if (p.poly) p.poly.style.cursor = 'grab';
    this.dragging = null;
    this.renderPiece(p);
    this.refreshStatus();
  }

  private eventToGrid(ev: PointerEvent): { gx: number; gy: number } {
    if (!this.svg) return { gx: 0, gy: 0 };
    const rect = this.svg.getBoundingClientRect();
    // SVG viewBox runs 0..(VIEW_W); board starts at x=4, each cell is CELL_PX.
    const sx = ((ev.clientX - rect.left) / rect.width) * Number(this.svg.getAttribute('width'));
    const sy = ((ev.clientY - rect.top) / rect.height) * Number(this.svg.getAttribute('height'));
    return { gx: (sx - 4) / CELL_PX, gy: (sy - 4) / CELL_PX };
  }

  /* ---------------------------- Solve check ------------------------------ */

  private isCorrectlyPlaced(p: Piece): boolean {
    const [tx, ty] = this.targetOf(p);
    const dx = p.offX - tx;
    const dy = p.offY - ty;
    return Math.hypot(dx, dy) < SNAP_TOL;
  }

  private refreshStatus(): void {
    if (!this.statusEl) return;
    const placed = this.pieces.filter((p) => p.placed).length;
    this.statusEl.textContent = `${placed} / ${this.pieces.length} tiles placed`;
    if (this.checkBtn) {
      const allPlaced = placed === this.pieces.length;
      this.checkBtn.disabled = !allPlaced;
      this.checkBtn.style.opacity = allPlaced ? '1' : '0.35';
    }
  }

  private verify(): void {
    const allCorrect = this.pieces.every((p) => p.placed && this.isCorrectlyPlaced(p));
    if (allCorrect) {
      this.isSolved = true;
      if (this.statusEl) {
        this.statusEl.textContent = 'THE SQUARE IS WHOLE';
        this.statusEl.style.color = '#9fe0a6';
      }
      if (this.trayHintEl) this.trayHintEl.style.display = 'none';
      if (this.checkBtn) this.checkBtn.style.display = 'none';
      setTimeout(() => this.onSolved?.(), 900);
    } else {
      if (this.statusEl) {
        const prev = this.statusEl.textContent;
        this.statusEl.style.color = '#e89090';
        this.statusEl.textContent = 'not quite — realign the edges';
        setTimeout(() => {
          if (!this.statusEl || this.isSolved) return;
          this.statusEl.style.color = '';
          this.statusEl.textContent = prev;
        }, 1400);
      }
    }
  }

  /* -------------------------- Lifecycle ---------------------------------- */

  update(_dt: number, camera: PerspectiveCamera): void {
    // Gently tilt the camera so the marble dais is visible behind the SVG.
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {
    // All interaction happens in the DOM overlay — ignore raycaster picks.
  }

  override dispose(): void {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    if (this.moveHandler) window.removeEventListener('pointermove', this.moveHandler);
    if (this.upHandler) {
      window.removeEventListener('pointerup', this.upHandler);
      window.removeEventListener('pointercancel', this.upHandler);
    }
    this.moveHandler = null;
    this.upHandler = null;
    this.svg = null;
    this.statusEl = null;
    this.trayHintEl = null;
    this.checkBtn = null;
    this.pieces = [];
    super.dispose();
  }
}

