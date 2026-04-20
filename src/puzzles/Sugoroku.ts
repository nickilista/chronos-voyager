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
 * Sugoroku (双六) — Edo-era race board game aligned with iOS implementation.
 *
 * Navigate a serpentine path through Edo Japan by rolling dice and solving
 * mathematical/historical challenges. Features:
 *   - Space types: start, path, torii (challenge), sakura (bonus roll),
 *     wave (trap), castle (checkpoint), moon (mystery), finish
 *   - Lives system (lose a life on wrong answers; game over at 0)
 *   - Dice rolling with animation; 2 dice at level 2+ (choose which to use)
 *   - Timed challenges (10s countdown)
 *   - Correct answer: bonus advance; wrong: lose life, retreat to start
 *   - Castle checkpoints limit wave retreat
 *   - Moon: random bonus advance or retreat
 *   - Level-based board layouts (1–5)
 */

/* ── Space types ─────────────────────────────────────────────── */

type SpaceType = 'start' | 'path' | 'torii' | 'sakura' | 'wave' | 'castle' | 'moon' | 'finish';

interface SugorokuSpace {
  id: number;
  type: SpaceType;
  waveBack: number;
}

/* ── Question model ──────────────────────────────────────────── */

interface SugorokuQuestion {
  text: string;
  options: string[];
  correctIndex: number;
}

/* ── Phase ───────────────────────────────────────────────────── */

type Phase = 'idle' | 'rolling' | 'chooseDie' | 'moving' | 'challenge' | 'won' | 'lost';

/* ── Level config ────────────────────────────────────────────── */

const LEVEL = 5; // max difficulty
const SPACES_PER_ROW = 5;
const TILE_W = 44;
const TILE_GAP = 10;
const CHALLENGE_TIME = 10;

function initialLives(level: number): number {
  return [4, 3, 3, 2, 2][Math.min(level - 1, 4)];
}
function diceCount(level: number): number { return level >= 2 ? 2 : 1; }
function correctBonus(level: number): number { return level >= 4 ? 2 : 1; }
function exactLanding(level: number): boolean { return level >= 4; }

/* ── Colors (Edo Japan palette, matches iOS) ─────────────────── */

const C_BG_INDIGO = '#1A0F2E';
const C_BOARD_WOOD = '#2D1F0E';
const C_PATH_GOLD = '#D4AF37';
const C_PAPER = '#F5E6C8';
const C_CRIMSON = '#C41E3A';
const C_SAKURA_PINK = '#FFB7C5';
const C_WAVE_BLUE = '#4A90D9';
const C_CASTLE_STONE = '#8B7D6B';
const C_MOON_YELLOW = '#FFD700';
const C_TEXT_CREAM = '#FFF5E6';
const C_GOOD_GREEN = '#00B894';
const C_BAD_RED = '#E74C3C';

/* ── Board layouts (matches iOS 5-level system) ──────────────── */

function buildBoard(level: number): SugorokuSpace[] {
  const layouts: SpaceType[][] = [
    // Level 1: 14 spaces
    ['start', 'path', 'torii', 'sakura', 'path', 'torii', 'path', 'wave',
     'castle', 'torii', 'sakura', 'path', 'torii', 'finish'],
    // Level 2: 18 spaces
    ['start', 'path', 'torii', 'path', 'wave', 'sakura', 'torii', 'path',
     'castle', 'torii', 'path', 'wave', 'path', 'torii', 'sakura', 'wave',
     'torii', 'finish'],
    // Level 3: 22 spaces
    ['start', 'path', 'torii', 'sakura', 'wave', 'path', 'torii', 'castle',
     'moon', 'torii', 'path', 'wave', 'sakura', 'torii', 'moon', 'path',
     'castle', 'torii', 'path', 'wave', 'torii', 'finish'],
    // Level 4: 26 spaces
    ['start', 'path', 'torii', 'moon', 'wave', 'path', 'torii', 'castle',
     'moon', 'torii', 'path', 'wave', 'sakura', 'torii', 'moon', 'wave',
     'path', 'torii', 'castle', 'moon', 'torii', 'path', 'wave', 'path',
     'torii', 'finish'],
    // Level 5: 30 spaces
    ['start', 'torii', 'moon', 'wave', 'path', 'torii', 'castle', 'moon',
     'torii', 'sakura', 'wave', 'torii', 'castle', 'torii', 'moon', 'wave',
     'path', 'torii', 'castle', 'torii', 'moon', 'wave', 'torii', 'path',
     'wave', 'sakura', 'torii', 'path', 'wave', 'finish'],
  ];

  const waveMap: Record<number, Record<number, number>> = {
    1: { 7: 2 },
    2: { 4: 2, 11: 2, 15: 2 },
    3: { 4: 2, 11: 2, 19: 2 },
    4: { 4: 2, 11: 2, 15: 2, 22: 2 },
    5: { 3: 2, 10: 2, 15: 2, 21: 2, 24: 2, 28: 2 },
  };

  const lvl = Math.min(Math.max(level, 1), 5);
  const types = layouts[lvl - 1];
  const waves = waveMap[lvl] || {};
  return types.map((type, idx) => ({ id: idx, type, waveBack: waves[idx] ?? 2 }));
}

/* ── Question generation (matches iOS: math + historical) ────── */

function generateQuestion(level: number): SugorokuQuestion {
  // ~40% historical, ~60% math
  if (Math.random() < 0.4) return historicalQuestion(level);
  return mathQuestion(level);
}

