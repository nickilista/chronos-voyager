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
 * Lo Shu (洛書) — the ancient Chinese magic square puzzle.
 * The player fills a 3×3 grid so every row, column, and diagonal sums
 * to the magic constant (15). Each digit 1–9 appears exactly once.
 *
 * Aligned with the iOS MagicSquareView.swift implementation:
 *   - Canvas-drawn board with Chinese jade/gold aesthetic
 *   - Row, column, and diagonal sum indicators with live feedback
 *   - Number picker tray showing available digits
 *   - Tap cell to select, tap number to place, tap selected cell to clear
 *   - Correct-sum highlighting (gold checkmarks)
 *   - Hint system with penalty warning after 3 hints
 *   - Completion celebration when all sums match
 */

/* ── Board config ─────────────────────────────────────────────── */

const N = 3;
const MAGIC = 15; // n(n²+1)/2
const BLANKS = 8; // max difficulty: only 1 given cell
const CELL_PX = 72;
const BOARD_PX = N * CELL_PX;

/* ── Colors (Chinese jade/gold aesthetic, matches iOS) ────────── */

const C_BG       = '#1A0F05';
const C_CELL_BG  = '#2A1A0A';
const C_GOLD     = '#D4AF37';
const C_CRIMSON   = '#CC3333';
const C_JADE     = '#2E8B57';
const C_CREAM    = '#F5E6D3';
const C_SUCCESS  = '#FFD700';

/* ── Grid types ───────────────────────────────────────────────── */

type Grid = number[][];
type NullableGrid = (number | null)[][];

/* ── Magic square generation (Siamese method + transforms) ───── */

function generateOddMagicSquare(size: number): Grid {
  const sq: Grid = Array.from({ length: size }, () => Array(size).fill(0));
  let row = 0;
  let col = Math.floor(size / 2);

  for (let num = 1; num <= size * size; num++) {
    sq[row][col] = num;
    const newRow = (row - 1 + size) % size;
    const newCol = (col + 1) % size;
    if (sq[newRow][newCol] !== 0) {
      row = (row + 1) % size;
    } else {
      row = newRow;
      col = newCol;
    }
  }
  return randomTransform(sq);
}

function randomTransform(square: Grid): Grid {
  const size = square.length;
  let result = square.map(r => [...r]);
  const rotations = Math.floor(Math.random() * 4);
  for (let t = 0; t < rotations; t++) {
    const rotated: Grid = Array.from({ length: size }, () => Array(size).fill(0));
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        rotated[c][size - 1 - r] = result[r][c];
    result = rotated;
  }
  if (Math.random() < 0.5) {
    result = result.map(r => [...r].reverse());
  }
  return result;
}

/* ── Sum helpers ──────────────────────────────────────────────── */

function rowSum(g: NullableGrid, row: number): number | null {
  const vals = g[row].filter((v): v is number => v != null);
  return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0);
}

function colSum(g: NullableGrid, col: number): number | null {
  const vals: number[] = [];
  for (let r = 0; r < N; r++) { const v = g[r][col]; if (v != null) vals.push(v); }
  return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0);
}

function diagSum(g: NullableGrid, anti: boolean): number | null {
  const vals: number[] = [];
  for (let i = 0; i < N; i++) {
    const c = anti ? N - 1 - i : i;
    const v = g[i][c];
    if (v != null) vals.push(v);
  }
  return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0);
}

function isLineComplete(values: (number | null)[]): boolean {
  return values.every(v => v != null);
}

function rowValues(g: NullableGrid, row: number): (number | null)[] {
  return g[row];
}

function colValues(g: NullableGrid, col: number): (number | null)[] {
  return Array.from({ length: N }, (_, r) => g[r][col]);
}

function diagValues(g: NullableGrid, anti: boolean): (number | null)[] {
  return Array.from({ length: N }, (_, i) => g[i][anti ? N - 1 - i : i]);
}

/* ── Puzzle class ─────────────────────────────────────────────── */

export class LoShuPuzzle extends Puzzle {
  readonly title = 'LO SHU';
  readonly subtitle = 'the turtle-shell square';
  readonly instructions =
    `Place every digit 1–9 so each row, column, and diagonal sums to ${MAGIC}.`;

  private solutionGrid: Grid = [];
  private grid: NullableGrid = [];
  private given: boolean[][] = [];
  private selected: { row: number; col: number } | null = null;

  // Correct-line tracking (matches iOS)
  private correctRows = new Set<number>();
  private correctCols = new Set<number>();
  private correctDiags = new Set<number>(); // 0 = main, 1 = anti

