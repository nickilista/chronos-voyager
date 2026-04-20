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
 * Lo Shu — the turtle-shell magic square. A 3×3 grid is partially filled
 * with digits 1..9; the player places the remaining six so that every row,
 * column, and diagonal sums to 15. Each digit appears exactly once.
 *
 * A 3D jade dais sits behind the DOM overlay for atmosphere. The grid and
 * digit tray are rendered as HTML buttons so the drag is instant and the
 * row/column/diagonal sum indicators can update in real time.
 */

const N = 3;
const MAGIC = 15;
const CELL_PX = 92;
const BOARD_PX = N * CELL_PX;

/** Classic Lo Shu arrangement. All eight rotations/reflections also sum to 15. */
const BASE_LOSHU: readonly (readonly number[])[] = [
  [4, 9, 2],
  [3, 5, 7],
  [8, 1, 6],
];

type Grid = number[][];

function rotate(g: Grid): Grid {
  const r: Grid = Array.from({ length: N }, () => Array(N).fill(0));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) r[x][N - 1 - y] = g[y][x];
  return r;
}

function reflect(g: Grid): Grid {
  const r: Grid = Array.from({ length: N }, () => Array(N).fill(0));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) r[y][N - 1 - x] = g[y][x];
  return r;
}

/** Pick one of the eight dihedral variants of Lo Shu as the hidden solution. */
function randomSolution(): Grid {
  let g = BASE_LOSHU.map((row) => [...row]);
  const rotations = Math.floor(Math.random() * 4);
  for (let i = 0; i < rotations; i++) g = rotate(g);
  if (Math.random() < 0.5) g = reflect(g);
  return g;
}

/**
 * Reveal three cells: the central 5 plus two corner hints. The remaining
 * six cells are blanks the player must fill. Leaving 5 visible is the iOS
 * level-2 feel (hard enough that sum reasoning is required, not a one-step
 * deduction).
 */
function maskSolution(solution: Grid): { given: boolean[][]; initial: (number | null)[][] } {
  const given: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));
  const initial: (number | null)[][] = Array.from({ length: N }, () => Array(N).fill(null));
  // Always reveal the centre (the 5) — it's the classical fulcrum and stops
  // the puzzle from being combinatorially ambiguous.
  given[1][1] = true;
  initial[1][1] = solution[1][1];
  // Reveal two random corners.
  const corners: [number, number][] = [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ];
  for (let i = corners.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [corners[i], corners[j]] = [corners[j], corners[i]];
  }
  for (let i = 0; i < 2; i++) {
    const [y, x] = corners[i];
    given[y][x] = true;
    initial[y][x] = solution[y][x];
  }
  return { given, initial };
}

export class LoShuPuzzle extends Puzzle {
  readonly title = 'LO SHU';
  readonly subtitle = 'turtle-shell square';
  readonly instructions =
    'Place every digit 1–9 so each row, column, and diagonal sums to 15. The centre fulcrum is given.';

  private solution!: Grid;
  private given!: boolean[][];
  private values!: (number | null)[][];
  private selected: { x: number; y: number } | null = null;

  private root: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private cellBtns: HTMLButtonElement[][] = [];
  private digitBtns: HTMLButtonElement[] = [];
  private rowSumEls: HTMLDivElement[] = [];
  private colSumEls: HTMLDivElement[] = [];
  private diagEls: { main: HTMLDivElement; anti: HTMLDivElement } | null = null;

  onSolved?: () => void;

