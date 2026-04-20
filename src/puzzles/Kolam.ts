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
 * Kolam — south Indian threshold pattern puzzle.
 * The player traces curved segments around dots to form a continuous path.
 * Each segment must connect to the end of the current path. The puzzle is
 * complete when all target segments have been placed.
 *
 * Aligned with iOS KolamPuzzleView:
 *   - Segment model with curveOffset for quadratic bezier curves
 *   - Multiple grid patterns (2x2 through 6x6)
 *   - Dead-end detection with auto-undo
 *   - Valid-next-segment highlighting
 *   - Undo and reset controls
 *   - Indian color theme
 */

/* ── Grid config ─────────────────────────────────────────────── */

const DEFAULT_ROWS = 6;
const DEFAULT_COLS = 6;
const CANVAS_SIZE = 340;
const DOT_RADIUS = 6;
const SEGMENT_LINE_WIDTH = 3.5;
const MAX_DEAD_ENDS = 3;

/* ── Colors (Indian Kolam theme, matches iOS) ────────────────── */

const C_BG = '#1A0F08';
const C_DOT = '#FFF5E1';
const C_GUIDE = '#FFF5E1';
const C_ACTIVE = '#E07020';
const C_COMPLETED = '#D4442A';
const C_SUCCESS_GLOW = '#FFB347';
const C_ERROR = '#FF4444';
const C_CREAM = '#FFF5E1';

/* ── Segment model ───────────────────────────────────────────── */

interface Segment {
  a: number; // flattened index of first dot (sorted: a <= b)
  b: number; // flattened index of second dot
  curveOffset: number;
}

function makeSegment(a: number, b: number, curveOffset = 0.25): Segment {
  return a <= b ? { a, b, curveOffset } : { a: b, b: a, curveOffset };
}

function segmentEqual(s1: Segment, s2: Segment): boolean {
  return s1.a === s2.a && s1.b === s2.b;
}

function segmentContains(seg: Segment, dot: number): boolean {
  return seg.a === dot || seg.b === dot;
}

function segmentOtherEnd(seg: Segment, dot: number): number {
  return dot === seg.a ? seg.b : seg.a;
}

/* ── Pattern generation (matches iOS) ────────────────────────── */

function targetPattern(rows: number, cols: number): Segment[] {
  switch (`${rows},${cols}`) {
    case '2,2': return pattern2x2();
    case '3,3': return pattern3x3();
    case '4,4': return pattern4x4();
    case '5,5': return pattern5x5();
    case '4,5': return pattern4x5();
    case '5,6': return pattern5x6();
    case '4,6': return pattern4x6();
    case '6,6': return pattern6x6();
    default: return borderPattern(rows, cols);
  }
}

function pattern2x2(): Segment[] {
  return [
    makeSegment(0, 1, 0.35), makeSegment(1, 3, 0.35),
    makeSegment(3, 2, 0.35), makeSegment(2, 0, 0.35),
  ];
}

function pattern3x3(): Segment[] {
  return [
    makeSegment(0, 1, 0.3), makeSegment(1, 2, 0.3),
    makeSegment(2, 5, 0.3), makeSegment(5, 8, 0.3),
    makeSegment(8, 7, 0.3), makeSegment(7, 6, 0.3),
    makeSegment(6, 3, 0.3), makeSegment(3, 4, 0.25),
    makeSegment(4, 0, 0.25),
  ];
}

function pattern4x4(): Segment[] {
  return [
    // Top petal
    makeSegment(1, 5, 0.3), makeSegment(5, 6, 0.3),
    makeSegment(6, 2, 0.3), makeSegment(2, 1, -0.3),
    // Right petal
    makeSegment(6, 7, 0.3), makeSegment(7, 11, 0.3),
    makeSegment(11, 10, 0.3), makeSegment(10, 6, -0.3),
    // Bottom petal
    makeSegment(9, 10, 0.3), makeSegment(10, 14, 0.3),
    makeSegment(14, 13, 0.3), makeSegment(13, 9, -0.3),
    // Left petal
    makeSegment(4, 5, 0.3), makeSegment(5, 9, 0.3),
    makeSegment(9, 8, 0.3), makeSegment(8, 4, -0.3),
  ];
}

