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
 * Stomachion — Archimedes' square dissection puzzle.
 * Aligned with iOS "Math Vs Time" implementation:
 *   - Canvas-drawn board with grid lines
 *   - Piece tray below the board; tap to place on board
 *   - Drag placed pieces to reposition; tap to return to tray
 *   - Half-grid snap on release
 *   - Coverage-based validation (point-in-polygon sampling)
 *   - Hint system (snap a piece to its solution position)
 *   - Rules overlay sheet
 *   - Greek gold color theme with Rajdhani font
 */

/* ── Colors (Ancient Greece theme, matches iOS) ──────────────── */

const C_GREEK_GOLD = '#DAA520';
const C_GREEK_BG = '#0E1A2E';
const C_GREEK_PANEL = '#0A1628';
const C_GREEK_TEXT = '#F0E6D0';
const C_SUCCESS = '#00B894';
const C_ERROR = '#FF4040';

/* ── Piece colors (matches iOS pieceColors) ──────────────────── */

const PIECE_COLORS = [
  { r: 0.90, g: 0.65, b: 0.20 },
  { r: 0.55, g: 0.75, b: 0.35 },
  { r: 0.80, g: 0.50, b: 0.50 },
  { r: 0.45, g: 0.65, b: 0.80 },
  { r: 0.85, g: 0.78, b: 0.35 },
  { r: 0.65, g: 0.45, b: 0.70 },
  { r: 0.40, g: 0.75, b: 0.65 },
  { r: 0.82, g: 0.55, b: 0.30 },
  { r: 0.55, g: 0.55, b: 0.80 },
  { r: 0.75, g: 0.70, b: 0.45 },
  { r: 0.70, g: 0.40, b: 0.40 },
  { r: 0.50, g: 0.70, b: 0.50 },
  { r: 0.85, g: 0.60, b: 0.45 },
  { r: 0.60, g: 0.60, b: 0.55 },
];

function rgbStr(c: { r: number; g: number; b: number }, a = 1): string {
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

/* ── Piece definitions (matches iOS exactly) ─────────────────── */

type Pt = [number, number];

const PIECES_4x4: Pt[][] = [
  [[0, 0], [2, 0], [2, 2], [0, 2]],
  [[2, 0], [4, 0], [4, 2]],
  [[2, 0], [4, 2], [2, 2]],
  [[0, 2], [2, 2], [4, 4], [0, 4]],
  [[2, 2], [4, 2], [4, 4]],
];

const PIECES_6x6: Pt[][] = [
  [[0, 0], [3, 0], [3, 3]],
  [[0, 0], [3, 3], [0, 3]],
  [[3, 0], [6, 0], [6, 3], [3, 3]],
  [[0, 3], [2, 3], [3, 6], [0, 6]],
  [[2, 3], [3, 3], [3, 6]],
  [[3, 3], [6, 3], [6, 5]],
  [[3, 3], [6, 5], [6, 6], [4, 6]],
  [[3, 3], [4, 6], [3, 6]],
];

const PIECES_8x8: Pt[][] = [
  [[0, 0], [4, 0], [4, 3], [0, 4]],
  [[4, 3], [4, 4], [0, 4]],
  [[4, 0], [8, 0], [6, 2]],
  [[6, 2], [8, 0], [8, 4], [4, 4]],
  [[4, 0], [6, 2], [4, 4]],
  [[0, 4], [4, 4], [0, 8]],
  [[4, 4], [3, 8], [0, 8]],
  [[4, 4], [4, 8], [3, 8]],
  [[4, 4], [8, 4], [8, 6]],
  [[4, 4], [8, 6], [8, 8], [6, 8]],
  [[4, 4], [6, 8], [4, 8]],
];

const PIECES_12x12: Pt[][] = [
  [[0, 0], [5, 0], [4, 4], [0, 4]],
  [[5, 0], [8, 0], [7, 4], [4, 4]],
  [[8, 0], [12, 0], [12, 4], [7, 4]],
  [[0, 4], [4, 4], [0, 8]],
  [[4, 4], [7, 4], [6, 8], [0, 8]],
  [[7, 4], [9, 4], [8, 8], [6, 8]],
  [[9, 4], [12, 4], [12, 6]],
  [[9, 4], [12, 6], [12, 8], [8, 8]],
  [[0, 8], [3, 8], [3, 12], [0, 12]],
  [[3, 8], [6, 8], [5, 12], [3, 12]],
  [[6, 8], [8, 8], [8, 10]],
  [[6, 8], [8, 10], [8, 12], [5, 12]],
  [[8, 8], [12, 8], [12, 12], [8, 10]],
  [[8, 10], [12, 12], [8, 12]],
];

const PIECES_12x12_HARD: Pt[][] = [
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
  [[0, 12], [4, 12], [8, 12], [12, 12]],
];

function piecesForTileSize(tileSize: number): { pieces: Pt[][]; gridSize: number } {
  switch (tileSize) {
    case 4: return { pieces: PIECES_4x4, gridSize: 4 };
    case 8: return { pieces: PIECES_8x8, gridSize: 8 };
    case 12: return { pieces: PIECES_12x12, gridSize: 12 };
    case 14: return { pieces: PIECES_12x12_HARD, gridSize: 12 };
    default: return { pieces: PIECES_6x6, gridSize: 6 };
  }
}

/* ── Helpers ──────────────────────────────────────────────────── */

function boundingBox(pts: Pt[]): { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function pointInPolygon(px: number, py: number, polygon: Pt[]): boolean {
  const n = polygon.length;
  if (n < 3) return false;
  let inside = false;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > py) !== (yj > py)) {
      const intersectX = xj + (py - yj) / (yi - yj) * (xi - xj);
      if (px < intersectX) inside = !inside;
    }
    j = i;
  }
  return inside;
}

