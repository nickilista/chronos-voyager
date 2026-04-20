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
 * Playfair Cipher — Wheatstone's digraph substitution. A 5×5 key square
 * (I and J share a cell) built from the keyword. For each plaintext pair:
 *   - same row → each letter becomes the one to its right (wrap)
 *   - same column → each letter becomes the one below (wrap)
 *   - rectangle → swap columns within each letter's row
 * Player is shown a plaintext pair, highlighted on the square, and must
 * tap the two enciphered cells. Three pairs = solved.
 */

const KEYWORD = 'ENIGMACODES';
const GRID_SIZE = 5;

function buildSquare(keyword: string): string[][] {
  const seen = new Set<string>();
  const letters: string[] = [];
  const up = keyword.toUpperCase().replace(/J/g, 'I');
  for (const ch of up) {
    if (ch >= 'A' && ch <= 'Z' && !seen.has(ch)) {
      seen.add(ch);
      letters.push(ch);
    }
  }
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    if (ch === 'J') continue;
    if (!seen.has(ch)) {
      seen.add(ch);
      letters.push(ch);
    }
  }
  const square: string[][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    square.push(letters.slice(r * 5, r * 5 + 5));
  }
  return square;
}

function findCell(square: string[][], letter: string): [number, number] {
  const L = letter === 'J' ? 'I' : letter;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (square[r][c] === L) return [r, c];
    }
  }
  return [0, 0];
}

function encipherPair(square: string[][], a: string, b: string): [string, string] {
  const [ar, ac] = findCell(square, a);
  const [br, bc] = findCell(square, b);
  if (ar === br) {
    return [square[ar][(ac + 1) % 5], square[br][(bc + 1) % 5]];
  }
  if (ac === bc) {
    return [square[(ar + 1) % 5][ac], square[(br + 1) % 5][bc]];
  }
  return [square[ar][bc], square[br][ac]];
}

// Plaintext digraph pool — paired letters that are distinct, avoid J,
// and when enciphered through KEYWORD produce a distinct digraph.
const PLAINTEXT_POOL: readonly string[] = [
  'AT', 'BE', 'CH', 'DO', 'EL', 'FA', 'GO', 'HI',
  'IN', 'KA', 'LO', 'MA', 'NE', 'OR', 'PA', 'QU',
  'RE', 'SO', 'TE', 'UP', 'VI', 'WE', 'XU', 'YO',
];