function pattern5x5(): Segment[] {
  return [
    // Outer border
    makeSegment(0, 1, 0.25), makeSegment(1, 2, 0.25),
    makeSegment(2, 3, 0.25), makeSegment(3, 4, 0.25),
    makeSegment(4, 9, 0.25), makeSegment(9, 14, 0.25),
    makeSegment(14, 19, 0.25), makeSegment(19, 24, 0.25),
    makeSegment(24, 23, 0.25), makeSegment(23, 22, 0.25),
    makeSegment(22, 21, 0.25), makeSegment(21, 20, 0.25),
    makeSegment(20, 15, 0.25), makeSegment(15, 10, 0.25),
    makeSegment(10, 5, 0.25), makeSegment(5, 0, 0.25),
    // Inner diamond
    makeSegment(2, 6, 0.3), makeSegment(6, 12, 0.3),
    makeSegment(12, 8, 0.3), makeSegment(8, 2, -0.3),
    makeSegment(12, 16, 0.3), makeSegment(16, 22, 0.3),
    makeSegment(12, 18, -0.3), makeSegment(18, 22, -0.3),
  ];
}

function pattern4x5(): Segment[] {
  return [
    makeSegment(0, 1, 0.25), makeSegment(0, 5, -0.25),
    makeSegment(1, 6, 0.30), makeSegment(5, 6, -0.30),
    makeSegment(6, 7, 0.25), makeSegment(6, 11, 0.25),
    makeSegment(7, 8, -0.25), makeSegment(3, 8, 0.30),
    makeSegment(8, 9, 0.25), makeSegment(8, 13, -0.30),
    makeSegment(3, 4, 0.25), makeSegment(4, 9, 0.25),
    makeSegment(12, 13, -0.25), makeSegment(13, 14, 0.25),
    makeSegment(13, 18, 0.30), makeSegment(14, 19, 0.25),
    makeSegment(18, 19, -0.25), makeSegment(11, 12, 0.25),
    makeSegment(10, 11, -0.25), makeSegment(11, 16, 0.30),
    makeSegment(10, 15, 0.25), makeSegment(15, 16, -0.25),
    makeSegment(12, 16, -0.30), makeSegment(12, 17, 0.30),
    makeSegment(16, 17, 0.25),
  ];
}

function pattern5x6(): Segment[] {
  return [
    makeSegment(0, 1, 0.25), makeSegment(0, 6, -0.25),
    makeSegment(1, 7, 0.30), makeSegment(6, 7, -0.30),
    makeSegment(7, 8, 0.25), makeSegment(7, 13, 0.25),
    makeSegment(8, 9, -0.25), makeSegment(9, 10, 0.25),
    makeSegment(9, 15, -0.30), makeSegment(3, 9, 0.30),
    makeSegment(3, 4, 0.25), makeSegment(4, 5, 0.25),
    makeSegment(5, 11, 0.25), makeSegment(11, 17, -0.25),
    makeSegment(10, 16, 0.25), makeSegment(15, 16, -0.25),
    makeSegment(16, 17, 0.30), makeSegment(16, 22, 0.25),
    makeSegment(13, 14, 0.25), makeSegment(14, 20, -0.25),
    makeSegment(20, 26, 0.25), makeSegment(26, 27, -0.25),
    makeSegment(21, 27, 0.25), makeSegment(21, 22, -0.30),
    makeSegment(22, 23, 0.25), makeSegment(22, 28, 0.30),
    makeSegment(23, 29, 0.25), makeSegment(28, 29, -0.25),
    makeSegment(12, 13, -0.25), makeSegment(12, 18, 0.25),
    makeSegment(18, 24, 0.25), makeSegment(24, 25, -0.25),
    makeSegment(19, 25, 0.25), makeSegment(13, 19, -0.30),
  ];
}

