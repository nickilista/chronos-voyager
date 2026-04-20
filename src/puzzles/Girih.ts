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
 * Girih Tessellation — Islamic geometric tile puzzle.
 * Select tiles from the tray, rotate them, then tap the board to place.
 * Drag placed tiles to reposition. Fill all target cells to win.
 *
 * Aligned with the iOS GirihTessellationView.swift implementation:
 *   - Canvas-drawn board with target mask, strapwork patterns
 *   - Polyomino piece generation (tetrominoes, triominoes, dominoes, monominoes)
 *   - Piece rotation (4 orientations)
 *   - Tap to place selected piece on board
 *   - Drag to reposition placed pieces
 *   - Tap placed piece to rotate in-place
 *   - Multiple target shapes (rectangle, arch, star)
 *   - Islamic Golden Age color palette
 */

/* ── Config ─────────────────────────────────────────────────────── */

const GRID_N = 8;
function CELL_PX(): number { return Math.min(56, Math.floor((Math.min(window.innerWidth, 600) - 48) / GRID_N)); }
function BOARD_PX(): number { return GRID_N * CELL_PX(); }

/* ── Colors (Islamic Golden Age palette, matches iOS) ────────────── */

const C_DEEP_BLUE = '#0D1F2D';
const C_MID_BLUE = '#142638';
const C_TEAL = '#1B8A6B';
const C_GOLD = '#C4A44A';
const C_CREAM = '#F4E4BC';
const C_SUCCESS = '#00B894';

const PIECE_COLORS = [
  '#1B8A6B', '#C4A44A', '#8B5E3C',
  '#4A7C9B', '#A05195', '#D45B5B',
  '#5B8C5A', '#C4784A', '#6A89A7',
  '#B8860B', '#7B68AE', '#E07020',
];

/* ── Piece model ─────────────────────────────────────────────────── */

interface GirihPiece {
  id: number;
  cells: { row: number; col: number }[];
  color: string;
  patternType: number;
  rotation: number;
  position: { x: number; y: number }; // grid units (x=col, y=row)
  isPlaced: boolean;
  placedOrder: number;
}

function rotatedCells(piece: GirihPiece): { row: number; col: number }[] {
  let c = piece.cells.map(cell => ({ row: cell.row, col: cell.col }));
  for (let i = 0; i < piece.rotation % 4; i++) {
    c = c.map(cell => ({ row: cell.col, col: -cell.row }));
  }
  const minR = Math.min(...c.map(cell => cell.row));
  const minC = Math.min(...c.map(cell => cell.col));
  return c.map(cell => ({ row: cell.row - minR, col: cell.col - minC }));
}

function boundingSize(piece: GirihPiece): { rows: number; cols: number } {
  const rc = rotatedCells(piece);
  return {
    rows: Math.max(...rc.map(c => c.row)) + 1,
    cols: Math.max(...rc.map(c => c.col)) + 1,
  };
}

/* ── Helpers ──────────────────────────────────────────────────────── */

function buildMask(shape: string, n: number): boolean[][] {
  const mask: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  switch (shape) {
    case 'arch':
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (r >= n - 2 || c <= 1 || c >= n - 2 || r <= 1) mask[r][c] = true;
        }
      }
      break;
    case 'star': {
      const mid = Math.floor(n / 2);
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (Math.abs(r - mid) <= 1 || Math.abs(c - mid) <= 1) mask[r][c] = true;
        }
      }
      break;
    }
    default:
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) mask[r][c] = true;
  }
  return mask;
}

function generatePieces(targetMask: boolean[][], n: number): GirihPiece[] {
  const cells: [number, number][] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (targetMask[r][c]) cells.push([r, c]);
    }
  }

  const used = new Set<string>();
  const result: GirihPiece[] = [];
  let pid = 0;

  const key = (r: number, c: number) => `${r},${c}`;
  const unused = (r: number, c: number) =>
    !used.has(key(r, c)) && r >= 0 && r < n && c >= 0 && c < n && targetMask[r]?.[c] === true;

  const tetrominoes: [number, number][][] = [
    [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [0, 1], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 0]],
    [[0, 0], [0, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 1], [0, 2], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 1]],
  ];

  const triominoes: [number, number][][] = [
    [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [0, 1], [1, 0]],
    [[0, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0]],
  ];

  const dominoes: [number, number][][] = [
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0]],
  ];

  // Shuffle helper
  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function tryPlace(shapes: [number, number][][], r: number, c: number): boolean {
    for (const shape of shuffle(shapes)) {
      const absolute = shape.map(([dr, dc]) => [r + dr, c + dc] as [number, number]);
      if (absolute.every(([ar, ac]) => unused(ar, ac))) {
        const minR2 = Math.min(...absolute.map(a => a[0]));
        const minC2 = Math.min(...absolute.map(a => a[1]));
        const normalized = absolute.map(([ar, ac]) => ({ row: ar - minR2, col: ac - minC2 }));
        for (const a of absolute) used.add(key(a[0], a[1]));
        result.push({
          id: pid,
          cells: normalized,
          color: PIECE_COLORS[pid % PIECE_COLORS.length],
          patternType: pid % 5,
          rotation: 0,
          position: { x: 0, y: 0 },
          isPlaced: false,
          placedOrder: 0,
        });
        pid++;
        return true;
      }
    }
    return false;
  }

  for (const [r, c] of cells) { if (unused(r, c)) tryPlace(tetrominoes, r, c); }
  for (const [r, c] of cells) { if (unused(r, c)) tryPlace(triominoes, r, c); }
  for (const [r, c] of cells) { if (unused(r, c)) tryPlace(dominoes, r, c); }
  for (const [r, c] of cells) {
    if (!unused(r, c)) continue;
    used.add(key(r, c));
    result.push({
      id: pid,
      cells: [{ row: 0, col: 0 }],
      color: PIECE_COLORS[pid % PIECE_COLORS.length],
      patternType: pid % 5,
      rotation: 0,
      position: { x: 0, y: 0 },
      isPlaced: false,
      placedOrder: 0,
    });
    pid++;
  }

  return shuffle(result);
}