const ROUNDS_TO_WIN = 3;

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export class PlayfairPuzzle extends Puzzle {
  readonly title = 'PLAYFAIR';
  readonly subtitle = 'wheatstone ciphers';
  readonly instructions =
    'Each plaintext pair is highlighted in silver. Tap the two cells that encode it — same row shifts right, same column shifts down, a rectangle swaps columns.';

  private square: string[][] = buildSquare(KEYWORD);
  private plains: string[] = [];
  private ciphers: string[] = [];
  private roundIdx = 0;
  private selected: string[] = [];

  private root: HTMLDivElement | null = null;
  private gridEl: HTMLDivElement | null = null;
  private promptEl: HTMLDivElement | null = null;
  private roundEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.plains = shuffle(PLAINTEXT_POOL.slice()).slice(0, ROUNDS_TO_WIN);
    this.ciphers = this.plains.map((p) => encipherPair(this.square, p[0], p[1]).join(''));
    this.buildDom();
    this.refresh();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const floor = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#0a0d16'),
        roughness: 0.65,
        metalness: 0.25,
        side: DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    this.group.add(floor);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color('#88a0b8'),
        emissive: new Color('#10202a'),
        emissiveIntensity: 0.5,
        roughness: 0.35,
        metalness: 0.9,
        side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const lamp = new PointLight('#c0d0ee', 2.1, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-playfair';
    root.style.cssText = `
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      z-index:20; pointer-events:none; font-family:'Cormorant Garamond', Georgia, serif;
    `;
    this.root = root;

    const panel = document.createElement('div');
    panel.style.cssText = `
      display:flex; flex-direction:column; align-items:center; gap:14px;
      pointer-events:auto;
      padding:22px 28px;
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
    title.textContent = 'PLAYFAIR';
    panel.appendChild(title);

    const round = document.createElement('div');
    round.style.cssText = `font-size:11px; letter-spacing:0.3em; opacity:0.7;`;
    this.roundEl = round;
    panel.appendChild(round);

    const prompt = document.createElement('div');
    prompt.style.cssText = `
      font-family:'JetBrains Mono', 'Courier New', monospace;
      font-size:16px; letter-spacing:0.1em;
      padding:8px 16px;
      background:rgba(0,0,0,0.3); border:1px solid rgba(196,148,74,0.3);
      border-radius:4px;
    `;
    this.promptEl = prompt;
    panel.appendChild(prompt);

    const grid = document.createElement('div');
    grid.style.cssText = `
      display:grid; grid-template-columns:repeat(5, 54px); grid-template-rows:repeat(5, 54px);
      gap:4px; padding:4px; background:rgba(196,148,74,0.12); border-radius:5px;
    `;
    this.gridEl = grid;
    panel.appendChild(grid);

    const status = document.createElement('div');
    status.style.cssText = `font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;`;
    this.statusEl = status;
    panel.appendChild(status);

    document.body.appendChild(root);
  }

  /* ------------------------------ Rendering ------------------------------ */

  private refresh(): void {
    if (this.roundEl) {
      this.roundEl.textContent = `PAIR ${this.roundIdx + 1} / ${ROUNDS_TO_WIN}`;
    }
    const plain = this.plains[this.roundIdx] ?? this.plains[this.plains.length - 1];
    if (this.promptEl) {
      this.promptEl.innerHTML = `plain: <span style="color:#d8e3ef;font-weight:700">${plain[0]}${plain[1]}</span> — encipher`;
    }
    if (!this.gridEl) return;
    this.gridEl.innerHTML = '';
    const plainCells = new Set<string>();
    plainCells.add(`${plain[0]}`);
    plainCells.add(`${plain[1]}`);
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const letter = this.square[r][c];
        const btn = document.createElement('button');
        btn.type = 'button';
        const isPlain = plainCells.has(letter);
        const sel = this.selected.includes(letter);
        btn.style.cssText = `
          width:54px; height:54px;
          background:${sel ? 'rgba(196,148,74,0.5)' : isPlain ? 'rgba(216,227,239,0.25)' : 'rgba(240,230,211,0.05)'};
          border:1px solid ${sel ? 'var(--era-accent)' : isPlain ? '#d8e3ef' : 'rgba(196,148,74,0.25)'};
          color:${isPlain ? '#d8e3ef' : '#f0e6d3'};
          font-family:'JetBrains Mono', monospace;
          font-size:20px; font-weight:700;
          border-radius:4px; cursor:pointer;
        `;
        btn.textContent = letter;
        btn.disabled = this.isSolved;
        btn.addEventListener('click', () => this.tapCell(letter));
        this.gridEl.appendChild(btn);
      }
    }
    if (this.statusEl && !this.isSolved) {
      this.statusEl.textContent = 'tap the two enciphered cells';
      this.statusEl.style.color = '';
    }
  }

  private tapCell(letter: string): void {
    if (this.isSolved) return;
    if (this.selected.includes(letter)) {
      this.selected = this.selected.filter((x) => x !== letter);
      this.refresh();
      return;
    }
    if (this.selected.length >= 2) return;
    this.selected.push(letter);
    if (this.selected.length === 2) {
      this.checkPair();
      return;
    }
    this.refresh();
  }

  private checkPair(): void {
    const cipher = this.ciphers[this.roundIdx];
    const a = cipher[0];
    const b = cipher[1];
    const [s0, s1] = this.selected;
    const match = (s0 === a && s1 === b) || (s0 === b && s1 === a);
    if (!match) {
      if (this.statusEl) {
        this.statusEl.textContent = `not the cipher — correct pair was ${cipher}`;
        this.statusEl.style.color = '#e89090';
      }
      setTimeout(() => {
        this.selected = [];
        this.refresh();
      }, 1400);
      return;
    }
    this.roundIdx++;
    this.selected = [];
    if (this.roundIdx >= ROUNDS_TO_WIN) {
      this.isSolved = true;
      if (this.statusEl) {
        this.statusEl.textContent = 'THE DISPATCH IS ENCIPHERED';
        this.statusEl.style.color = '#9fe0a6';
      }
      this.refresh();
      setTimeout(() => this.onSolved?.(), 1000);
      return;
    }
    if (this.statusEl) {
      this.statusEl.textContent = 'pair enciphered — next';
      this.statusEl.style.color = '#9fe0a6';
    }
    this.refresh();
  }

  /* ------------------------------ Lifecycle ------------------------------ */

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
    this.promptEl = null;
    this.roundEl = null;
    this.statusEl = null;
    super.dispose();
  }
}