function historicalQuestion(level: number): SugorokuQuestion {
  type QEntry = { q: string; opts: string[]; correct: number };
  let pool: QEntry[];

  if (level <= 2) {
    pool = [
      { q: 'Who was the first Tokugawa shogun?', opts: ['Tokugawa Ieyasu', 'Minamoto Yoritomo', 'Ashikaga Takauji', 'Toyotomi Hideyoshi'], correct: 0 },
      { q: 'What was the capital during the Edo period?', opts: ['Kyoto', 'Edo', 'Osaka', 'Nara'], correct: 1 },
      { q: 'What is the primary weapon of a samurai?', opts: ['Katana', 'Dao', 'Gladius', 'Rapier'], correct: 0 },
      { q: 'Who painted "The Great Wave off Kanagawa"?', opts: ['Hokusai', 'Sesshū', 'Murasaki', 'Bashō'], correct: 0 },
      { q: 'What does "Edo" mean?', opts: ['Bay entrance', 'Rising sun', 'Eternal peace', 'Golden gate'], correct: 0 },
    ];
  } else if (level === 3) {
    pool = [
      { q: 'What was the "sakoku" policy?', opts: ['National isolation', 'Expansion', 'Reformation', 'Unification'], correct: 0 },
      { q: 'Who is the most famous haiku poet?', opts: ['Bashō', 'Hokusai', 'Musashi', 'Nobunaga'], correct: 0 },
      { q: 'What is kabuki?', opts: ['Theater', 'Martial art', 'Painting', 'Poetry'], correct: 0 },
      { q: 'What is "wasan"?', opts: ['Japanese math', 'Calligraphy', 'Medicine', 'Astronomy'], correct: 0 },
      { q: 'Who was Seki Takakazu?', opts: ['Mathematician', 'Swordsman', 'Poet', 'Merchant'], correct: 0 },
    ];
  } else {
    pool = [
      { q: 'When was the Battle of Sekigahara?', opts: ['1600', '1543', '1637', '1700'], correct: 0 },
      { q: 'What was sankin-kōtai?', opts: ['Alternate attendance', 'Trade policy', 'Prayer ritual', 'Harvest festival'], correct: 0 },
      { q: 'Which Europeans traded at Dejima?', opts: ['Dutch', 'Chinese', 'Portuguese', 'Spanish'], correct: 0 },
      { q: 'What does bushidō mean?', opts: ['Way of the warrior', 'Art of tea', 'Way of flowers', 'Way of writing'], correct: 0 },
      { q: 'How many loyal rōnin avenged their master?', opts: ['47', '12', '100', '7'], correct: 0 },
      { q: 'What are sangaku?', opts: ['Temple geometry tablets', 'Sword techniques', 'Cooking methods', 'Weaving patterns'], correct: 0 },
    ];
  }

  const picked = pool[Math.floor(Math.random() * pool.length)];
  // Shuffle options, track correct
  const indexed = picked.opts.map((o, i) => ({ i, o }));
  indexed.sort(() => Math.random() - 0.5);
  const newCorrect = indexed.findIndex(x => x.i === picked.correct);
  return { text: picked.q, options: indexed.map(x => x.o), correctIndex: newCorrect };
}

function mathQuestion(level: number): SugorokuQuestion {
  const { text, answer } = mathForLevel(level);
  return makeOptions(text, answer, level);
}

function mathForLevel(level: number): { text: string; answer: number } {
  switch (level) {
    case 1: return mathL1();
    case 2: return mathL2();
    case 3: return mathL3();
    case 4: return mathL4();
    default: return mathL5();
  }
}

function mathL1(): { text: string; answer: number } {
  const fns = [
    () => { const a = ri(15, 60), b = ri(8, 35); return { text: `A merchant has ${a} coins and earns ${b} more. Total?`, answer: a + b }; },
    () => { const a = ri(25, 70), b = ri(8, 25); return { text: `${a} travelers set out, ${b} turn back. How many continue?`, answer: a - b }; },
    () => { const a = ri(15, 50), b = ri(15, 50); return { text: `${a} lanterns on one side, ${b} on the other. Total?`, answer: a + b }; },
    () => { const a = ri(25, 60), b = ri(8, 20); return { text: `A fisherman catches ${a} fish but ${b} escape. How many remain?`, answer: a - b }; },
  ];
  return fns[Math.floor(Math.random() * fns.length)]();
}

function mathL2(): { text: string; answer: number } {
  const fns = [
    () => { const a = ri(5, 15), b = ri(4, 12); return { text: `${a} quivers of ${b} arrows each. Total arrows?`, answer: a * b }; },
    () => { const b = ri(4, 10), ans = ri(5, 14); return { text: `${b * ans} koku of rice split among ${b} families. Each gets?`, answer: ans }; },
    () => { const a = ri(5, 12), b = ri(5, 12); return { text: `A room is ${a} × ${b} tatami. Area?`, answer: a * b }; },
    () => { const a = ri(10, 40) * 2, b = ri(5, 20); return { text: `${a} coins halved plus ${b}. Total?`, answer: a / 2 + b }; },
  ];
  return fns[Math.floor(Math.random() * fns.length)]();
}

function mathL3(): { text: string; answer: number } {
  const fns = [
    () => { const b = ri(3, 8), ans = ri(4, 12); return { text: `A rope of ${b * ans} shaku cut into ${b} pieces. Each length?`, answer: ans }; },
    () => { const a = ri(10, 40) * 2, b = ri(5, 20); return { text: `Half of ${a} plus ${b} equals?`, answer: a / 2 + b }; },
    () => { const a = ri(4, 12); return { text: `${a} squared = ?`, answer: a * a }; },
    () => { const a = ri(4, 10), b = ri(3, 8), c = ri(2, 15); return { text: `${a} × ${b} + ${c} = ?`, answer: a * b + c }; },
    () => { const a = ri(3, 8), b = ri(5, 12), c = ri(2, 5); return { text: `${a} bridges with ${b} planks each, ${c} layers. Total planks?`, answer: a * b * c }; },
  ];
  return fns[Math.floor(Math.random() * fns.length)]();
}

function mathL4(): { text: string; answer: number } {
  const fns = [
    () => { const n = [5, 6, 7, 8, 9, 10, 11, 12][Math.floor(Math.random() * 8)]; return { text: `A garden has area ${n * n}. Side length?`, answer: n }; },
    () => { const n = ri(8, 20); return { text: `Sum of 1 to ${n} = ?`, answer: n * (n + 1) / 2 }; },
    () => { const a = ri(6, 18), b = ri(3, 10), c = b + ri(2, 7); return { text: `Buy ${a} items at ${b}, sell at ${c}. Profit?`, answer: a * (c - b) }; },
    () => { const a = ri(2, 6); return { text: `${a} cubed = ?`, answer: a * a * a }; },
    () => { const a = ri(8, 15), b = ri(6, 12), c = ri(3, a - 2), d = ri(2, b - 2); return { text: `Castle: ${a}×${b} minus ${c}×${d} courtyard. Area?`, answer: a * b - c * d }; },
  ];
  return fns[Math.floor(Math.random() * fns.length)]();
}

