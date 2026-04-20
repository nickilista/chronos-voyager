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
 * Moksha Patam — the Vedic ancestor of snakes and ladders. The board is a
 * 6×6 serpentine grid numbered 1..36 from the bottom. Each turn the player
 * picks one of three deterministic moves (+1, +2, +3). Ladders lift the
 * pawn to a higher cell; snakes drop it. Reach cell 36 within 12 turns.
 */

const N = 6;
const GOAL = N * N;
const MAX_TURNS = 12;
const CELL_PX = 74;
const BOARD_PX = N * CELL_PX;

const LADDERS: Record<number, number> = { 4: 14, 9: 21, 20: 29 };
const SNAKES: Record<number, number> = { 17: 6, 25: 10, 32: 19 };

/** Serpentine coords: row 0 (bottom) runs left→right, row 1 runs right→left, etc. */
function cellToXY(cell: number): { col: number; row: number } {
  const idx = cell - 1;
  const row = Math.floor(idx / N);
  const even = row % 2 === 0;
  const col = even ? idx % N : N - 1 - (idx % N);
  return { col, row };
}

export class MokshaPatamPuzzle extends Puzzle {
  readonly title = 'MOKSHA PATAM';
  readonly subtitle = 'the way to liberation';
  readonly instructions =
    'Climb the dharma board from cell 1 to cell 36 in twelve turns. Ladders raise, serpents lower. Spend your moves wisely.';

  private position = 1;
  private turnsUsed = 0;
  private moveChoices: number[] = [];

  private root: HTMLDivElement | null = null;
  private boardEl: HTMLDivElement | null = null;
  private pawnEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private turnEl: HTMLDivElement | null = null;
  private movesEl: HTMLDivElement | null = null;
  private moveBtns: HTMLButtonElement[] = [];
  private resetBtn: HTMLButtonElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.buildDom();
    this.rollMoveChoices();
    this.refresh();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#231208'),
        roughness: 0.65,
        metalness: 0.2,
        side: DoubleSide,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const mandala = new Mesh(
      new RingGeometry(3.0, 3.18, 12),
      new MeshStandardMaterial({
        color: new Color('#e69a3a'),
        emissive: new Color('#402004'),
        emissiveIntensity: 0.55,
        roughness: 0.45,
        metalness: 0.85,
        side: DoubleSide,
      }),
    );
    mandala.rotation.x = -Math.PI / 2;
    mandala.position.y = -2.37;
    this.group.add(mandala);