function pattern4x6(): Segment[] {
  const segs: Segment[] = [];
  const cols = 6;
  const rows = 4;
  for (let c = 0; c < cols; c++) {
    const bowRight = (c % 2 === 0) ? -0.28 : 0.28;
    for (let r = 0; r < rows - 1; r++) {
      segs.push(makeSegment(r * cols + c, (r + 1) * cols + c, bowRight));
    }
  }
  segs.push(makeSegment(18, 19, -0.25));
  segs.push(makeSegment(20, 21, -0.25));
  segs.push(makeSegment(22, 23, -0.25));
  segs.push(makeSegment(1, 2, 0.25));
  segs.push(makeSegment(3, 4, 0.25));
  segs.push(makeSegment(0, 5, -0.55));
  return segs;
}

function pattern6x6(): Segment[] {
  const segs: Segment[] = [];
  const cols = 6;
  const rows = 6;
  for (let c = 0; c < cols; c++) {
    const bowRight = (c % 2 === 0) ? -0.28 : 0.28;
    for (let r = 0; r < rows - 1; r++) {
      segs.push(makeSegment(r * cols + c, (r + 1) * cols + c, bowRight));
    }
  }
  segs.push(makeSegment(30, 31, -0.25));
  segs.push(makeSegment(32, 33, -0.25));
  segs.push(makeSegment(34, 35, -0.25));
  segs.push(makeSegment(1, 2, 0.25));
  segs.push(makeSegment(3, 4, 0.25));
  segs.push(makeSegment(0, 5, -0.55));
  return segs;
}

function borderPattern(rows: number, cols: number): Segment[] {
  const segs: Segment[] = [];
  for (let c = 0; c < cols - 1; c++) segs.push(makeSegment(c, c + 1, 0.2));
  for (let r = 0; r < rows - 1; r++) segs.push(makeSegment(r * cols + cols - 1, (r + 1) * cols + cols - 1, 0.2));
  for (let c = 0; c < cols - 1; c++) segs.push(makeSegment((rows - 1) * cols + c, (rows - 1) * cols + c + 1, 0.2));
  for (let r = 0; r < rows - 1; r++) segs.push(makeSegment(r * cols, (r + 1) * cols, 0.2));
  return segs;
}

/* ── Puzzle class ─────────────────────────────────────────────── */

export class KolamPuzzle extends Puzzle {
  readonly title = 'KOLAM';
  readonly subtitle = 'threshold tracing';
  readonly instructions =
    'Tap dots to trace curved segments forming a continuous path. Each new segment must connect to the end of your current path. Complete all segments to finish the Kolam pattern.';

  private rows = DEFAULT_ROWS;
  private cols = DEFAULT_COLS;
  private target: Segment[] = [];
  private placedSegments: Segment[] = [];
  private currentDot: number | null = null;
  private pathStartDot: number | null = null;
  private deadEndCount = 0;
  private isComplete = false;

  // DOM
  private root: HTMLDivElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private counterEl: HTMLDivElement | null = null;
  private hintEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.target = targetPattern(this.rows, this.cols);
    this.buildDom();
    this.drawCanvas();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color('#2a1a10'), roughness: 0.7, metalness: 0.15, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const halo = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color('#f6c878'), emissive: new Color('#402010'),
        emissiveIntensity: 0.45, roughness: 0.4, metalness: 0.85, side: DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -2.37;
    this.group.add(halo);