function mathL5(): { text: string; answer: number } {
  const fns = [
    () => { const triples: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17]]; const [a, b, c] = triples[Math.floor(Math.random() * triples.length)]; return { text: `Triangle with sides ${a} and ${b}. Hypotenuse?`, answer: c }; },
    () => { const sides: [number, number, number][] = [[3, 4, 5], [5, 6, 7], [7, 8, 9], [4, 5, 6]]; const [a, b, c] = sides[Math.floor(Math.random() * sides.length)]; return { text: `Perimeter of triangle ${a}, ${b}, ${c}?`, answer: a + b + c }; },
    () => { const n = ri(10, 25); return { text: `Sum of 1 to ${n} = ?`, answer: n * (n + 1) / 2 }; },
    () => { const a = ri(2, 7); return { text: `${a} cubed = ?`, answer: a * a * a }; },
    () => { const n = ri(3, 7); return { text: `${n} crossroads, 2 paths each. Total routes?`, answer: 1 << n }; },
  ];
  return fns[Math.floor(Math.random() * fns.length)]();
}

function makeOptions(text: string, correct: number, level: number): SugorokuQuestion {
  const spreadRanges: [number, number][] = [[1, 5], [2, 8], [3, 15], [5, 20], [5, 25]];
  const [sMin, sMax] = spreadRanges[Math.min(level - 1, 4)];
  const opts = new Set<number>([correct]);
  let attempts = 0;
  while (opts.size < 4 && attempts < 80) {
    const offset = ri(sMin, sMax) * (Math.random() < 0.5 ? 1 : -1);
    const v = correct + offset;
    if (v > 0) opts.add(v);
    attempts++;
  }
  while (opts.size < 4) opts.add(correct + opts.size * 3 + 1);
  const arr = [...opts].sort(() => Math.random() - 0.5);
  const idx = arr.indexOf(correct);
  return { text, options: arr.map(String), correctIndex: idx };
}

/** Random integer in [min, max] */
function ri(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/* ── Board position calculations ─────────────────────────────── */

function spacePositions(count: number, boardWidth: number): { x: number; y: number }[] {
  if (count === 0) return [];
  const cols = SPACES_PER_ROW;
  const hGap = Math.max(8, (boardWidth - cols * TILE_W) / (cols + 1));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const colInRow = i % cols;
    const col = row % 2 === 1 ? cols - 1 - colInRow : colInRow;
    const x = hGap + col * (TILE_W + hGap) + TILE_W / 2;
    const y = TILE_GAP + row * (TILE_W + TILE_GAP) + TILE_W / 2;
    pts.push({ x, y });
  }
  return pts;
}

function nearestCastle(board: SugorokuSpace[], before: number): number {
  for (let i = before - 1; i >= 0; i--) {
    if (board[i].type === 'castle') return i;
  }
  return 0;
}

/* ── Pip positions for dice face ─────────────────────────────── */

function pipPositions(value: number, cx: number, cy: number, d: number): { x: number; y: number }[] {
  switch (value) {
    case 1: return [{ x: cx, y: cy }];
    case 2: return [{ x: cx - d, y: cy - d }, { x: cx + d, y: cy + d }];
    case 3: return [{ x: cx - d, y: cy + d }, { x: cx, y: cy }, { x: cx + d, y: cy - d }];
    case 4: return [{ x: cx - d, y: cy - d }, { x: cx + d, y: cy - d }, { x: cx - d, y: cy + d }, { x: cx + d, y: cy + d }];
    case 5: return [{ x: cx - d, y: cy - d }, { x: cx + d, y: cy - d }, { x: cx, y: cy }, { x: cx - d, y: cy + d }, { x: cx + d, y: cy + d }];
    case 6: return [{ x: cx - d, y: cy - d }, { x: cx + d, y: cy - d }, { x: cx - d, y: cy }, { x: cx + d, y: cy }, { x: cx - d, y: cy + d }, { x: cx + d, y: cy + d }];
    default: return [];
  }
}

/* ══════════════════════════════════════════════════════════════════
   Puzzle class
   ══════════════════════════════════════════════════════════════════ */

export class SugorokuPuzzle extends Puzzle {
  readonly title = 'SUGOROKU';
  readonly subtitle = 'the pilgrim path';
  readonly instructions =
    'Roll the die to walk the path. Torii gates demand challenges; waves carry you back. Castle checkpoints protect you. Reach the finish to pass.';

  private level = LEVEL;
  private board: SugorokuSpace[] = [];
  private playerPos = 0;
  private lives = 0;
  private phase: Phase = 'idle';
  private die1 = 1;
  private die2 = 1;
  private rollTimerId = 0;
  private moonDepth = 0;
  private isMoving = false;

  // Challenge state
  private currentQuestion: SugorokuQuestion | null = null;
  private selectedAnswer: number | null = null;
  private challengeCountdown = CHALLENGE_TIME;
  private challengeTimerId = 0;

  // Banner state
  private bannerText = '';
  private bannerGood = true;
  private bannerVisible = false;
  private bannerTimeoutId = 0;

  // DOM refs
  private root: HTMLDivElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private pawnEl: HTMLDivElement | null = null;
  private livesEl: HTMLDivElement | null = null;
  private bannerEl: HTMLDivElement | null = null;
  private diceRowEl: HTMLDivElement | null = null;
  private rollBtnEl: HTMLButtonElement | null = null;
  private chooseLabelEl: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.setupGame();
    this.buildDom();
    this.drawBoard();
    this.placePawn(false);
    this.refreshUI();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color(C_BG_INDIGO), roughness: 0.65, metalness: 0.2, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const mandala = new Mesh(
      new RingGeometry(3.0, 3.18, 48),
      new MeshStandardMaterial({
        color: new Color(C_CRIMSON), emissive: new Color('#2e0a0a'),
        emissiveIntensity: 0.45, roughness: 0.4, metalness: 0.85, side: DoubleSide,
      }),
    );
    mandala.rotation.x = -Math.PI / 2;
    mandala.position.y = -2.37;
    this.group.add(mandala);