    const lamp = new PointLight('#fac675', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-moksha';
    root.style.cssText = `
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      z-index:20; pointer-events:none; font-family:'Cormorant Garamond', Georgia, serif;
    `;
    this.root = root;

    const panel = document.createElement('div');
    panel.style.cssText = `
      display:flex; flex-direction:column; align-items:center; gap:12px;
      pointer-events:auto;
      padding:20px 24px;
      background:rgba(10,18,34,0.78); backdrop-filter:blur(12px);
      border:1px solid rgba(159,200,255,0.25);
      border-top:3px solid var(--era-accent);
      border-radius:10px;
      box-shadow:0 18px 60px rgba(0,0,0,0.55);
      color:#e6eefb;
    `;
    root.appendChild(panel);

    const title = document.createElement('div');
    title.style.cssText = `font-size:18px; letter-spacing:0.26em; color:var(--era-accent); font-weight:600;`;
    title.textContent = 'MOKSHA PATAM';
    panel.appendChild(title);

    const turns = document.createElement('div');
    turns.style.cssText = `font-size:12px; letter-spacing:0.18em; opacity:0.75;`;
    this.turnEl = turns;
    panel.appendChild(turns);

    // Board.
    const board = document.createElement('div');
    board.style.cssText = `
      position:relative;
      width:${BOARD_PX}px; height:${BOARD_PX}px;
      background:rgba(0,0,0,0.35);
      border:1px solid rgba(255,195,90,0.3);
      border-radius:6px;
      overflow:hidden;
    `;
    this.boardEl = board;
    panel.appendChild(board);

    for (let cell = 1; cell <= GOAL; cell++) {
      const { col, row } = cellToXY(cell);
      const x = col * CELL_PX;
      const y = (N - 1 - row) * CELL_PX;
      const sq = document.createElement('div');
      const isLadder = LADDERS[cell] !== undefined;
      const isSnake = SNAKES[cell] !== undefined;
      const isGoal = cell === GOAL;
      sq.style.cssText = `
        position:absolute;
        left:${x}px; top:${y}px;
        width:${CELL_PX}px; height:${CELL_PX}px;
        box-sizing:border-box;
        border:1px solid rgba(255,195,90,0.14);
        display:flex; align-items:flex-start; justify-content:flex-start;
        padding:4px;
        background:${
          isGoal
            ? 'rgba(250,198,117,0.22)'
            : isLadder
              ? 'rgba(120,200,150,0.12)'
              : isSnake
                ? 'rgba(220,110,110,0.12)'
                : 'transparent'
        };
        font-size:11px; opacity:0.65; color:#f3e7c8;
        letter-spacing:0.08em;
      `;
      sq.textContent = String(cell);
      if (isGoal) {
        const icon = document.createElement('div');
        icon.textContent = '◉';
        icon.style.cssText = `
          position:absolute; inset:0;
          display:flex; align-items:center; justify-content:center;
          font-size:28px; color:#f5d890;
        `;
        sq.appendChild(icon);
      }
      if (isLadder) {
        const icon = document.createElement('div');
        icon.textContent = `↑${LADDERS[cell]}`;
        icon.style.cssText = `
          position:absolute; right:5px; bottom:5px;
          font-size:11px; color:#9fe0a6; font-weight:600;
        `;
        sq.appendChild(icon);
      }
      if (isSnake) {
        const icon = document.createElement('div');
        icon.textContent = `↓${SNAKES[cell]}`;
        icon.style.cssText = `
          position:absolute; right:5px; bottom:5px;
          font-size:11px; color:#e89090; font-weight:600;
        `;
        sq.appendChild(icon);
      }
      board.appendChild(sq);
    }

    // Pawn.
    const pawn = document.createElement('div');
    pawn.style.cssText = `
      position:absolute; width:${CELL_PX - 18}px; height:${CELL_PX - 18}px;
      background:radial-gradient(circle at 40% 35%, #fff2c8, #c9892a 70%, #6a3c0f 100%);
      border:2px solid #f7d58f;
      border-radius:50%;
      box-shadow:0 0 12px rgba(255,200,100,0.55);
      transition:left 0.4s ease, top 0.4s ease;
      pointer-events:none;
      z-index:5;
    `;
    board.appendChild(pawn);
    this.pawnEl = pawn;

    // Move-choice buttons.
    const moves = document.createElement('div');
    moves.style.cssText = `display:flex; gap:10px; margin-top:2px;`;
    this.movesEl = moves;
    panel.appendChild(moves);

    const status = document.createElement('div');
    status.style.cssText = `font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;`;
    this.statusEl = status;
    panel.appendChild(status);

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'BEGIN AGAIN';
    reset.style.cssText = `
      padding:7px 16px; display:none;
      background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.25);
      color:#e6eefb;
      font-family:inherit; font-size:11px; letter-spacing:0.22em; font-weight:600;
      border-radius:5px; cursor:pointer;
    `;
    reset.addEventListener('click', () => this.resetGame());
    this.resetBtn = reset;
    panel.appendChild(reset);

    document.body.appendChild(root);
    this.placePawn();
  }

  /* ------------------------------ Flow ---------------------------------- */

  private rollMoveChoices(): void {
    // Always present three distinct small moves. A good mix keeps the player
    // thinking about whether to step onto a snake or delay for a ladder.
    const all: number[] = [];
    while (all.length < 3) {
      const v = 1 + Math.floor(Math.random() * 4);
      if (!all.includes(v)) all.push(v);
    }
    this.moveChoices = all.sort((a, b) => a - b);
  }