    const lamp = new PointLight('#ffd89a', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-kolam';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: 'rgba(26,15,8,0.92)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(224,112,32,0.25)', borderTop: `3px solid ${C_ACTIVE}`,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_CREAM,
      maxHeight: '96vh', overflowY: 'auto',
    });
    root.appendChild(panel);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '16px', letterSpacing: '0.22em', color: C_ACTIVE, fontWeight: '700' });
    title.textContent = 'KOLAM · கோலம்';
    panel.appendChild(title);

    // Progress counter
    const counter = document.createElement('div');
    Object.assign(counter.style, {
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '6px 14px', borderRadius: '20px',
      background: 'rgba(224,112,32,0.12)', fontSize: '13px', fontWeight: '600',
    });
    counter.textContent = `0 / ${this.target.length} segments`;
    this.counterEl = counter;
    panel.appendChild(counter);

    // Hint text
    const hint = document.createElement('div');
    Object.assign(hint.style, { fontSize: '11px', opacity: '0.5', letterSpacing: '0.04em' });
    hint.textContent = 'Tap a dot to begin';
    this.hintEl = hint;
    panel.appendChild(hint);

    // Canvas board
    const canvasWrap = document.createElement('div');
    Object.assign(canvasWrap.style, {
      position: 'relative', borderRadius: '12px', overflow: 'hidden',
      border: `1px solid rgba(224,112,32,0.3)`,
    });

    const cvs = document.createElement('canvas');
    cvs.width = CANVAS_SIZE * 2;
    cvs.height = CANVAS_SIZE * 2;
    Object.assign(cvs.style, { width: CANVAS_SIZE + 'px', height: CANVAS_SIZE + 'px', display: 'block', cursor: 'pointer' });
    this.ctx2d = cvs.getContext('2d')!;
    canvasWrap.appendChild(cvs);

    cvs.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      const rect = cvs.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      this.handleTap(x, y);
    });

    panel.appendChild(canvasWrap);

    // Status
    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, {
      fontSize: '12px', fontWeight: '600', textAlign: 'center', minHeight: '18px', color: C_ERROR,
    });
    panel.appendChild(this.statusEl);

    // Controls
    const controls = document.createElement('div');
    Object.assign(controls.style, { display: 'flex', gap: '10px' });

    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.textContent = '↩ UNDO';
    Object.assign(undoBtn.style, {
      padding: '8px 16px', background: 'rgba(255,245,225,0.06)',
      border: '1px solid rgba(255,245,225,0.2)', color: C_DOT + 'bb',
      fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.16em', fontWeight: '600',
      borderRadius: '6px', cursor: 'pointer',
    });
    undoBtn.addEventListener('click', () => this.undoLast());
    controls.appendChild(undoBtn);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = '↺ RESET';
    Object.assign(resetBtn.style, {
      padding: '8px 16px', background: 'rgba(212,68,42,0.06)',
      border: '1px solid rgba(212,68,42,0.25)', color: C_COMPLETED + 'cc',
      fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.16em', fontWeight: '600',
      borderRadius: '6px', cursor: 'pointer',
    });
    resetBtn.addEventListener('click', () => this.resetPath());
    controls.appendChild(resetBtn);

    panel.appendChild(controls);

    // Overlay container (for rules / success)
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    document.body.appendChild(root);
  }

  /* ═══════════════════ Canvas drawing ════════════════════════════ */

  private calculateSpacing(): number {
    return CANVAS_SIZE / (Math.max(this.rows, this.cols) + 1);
  }

  private calculateOrigin(): { x: number; y: number } {
    const spacing = this.calculateSpacing();
    return {
      x: (CANVAS_SIZE - (this.cols - 1) * spacing) / 2,
      y: (CANVAS_SIZE - (this.rows - 1) * spacing) / 2,
    };
  }

  private dotPosition(dotIndex: number): { x: number; y: number } {
    const row = Math.floor(dotIndex / this.cols);
    const col = dotIndex % this.cols;
    const spacing = this.calculateSpacing();
    const origin = this.calculateOrigin();
    return { x: origin.x + col * spacing, y: origin.y + row * spacing };
  }

  private drawCanvas(): void {
    const c = this.ctx2d!;
    const s = 2;
    c.clearRect(0, 0, CANVAS_SIZE * s, CANVAS_SIZE * s);
    c.save();
    c.scale(s, s);

    // Background
    c.fillStyle = C_BG;
    c.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 1. Draw guide segments (faint dashed)
    for (const seg of this.target) {
      if (!this.isPlaced(seg)) {
        this.drawCurvedSegment(c, seg, C_GUIDE + '1f', SEGMENT_LINE_WIDTH, true);
      }
    }

    // 2. Draw placed segments with gradient color
    for (let i = 0; i < this.placedSegments.length; i++) {
      const progress = i / Math.max(1, this.target.length);
      const r = Math.round((0.88 - progress * 0.05) * 255);
      const g = Math.round((0.44 - progress * 0.15) * 255);
      const b = Math.round((0.13 + progress * 0.05) * 255);
      const color = `rgb(${r},${g},${b})`;
      this.drawCurvedSegment(c, this.placedSegments[i], color, SEGMENT_LINE_WIDTH + 1.5, false);
    }

    // 3. Draw valid next moves (highlight)
    if (this.currentDot !== null && !this.isComplete) {
      const validNext = this.validNextSegments();
      for (const seg of validNext) {
        this.drawCurvedSegment(c, seg, C_SUCCESS_GLOW + '40', SEGMENT_LINE_WIDTH + 3, false);
      }
      // Highlight current dot
      const pos = this.dotPosition(this.currentDot);
      c.beginPath();
      c.arc(pos.x, pos.y, DOT_RADIUS * 2, 0, Math.PI * 2);
      c.fillStyle = C_ACTIVE + '33';
      c.fill();
    }

    // 4. Draw dots
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const idx = row * this.cols + col;
        const pos = this.dotPosition(idx);
        const isStart = idx === this.pathStartDot;
        const isCurrent = idx === this.currentDot;
        const r = isCurrent ? DOT_RADIUS * 1.3 : (isStart ? DOT_RADIUS * 1.1 : DOT_RADIUS);

        let dotFill: string;
        if (isCurrent) dotFill = C_ACTIVE;
        else if (isStart) dotFill = C_SUCCESS_GLOW;
        else dotFill = C_DOT;

        c.beginPath();
        c.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        c.fillStyle = dotFill;
        c.fill();

        if (isCurrent || isStart) {
          c.beginPath();
          c.arc(pos.x, pos.y, r * 0.6, 0, Math.PI * 2);
          c.fillStyle = 'rgba(255,255,255,0.5)';
          c.fill();
        }
      }
    }

    c.restore();
  }

  private drawCurvedSegment(
    c: CanvasRenderingContext2D, seg: Segment,
    color: string, lineWidth: number, dashed: boolean,
  ): void {
    const p1 = this.dotPosition(seg.a);
    const p2 = this.dotPosition(seg.b);
    const spacing = this.calculateSpacing();

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const perpX = -dy / len;
    const perpY = dx / len;
    const offset = seg.curveOffset * spacing;
    const ctrlX = midX + perpX * offset;
    const ctrlY = midY + perpY * offset;

    c.beginPath();
    c.moveTo(p1.x, p1.y);
    c.quadraticCurveTo(ctrlX, ctrlY, p2.x, p2.y);
    c.strokeStyle = color;
    c.lineWidth = lineWidth;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (dashed) {
      c.setLineDash([6, 4]);
    } else {
      c.setLineDash([]);
    }
    c.stroke();
    c.setLineDash([]);
  }

  /* ═══════════════════ Game logic ════════════════════════════════ */

  private isPlaced(seg: Segment): boolean {
    return this.placedSegments.some(p => segmentEqual(p, seg));
  }

  private validNextSegments(): Segment[] {
    if (this.currentDot === null) return [];
    const cur = this.currentDot;
    return this.target.filter(seg =>
      segmentContains(seg, cur) && !this.isPlaced(seg),
    );
  }

  private handleTap(x: number, y: number): void {
    if (this.isComplete) return;

    const spacing = this.calculateSpacing();
    const tapThreshold = spacing * 0.45;

    // Find closest dot
    let closestDot: number | null = null;
    let closestDist = Infinity;

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const idx = row * this.cols + col;
        const pos = this.dotPosition(idx);
        const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (dist < closestDist && dist < tapThreshold) {
          closestDist = dist;
          closestDot = idx;
        }
      }
    }

    if (closestDot === null) return;

    if (this.currentDot === null) {
      // Starting the path
      this.currentDot = closestDot;
      this.pathStartDot = closestDot;
      this.refreshUI();
      return;
    }

    const cur = this.currentDot;
    const candidateSeg = makeSegment(cur, closestDot);

    // Must be a target segment
    const matchingTarget = this.target.find(s => segmentEqual(s, candidateSeg));
    if (!matchingTarget) {
      this.flashWrong('Not a valid segment');
      return;
    }

    // Must not already be placed
    if (this.isPlaced(matchingTarget)) {
      this.flashWrong('Already traced');
      return;
    }

    // Valid — place segment
    this.placedSegments.push(matchingTarget);
    this.currentDot = closestDot;
    this.clearStatus();

    // Check completion
    if (this.placedSegments.length === this.target.length) {
      this.isComplete = true;
      this.isSolved = true;
      this.refreshUI();
      this.showSuccess();
      setTimeout(() => this.onSolved?.(), 1200);
      return;
    }

    // Check dead end
    if (this.validNextSegments().length === 0) {
      this.deadEndCount++;
      if (this.deadEndCount >= MAX_DEAD_ENDS) {
        this.flashWrong('Too many dead ends!');
        // Puzzle failed
      } else {
        this.flashWrong(`Dead end! Undoing... (${MAX_DEAD_ENDS - this.deadEndCount} chances left)`);
        setTimeout(() => {
          this.undoLast();
          this.clearStatus();
        }, 1200);
      }
    }

    this.refreshUI();
  }

  private undoLast(): void {
    if (this.placedSegments.length === 0) return;
    this.placedSegments.pop();
    if (this.placedSegments.length === 0) {
      this.currentDot = this.pathStartDot;
    } else {
      const lastSeg = this.placedSegments[this.placedSegments.length - 1];
      if (this.placedSegments.length >= 2) {
        const prev = this.placedSegments[this.placedSegments.length - 2];
        if (lastSeg.a === prev.a || lastSeg.a === prev.b) {
          this.currentDot = lastSeg.b;
        } else {
          this.currentDot = lastSeg.a;
        }
      } else {
        this.currentDot = segmentOtherEnd(lastSeg, this.pathStartDot ?? lastSeg.a);
      }
    }
    this.refreshUI();
  }

  private resetPath(): void {
    this.placedSegments = [];
    this.currentDot = null;
    this.pathStartDot = null;
    this.isComplete = false;
    this.isSolved = false;
    this.deadEndCount = 0;
    this.clearStatus();
    this.refreshUI();
  }

  private flashWrong(msg: string): void {
    if (this.statusEl) {
      this.statusEl.textContent = msg;
      this.statusEl.style.color = C_ERROR;
    }
    setTimeout(() => this.clearStatus(), 1500);
  }

  private clearStatus(): void {
    if (this.statusEl) {
      this.statusEl.textContent = '';
    }
  }

  private showSuccess(): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const banner = document.createElement('div');
    Object.assign(banner.style, {
      padding: '16px 32px', borderRadius: '30px',
      background: `rgba(212,68,42,0.25)`, border: `1px solid ${C_SUCCESS_GLOW}88`,
      color: C_SUCCESS_GLOW, fontSize: '18px', fontWeight: '700',
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      letterSpacing: '0.08em', textAlign: 'center',
      animation: 'kolam-pop 0.4s ease-out',
    });
    banner.textContent = '✦ KOLAM COMPLETE ✦';

    // Inject animation if needed
    if (!document.getElementById('kolam-anims')) {
      const style = document.createElement('style');
      style.id = 'kolam-anims';
      style.textContent = `@keyframes kolam-pop { from { transform: scale(0.85); opacity:0; } to { transform: scale(1); opacity:1; } }`;
      document.head.appendChild(style);
    }

    this.overlayEl.appendChild(banner);
  }

  /* ═══════════════════ UI refresh ════════════════════════════════ */

  private refreshUI(): void {
    if (this.counterEl) {
      this.counterEl.textContent = `${this.placedSegments.length} / ${this.target.length} segments`;
    }
    if (this.hintEl) {
      if (this.currentDot !== null) {
        this.hintEl.textContent = 'Tap a connected dot to extend the path';
      } else {
        this.hintEl.textContent = 'Tap a dot to begin';
      }
    }
    this.drawCanvas();
  }

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('kolam-anims');
    if (animStyle) animStyle.remove();
    this.ctx2d = null;
    this.counterEl = null;
    this.hintEl = null;
    this.statusEl = null;
    this.overlayEl = null;
    super.dispose();
  }
}