/* ── Piece state ─────────────────────────────────────────────── */

interface StomachionPiece {
  id: number;
  originalPoints: Pt[];
  color: { r: number; g: number; b: number };
  placedOffset: Pt; // grid-unit offset from original position
  isPlaced: boolean;
  placedOrder: number;
}

/* ── Puzzle class ─────────────────────────────────────────────── */

export class StomachionPuzzle extends Puzzle {
  readonly title = 'STOMACHION';
  readonly subtitle = "Archimedes' square";
  readonly instructions =
    'Tap a piece in the tray to place it on the board. Drag placed pieces to reposition. Tap a placed piece to return it to the tray. Arrange all pieces to fill the square exactly.';

  private gridSize = 12;
  private tileSize = 12; // hardest valid set: 14 pieces on 12x12 grid
  private pieces: StomachionPiece[] = [];
  private placedCounter = 0;
  private isComplete = false;
  private showWrongFeedback = false;
  private hintHighlightID: number | null = null;
  private localHintsUsed = 0;
  private hintPenaltyAcknowledged = false;

  // Drag state
  private draggingID: number | null = null;
  private dragStartGrid: Pt | null = null;
  private dragStartOffset: Pt | null = null;

  // DOM
  private root: HTMLDivElement | null = null;
  private boardCanvas: HTMLCanvasElement | null = null;
  private boardCtx: CanvasRenderingContext2D | null = null;
  private trayEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private checkBtnEl: HTMLButtonElement | null = null;
  private hintBtnEl: HTMLButtonElement | null = null;
  private countEl: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private cellPx = 0;
  private boardPx = 0;

  // Global event handlers
  private moveHandler: ((ev: PointerEvent) => void) | null = null;
  private upHandler: ((ev: PointerEvent) => void) | null = null;

  onSolved?: () => void;

  /** Optionally set tileSize before init() (4, 6, 8, 12, 14). Defaults to 6. */
  setTileSize(ts: number): void { this.tileSize = ts; }

  init(): void {
    this.buildBackdrop();
    this.setupPieces();
    this.buildDom();
    this.drawBoard();
    this.refreshUI();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
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

    const key = new PointLight('#f5d29c', 2.2, 25, 1.6);
    key.position.set(0, 6, 4);
    this.group.add(key);
  }

  /* ═══════════════════ Piece setup ══════════════════════════════ */

  private setupPieces(): void {
    const { pieces, gridSize } = piecesForTileSize(this.tileSize);
    this.gridSize = gridSize;
    this.pieces = pieces.map((pts, idx) => ({
      id: idx,
      originalPoints: pts,
      color: PIECE_COLORS[idx % PIECE_COLORS.length],
      placedOffset: [0, 0] as Pt,
      isPlaced: false,
      placedOrder: 0,
    }));
    this.placedCounter = 0;
    this.isComplete = false;
    this.showWrongFeedback = false;
    this.draggingID = null;
    this.hintHighlightID = null;
  }

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    // Compute cell size to fit nicely
    const maxBoardPx = Math.min(440, window.innerWidth - 60);
    this.cellPx = Math.floor(maxBoardPx / this.gridSize);
    this.boardPx = this.cellPx * this.gridSize;

