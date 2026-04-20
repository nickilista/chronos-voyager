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
 * Senet — aligned with the iOS "Chronos Mathematica" SenetGameView.
 *
 * 3×10 S-path board (positions 0-29, 30 = off-board).
 * Player: Ankh pieces (gold). Opponent: Eye of Horus pieces (blue).
 *
 * Key iOS mechanics ported:
 *   - 4 throw sticks: marked count = roll (0 marked => 5). Extra turn on 1/4/5.
 *   - Smart player roll (best of 2), disadvantage AI roll (worst of 2).
 *   - Forward moves primary; backward only when no forward exists (level >= 2).
 *   - Exit: pieces on square >= 27 exit with exact roll; overshoot bounces back.
 *   - Capture: land on lone enemy (swap positions). Adjacent friend = protected.
 *   - Special squares: 14 Rebirth, 25 Beauty (safe + extra), 26 Water (drown, respawn near 14),
 *     27 Three Truths, 28 Re-Atum, 29 Departure.
 *   - Math traps (level-based positions). 10s timer, numpad input. Fail => piece retreats.
 *   - Level-based piece count, max turns, trap squares, question difficulty.
 *   - Canvas 2D board rendering + DOM overlay (MokshaPatam pattern).
 *   - Three.js backdrop (ground, decorative ring, point light).
 */

/* ── Board config ─────────────────────────────────────────────── */

const COLS = 10;
const ROWS = 3;
const OFF_BOARD = 30;
const CELL_PX = 36;
const BOARD_W = COLS * CELL_PX;
const BOARD_H = ROWS * CELL_PX;
const TRAP_TIME = 10;

/* ── Colors (Egyptian theme, matches iOS) ────────────────────── */

const C_CELL_ALT = '#3B2A16';
const C_CELL_DARK = '#2F2111';
const C_GOLD = '#D4A843';
const C_GOLD_LIGHT = '#F5D060';
const C_SAND = '#E8D5A3';
const C_DEEP_BROWN = '#2C1810';
const C_WATER_BLUE = '#4A90D9';
const C_DANGER_RED = '#D94444';
const C_SPIRIT_GREEN = '#44B87A';
const C_THOTH_PURPLE = '#7B2D8E';
const C_PLAYER = '#F5D060';
const C_OPPONENT = '#4A7ACC';
const C_OPPONENT_STROKE = '#1E3A6E';
const C_OPPONENT_PUPIL = '#0D1B2A';
const C_CREAM = '#F5E6CC';

/* ── Level config (matches iOS) ──────────────────────────────── */

const PIECE_COUNTS = [2, 3, 4, 5, 5];
const MAX_TURNS_BY_LEVEL = [40, 50, 60, 70, 90];

function mathTrapSquares(level: number): Set<number> {
  switch (level) {
    case 1: return new Set([8, 18]);
    case 2: return new Set([6, 13, 20]);
    case 3: return new Set([5, 11, 17, 22]);
    default: return new Set([4, 9, 15, 19, 23]);
  }
}

/* ── Special squares ─────────────────────────────────────────── */

interface SpecialInfo { icon: string; title: string; color: string; bg: string }

const SPECIAL: Record<number, SpecialInfo> = {
  14: { icon: '\u2625', title: 'House of Rebirth', color: C_SPIRIT_GREEN, bg: '#1A2E1A' },
  25: { icon: '\u2726', title: 'House of Beauty', color: C_GOLD, bg: '#2E2510' },
  26: { icon: '\u301C', title: 'House of Water', color: C_WATER_BLUE, bg: '#0F1E2E' },
  27: { icon: 'III', title: 'House of Three Truths', color: '#E8A030', bg: '#2E1F0A' },
  28: { icon: 'II', title: 'House of Re-Atum', color: '#E8A030', bg: '#2E1F0A' },
  29: { icon: '\u2600', title: 'House of Departure', color: C_GOLD, bg: '#2E2510' },
};

/* ── Board layout helpers ────────────────────────────────────── */

/** Convert position (0-29) to (row, col) on the S-path. Row 0: L-R, Row 1: R-L, Row 2: L-R */
function posToRowCol(pos: number): { row: number; col: number } {
  const row = Math.floor(pos / COLS);
  const col = row === 1 ? COLS - 1 - (pos - COLS) : pos % COLS;
  return { row, col };
}

function rowColToPos(row: number, col: number): number {
  if (row === 0) return col;
  if (row === 1) return 10 + (COLS - 1 - col);
  return 20 + col;
}

function cellCenter(pos: number): { x: number; y: number } {
  const { row, col } = posToRowCol(pos);
  return { x: col * CELL_PX + CELL_PX * 0.5, y: row * CELL_PX + CELL_PX * 0.5 };
}

function randInt(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1));
}

/* ── Math trap generation (matches iOS per-level) ────────────── */

interface Trap { prompt: string; answer: number }