/* ── Puzzle class ─────────────────────────────────────────────────── */

export class GirihPuzzle extends Puzzle {
  readonly title = 'GIRIH';
  readonly subtitle = 'woven tiles';
  readonly instructions =
    'Select a tile from the tray, rotate it, then tap the board to place. Tap a placed tile to rotate. Drag placed tiles to reposition. Fill all target cells to complete the tessellation.';

  private pieces: GirihPiece[] = [];
  private grid: number[][] = [];
  private targetMask: boolean[][] = [];
  private selectedID: number | null = null;
  private placedCounter = 0;

  // Drag state
  private draggingID: number | null = null;
  private dragStartPos = { x: 0, y: 0 };
  private dragOffset = { x: 0, y: 0 };
  private dragPickedFromGrid = false;

  // DOM
  private root: HTMLDivElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private trayEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private counterEl: HTMLDivElement | null = null;
  private controlBar: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.setupPuzzle();
    this.buildDom();
    this.drawAll();
    this.refreshTray();
    this.refreshControls();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color(C_DEEP_BLUE), roughness: 0.6, metalness: 0.25, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.18, 10),
      new MeshStandardMaterial({
        color: new Color(C_GOLD), emissive: new Color('#3c2a10'),
        emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.85, side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const lamp = new PointLight('#f5d28a', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ═══════════════════ Setup ═══════════════════════════════════ */

  private setupPuzzle(): void {
    this.targetMask = buildMask('rectangle', GRID_N);
    this.grid = Array.from({ length: GRID_N }, () => Array(GRID_N).fill(-1));
    this.pieces = generatePieces(this.targetMask, GRID_N);
    this.placedCounter = 0;
    this.selectedID = null;
    this.draggingID = null;
  }

  /* ═══════════════════ DOM construction ═══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-girih';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: 'rgba(13,31,45,0.92)', backdropFilter: 'blur(12px)',
      border: `1px solid ${C_TEAL}40`, borderTop: `3px solid ${C_GOLD}`,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_CREAM,
      maxHeight: '96vh', overflowY: 'auto',
    });
    root.appendChild(panel);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '16px', letterSpacing: '0.22em', color: C_GOLD, fontWeight: '700' });
    title.textContent = 'GIRIH TESSELLATION';
    panel.appendChild(title);

    // Counter row
    this.counterEl = document.createElement('div');
    Object.assign(this.counterEl.style, {
      display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', fontSize: '13px', fontWeight: '600', fontVariantNumeric: 'tabular-nums',
    });
    panel.appendChild(this.counterEl);

    // Board wrapper
    const boardWrap = document.createElement('div');
    Object.assign(boardWrap.style, {
      position: 'relative', width: BOARD_PX() + 'px', height: BOARD_PX() + 'px',
      borderRadius: '12px', overflow: 'hidden',
      border: `1.5px solid ${C_TEAL}20`,
    });

    // Canvas
    const cvs = document.createElement('canvas');
    cvs.width = BOARD_PX() * 2;
    cvs.height = BOARD_PX() * 2;
    Object.assign(cvs.style, { width: BOARD_PX() + 'px', height: BOARD_PX() + 'px', display: 'block', cursor: 'pointer' });
    this.ctx2d = cvs.getContext('2d')!;
    this.canvas = cvs;
    boardWrap.appendChild(cvs);

    // Board events
    cvs.addEventListener('click', (e) => this.handleBoardTap(e));
    cvs.addEventListener('mousedown', (e) => this.handleBoardMouseDown(e));
    cvs.addEventListener('mousemove', (e) => this.handleBoardMouseMove(e));
    cvs.addEventListener('mouseup', (e) => this.handleBoardMouseUp(e));
    cvs.addEventListener('mouseleave', () => this.handleBoardMouseUp(null));

    panel.appendChild(boardWrap);

    // Tray separator
    const sep = document.createElement('div');
    Object.assign(sep.style, {
      width: '100%', height: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    });
    sep.innerHTML = `<div style="width:30px;height:1px;background:${C_TEAL}28"></div><div style="width:8px;height:8px;border:1px solid ${C_GOLD}40;transform:rotate(45deg);margin:0 6px"></div><div style="width:30px;height:1px;background:${C_TEAL}28"></div>`;
    panel.appendChild(sep);

    // Tray (horizontal scroll)
    this.trayEl = document.createElement('div');
    Object.assign(this.trayEl.style, {
      display: 'flex', gap: '8px', overflowX: 'auto', overflowY: 'hidden',
      width: (BOARD_PX() + 20) + 'px', padding: '4px 0', height: '80px',
      scrollbarWidth: 'thin',
    });
    panel.appendChild(this.trayEl);

    // Control bar
    this.controlBar = document.createElement('div');
    Object.assign(this.controlBar.style, {
      display: 'flex', gap: '10px', alignItems: 'center', width: '100%',
    });
    panel.appendChild(this.controlBar);

    // Status
    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, {
      fontSize: '13px', letterSpacing: '0.06em', textAlign: 'center', minHeight: '20px',
    });
    panel.appendChild(this.statusEl);

    // Overlay
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    // Keyboard
    const keyHandler = (ev: KeyboardEvent) => {
      if (ev.key === 'r' || ev.key === 'R') {
        this.rotateSelected();
        ev.preventDefault();
      } else if (ev.key === 'Escape') {
        this.selectedID = null;
        this.refreshAll();
      }
    };
    window.addEventListener('keydown', keyHandler);
    (this as unknown as { _keyHandler: (ev: KeyboardEvent) => void })._keyHandler = keyHandler;

    // Inject animation keyframes
    if (!document.getElementById('girih-anims')) {
      const style = document.createElement('style');
      style.id = 'girih-anims';
      style.textContent = `
        @keyframes girih-pop { from { transform: scale(0.92); opacity:0; } to { transform: scale(1); opacity:1; } }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(root);
  }

  /* ═══════════════════ Computed ═══════════════════════════════════ */

  private get targetTotal(): number {
    let n = 0;
    for (let r = 0; r < GRID_N; r++) for (let c = 0; c < GRID_N; c++) if (this.targetMask[r][c]) n++;
    return n;
  }

  private get filledCount(): number {
    let n = 0;
    for (let r = 0; r < GRID_N; r++) {
      for (let c = 0; c < GRID_N; c++) {
        if (this.targetMask[r]?.[c] && this.grid[r]?.[c] !== -1) n++;
      }
    }
    return n;
  }

  /* ═══════════════════ Canvas drawing ════════════════════════════ */

  private drawAll(): void {
    const c = this.ctx2d!;
    const s = 2; // retina
    c.clearRect(0, 0, BOARD_PX() * s, BOARD_PX() * s);
    c.save();
    c.scale(s, s);

    this.drawBoard(c);
    this.drawPlacedPieces(c);
    this.drawDraggingPiece(c);

    c.restore();
  }

  private drawBoard(c: CanvasRenderingContext2D): void {
    for (let r = 0; r < GRID_N; r++) {
      for (let col = 0; col < GRID_N; col++) {
        const x = col * CELL_PX();
        const y = r * CELL_PX();
        const isTarget = this.targetMask[r]?.[col] ?? false;
        const pieceID = this.grid[r]?.[col] ?? -1;

        if (isTarget && pieceID < 0) {
          // Empty target cell
          c.fillStyle = C_MID_BLUE;
          c.fillRect(x + 0.5, y + 0.5, CELL_PX() - 1, CELL_PX() - 1);
          // Subtle dot at center
          c.beginPath();
          c.arc(x + CELL_PX() / 2, y + CELL_PX() / 2, 1.5, 0, Math.PI * 2);
          c.fillStyle = hexAlpha(C_TEAL, 0.12);
          c.fill();
          // Cell border
          c.strokeStyle = hexAlpha(C_TEAL, 0.08);
          c.lineWidth = 0.5;
          c.strokeRect(x + 0.5, y + 0.5, CELL_PX() - 1, CELL_PX() - 1);
        } else if (!isTarget) {
          c.fillStyle = hexAlpha(C_DEEP_BLUE, 0.6);
          c.fillRect(x, y, CELL_PX(), CELL_PX());
        }
      }
    }

    // Outer border
    c.strokeStyle = hexAlpha(C_TEAL, 0.08);
    c.lineWidth = 0.5;
    c.strokeRect(1, 1, BOARD_PX() - 2, BOARD_PX() - 2);
  }

  private drawPlacedPieces(c: CanvasRenderingContext2D): void {
    const sorted = this.pieces
      .filter(p => p.isPlaced && p.id !== this.draggingID)
      .sort((a, b) => a.placedOrder - b.placedOrder);

    for (const piece of sorted) {
      const ox = piece.position.x * CELL_PX();
      const oy = piece.position.y * CELL_PX();
      this.drawPieceShape(c, rotatedCells(piece), piece.color, piece.patternType, ox, oy, 1.0, 1.0);
    }
  }

  private drawDraggingPiece(c: CanvasRenderingContext2D): void {
    if (this.draggingID === null) return;
    const piece = this.pieces.find(p => p.id === this.draggingID);
    if (!piece) return;

    const ox = this.dragStartPos.x * CELL_PX() + this.dragOffset.x;
    const oy = this.dragStartPos.y * CELL_PX() + this.dragOffset.y;
    this.drawPieceShape(c, rotatedCells(piece), piece.color, piece.patternType, ox, oy, 1.0, 0.75);

    // Ghost preview at snap position
    const snapCol = Math.round(ox / CELL_PX());
    const snapRow = Math.round(oy / CELL_PX());
    const rc = rotatedCells(piece);
    const canPlace = rc.every(cell => {
      const r = snapRow + cell.row, col2 = snapCol + cell.col;
      return r >= 0 && r < GRID_N && col2 >= 0 && col2 < GRID_N
        && this.targetMask[r]?.[col2] === true
        && this.grid[r]?.[col2] === -1;
    });
    if (canPlace) {
      c.fillStyle = hexAlpha(piece.color, 0.12);
      for (const cell of rc) {
        const rx = (snapCol + cell.col) * CELL_PX() + 2;
        const ry = (snapRow + cell.row) * CELL_PX() + 2;
        c.fillRect(rx, ry, CELL_PX() - 4, CELL_PX() - 4);
      }
    }
  }

  private drawPieceShape(
    c: CanvasRenderingContext2D,
    cells: { row: number; col: number }[],
    color: string,
    patternType: number,
    originX: number,
    originY: number,
    scale: number,
    opacity: number = 1.0,
  ): void {
    const cellSet = new Set(cells.map(cell => `${cell.row},${cell.col}`));
    const sz = CELL_PX() * scale;

    // Fill cells with gradient
    for (const cell of cells) {
      const x = originX + cell.col * sz;
      const y = originY + cell.row * sz;

      // Gradient fill
      const grad = c.createLinearGradient(x, y, x + sz, y + sz);
      grad.addColorStop(0, hexAlpha(color, 0.8 * opacity));
      grad.addColorStop(1, hexAlpha(color, 0.6 * opacity));
      c.fillStyle = grad;
      c.fillRect(x, y, sz, sz);

      // Strapwork pattern
      this.drawStrapwork(c, x + sz * 0.06, y + sz * 0.06, sz * 0.88, sz * 0.88, patternType, color, opacity);
    }

    // Outer border (skip shared edges)
    c.beginPath();
    for (const cell of cells) {
      const x = originX + cell.col * sz;
      const y = originY + cell.row * sz;
      if (!cellSet.has(`${cell.row - 1},${cell.col}`)) {
        c.moveTo(x, y); c.lineTo(x + sz, y);
      }
      if (!cellSet.has(`${cell.row},${cell.col + 1}`)) {
        c.moveTo(x + sz, y); c.lineTo(x + sz, y + sz);
      }
      if (!cellSet.has(`${cell.row + 1},${cell.col}`)) {
        c.moveTo(x + sz, y + sz); c.lineTo(x, y + sz);
      }
      if (!cellSet.has(`${cell.row},${cell.col - 1}`)) {
        c.moveTo(x, y + sz); c.lineTo(x, y);
      }
    }
    // Outer glow
    c.strokeStyle = hexAlpha(color, 0.2 * opacity);
    c.lineWidth = Math.max(3, sz * 0.06);
    c.lineJoin = 'round';
    c.stroke();
    // Sharp border
    c.strokeStyle = hexAlpha(color, 0.9 * opacity);
    c.lineWidth = Math.max(1.2, sz * 0.025);
    c.stroke();
  }

  /* ═══════════════════ Strapwork Patterns (Islamic geometric) ════ */

  private drawStrapwork(
    c: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    patternType: number, color: string, opacity: number,
  ): void {
    const lineColor = `rgba(255,255,255,${0.22 * opacity})`;
    const accentColor = hexAlpha(color, 0.3 * opacity);
    const lw = Math.max(0.6, w * 0.022);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) * 0.5;

    switch (patternType % 5) {
      case 0: { // Diamond with inner detail
        const ins = r * 0.22;
        c.beginPath();
        c.moveTo(cx, y + ins);
        c.lineTo(x + w - ins, cy);
        c.lineTo(cx, y + h - ins);
        c.lineTo(x + ins, cy);
        c.closePath();
        c.strokeStyle = lineColor;
        c.lineWidth = lw;
        c.stroke();
        // Inner diamond
        const ins2 = r * 0.45;
        c.beginPath();
        c.moveTo(cx, y + ins2);
        c.lineTo(x + w - ins2, cy);
        c.lineTo(cx, y + h - ins2);
        c.lineTo(x + ins2, cy);
        c.closePath();
        c.fillStyle = accentColor;
        c.fill();
        c.strokeStyle = `rgba(255,255,255,${0.11 * opacity})`;
        c.lineWidth = lw * 0.6;
        c.stroke();
        break;
      }
      case 1: { // 8-point star (Khatam style)
        c.beginPath();
        const r1 = r * 0.82;
        const r2 = r * 0.42;
        for (let i = 0; i < 16; i++) {
          const angle = i * Math.PI / 8 - Math.PI / 2;
          const sr = i % 2 === 0 ? r1 : r2;
          const px = cx + Math.cos(angle) * sr;
          const py = cy + Math.sin(angle) * sr;
          if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.closePath();
        c.fillStyle = accentColor;
        c.fill();
        c.strokeStyle = lineColor;
        c.lineWidth = lw;
        c.stroke();
        // Center dot
        c.beginPath();
        c.arc(cx, cy, 1.5, 0, Math.PI * 2);
        c.fillStyle = lineColor;
        c.fill();
        break;
      }
      case 2: { // Octagon with inner circle
        const d = r * 0.38;
        c.beginPath();
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4 - Math.PI / 8;
          const px = cx + Math.cos(angle) * (r - d * 0.2);
          const py = cy + Math.sin(angle) * (r - d * 0.2);
          if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.closePath();
        c.fillStyle = accentColor;
        c.fill();
        c.strokeStyle = lineColor;
        c.lineWidth = lw;
        c.stroke();
        // Inner circle
        const cr = r * 0.35;
        c.beginPath();
        c.arc(cx, cy, cr, 0, Math.PI * 2);
        c.strokeStyle = `rgba(255,255,255,${0.13 * opacity})`;
        c.lineWidth = lw * 0.7;
        c.stroke();
        break;
      }
      case 3: { // Interlocking arches (muqarnas inspired)
        const archR = r * 0.65;
        c.beginPath();
        c.arc(cx - archR * 0.3, cy, archR, -80 * Math.PI / 180, 0);
        c.stroke();
        c.beginPath();
        c.arc(cx + archR * 0.3, cy, archR, Math.PI, 260 * Math.PI / 180);
        c.strokeStyle = lineColor;
        c.lineWidth = lw;
        c.stroke();
        // Cross
        c.beginPath();
        c.moveTo(cx, cy - r * 0.6);
        c.lineTo(cx, cy + r * 0.6);
        c.moveTo(cx - r * 0.6, cy);
        c.lineTo(cx + r * 0.6, cy);
        c.strokeStyle = `rgba(255,255,255,${0.09 * opacity})`;
        c.lineWidth = lw * 0.5;
        c.stroke();
        break;
      }
      default: { // Hexagonal rosette with petals
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          const px = cx + Math.cos(a) * r * 0.55;
          const py = cy + Math.sin(a) * r * 0.55;
          const petalR = r * 0.22;
          c.beginPath();
          c.arc(px, py, petalR, 0, Math.PI * 2);
          c.fillStyle = accentColor;
          c.fill();
          c.strokeStyle = lineColor;
          c.lineWidth = lw * 0.7;
          c.stroke();
        }
        const centerR = r * 0.18;
        c.beginPath();
        c.arc(cx, cy, centerR, 0, Math.PI * 2);
        c.fillStyle = accentColor;
        c.fill();
        c.strokeStyle = lineColor;
        c.lineWidth = lw;
        c.stroke();
        break;
      }
    }
  }

  /* ═══════════════════ Tray rendering ════════════════════════════ */

  private refreshTray(): void {
    if (!this.trayEl) return;
    this.trayEl.innerHTML = '';

    const unplaced = this.pieces.filter(p => !p.isPlaced).sort((a, b) => a.id - b.id);
    const trayH = 72;

    for (const piece of unplaced) {
      const isSelected = this.selectedID === piece.id;
      const bs = boundingSize(piece);
      const maxDim = Math.max(bs.rows, bs.cols);
      const scale = (trayH - 16) / (maxDim * CELL_PX());
      const cardW = Math.max(bs.cols * CELL_PX() * scale + 16, 50);

      const card = document.createElement('div');
      Object.assign(card.style, {
        width: cardW + 'px', height: trayH + 'px', flexShrink: '0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isSelected ? hexAlpha(piece.color, 0.12) : hexAlpha(C_DEEP_BLUE, 0.5),
        border: `${isSelected ? 2 : 0.5}px solid ${isSelected ? hexAlpha(piece.color, 0.7) : hexAlpha(C_TEAL, 0.12)}`,
        borderRadius: '10px', cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
      });

      // Mini canvas for piece preview
      const miniCvs = document.createElement('canvas');
      const rc = rotatedCells(piece);
      const bCols = Math.max(...rc.map(c2 => c2.col)) + 1;
      const bRows = Math.max(...rc.map(c2 => c2.row)) + 1;
      const s2 = CELL_PX() * scale;
      miniCvs.width = Math.ceil(bCols * s2 * 2);
      miniCvs.height = Math.ceil(bRows * s2 * 2);
      Object.assign(miniCvs.style, {
        width: Math.ceil(bCols * s2) + 'px',
        height: Math.ceil(bRows * s2) + 'px',
      });
      const mc = miniCvs.getContext('2d')!;
      mc.scale(2, 2);
      this.drawPieceShape(mc, rc, piece.color, piece.patternType, 0, 0, scale, 1.0);
      card.appendChild(miniCvs);

      card.addEventListener('click', () => this.selectTile(piece.id));
      this.trayEl.appendChild(card);
    }
  }

  private refreshControls(): void {
    if (!this.controlBar) return;
    this.controlBar.innerHTML = '';

    if (this.selectedID !== null) {
      // Rotate button
      const rotBtn = document.createElement('button');
      rotBtn.type = 'button';
      rotBtn.innerHTML = '↻ ROTATE';
      Object.assign(rotBtn.style, {
        padding: '6px 14px', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit',
        color: C_GOLD, background: hexAlpha(C_GOLD, 0.08),
        border: `1px solid ${hexAlpha(C_GOLD, 0.2)}`, borderRadius: '20px',
        cursor: 'pointer', letterSpacing: '0.06em',
      });
      rotBtn.addEventListener('click', () => this.rotateSelected());
      this.controlBar.appendChild(rotBtn);

      // Deselect
      const desBtn = document.createElement('button');
      desBtn.type = 'button';
      desBtn.textContent = '✕';
      Object.assign(desBtn.style, {
        padding: '4px 10px', fontSize: '14px', fontFamily: 'inherit',
        color: hexAlpha(C_TEAL, 0.5), background: 'transparent',
        border: 'none', cursor: 'pointer',
      });
      desBtn.addEventListener('click', () => { this.selectedID = null; this.refreshAll(); });
      this.controlBar.appendChild(desBtn);
    }

    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    this.controlBar.appendChild(spacer);

    // Hint text
    const hint = document.createElement('div');
    Object.assign(hint.style, { fontSize: '11px', fontWeight: '500', color: 'rgba(255,255,255,0.3)' });
    hint.textContent = this.selectedID !== null ? 'Tap board to place' : 'Select a tile or drag placed tiles';
    this.controlBar.appendChild(hint);

    // Reset button
    if (!this.isSolved) {
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.textContent = '↺';
      Object.assign(resetBtn.style, {
        padding: '4px 10px', fontSize: '14px', fontFamily: 'inherit',
        color: hexAlpha(C_GOLD, 0.5), background: 'transparent',
        border: 'none', cursor: 'pointer', marginLeft: '8px',
      });
      resetBtn.addEventListener('click', () => this.resetAll());
      this.controlBar.appendChild(resetBtn);
    }
  }

  private refreshCounter(): void {
    if (!this.counterEl) return;
    this.counterEl.innerHTML = '';
    const count = document.createElement('span');
    count.style.color = C_GOLD;
    count.textContent = `${this.filledCount}/${this.targetTotal}`;
    this.counterEl.appendChild(count);
  }

  private refreshAll(): void {
    this.drawAll();
    this.refreshTray();
    this.refreshControls();
    this.refreshCounter();
    if (this.statusEl && !this.isSolved) {
      this.statusEl.textContent = '';
    }
  }

  /* ═══════════════════ Board interactions ════════════════════════ */

  private getCanvasPos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (BOARD_PX() / rect.width),
      y: (e.clientY - rect.top) * (BOARD_PX() / rect.height),
    };
  }

  private handleBoardTap(e: MouseEvent): void {
    if (this.isSolved || this.draggingID !== null) return;
    const pos = this.getCanvasPos(e);

    // Tap on placed piece → rotate it
    const hitID = this.placedPieceAt(pos.x, pos.y);
    if (hitID !== null && this.selectedID === null) {
      this.rotatePlacedPiece(hitID);
      return;
    }

    // Tap with selected piece → place it
    if (this.selectedID !== null) {
      const idx = this.pieces.findIndex(p => p.id === this.selectedID);
      if (idx < 0) return;
      const col = Math.floor(pos.x / CELL_PX());
      const row = Math.floor(pos.y / CELL_PX());
      const rc = rotatedCells(this.pieces[idx]);

      // Center the piece around tap point
      const bRows = Math.max(...rc.map(c2 => c2.row)) + 1;
      const bCols = Math.max(...rc.map(c2 => c2.col)) + 1;
      const anchorRow = Math.max(0, row - Math.floor(bRows / 2));
      const anchorCol = Math.max(0, col - Math.floor(bCols / 2));

      const offsets = [[0, 0], [0, -1], [-1, 0], [0, 1], [1, 0], [-1, -1], [1, 1], [-1, 1], [1, -1]];
      for (const [dr, dc] of offsets) {
        const tryR = anchorRow + dr;
        const tryC = anchorCol + dc;
        const canPlace = rc.every(cell => {
          const r = tryR + cell.row, c2 = tryC + cell.col;
          return r >= 0 && r < GRID_N && c2 >= 0 && c2 < GRID_N
            && this.targetMask[r]?.[c2] === true
            && this.grid[r]?.[c2] === -1;
        });
        if (canPlace) {
          this.placedCounter++;
          this.pieces[idx].position = { x: tryC, y: tryR };
          this.pieces[idx].isPlaced = true;
          this.pieces[idx].placedOrder = this.placedCounter;
          for (const cell of rc) { this.grid[tryR + cell.row][tryC + cell.col] = this.selectedID!; }
          this.selectedID = null;
          this.refreshAll();
          this.checkCompletion();
          return;
        }
      }
      // Couldn't place
      this.showFlash('Cannot place here');
    }
  }

  private handleBoardMouseDown(e: MouseEvent): void {
    if (this.isSolved) return;
    const pos = this.getCanvasPos(e);
    const hitID = this.placedPieceAt(pos.x, pos.y);
    if (hitID !== null) {
      const idx = this.pieces.findIndex(p => p.id === hitID);
      if (idx < 0) return;
      this.removePieceFromGrid(hitID);
      this.dragStartPos = { x: this.pieces[idx].position.x, y: this.pieces[idx].position.y };
      this.draggingID = hitID;
      this.dragOffset = { x: 0, y: 0 };
      this.dragPickedFromGrid = true;
      this.selectedID = null;
      this.drawAll();
      e.preventDefault();
    }
  }

  private handleBoardMouseMove(e: MouseEvent): void {
    if (this.draggingID === null) return;
    const pos = this.getCanvasPos(e);
    this.dragOffset = {
      x: pos.x - this.dragStartPos.x * CELL_PX() - CELL_PX() / 2,
      y: pos.y - this.dragStartPos.y * CELL_PX() - CELL_PX() / 2,
    };
    this.drawAll();
  }

  private handleBoardMouseUp(_e: MouseEvent | null): void {
    if (this.draggingID === null) return;
    const id = this.draggingID;
    const idx = this.pieces.findIndex(p => p.id === id);
    if (idx < 0) { this.draggingID = null; this.dragOffset = { x: 0, y: 0 }; return; }

    const totalDist = Math.hypot(this.dragOffset.x, this.dragOffset.y);

    // Short drag = just re-place at original position
    if (this.dragPickedFromGrid && totalDist < CELL_PX() * 0.4) {
      const snapCol = Math.round(this.dragStartPos.x);
      const snapRow = Math.round(this.dragStartPos.y);
      const rc = rotatedCells(this.pieces[idx]);
      const canReplace = rc.every(cell => {
        const r = snapRow + cell.row, c2 = snapCol + cell.col;
        return r >= 0 && r < GRID_N && c2 >= 0 && c2 < GRID_N
          && this.targetMask[r]?.[c2] === true
          && this.grid[r]?.[c2] === -1;
      });
      if (canReplace) {
        this.pieces[idx].position = { x: snapCol, y: snapRow };
        this.pieces[idx].isPlaced = true;
        for (const cell of rc) { this.grid[snapRow + cell.row][snapCol + cell.col] = id; }
      } else {
        this.pieces[idx].isPlaced = false;
      }
      this.draggingID = null;
      this.dragOffset = { x: 0, y: 0 };
      this.dragPickedFromGrid = false;
      this.refreshAll();
      return;
    }

    // Normal drag end — try to snap
    const finalX = this.dragStartPos.x * CELL_PX() + this.dragOffset.x;
    const finalY = this.dragStartPos.y * CELL_PX() + this.dragOffset.y;
    const snapCol = Math.round(finalX / CELL_PX());
    const snapRow = Math.round(finalY / CELL_PX());
    const rc = rotatedCells(this.pieces[idx]);

    const canPlace = rc.every(cell => {
      const r = snapRow + cell.row, c2 = snapCol + cell.col;
      return r >= 0 && r < GRID_N && c2 >= 0 && c2 < GRID_N
        && this.targetMask[r]?.[c2] === true
        && this.grid[r]?.[c2] === -1;
    });

    if (canPlace) {
      this.pieces[idx].position = { x: snapCol, y: snapRow };
      this.pieces[idx].isPlaced = true;
      for (const cell of rc) { this.grid[snapRow + cell.row][snapCol + cell.col] = id; }
      this.checkCompletion();
    } else {
      this.pieces[idx].isPlaced = false;
    }

    this.draggingID = null;
    this.dragOffset = { x: 0, y: 0 };
    this.dragPickedFromGrid = false;
    this.refreshAll();
  }

  /* ═══════════════════ Hit testing ═══════════════════════════════ */

  private placedPieceAt(px: number, py: number): number | null {
    const sorted = this.pieces
      .filter(p => p.isPlaced)
      .sort((a, b) => b.placedOrder - a.placedOrder);
    for (const piece of sorted) {
      const localCol = px / CELL_PX() - piece.position.x;
      const localRow = py / CELL_PX() - piece.position.y;
      const rc = rotatedCells(piece);
      if (rc.some(cell =>
        cell.col <= localCol && localCol < cell.col + 1 &&
        cell.row <= localRow && localRow < cell.row + 1
      )) {
        return piece.id;
      }
    }
    return null;
  }

  /* ═══════════════════ Actions ═══════════════════════════════════ */

  private selectTile(id: number): void {
    if (this.isSolved) return;
    if (this.selectedID === id) {
      // Second tap rotates
      const idx = this.pieces.findIndex(p => p.id === id);
      if (idx >= 0) this.pieces[idx].rotation = (this.pieces[idx].rotation + 1) % 4;
    } else {
      this.selectedID = id;
    }
    this.refreshAll();
  }

  private rotateSelected(): void {
    if (this.selectedID === null || this.isSolved) return;
    const idx = this.pieces.findIndex(p => p.id === this.selectedID);
    if (idx >= 0) {
      this.pieces[idx].rotation = (this.pieces[idx].rotation + 1) % 4;
      this.refreshAll();
    }
  }

  private rotatePlacedPiece(id: number): void {
    const idx = this.pieces.findIndex(p => p.id === id);
    if (idx < 0) return;
    const oldPos = { ...this.pieces[idx].position };
    this.removePieceFromGrid(id);

    this.pieces[idx].rotation = (this.pieces[idx].rotation + 1) % 4;
    const snapCol = Math.round(oldPos.x);
    const snapRow = Math.round(oldPos.y);
    const rc = rotatedCells(this.pieces[idx]);

    const canPlace = rc.every(cell => {
      const r = snapRow + cell.row, c2 = snapCol + cell.col;
      return r >= 0 && r < GRID_N && c2 >= 0 && c2 < GRID_N
        && this.targetMask[r]?.[c2] === true
        && this.grid[r]?.[c2] === -1;
    });

    if (canPlace) {
      this.pieces[idx].position = { x: snapCol, y: snapRow };
      for (const cell of rc) { this.grid[snapRow + cell.row][snapCol + cell.col] = id; }
      this.checkCompletion();
    } else {
      // Try nearby positions
      let placed = false;
      for (let dr = -1; dr <= 1 && !placed; dr++) {
        for (let dc = -1; dc <= 1 && !placed; dc++) {
          const tryR = snapRow + dr;
          const tryC = snapCol + dc;
          const canFit = rc.every(cell => {
            const r = tryR + cell.row, c2 = tryC + cell.col;
            return r >= 0 && r < GRID_N && c2 >= 0 && c2 < GRID_N
              && this.targetMask[r]?.[c2] === true
              && this.grid[r]?.[c2] === -1;
          });
          if (canFit) {
            this.pieces[idx].position = { x: tryC, y: tryR };
            for (const cell of rc) { this.grid[tryR + cell.row][tryC + cell.col] = id; }
            placed = true;
            this.checkCompletion();
          }
        }
      }
      if (!placed) {
        // Undo rotation and return to tray
        this.pieces[idx].rotation = (this.pieces[idx].rotation + 3) % 4;
        this.pieces[idx].isPlaced = false;
      }
    }
    this.refreshAll();
  }

  private removePieceFromGrid(id: number): void {
    for (let r = 0; r < GRID_N; r++) {
      for (let c = 0; c < GRID_N; c++) {
        if (this.grid[r][c] === id) this.grid[r][c] = -1;
      }
    }
  }

  private checkCompletion(): void {
    if (this.filledCount === this.targetTotal) {
      this.isSolved = true;
      this.showCompletionOverlay();
      setTimeout(() => this.onSolved?.(), 900);
    }
  }

  private showCompletionOverlay(): void {
    if (this.statusEl) {
      this.statusEl.textContent = 'THE TESSELLATION IS COMPLETE';
      this.statusEl.style.color = C_SUCCESS;
    }
    // Update board border
    if (this.canvas) {
      this.canvas.parentElement!.style.borderColor = hexAlpha(C_SUCCESS, 0.5);
    }
    this.refreshControls();
    this.refreshCounter();
    this.drawAll();
  }

  private resetAll(): void {
    this.grid = Array.from({ length: GRID_N }, () => Array(GRID_N).fill(-1));
    for (const piece of this.pieces) {
      piece.isPlaced = false;
      piece.rotation = 0;
      piece.placedOrder = 0;
    }
    this.draggingID = null;
    this.selectedID = null;
    this.isSolved = false;
    this.placedCounter = 0;
    if (this.canvas) {
      this.canvas.parentElement!.style.borderColor = `${C_TEAL}20`;
    }
    this.refreshAll();
  }

  private showFlash(msg: string): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.style.color = '#e89090';
    setTimeout(() => {
      if (this.statusEl && !this.isSolved) {
        this.statusEl.textContent = '';
        this.statusEl.style.color = '';
      }
    }, 900);
  }

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    const kh = (this as unknown as { _keyHandler?: (ev: KeyboardEvent) => void })._keyHandler;
    if (kh) window.removeEventListener('keydown', kh);
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('girih-anims');
    if (animStyle) animStyle.remove();
    this.ctx2d = null;
    this.canvas = null;
    this.trayEl = null;
    this.statusEl = null;
    this.counterEl = null;
    this.controlBar = null;
    this.overlayEl = null;
    super.dispose();
  }
}

/* ═══════════════════ Utility ═════════════════════════════════════ */

function hexAlpha(hex: string, alpha: number): string {
  // Convert hex to rgba
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
