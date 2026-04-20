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
 * Latin Square — Euler's Officers Problem.
 * 7 difficulty levels: grid sizes 3–6, with optional color (Graeco-Latin) constraint.
 * Each row/column must have unique numbers AND (at higher levels) unique colors.
 * Aligned with iOS LatinSquareView.swift implementation.
 */

/* ── Cell model ──────────────────────────────────────────────────── */

interface LSCell {
  number: number | null;
  colorIndex: number | null;
  isFixed: boolean;
}

function makeCell(number: number | null = null, colorIndex: number | null = null, isFixed = false): LSCell {
  return { number, colorIndex, isFixed };
}

/* ── Level configuration (matches iOS LSConfig) ──────────────────── */

interface LSConfig {
  size: number;
  useColors: boolean;
  prefilled: number;
  hint: string;
}

function configForLevel(level: number): LSConfig {
  switch (level) {
    case 1: return { size: 3, useColors: false, prefilled: 4, hint: 'Each row and column must contain 1–3 exactly once.' };
    case 2: return { size: 4, useColors: false, prefilled: 6, hint: 'Look for rows or columns missing only one number.' };
    case 3: return { size: 4, useColors: true, prefilled: 6, hint: 'Each color must also appear once per row and column.' };
    case 4: return { size: 5, useColors: true, prefilled: 8, hint: 'No two cells may share both the same number and color.' };
    case 5: return { size: 5, useColors: true, prefilled: 6, hint: 'Start from the most constrained row or column.' };
    case 6: return { size: 6, useColors: false, prefilled: 10, hint: 'A 6×6 Latin square — systematic elimination helps.' };
    default: return { size: 6, useColors: false, prefilled: 8, hint: 'Euler proved no 6×6 Graeco-Latin square exists.' };
  }
}

/* ── Colors (Enlightenment dark salon palette, matches iOS) ──────── */

const C_GOLD = '#C4944A';
const C_DEEP_BLUE = '#2B4570';
const C_CREAM = '#F0E6D3';
const C_NAVY = '#0D1520';
const C_CANDLE = '#FFD700';
const C_ERROR = '#FF4444';

const CELL_COLORS = [
  '#E8C44A', // Bright gold-yellow
  '#4A90D9', // Clear blue
  '#D94A5C', // Vivid crimson-rose
  '#3DB87A', // Emerald green
  '#A85CC8', // Rich violet
  '#E87830', // Bright orange
];

/* ── Shuffle utility ─────────────────────────────────────────────── */

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ── Grid generation (matches iOS cyclic + hardcoded n=4 logic) ─── */

function transposeGrid(g: LSCell[][]): LSCell[][] {
  if (g.length === 0) return g;
  const n = g.length;
  const result: LSCell[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => makeCell()));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      result[c][r] = { ...g[r][c] };
    }
  }
  return result;
}

function generateSolution(config: LSConfig): LSCell[][] {
  const { size, useColors } = config;
  let numGrid: number[][];
  let colGrid: (number | null)[][];

  if (size === 4 && useColors) {
    // Hardcoded orthogonal Latin square pair for n=4
    numGrid = [
      [1, 2, 3, 4],
      [2, 1, 4, 3],
      [3, 4, 1, 2],
      [4, 3, 2, 1],
    ];
    colGrid = [
      [0, 1, 2, 3],
      [3, 2, 1, 0],
      [1, 0, 3, 2],
      [2, 3, 0, 1],
    ];
  } else {
    // Cyclic construction
    const k = size === 3 ? 2 : size === 5 ? 2 : 3;
    numGrid = [];
    colGrid = [];
    for (let r = 0; r < size; r++) {
      const numRow: number[] = [];
      const colRow: (number | null)[] = [];
      for (let c = 0; c < size; c++) {
        numRow.push((r + c) % size + 1);
        colRow.push(useColors ? (r + k * c) % size : null);
      }
      numGrid.push(numRow);
      colGrid.push(colRow);
    }
  }

  // Build cell grid
  let grid: LSCell[][] = [];
  for (let r = 0; r < size; r++) {
    const row: LSCell[] = [];
    for (let c = 0; c < size; c++) {
      row.push(makeCell(numGrid[r][c], colGrid[r][c], true));
    }
    grid.push(row);
  }

  // Shuffle rows then columns
  grid = shuffle(grid);
  let transposed = transposeGrid(grid);
  transposed = shuffle(transposed);
  return transposeGrid(transposed);
}