function generateTrap(level: number): Trap {
  // ~30% historical/trivia
  if (Math.random() < 0.3) return generateHistoricalTrap();

  switch (level) {
    case 1: {
      const ops = randInt(0, 5);
      if (ops === 0) { const a = randInt(12, 45), b = randInt(11, 35); return { prompt: `${a} + ${b} = ?`, answer: a + b }; }
      if (ops === 1) { const big = randInt(30, 70), small = randInt(11, big - 5); return { prompt: `${big} \u2212 ${small} = ?`, answer: big - small }; }
      if (ops === 2) { const a = randInt(12, 25); return { prompt: `${a} + ${a} = ?`, answer: a * 2 }; }
      if (ops === 3) { const s = randInt(10, 20), st = randInt(3, 7); return { prompt: `${s}, ${s + st}, ${s + 2 * st}, ... ?`, answer: s + 3 * st }; }
      if (ops === 4) { const baskets = randInt(5, 12), figs = randInt(3, 8); return { prompt: `Baskets of figs: ${baskets} \u00d7 ${figs} = ?`, answer: baskets * figs }; }
      { const rows = randInt(4, 9), cols = randInt(3, 7); return { prompt: `Columns of soldiers: ${rows} \u00d7 ${cols} = ?`, answer: rows * cols }; }
    }
    case 2: {
      const ops = randInt(0, 6);
      if (ops === 0) { const a = randInt(6, 15), b = randInt(4, 12); return { prompt: `${a} \u00d7 ${b} = ?`, answer: a * b }; }
      if (ops === 1) { const a = randInt(11, 25); return { prompt: `${a} \u2192 ${a * 2} \u2192 ?  (double)`, answer: a * 4 }; }
      if (ops === 2) { const b = randInt(3, 9), ans = randInt(5, 15); return { prompt: `${b * ans} \u00f7 ${b} = ?`, answer: ans }; }
      if (ops === 3) { const n = randInt(5, 12) * 4; return { prompt: `${n} \u00f7 4 + ${n} \u00f7 2 = ?`, answer: n / 4 + n / 2 }; }
      if (ops === 4) { const a = randInt(25, 65), b = randInt(15, 40); return { prompt: `${a} + ${b} = ?`, answer: a + b }; }
      if (ops === 5) { const layers = randInt(4, 9), blocks = randInt(6, 15); return { prompt: `Pyramid blocks: ${layers} \u00d7 ${blocks} = ?`, answer: layers * blocks }; }
      { const sacks = randInt(30, 80), removed = randInt(12, 25); return { prompt: `Grain sacks: ${sacks} \u2212 ${removed} = ?`, answer: sacks - removed }; }
    }
    case 3: {
      const ops = randInt(0, 7);
      if (ops === 0) { const a = randInt(8, 18), b = randInt(5, 13); return { prompt: `${a} \u00d7 ${b} = ?`, answer: a * b }; }
      if (ops === 1) { const a = randInt(35, 75), b = randInt(18, 45); return { prompt: `${a} + ${b} = ?`, answer: a + b }; }
      if (ops === 2) { const b = randInt(4, 12), ans = randInt(6, 18); return { prompt: `${b * ans} \u00f7 ${b} = ?`, answer: ans }; }
      if (ops === 3) { const x = randInt(10, 30) * 2; return { prompt: `${x} + ${x} \u00f7 2 = ?`, answer: x + x / 2 }; }
      if (ops === 4) { const a = randInt(11, 25); return { prompt: `${a} \u2192 ${a * 2} \u2192 ${a * 4} \u2192 ?`, answer: a * 8 }; }
      if (ops === 5) { const cubits = randInt(5, 15); return { prompt: `${cubits} \u00d7 7 = ?`, answer: cubits * 7 }; }
      if (ops === 6) { const fields = randInt(6, 14), area = randInt(5, 12); return { prompt: `Fields of barley: ${fields} \u00d7 ${area} = ?`, answer: fields * area }; }
      { const depth = randInt(8, 18), days = randInt(3, 9); return { prompt: `Flood depth: ${depth} \u00d7 ${days} = ?`, answer: depth * days }; }
    }
    default: {
      const ops = randInt(0, 8);
      if (ops === 0) { const b = randInt(6, 15), ans = randInt(8, 20); return { prompt: `${b * ans} \u00f7 ${b} = ?`, answer: ans }; }
      if (ops === 1) { const a = randInt(11, 19); return { prompt: `${a}\u00b2 = ?`, answer: a * a }; }
      if (ops === 2) { const a = randInt(12, 25), b = randInt(6, 15), c = randInt(10, 30); return { prompt: `${a} \u00d7 ${b} + ${c} = ?`, answer: a * b + c }; }
      if (ops === 3) { const a = randInt(50, 99), b = randInt(15, 45); return { prompt: `${a} \u2212 ${b} = ?`, answer: a - b }; }
      if (ops === 4) { const x = randInt(12, 30) * 3; return { prompt: `${x} + ${x} \u00f7 3 = ?`, answer: x + x / 3 }; }
      if (ops === 5) { const base = randInt(11, 20); return { prompt: `\u221a${base * base} = ?`, answer: base }; }
      if (ops === 6) {
        const triples: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
        const t = triples[randInt(0, triples.length - 1)];
        const hide = randInt(0, 2);
        if (hide === 0) return { prompt: `?\u00b2 + ${t[1]}\u00b2 = ${t[2]}\u00b2  \u2192  ? =`, answer: t[0] };
        if (hide === 1) return { prompt: `${t[0]}\u00b2 + ?\u00b2 = ${t[2]}\u00b2  \u2192  ? =`, answer: t[1] };
        return { prompt: `${t[0]}\u00b2 + ${t[1]}\u00b2 = ?`, answer: t[2] * t[2] };
      }
      if (ops === 7) { const teams = randInt(8, 15), workers = randInt(10, 20), extra = randInt(10, 30); return { prompt: `Workers: ${teams} \u00d7 ${workers} + ${extra} = ?`, answer: teams * workers + extra }; }
      { const base = randInt(11, 18); return { prompt: `Stone blocks: ${base}\u00b2 = ?`, answer: base * base }; }
    }
  }
}

function generateHistoricalTrap(): Trap {
  const qs: [string, number][] = [
    ['How many squares on a Senet board?', 30],
    ['How many pieces per side in classic Senet?', 5],
    ['How many rows on a Senet board?', 3],
    ['Squares per row on a Senet board?', 10],
    ['How many throwing sticks in Senet?', 4],
    ['House of Rebirth is square number...', 15],
    ['How many players in Senet?', 2],
    ['Egyptian doubling: 7 \u2192 14 \u2192 ?', 28],
    ['Rope stretcher triangle: 3-4-?', 5],
    ['How many faces on a pyramid (including base)?', 5],
    ['Eye of Horus fractions sum to 63/64. Denominator of the smallest?', 7],
    ['How many palms in a Royal Cubit?', 7],
    ['Days in an Egyptian month?', 30],
    ['Seasons in the Egyptian calendar?', 3],
    ['Fingers in 1 palm?', 4],
    ['How many Great Pyramids at Giza?', 3],
    ['Base of the Egyptian number system?', 10],
    ['Triangular faces on a pyramid?', 4],
    ['Epagomenal days in the Egyptian year?', 5],
    ['Months in Akhet (flood season)?', 4],
    ['Organs stored in canopic jars?', 4],
    ['Major kingdoms in Egyptian history?', 3],
  ];
  const pick = qs[randInt(0, qs.length - 1)];
  return { prompt: pick[0], answer: pick[1] };
}

/* ── Types ────────────────────────────────────────────────────── */

type Phase =
  | 'ready'
  | 'threw'
  | 'no-moves'
  | 'moving'
  | 'math-trap'
  | 'opponent-think'
  | 'won'
  | 'lost';

/* ── Puzzle class ─────────────────────────────────────────────── */

export class SenetPuzzle extends Puzzle {
  readonly title = 'SENET';
  readonly subtitle = 'the game of passing';
  readonly instructions =
    'Throw the sticks, then tap one of your Ankh pieces to move. Math-trap squares summon Thoth \u2014 answer correctly within 10s to hold your ground. Guide all your Ankhs past square 30 before your turns run out.';

  private level = 5;
  private pieceCount = 3;
  private maxTurns = 50;
  private trapSquares = mathTrapSquares(2);

  private playerPieces: number[] = [];
  private opponentPieces: number[] = [];
  private throwResult = 0;
  private isPlayerTurn = true;
  private phase: Phase = 'ready';
  private stickStates = [false, false, false, false];
  private turnCount = 0;
  private hasExtraTurn = false;
  private validDestinations: Map<number, number> = new Map();