  // Hint system (matches iOS)
  private hintsUsed = 0;
  private hintPenaltyAcknowledged = false;
  private lastHintPos: { row: number; col: number } | null = null;
  private hintFlashTimer = 0;

  // DOM
  private root: HTMLDivElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private numberTrayEl: HTMLDivElement | null = null;
  private hintBtnEl: HTMLButtonElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.setupPuzzle();
    this.buildBackdrop();
    this.buildDom();
    this.drawBoard();
    this.refreshUI();
  }

  /* ═══════════════════ Puzzle setup (matches iOS) ═══════════════ */

  private setupPuzzle(): void {
    const solution = generateOddMagicSquare(N);
    this.solutionGrid = solution;
    const newGrid: NullableGrid = solution.map(r => r.map(v => v as number | null));
    const newGiven: boolean[][] = Array.from({ length: N }, () => Array(N).fill(true));

    // Remove cells for player to fill (iOS blanksCount)
    const positions: [number, number][] = [];
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        positions.push([r, c]);

    // Shuffle positions
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    const toRemove = Math.min(BLANKS, positions.length);
    for (let i = 0; i < toRemove; i++) {
      const [r, c] = positions[i];
      newGrid[r][c] = null;
      newGiven[r][c] = false;
    }

    this.grid = newGrid;
    this.given = newGiven;
    this.selected = null;
    this.correctRows.clear();
    this.correctCols.clear();
    this.correctDiags.clear();
    this.recalcSums();
  }

  /* ═══════════════════ 3D backdrop ══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color(C_BG), roughness: 0.6, metalness: 0.2, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    // Jade bi-disc — Chinese dynastic decor
    const jade = new Mesh(
      new RingGeometry(3.0, 3.18, 64),
      new MeshStandardMaterial({
        color: new Color(C_JADE), emissive: new Color('#123225'),
        emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.7, side: DoubleSide,
      }),
    );
    jade.rotation.x = -Math.PI / 2;
    jade.position.y = -2.38;
    this.group.add(jade);

    const lantern = new PointLight('#f4c98a', 2.0, 22, 1.6);
    lantern.position.set(0, 6, 4);
    this.group.add(lantern);
  }

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-loshu';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: `rgba(26,15,5,0.92)`, backdropFilter: 'blur(12px)',
      border: `1px solid rgba(212,175,55,0.25)`, borderTop: `3px solid ${C_GOLD}`,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_CREAM,
      maxHeight: '96vh', overflowY: 'auto',
    });
    root.appendChild(panel);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '16px', letterSpacing: '0.22em', color: C_GOLD, fontWeight: '700' });
    title.textContent = 'LO SHU \u00B7 \u6D1B\u66F8';
    panel.appendChild(title);

    // Magic constant display (matches iOS)
    const constantRow = document.createElement('div');
    Object.assign(constantRow.style, {
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '6px 16px',
      background: `rgba(107,66,38,0.3)`,
      border: `1px solid rgba(212,175,55,0.3)`,
      borderRadius: '8px',
    });
    const constLabel = document.createElement('span');
    Object.assign(constLabel.style, { fontSize: '12px', fontWeight: '500', color: `${C_CREAM}b3` });
    constLabel.textContent = 'MAGIC CONSTANT';
    const constValue = document.createElement('span');
    Object.assign(constValue.style, { fontSize: '20px', fontWeight: '700', color: C_GOLD });
    constValue.textContent = String(MAGIC);
    constantRow.append(constLabel, constValue);
    panel.appendChild(constantRow);

    // Instructions
    const instr = document.createElement('div');
    Object.assign(instr.style, {
      fontSize: '11px', fontWeight: '500', color: `${C_CREAM}99`, textAlign: 'center', maxWidth: '280px',
    });
    instr.textContent = `Fill the grid so every row, column, and diagonal sums to ${MAGIC}.`;
    panel.appendChild(instr);

    // Board wrapper (canvas for grid)
    const SUM_MARGIN = 36;
    const totalW = BOARD_PX + SUM_MARGIN + 8;
    const totalH = BOARD_PX + SUM_MARGIN + 8;
    const boardWrap = document.createElement('div');
    Object.assign(boardWrap.style, {
      position: 'relative', width: totalW + 'px', height: totalH + 'px',
    });

    // Canvas
    const cvs = document.createElement('canvas');
    cvs.width = totalW * 2;
    cvs.height = totalH * 2;
    Object.assign(cvs.style, { width: totalW + 'px', height: totalH + 'px', display: 'block' });
    this.ctx2d = cvs.getContext('2d')!;
    cvs.addEventListener('click', (e) => this.onCanvasClick(e, cvs));
    boardWrap.appendChild(cvs);
    panel.appendChild(boardWrap);

    // Hint button (matches iOS)
    const hintBtn = document.createElement('button');
    hintBtn.type = 'button';
    Object.assign(hintBtn.style, {
      padding: '7px 14px', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit',
      color: `${C_GOLD}cc`, background: `rgba(107,66,38,0.25)`,
      border: `1px solid rgba(212,175,55,0.2)`, borderRadius: '8px',
      cursor: 'pointer', letterSpacing: '0.06em',
    });
    hintBtn.textContent = '\u{1F4A1} HINT';
    hintBtn.addEventListener('click', () => this.handleHintTap());
    this.hintBtnEl = hintBtn;
    panel.appendChild(hintBtn);

    // Number picker tray (matches iOS)
    this.numberTrayEl = document.createElement('div');
    Object.assign(this.numberTrayEl.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      padding: '12px', background: `rgba(107,66,38,0.15)`,
      border: `1px solid rgba(107,66,38,0.3)`, borderRadius: '10px',
    });
    const trayLabel = document.createElement('div');
    Object.assign(trayLabel.style, { fontSize: '11px', fontWeight: '500', color: `${C_CREAM}80` });
    trayLabel.textContent = 'AVAILABLE NUMBERS';
    this.numberTrayEl.appendChild(trayLabel);

    const trayGrid = document.createElement('div');
    trayGrid.className = 'loshu-tray-grid';
    Object.assign(trayGrid.style, { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' });
    for (let d = 1; d <= N * N; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.digit = String(d);
      b.textContent = String(d);
      Object.assign(b.style, {
        width: '36px', height: '36px', fontSize: '15px', fontWeight: '600', fontFamily: 'inherit',
        color: C_CREAM, background: `rgba(46,139,87,0.35)`,
        border: `1px solid rgba(46,139,87,0.6)`, borderRadius: '6px',
        cursor: 'pointer', transition: 'opacity 0.15s',
      });
      b.addEventListener('click', () => this.placeNumber(d));
      trayGrid.appendChild(b);
    }
    this.numberTrayEl.appendChild(trayGrid);
    panel.appendChild(this.numberTrayEl);

    // Status message
    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, {
      fontSize: '13px', letterSpacing: '0.06em', textAlign: 'center', minHeight: '20px', fontWeight: '600',
    });
    panel.appendChild(this.statusEl);

    // Overlay container (for hint warning dialog)
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    // Inject animation keyframe
    if (!document.getElementById('loshu-anims')) {
      const style = document.createElement('style');
      style.id = 'loshu-anims';
      style.textContent = `
        @keyframes loshu-pop { from { transform: scale(0.92); opacity:0; } to { transform: scale(1); opacity:1; } }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(root);
  }

  /* ═══════════════════ Canvas board drawing ══════════════════════ */

  private drawBoard(): void {
    const c = this.ctx2d!;
    const SUM_MARGIN = 36;
    const totalW = BOARD_PX + SUM_MARGIN + 8;
    const totalH = BOARD_PX + SUM_MARGIN + 8;
    const s = 2;
    c.clearRect(0, 0, totalW * s, totalH * s);
    c.save();
    c.scale(s, s);

    const gridOffX = 0;
    const gridOffY = 0;

    // Draw cells
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const x = gridOffX + col * CELL_PX;
        const y = gridOffY + row * CELL_PX;
        const value = this.grid[row][col];
        const isGiven = this.given[row][col];
        const isSel = this.selected?.row === row && this.selected?.col === col;
        const isHinted = this.lastHintPos?.row === row && this.lastHintPos?.col === col;

        // Cell background
        let fill: string;
        if (isHinted) fill = 'rgba(255,215,0,0.25)';
        else if (isSel) fill = 'rgba(212,175,55,0.2)';
        else if (isGiven) fill = 'rgba(107,66,38,0.4)';
        else fill = C_CELL_BG;

        // Rounded rect
        this.fillRoundRect(c, x + 1, y + 1, CELL_PX - 2, CELL_PX - 2, 4, fill);

        // Border
        let strokeColor: string;
        let strokeWidth: number;
        if (isHinted) { strokeColor = C_SUCCESS; strokeWidth = 2; }
        else if (isSel) { strokeColor = C_GOLD; strokeWidth = 2; }
        else if (isGiven) { strokeColor = 'rgba(212,175,55,0.4)'; strokeWidth = 1; }
        else { strokeColor = 'rgba(107,66,38,0.5)'; strokeWidth = 1; }

        this.strokeRoundRect(c, x + 1, y + 1, CELL_PX - 2, CELL_PX - 2, 4, strokeColor, strokeWidth);

        // Value text
        if (value != null) {
          c.fillStyle = isGiven ? C_GOLD : C_CREAM;
          c.font = `${isGiven ? '700' : '600'} 28px Rajdhani, system-ui`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(String(value), x + CELL_PX / 2, y + CELL_PX / 2 + 1);
        }
      }
    }

    // Row sum indicators (right side, matches iOS arrow style)
    for (let row = 0; row < N; row++) {
      const rs = rowSum(this.grid, row);
      const complete = isLineComplete(rowValues(this.grid, row));
      const correct = complete && rs === MAGIC;
      const x = gridOffX + BOARD_PX + 8;
      const y = gridOffY + row * CELL_PX + CELL_PX / 2;

      if (rs != null) {
        c.fillStyle = correct ? C_SUCCESS : `${C_CREAM}66`;
        c.font = 'bold 11px Rajdhani, system-ui';
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(`\u2192 ${rs}`, x, y - 4);
        if (correct) {
          c.fillText('\u2713', x + 6, y + 10);
        }
      } else {
        c.fillStyle = `${C_CREAM}33`;
        c.font = '11px Rajdhani, system-ui';
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText('\u2192', x, y);
      }
    }

    // Column sum indicators (bottom)
    for (let col = 0; col < N; col++) {
      const cs = colSum(this.grid, col);
      const complete = isLineComplete(colValues(this.grid, col));
      const correct = complete && cs === MAGIC;
      const x = gridOffX + col * CELL_PX + CELL_PX / 2;
      const y = gridOffY + BOARD_PX + 12;

      if (cs != null) {
        c.fillStyle = correct ? C_SUCCESS : `${C_CREAM}66`;
        c.font = 'bold 11px Rajdhani, system-ui';
        c.textAlign = 'center';
        c.textBaseline = 'top';
        c.fillText(`\u2193 ${cs}`, x, y);
        if (correct) {
          c.fillText('\u2713', x, y + 14);
        }
      } else {
        c.fillStyle = `${C_CREAM}33`;
        c.font = '11px Rajdhani, system-ui';
        c.textAlign = 'center';
        c.textBaseline = 'top';
        c.fillText('\u2193', x, y);
      }
    }

    // Diagonal sum indicators (matches iOS: anti at bottom-left, main at bottom-right)
    const diagY = gridOffY + BOARD_PX + 12;

    // Anti-diagonal (bottom-left)
    const antiS = diagSum(this.grid, true);
    const antiComplete = isLineComplete(diagValues(this.grid, true));
    const antiCorrect = antiComplete && antiS === MAGIC;
    if (antiS != null) {
      c.fillStyle = antiCorrect ? C_SUCCESS : `${C_CREAM}66`;
      c.font = 'bold 10px Rajdhani, system-ui';
      c.textAlign = 'left';
      c.textBaseline = 'top';
      c.fillText(`\u2571 ${antiS}`, gridOffX - 2, diagY + 18);
    }

    // Main diagonal (bottom-right)
    const mainS = diagSum(this.grid, false);
    const mainComplete = isLineComplete(diagValues(this.grid, false));
    const mainCorrect = mainComplete && mainS === MAGIC;
    if (mainS != null) {
      c.fillStyle = mainCorrect ? C_SUCCESS : `${C_CREAM}66`;
      c.font = 'bold 10px Rajdhani, system-ui';
      c.textAlign = 'right';
      c.textBaseline = 'top';
      c.fillText(`${mainS} \u2572`, gridOffX + BOARD_PX + 2, diagY + 18);
    }

    // Watermark: Chinese character for "magic" (matches iOS)
    c.save();
    c.globalAlpha = 0.04;
    c.fillStyle = C_CRIMSON;
    c.font = '140px serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.translate(BOARD_PX / 2, BOARD_PX / 2);
    c.rotate(-15 * Math.PI / 180);
    c.fillText('\u9B54', 0, 0);
    c.restore();

    c.restore();
  }

  private fillRoundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
    c.fillStyle = fill;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
    c.fill();
  }

  private strokeRoundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, stroke: string, lineWidth: number): void {
    c.strokeStyle = stroke;
    c.lineWidth = lineWidth;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
    c.stroke();
  }

  /* ═══════════════════ Canvas click handling ═════════════════════ */

  private onCanvasClick(e: MouseEvent, cvs: HTMLCanvasElement): void {
    if (this.isSolved) return;
    const rect = cvs.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check if click is within the grid
    const col = Math.floor(mx / CELL_PX);
    const row = Math.floor(my / CELL_PX);
    if (row < 0 || row >= N || col < 0 || col >= N) return;

    if (this.given[row][col]) return;

    if (this.selected?.row === row && this.selected?.col === col) {
      // Deselect and clear cell (matches iOS: tap selected cell to clear)
      this.selected = null;
      this.grid[row][col] = null;
      this.recalcSums();
    } else {
      this.selected = { row, col };
    }
    this.drawBoard();
    this.refreshUI();
  }

  /* ═══════════════════ Number placement (matches iOS) ═══════════ */

  private placeNumber(num: number): void {
    if (this.isSolved) return;
    if (!this.selected) return;
    const { row, col } = this.selected;
    if (this.given[row][col]) return;

    // Check if number is already used
    if (this.isNumberUsed(num)) return;

    this.grid[row][col] = num;
    this.selected = null;
    this.recalcSums();
    this.drawBoard();
    this.refreshUI();
    this.checkSolved();
  }

  private isNumberUsed(num: number): boolean {
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        if (this.grid[r][c] === num) return true;
    return false;
  }

  /* ═══════════════════ Sum recalculation (matches iOS) ══════════ */

  private recalcSums(): void {
    this.correctRows.clear();
    this.correctCols.clear();
    this.correctDiags.clear();

    for (let r = 0; r < N; r++) {
      if (isLineComplete(rowValues(this.grid, r))) {
        const s = rowSum(this.grid, r);
        if (s === MAGIC) this.correctRows.add(r);
      }
    }
    for (let c = 0; c < N; c++) {
      if (isLineComplete(colValues(this.grid, c))) {
        const s = colSum(this.grid, c);
        if (s === MAGIC) this.correctCols.add(c);
      }
    }
    if (isLineComplete(diagValues(this.grid, false))) {
      if (diagSum(this.grid, false) === MAGIC) this.correctDiags.add(0);
    }
    if (isLineComplete(diagValues(this.grid, true))) {
      if (diagSum(this.grid, true) === MAGIC) this.correctDiags.add(1);
    }
  }

  /* ═══════════════════ Solved check (matches iOS allCorrect) ════ */

  private checkSolved(): void {
    // All cells must be filled
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        if (this.grid[r][c] == null) return;

    if (this.correctRows.size !== N) return;
    if (this.correctCols.size !== N) return;
    if (this.correctDiags.size !== 2) return;

    this.isSolved = true;
    this.showStatus('THE SQUARE IS BALANCED \u2014 HARMONY ACHIEVED', C_SUCCESS);

    // Hide interactive elements
    if (this.numberTrayEl) this.numberTrayEl.style.display = 'none';
    if (this.hintBtnEl) this.hintBtnEl.style.display = 'none';

    this.drawBoard();
    setTimeout(() => this.onSolved?.(), 1000);
  }

  /* ═══════════════════ Hint system (matches iOS) ════════════════ */

  private get canUseHint(): boolean {
    if (this.isSolved || this.solutionGrid.length === 0) return false;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        if (!this.given[r][c] && this.grid[r][c] !== this.solutionGrid[r][c]) return true;
    return false;
  }

  private handleHintTap(): void {
    if (!this.canUseHint) return;
    if (this.hintsUsed >= 3 && !this.hintPenaltyAcknowledged) {
      this.showHintWarning();
    } else {
      this.executeHint();
    }
  }

  private executeHint(): void {
    if (this.solutionGrid.length === 0) return;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!this.given[r][c] && this.grid[r][c] !== this.solutionGrid[r][c]) {
          this.hintsUsed++;
          this.grid[r][c] = this.solutionGrid[r][c];
          this.lastHintPos = { row: r, col: c };
          this.selected = null;
          this.recalcSums();
          this.drawBoard();
          this.refreshUI();

          // Clear hint flash after delay (matches iOS 0.6s)
          window.clearTimeout(this.hintFlashTimer);
          this.hintFlashTimer = window.setTimeout(() => {
            if (this.lastHintPos?.row === r && this.lastHintPos?.col === c) {
              this.lastHintPos = null;
              this.drawBoard();
            }
          }, 600);

          // Check completion after hint
          this.checkSolved();
          return;
        }
      }
    }
  }

  private showHintWarning(): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '300px', width: '90%', padding: '20px', textAlign: 'center',
      background: `linear-gradient(to bottom, ${C_BG}, ${C_CELL_BG})`,
      border: `1.5px solid rgba(212,175,55,0.4)`,
      borderRadius: '16px', boxShadow: `0 0 20px rgba(212,175,55,0.15)`,
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      animation: 'loshu-pop 0.25s ease-out',
    });

    // Warning icon
    const icon = document.createElement('div');
    icon.style.fontSize = '32px';
    icon.textContent = '\u26A0\uFE0F';
    card.appendChild(icon);

    // Title
    const warnTitle = document.createElement('div');
    Object.assign(warnTitle.style, { color: C_CRIMSON, fontSize: '16px', fontWeight: '700', margin: '8px 0' });
    warnTitle.textContent = 'Hint Warning';
    card.appendChild(warnTitle);

    // Message
    const msg = document.createElement('div');
    Object.assign(msg.style, { color: `${C_CREAM}cc`, fontSize: '13px', margin: '0 0 16px', lineHeight: '1.5' });
    msg.textContent = 'Using more hints will reduce your score. Are you sure you want to continue?';
    card.appendChild(msg);

    // Buttons
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '12px' });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      flex: '1', padding: '10px', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit',
      color: `${C_CREAM}99`, background: 'rgba(107,66,38,0.3)',
      border: '1px solid rgba(212,175,55,0.2)', borderRadius: '10px', cursor: 'pointer',
    });
    cancelBtn.addEventListener('click', () => { this.overlayEl!.style.display = 'none'; });
    btnRow.appendChild(cancelBtn);

    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.textContent = 'Continue';
    Object.assign(continueBtn.style, {
      flex: '1', padding: '10px', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
      color: C_GOLD, background: 'rgba(107,66,38,0.3)',
      border: '1px solid rgba(212,175,55,0.3)', borderRadius: '10px', cursor: 'pointer',
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

  /* ═══════════════════ UI refresh ════════════════════════════════ */

  private refreshUI(): void {
    // Update number tray availability (matches iOS: used numbers dimmed)
    if (this.numberTrayEl) {
      const btns = this.numberTrayEl.querySelectorAll<HTMLButtonElement>('button[data-digit]');
      btns.forEach(btn => {
        const d = parseInt(btn.dataset.digit!, 10);
        const used = this.isNumberUsed(d);
        btn.style.opacity = used ? '0.2' : '1';
        btn.style.cursor = (used || !this.selected) ? 'default' : 'pointer';
        btn.style.color = used ? `${C_CREAM}33` : C_CREAM;
        btn.style.background = used ? 'rgba(42,26,10,0.3)' : 'rgba(46,139,87,0.35)';
        btn.style.borderColor = used ? 'rgba(107,66,38,0.2)' : 'rgba(46,139,87,0.6)';
      });
    }

    // Hint button state
    if (this.hintBtnEl) {
      this.hintBtnEl.style.opacity = this.canUseHint ? '1' : '0.3';
      this.hintBtnEl.style.cursor = this.canUseHint ? 'pointer' : 'default';
      this.hintBtnEl.style.display = this.isSolved ? 'none' : 'inline-block';
    }

    // Status
    if (this.statusEl && !this.isSolved) {
      const blanks = this.countBlanks();
      if (blanks === 0) {
        // All filled but not correct yet
        const allCorrect = this.correctRows.size === N && this.correctCols.size === N && this.correctDiags.size === 2;
        if (!allCorrect) {
          this.showStatus('Check the harmony of the square...', `${C_CREAM}cc`);
        }
      } else if (this.selected) {
        this.showStatus('Choose a number to place', `${C_CREAM}aa`);
      } else {
        this.showStatus(`${blanks} cell${blanks === 1 ? '' : 's'} to fill`, `${C_CREAM}aa`);
      }
    }
  }

  private countBlanks(): number {
    let n = 0;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        if (this.grid[r][c] == null) n++;
    return n;
  }

  private showStatus(msg: string, color: string): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.style.color = color;
  }

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    window.clearTimeout(this.hintFlashTimer);
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('loshu-anims');
    if (animStyle) animStyle.remove();
    this.ctx2d = null;
    this.overlayEl = null;
    this.statusEl = null;
    this.numberTrayEl = null;
    this.hintBtnEl = null;
    super.dispose();
  }
}