    const lamp = new PointLight('#ffd89a', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ═══════════════════ Game setup ═══════════════════════════════ */

  private setupGame(): void {
    this.board = buildBoard(this.level);
    this.lives = initialLives(this.level);
    this.playerPos = 0;
    this.phase = 'idle';
    this.isMoving = false;
    this.moonDepth = 0;
    this.currentQuestion = null;
    this.selectedAnswer = null;
  }

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-sugoroku';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      pointerEvents: 'auto', padding: 'clamp(10px,2vw,14px) clamp(12px,3vw,18px)',
      background: 'rgba(26,15,10,0.92)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(212,175,55,0.25)', borderTop: `3px solid ${C_PATH_GOLD}`,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_TEXT_CREAM,
      maxHeight: '96vh', overflowY: 'auto', maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box',
    });
    root.appendChild(panel);

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
      padding: '4px 0', borderBottom: `1px solid ${C_PATH_GOLD}22`,
    });

    const titleEl = document.createElement('div');
    Object.assign(titleEl.style, { fontSize: '18px', fontWeight: '700', color: C_PATH_GOLD, letterSpacing: '0.15em' });
    titleEl.textContent = '双六';

    const livesEl = document.createElement('div');
    Object.assign(livesEl.style, { display: 'flex', gap: '3px', alignItems: 'center' });
    this.livesEl = livesEl;

    header.append(titleEl, livesEl);
    panel.appendChild(header);

    // Board canvas
    const boardRows = Math.ceil(this.board.length / SPACES_PER_ROW);
    const boardW = SPACES_PER_ROW * (TILE_W + TILE_GAP) + TILE_GAP;
    const boardH = boardRows * (TILE_W + TILE_GAP) + TILE_GAP;

    const boardWrap = document.createElement('div');
    Object.assign(boardWrap.style, {
      position: 'relative', width: boardW + 'px', height: boardH + 'px',
      borderRadius: '8px', overflow: 'hidden',
      border: `1.5px solid ${C_PATH_GOLD}33`,
      background: `${C_BOARD_WOOD}55`,
    });

    const cvs = document.createElement('canvas');
    cvs.width = boardW * 2;
    cvs.height = boardH * 2;
    Object.assign(cvs.style, { width: boardW + 'px', height: boardH + 'px', display: 'block' });
    this.ctx2d = cvs.getContext('2d')!;
    boardWrap.appendChild(cvs);

    // Pawn (shogi-inspired koma)
    const pawn = document.createElement('div');
    Object.assign(pawn.style, {
      position: 'absolute', width: '30px', height: '34px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'left 0.4s cubic-bezier(.34,1.56,.64,1), top 0.4s cubic-bezier(.34,1.56,.64,1)',
      pointerEvents: 'none', zIndex: '8',
      fontSize: '11px', fontWeight: '900', color: C_CRIMSON,
      textAlign: 'center',
    });
    // Draw a koma shape via SVG background
    pawn.style.background = `url("data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='30' height='34'><path d='M15 2 L22 10 L25 32 L5 32 L8 10 Z' fill='${C_PAPER}' stroke='%238B6914' stroke-width='1.2'/></svg>`
    )}")`;
    pawn.textContent = '駒';
    boardWrap.appendChild(pawn);
    this.pawnEl = pawn;

    panel.appendChild(boardWrap);

    // Banner
    const banner = document.createElement('div');
    Object.assign(banner.style, {
      display: 'none', alignItems: 'center', gap: '8px', width: '100%',
      padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
      letterSpacing: '0.04em', transition: 'opacity 0.3s',
    });
    this.bannerEl = banner;
    panel.appendChild(banner);

    // Dice row
    const diceRow = document.createElement('div');
    Object.assign(diceRow.style, { display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' });
    this.diceRowEl = diceRow;
    panel.appendChild(diceRow);

    // Choose die label
    const chooseLabel = document.createElement('div');
    Object.assign(chooseLabel.style, { fontSize: '11px', color: `${C_PATH_GOLD}bb`, letterSpacing: '0.1em', display: 'none' });
    chooseLabel.textContent = 'TAP A DIE TO CHOOSE';
    this.chooseLabelEl = chooseLabel;
    panel.appendChild(chooseLabel);

    // Roll button
    const rollBtn = document.createElement('button');
    rollBtn.type = 'button';
    rollBtn.textContent = 'ROLL';
    Object.assign(rollBtn.style, {
      padding: '10px 28px', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
      letterSpacing: '0.2em', color: C_PAPER,
      background: `${C_CRIMSON}dd`, border: `1px solid ${C_PATH_GOLD}55`,
      borderRadius: '20px', cursor: 'pointer',
      transition: 'opacity 0.2s',
    });
    rollBtn.addEventListener('click', () => this.rollDice());
    this.rollBtnEl = rollBtn;
    panel.appendChild(rollBtn);

    // Status (informational text below controls)
    const status = document.createElement('div');
    Object.assign(status.style, { fontSize: '12px', letterSpacing: '0.06em', textAlign: 'center', minHeight: '18px', opacity: '0.8' });
    panel.appendChild(status);

    // Overlay (challenge / win / lose)
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
      fontFamily: "'Rajdhani', system-ui, sans-serif",
    });
    root.appendChild(overlay);
    this.overlayEl = overlay;

    // Inject animation keyframe
    if (!document.getElementById('sugoroku-anims')) {
      const style = document.createElement('style');
      style.id = 'sugoroku-anims';
      style.textContent = `@keyframes sugoroku-pop { from { transform: scale(0.92); opacity:0; } to { transform: scale(1); opacity:1; } }`;
      document.head.appendChild(style);
    }

    document.body.appendChild(root);
  }

  /* ═══════════════════ Canvas board drawing ══════════════════════ */

  private drawBoard(): void {
    const c = this.ctx2d!;
    const boardRows = Math.ceil(this.board.length / SPACES_PER_ROW);
    const boardW = SPACES_PER_ROW * (TILE_W + TILE_GAP) + TILE_GAP;
    const boardH = boardRows * (TILE_W + TILE_GAP) + TILE_GAP;
    const s = 2;
    c.clearRect(0, 0, boardW * s, boardH * s);
    c.save();
    c.scale(s, s);

    const positions = spacePositions(this.board.length, boardW);

    // Draw path lines
    c.strokeStyle = C_PATH_GOLD + '44';
    c.lineWidth = 2;
    c.lineCap = 'round';
    for (let i = 0; i < positions.length - 1; i++) {
      const from = positions[i], to = positions[i + 1];
      const row1 = Math.floor(i / SPACES_PER_ROW), row2 = Math.floor((i + 1) / SPACES_PER_ROW);
      c.beginPath();
      if (row1 === row2) {
        c.moveTo(from.x, from.y);
        c.lineTo(to.x, to.y);
      } else {
        const midY = (from.y + to.y) / 2;
        c.moveTo(from.x, from.y);
        c.bezierCurveTo(from.x, midY, to.x, midY, to.x, to.y);
      }
      c.stroke();
    }

    // Draw space tiles
    for (let i = 0; i < this.board.length; i++) {
      const space = this.board[i];
      const pos = positions[i];
      const halfTile = TILE_W / 2;

      // Tile background
      c.fillStyle = this.spaceBg(space.type);
      c.beginPath();
      this.roundRect(c, pos.x - halfTile, pos.y - halfTile, TILE_W, TILE_W, 7);
      c.fill();

      // Tile border
      c.strokeStyle = this.spaceAccent(space.type) + '55';
      c.lineWidth = 1;
      c.beginPath();
      this.roundRect(c, pos.x - halfTile, pos.y - halfTile, TILE_W, TILE_W, 7);
      c.stroke();

      // Space icon
      this.drawSpaceIcon(c, pos.x, pos.y, space.type);
    }

    c.restore();
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
  }

  private spaceBg(type: SpaceType): string {
    switch (type) {
      case 'start': case 'finish': return C_PATH_GOLD + '33';
      case 'path': return C_PAPER + '11';
      case 'torii': return C_CRIMSON + '28';
      case 'sakura': return C_SAKURA_PINK + '22';
      case 'wave': return C_WAVE_BLUE + '22';
      case 'castle': return C_CASTLE_STONE + '28';
      case 'moon': return C_MOON_YELLOW + '1a';
    }
  }

  private spaceAccent(type: SpaceType): string {
    switch (type) {
      case 'start': case 'finish': return C_PATH_GOLD;
      case 'path': return C_PAPER;
      case 'torii': return C_CRIMSON;
      case 'sakura': return C_SAKURA_PINK;
      case 'wave': return C_WAVE_BLUE;
      case 'castle': return C_CASTLE_STONE;
      case 'moon': return C_MOON_YELLOW;
    }
  }

  private drawSpaceIcon(c: CanvasRenderingContext2D, cx: number, cy: number, type: SpaceType): void {
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const accent = this.spaceAccent(type);

    switch (type) {
      case 'start':
        c.fillStyle = accent;
        c.font = 'bold 12px Rajdhani, system-ui';
        c.fillText('出', cx, cy);
        break;
      case 'finish':
        c.fillStyle = accent;
        c.font = 'bold 12px Rajdhani, system-ui';
        c.fillText('上', cx, cy);
        break;
      case 'torii': {
        // Torii gate icon
        const w = TILE_W * 0.5, h = TILE_W * 0.5;
        c.fillStyle = accent;
        c.fillRect(cx - w * 0.28, cy - h * 0.05, w * 0.08, h * 0.5);
        c.fillRect(cx + w * 0.20, cy - h * 0.05, w * 0.08, h * 0.5);
        c.beginPath();
        c.moveTo(cx - w * 0.38, cy - h * 0.1);
        c.quadraticCurveTo(cx, cy - h * 0.35, cx + w * 0.38, cy - h * 0.1);
        c.strokeStyle = accent;
        c.lineWidth = 2;
        c.stroke();
        c.beginPath();
        c.moveTo(cx - w * 0.25, cy + h * 0.1);
        c.lineTo(cx + w * 0.25, cy + h * 0.1);
        c.lineWidth = 1.2;
        c.stroke();
        break;
      }
      case 'sakura': {
        const r = TILE_W * 0.06, d = TILE_W * 0.09;
        c.fillStyle = accent;
        for (let i = 0; i < 5; i++) {
          const a = i * (2 * Math.PI / 5) - Math.PI / 2;
          c.beginPath();
          c.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, 0, Math.PI * 2);
          c.fill();
        }
        c.fillStyle = C_MOON_YELLOW + 'cc';
        c.beginPath();
        c.arc(cx, cy, 2, 0, Math.PI * 2);
        c.fill();
        break;
      }
      case 'wave': {
        c.beginPath();
        const ww = TILE_W * 0.35;
        c.moveTo(cx - ww, cy + 2);
        c.bezierCurveTo(cx - ww * 0.4, cy + 3, cx - ww * 0.3, cy - 6, cx, cy - 4);
        c.bezierCurveTo(cx + ww * 0.3, cy - 2, cx + ww * 0.7, cy + 4, cx + ww, cy + 3);
        c.strokeStyle = accent;
        c.lineWidth = 2;
        c.stroke();
        break;
      }
      case 'castle': {
        const w = TILE_W * 0.5, h = TILE_W * 0.5;
        c.fillStyle = accent;
        c.fillRect(cx - w * 0.25, cy + h * 0.02, w * 0.5, h * 0.35);
        c.beginPath();
        c.moveTo(cx - w * 0.32, cy + h * 0.02);
        c.lineTo(cx, cy - h * 0.25);
        c.lineTo(cx + w * 0.32, cy + h * 0.02);
        c.closePath();
        c.fill();
        break;
      }
      case 'moon': {
        const r = TILE_W * 0.14;
        c.beginPath();
        c.arc(cx, cy, r, -100 * Math.PI / 180, 100 * Math.PI / 180, false);
        c.arc(cx + r * 0.35, cy - r * 0.1, r * 0.8, 100 * Math.PI / 180, -100 * Math.PI / 180, true);
        c.closePath();
        c.fillStyle = accent;
        c.fill();
        break;
      }
      case 'path': {
        c.fillStyle = C_PAPER + '55';
        c.beginPath();
        c.arc(cx, cy, 2.5, 0, Math.PI * 2);
        c.fill();
        break;
      }
    }
  }

  /* ═══════════════════ Pawn placement ════════════════════════════ */

  private placePawn(animate = true): void {
    if (!this.pawnEl) return;
    const boardW = SPACES_PER_ROW * (TILE_W + TILE_GAP) + TILE_GAP;
    const positions = spacePositions(this.board.length, boardW);
    const pos = positions[Math.min(this.playerPos, positions.length - 1)];
    if (!animate) this.pawnEl.style.transition = 'none';
    this.pawnEl.style.left = (pos.x - 15) + 'px';
    this.pawnEl.style.top = (pos.y - 17) + 'px';
    if (!animate) {
      void this.pawnEl.offsetWidth;
      this.pawnEl.style.transition = 'left 0.4s cubic-bezier(.34,1.56,.64,1), top 0.4s cubic-bezier(.34,1.56,.64,1)';
    }
  }

  /* ═══════════════════ UI refresh ════════════════════════════════ */

  private refreshUI(): void {
    // Lives
    if (this.livesEl) {
      this.livesEl.innerHTML = '';
      const maxLives = initialLives(this.level);
      for (let i = 0; i < maxLives; i++) {
        const heart = document.createElement('span');
        heart.style.fontSize = '14px';
        heart.style.color = i < this.lives ? C_CRIMSON : C_CRIMSON + '44';
        heart.textContent = i < this.lives ? '♥' : '♡';
        this.livesEl.appendChild(heart);
      }
    }

    // Dice
    this.renderDice();

    // Roll button
    if (this.rollBtnEl) {
      const enabled = this.phase === 'idle';
      this.rollBtnEl.disabled = !enabled;
      this.rollBtnEl.style.opacity = enabled ? '1' : '0.35';
      this.rollBtnEl.style.cursor = enabled ? 'pointer' : 'default';
    }

    // Choose label
    if (this.chooseLabelEl) {
      this.chooseLabelEl.style.display = this.phase === 'chooseDie' ? 'block' : 'none';
    }

    // Banner
    if (this.bannerEl) {
      if (this.bannerVisible) {
        const accent = this.bannerGood ? C_GOOD_GREEN : C_BAD_RED;
        Object.assign(this.bannerEl.style, {
          display: 'flex', color: accent,
          background: accent + '1f',
          border: `1px solid ${accent}44`,
        });
        this.bannerEl.textContent = this.bannerText;
      } else {
        this.bannerEl.style.display = 'none';
      }
    }
  }

  private renderDice(): void {
    if (!this.diceRowEl) return;
    this.diceRowEl.innerHTML = '';
    const numDice = diceCount(this.level);
    const values = [this.die1, this.die2];

    for (let d = 0; d < numDice; d++) {
      const dieCvs = document.createElement('canvas');
      dieCvs.width = 96;
      dieCvs.height = 96;
      Object.assign(dieCvs.style, { width: '48px', height: '48px', cursor: this.phase === 'chooseDie' ? 'pointer' : 'default' });

      const dc = dieCvs.getContext('2d')!;
      dc.scale(2, 2);
      // Die body
      dc.fillStyle = C_PAPER;
      dc.beginPath();
      this.roundRect(dc, 2, 2, 44, 44, 6);
      dc.fill();
      dc.strokeStyle = 'rgba(0,0,0,0.2)';
      dc.lineWidth = 1.5;
      dc.beginPath();
      this.roundRect(dc, 2, 2, 44, 44, 6);
      dc.stroke();
      // Pips
      const val = values[d];
      const pips = pipPositions(val, 24, 24, 10);
      for (const p of pips) {
        dc.fillStyle = val === 1 ? C_CRIMSON : 'rgba(0,0,0,0.75)';
        dc.beginPath();
        dc.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        dc.fill();
      }

      if (this.phase === 'chooseDie') {
        dieCvs.addEventListener('click', () => this.chooseDie(values[d]));
      }
      this.diceRowEl.appendChild(dieCvs);
    }
  }

  /* ═══════════════════ Game logic ════════════════════════════════ */

  private rollDice(): void {
    if (this.phase !== 'idle' || this.board.length === 0) return;
    this.phase = 'rolling';
    this.moonDepth = 0;
    this.refreshUI();

    let count = 0;
    this.rollTimerId = window.setInterval(() => {
      this.die1 = ri(1, 6);
      if (diceCount(this.level) === 2) this.die2 = ri(1, 6);
      this.renderDice();
      count++;
      if (count >= 12) {
        clearInterval(this.rollTimerId);
        this.die1 = ri(1, 6);
        if (diceCount(this.level) === 2) this.die2 = ri(1, 6);
        this.renderDice();

        if (diceCount(this.level) === 2) {
          this.phase = 'chooseDie';
          this.refreshUI();
        } else {
          setTimeout(() => this.movePlayer(this.die1), 400);
        }
      }
    }, 70);
  }

  private chooseDie(value: number): void {
    if (this.phase !== 'chooseDie') return;
    this.movePlayer(value);
  }

  private movePlayer(amount: number): void {
    if (this.isMoving) return;
    this.isMoving = true;
    const lastIdx = this.board.length - 1;

    // Exact landing rule (level 4+)
    if (exactLanding(this.level) && this.playerPos + amount > lastIdx) {
      this.showBanner('Overshoot! Exact landing required.', false);
      setTimeout(() => { this.phase = 'idle'; this.isMoving = false; this.refreshUI(); }, 1500);
      return;
    }

    const targetPos = Math.min(this.playerPos + amount, lastIdx);
    this.phase = 'moving';
    const steps = targetPos - this.playerPos;
    if (steps <= 0) { this.phase = 'idle'; this.isMoving = false; this.refreshUI(); return; }

    // Animate step-by-step
    for (let step = 0; step < steps; step++) {
      setTimeout(() => {
        this.playerPos++;
        this.placePawn();
      }, step * 250);
    }

    setTimeout(() => {
      this.isMoving = false;
      this.handleLanding();
    }, steps * 250 + 300);
  }

  private handleLanding(): void {
    if (this.playerPos < 0 || this.playerPos >= this.board.length) { this.phase = 'idle'; this.refreshUI(); return; }
    const space = this.board[this.playerPos];

    switch (space.type) {
      case 'finish':
        this.phase = 'won';
        this.refreshUI();
        this.showWinScreen();
        break;

      case 'torii':
        this.presentChallenge();
        break;

      case 'sakura':
        this.showBanner('Sakura blessing! Roll again.', true);
        setTimeout(() => { this.phase = 'idle'; this.refreshUI(); }, 1500);
        break;

      case 'wave': {
        const back = space.waveBack;
        this.showBanner(`Wave drags you back ${back}!`, false);
        setTimeout(() => this.retreatPlayer(back, false), 1200);
        break;
      }

      case 'castle':
        this.showBanner('Castle checkpoint — safe haven!', true);
        setTimeout(() => { this.phase = 'idle'; this.refreshUI(); }, 1200);
        break;

      case 'moon':
        if (this.moonDepth >= 2) { this.phase = 'idle'; this.refreshUI(); return; }
        this.moonDepth++;
        if (Math.random() < 0.5) {
          const adv = ri(1, 3);
          this.showBanner(`Moon smiles! Advance ${adv}.`, true);
          setTimeout(() => this.movePlayer(adv), 1300);
        } else {
          const back = ri(1, 2);
          this.showBanner(`Moon frowns! Back ${back}.`, false);
          setTimeout(() => this.retreatPlayer(back, false), 1300);
        }
        break;

      default:
        this.phase = 'idle';
        this.refreshUI();
        break;
    }
  }

  private retreatPlayer(amount: number, ignoreCheckpoints: boolean): void {
    if (this.isMoving) return;
    this.isMoving = true;
    const minPos = ignoreCheckpoints ? 0 : nearestCastle(this.board, this.playerPos);
    const targetPos = Math.max(minPos, this.playerPos - amount);
    const steps = this.playerPos - targetPos;
    if (steps <= 0) { this.phase = 'idle'; this.isMoving = false; this.refreshUI(); return; }

    for (let step = 0; step < steps; step++) {
      setTimeout(() => {
        this.playerPos--;
        this.placePawn();
      }, step * 200);
    }

    setTimeout(() => {
      this.isMoving = false;
      // Landing on torii after retreat triggers challenge
      if (this.board[this.playerPos].type === 'torii') {
        this.handleLanding();
      } else {
        this.phase = 'idle';
        this.refreshUI();
      }
    }, steps * 200 + 300);
  }

  /* ═══════════════════ Challenge ═════════════════════════════════ */

  private presentChallenge(): void {
    this.currentQuestion = generateQuestion(this.level);
    this.selectedAnswer = null;
    this.phase = 'challenge';
    this.refreshUI();
    this.showChallengeOverlay();
  }

  private showChallengeOverlay(): void {
    if (!this.overlayEl || !this.currentQuestion) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';
    this.challengeCountdown = CHALLENGE_TIME;

    const q = this.currentQuestion;

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '340px', width: '90%', padding: '20px',
      background: C_BOARD_WOOD,
      border: `1.5px solid ${C_PATH_GOLD}55`, borderRadius: '16px',
      boxShadow: `0 0 30px ${C_PATH_GOLD}22`, color: C_TEXT_CREAM,
      animation: 'sugoroku-pop 0.25s ease-out',
    });

    // Header
    const headerRow = document.createElement('div');
    Object.assign(headerRow.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' });
    const titleLabel = document.createElement('span');
    Object.assign(titleLabel.style, { fontSize: '15px', fontWeight: '700', color: C_CRIMSON });
    titleLabel.textContent = '⛩ CHALLENGE';
    const timerLabel = document.createElement('span');
    timerLabel.id = 'sugoroku-timer';
    Object.assign(timerLabel.style, { fontSize: '16px', fontWeight: '700', color: C_PATH_GOLD, fontVariantNumeric: 'tabular-nums' });
    timerLabel.textContent = `${CHALLENGE_TIME}s`;
    headerRow.append(titleLabel, timerLabel);
    card.appendChild(headerRow);

    // Timer bar
    const timerBar = document.createElement('div');
    Object.assign(timerBar.style, { width: '100%', height: '4px', borderRadius: '2px', background: `${C_TEXT_CREAM}14`, marginBottom: '14px', overflow: 'hidden' });
    const timerFill = document.createElement('div');
    timerFill.id = 'sugoroku-timer-fill';
    Object.assign(timerFill.style, { width: '100%', height: '100%', background: C_PATH_GOLD, transition: 'width 1s linear' });
    timerBar.appendChild(timerFill);
    card.appendChild(timerBar);

    // Question text
    const promptEl = document.createElement('div');
    Object.assign(promptEl.style, { fontSize: '14px', fontWeight: '500', lineHeight: '1.5', textAlign: 'center', marginBottom: '16px' });
    promptEl.textContent = q.text;
    card.appendChild(promptEl);

    // Answer buttons (2x2 grid)
    const grid = document.createElement('div');
    Object.assign(grid.style, { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' });
    for (let i = 0; i < q.options.length; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = q.options[i];
      btn.dataset.idx = String(i);
      Object.assign(btn.style, {
        padding: '12px 8px', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit',
        color: C_PATH_GOLD, background: `${C_PATH_GOLD}14`,
        border: `1px solid ${C_PATH_GOLD}44`, borderRadius: '10px',
        cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
      });
      btn.addEventListener('click', () => this.answerChallenge(i));
      grid.appendChild(btn);
    }
    card.appendChild(grid);
    this.overlayEl.appendChild(card);

    // Start countdown
    this.challengeTimerId = window.setInterval(() => {
      this.challengeCountdown--;
      const te = document.getElementById('sugoroku-timer');
      const tf = document.getElementById('sugoroku-timer-fill');
      if (te) {
        te.textContent = `${this.challengeCountdown}s`;
        te.style.color = this.challengeCountdown <= 3 ? C_BAD_RED : C_PATH_GOLD;
      }
      if (tf) {
        tf.style.width = `${(this.challengeCountdown / CHALLENGE_TIME) * 100}%`;
        if (this.challengeCountdown <= 3) tf.style.background = C_BAD_RED;
      }
      if (this.challengeCountdown <= 0) {
        this.answerChallenge(-1); // time's up
      }
    }, 1000);
  }

  private answerChallenge(index: number): void {
    if (this.selectedAnswer !== null || !this.currentQuestion) return;
    clearInterval(this.challengeTimerId);
    this.selectedAnswer = index;

    const correct = index >= 0 && index === this.currentQuestion.correctIndex;

    // Visual feedback on buttons
    if (this.overlayEl) {
      const btns = this.overlayEl.querySelectorAll('button[data-idx]');
      btns.forEach(b => {
        const btn = b as HTMLButtonElement;
        btn.disabled = true;
        const idx = parseInt(btn.dataset.idx || '-1');
        if (idx === this.currentQuestion!.correctIndex) {
          btn.style.background = C_GOOD_GREEN + '33';
          btn.style.borderColor = C_GOOD_GREEN + '88';
          btn.style.color = C_GOOD_GREEN;
        } else if (idx === index) {
          btn.style.background = C_BAD_RED + '33';
          btn.style.borderColor = C_BAD_RED + '88';
          btn.style.color = C_BAD_RED;
        }
      });
    }

    setTimeout(() => {
      if (this.overlayEl) this.overlayEl.style.display = 'none';
      if (correct) this.handleCorrectAnswer();
      else this.handleWrongAnswer();
    }, 800);
  }

  private handleCorrectAnswer(): void {
    this.currentQuestion = null;
    this.selectedAnswer = null;
    const bonus = correctBonus(this.level);
    this.showBanner(`Correct! Advance ${bonus}.`, true);

    setTimeout(() => {
      this.bonusAdvance(bonus);
    }, 1000);
  }

  private handleWrongAnswer(): void {
    this.currentQuestion = null;
    this.selectedAnswer = null;
    this.lives--;
    this.showBanner('Wrong! Retreat to start.', false);
    this.refreshUI();

    setTimeout(() => {
      if (this.lives <= 0) {
        this.phase = 'lost';
        this.refreshUI();
        this.showLoseScreen();
        return;
      }
      // Wrong answer: back to start (bypasses checkpoints)
      this.retreatPlayer(this.playerPos, true);
    }, 1000);
  }

  private bonusAdvance(amount: number): void {
    const lastIdx = this.board.length - 1;
    const targetPos = Math.min(this.playerPos + amount, lastIdx);
    const steps = targetPos - this.playerPos;
    if (steps <= 0) { this.phase = 'idle'; this.refreshUI(); return; }

    this.isMoving = true;
    for (let step = 0; step < steps; step++) {
      setTimeout(() => {
        this.playerPos++;
        this.placePawn();
      }, step * 250);
    }
    setTimeout(() => {
      this.isMoving = false;
      if (this.playerPos >= lastIdx && this.board[this.playerPos].type === 'finish') {
        this.phase = 'won';
        this.refreshUI();
        this.showWinScreen();
      } else {
        this.phase = 'idle';
        this.refreshUI();
      }
    }, steps * 250 + 300);
  }

  /* ═══════════════════ Win / Lose screens ════════════════════════ */

  private showWinScreen(): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      textAlign: 'center', padding: '30px',
      background: `linear-gradient(to bottom, ${C_BG_INDIGO}, ${C_BOARD_WOOD})`,
      border: `1.5px solid ${C_PATH_GOLD}55`, borderRadius: '16px',
      boxShadow: `0 0 40px ${C_PATH_GOLD}33`,
      animation: 'sugoroku-pop 0.3s ease-out',
    });

    const kanji = document.createElement('div');
    Object.assign(kanji.style, { fontSize: '36px', fontWeight: '900', color: C_CRIMSON, marginBottom: '8px' });
    kanji.textContent = '上がり';
    card.appendChild(kanji);

    const sub = document.createElement('div');
    Object.assign(sub.style, { fontSize: '16px', fontWeight: '700', color: C_PATH_GOLD, marginBottom: '16px' });
    sub.textContent = 'VICTORY — THE PATH IS COMPLETE';
    card.appendChild(sub);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'CONTINUE';
    Object.assign(btn.style, {
      padding: '10px 24px', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
      color: C_PATH_GOLD, background: `${C_PATH_GOLD}1a`,
      border: `1.5px solid ${C_PATH_GOLD}77`, borderRadius: '20px', cursor: 'pointer',
    });
    btn.addEventListener('click', () => {
      this.isSolved = true;
      this.onSolved?.();
    });
    card.appendChild(btn);
    this.overlayEl.appendChild(card);
  }

  private showLoseScreen(): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      textAlign: 'center', padding: '30px',
      background: `linear-gradient(to bottom, ${C_BG_INDIGO}, ${C_BOARD_WOOD})`,
      border: `1.5px solid ${C_BAD_RED}55`, borderRadius: '16px',
      boxShadow: `0 0 30px ${C_BAD_RED}22`,
      animation: 'sugoroku-pop 0.3s ease-out',
    });

    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '22px', fontWeight: '700', color: C_TEXT_CREAM, marginBottom: '12px' });
    title.textContent = 'GAME OVER';
    card.appendChild(title);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'TRY AGAIN';
    Object.assign(btn.style, {
      padding: '10px 24px', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
      color: '#fff', background: `linear-gradient(to right, ${C_PATH_GOLD}, ${C_MOON_YELLOW}, ${C_PATH_GOLD})`,
      border: 'none', borderRadius: '20px', cursor: 'pointer',
    });
    btn.addEventListener('click', () => this.resetGame());
    card.appendChild(btn);
    this.overlayEl.appendChild(card);
  }

  private resetGame(): void {
    if (this.overlayEl) this.overlayEl.style.display = 'none';
    this.setupGame();
    this.drawBoard();
    this.placePawn(false);
    this.refreshUI();
  }

  /* ═══════════════════ Banner ════════════════════════════════════ */

  private showBanner(text: string, good: boolean): void {
    this.bannerText = text;
    this.bannerGood = good;
    this.bannerVisible = true;
    this.refreshUI();
    clearTimeout(this.bannerTimeoutId);
    this.bannerTimeoutId = window.setTimeout(() => {
      if (this.bannerText === text) {
        this.bannerVisible = false;
        this.refreshUI();
      }
    }, 2000);
  }

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    clearInterval(this.rollTimerId);
    clearInterval(this.challengeTimerId);
    clearTimeout(this.bannerTimeoutId);
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('sugoroku-anims');
    if (animStyle) animStyle.remove();
    this.ctx2d = null;
    this.pawnEl = null;
    this.livesEl = null;
    this.bannerEl = null;
    this.diceRowEl = null;
    this.rollBtnEl = null;
    this.chooseLabelEl = null;
    this.overlayEl = null;
    super.dispose();
  }
}