function generateGridWithSolution(config: LSConfig): { puzzle: LSCell[][]; solution: LSCell[][] } {
  const solution = generateSolution(config);
  const { size, prefilled } = config;

  const grid: LSCell[][] = solution.map(row =>
    row.map(cell => makeCell(cell.number, cell.colorIndex, true))
  );

  // Remove cells to create puzzle
  const positions: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      positions.push([r, c]);
    }
  }
  const shuffled = shuffle(positions);
  const toRemove = size * size - prefilled;
  for (let i = 0; i < Math.min(toRemove, shuffled.length); i++) {
    const [r, c] = shuffled[i];
    grid[r][c] = makeCell(null, null, false);
  }

  return { puzzle: grid, solution };
}

/* ── Puzzle class ─────────────────────────────────────────────────── */

export class LatinSquarePuzzle extends Puzzle {
  readonly title = 'LATIN SQUARE';
  readonly subtitle = "euler's officers";
  readonly instructions =
    'Fill the grid so each row and column contains every number exactly once. At higher levels, each color must also be unique per row/column.';

  private level = 4;
  private config: LSConfig = configForLevel(4);
  private grid: LSCell[][] = [];
  private solutionGrid: LSCell[][] = [];
  private selected: [number, number] | null = null;
  private conflicts = new Set<string>();
  private phase: 'playing' | 'won' | 'lost' = 'playing';
  private localHintsUsed = 0;
  private lastHintPos: [number, number] | null = null;
  private hintFlashTimer = 0;

  // DOM
  private root: HTMLDivElement | null = null;
  private gridEl: HTMLDivElement | null = null;
  private numberPadEl: HTMLDivElement | null = null;
  private colorPadEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  setLevel(lvl: number): void {
    this.level = Math.max(1, Math.min(7, lvl));
    this.config = configForLevel(this.level);
  }

  init(): void {
    this.buildBackdrop();
    this.setupLevel();
    this.buildDom();
    this.refresh();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color(C_NAVY), roughness: 0.7, metalness: 0.18, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color(C_GOLD), emissive: new Color('#2a1a0a'),
        emissiveIntensity: 0.45, roughness: 0.4, metalness: 0.85, side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const candle = new PointLight('#ffd79a', 2.2, 24, 1.6);
    candle.position.set(0, 6, 4);
    this.group.add(candle);
  }

  /* ═══════════════════ Game logic ════════════════════════════════ */

  private setupLevel(): void {
    const { puzzle, solution } = generateGridWithSolution(this.config);
    this.grid = puzzle;
    this.solutionGrid = solution;
    this.phase = 'playing';
    this.selected = null;
    this.conflicts = new Set();
    this.localHintsUsed = 0;
    this.lastHintPos = null;
    this.isSolved = false;
  }

  private pickNumber(num: number): void {
    if (this.phase !== 'playing' || !this.selected) return;
    const [r, c] = this.selected;
    if (this.grid[r][c].isFixed) return;
    this.grid[r][c].number = num;
    this.updateConflicts();
    this.refresh();
  }

  private clearNumber(): void {
    if (this.phase !== 'playing' || !this.selected) return;
    const [r, c] = this.selected;
    if (this.grid[r][c].isFixed) return;
    this.grid[r][c].number = null;
    this.updateConflicts();
    this.refresh();
  }

  private pickColor(colorIdx: number): void {
    if (this.phase !== 'playing' || !this.selected) return;
    const [r, c] = this.selected;
    if (this.grid[r][c].isFixed) return;
    this.grid[r][c].colorIndex = colorIdx;
    this.updateConflicts();
    this.refresh();
  }

  private clearColor(): void {
    if (this.phase !== 'playing' || !this.selected) return;
    const [r, c] = this.selected;
    if (this.grid[r][c].isFixed) return;
    this.grid[r][c].colorIndex = null;
    this.updateConflicts();
    this.refresh();
  }

