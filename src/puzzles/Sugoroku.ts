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
 * Sugoroku (双六) — Edo-era race board. The player walks a serpentine
 * path from Edo to the shrine (15 spaces). Each turn rolls a single die;
 * landing on a torii gate triggers a mental-arithmetic challenge — answer
 * correctly to stay, fail and the wave carries you back three spaces.
 * Reach the shrine to pass.
 */

const BOARD_COLS = 5;
const BOARD_ROWS = 3;
const TOTAL = BOARD_COLS * BOARD_ROWS;
const FINISH = TOTAL - 1; // 14
const CELL_PX = 74;

type SpaceType = 'start' | 'path' | 'torii' | 'sakura' | 'wave' | 'finish';

interface Question {
  readonly text: string;
  readonly options: readonly number[];
  readonly correct: number;
}

function generateQuestion(): Question {
  const kind = Math.floor(Math.random() * 3);
  let text = '';
  let correct = 0;
  if (kind === 0) {
    const a = 10 + Math.floor(Math.random() * 40);
    const b = 5 + Math.floor(Math.random() * 40);
    correct = a + b;
    text = `${a} + ${b} = ?`;
  } else if (kind === 1) {
    const a = 30 + Math.floor(Math.random() * 70);
    const b = 5 + Math.floor(Math.random() * 25);
    correct = a - b;
    text = `${a} − ${b} = ?`;
  } else {
    const a = 3 + Math.floor(Math.random() * 9);
    const b = 3 + Math.floor(Math.random() * 9);
    correct = a * b;
    text = `${a} × ${b} = ?`;
  }
  const distractors = new Set<number>();
  while (distractors.size < 3) {
    const delta = (Math.floor(Math.random() * 10) - 5) + (Math.random() < 0.5 ? 1 : -1);
    const v = correct + delta;
    if (v !== correct && v >= 0) distractors.add(v);
  }
  const options = [...distractors, correct].sort(() => Math.random() - 0.5);
  return { text, options, correct };
}

function spaceTypeFor(i: number): SpaceType {
  if (i === 0) return 'start';
  if (i === FINISH) return 'finish';
  // Fixed layout for replay consistency.
  const toriis = new Set([2, 5, 8, 11]);
  const sakuras = new Set([4, 9]);
  const waves = new Set([7, 12]);
  if (toriis.has(i)) return 'torii';
  if (sakuras.has(i)) return 'sakura';
  if (waves.has(i)) return 'wave';
  return 'path';
}

function cellToXY(i: number): { col: number; row: number } {
  const row = Math.floor(i / BOARD_COLS);
  const even = row % 2 === 0;
  const col = even ? i % BOARD_COLS : BOARD_COLS - 1 - (i % BOARD_COLS);
  return { col, row };
}

export class SugorokuPuzzle extends Puzzle {
  readonly title = 'SUGOROKU';
  readonly subtitle = 'the pilgrim path';
  readonly instructions =
    'Roll the die to walk the path. Torii gates demand mental arithmetic; waves carry you back. Reach the shrine to pass.';

  private position = 0;
  private lastRoll = 0;
  private phase: 'ready' | 'rolling' | 'challenge' | 'done' = 'ready';
  private question: Question | null = null;

  private root: HTMLDivElement | null = null;
  private boardEl: HTMLDivElement | null = null;
  private pawnEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private progressEl: HTMLDivElement | null = null;
  private rollBtn: HTMLButtonElement | null = null;
  private dieEl: HTMLDivElement | null = null;
  private challengeEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.buildDom();
    this.renderAll();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const floor = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#150820'),
        roughness: 0.7,
        metalness: 0.15,
        side: DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    this.group.add(floor);