  init(): void {
    this.solution = randomSolution();
    const { given, initial } = maskSolution(this.solution);
    this.given = given;
    this.values = initial;
    this.buildBackdrop();
    this.buildDom();
    this.refresh();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const dais = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#1c2a3a'),
        roughness: 0.55,
        metalness: 0.3,
        side: DoubleSide,
      }),
    );
    dais.rotation.x = -Math.PI / 2;
    dais.position.y = -2.4;
    this.group.add(dais);

    // Jade ring — Chinese dynastic decor.
    const jade = new Mesh(
      new RingGeometry(3.0, 3.18, 64),
      new MeshStandardMaterial({
        color: new Color('#4f9d7a'),
        emissive: new Color('#123225'),
        emissiveIntensity: 0.6,
        roughness: 0.35,
        metalness: 0.7,
        side: DoubleSide,
      }),
    );
    jade.rotation.x = -Math.PI / 2;
    jade.position.y = -2.38;
    this.group.add(jade);

    const lantern = new PointLight('#f4c98a', 2.0, 22, 1.6);
    lantern.position.set(0, 6, 4);
    this.group.add(lantern);
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-loshu';
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
      background:rgba(10,18,34,0.75); backdrop-filter:blur(12px);
      border:1px solid rgba(159,200,255,0.25);
      border-top:3px solid var(--era-accent);
      border-radius:10px;
      box-shadow:0 18px 60px rgba(0,0,0,0.55);
      color:#e6eefb;
    `;
    root.appendChild(panel);

    const title = document.createElement('div');
    title.style.cssText = `font-size:18px; letter-spacing:0.28em; color:var(--era-accent); font-weight:600;`;
    title.textContent = 'LO SHU';
    panel.appendChild(title);

    const sub = document.createElement('div');
    sub.style.cssText = `font-size:12px; letter-spacing:0.18em; opacity:0.7;`;
    sub.textContent = `EVERY LINE SUMS TO ${MAGIC}`;
    panel.appendChild(sub);

    // Grid container with sum sidebars. Layout:
    //    [diag anti]  [col0] [col1] [col2]
    //    [row0 sum]   [ cell ][ cell ][ cell ]
    //    [row1 sum]   [ cell ][ cell ][ cell ]
    //    [row2 sum]   [ cell ][ cell ][ cell ]
    //    [diag main]
    const SUM_W = 36;
    const GRID_W = BOARD_PX + SUM_W + 10;
    const GRID_H = BOARD_PX + 40 + 24;
    const gridBox = document.createElement('div');
    gridBox.style.cssText = `position:relative; width:${GRID_W}px; height:${GRID_H}px;`;
    panel.appendChild(gridBox);

    // Column sums across the top.
    for (let x = 0; x < N; x++) {
      const s = document.createElement('div');
      s.style.cssText = `
        position:absolute; top:2px;
        left:${SUM_W + 6 + x * CELL_PX}px; width:${CELL_PX}px;
        text-align:center; font-size:13px; letter-spacing:0.08em;
        color:rgba(255,255,255,0.55);
      `;
      gridBox.appendChild(s);
      this.colSumEls.push(s);
    }

    // Row sums along the left.
    for (let y = 0; y < N; y++) {
      const s = document.createElement('div');
      s.style.cssText = `
        position:absolute;
        top:${24 + y * CELL_PX + CELL_PX / 2 - 9}px; left:0;
        width:${SUM_W}px; text-align:right; padding-right:6px;
        font-size:13px; letter-spacing:0.08em;
        color:rgba(255,255,255,0.55);
      `;
      gridBox.appendChild(s);
      this.rowSumEls.push(s);
    }

    // Diagonal sums.
    const diagMain = document.createElement('div');
    diagMain.style.cssText = `
      position:absolute; left:${SUM_W + 6}px; top:${24 + BOARD_PX + 4}px;
      width:${BOARD_PX}px; text-align:left; padding-left:4px;
      font-size:12px; letter-spacing:0.08em;
      color:rgba(255,255,255,0.5);
    `;
    const diagAnti = document.createElement('div');
    diagAnti.style.cssText = `
      position:absolute; left:${SUM_W + 6}px; top:${24 + BOARD_PX + 4}px;
      width:${BOARD_PX}px; text-align:right; padding-right:4px;
      font-size:12px; letter-spacing:0.08em;
      color:rgba(255,255,255,0.5);
    `;
    gridBox.appendChild(diagMain);
    gridBox.appendChild(diagAnti);
    this.diagEls = { main: diagMain, anti: diagAnti };

    // Cell grid.
    for (let y = 0; y < N; y++) {
      const row: HTMLButtonElement[] = [];
      for (let x = 0; x < N; x++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = `
          position:absolute; box-sizing:border-box;
          left:${SUM_W + 6 + x * CELL_PX}px; top:${24 + y * CELL_PX}px;
          width:${CELL_PX - 4}px; height:${CELL_PX - 4}px;
          margin:2px;
          display:flex; align-items:center; justify-content:center;
          background:rgba(14,28,44,0.85);
          border:1px solid rgba(159,200,255,0.3);
          color:#f3e7c8;
          font-family:'Cormorant Garamond', Georgia, serif;
          font-size:40px; font-weight:600;
          border-radius:6px; cursor:pointer;
          transition:background 0.12s, border-color 0.12s;
        `;
        btn.addEventListener('click', () => this.onCellClick(x, y));
        gridBox.appendChild(btn);
        row.push(btn);
      }
      this.cellBtns.push(row);
    }

    // Digit tray.
    const tray = document.createElement('div');
    tray.style.cssText = `display:flex; gap:7px;`;
    panel.appendChild(tray);
    for (let d = 1; d <= 9; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(d);
      b.style.cssText = `
        width:44px; height:44px;
        background:rgba(159,200,255,0.08);
        border:1px solid rgba(159,200,255,0.35);
        color:var(--era-accent);
        font-family:'Cormorant Garamond', Georgia, serif;
        font-size:22px; font-weight:600;
        border-radius:5px; cursor:pointer;
      `;
      b.addEventListener('click', () => this.onDigitClick(d));
      tray.appendChild(b);
      this.digitBtns.push(b);
    }

    // Clear button.
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'CLEAR CELL';
    clear.style.cssText = `
      padding:7px 18px;
      background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.25);
      color:#e6eefb; opacity:0.85;
      font-family:inherit; font-size:11px; letter-spacing:0.22em; font-weight:600;
      border-radius:5px; cursor:pointer;
    `;
    clear.addEventListener('click', () => this.clearSelected());
    panel.appendChild(clear);

    const status = document.createElement('div');
    status.style.cssText = `
      font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;
    `;
    this.statusEl = status;
    panel.appendChild(status);

    document.body.appendChild(root);
  }

  /* ------------------------------ Input ---------------------------------- */

  private onCellClick(x: number, y: number): void {
    if (this.isSolved) return;
    if (this.given[y][x]) return;
    if (this.selected && this.selected.x === x && this.selected.y === y) {
      this.selected = null;
    } else {
      this.selected = { x, y };
    }
    this.refresh();
  }

  private onDigitClick(d: number): void {
    if (this.isSolved) return;
    if (!this.selected) return;
    const { x, y } = this.selected;
    if (this.given[y][x]) return;
    this.values[y][x] = d;
    // Auto-advance: clear selection so each placement feels like one action.
    this.selected = null;
    this.refresh();
    this.checkSolved();
  }

  private clearSelected(): void {
    if (!this.selected) return;
    const { x, y } = this.selected;
    if (this.given[y][x]) return;
    this.values[y][x] = null;
    this.refresh();
  }

  /* ------------------------------ Render --------------------------------- */

  private refresh(): void {
    // Cell visuals.
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const btn = this.cellBtns[y][x];
        const v = this.values[y][x];
        btn.textContent = v != null ? String(v) : '';
        const isGiven = this.given[y][x];
        const isSel = this.selected?.x === x && this.selected?.y === y;
        btn.style.color = isGiven ? '#f3e7c8' : '#fff';
        btn.style.opacity = isGiven ? '0.85' : '1';
        btn.style.background = isSel
          ? 'rgba(159,200,255,0.2)'
          : isGiven
            ? 'rgba(48,78,58,0.55)'
            : 'rgba(14,28,44,0.85)';
        btn.style.borderColor = isSel
          ? 'var(--era-accent)'
          : isGiven
            ? 'rgba(120,200,150,0.45)'
            : 'rgba(159,200,255,0.3)';
        btn.disabled = isGiven;
      }
    }

    // Digit availability — each digit appears at most once.
    const counts = new Array(10).fill(0);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const v = this.values[y][x];
        if (v != null) counts[v]++;
      }
    for (let d = 1; d <= 9; d++) {
      const btn = this.digitBtns[d - 1];
      const used = counts[d] >= 1;
      btn.style.opacity = used ? '0.28' : '1';
      btn.style.cursor = used ? 'default' : 'pointer';
    }

    // Row/col/diag sums.
    for (let y = 0; y < N; y++) {
      const partial = sumRow(this.values, y);
      this.rowSumEls[y].textContent = partial == null ? '·' : String(partial);
      this.rowSumEls[y].style.color =
        partial === MAGIC ? '#9fe0a6' : partial != null && partial > MAGIC ? '#e89090' : 'rgba(255,255,255,0.55)';
    }
    for (let x = 0; x < N; x++) {
      const partial = sumCol(this.values, x);
      this.colSumEls[x].textContent = partial == null ? '·' : String(partial);
      this.colSumEls[x].style.color =
        partial === MAGIC ? '#9fe0a6' : partial != null && partial > MAGIC ? '#e89090' : 'rgba(255,255,255,0.55)';
    }
    if (this.diagEls) {
      const main = sumDiag(this.values, false);
      const anti = sumDiag(this.values, true);
      this.diagEls.main.textContent = main == null ? '↘ ·' : `↘ ${main}`;
      this.diagEls.anti.textContent = anti == null ? '· ↙' : `${anti} ↙`;
      this.diagEls.main.style.color =
        main === MAGIC ? '#9fe0a6' : main != null && main > MAGIC ? '#e89090' : 'rgba(255,255,255,0.5)';
      this.diagEls.anti.style.color =
        anti === MAGIC ? '#9fe0a6' : anti != null && anti > MAGIC ? '#e89090' : 'rgba(255,255,255,0.5)';
    }

    if (this.statusEl) {
      const blanks = this.countBlanks();
      if (blanks === 0) {
        this.statusEl.textContent = 'check the harmony of the square';
      } else {
        this.statusEl.textContent = `${blanks} cell${blanks === 1 ? '' : 's'} to fill`;
      }
      this.statusEl.style.color = '';
    }
  }

  private countBlanks(): number {
    let n = 0;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) if (this.values[y][x] == null) n++;
    return n;
  }

  private checkSolved(): void {
    if (this.countBlanks() > 0) return;
    for (let y = 0; y < N; y++) if (sumRow(this.values, y) !== MAGIC) return;
    for (let x = 0; x < N; x++) if (sumCol(this.values, x) !== MAGIC) return;
    if (sumDiag(this.values, false) !== MAGIC) return;
    if (sumDiag(this.values, true) !== MAGIC) return;
    // Distinct digits 1..9 — a magic-sum 3×3 of 1..9 is automatically a
    // permutation when every row/col/diag hits 15, but double-check anyway.
    const seen = new Set<number>();
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const v = this.values[y][x];
        if (v == null || v < 1 || v > 9 || seen.has(v)) return;
        seen.add(v);
      }
    this.isSolved = true;
    if (this.statusEl) {
      this.statusEl.textContent = 'THE TURTLE NODS — THE SQUARE IS BALANCED';
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
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this.statusEl = null;
    this.cellBtns = [];
    this.digitBtns = [];
    this.rowSumEls = [];
    this.colSumEls = [];
    this.diagEls = null;
    super.dispose();
  }
}

function sumRow(g: (number | null)[][], y: number): number | null {
  let s = 0;
  for (let x = 0; x < N; x++) {
    const v = g[y][x];
    if (v == null) return null;
    s += v;
  }
  return s;
}

function sumCol(g: (number | null)[][], x: number): number | null {
  let s = 0;
  for (let y = 0; y < N; y++) {
    const v = g[y][x];
    if (v == null) return null;
    s += v;
  }
  return s;
}

function sumDiag(g: (number | null)[][], anti: boolean): number | null {
  let s = 0;
  for (let i = 0; i < N; i++) {
    const x = anti ? N - 1 - i : i;
    const v = g[i][x];
    if (v == null) return null;
    s += v;
  }
  return s;
}
