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
 * Latin Square — Euler's unum necessarium. A 4×4 grid; each row and column
 * must contain the symbols 1 through 4 exactly once. Six clue cells are
 * pre-filled; the other ten must be deduced.
 */

const N = 4;

type Cell = { value: number; fixed: boolean };

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function generateSolution(): number[][] {
  // Start with a cyclic 4×4 Latin square, then permute rows, columns, and symbols.
  const base: number[][] = [];
  for (let r = 0; r < N; r++) {
    const row: number[] = [];
    for (let c = 0; c < N; c++) row.push(((r + c) % N) + 1);
    base.push(row);
  }
  const rowOrder = shuffle([0, 1, 2, 3]);
  const colOrder = shuffle([0, 1, 2, 3]);
  const symMap: Record<number, number> = {};
  const syms = shuffle([1, 2, 3, 4]);
  for (let i = 0; i < 4; i++) symMap[i + 1] = syms[i];
  const out: number[][] = [];
  for (let r = 0; r < N; r++) {
    const row: number[] = [];
    for (let c = 0; c < N; c++) row.push(symMap[base[rowOrder[r]][colOrder[c]]]);
    out.push(row);
  }
  return out;
}

function generateGrid(solution: number[][], cluesCount: number): Cell[][] {
  const cells: Cell[][] = [];
  for (let r = 0; r < N; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < N; c++) row.push({ value: 0, fixed: false });
    cells.push(row);
  }
  const positions: [number, number][] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) positions.push([r, c]);
  shuffle(positions);
  for (let i = 0; i < cluesCount; i++) {
    const [r, c] = positions[i];
    cells[r][c] = { value: solution[r][c], fixed: true };
  }
  return cells;
}

export class LatinSquarePuzzle extends Puzzle {
  readonly title = 'LATIN SQUARE';
  readonly subtitle = "euler's officers";
  readonly instructions =
    'Fill the 4×4 grid so each row and column contains 1, 2, 3 and 4 exactly once. Tap a blank cell, then a digit.';

  private solution: number[][] = [];
  private grid: Cell[][] = [];
  private selected: [number, number] | null = null;

  private root: HTMLDivElement | null = null;
  private gridEl: HTMLDivElement | null = null;
  private digitPadEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private checkBtn: HTMLButtonElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.solution = generateSolution();
    this.grid = generateGrid(this.solution, 6);
    this.buildDom();
    this.refresh();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const floor = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#0d1520'),
        roughness: 0.7,
        metalness: 0.18,
        side: DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    this.group.add(floor);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color('#c4944a'),
        emissive: new Color('#2a1a0a'),
        emissiveIntensity: 0.45,
        roughness: 0.4,
        metalness: 0.85,
        side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const candle = new PointLight('#ffd79a', 2.2, 24, 1.6);
    candle.position.set(0, 6, 4);
    this.group.add(candle);
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-latin-square';
    root.style.cssText = `
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      z-index:20; pointer-events:none; font-family:'Cormorant Garamond', Georgia, serif;
    `;
    this.root = root;

    const panel = document.createElement('div');
    panel.style.cssText = `
      display:flex; flex-direction:column; align-items:center; gap:14px;
      pointer-events:auto;
      padding:22px 26px;
      background:rgba(13,21,32,0.85); backdrop-filter:blur(12px);
      border:1px solid rgba(196,148,74,0.35);
      border-top:3px solid var(--era-accent);
      border-radius:10px;
      box-shadow:0 18px 60px rgba(0,0,0,0.55);
      color:#f0e6d3;
    `;
    root.appendChild(panel);

    const title = document.createElement('div');
    title.style.cssText = `font-size:18px; letter-spacing:0.26em; color:var(--era-accent); font-weight:600;`;
    title.textContent = 'LATIN SQUARE';
    panel.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = `display:grid; grid-template-columns:repeat(4, 64px); grid-template-rows:repeat(4, 64px); gap:4px; background:rgba(196,148,74,0.15); padding:4px; border-radius:6px;`;
    this.gridEl = grid;
    panel.appendChild(grid);

    const pad = document.createElement('div');
    pad.style.cssText = `display:flex; gap:8px; justify-content:center;`;
    this.digitPadEl = pad;
    panel.appendChild(pad);

    const status = document.createElement('div');
    status.style.cssText = `font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;`;
    this.statusEl = status;
    panel.appendChild(status);

    const check = document.createElement('button');
    check.type = 'button';
    check.textContent = 'VERIFY';
    check.style.cssText = `
      padding:9px 26px;
      background:rgba(196,148,74,0.12);
      border:1px solid rgba(196,148,74,0.5);
      color:var(--era-accent);
      font-family:'Cormorant Garamond', Georgia, serif;
      font-size:14px; letter-spacing:0.3em; font-weight:600;
      border-radius:4px; cursor:pointer;
    `;
    check.addEventListener('click', () => this.verify());
    this.checkBtn = check;
    panel.appendChild(check);