    const torii = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color('#c41e3a'),
        emissive: new Color('#2e0a0a'),
        emissiveIntensity: 0.45,
        roughness: 0.4,
        metalness: 0.85,
        side: DoubleSide,
      }),
    );
    torii.rotation.x = -Math.PI / 2;
    torii.position.y = -2.37;
    this.group.add(torii);

    const lamp = new PointLight('#ffd89a', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-sugoroku';
    root.style.cssText = `
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      z-index:20; pointer-events:none; font-family:'Cormorant Garamond', Georgia, serif;
    `;
    this.root = root;

    const panel = document.createElement('div');
    panel.style.cssText = `
      display:flex; flex-direction:column; align-items:center; gap:12px;
      pointer-events:auto;
      padding:22px 26px;
      background:rgba(10,18,34,0.8); backdrop-filter:blur(12px);
      border:1px solid rgba(159,200,255,0.25);
      border-top:3px solid var(--era-accent);
      border-radius:10px;
      box-shadow:0 18px 60px rgba(0,0,0,0.55);
      color:#f4ebd2;
    `;
    root.appendChild(panel);

    const title = document.createElement('div');
    title.style.cssText = `font-size:18px; letter-spacing:0.26em; color:var(--era-accent); font-weight:600;`;
    title.textContent = 'SUGOROKU';
    panel.appendChild(title);

    const progress = document.createElement('div');
    progress.style.cssText = `font-size:12px; letter-spacing:0.18em; opacity:0.75;`;
    this.progressEl = progress;
    panel.appendChild(progress);

    // Board.
    const board = document.createElement('div');
    board.style.cssText = `
      position:relative;
      width:${BOARD_COLS * CELL_PX}px; height:${BOARD_ROWS * CELL_PX}px;
      background:rgba(0,0,0,0.3);
      border:1px solid rgba(196,30,58,0.4);
      border-radius:6px;
    `;
    this.boardEl = board;
    panel.appendChild(board);

    for (let i = 0; i < TOTAL; i++) {
      const { col, row } = cellToXY(i);
      const x = col * CELL_PX;
      const y = (BOARD_ROWS - 1 - row) * CELL_PX;
      const sq = document.createElement('div');
      const kind = spaceTypeFor(i);
      const bg =
        kind === 'start'
          ? 'rgba(250,220,140,0.22)'
          : kind === 'finish'
            ? 'rgba(250,180,180,0.3)'
            : kind === 'torii'
              ? 'rgba(196,30,58,0.2)'
              : kind === 'sakura'
                ? 'rgba(255,183,197,0.22)'
                : kind === 'wave'
                  ? 'rgba(74,144,217,0.22)'
                  : 'transparent';
      sq.style.cssText = `
        position:absolute;
        left:${x}px; top:${y}px;
        width:${CELL_PX}px; height:${CELL_PX}px;
        box-sizing:border-box;
        border:1px solid rgba(255,200,120,0.14);
        background:${bg};
        display:flex; align-items:center; justify-content:center;
        flex-direction:column;
        font-size:11px; color:#f3e7c8; letter-spacing:0.08em;
      `;
      const icon = document.createElement('div');
      icon.style.cssText = 'font-size:22px; margin-bottom:2px;';
      icon.textContent =
        kind === 'start'
          ? '◯'
          : kind === 'finish'
            ? '⛩'
            : kind === 'torii'
              ? '⛩'
              : kind === 'sakura'
                ? '✿'
                : kind === 'wave'
                  ? '≈'
                  : '·';
      sq.appendChild(icon);
      const lab = document.createElement('div');
      lab.style.cssText = 'font-size:10px; opacity:0.6;';
      lab.textContent = String(i);
      sq.appendChild(lab);
      board.appendChild(sq);
    }

    // Pawn.
    const pawn = document.createElement('div');
    pawn.style.cssText = `
      position:absolute; width:${CELL_PX - 30}px; height:${CELL_PX - 30}px;
      background:radial-gradient(circle at 40% 35%, #fff2c8, #c41e3a 70%, #6a0a0a 100%);
      border:2px solid #f7d58f;
      border-radius:50%;
      box-shadow:0 0 12px rgba(255,120,120,0.65);
      transition:left 0.4s ease, top 0.4s ease;
      pointer-events:none; z-index:5;
    `;
    board.appendChild(pawn);
    this.pawnEl = pawn;

    // Controls row.
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:16px; align-items:center; margin-top:4px;';
    panel.appendChild(row);

    const die = document.createElement('div');
    die.style.cssText = `
      width:48px; height:48px; border-radius:8px;
      background:#f5f0e6; color:#3b2414;
      border:2px solid #5c4a3a;
      display:flex; align-items:center; justify-content:center;
      font-family:'Menlo', monospace; font-size:24px; font-weight:700;
      box-shadow:0 4px 10px rgba(0,0,0,0.45);
    `;
    die.textContent = '—';
    this.dieEl = die;
    row.appendChild(die);

    const roll = document.createElement('button');
    roll.type = 'button';
    roll.textContent = 'ROLL';
    roll.style.cssText = `
      padding:10px 22px;
      background:rgba(196,30,58,0.18);
      border:1px solid rgba(196,30,58,0.5);
      color:#f6e9c8;
      font-family:inherit; font-size:13px; letter-spacing:0.3em; font-weight:600;
      border-radius:5px; cursor:pointer;
    `;
    roll.addEventListener('click', () => this.roll());
    this.rollBtn = roll;
    row.appendChild(roll);

    // Challenge panel (overlay under board).
    const challenge = document.createElement('div');
    challenge.style.cssText = `
      display:none; flex-direction:column; align-items:center; gap:10px;
      padding:12px 18px;
      background:rgba(196,30,58,0.12);
      border:1px solid rgba(196,30,58,0.4);
      border-radius:6px;
      margin-top:4px;
    `;
    this.challengeEl = challenge;
    panel.appendChild(challenge);

    const status = document.createElement('div');
    status.style.cssText = `font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;`;
    this.statusEl = status;
    panel.appendChild(status);

    document.body.appendChild(root);
    this.placePawn();
  }

  /* ----------------------------- Rendering ------------------------------- */

  private placePawn(): void {
    if (!this.pawnEl) return;
    const { col, row } = cellToXY(this.position);
    const x = col * CELL_PX + (CELL_PX - (CELL_PX - 30)) / 2;
    const y = (BOARD_ROWS - 1 - row) * CELL_PX + (CELL_PX - (CELL_PX - 30)) / 2;
    this.pawnEl.style.left = `${x}px`;
    this.pawnEl.style.top = `${y}px`;
  }

  private renderAll(): void {
    if (this.progressEl) {
      this.progressEl.textContent = `SPACE ${this.position} / ${FINISH}${this.lastRoll ? ` · LAST ROLL ${this.lastRoll}` : ''}`;
    }
    if (this.dieEl) this.dieEl.textContent = this.lastRoll ? String(this.lastRoll) : '—';
    if (this.rollBtn) {
      const usable = this.phase === 'ready';
      this.rollBtn.disabled = !usable;
      this.rollBtn.style.opacity = usable ? '1' : '0.35';
    }
    this.placePawn();
  }

  /* -------------------------------- Flow --------------------------------- */

  private roll(): void {
    if (this.phase !== 'ready') return;
    this.phase = 'rolling';
    this.lastRoll = 1 + Math.floor(Math.random() * 6);
    const target = Math.min(FINISH, this.position + this.lastRoll);
    this.position = target;
    this.placePawn();
    this.renderAll();
    this.flashStatus(`rolled ${this.lastRoll} — advance to ${this.position}`, '');
    setTimeout(() => this.afterLanding(), 500);
  }

  private afterLanding(): void {
    const kind = spaceTypeFor(this.position);
    if (this.position === FINISH) {
      this.phase = 'done';
      this.isSolved = true;
      if (this.statusEl) {
        this.statusEl.textContent = 'THE SHRINE IS REACHED';
        this.statusEl.style.color = '#9fe0a6';
      }
      setTimeout(() => this.onSolved?.(), 1100);
      return;
    }
    if (kind === 'torii') {
      this.question = generateQuestion();
      this.phase = 'challenge';
      this.showChallenge();
      return;
    }
    if (kind === 'sakura') {
      this.position = Math.min(FINISH, this.position + 2);
      this.placePawn();
      this.flashStatus('sakura carries you two spaces forward', '#ffb7c5');
      setTimeout(() => this.afterLanding(), 650);
      return;
    }
    if (kind === 'wave') {
      this.position = Math.max(0, this.position - 3);
      this.placePawn();
      this.flashStatus('the wave drags you back three', '#4a90d9');
      setTimeout(() => this.afterLanding(), 650);
      return;
    }
    this.phase = 'ready';
    this.renderAll();
  }

  private showChallenge(): void {
    if (!this.challengeEl || !this.question) return;
    this.challengeEl.style.display = 'flex';
    this.challengeEl.innerHTML = '';
    const q = document.createElement('div');
    q.style.cssText = 'font-size:16px; color:#f6e9c8; letter-spacing:0.06em;';
    q.textContent = this.question.text;
    this.challengeEl.appendChild(q);

    const opts = document.createElement('div');
    opts.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap; justify-content:center;';
    for (const v of this.question.options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(v);
      b.style.cssText = `
        min-width:64px; padding:8px 14px;
        background:rgba(245,230,200,0.08);
        border:1px solid rgba(197,151,44,0.4);
        color:#f6e9c8;
        font-family:inherit; font-size:15px; font-weight:700;
        border-radius:5px; cursor:pointer;
      `;
      b.addEventListener('click', () => this.answer(v, b));
      opts.appendChild(b);
    }
    this.challengeEl.appendChild(opts);
    if (this.statusEl) {
      this.statusEl.textContent = 'a torii gate — answer to pass';
      this.statusEl.style.color = '';
    }
  }

  private answer(v: number, btn: HTMLButtonElement): void {
    if (!this.question) return;
    const correct = v === this.question.correct;
    btn.style.background = correct ? 'rgba(150,220,160,0.35)' : 'rgba(220,120,120,0.32)';
    btn.style.borderColor = correct ? '#9fe0a6' : '#e89090';
    Array.from(btn.parentElement?.children || []).forEach((c) => {
      (c as HTMLButtonElement).disabled = true;
    });
    if (correct) {
      if (this.statusEl) {
        this.statusEl.textContent = 'the kami nod';
        this.statusEl.style.color = '#9fe0a6';
      }
      setTimeout(() => {
        if (this.challengeEl) this.challengeEl.style.display = 'none';
        this.phase = 'ready';
        this.renderAll();
      }, 700);
    } else {
      this.position = Math.max(0, this.position - 3);
      this.placePawn();
      if (this.statusEl) {
        this.statusEl.textContent = `the answer was ${this.question.correct} — washed back three`;
        this.statusEl.style.color = '#e89090';
      }
      setTimeout(() => {
        if (this.challengeEl) this.challengeEl.style.display = 'none';
        this.phase = 'ready';
        this.renderAll();
      }, 1300);
    }
  }

  private flashStatus(msg: string, color: string): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.style.color = color;
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
    this.boardEl = null;
    this.pawnEl = null;
    this.statusEl = null;
    this.progressEl = null;
    this.rollBtn = null;
    this.dieEl = null;
    this.challengeEl = null;
    super.dispose();
  }
}