  // Math trap state
  private trapActive = false;
  private trapQuestion = '';
  private trapAnswer = 0;
  private trapInput = '';
  private trapTimer = TRAP_TIME;
  private trapPieceIndex = 0;
  private trapPreviousPos = 0;
  private trapTimerId = 0;
  private recentPrompts: string[] = [];

  // DOM
  private root: HTMLDivElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private hudEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private sticksEl: HTMLDivElement | null = null;
  private throwBtn: HTMLButtonElement | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private bannerEl: HTMLDivElement | null = null;
  private bannerTimer = 0;

  onSolved?: () => void;

  init(): void {
    this.setupLevel();
    this.buildBackdrop();
    this.buildDom();
    this.drawBoard();
    this.placePawns(false);
    this.refreshUI();
    this.showBanner('\u2625', 'Senet \u2014 The Game of Passing',
      `Guide ${this.pieceCount} Ankhs to the afterlife before ${this.maxTurns} turns.`, C_GOLD);
  }

  private setupLevel(): void {
    const lvl = Math.max(1, Math.min(this.level, 5));
    this.pieceCount = PIECE_COUNTS[lvl - 1];
    this.maxTurns = MAX_TURNS_BY_LEVEL[lvl - 1];
    this.trapSquares = mathTrapSquares(lvl);
    this.playerPieces = [];
    this.opponentPieces = [];
    for (let i = 0; i < this.pieceCount; i++) {
      this.playerPieces.push(i * 2);
      this.opponentPieces.push(i * 2 + 1);
    }
    this.turnCount = 0;
    this.throwResult = 0;
    this.hasExtraTurn = false;
    this.isPlayerTurn = true;
    this.phase = 'ready';
    this.validDestinations.clear();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color(C_DEEP_BROWN), roughness: 0.65, metalness: 0.2, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.18, 12),
      new MeshStandardMaterial({
        color: new Color(C_GOLD), emissive: new Color('#402004'),
        emissiveIntensity: 0.55, roughness: 0.45, metalness: 0.85, side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const lamp = new PointLight('#fac675', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-senet';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      pointerEvents: 'auto', padding: '14px 18px',
      background: 'rgba(26,15,10,0.92)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(212,168,67,0.25)', borderTop: '3px solid ' + C_GOLD,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_CREAM,
      maxHeight: '96vh', overflowY: 'auto',
    });
    root.appendChild(panel);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '15px', letterSpacing: '0.22em', color: C_GOLD, fontWeight: '700' });
    title.textContent = 'SENET \u00b7 \ud80c\udc83\ud80c\udc96\ud80c\udcff';
    panel.appendChild(title);

    // HUD row (score, turns)
    this.hudEl = document.createElement('div');
    Object.assign(this.hudEl.style, {
      display: 'flex', gap: '14px', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', letterSpacing: '0.1em', width: '100%',
    });
    panel.appendChild(this.hudEl);

    // Board wrapper
    const boardWrap = document.createElement('div');
    Object.assign(boardWrap.style, {
      position: 'relative', width: BOARD_W + 'px', height: BOARD_H + 'px',
      borderRadius: '6px', overflow: 'hidden',
      border: '2px solid rgba(212,168,67,0.35)',
    });

    const cvs = document.createElement('canvas');
    cvs.width = BOARD_W * 2;
    cvs.height = BOARD_H * 2;
    Object.assign(cvs.style, { width: BOARD_W + 'px', height: BOARD_H + 'px', display: 'block' });
    this.ctx2d = cvs.getContext('2d')!;
    boardWrap.appendChild(cvs);

    // Click handler on canvas
    cvs.addEventListener('click', (e) => this.handleBoardClick(e));

    panel.appendChild(boardWrap);

    // Sticks display + throw button
    this.sticksEl = document.createElement('div');
    Object.assign(this.sticksEl.style, {
      display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', minHeight: '44px',
    });
    panel.appendChild(this.sticksEl);

    const throwBtn = document.createElement('button');
    throwBtn.type = 'button';
    throwBtn.textContent = 'THROW STICKS';
    Object.assign(throwBtn.style, {
      padding: '10px 26px', border: '1px solid ' + C_GOLD,
      background: `linear-gradient(180deg, ${C_GOLD_LIGHT}, ${C_GOLD})`,
      color: C_DEEP_BROWN, letterSpacing: '0.16em', fontWeight: '700',
      cursor: 'pointer', borderRadius: '20px', fontSize: '14px', fontFamily: 'inherit',
      boxShadow: `0 4px 14px rgba(212,168,67,0.4)`,
    });
    throwBtn.addEventListener('click', () => this.throwSticks());
    this.throwBtn = throwBtn;
    panel.appendChild(throwBtn);

    // Status
    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, {
      fontSize: '13px', letterSpacing: '0.06em', textAlign: 'center', minHeight: '18px', color: C_SAND,
    });
    panel.appendChild(this.statusEl);

    // Reset button (hidden until lost)
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = 'TRY AGAIN';
    resetBtn.id = 'senet-reset-btn';
    Object.assign(resetBtn.style, {
      padding: '8px 18px', display: 'none',
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.25)',
      color: C_CREAM, fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.22em',
      fontWeight: '600', borderRadius: '5px', cursor: 'pointer',
    });
    resetBtn.addEventListener('click', () => this.resetGame());
    panel.appendChild(resetBtn);

    // Banner overlay
    this.bannerEl = document.createElement('div');
    Object.assign(this.bannerEl.style, {
      position: 'absolute', left: '50%', top: '50%',
      transform: 'translate(-50%,-50%) scale(0.9)', opacity: '0',
      transition: 'opacity 260ms ease, transform 320ms cubic-bezier(0.2,0.9,0.3,1.2)',
      pointerEvents: 'none', zIndex: '30',
    });
    root.appendChild(this.bannerEl);

    // Overlay for math trap
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    // Inject animation keyframe
    if (!document.getElementById('senet-anims')) {
      const style = document.createElement('style');
      style.id = 'senet-anims';
      style.textContent = `@keyframes senet-pop { from { transform: scale(0.92); opacity:0; } to { transform: scale(1); opacity:1; } }`;
      document.head.appendChild(style);
    }

    document.body.appendChild(root);
  }

  /* ═══════════════════ Canvas board drawing ══════════════════════ */

  private drawBoard(): void {
    const c = this.ctx2d!;
    const s = 2;
    c.clearRect(0, 0, BOARD_W * s, BOARD_H * s);
    c.save();
    c.scale(s, s);

    for (let pos = 0; pos < 30; pos++) {
      const { row, col } = posToRowCol(pos);
      const x = col * CELL_PX;
      const y = row * CELL_PX;
      const special = SPECIAL[pos];
      const isTrap = this.trapSquares.has(pos);
      const isAlt = (row + col) % 2 === 0;

      // Background fill
      let fill: string;
      if (special) fill = special.bg;
      else if (isTrap) fill = '#1E0F2E';
      else fill = isAlt ? C_CELL_ALT : C_CELL_DARK;
      c.fillStyle = fill;
      c.fillRect(x, y, CELL_PX, CELL_PX);

      // Border
      c.strokeStyle = special ? special.color + 'aa' : isTrap ? C_THOTH_PURPLE + '99' : 'rgba(255,195,90,0.1)';
      c.lineWidth = special ? 1.5 : 0.5;
      c.strokeRect(x, y, CELL_PX, CELL_PX);

      // Corner glyphs
      c.fillStyle = 'rgba(201,168,76,0.25)';
      const d = 4;
      c.fillRect(x + 2, y + 2, d, 1);
      c.fillRect(x + 2, y + 2, 1, d);
      c.fillRect(x + CELL_PX - 2 - d, y + 2, d, 1);
      c.fillRect(x + CELL_PX - 3, y + 2, 1, d);

      // Special icon
      if (special) {
        c.fillStyle = special.color;
        c.font = special.icon.length > 1 ? 'bold 10px serif' : 'bold 16px serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(special.icon, x + CELL_PX / 2, y + CELL_PX / 2 - 2);
        c.font = '600 7px Rajdhani, system-ui';
        c.fillText(String(pos + 1), x + CELL_PX / 2, y + CELL_PX - 5);
      } else if (isTrap) {
        // Thoth ibis
        this.drawThothIbis(c, x + CELL_PX / 2, y + CELL_PX / 2 - 2, CELL_PX * 0.28);
        c.fillStyle = C_THOTH_PURPLE + 'aa';
        c.font = '600 7px Rajdhani, system-ui';
        c.textAlign = 'center';
        c.fillText(String(pos + 1), x + CELL_PX / 2, y + CELL_PX - 5);
      } else {
        // Cell number
        c.fillStyle = 'rgba(245,230,204,0.22)';
        c.font = '600 8px Rajdhani, system-ui';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(String(pos + 1), x + CELL_PX / 2, y + CELL_PX / 2);
      }
    }

    // Draw pieces
    this.drawPieces(c);

    c.restore();
  }

  private drawPieces(c: CanvasRenderingContext2D): void {
    // Draw opponent pieces (Eye of Horus)
    for (const pos of this.opponentPieces) {
      if (pos >= OFF_BOARD) continue;
      const { x, y } = cellCenter(pos);
      this.drawEyePiece(c, x, y, CELL_PX * 0.32);
    }
    // Draw player pieces (Ankh)
    for (let i = 0; i < this.playerPieces.length; i++) {
      const pos = this.playerPieces[i];
      if (pos >= OFF_BOARD) continue;
      const { x, y } = cellCenter(pos);
      const canSelect = this.phase === 'threw' && this.validDestinations.has(i);
      this.drawAnkhPiece(c, x, y, CELL_PX * 0.32, canSelect);
    }
    // Draw valid destination markers
    if (this.phase === 'threw') {
      for (const [, dest] of this.validDestinations) {
        if (dest >= OFF_BOARD) continue;
        const { x, y } = cellCenter(dest);
        const { row, col } = posToRowCol(dest);
        const sx = col * CELL_PX, sy = row * CELL_PX;
        c.strokeStyle = C_GOLD;
        c.lineWidth = 1.5;
        c.strokeRect(sx + 1, sy + 1, CELL_PX - 2, CELL_PX - 2);
        c.fillStyle = C_GOLD + '33';
        c.fillRect(sx, sy, CELL_PX, CELL_PX);
        // Small dot if empty
        const hasOpponent = this.opponentPieces.includes(dest);
        const hasPlayer = this.playerPieces.includes(dest);
        if (!hasOpponent && !hasPlayer) {
          c.beginPath();
          c.arc(x, y, 3, 0, Math.PI * 2);
          c.fillStyle = C_GOLD + '88';
          c.fill();
        }
      }
    }
  }

  private drawAnkhPiece(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, highlight: boolean): void {
    c.save();
    c.strokeStyle = C_PLAYER;
    c.fillStyle = C_PLAYER;
    c.lineWidth = Math.max(1.5, r * 0.18);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    // Loop
    c.beginPath();
    c.ellipse(cx, cy - r * 0.5, r * 0.4, r * 0.45, 0, 0, Math.PI * 2);
    c.stroke();
    // Shaft
    c.beginPath();
    c.moveTo(cx, cy - r * 0.05);
    c.lineTo(cx, cy + r * 0.85);
    c.stroke();
    // Crossbar
    c.beginPath();
    c.moveTo(cx - r * 0.55, cy + r * 0.1);
    c.lineTo(cx + r * 0.55, cy + r * 0.1);
    c.stroke();
    // Highlight glow
    if (highlight) {
      c.shadowColor = C_GOLD_LIGHT;
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
      c.strokeStyle = C_GOLD + '55';
      c.lineWidth = 1;
      c.stroke();
    }
    c.restore();
  }

  private drawEyePiece(c: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    c.save();
    // Almond
    c.beginPath();
    c.moveTo(cx - r, cy);
    c.quadraticCurveTo(cx, cy - r * 0.8, cx + r, cy);
    c.quadraticCurveTo(cx, cy + r * 0.8, cx - r, cy);
    c.closePath();
    c.fillStyle = C_OPPONENT;
    c.fill();
    c.strokeStyle = C_OPPONENT_STROKE;
    c.lineWidth = Math.max(1, r * 0.1);
    c.stroke();
    // Iris
    c.fillStyle = '#8AA8E0';
    c.beginPath();
    c.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
    c.fill();
    // Pupil
    c.fillStyle = C_OPPONENT_PUPIL;
    c.beginPath();
    c.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  private drawThothIbis(c: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    c.save();
    c.strokeStyle = C_THOTH_PURPLE + 'cc';
    c.lineWidth = Math.max(1, r * 0.1);
    c.lineCap = 'round';
    c.beginPath();
    c.ellipse(cx, cy - r * 0.1, r * 0.4, r * 0.45, 0, 0, Math.PI * 2);
    c.stroke();
    // Beak
    c.beginPath();
    c.moveTo(cx + r * 0.3, cy);
    c.quadraticCurveTo(cx + r * 0.8, cy + r * 0.2, cx + r * 0.4, cy + r * 0.6);
    c.stroke();
    // Eye
    c.fillStyle = C_THOTH_PURPLE + 'dd';
    c.beginPath();
    c.arc(cx - r * 0.12, cy - r * 0.18, r * 0.07, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  /* ═══════════════════ Pawn placement (redraw board) ════════════ */

  private placePawns(_animate: boolean): void {
    this.drawBoard();
  }

  /* ═══════════════════ UI refresh ════════════════════════════════ */

  private refreshUI(): void {
    const playerOff = this.playerPieces.filter(p => p >= OFF_BOARD).length;
    const opponentOff = this.opponentPieces.filter(p => p >= OFF_BOARD).length;
    const turnsLeft = this.maxTurns - this.turnCount;

    if (this.hudEl) {
      this.hudEl.innerHTML = '';
      // Player score
      const ps = document.createElement('span');
      ps.style.color = C_GOLD;
      ps.textContent = `\u2625 ${playerOff}/${this.pieceCount}`;
      // Turns
      const ts = document.createElement('span');
      ts.style.color = turnsLeft <= 10 ? C_DANGER_RED : C_SAND + 'aa';
      ts.textContent = `TURN ${this.turnCount}/${this.maxTurns}`;
      // Opponent score
      const os = document.createElement('span');
      os.style.color = C_WATER_BLUE;
      os.textContent = `${opponentOff}/${this.pieceCount} \ud80c\udc39`;
      this.hudEl.append(ps, ts, os);
    }

    // Sticks display
    if (this.sticksEl) {
      this.sticksEl.innerHTML = '';
      for (let i = 0; i < 4; i++) {
        const stick = document.createElement('div');
        const marked = this.stickStates[i];
        Object.assign(stick.style, {
          width: '12px', height: '36px', borderRadius: '3px',
          background: marked
            ? `linear-gradient(180deg, ${C_GOLD_LIGHT}, ${C_GOLD})`
            : `linear-gradient(180deg, ${C_DEEP_BROWN}, #1A0F08)`,
          border: `1px solid ${C_GOLD}88`,
        });
        this.sticksEl.appendChild(stick);
      }
      if (this.throwResult > 0) {
        const label = document.createElement('span');
        label.style.color = C_GOLD;
        label.style.fontWeight = '700';
        label.style.fontSize = '16px';
        label.style.fontVariantNumeric = 'tabular-nums';
        label.textContent = `= ${this.throwResult}`;
        if (this.hasExtraTurn) label.textContent += ' \u27f3';
        this.sticksEl.appendChild(label);
      }
    }

    // Throw button
    if (this.throwBtn) {
      const canThrow = this.phase === 'ready' && this.isPlayerTurn;
      this.throwBtn.style.display = canThrow ? 'inline-block' : 'none';
    }

    // Reset button
    const resetBtn = document.getElementById('senet-reset-btn') as HTMLButtonElement | null;
    if (resetBtn) resetBtn.style.display = this.phase === 'lost' ? 'inline-block' : 'none';

    this.drawBoard();
  }

  private showStatus(msg: string, color?: string): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.style.color = color ?? C_SAND;
  }

  /* ═══════════════════ Banner ════════════════════════════════════ */

  private showBanner(icon: string, title: string, desc: string, color: string, hold = 2.8): void {
    if (!this.bannerEl) return;
    this.bannerTimer = hold;
    this.bannerEl.innerHTML = `
      <div style="position:relative;min-width:300px;max-width:400px;padding:18px 28px;background:linear-gradient(180deg,#1E1610,#2A1F14,#1E1610);border:1.5px solid ${color}88;border-radius:10px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,0.6);">
        <div style="position:absolute;top:6px;left:6px;width:8px;height:8px;border-left:1.5px solid ${color};border-top:1.5px solid ${color};opacity:0.5"></div>
        <div style="position:absolute;top:6px;right:6px;width:8px;height:8px;border-right:1.5px solid ${color};border-top:1.5px solid ${color};opacity:0.5"></div>
        <div style="position:absolute;bottom:6px;left:6px;width:8px;height:8px;border-left:1.5px solid ${color};border-bottom:1.5px solid ${color};opacity:0.5"></div>
        <div style="position:absolute;bottom:6px;right:6px;width:8px;height:8px;border-right:1.5px solid ${color};border-bottom:1.5px solid ${color};opacity:0.5"></div>
        <div style="font-size:28px;line-height:1;color:${color}">${icon}</div>
        <div style="font-size:15px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${color};margin-top:8px">${title}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.72);margin-top:5px;letter-spacing:0.04em">${desc}</div>
      </div>`;
    this.bannerEl.style.opacity = '1';
    this.bannerEl.style.transform = 'translate(-50%,-50%) scale(1)';
  }

  private updateBanner(dt: number): void {
    if (!this.bannerEl || this.bannerTimer <= 0) return;
    this.bannerTimer -= dt;
    if (this.bannerTimer <= 0) {
      this.bannerEl.style.opacity = '0';
      this.bannerEl.style.transform = 'translate(-50%,-50%) scale(0.9)';
    }
  }

  /* ═══════════════════ Throw sticks ═════════════════════════════ */

  /** Roll fairly: 4 random booleans, count marked, 0 marked = 5. */
  private rollFair(): { marked: boolean[]; result: number } {
    const m = Array.from({ length: 4 }, () => Math.random() < 0.5);
    const c = m.filter(v => v).length;
    return { marked: m, result: c === 0 ? 5 : c };
  }

  /** Smart player roll: best of 2 (iOS mechanic). */
  private rollSmartPlayer(): { marked: boolean[]; result: number } {
    const r1 = this.rollFair();
    const r2 = this.rollFair();
    const m1 = this.computeValidMoves(this.playerPieces, this.opponentPieces, r1.result);
    const m2 = this.computeValidMoves(this.playerPieces, this.opponentPieces, r2.result);
    if (m1.size === 0 && m2.size > 0) return r2;
    if (m1.size > 0 && m2.size === 0) return r1;
    return r1.result >= r2.result ? r1 : r2;
  }

  /** Disadvantage AI roll: worst of 2 (iOS mechanic). */
  private rollDisadvantage(): { marked: boolean[]; result: number } {
    const r1 = this.rollFair();
    const r2 = this.rollFair();
    return r1.result <= r2.result ? r1 : r2;
  }

  private throwSticks(): void {
    if (this.phase !== 'ready' || !this.isPlayerTurn) return;

    const { marked, result } = this.rollSmartPlayer();
    this.stickStates = marked;
    this.throwResult = result;
    this.hasExtraTurn = result === 1 || result === 4 || result === 5;
    this.turnCount++;

    const moves = this.computeValidMoves(this.playerPieces, this.opponentPieces, result);
    this.validDestinations = moves;

    if (moves.size === 0) {
      this.phase = 'no-moves';
      this.showStatus('No legal moves \u2014 turn passes.', C_SAND + 'aa');
      this.refreshUI();
      setTimeout(() => this.endPlayerTurn(), 1000);
    } else if (moves.size === 1) {
      // Auto-move when only one option
      this.phase = 'threw';
      this.refreshUI();
      const [idx, dest] = moves.entries().next().value!;
      setTimeout(() => this.executePlayerMove(idx, dest), 400);
    } else {
      this.phase = 'threw';
      this.showStatus('Select an Ankh piece to move.', C_GOLD);
      this.refreshUI();
    }
  }

  /* ═══════════════════ Move computation (iOS logic) ═════════════ */

  private computeValidMoves(pieces: number[], against: number[], roll: number): Map<number, number> {
    const moves = new Map<number, number>();

    for (let idx = 0; idx < pieces.length; idx++) {
      const pos = pieces[idx];
      if (pos >= OFF_BOARD) continue;
      const dest = pos + roll;

      // Squares >= 27: can only exit with exact roll
      if (pos >= 27) {
        if (roll === OFF_BOARD - pos) moves.set(idx, OFF_BOARD);
        continue;
      }

      if (dest >= OFF_BOARD) {
        // Exact exit from squares >= 25
        if (pos >= 25 && dest === OFF_BOARD) { moves.set(idx, OFF_BOARD); }
        // Bounce back
        if (dest > OFF_BOARD && pos < 27) {
          const bounce = OFF_BOARD - (dest - OFF_BOARD);
          if (bounce >= 0 && bounce < OFF_BOARD && !pieces.includes(bounce)) {
            moves.set(idx, bounce);
          }
        }
        continue;
      }

      // Can't land on own piece
      if (pieces.includes(dest)) continue;

      // Capture check
      if (against.includes(dest)) {
        const prot = against.some(p => p !== dest && Math.abs(p - dest) === 1 && p < OFF_BOARD);
        if (prot) continue;
        if (dest === 25) continue; // Beauty protects
      }

      moves.set(idx, dest);
    }

    // Backward moves if no forward moves available (level >= 2)
    if (moves.size === 0 && this.level >= 2) {
      for (let idx = 0; idx < pieces.length; idx++) {
        const pos = pieces[idx];
        if (pos >= OFF_BOARD) continue;
        const backDest = pos - roll;
        if (backDest < 0) continue;
        if (pieces.includes(backDest)) continue;

        if (against.includes(backDest)) {
          const prot = against.some(p => p !== backDest && Math.abs(p - backDest) === 1 && p < OFF_BOARD);
          if (prot) continue;
          if (backDest === 25) continue;
        }

        moves.set(idx, backDest);
      }
    }

    return moves;
  }

  /* ═══════════════════ Board click handling ══════════════════════ */

  private handleBoardClick(e: MouseEvent): void {
    if (this.phase !== 'threw') return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const scaleX = BOARD_W / rect.width;
    const scaleY = BOARD_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(mx / CELL_PX);
    const row = Math.floor(my / CELL_PX);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    const clickedPos = rowColToPos(row, col);

    // Check if clicking a player piece that has a valid move
    for (const [idx, dest] of this.validDestinations) {
      if (this.playerPieces[idx] === clickedPos) {
        this.executePlayerMove(idx, dest);
        return;
      }
    }

    // Check if clicking a valid destination
    for (const [idx, dest] of this.validDestinations) {
      if (dest === clickedPos) {
        this.executePlayerMove(idx, dest);
        return;
      }
    }
  }

  /* ═══════════════════ Player move ═══════════════════════════════ */

  private executePlayerMove(pieceIndex: number, dest: number): void {
    const from = this.playerPieces[pieceIndex];

    // Capture?
    if (dest < OFF_BOARD) {
      const capturedIdx = this.opponentPieces.indexOf(dest);
      if (capturedIdx >= 0) {
        this.opponentPieces[capturedIdx] = from;
        this.showBanner('\ud80c\udcdd', 'Captured!', 'An Eye is banished.', C_DANGER_RED, 2.0);
      }
    }

    this.playerPieces[pieceIndex] = dest;
    this.validDestinations.clear();
    this.phase = 'moving';

    // Handle bearing off
    if (dest >= OFF_BOARD) {
      this.showStatus('\u2600 An Ankh crosses to the afterlife.', C_GOLD);
      this.drawBoard();
      this.handleSpecialLanding(pieceIndex, dest, from, true);
      return;
    }

    this.drawBoard();
    this.handleSpecialLanding(pieceIndex, dest, from, true);
  }

  /* ═══════════════════ Special landing (iOS logic) ═══════════════ */

  private handleSpecialLanding(pieceIndex: number, dest: number, from: number, isPlayer: boolean): void {
    // Math trap (player only)
    if (isPlayer && this.trapSquares.has(dest) && dest < OFF_BOARD) {
      this.triggerMathTrap(pieceIndex, from);
      return;
    }

    // House of Water (26) => drown, respawn near 14
    if (dest === 26) {
      this.showBanner('\u301C', 'House of Water', 'Swept back to Rebirth.', C_WATER_BLUE, 2.0);
      const respawn = this.findRespawnPosition(14,
        isPlayer ? this.playerPieces : this.opponentPieces,
        isPlayer ? this.opponentPieces : this.playerPieces);
      if (isPlayer) this.playerPieces[pieceIndex] = respawn;
      else this.opponentPieces[pieceIndex] = respawn;
      this.drawBoard();
      if (isPlayer) {
        setTimeout(() => this.finishPlayerTurn(), 600);
      }
      return;
    }

    // House of Beauty (25) => extra turn
    if (dest === 25) {
      this.hasExtraTurn = true;
      if (isPlayer) this.showBanner('\u2726', 'House of Beauty', 'Safe haven \u00b7 another throw.', C_GOLD, 2.0);
    }

    // House of Rebirth (14)
    if (dest === 14 && from !== 14) {
      if (isPlayer) this.showBanner('\u2625', 'House of Rebirth', 'The journey begins anew.', C_SPIRIT_GREEN, 2.0);
    }

    // Three Truths (27)
    if (dest === 27 && isPlayer) {
      this.showBanner('III', 'House of Three Truths', 'Judgement awaits.', '#E8A030', 2.0);
    }

    // Re-Atum (28)
    if (dest === 28 && isPlayer) {
      this.showBanner('II', 'House of Re-Atum', 'Eternal return.', '#E8A030', 2.0);
    }

    // Departure (29)
    if (dest === 29 && isPlayer) {
      this.showBanner('\u2600', 'House of Departure', 'The final threshold.', C_GOLD, 2.0);
    }

    // Bearing off
    if (dest >= OFF_BOARD && isPlayer) {
      this.showStatus('\u2600 An Ankh crosses to the afterlife.', C_GOLD);
    }

    if (isPlayer) this.finishPlayerTurn();
  }

  private finishPlayerTurn(): void {
    this.validDestinations.clear();

    // Check win
    if (this.playerPieces.every(p => p >= OFF_BOARD)) {
      this.phase = 'won';
      this.isSolved = true;
      this.showBanner('\ud80c\udd43', 'Victory', 'The Ankhs cross into eternity.', C_SPIRIT_GREEN, 3.5);
      this.showStatus('VICTORY \u2014 All Ankhs departed.', C_SPIRIT_GREEN);
      this.refreshUI();
      setTimeout(() => this.onSolved?.(), 2000);
      return;
    }

    // Check turn limit
    if (this.turnCount >= this.maxTurns) {
      this.phase = 'lost';
      this.showBanner('\ud80c\udc39', 'Turns Exhausted', 'The path remains unfinished.', C_DANGER_RED, 3.5);
      this.showStatus('DEFEAT \u2014 Turns exhausted.', C_DANGER_RED);
      this.refreshUI();
      return;
    }

    this.endPlayerTurn();
  }

  private endPlayerTurn(): void {
    if (this.hasExtraTurn) {
      this.hasExtraTurn = false;
      this.phase = 'ready';
      this.throwResult = 0;
      this.showStatus('\u27f3 Extra turn!', C_SPIRIT_GREEN);
      this.refreshUI();
      return;
    }

    this.isPlayerTurn = false;
    this.phase = 'opponent-think';
    this.throwResult = 0;
    this.showStatus('Opponent is thinking...', C_SAND + 'aa');
    this.refreshUI();
    setTimeout(() => this.executeOpponentTurn(), 800);
  }

  /* ═══════════════════ Opponent AI (iOS logic) ═══════════════════ */

  private executeOpponentTurn(): void {
    if (this.phase === 'won' || this.phase === 'lost') return;

    const { marked, result } = this.rollDisadvantage();
    let opponentExtra = result === 1 || result === 4 || result === 5;

    this.stickStates = marked;
    this.throwResult = result;

    const moves = this.computeValidMoves(this.opponentPieces, this.playerPieces, result);

    if (moves.size === 0) {
      this.showStatus(`Opponent rolled ${result} \u2014 no moves.`, C_SAND + 'aa');
      this.refreshUI();
      setTimeout(() => this.returnTurnToPlayer(opponentExtra), 800);
      return;
    }

    // AI move selection (iOS chooseBestMove logic)
    const bestIdx = this.chooseBestMove(moves, this.opponentPieces, this.playerPieces);
    if (bestIdx === null) {
      setTimeout(() => this.returnTurnToPlayer(opponentExtra), 600);
      return;
    }

    const dest = moves.get(bestIdx)!;
    const from = this.opponentPieces[bestIdx];

    // Capture?
    if (dest < OFF_BOARD) {
      const capturedIdx = this.playerPieces.indexOf(dest);
      if (capturedIdx >= 0) {
        this.playerPieces[capturedIdx] = from;
        this.showBanner('\ud80c\udcdd', 'The Gods Strike', 'An Ankh is driven back.', C_DANGER_RED, 2.0);
      }
    }

    this.opponentPieces[bestIdx] = dest;
    this.refreshUI();

    // Handle special landing for opponent
    setTimeout(() => {
      // House of Water
      if (dest === 26) {
        const respawn = this.findRespawnPosition(14, this.opponentPieces, this.playerPieces);
        this.opponentPieces[bestIdx] = respawn;
        this.refreshUI();
        setTimeout(() => this.returnTurnToPlayer(false), 600);
        return;
      }

      // Beauty => extra
      if (dest === 25) opponentExtra = true;

      // Check opponent win
      if (this.opponentPieces.every(p => p >= OFF_BOARD)) {
        this.phase = 'lost';
        this.showBanner('\ud80c\udc39', 'The Gods Prevail', 'Chronos laughs.', C_DANGER_RED, 3.5);
        this.showStatus('DEFEAT \u2014 The opponent escaped.', C_DANGER_RED);
        this.refreshUI();
        return;
      }

      if (dest >= OFF_BOARD) {
        this.showStatus('An Eye crosses to the afterlife.', C_WATER_BLUE);
      }

      this.returnTurnToPlayer(opponentExtra);
    }, 500);
  }

  private returnTurnToPlayer(opponentExtra: boolean): void {
    if (this.phase === 'won' || this.phase === 'lost') return;

    if (opponentExtra && !this.opponentPieces.every(p => p >= OFF_BOARD)) {
      setTimeout(() => this.executeOpponentTurn(), 600);
      return;
    }

    this.isPlayerTurn = true;
    this.phase = 'ready';
    this.throwResult = 0;
    this.showStatus('Your turn \u2014 throw the sticks.', C_GOLD);
    this.refreshUI();
  }

  private chooseBestMove(moves: Map<number, number>, pieces: number[], against: number[]): number | null {
    if (moves.size === 0) return null;
    let bestIdx: number | null = null;
    let bestScore = -Infinity;

    for (const [idx, dest] of moves) {
      const from = pieces[idx];
      let score = dest * 2;
      if (dest >= OFF_BOARD) score += 150;
      if (against.includes(dest) && dest < OFF_BOARD) score += 60;
      if (dest === 26) score -= 120;
      if (dest === 25) score += 45;
      if (dest === 27 || dest === 28) score += 20;

      if (this.level >= 3) {
        const willProtect = pieces.some((p, i) => i !== idx && Math.abs(p - dest) === 1 && p < OFF_BOARD);
        if (willProtect) score += 15;
        const wasProtecting = pieces.some((p, i) => i !== idx && Math.abs(p - from) === 1 && p < OFF_BOARD);
        if (wasProtecting) score -= 8;
      }
      if (this.level >= 4) {
        const nearEnemy = against.some(p => Math.abs(p - dest) === 1 && p < OFF_BOARD);
        const willProtect = pieces.some((p, i) => i !== idx && Math.abs(p - dest) === 1 && p < OFF_BOARD);
        if (nearEnemy && !willProtect) score -= 15;
      }
      if (this.level >= 5 && from < 10) score += 10;

      if (score > bestScore) { bestScore = score; bestIdx = idx; }
    }
    return bestIdx;
  }

  /* ═══════════════════ Math trap ═════════════════════════════════ */

  private triggerMathTrap(pieceIndex: number, previousPos: number): void {
    let candidate: Trap;
    let tries = 0;
    do { candidate = generateTrap(this.level); tries++; }
    while (this.recentPrompts.includes(candidate.prompt) && tries < 24);
    this.recentPrompts.push(candidate.prompt);
    if (this.recentPrompts.length > 20) this.recentPrompts.shift();

    this.trapQuestion = candidate.prompt;
    this.trapAnswer = candidate.answer;
    this.trapInput = '';
    this.trapPieceIndex = pieceIndex;
    this.trapPreviousPos = previousPos;
    this.trapTimer = TRAP_TIME;
    this.trapActive = true;
    this.phase = 'math-trap';

    this.showBanner('\ud80c\udc39', 'Thoth Challenges You', 'Answer within 10 seconds.', C_THOTH_PURPLE, 1.8);
    this.renderTrapOverlay();
    this.startTrapCountdown();
  }

  private renderTrapOverlay(): void {
    if (!this.overlayEl) return;
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '340px', width: '90%', padding: '0',
      background: `linear-gradient(to bottom, #140C22, #1E1230, #140C22)`,
      border: `1.5px solid ${C_THOTH_PURPLE}88`,
      borderRadius: '14px', boxShadow: `0 0 30px ${C_THOTH_PURPLE}22`,
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      animation: 'senet-pop 0.25s ease-out',
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      padding: '14px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    });
    const titleEl = document.createElement('div');
    Object.assign(titleEl.style, { color: C_THOTH_PURPLE, fontSize: '14px', fontWeight: '700', letterSpacing: '0.08em' });
    titleEl.textContent = '\ud80c\udc39 THOTH\u2019S TRAP';
    const timerEl = document.createElement('div');
    timerEl.id = 'senet-trap-timer';
    Object.assign(timerEl.style, { color: C_GOLD, fontSize: '20px', fontWeight: '900', fontVariantNumeric: 'tabular-nums' });
    timerEl.textContent = `${TRAP_TIME}`;
    header.append(titleEl, timerEl);
    card.appendChild(header);

    // Question
    const promptEl = document.createElement('div');
    Object.assign(promptEl.style, {
      padding: '4px 18px 10px', textAlign: 'center', color: C_SAND,
      fontSize: '15px', fontWeight: '500', lineHeight: '1.5',
    });
    promptEl.textContent = this.trapQuestion;
    card.appendChild(promptEl);

    // Answer display
    const ansEl = document.createElement('div');
    ansEl.id = 'senet-trap-answer';
    Object.assign(ansEl.style, {
      margin: '0 18px 10px', padding: '10px', textAlign: 'center',
      fontSize: '24px', fontWeight: '700', fontVariantNumeric: 'tabular-nums',
      color: C_GOLD, background: C_DEEP_BROWN, borderRadius: '8px',
      border: `1.5px solid ${C_THOTH_PURPLE}77`,
    });
    ansEl.textContent = '?';
    card.appendChild(ansEl);

    // Numpad
    const pad = document.createElement('div');
    Object.assign(pad.style, {
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px',
      padding: '0 18px 14px',
    });
    const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '\u232b', '0', '\u2713'];
    for (const k of keys) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = k;
      Object.assign(btn.style, {
        padding: '12px 0', border: `1px solid ${C_THOTH_PURPLE}55`,
        background: k === '\u2713'
          ? `linear-gradient(180deg, #C888E8, ${C_THOTH_PURPLE})`
          : '#1E1230',
        color: k === '\u2713' ? '#140C22' : k === '\u232b' ? C_DANGER_RED : C_SAND,
        fontSize: '18px', fontWeight: '700', fontFamily: 'inherit',
        borderRadius: '6px', cursor: 'pointer',
      });
      btn.addEventListener('click', () => this.onTrapKey(k));
      pad.appendChild(btn);
    }
    card.appendChild(pad);

    this.overlayEl.innerHTML = '';
    this.overlayEl.appendChild(card);
  }

  private onTrapKey(k: string): void {
    if (!this.trapActive) return;
    if (k === '\u232b') {
      this.trapInput = this.trapInput.slice(0, -1);
    } else if (k === '\u2713') {
      this.submitTrap();
      return;
    } else if (this.trapInput.length < 6) {
      this.trapInput += k;
    }
    const el = document.getElementById('senet-trap-answer');
    if (el) el.textContent = this.trapInput || '?';
  }

  private startTrapCountdown(): void {
    clearInterval(this.trapTimerId);
    this.trapTimerId = window.setInterval(() => {
      if (!this.trapActive) { clearInterval(this.trapTimerId); return; }
      this.trapTimer--;
      const el = document.getElementById('senet-trap-timer');
      if (el) {
        el.textContent = String(Math.max(0, this.trapTimer));
        el.style.color = this.trapTimer <= 3 ? C_DANGER_RED : C_GOLD;
      }
      if (this.trapTimer <= 0) {
        this.failTrap(true);
      }
    }, 1000);
  }

  private submitTrap(): void {
    if (!this.trapActive) return;
    clearInterval(this.trapTimerId);
    const val = parseInt(this.trapInput, 10);
    if (!isNaN(val) && val === this.trapAnswer) {
      this.trapActive = false;
      if (this.overlayEl) this.overlayEl.style.display = 'none';
      this.showBanner('\u2625', 'Thoth Approves', 'Your piece holds the square.', C_SPIRIT_GREEN, 2.0);
      this.phase = 'moving';
      this.finishPlayerTurn();
    } else {
      this.failTrap(false);
    }
  }

  private failTrap(timedOut: boolean): void {
    clearInterval(this.trapTimerId);
    this.trapActive = false;
    if (this.overlayEl) this.overlayEl.style.display = 'none';

    const correctAnswer = this.trapAnswer;
    this.showBanner('\ud80c\udc39',
      timedOut ? 'Out of Time' : 'Thoth Denies You',
      timedOut ? 'The hourglass runs dry.' : `Answer was ${correctAnswer}. Your piece retreats.`,
      C_DANGER_RED, 2.4);

    // Snap piece back
    this.playerPieces[this.trapPieceIndex] = this.trapPreviousPos;
    this.hasExtraTurn = false;
    this.phase = 'moving';
    this.drawBoard();
    setTimeout(() => this.finishPlayerTurn(), 800);
  }

  /* ═══════════════════ Helpers ═══════════════════════════════════ */

  private findRespawnPosition(target: number, own: number[], other: number[]): number {
    if (!own.includes(target) && !other.includes(target)) return target;
    for (let offset = 1; offset < 30; offset++) {
      const before = target - offset;
      if (before >= 0 && !own.includes(before) && !other.includes(before)) return before;
      const after = target + offset;
      if (after < 30 && !own.includes(after) && !other.includes(after)) return after;
    }
    return 0;
  }

  private resetGame(): void {
    this.setupLevel();
    this.drawBoard();
    this.refreshUI();
    this.showStatus('Your turn \u2014 throw the sticks.', C_GOLD);
  }

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
    this.updateBanner(dt);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {
    // Board clicks handled via DOM event on canvas
  }

  override dispose(): void {
    clearInterval(this.trapTimerId);
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('senet-anims');
    if (animStyle) animStyle.remove();
    this.ctx2d = null;
    this.hudEl = null;
    this.statusEl = null;
    this.sticksEl = null;
    this.throwBtn = null;
    this.overlayEl = null;
    this.bannerEl = null;
    super.dispose();
  }
}