  private updateConflicts(): void {
    const newConflicts = new Set<string>();
    const n = this.config.size;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const num = this.grid[r][c].number;
        if (num == null) continue;
        // Row duplicate number
        for (let c2 = 0; c2 < n; c2++) {
          if (c2 !== c && this.grid[r][c2].number === num) {
            newConflicts.add(`${r},${c}`);
            newConflicts.add(`${r},${c2}`);
          }
        }
        // Column duplicate number
        for (let r2 = 0; r2 < n; r2++) {
          if (r2 !== r && this.grid[r2][c].number === num) {
            newConflicts.add(`${r},${c}`);
            newConflicts.add(`${r2},${c}`);
          }
        }
        // Color constraints
        if (this.config.useColors) {
          const col = this.grid[r][c].colorIndex;
          if (col != null) {
            // Row duplicate color
            for (let c2 = 0; c2 < n; c2++) {
              if (c2 !== c && this.grid[r][c2].colorIndex === col) {
                newConflicts.add(`${r},${c}`);
                newConflicts.add(`${r},${c2}`);
              }
            }
            // Column duplicate color
            for (let r2 = 0; r2 < n; r2++) {
              if (r2 !== r && this.grid[r2][c].colorIndex === col) {
                newConflicts.add(`${r},${c}`);
                newConflicts.add(`${r2},${c}`);
              }
            }
            // Graeco-Latin constraint: no duplicate (number, color) pair
            for (let r2 = 0; r2 < n; r2++) {
              for (let c2 = 0; c2 < n; c2++) {
                if (r2 === r && c2 === c) continue;
                if (this.grid[r2][c2].number === num && this.grid[r2][c2].colorIndex === col) {
                  newConflicts.add(`${r},${c}`);
                  newConflicts.add(`${r2},${c2}`);
                }
              }
            }
          }
        }
      }
    }
    this.conflicts = newConflicts;
  }

  private isGridComplete(): boolean {
    const n = this.config.size;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (this.grid[r][c].number == null) return false;
        if (this.config.useColors && this.grid[r][c].colorIndex == null) return false;
      }
    }
    return true;
  }

  private checkSolution(): void {
    if (this.phase !== 'playing') return;
    const n = this.config.size;

    // Check all cells filled
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (this.grid[r][c].number == null) {
          this.showFeedback('Fill all cells before checking.', C_ERROR);
          this.shakeGrid();
          return;
        }
        if (this.config.useColors && this.grid[r][c].colorIndex == null) {
          this.showFeedback('Assign a color to every cell.', C_ERROR);
          this.shakeGrid();
          return;
        }
      }
    }

    this.updateConflicts();
    if (this.conflicts.size === 0) {
      this.phase = 'won';
      this.isSolved = true;
      this.refresh();
      this.showResultOverlay(true);
      setTimeout(() => this.onSolved?.(), 1200);
    } else {
      this.showFeedback('Conflicts remain — check highlighted cells.', C_ERROR);
      this.shakeGrid();
    }
  }

  private executeHint(): void {
    if (this.phase !== 'playing') return;
    const n = this.config.size;
    if (this.solutionGrid.length !== n) return;

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (this.grid[r][c].isFixed) continue;
        const needsNumber = this.grid[r][c].number == null;
        const needsColor = this.config.useColors && this.grid[r][c].colorIndex == null;
        if (needsNumber || needsColor) {
          this.localHintsUsed++;
          if (needsNumber) this.grid[r][c].number = this.solutionGrid[r][c].number;
          if (needsColor) this.grid[r][c].colorIndex = this.solutionGrid[r][c].colorIndex;
          this.lastHintPos = [r, c];
          this.updateConflicts();
          this.refresh();

          // Clear flash
          if (this.hintFlashTimer) clearTimeout(this.hintFlashTimer);
          this.hintFlashTimer = window.setTimeout(() => {
            this.lastHintPos = null;
            this.refresh();
          }, 600);

          // Auto-check if complete
          if (this.isGridComplete()) {
            setTimeout(() => this.checkSolution(), 400);
          }
          return;
        }
      }
    }
  }

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-latin-square';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: 'rgba(13,21,32,0.92)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(196,148,74,0.25)', borderTop: `3px solid ${C_GOLD}`,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_CREAM,
      maxHeight: '96vh', overflowY: 'auto',
    });
    root.appendChild(panel);

    // Header with level + hint button
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center',
    });

    const levelLabel = document.createElement('div');
    Object.assign(levelLabel.style, { fontSize: '12px', letterSpacing: '0.12em', color: `${C_CREAM}99` });
    levelLabel.textContent = `LEVEL ${this.level}`;
    header.appendChild(levelLabel);

    const titleEl = document.createElement('div');
    Object.assign(titleEl.style, { fontSize: '16px', letterSpacing: '0.22em', color: C_GOLD, fontWeight: '700' });
    titleEl.textContent = 'LATIN SQUARE';
    header.appendChild(titleEl);

    const hintBtn = document.createElement('button');
    hintBtn.type = 'button';
    hintBtn.textContent = '💡';
    Object.assign(hintBtn.style, {
      background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer',
      opacity: '0.85', padding: '4px 8px',
    });
    hintBtn.addEventListener('click', () => this.executeHint());
    header.appendChild(hintBtn);
    panel.appendChild(header);

    // Instruction card
    const instrCard = document.createElement('div');
    Object.assign(instrCard.style, {
      fontSize: '13px', textAlign: 'center', padding: '8px 16px',
      background: `${C_DEEP_BLUE}80`, borderRadius: '8px',
      border: `1px solid ${C_GOLD}33`, color: C_CREAM, lineHeight: '1.4',
    });
    instrCard.textContent = this.config.useColors
      ? 'Each row and column must have unique numbers AND unique colors.'
      : `Fill the ${this.config.size}×${this.config.size} grid: each row and column must contain 1–${this.config.size} exactly once.`;
    panel.appendChild(instrCard);

    // Status / feedback
    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, {
      fontSize: '12px', textAlign: 'center', minHeight: '18px',
      padding: '4px 10px', borderRadius: '5px', transition: 'opacity 0.2s',
    });
    panel.appendChild(this.statusEl);

    // Grid container
    this.gridEl = document.createElement('div');
    Object.assign(this.gridEl.style, {
      display: 'grid',
      gridTemplateColumns: `repeat(${this.config.size}, 1fr)`,
      gridTemplateRows: `repeat(${this.config.size}, 1fr)`,
      gap: '2px', padding: '10px', borderRadius: '10px',
      background: `linear-gradient(to bottom, ${C_DEEP_BLUE}b3, ${C_DEEP_BLUE}80)`,
      border: `1px solid ${C_GOLD}4d`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    });
    panel.appendChild(this.gridEl);

    // Color palette (if using colors)
    if (this.config.useColors) {
      const colorSection = document.createElement('div');
      Object.assign(colorSection.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' });

      const colorLabel = document.createElement('div');
      Object.assign(colorLabel.style, { fontSize: '10px', fontWeight: '500', color: `${C_GOLD}80`, letterSpacing: '0.08em' });
      colorLabel.textContent = 'PICK COLOR';
      colorSection.appendChild(colorLabel);

      this.colorPadEl = document.createElement('div');
      Object.assign(this.colorPadEl.style, { display: 'flex', gap: '6px', alignItems: 'center' });
      colorSection.appendChild(this.colorPadEl);
      panel.appendChild(colorSection);
    }

    // Number picker
    const numSection = document.createElement('div');
    Object.assign(numSection.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' });

    const numLabel = document.createElement('div');
    Object.assign(numLabel.style, { fontSize: '10px', fontWeight: '500', color: `${C_GOLD}80`, letterSpacing: '0.08em' });
    numLabel.textContent = 'PICK NUMBER';
    numSection.appendChild(numLabel);

    this.numberPadEl = document.createElement('div');
    Object.assign(this.numberPadEl.style, { display: 'flex', gap: '4px', alignItems: 'center' });
    numSection.appendChild(this.numberPadEl);
    panel.appendChild(numSection);

    // Overlay (for result)
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    // Inject animation keyframe
    if (!document.getElementById('ls-anims')) {
      const style = document.createElement('style');
      style.id = 'ls-anims';
      style.textContent = `
        @keyframes ls-pop { from { transform: scale(0.92); opacity:0; } to { transform: scale(1); opacity:1; } }
        @keyframes ls-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(8px)} 50%{transform:translateX(-6px)} 75%{transform:translateX(4px)} }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(root);
  }

  /* ═══════════════════ Rendering ═════════════════════════════════ */

  private refresh(): void {
    this.renderGrid();
    this.renderNumberPad();
    if (this.config.useColors) this.renderColorPad();
  }

  private cellSize(): number {
    const maxW = Math.min(window.innerWidth - 80, 400);
    const n = this.config.size;
    const gaps = (n - 1) * 2;
    return Math.min(Math.floor((maxW - gaps - 20) / n), 60);
  }

  private renderGrid(): void {
    if (!this.gridEl) return;
    this.gridEl.innerHTML = '';
    const n = this.config.size;
    const cs = this.cellSize();
    this.gridEl.style.gridTemplateColumns = `repeat(${n}, ${cs}px)`;
    this.gridEl.style.gridTemplateRows = `repeat(${n}, ${cs}px)`;

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cell = this.grid[r][c];
        const isSelected = this.selected !== null && this.selected[0] === r && this.selected[1] === c;
        const hasConflict = this.conflicts.has(`${r},${c}`);
        const isHintFlash = this.lastHintPos !== null && this.lastHintPos[0] === r && this.lastHintPos[1] === c;

        const btn = document.createElement('button');
        btn.type = 'button';

        // Background
        let bg: string;
        if (isHintFlash) bg = `${C_CANDLE}4d`;
        else if (isSelected) bg = `${C_CANDLE}26`;
        else if (cell.isFixed) bg = `${C_DEEP_BLUE}99`;
        else if (cell.number != null) bg = `${C_GOLD}14`;
        else bg = `${C_NAVY}80`;

        // Border
        let border: string;
        if (hasConflict) border = `2.5px solid ${C_ERROR}e6`;
        else if (isSelected) border = `2px solid ${C_CANDLE}cc`;
        else border = `0.5px solid ${C_GOLD}${cell.isFixed ? '26' : '1a'}`;

        Object.assign(btn.style, {
          width: `${cs}px`, height: `${cs}px`,
          background: bg, border,
          borderRadius: '5px', cursor: cell.isFixed || this.isSolved ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', padding: '0', overflow: 'hidden',
          fontFamily: "'Rajdhani', system-ui, sans-serif",
          transition: 'background 0.15s, border-color 0.15s',
        });

        // Color rosette indicator (canvas-drawn)
        if (this.config.useColors && cell.colorIndex != null) {
          const colorCanvas = document.createElement('canvas');
          const csize = cs * 2;
          colorCanvas.width = csize;
          colorCanvas.height = csize;
          Object.assign(colorCanvas.style, {
            position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none',
          });
          const ctx = colorCanvas.getContext('2d')!;
          ctx.scale(2, 2);
          const cx = cs / 2, cy = cs / 2;
          const pr = Math.min(cs, cs) * 0.42;
          const color = CELL_COLORS[cell.colorIndex];
          // Draw 6 petals
          for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            ctx.beginPath();
            ctx.ellipse(
              cx + Math.cos(angle) * pr * 0.3,
              cy + Math.sin(angle) * pr * 0.3,
              pr * 0.25, pr * 0.25, 0, 0, Math.PI * 2
            );
            ctx.fillStyle = color + '4d'; // 0.3 opacity
            ctx.fill();
          }
          // Center dot
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, Math.PI * 2);
          ctx.fillStyle = color + 'b3'; // 0.7 opacity
          ctx.fill();
          btn.appendChild(colorCanvas);
        }

        // Number text
        if (cell.number != null) {
          const numEl = document.createElement('span');
          Object.assign(numEl.style, {
            fontSize: `${cs * 0.4}px`,
            fontWeight: cell.isFixed ? '700' : '500',
            color: cell.isFixed ? C_CREAM : `${C_CREAM}d9`,
            position: 'relative', zIndex: '1',
          });
          numEl.textContent = String(cell.number);
          btn.appendChild(numEl);
        }

        btn.addEventListener('click', () => {
          if (cell.isFixed || this.isSolved) return;
          if (isSelected) {
            this.selected = null;
          } else {
            this.selected = [r, c];
          }
          this.refresh();
        });

        this.gridEl.appendChild(btn);
      }
    }
  }

  private renderNumberPad(): void {
    if (!this.numberPadEl) return;
    this.numberPadEl.innerHTML = '';
    const n = this.config.size;

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = '✕';
    Object.assign(clearBtn.style, {
      width: '36px', height: '36px',
      background: 'transparent', border: `1px solid ${C_GOLD}33`,
      color: `${C_CREAM}66`, borderRadius: '7px', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '12px', fontWeight: '500',
    });
    clearBtn.addEventListener('click', () => this.clearNumber());
    this.numberPadEl.appendChild(clearBtn);

    // Number buttons
    for (let num = 1; num <= n; num++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(num);
      Object.assign(b.style, {
        width: '36px', height: '36px',
        background: `${C_DEEP_BLUE}99`, border: `1px solid ${C_GOLD}33`,
        color: C_CREAM, borderRadius: '7px', cursor: 'pointer',
        fontFamily: 'inherit', fontSize: '16px', fontWeight: '700',
        transition: 'background 0.15s',
      });
      b.addEventListener('mouseenter', () => { b.style.background = `${C_DEEP_BLUE}ff`; });
      b.addEventListener('mouseleave', () => { b.style.background = `${C_DEEP_BLUE}99`; });
      b.addEventListener('click', () => this.pickNumber(num));
      this.numberPadEl.appendChild(b);
    }

    // Check/submit button
    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    Object.assign(checkBtn.style, {
      width: '36px', height: '36px',
      background: 'transparent', border: `1px solid ${C_GOLD}66`,
      borderRadius: '7px', cursor: 'pointer', position: 'relative',
    });
    // Draw checkmark via canvas
    const checkCanvas = document.createElement('canvas');
    checkCanvas.width = 72;
    checkCanvas.height = 72;
    Object.assign(checkCanvas.style, { width: '100%', height: '100%' });
    const cctx = checkCanvas.getContext('2d')!;
    cctx.scale(2, 2);
    cctx.strokeStyle = C_GOLD;
    cctx.lineWidth = 2.5;
    cctx.lineCap = 'round';
    cctx.lineJoin = 'round';
    // Circle
    cctx.beginPath();
    cctx.arc(18, 18, 13, 0, Math.PI * 2);
    cctx.globalAlpha = 0.4;
    cctx.stroke();
    // Checkmark
    cctx.globalAlpha = 1;
    cctx.beginPath();
    cctx.moveTo(11, 19);
    cctx.lineTo(17, 25);
    cctx.lineTo(26, 12);
    cctx.stroke();
    checkBtn.appendChild(checkCanvas);
    checkBtn.addEventListener('click', () => this.checkSolution());
    this.numberPadEl.appendChild(checkBtn);
  }

  private renderColorPad(): void {
    if (!this.colorPadEl) return;
    this.colorPadEl.innerHTML = '';
    const n = this.config.size;

    // Clear color button
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = '✕';
    Object.assign(clearBtn.style, {
      width: '30px', height: '30px',
      background: 'transparent', border: `1px solid ${C_GOLD}4d`,
      color: `${C_CREAM}66`, borderRadius: '50%', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '10px',
    });
    clearBtn.addEventListener('click', () => this.clearColor());
    this.colorPadEl.appendChild(clearBtn);

    // Color circles
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      Object.assign(b.style, {
        width: '30px', height: '30px',
        background: CELL_COLORS[i], border: `1px solid ${C_GOLD}59`,
        borderRadius: '50%', cursor: 'pointer',
        transition: 'transform 0.1s',
      });
      b.addEventListener('mouseenter', () => { b.style.transform = 'scale(1.15)'; });
      b.addEventListener('mouseleave', () => { b.style.transform = 'scale(1)'; });
      b.addEventListener('click', () => this.pickColor(i));
      this.colorPadEl.appendChild(b);
    }
  }

  /* ═══════════════════ Feedback & overlays ═══════════════════════ */

  private showFeedback(msg: string, color: string): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.style.color = color;
    this.statusEl.style.background = color === C_ERROR ? 'rgba(255,68,68,0.12)' : 'transparent';
    setTimeout(() => {
      if (this.statusEl) {
        this.statusEl.textContent = '';
        this.statusEl.style.background = 'transparent';
      }
    }, 2500);
  }

  private shakeGrid(): void {
    if (!this.gridEl) return;
    this.gridEl.style.animation = 'ls-shake 0.3s ease-out';
    setTimeout(() => {
      if (this.gridEl) this.gridEl.style.animation = '';
    }, 350);
  }

  private showResultOverlay(won: boolean): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '300px', width: '90%', textAlign: 'center',
      padding: '28px 32px',
      background: `linear-gradient(to bottom, rgba(6,9,16,0.95), ${C_NAVY})`,
      border: `1px solid ${C_GOLD}4d`,
      borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      animation: 'ls-pop 0.3s ease-out',
    });

    // Seal (canvas)
    const sealCanvas = document.createElement('canvas');
    sealCanvas.width = 128;
    sealCanvas.height = 128;
    Object.assign(sealCanvas.style, { width: '64px', height: '64px', margin: '0 auto 14px' });
    const sc = sealCanvas.getContext('2d')!;
    sc.scale(2, 2);
    const cx = 32, cy = 32, radius = 28;
    const sealColor = won ? C_GOLD : '#B33333';

    // Starburst
    sc.beginPath();
    const points = 12;
    for (let i = 0; i < points * 2; i++) {
      const angle = i * Math.PI / points - Math.PI / 2;
      const pr = i % 2 === 0 ? radius : radius * 0.78;
      const px = cx + Math.cos(angle) * pr;
      const py = cy + Math.sin(angle) * pr;
      if (i === 0) sc.moveTo(px, py);
      else sc.lineTo(px, py);
    }
    sc.closePath();
    sc.fillStyle = sealColor;
    sc.fill();

    // Inner circle
    sc.beginPath();
    sc.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
    sc.strokeStyle = 'rgba(255,255,255,0.3)';
    sc.lineWidth = 1;
    sc.stroke();

    // Check or X
    sc.strokeStyle = '#ffffff';
    sc.lineWidth = 3.5;
    sc.lineCap = 'round';
    sc.lineJoin = 'round';
    if (won) {
      sc.beginPath();
      sc.moveTo(cx - 10, cy + 2);
      sc.lineTo(cx - 2, cy + 10);
      sc.lineTo(cx + 12, cy - 8);
      sc.stroke();
    } else {
      sc.lineWidth = 3;
      sc.beginPath();
      sc.moveTo(cx - 9, cy - 9);
      sc.lineTo(cx + 9, cy + 9);
      sc.stroke();
      sc.beginPath();
      sc.moveTo(cx + 9, cy - 9);
      sc.lineTo(cx - 9, cy + 9);
      sc.stroke();
    }
    card.appendChild(sealCanvas);

    // Title
    const titleEl = document.createElement('div');
    Object.assign(titleEl.style, { fontSize: '22px', fontWeight: '700', color: C_CREAM, marginBottom: '6px' });
    titleEl.textContent = won ? 'SQUARE PERFECTED' : 'NOT QUITE';
    card.appendChild(titleEl);

    // Message
    const msgEl = document.createElement('div');
    Object.assign(msgEl.style, { fontSize: '14px', color: `${C_CREAM}b3`, marginBottom: '18px', lineHeight: '1.4' });
    msgEl.textContent = won
      ? 'Euler would approve. The Latin square is complete.'
      : 'Some constraints are violated. Try again.';
    card.appendChild(msgEl);

    // Button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = won ? 'CONTINUE' : 'TRY AGAIN';
    Object.assign(btn.style, {
      padding: '10px 24px', background: `${C_GOLD}1f`,
      border: `1.5px solid ${C_GOLD}80`, color: C_GOLD,
      fontFamily: 'inherit', fontSize: '14px', fontWeight: '700', letterSpacing: '0.12em',
      borderRadius: '20px', cursor: 'pointer',
    });
    btn.addEventListener('click', () => {
      this.overlayEl!.style.display = 'none';
      if (!won) {
        this.setupLevel();
        this.rebuildGrid();
        this.refresh();
      }
    });
    card.appendChild(btn);
    this.overlayEl.appendChild(card);
  }

  private rebuildGrid(): void {
    if (!this.gridEl) return;
    this.gridEl.style.gridTemplateColumns = `repeat(${this.config.size}, 1fr)`;
    this.gridEl.style.gridTemplateRows = `repeat(${this.config.size}, 1fr)`;
  }

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    if (this.hintFlashTimer) clearTimeout(this.hintFlashTimer);
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('ls-anims');
    if (animStyle) animStyle.remove();
    this.gridEl = null;
    this.numberPadEl = null;
    this.colorPadEl = null;
    this.statusEl = null;
    this.overlayEl = null;
    super.dispose();
  }
}