    const root = document.createElement('div');
    root.id = 'puzzle-stomachion';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: `rgba(10,22,40,0.92)`, backdropFilter: 'blur(12px)',
      border: `1px solid ${C_GREEK_GOLD}40`, borderTop: `3px solid ${C_GREEK_GOLD}`,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_GREEK_TEXT,
      maxHeight: '96vh', overflowY: 'auto', maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box',
    });
    root.appendChild(panel);

    // Title row with rules button
    const titleRow = document.createElement('div');
    Object.assign(titleRow.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
    });

    const titleEl = document.createElement('div');
    Object.assign(titleEl.style, { fontSize: '16px', letterSpacing: '0.22em', color: C_GREEK_GOLD, fontWeight: '700' });
    titleEl.textContent = 'STOMACHION';
    titleRow.appendChild(titleEl);

    const rulesBtn = document.createElement('button');
    rulesBtn.type = 'button';
    Object.assign(rulesBtn.style, {
      width: '28px', height: '28px', background: `${C_GREEK_GOLD}1e`, border: `1px solid ${C_GREEK_GOLD}66`,
      borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: C_GREEK_GOLD, fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
    });
    rulesBtn.textContent = '?';
    rulesBtn.addEventListener('click', () => this.showRulesOverlay());
    titleRow.appendChild(rulesBtn);
    panel.appendChild(titleRow);

    // Board canvas
    const boardWrap = document.createElement('div');
    Object.assign(boardWrap.style, {
      position: 'relative', width: this.boardPx + 'px', height: this.boardPx + 'px',
      borderRadius: '8px', overflow: 'hidden',
      border: `2px solid ${C_GREEK_GOLD}40`,
      background: `${C_GREEK_PANEL}80`,
      touchAction: 'none',
    });

    const cvs = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    cvs.width = this.boardPx * dpr;
    cvs.height = this.boardPx * dpr;
    Object.assign(cvs.style, { width: this.boardPx + 'px', height: this.boardPx + 'px', display: 'block', touchAction: 'none' });
    this.boardCanvas = cvs;
    this.boardCtx = cvs.getContext('2d')!;
    boardWrap.appendChild(cvs);

    // Pointer events on the board canvas
    cvs.addEventListener('pointerdown', (ev) => this.onBoardPointerDown(ev));

    panel.appendChild(boardWrap);

    // Status
    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, {
      fontSize: '13px', letterSpacing: '0.06em', textAlign: 'center', minHeight: '18px',
    });
    panel.appendChild(this.statusEl);

    // Check button (hidden until all placed)
    this.checkBtnEl = document.createElement('button');
    this.checkBtnEl.type = 'button';
    this.checkBtnEl.textContent = 'CHECK DISSECTION';
    Object.assign(this.checkBtnEl.style, {
      display: 'none', width: '100%', padding: '12px',
      background: `${C_GREEK_GOLD}1a`, border: `1px solid ${C_GREEK_GOLD}55`,
      color: C_GREEK_GOLD, fontFamily: 'inherit', fontSize: '15px', fontWeight: '700',
      letterSpacing: '0.12em', borderRadius: '6px', cursor: 'pointer',
    });
    this.checkBtnEl.addEventListener('click', () => this.checkAndSubmit());
    panel.appendChild(this.checkBtnEl);

    // Hint button
    this.hintBtnEl = document.createElement('button');
    this.hintBtnEl.type = 'button';
    this.hintBtnEl.textContent = 'HINT';
    Object.assign(this.hintBtnEl.style, {
      padding: '8px 18px', background: `${C_GREEK_GOLD}14`, border: `1px solid ${C_GREEK_GOLD}40`,
      color: C_GREEK_GOLD, fontFamily: 'inherit', fontSize: '12px', fontWeight: '600',
      letterSpacing: '0.14em', borderRadius: '20px', cursor: 'pointer',
    });
    this.hintBtnEl.addEventListener('click', () => this.handleHintTap());
    panel.appendChild(this.hintBtnEl);

    // Tray label
    const trayLabel = document.createElement('div');
    Object.assign(trayLabel.style, { fontSize: '11px', opacity: '0.4', letterSpacing: '0.06em' });
    trayLabel.textContent = 'Tap a piece below to place it on the board';
    panel.appendChild(trayLabel);

    // Tray container
    this.trayEl = document.createElement('div');
    Object.assign(this.trayEl.style, {
      display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center',
      width: '100%', maxWidth: (this.boardPx + 20) + 'px',
    });
    panel.appendChild(this.trayEl);

    // Placed count
    this.countEl = document.createElement('div');
    Object.assign(this.countEl.style, {
      fontSize: '11px', opacity: '0.4', letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums',
    });
    panel.appendChild(this.countEl);

    // Overlay container (for rules / hint warning)
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    document.body.appendChild(root);

    // Inject animation keyframe
    if (!document.getElementById('stomachion-anims')) {
      const style = document.createElement('style');
      style.id = 'stomachion-anims';
      style.textContent = `@keyframes stomachion-pop { from { transform: scale(0.92); opacity:0; } to { transform: scale(1); opacity:1; } }`;
      document.head.appendChild(style);
    }

    // Global drag listeners
    this.moveHandler = (ev: PointerEvent) => this.onBoardPointerMove(ev);
    this.upHandler = (ev: PointerEvent) => this.onBoardPointerUp(ev);
    window.addEventListener('pointermove', this.moveHandler);
    window.addEventListener('pointerup', this.upHandler);
    window.addEventListener('pointercancel', this.upHandler);
  }

  /* ═══════════════════ Board drawing (Canvas 2D) ════════════════ */

  private drawBoard(): void {
    const c = this.boardCtx!;
    const dpr = window.devicePixelRatio || 1;
    const bp = this.boardPx;
    const cp = this.cellPx;
    const gs = this.gridSize;

    c.clearRect(0, 0, bp * dpr, bp * dpr);
    c.save();
    c.scale(dpr, dpr);

    // Background
    c.fillStyle = `${C_GREEK_PANEL}80`;
    c.fillRect(0, 0, bp, bp);

    // Grid border
    c.strokeStyle = 'rgba(255,255,255,0.3)';
    c.lineWidth = 2;
    c.strokeRect(0, 0, bp, bp);

    // Grid lines
    for (let i = 1; i < gs; i++) {
      const pos = i * cp;
      c.beginPath();
      c.moveTo(pos, 0);
      c.lineTo(pos, bp);
      c.strokeStyle = 'rgba(255,255,255,0.06)';
      c.lineWidth = 0.5;
      c.stroke();

      c.beginPath();
      c.moveTo(0, pos);
      c.lineTo(bp, pos);
      c.stroke();
    }

    // Draw placed pieces (sorted by placedOrder)
    const placed = this.pieces
      .filter(p => p.isPlaced)
      .sort((a, b) => a.placedOrder - b.placedOrder);

    for (const piece of placed) {
      const isDragging = this.draggingID === piece.id;
      const isHinted = this.hintHighlightID === piece.id;

      // Compute actual points with offset
      const pts = piece.originalPoints.map(([x, y]): [number, number] => [
        (x + piece.placedOffset[0]) * cp,
        (y + piece.placedOffset[1]) * cp,
      ]);

      // Fill
      c.beginPath();
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
      c.closePath();
      c.fillStyle = rgbStr(piece.color, isDragging ? 0.9 : 0.8);
      c.fill();

      // Stroke
      c.lineWidth = isHinted ? 3 : (isDragging ? 2 : 1.5);
      c.strokeStyle = isHinted ? '#FFD700' : (isDragging ? '#FFD700' : rgbStr(piece.color, 1));
      c.stroke();

      // Glow for hinted or dragging
      if (isHinted || isDragging) {
        c.save();
        c.shadowColor = isHinted ? 'rgba(255,215,0,0.6)' : rgbStr(piece.color, 0.5);
        c.shadowBlur = isHinted ? 12 : 8;
        c.beginPath();
        c.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
        c.closePath();
        c.stroke();
        c.restore();
      }
    }

    // Wrong feedback: red border on board
    if (this.showWrongFeedback) {
      c.strokeStyle = `${C_ERROR}99`;
      c.lineWidth = 3;
      c.strokeRect(1, 1, bp - 2, bp - 2);
    }

    c.restore();
  }

  /* ═══════════════════ Tray rendering ═══════════════════════════ */

  private renderTray(): void {
    if (!this.trayEl) return;
    this.trayEl.innerHTML = '';
    const unplaced = this.pieces.filter(p => !p.isPlaced);
    if (unplaced.length === 0) return;

    const miniCell = this.cellPx * 0.42;

    for (const piece of unplaced) {
      const bb = boundingBox(piece.originalPoints);
      const normalizedPts = piece.originalPoints.map(([x, y]): Pt => [x - bb.minX, y - bb.minY]);
      const w = Math.max(bb.w * miniCell + 8, 38);
      const h = Math.max(bb.h * miniCell + 8, 38);

      const cvs = document.createElement('canvas');
      const dpr = window.devicePixelRatio || 1;
      cvs.width = Math.ceil(w * dpr);
      cvs.height = Math.ceil(h * dpr);
      Object.assign(cvs.style, {
        width: Math.ceil(w) + 'px', height: Math.ceil(h) + 'px',
        cursor: 'pointer', borderRadius: '4px',
      });

      const ctx = cvs.getContext('2d')!;
      ctx.scale(dpr, dpr);

      // Draw piece
      const pts = normalizedPts.map(([x, y]): [number, number] => [x * miniCell + 4, y * miniCell + 4]);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = rgbStr(piece.color, 0.7);
      ctx.fill();
      ctx.strokeStyle = rgbStr(piece.color, 1);
      ctx.lineWidth = 1;
      ctx.stroke();

      cvs.addEventListener('click', () => this.placePieceFromTray(piece.id));
      this.trayEl.appendChild(cvs);
    }
  }

  /* ═══════════════════ UI refresh ════════════════════════════════ */

  private refreshUI(): void {
    this.drawBoard();
    this.renderTray();

    const placedCount = this.pieces.filter(p => p.isPlaced).length;
    const allPlaced = placedCount === this.pieces.length;

    // Status
    if (this.statusEl) {
      if (this.isComplete) {
        this.statusEl.textContent = 'THE SQUARE IS WHOLE';
        this.statusEl.style.color = C_SUCCESS;
      } else if (this.showWrongFeedback) {
        this.statusEl.textContent = 'Tiles do not fill the square correctly';
        this.statusEl.style.color = C_ERROR;
      } else if (allPlaced) {
        this.statusEl.textContent = 'All pieces placed — verify your dissection';
        this.statusEl.style.color = `${C_SUCCESS}cc`;
      } else {
        this.statusEl.textContent = '';
      }
    }

    // Check button
    if (this.checkBtnEl) {
      this.checkBtnEl.style.display = (!this.isComplete && allPlaced) ? 'block' : 'none';
    }

    // Hint button
    if (this.hintBtnEl) {
      const canHint = !this.isComplete && this.pieces.some(p => !p.isPlaced || (p.placedOffset[0] !== 0 || p.placedOffset[1] !== 0));
      this.hintBtnEl.style.display = this.isComplete ? 'none' : 'block';
      this.hintBtnEl.style.opacity = canHint ? '1' : '0.3';
      (this.hintBtnEl as HTMLButtonElement).disabled = !canHint;
    }

    // Count
    if (this.countEl) {
      if (placedCount > 0 && !this.isComplete) {
        this.countEl.textContent = `${placedCount}/${this.pieces.length} pieces placed`;
        this.countEl.style.display = 'block';
      } else {
        this.countEl.style.display = 'none';
      }
    }
  }

  /* ═══════════════════ Tray → Board ═════════════════════════════ */

  private placePieceFromTray(id: number): void {
    if (this.isComplete) return;
    const idx = this.pieces.findIndex(p => p.id === id);
    if (idx < 0) return;

    const piece = this.pieces[idx];
    const randomOff = this.randomPlacementOffset(piece);
    this.placedCounter++;
    piece.isPlaced = true;
    piece.placedOffset = randomOff;
    piece.placedOrder = this.placedCounter;
    this.showWrongFeedback = false;
    this.refreshUI();
  }

  private randomPlacementOffset(piece: StomachionPiece): Pt {
    const bb = boundingBox(piece.originalPoints);
    const gs = this.gridSize;
    const minOffX = -bb.minX;
    const maxOffX = gs - bb.maxX;
    const minOffY = -bb.minY;
    const maxOffY = gs - bb.maxY;

    for (let attempt = 0; attempt < 10; attempt++) {
      const rangeX = maxOffX - minOffX;
      const rangeY = maxOffY - minOffY;
      if (rangeX <= 0 || rangeY <= 0) break;

      const rawX = minOffX + Math.random() * rangeX;
      const rawY = minOffY + Math.random() * rangeY;
      const ox = Math.round(rawX * 2) / 2;
      const oy = Math.round(rawY * 2) / 2;

      if (Math.abs(ox) >= 1.0 || Math.abs(oy) >= 1.0) {
        return [ox, oy];
      }
    }

    // Fallback
    const midX = (gs / 2 - (bb.minX + bb.maxX) / 2);
    const midY = (gs / 2 - (bb.minY + bb.maxY) / 2);
    const fx = Math.round(midX * 2) / 2;
    const fy = Math.round(midY * 2) / 2;
    return this.clampOffset([fx, fy], piece.originalPoints);
  }

  private clampOffset(offset: Pt, points: Pt[]): Pt {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [px, py] of points) {
      const tx = px + offset[0], ty = py + offset[1];
      if (tx < minX) minX = tx;
      if (tx > maxX) maxX = tx;
      if (ty < minY) minY = ty;
      if (ty > maxY) maxY = ty;
    }
    let ox = offset[0], oy = offset[1];
    if (minX < 0) ox -= minX;
    if (maxX > this.gridSize) ox -= (maxX - this.gridSize);
    if (minY < 0) oy -= minY;
    if (maxY > this.gridSize) oy -= (maxY - this.gridSize);
    return [ox, oy];
  }

  /* ═══════════════════ Board pointer handling ═══════════════════ */

  private eventToGrid(ev: PointerEvent): Pt {
    if (!this.boardCanvas) return [0, 0];
    const rect = this.boardCanvas.getBoundingClientRect();
    const gx = (ev.clientX - rect.left) / rect.width * this.boardPx / this.cellPx;
    const gy = (ev.clientY - rect.top) / rect.height * this.boardPx / this.cellPx;
    return [gx, gy];
  }

  private findPieceAtGrid(gx: number, gy: number): StomachionPiece | null {
    // Check placed pieces in reverse order (top first)
    const placed = this.pieces
      .filter(p => p.isPlaced)
      .sort((a, b) => b.placedOrder - a.placedOrder);

    for (const piece of placed) {
      const pts = piece.originalPoints.map(([x, y]): Pt => [
        x + piece.placedOffset[0],
        y + piece.placedOffset[1],
      ]);
      if (pointInPolygon(gx, gy, pts)) return piece;
    }
    return null;
  }

  private dragDist = 0;

  private onBoardPointerDown(ev: PointerEvent): void {
    if (this.isComplete) return;
    ev.preventDefault();

    const [gx, gy] = this.eventToGrid(ev);
    const piece = this.findPieceAtGrid(gx, gy);
    if (!piece) return;

    this.dragDist = 0;
    this.draggingID = piece.id;
    this.dragStartGrid = [gx, gy];
    this.dragStartOffset = [piece.placedOffset[0], piece.placedOffset[1]];
    this.hintHighlightID = null;

    // Bring to front
    this.placedCounter++;
    piece.placedOrder = this.placedCounter;

    this.drawBoard();
  }

  private onBoardPointerMove(ev: PointerEvent): void {
    if (this.draggingID === null || !this.dragStartGrid || !this.dragStartOffset) return;
    ev.preventDefault();

    const [gx, gy] = this.eventToGrid(ev);
    const dx = gx - this.dragStartGrid[0];
    const dy = gy - this.dragStartGrid[1];
    this.dragDist = Math.sqrt(dx * dx + dy * dy);

    const piece = this.pieces.find(p => p.id === this.draggingID);
    if (!piece) return;

    // Only start visual drag after a minimum threshold (0.4 grid cells)
    if (this.dragDist >= 0.4) {
      piece.placedOffset = [this.dragStartOffset[0] + dx, this.dragStartOffset[1] + dy];
      this.drawBoard();
    }
  }

  private onBoardPointerUp(ev: PointerEvent): void {
    if (this.draggingID === null) return;
    ev.preventDefault();

    const piece = this.pieces.find(p => p.id === this.draggingID);
    // A drag requires meaningful movement (>= 0.4 grid cells)
    const wasDrag = this.dragDist >= 0.4;

    if (piece) {
      if (wasDrag) {
        // Snap to half-grid
        const snappedX = Math.round(piece.placedOffset[0] * 2) / 2;
        const snappedY = Math.round(piece.placedOffset[1] * 2) / 2;
        const clamped = this.clampOffset([snappedX, snappedY], piece.originalPoints);
        piece.placedOffset = clamped;
        this.showWrongFeedback = false;
      } else {
        // Tap: return piece to tray
        piece.isPlaced = false;
        piece.placedOffset = [0, 0];
        this.showWrongFeedback = false;
      }
    }

    this.draggingID = null;
    this.dragStartGrid = null;
    this.dragStartOffset = null;
    this.refreshUI();
  }

  /* ═══════════════════ Validation (coverage-based, matches iOS) ═ */

  private checkAndSubmit(): void {
    if (this.isComplete) return;

    const step = 0.25;
    const margin = step / 2;
    const gs = this.gridSize;

    const placedPolygons: Pt[][] = this.pieces
      .filter(p => p.isPlaced)
      .map(piece =>
        piece.originalPoints.map(([x, y]): Pt => [x + piece.placedOffset[0], y + piece.placedOffset[1]])
      );

    let correct = true;

    for (let y = margin; y < gs && correct; y += step) {
      for (let x = margin; x < gs && correct; x += step) {
        let coverCount = 0;
        for (const poly of placedPolygons) {
          if (pointInPolygon(x, y, poly)) coverCount++;
        }
        if (coverCount !== 1) correct = false;
      }
    }

    // Check all vertices are within bounds
    if (correct) {
      for (const poly of placedPolygons) {
        for (const [px, py] of poly) {
          if (px < -0.01 || px > gs + 0.01 || py < -0.01 || py > gs + 0.01) {
            correct = false;
            break;
          }
        }
        if (!correct) break;
      }
    }

    if (correct) {
      this.isComplete = true;
      this.isSolved = true;
      this.refreshUI();
      setTimeout(() => this.onSolved?.(), 900);
    } else {
      this.showWrongFeedback = true;
      this.refreshUI();
      // Clear wrong feedback after a delay
      setTimeout(() => {
        if (!this.isComplete) {
          this.showWrongFeedback = false;
          this.refreshUI();
        }
      }, 2000);
    }
  }

  /* ═══════════════════ Hints (matches iOS) ══════════════════════ */

  private handleHintTap(): void {
    if (this.localHintsUsed >= 3 && !this.hintPenaltyAcknowledged) {
      this.showHintWarningOverlay();
    } else {
      this.executeHint();
    }
  }

  private executeHint(): void {
    // Find first piece not correctly placed (not placed, or offset != zero)
    const idx = this.pieces.findIndex(p => !p.isPlaced || p.placedOffset[0] !== 0 || p.placedOffset[1] !== 0);
    if (idx < 0) return;

    this.localHintsUsed++;
    this.hintHighlightID = null;
    this.draggingID = null;

    this.placedCounter++;
    this.pieces[idx].isPlaced = true;
    this.pieces[idx].placedOffset = [0, 0];
    this.pieces[idx].placedOrder = this.placedCounter;

    this.hintHighlightID = this.pieces[idx].id;
    this.showWrongFeedback = false;
    this.refreshUI();

    // Auto-check if all placed correctly
    if (this.pieces.every(p => p.isPlaced && p.placedOffset[0] === 0 && p.placedOffset[1] === 0)) {
      setTimeout(() => this.checkAndSubmit(), 500);
    }
  }

  private showHintWarningOverlay(): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '300px', width: '90%', padding: '20px', textAlign: 'center',
      background: `linear-gradient(to bottom, ${C_GREEK_PANEL}, ${C_GREEK_BG})`,
      border: `1.5px solid ${C_GREEK_GOLD}66`,
      borderRadius: '16px', boxShadow: `0 0 30px ${C_GREEK_GOLD}22`,
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      animation: 'stomachion-pop 0.25s ease-out',
    });

    // Warning icon
    const icon = document.createElement('div');
    icon.style.fontSize = '32px';
    icon.textContent = '\u26A0\uFE0F';
    card.appendChild(icon);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { color: C_ERROR, fontSize: '16px', fontWeight: '700', margin: '8px 0' });
    title.textContent = 'Hint Penalty Warning';
    card.appendChild(title);

    // Message
    const msg = document.createElement('div');
    Object.assign(msg.style, { color: `${C_GREEK_TEXT}cc`, fontSize: '13px', margin: '0 0 16px', lineHeight: '1.5' });
    msg.textContent = 'You have used 3 hints. Further hints will reduce your score. Continue?';
    card.appendChild(msg);

    // Buttons
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '12px' });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      flex: '1', padding: '10px', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit',
      color: `${C_GREEK_TEXT}99`, background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', cursor: 'pointer',
    });
    cancelBtn.addEventListener('click', () => {
      this.overlayEl!.style.display = 'none';
    });
    btnRow.appendChild(cancelBtn);

    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.textContent = 'Continue';
    Object.assign(continueBtn.style, {
      flex: '1', padding: '10px', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
      color: C_GREEK_GOLD, background: `${C_GREEK_GOLD}14`,
      border: `1px solid ${C_GREEK_GOLD}55`, borderRadius: '8px', cursor: 'pointer',
    });
    continueBtn.addEventListener('click', () => {
      this.hintPenaltyAcknowledged = true;
      this.overlayEl!.style.display = 'none';
      this.executeHint();
    });
    btnRow.appendChild(continueBtn);

    card.appendChild(btnRow);
    this.overlayEl.appendChild(card);
  }

  /* ═══════════════════ Rules overlay ════════════════════════════ */

  private showRulesOverlay(): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '340px', width: '90%', padding: '0',
      background: `linear-gradient(to bottom, ${C_GREEK_BG}, ${C_GREEK_PANEL}, ${C_GREEK_BG})`,
      border: `1.5px solid ${C_GREEK_GOLD}55`,
      borderRadius: '16px', boxShadow: `0 0 30px ${C_GREEK_GOLD}22`,
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      animation: 'stomachion-pop 0.25s ease-out',
      maxHeight: '85vh', overflowY: 'auto',
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 20px 10px',
    });

    const headerTitle = document.createElement('div');
    Object.assign(headerTitle.style, { color: C_GREEK_GOLD, fontSize: '16px', fontWeight: '700', letterSpacing: '0.1em' });
    headerTitle.textContent = 'RULES';
    header.appendChild(headerTitle);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '\u2715';
    Object.assign(closeBtn.style, {
      background: 'none', border: 'none', color: `${C_GREEK_GOLD}aa`, fontSize: '18px',
      cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit',
    });
    closeBtn.addEventListener('click', () => {
      this.overlayEl!.style.display = 'none';
    });
    header.appendChild(closeBtn);
    card.appendChild(header);

    // Rule cards
    const rules = [
      { title: 'Dissect the Square', body: 'All pieces must fit perfectly inside the square grid with no gaps and no overlaps. This is a tiling puzzle attributed to Archimedes.' },
      { title: 'Place & Rearrange', body: 'Tap a piece in the tray to place it on the board. Drag placed pieces to reposition them. Tap a placed piece to return it to the tray. Pieces snap to half-grid positions.' },
      { title: 'Hints', body: 'Use the hint button to automatically place a piece in its correct position. After 3 hints, further hints may reduce your score.' },
    ];

    const rulesWrap = document.createElement('div');
    Object.assign(rulesWrap.style, { padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' });

    for (const rule of rules) {
      const ruleEl = document.createElement('div');
      Object.assign(ruleEl.style, {
        padding: '14px', background: 'rgba(26,21,37,0.8)',
        border: `0.5px solid ${C_GREEK_GOLD}26`, borderRadius: '10px',
      });

      const rTitle = document.createElement('div');
      Object.assign(rTitle.style, { color: C_GREEK_GOLD, fontSize: '14px', fontWeight: '700', marginBottom: '6px' });
      rTitle.textContent = rule.title;
      ruleEl.appendChild(rTitle);

      const rBody = document.createElement('div');
      Object.assign(rBody.style, { color: `${C_GREEK_TEXT}d9`, fontSize: '12px', lineHeight: '1.5' });
      rBody.textContent = rule.body;
      ruleEl.appendChild(rBody);

      rulesWrap.appendChild(ruleEl);
    }

    card.appendChild(rulesWrap);
    this.overlayEl.appendChild(card);
  }

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {
    // All interaction happens in the DOM overlay — ignore raycaster picks.
  }

  override dispose(): void {
    if (this.root) { this.root.remove(); this.root = null; }
    if (this.moveHandler) window.removeEventListener('pointermove', this.moveHandler);
    if (this.upHandler) {
      window.removeEventListener('pointerup', this.upHandler);
      window.removeEventListener('pointercancel', this.upHandler);
    }
    const animStyle = document.getElementById('stomachion-anims');
    if (animStyle) animStyle.remove();
    this.moveHandler = null;
    this.upHandler = null;
    this.boardCanvas = null;
    this.boardCtx = null;
    this.trayEl = null;
    this.statusEl = null;
    this.checkBtnEl = null;
    this.hintBtnEl = null;
    this.countEl = null;
    this.overlayEl = null;
    this.pieces = [];
    super.dispose();
  }
}