    document.body.appendChild(root);
  }

  /* ------------------------------ Rendering ------------------------------ */

  private refresh(): void {
    this.renderGrid();
    this.renderPad();
    if (this.checkBtn) {
      const full = this.grid.every((row) => row.every((c) => c.value > 0));
      this.checkBtn.disabled = !full || this.isSolved;
      this.checkBtn.style.opacity = full && !this.isSolved ? '1' : '0.35';
    }
    if (this.statusEl && !this.isSolved) {
      this.statusEl.textContent = 'each row and column — one of each symbol';
      this.statusEl.style.color = '';
    }
  }

  private renderGrid(): void {
    if (!this.gridEl) return;
    this.gridEl.innerHTML = '';
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = this.grid[r][c];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.disabled = cell.fixed || this.isSolved;
        const selected = this.selected && this.selected[0] === r && this.selected[1] === c;
        btn.style.cssText = `
          width:64px; height:64px;
          background:${cell.fixed ? 'rgba(196,148,74,0.28)' : selected ? 'rgba(196,148,74,0.18)' : 'rgba(240,230,211,0.04)'};
          border:1px solid ${selected ? 'var(--era-accent)' : 'rgba(196,148,74,0.25)'};
          color:${cell.fixed ? 'var(--era-accent)' : '#f0e6d3'};
          font-family:'Cormorant Garamond', Georgia, serif;
          font-size:24px; font-weight:${cell.fixed ? '700' : '500'};
          border-radius:4px; cursor:${cell.fixed ? 'default' : 'pointer'};
        `;
        btn.textContent = cell.value ? String(cell.value) : '';
        btn.addEventListener('click', () => {
          if (cell.fixed || this.isSolved) return;
          this.selected = [r, c];
          this.refresh();
        });
        this.gridEl.appendChild(btn);
      }
    }
  }

  private renderPad(): void {
    if (!this.digitPadEl) return;
    this.digitPadEl.innerHTML = '';
    for (let d = 1; d <= N; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(d);
      b.disabled = !this.selected || this.isSolved;
      b.style.cssText = `
        width:52px; height:52px;
        background:rgba(196,148,74,0.08);
        border:1px solid rgba(196,148,74,0.4);
        color:#f0e6d3;
        font-family:inherit; font-size:20px; font-weight:700;
        border-radius:5px; cursor:pointer;
        opacity:${this.selected ? '1' : '0.4'};
      `;
      b.addEventListener('click', () => {
        if (!this.selected) return;
        const [r, c] = this.selected;
        this.grid[r][c].value = d;
        this.refresh();
      });
      this.digitPadEl.appendChild(b);
    }
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = '✕';
    clear.disabled = !this.selected || this.isSolved;
    clear.style.cssText = `
      width:52px; height:52px;
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.22);
      color:#f0e6d3;
      font-family:inherit; font-size:16px;
      border-radius:5px; cursor:pointer;
      opacity:${this.selected ? '1' : '0.4'};
    `;
    clear.addEventListener('click', () => {
      if (!this.selected) return;
      const [r, c] = this.selected;
      this.grid[r][c].value = 0;
      this.refresh();
    });
    this.digitPadEl.appendChild(clear);
  }

  /* ------------------------------ Solve ---------------------------------- */

  private isValid(): boolean {
    for (let r = 0; r < N; r++) {
      const seen = new Set<number>();
      for (let c = 0; c < N; c++) {
        const v = this.grid[r][c].value;
        if (v < 1 || v > N || seen.has(v)) return false;
        seen.add(v);
      }
    }
    for (let c = 0; c < N; c++) {
      const seen = new Set<number>();
      for (let r = 0; r < N; r++) {
        const v = this.grid[r][c].value;
        if (seen.has(v)) return false;
        seen.add(v);
      }
    }
    return true;
  }

  private verify(): void {
    if (this.isValid()) {
      this.isSolved = true;
      if (this.statusEl) {
        this.statusEl.textContent = 'THE ARRAY IS PERFECTED';
        this.statusEl.style.color = '#9fe0a6';
      }
      setTimeout(() => this.onSolved?.(), 1000);
    } else {
      if (this.statusEl) {
        this.statusEl.textContent = 'a row or column repeats — try again';
        this.statusEl.style.color = '#e89090';
      }
    }
  }

  /* -------------------------- Lifecycle ---------------------------------- */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this.gridEl = null;
    this.digitPadEl = null;
    this.statusEl = null;
    this.checkBtn = null;
    super.dispose();
  }
}