  private chooseMove(delta: number): void {
    if (this.isSolved) return;
    if (this.turnsUsed >= MAX_TURNS) return;
    const next = Math.min(GOAL, this.position + delta);
    this.position = next;
    this.turnsUsed++;
    // Trigger ladder/snake after landing.
    const afterLadder = LADDERS[this.position];
    const afterSnake = SNAKES[this.position];
    if (afterLadder !== undefined) {
      setTimeout(() => {
        this.position = afterLadder;
        this.placePawn();
        this.flashStatus(`A ladder — up to ${afterLadder}`, '#9fe0a6');
        this.postMove();
      }, 450);
    } else if (afterSnake !== undefined) {
      setTimeout(() => {
        this.position = afterSnake;
        this.placePawn();
        this.flashStatus(`A serpent — down to ${afterSnake}`, '#e89090');
        this.postMove();
      }, 450);
    } else {
      setTimeout(() => this.postMove(), 350);
    }
    this.placePawn();
    this.refresh();
  }

  private postMove(): void {
    if (this.position >= GOAL) {
      this.isSolved = true;
      if (this.statusEl) {
        this.statusEl.textContent = 'YOU HAVE REACHED MOKSHA';
        this.statusEl.style.color = '#9fe0a6';
      }
      setTimeout(() => this.onSolved?.(), 900);
      return;
    }
    if (this.turnsUsed >= MAX_TURNS) {
      if (this.statusEl) {
        this.statusEl.textContent = 'Turns exhausted. Walk the path again.';
        this.statusEl.style.color = '#e89090';
      }
      if (this.resetBtn) this.resetBtn.style.display = 'inline-block';
      this.refresh();
      return;
    }
    this.rollMoveChoices();
    this.refresh();
  }

  private resetGame(): void {
    this.position = 1;
    this.turnsUsed = 0;
    if (this.resetBtn) this.resetBtn.style.display = 'none';
    this.rollMoveChoices();
    this.placePawn();
    this.refresh();
  }

  /* ------------------------------ Render --------------------------------- */

  private placePawn(): void {
    if (!this.pawnEl) return;
    const { col, row } = cellToXY(this.position);
    const x = col * CELL_PX + (CELL_PX - (CELL_PX - 18)) / 2;
    const y = (N - 1 - row) * CELL_PX + (CELL_PX - (CELL_PX - 18)) / 2;
    this.pawnEl.style.left = `${x}px`;
    this.pawnEl.style.top = `${y}px`;
  }

  private flashStatus(msg: string, color: string): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.style.color = color;
  }

  private refresh(): void {
    if (this.turnEl) {
      this.turnEl.textContent = `TURN ${this.turnsUsed} / ${MAX_TURNS}   ·   CELL ${this.position} / ${GOAL}`;
    }
    if (this.movesEl) {
      this.movesEl.innerHTML = '';
      this.moveBtns = [];
      for (const delta of this.moveChoices) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = `+${delta}`;
        b.style.cssText = `
          width:70px; padding:10px 0;
          background:rgba(159,200,255,0.08); border:1px solid rgba(159,200,255,0.35);
          color:var(--era-accent);
          font-family:'Cormorant Garamond', Georgia, serif;
          font-size:17px; font-weight:600;
          border-radius:5px; cursor:pointer;
        `;
        const disabled = this.isSolved || this.turnsUsed >= MAX_TURNS;
        if (disabled) {
          b.style.opacity = '0.4';
          b.style.cursor = 'default';
        }
        b.addEventListener('click', () => this.chooseMove(delta));
        this.movesEl.appendChild(b);
        this.moveBtns.push(b);
      }
    }
    if (this.statusEl && !this.isSolved && this.turnsUsed < MAX_TURNS) {
      this.statusEl.textContent = 'choose your step';
      this.statusEl.style.color = '';
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
    this.boardEl = null;
    this.pawnEl = null;
    this.statusEl = null;
    this.turnEl = null;
    this.movesEl = null;
    this.moveBtns = [];
    this.resetBtn = null;
    super.dispose();
  }
}
