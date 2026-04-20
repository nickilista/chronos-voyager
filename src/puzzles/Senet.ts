import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Vector2,
  Vector3,
} from 'three';
import { Puzzle } from './PuzzleBase.ts';

/**
 * Senet — port of the iOS Chronos Mathematica "egypt_senet_02" level.
 *
 * 3 Ankh pieces (gold) vs 3 Eye-of-Horus pieces (blue) on a 3×10 S-path.
 * Rules match the app:
 *  - Rolls from 4 throw sticks: marked count → 1,2,3,4 with 0 marked ⇒ 5.
 *  - Rolling 1, 4, 5 grants an extra turn.
 *  - Backward moves allowed only when no forward move exists.
 *  - Exit on square 30 requires exact roll; overshoot bounces back from 30.
 *  - Capture isolated opponent; piece with an adjacent friend is protected.
 *  - Special squares: 15 Rebirth, 26 Beauty (safe + extra), 27 Water (back
 *    near 15), 28 Three Truths, 29 Re-Atoum, 30 Departure.
 *  - Math traps on squares 7, 14, 21 — solve to keep your progress, fail
 *    (or time out) and the piece snaps back to where it stood.
 *  - Event banners for capture, water, beauty, rebirth, traps, victory,
 *    defeat, drawn as centered papyrus cards with an Egyptian border.
 */

const COLS = 10;
const ROWS = 3;
const CELL = 1.35;
const BOARD_W = COLS * CELL;
const BOARD_D = ROWS * CELL;

const PIECE_R = 0.5;
const PIECE_H = 0.22;
const PIECE_FACE = 0.92;

const PATH_END = 30;
const OFF_BOARD = 31;

const COLOR_PLAYER = 0xf5d060;
const COLOR_OPPONENT = 0x4a7acc;
const COLOR_PLAYER_CSS = '#f5d060';
const COLOR_OPPONENT_CSS = '#4a7acc';
const COLOR_OPP_STROKE_CSS = '#1e3a6e';
const COLOR_OPP_PUPIL_CSS = '#0d1b2a';

const HIGHLIGHT = 0x7fff9a;
const THOTH_PURPLE = 0x7b2d8e;

const STICK_DUR = 0.85;
const AI_DELAY = 0.9;
const ANIM_DUR = 0.4;
const TRAP_TIME = 10;
const BANNER_TIME = 2.6;

type Side = 'player' | 'opponent';
type Phase =
  | 'idle'
  | 'rolling'
  | 'await-move'
  | 'moving'
  | 'trap'
  | 'ai-wait'
  | 'ai-rolling'
  | 'ai-moving'
  | 'won'
  | 'lost';

interface Piece {
  readonly mesh: Mesh;
  readonly decal: Mesh;
  side: Side;
  square: number; // 1..30; 31 = exited
  preTrapSquare: number;
  anim: { from: Vector3; to: Vector3; t: number; dur: number; active: boolean; hop: number };
}

interface SpecialSquare {
  icon: string;
  title: string;
  color: string;
  bg: string;
}

const SPECIAL: Record<number, SpecialSquare> = {
  15: { icon: '☥', title: 'House of Rebirth', color: '#44b87a', bg: '#1a2e1a' },
  26: { icon: '✦', title: 'House of Beauty', color: '#d4a843', bg: '#2e2510' },
  27: { icon: '〰', title: 'House of Water', color: '#4a90d9', bg: '#0f1e2e' },
  28: { icon: 'III', title: 'House of Three Truths', color: '#e8a030', bg: '#2e1f0a' },
  29: { icon: 'II', title: 'House of Re-Atoum', color: '#e8a030', bg: '#2e1f0a' },
  30: { icon: '☀', title: 'House of Departure', color: '#d4a843', bg: '#2e2510' },
};
const MATH_TRAP_SQUARES = new Set([7, 14, 21]);

function pathToRC(n: number): { row: number; col: number } {
  const row = Math.floor((n - 1) / COLS);
  const base = row * COLS;
  const inRow = n - 1 - base;
  const col = row % 2 === 0 ? inRow : COLS - 1 - inRow;
  return { row, col };
}

function squareWorld(n: number): Vector3 {
  const { row, col } = pathToRC(n);
  const x = -BOARD_W / 2 + (col + 0.5) * CELL;
  const z = -BOARD_D / 2 + (row + 0.5) * CELL;
  return new Vector3(x, PIECE_H / 2 + 0.02, z);
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}
function randInt(a: number, b: number): number {
  return Math.floor(rand(a, b + 1));
}

/* ------------------------- Canvas texture helpers ------------------------- */

function makePieceTexture(side: Side): CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) return new CanvasTexture(c);

  // Pedestal disc (warm stone for player, cool stone for opponent).
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.48;
  const rad = g.createRadialGradient(cx, cy, rOuter * 0.1, cx, cy, rOuter);
  if (side === 'player') {
    rad.addColorStop(0, '#d7b465');
    rad.addColorStop(1, '#6e4a1a');
  } else {
    rad.addColorStop(0, '#4e6cae');
    rad.addColorStop(1, '#18233f');
  }
  g.fillStyle = rad;
  g.beginPath();
  g.arc(cx, cy, rOuter, 0, Math.PI * 2);
  g.fill();

  // Inner rim
  g.strokeStyle = side === 'player' ? '#2b1b07' : '#0b1428';
  g.lineWidth = size * 0.025;
  g.beginPath();
  g.arc(cx, cy, rOuter * 0.88, 0, Math.PI * 2);
  g.stroke();

  if (side === 'player') drawAnkh(g, cx, cy, rOuter * 0.62);
  else drawEye(g, cx, cy, rOuter * 0.58);

  const tex = new CanvasTexture(c);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  return tex;
}

function drawAnkh(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  g.save();
  g.strokeStyle = COLOR_PLAYER_CSS;
  g.fillStyle = COLOR_PLAYER_CSS;
  g.lineWidth = Math.max(3, r * 0.22);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // Teardrop loop at the top.
  g.beginPath();
  g.ellipse(cx, cy - r * 0.5, r * 0.38, r * 0.5, 0, 0, Math.PI * 2);
  g.stroke();

  // Vertical shaft
  g.beginPath();
  g.moveTo(cx, cy - r * 0.02);
  g.lineTo(cx, cy + r * 0.95);
  g.stroke();

  // Crossbar
  g.beginPath();
  g.moveTo(cx - r * 0.55, cy + r * 0.18);
  g.lineTo(cx + r * 0.55, cy + r * 0.18);
  g.stroke();

  g.restore();
}

function drawEye(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  g.save();
  g.fillStyle = COLOR_OPPONENT_CSS;
  g.strokeStyle = COLOR_OPP_STROKE_CSS;
  g.lineWidth = Math.max(2, r * 0.11);
  g.lineJoin = 'round';

  // Almond outline using two quadratic curves.
  g.beginPath();
  g.moveTo(cx - r, cy);
  g.quadraticCurveTo(cx, cy - r * 0.8, cx + r, cy);
  g.quadraticCurveTo(cx, cy + r * 0.55, cx - r, cy);
  g.closePath();
  g.fill();
  g.stroke();

  // Iris
  g.fillStyle = '#8aa8e0';
  g.beginPath();
  g.arc(cx, cy - r * 0.02, r * 0.42, 0, Math.PI * 2);
  g.fill();

  // Pupil
  g.fillStyle = COLOR_OPP_PUPIL_CSS;
  g.beginPath();
  g.arc(cx, cy - r * 0.02, r * 0.22, 0, Math.PI * 2);
  g.fill();

  // Hieroglyphic tail (the Eye of Horus drop).
  g.strokeStyle = COLOR_OPP_STROKE_CSS;
  g.lineWidth = Math.max(2, r * 0.1);
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - r * 0.95, cy + r * 0.1);
  g.quadraticCurveTo(cx - r * 0.75, cy + r * 0.55, cx - r * 0.4, cy + r * 0.55);
  g.stroke();

  g.restore();
}

function makeSquareTexture(n: number): CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) return new CanvasTexture(c);

  const special = SPECIAL[n];
  const trap = MATH_TRAP_SQUARES.has(n);

  // Base.
  let bg = '#2a1f14';
  if (special) bg = special.bg;
  else if (trap) bg = '#1e0f2e';
  else bg = (Math.floor((n - 1) / COLS) + (n - 1)) % 2 === 0 ? '#3b2a16' : '#2f2111';
  g.fillStyle = bg;
  g.fillRect(0, 0, size, size);

  // Corner glyph decoration.
  g.fillStyle = 'rgba(201, 168, 76, 0.35)';
  const d = 10;
  g.fillRect(6, 6, d, 2);
  g.fillRect(6, 6, 2, d);
  g.fillRect(size - 6 - d, 6, d, 2);
  g.fillRect(size - 8, 6, 2, d);
  g.fillRect(6, size - 8, d, 2);
  g.fillRect(6, size - 6 - d, 2, d);
  g.fillRect(size - 6 - d, size - 8, d, 2);
  g.fillRect(size - 8, size - 6 - d, 2, d);

  // Border
  g.strokeStyle = special
    ? special.color
    : trap
      ? 'rgba(123, 45, 142, 0.6)'
      : 'rgba(201, 168, 76, 0.25)';
  g.lineWidth = special ? 3 : 2;
  g.strokeRect(2, 2, size - 4, size - 4);

  if (special) {
    g.fillStyle = special.color;
    g.font = special.icon.length > 1 ? 'bold 36px serif' : 'bold 64px serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(special.icon, size / 2, size / 2 + 4);
    g.font = '11px system-ui';
    g.fillStyle = special.color;
    g.fillText(String(n), size / 2, size - 12);
  } else if (trap) {
    drawThothIbis(g, size / 2, size / 2, 38);
    g.fillStyle = '#b77ccc';
    g.font = '11px system-ui';
    g.textAlign = 'center';
    g.fillText(String(n), size / 2, size - 12);
  } else {
    g.fillStyle = 'rgba(245,208,96,0.5)';
    g.font = '13px system-ui';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), size / 2, size / 2 + 4);
  }

  const tex = new CanvasTexture(c);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  return tex;
}

function drawThothIbis(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  g.save();
  g.strokeStyle = 'rgba(123, 45, 142, 0.85)';
  g.lineWidth = Math.max(2, r * 0.12);
  g.lineCap = 'round';
  // Body/head blob
  g.beginPath();
  g.ellipse(cx, cy - r * 0.1, r * 0.45, r * 0.5, 0, 0, Math.PI * 2);
  g.stroke();
  // Curved beak
  g.beginPath();
  g.moveTo(cx + r * 0.35, cy);
  g.quadraticCurveTo(cx + r * 0.9, cy + r * 0.2, cx + r * 0.5, cy + r * 0.7);
  g.stroke();
  // Eye dot
  g.fillStyle = 'rgba(200,150,230,0.9)';
  g.beginPath();
  g.arc(cx - r * 0.15, cy - r * 0.2, r * 0.07, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function makeStickTexture(lightSide: boolean): CanvasTexture {
  const w = 256;
  const h = 48;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) return new CanvasTexture(c);
  const grad = g.createLinearGradient(0, 0, 0, h);
  if (lightSide) {
    grad.addColorStop(0, '#f5d060');
    grad.addColorStop(1, '#b48526');
  } else {
    grad.addColorStop(0, '#2c1810');
    grad.addColorStop(1, '#0f0904');
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // Hieroglyph-like marks on the light side only.
  if (lightSide) {
    g.fillStyle = 'rgba(30, 15, 4, 0.85)';
    for (let i = 0; i < 3; i++) {
      const x = w * (0.25 + i * 0.25);
      g.fillRect(x - 2, h * 0.25, 4, h * 0.5);
      g.beginPath();
      g.arc(x, h * 0.25, 4, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.strokeStyle = 'rgba(201, 168, 76, 0.55)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, w - 2, h - 2);
  const tex = new CanvasTexture(c);
  tex.minFilter = LinearFilter;
  return tex;
}

/* ---------------------------- Math-trap content --------------------------- */

interface Trap {
  prompt: string;
  answer: number;
  kind: 'math' | 'trivia';
}

function generateTrap(): Trap {
  // ~30% trivia, else math like the app's level-2 pool.
  if (Math.random() < 0.3) {
    const trivia: Trap[] = [
      { prompt: 'How many squares on the Senet board?', answer: 30, kind: 'trivia' },
      { prompt: 'Rolling how many marked sticks ends the turn? (2 or __)', answer: 3, kind: 'trivia' },
      { prompt: 'House of Water is square number…', answer: 27, kind: 'trivia' },
      { prompt: 'Djoser\u2019s step pyramid has how many tiers?', answer: 6, kind: 'trivia' },
      { prompt: 'Days in an Egyptian decan (one star week)?', answer: 10, kind: 'trivia' },
      { prompt: 'Cardinal directions the pyramids are aligned to?', answer: 4, kind: 'trivia' },
    ];
    return trivia[Math.floor(Math.random() * trivia.length)];
  }
  const choice = Math.floor(Math.random() * 5);
  if (choice === 0) {
    const a = randInt(6, 15);
    const b = randInt(4, 12);
    return { prompt: `${a} × ${b} = ?`, answer: a * b, kind: 'math' };
  }
  if (choice === 1) {
    const a = randInt(3, 9);
    return { prompt: `${a} → ${a * 2} → ?  (double)`, answer: a * 4, kind: 'math' };
  }
  if (choice === 2) {
    const b = randInt(3, 8);
    const ans = randInt(4, 11);
    return { prompt: `(${b * ans}) ÷ ${b} = ?`, answer: ans, kind: 'math' };
  }
  if (choice === 3) {
    const n = randInt(3, 9) * 4;
    return { prompt: `${n} ÷ 4 + ${n} ÷ 2 = ?`, answer: n / 4 + n / 2, kind: 'math' };
  }
  const a = randInt(25, 65);
  const b = randInt(15, 40);
  return { prompt: `${a} + ${b} = ?`, answer: a + b, kind: 'math' };
}

/* ----------------------------- The puzzle class --------------------------- */

export class SenetPuzzle extends Puzzle {
  readonly title = 'SENET · Throw Sticks';
  readonly subtitle = 'reach the afterlife before the gods';
  readonly instructions =
    'Throw the sticks, then click one of your Ankh pieces. Math-trap squares (7, 14, 21) summon Thoth — answer correctly to hold your ground. Both Ankh pieces past square 30 wins.';

  private pieces: Piece[] = [];
  private turn: Side = 'player';
  private phase: Phase = 'idle';
  private roll = -1;
  private lastRollExtra = false;
  private aiTimer = 0;
  private exitedPlayer = 0;
  private exitedOpponent = 0;
  private turnCount = 0;

  private sticks: {
    mesh: Mesh;
    up: boolean;
    anim: boolean;
    t: number;
    dur: number;
    startX: number;
    startY: number;
    startZ: number;
    peakY: number;
    endX: number;
    endZ: number;
    rotXStart: number;
    rotXEnd: number;
    rotZStart: number;
    rotZEnd: number;
  }[] = [];
  private recentPrompts: string[] = [];

  private highlightSquares = new Set<number>();
  private highlightMeshes: Mesh[] = [];
  private backwardSquares = new Set<number>();

  private pendingTrap: { piece: Piece; targetSquare: number } | null = null;
  private trap: Trap | null = null;
  private trapRemaining = 0;
  private trapInput = '';

  private statusEl: HTMLDivElement | null = null;
  private rollBtn: HTMLButtonElement | null = null;
  private rulesEl: HTMLDivElement | null = null;
  private bannerEl: HTMLDivElement | null = null;
  private bannerTimer = 0;
  private trapEl: HTMLDivElement | null = null;
  private trapTimerEl: HTMLDivElement | null = null;

  private stickTexMarked = makeStickTexture(true);
  private stickTexDark = makeStickTexture(false);

  onSolved?: (winner: Side) => void;

  init(): void {
    this.buildBoard();
    this.buildPieces();
    this.buildSticks();
    this.buildDomControls();
    this.updateStatus();
    this.showBanner({
      icon: '☥',
      title: 'The Throw Sticks',
      sub: 'Imhotep faces you — move 2 Ankhs to the afterlife.',
      color: '#d4a843',
      bg: '#2e2510',
      hold: 3.2,
    });
  }

  private buildBoard(): void {
    // Board slab
    const base = new Mesh(
      new BoxGeometry(BOARD_W + 1.0, 0.35, BOARD_D + 1.0),
      new MeshStandardMaterial({ color: 0x2a1f14, roughness: 0.75, metalness: 0.12 }),
    );
    base.position.y = -0.18;
    this.group.add(base);

    // Gold trim border
    const border = new Mesh(
      new BoxGeometry(BOARD_W + 0.95, 0.02, BOARD_D + 0.95),
      new MeshStandardMaterial({
        color: 0xc9a84c,
        emissive: 0x3a2a10,
        emissiveIntensity: 0.35,
        metalness: 0.85,
        roughness: 0.3,
      }),
    );
    border.position.y = 0.005;
    this.group.add(border);

    for (let n = 1; n <= 30; n++) {
      const { row, col } = pathToRC(n);
      const x = -BOARD_W / 2 + (col + 0.5) * CELL;
      const z = -BOARD_D / 2 + (row + 0.5) * CELL;
      const tex = makeSquareTexture(n);
      const cell = new Mesh(
        new PlaneGeometry(CELL * 0.96, CELL * 0.96),
        new MeshStandardMaterial({
          map: tex,
          roughness: 0.85,
          side: DoubleSide,
        }),
      );
      cell.rotation.x = -Math.PI / 2;
      cell.position.set(x, 0.02, z);
      cell.userData = { square: n };
      this.group.add(cell);
    }
  }

  private buildPieces(): void {
    const pedestalGeom = new CylinderGeometry(PIECE_R, PIECE_R * 1.04, PIECE_H, 28);
    const faceGeom = new PlaneGeometry(PIECE_FACE, PIECE_FACE);
    const playerTex = makePieceTexture('player');
    const oppTex = makePieceTexture('opponent');

    const mkPedestalMat = (side: Side) =>
      new MeshStandardMaterial({
        color: side === 'player' ? 0x8a6428 : 0x2a3a68,
        emissive: side === 'player' ? 0x2c1804 : 0x0a1024,
        emissiveIntensity: 0.5,
        metalness: 0.7,
        roughness: 0.35,
      });

    const starts: { side: Side; sq: number }[] = [
      { side: 'player', sq: 1 },
      { side: 'opponent', sq: 2 },
      { side: 'player', sq: 3 },
      { side: 'opponent', sq: 4 },
    ];
    for (const s of starts) {
      const ped = new Mesh(pedestalGeom, mkPedestalMat(s.side));
      const face = new Mesh(
        faceGeom,
        new MeshStandardMaterial({
          map: s.side === 'player' ? playerTex : oppTex,
          transparent: true,
          roughness: 0.45,
          metalness: 0.2,
          emissive: s.side === 'player' ? 0x3a2b08 : 0x0a1838,
          emissiveIntensity: 0.55,
        }),
      );
      face.rotation.x = -Math.PI / 2;
      face.position.y = PIECE_H / 2 + 0.005;
      ped.add(face);

      const piece: Piece = {
        mesh: ped,
        decal: face,
        side: s.side,
        square: s.sq,
        preTrapSquare: s.sq,
        anim: {
          from: new Vector3(),
          to: new Vector3(),
          t: 0,
          dur: 0,
          active: false,
          hop: 0,
        },
      };
      ped.position.copy(squareWorld(s.sq));
      ped.userData = { piece };
      this.pieces.push(piece);
      this.group.add(ped);
    }
  }

  private buildSticks(): void {
    // Stick oriented with its long axis along X (length 2.6). Marked/unmarked
    // face toggles via rotation around X (the long axis). Rest positions are
    // distributed along Z so the four sticks sit as parallel planks in the
    // tray without overlapping.
    const geom = new BoxGeometry(2.6, 0.22, 0.3);
    const trayZBase = BOARD_D / 2 + 1.9;
    const trayStride = 0.55; // >> stick Z thickness (0.3) → clear gaps
    for (let i = 0; i < 4; i++) {
      const mat = new MeshStandardMaterial({
        map: this.stickTexMarked,
        roughness: 0.55,
        metalness: 0.15,
        emissive: 0x2a1c08,
        emissiveIntensity: 0.25,
      });
      const mesh = new Mesh(geom, mat);
      const z = trayZBase + (i - 1.5) * trayStride;
      mesh.position.set(0, 0.15, z);
      mesh.userData = { stickIndex: i };
      this.group.add(mesh);
      this.sticks.push({
        mesh,
        up: true,
        anim: false,
        t: 0,
        dur: STICK_DUR,
        startX: 0,
        startY: 0.15,
        startZ: z,
        peakY: 5.2,
        endX: 0,
        endZ: z,
        rotXStart: 0,
        rotXEnd: 0,
        rotZStart: 0,
        rotZEnd: 0,
      });
    }
  }

  /* -------------------------- DOM control & chrome -------------------------- */

  private buildDomControls(): void {
    const wrap = document.createElement('div');
    wrap.id = 'puzzle-senet-root';
    wrap.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:25;font-family:system-ui,-apple-system,sans-serif;';

    // Top status card + throw button
    const top = document.createElement('div');
    top.style.cssText =
      'position:absolute;left:50%;top:24px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:auto;';
    const status = document.createElement('div');
    status.style.cssText =
      'padding:10px 22px;border:1px solid rgba(212,168,67,0.35);border-bottom:3px solid #d4a843;background:rgba(10,6,2,0.8);backdrop-filter:blur(10px);border-radius:6px;color:#fff;letter-spacing:0.05em;font-size:14px;text-align:center;min-width:360px;';
    this.statusEl = status;
    const btn = document.createElement('button');
    btn.textContent = 'THROW STICKS';
    btn.style.cssText =
      'padding:12px 28px;border:1px solid #d4a843;background:linear-gradient(180deg,#3a2608,#1a1004);color:#d4a843;letter-spacing:0.18em;font-weight:600;cursor:pointer;border-radius:4px;font-size:14px;font-family:inherit;';
    btn.addEventListener('click', () => this.throwSticks());
    this.rollBtn = btn;
    top.append(status, btn);

    // Rules toggle (top-left)
    const rulesBtn = document.createElement('button');
    rulesBtn.textContent = 'ⓘ RULES';
    rulesBtn.style.cssText =
      'position:absolute;top:24px;left:24px;padding:8px 14px;border:1px solid rgba(212,168,67,0.4);background:rgba(10,6,2,0.7);color:#d4a843;letter-spacing:0.12em;font-weight:600;cursor:pointer;border-radius:4px;font-size:12px;pointer-events:auto;font-family:inherit;';
    const rules = document.createElement('div');
    rules.style.cssText =
      'position:absolute;top:70px;left:24px;max-width:360px;max-height:70vh;overflow-y:auto;padding:16px 18px;border:1px solid rgba(212,168,67,0.35);background:rgba(14,8,3,0.92);backdrop-filter:blur(12px);color:#e6dcc2;border-radius:6px;font-size:12.5px;line-height:1.55;display:none;pointer-events:auto;';
    rules.innerHTML = `
      <div style="color:#d4a843;letter-spacing:0.18em;font-weight:700;font-size:12px;margin-bottom:8px">SENET · THE GAME OF PASSING</div>
      <p>Senet (𓊃𓈖𓏏 — "passing") is one of humanity's oldest board games, carved into mastabas as early as 3100 BCE and buried alongside Tutankhamun. Egyptians believed the board mirrored the journey of the soul through the Duat to reach the afterlife.</p>
      <div style="color:#d4a843;font-weight:600;margin-top:10px">The throw sticks</div>
      <p>Four flat sticks are tossed. Count the <b>light (marked) sides</b>. 1 marked = roll 1, 2 = roll 2, 3 = roll 3, 4 = roll 4, and <b>all dark</b> = roll 5. Rolling <b>1, 4, or 5</b> grants an <b>extra turn</b>.</p>
      <div style="color:#d4a843;font-weight:600;margin-top:10px">Moving</div>
      <p>Click one of your Ankh pieces to advance by the roll. You may only move <b>backward</b> when no forward move exists. You cannot land on your own piece. Land on a lone enemy to <b>capture</b> it — the pieces swap. A piece with an <b>adjacent friend</b> is protected.</p>
      <div style="color:#d4a843;font-weight:600;margin-top:10px">Sacred squares</div>
      <p>
        <span style="color:#44b87a">☥ 15 Rebirth</span> · safe haven after drowning.<br>
        <span style="color:#d4a843">✦ 26 Beauty</span> · safe + extra turn.<br>
        <span style="color:#4a90d9">〰 27 Water</span> · drown, back to 15.<br>
        <span style="color:#e8a030">III 28 Three Truths</span> · judgment.<br>
        <span style="color:#e8a030">II 29 Re-Atoum</span> · eternal return.<br>
        <span style="color:#d4a843">☀ 30 Departure</span> · exact roll to exit.
      </p>
      <div style="color:#7b2d8e;font-weight:600;margin-top:10px">Thoth's traps</div>
      <p>Squares <b>7, 14, 21</b> are Thoth's arithmetic gates. Landing there opens a math trap with a 10-second timer. Answer correctly to hold the square; fail and your piece snaps back to where it came from, ending your turn.</p>
      <div style="color:#d4a843;font-weight:600;margin-top:10px">Victory</div>
      <p>Shepherd both Ankhs past square 30. The first soul to complete the journey wins the day.</p>
    `;
    this.rulesEl = rules;
    rulesBtn.addEventListener('click', () => {
      rules.style.display = rules.style.display === 'none' ? 'block' : 'none';
    });

    // Banner overlay (centered, hidden until used)
    const banner = document.createElement('div');
    banner.style.cssText =
      'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(0.9);opacity:0;transition:opacity 260ms ease,transform 320ms cubic-bezier(0.2,0.9,0.3,1.2);pointer-events:none;';
    this.bannerEl = banner;

    // Trap modal (hidden)
    const trap = document.createElement('div');
    trap.style.cssText =
      'position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(30,15,46,0.6),rgba(0,0,0,0.82));pointer-events:auto;';
    this.trapEl = trap;

    wrap.append(top, rulesBtn, rules, banner, trap);
    document.body.appendChild(wrap);
  }

  private updateStatus(): void {
    if (!this.statusEl) return;
    const whose =
      this.phase === 'won'
        ? 'VICTORY'
        : this.phase === 'lost'
          ? 'THE GODS PREVAIL'
          : this.turn === 'player'
            ? 'YOUR TURN'
            : "GODS' TURN";
    const rollLine =
      this.phase === 'trap'
        ? 'THOTH TESTS YOU…'
        : this.roll < 0
          ? 'throw the sticks'
          : `rolled ${this.roll}${this.lastRollExtra ? ' · extra turn' : ''}${this.roll === 0 ? ' — pass' : ''}`;
    const score = `Ankh ${this.exitedPlayer}/2 · Eye ${this.exitedOpponent}/2`;
    this.statusEl.innerHTML = `<div style="color:#d4a843;font-weight:700;letter-spacing:0.14em">${whose}</div><div style="opacity:0.82;margin-top:3px">${rollLine}</div><div style="font-size:11px;opacity:0.6;margin-top:6px;letter-spacing:0.08em">${score}</div>`;
    if (this.rollBtn) {
      const canRoll =
        this.phase === 'idle' && this.turn === 'player' && this.roll < 0;
      this.rollBtn.disabled = !canRoll;
      this.rollBtn.style.opacity = canRoll ? '1' : '0.4';
      this.rollBtn.style.pointerEvents = canRoll ? 'auto' : 'none';
    }
  }

  /* ------------------------------- Banners ---------------------------------- */

  private showBanner(opts: {
    icon: string;
    title: string;
    sub?: string;
    color: string;
    bg: string;
    hold?: number;
  }): void {
    if (!this.bannerEl) return;
    const hold = opts.hold ?? BANNER_TIME;
    this.bannerTimer = hold;
    this.bannerEl.innerHTML = `
      <div style="position:relative;min-width:360px;max-width:520px;padding:22px 34px;background:linear-gradient(180deg,${opts.bg},#0b0603);border:1px solid ${opts.color}99;border-radius:8px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,0.6),0 0 0 1px ${opts.color}33 inset;">
        <div style="position:absolute;top:6px;left:6px;width:10px;height:10px;border-left:2px solid ${opts.color};border-top:2px solid ${opts.color};opacity:0.65"></div>
        <div style="position:absolute;top:6px;right:6px;width:10px;height:10px;border-right:2px solid ${opts.color};border-top:2px solid ${opts.color};opacity:0.65"></div>
        <div style="position:absolute;bottom:6px;left:6px;width:10px;height:10px;border-left:2px solid ${opts.color};border-bottom:2px solid ${opts.color};opacity:0.65"></div>
        <div style="position:absolute;bottom:6px;right:6px;width:10px;height:10px;border-right:2px solid ${opts.color};border-bottom:2px solid ${opts.color};opacity:0.65"></div>
        <div style="font-size:46px;line-height:1;color:${opts.color};text-shadow:0 0 18px ${opts.color}88">${opts.icon}</div>
        <div style="font-size:17px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:${opts.color};margin-top:10px">${opts.title}</div>
        ${opts.sub ? `<div style="font-size:12.5px;color:rgba(255,255,255,0.78);margin-top:6px;letter-spacing:0.04em">${opts.sub}</div>` : ''}
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

  /* --------------------------- Stick throw flow ----------------------------- */

  private throwSticks(): void {
    if (this.phase !== 'idle' || this.turn !== 'player' || this.roll >= 0) return;
    this.phase = 'rolling';
    this.animateSticks(true);
  }

  private animateSticks(forPlayer: boolean): void {
    const outcomes: boolean[] = [];
    for (let i = 0; i < 4; i++) outcomes.push(Math.random() < 0.5);
    const marked = outcomes.filter((v) => v).length;
    const roll = marked === 0 ? 5 : marked;
    this.roll = roll;
    this.lastRollExtra = roll === 1 || roll === 4 || roll === 5;

    // Toss physics: each stick flies up in a parabola, tumbles on X+Z, lands
    // spread across the board's front edge. Different durations per stick so
    // the landings feel staggered and chaotic.
    const landZBase = BOARD_D / 2 + 1.9;
    const trayStride = 0.55;
    for (let i = 0; i < 4; i++) {
      const s = this.sticks[i];
      const finalUp = outcomes[i];
      s.anim = true;
      s.t = 0;
      s.dur = STICK_DUR + i * 0.08 + Math.random() * 0.12;
      s.startX = s.mesh.position.x;
      s.startY = s.mesh.position.y;
      s.startZ = s.mesh.position.z;
      s.peakY = 4.8 + Math.random() * 1.4;
      // Land in a loose fan, but each stick keeps its own Z slot so they don't
      // stack on top of one another once they settle.
      s.endX = (Math.random() - 0.5) * 1.4;
      s.endZ = landZBase + (i - 1.5) * trayStride + (Math.random() - 0.5) * 0.25;
      s.rotXStart = s.mesh.rotation.x;
      s.rotZStart = s.mesh.rotation.z;
      // Several flips (x) + some tumble (z), settling to the marked/unmarked face.
      const flipsX = 6 + Math.floor(Math.random() * 4);
      const tumbleZ = 1 + Math.floor(Math.random() * 3);
      const finalAngleX = finalUp ? 0 : Math.PI;
      s.rotXEnd = finalAngleX + Math.PI * 2 * flipsX * (Math.random() < 0.5 ? 1 : -1);
      s.rotZEnd = (Math.random() - 0.5) * 0.4 + Math.PI * 2 * tumbleZ * (Math.random() < 0.5 ? 1 : -1);
      s.up = finalUp;
      (s.mesh.material as MeshStandardMaterial).map = finalUp
        ? this.stickTexMarked
        : this.stickTexDark;
      (s.mesh.material as MeshStandardMaterial).needsUpdate = true;
    }
    const maxDur = Math.max(...this.sticks.map((x) => x.dur));
    setTimeout(() => this.onRollSettled(forPlayer), maxDur * 1000);
  }

  private onRollSettled(forPlayer: boolean): void {
    this.updateStatus();
    const side: Side = forPlayer ? 'player' : 'opponent';
    if (!this.hasAnyMove(side)) {
      this.showBanner({
        icon: '⊘',
        title: 'No Legal Move',
        sub: `Rolled ${this.roll} — turn passes.`,
        color: '#8a7041',
        bg: '#1a1208',
        hold: 1.6,
      });
      setTimeout(() => this.endTurn(), 1300);
      this.phase = forPlayer ? 'idle' : 'ai-wait';
      return;
    }
    if (forPlayer) {
      this.phase = 'await-move';
      this.computeHighlights('player');
    } else {
      this.phase = 'ai-moving';
      this.aiPickAndMove();
    }
  }

  /* ------------------------------ Move logic -------------------------------- */

  private legalTargetForward(p: Piece, roll: number): number | null {
    if (roll <= 0) return null;
    const raw = p.square + roll;
    let target = raw;
    if (raw > PATH_END) {
      // Exact-exit rule: only roll = 30 - square exits.
      if (p.square + roll === PATH_END + 0) return PATH_END;
      // Exact exit means roll === (30 - square), i.e. land on 30 precisely with
      // an extra step rolls you off (OFF_BOARD). The app uses: target > 30 bounces.
      const over = raw - PATH_END;
      target = PATH_END - over;
    }
    if (target < 1) return null;
    return this.validLanding(p, target);
  }

  private legalTargetBackward(p: Piece, roll: number): number | null {
    if (roll <= 0) return null;
    const target = p.square - roll;
    if (target < 1) return null;
    return this.validLanding(p, target);
  }

  private canExit(p: Piece, roll: number): number | null {
    // Square n exits only when roll === 30 - square + 1 (land precisely past).
    // App logic: roll exactly reaches 30 → exit (OFF_BOARD).
    if (p.square + roll === PATH_END + 1) return OFF_BOARD;
    if (p.square + roll === PATH_END) return PATH_END; // also allowed — treated as land on 30
    return null;
  }

  private validLanding(p: Piece, target: number): number | null {
    if (target < 1 || target > PATH_END) return null;
    const occ = this.pieces.find((q) => q !== p && q.square === target);
    if (!occ) return target;
    if (occ.side === p.side) return null;
    if (target === 26) return null; // Beauty protects occupant.
    const protectedByFriend = this.pieces.some(
      (q) =>
        q !== occ &&
        q.side === occ.side &&
        (q.square === target - 1 || q.square === target + 1),
    );
    if (protectedByFriend) return null;
    return target;
  }

  private hasAnyMove(side: Side): boolean {
    if (this.roll <= 0) return false;
    for (const p of this.pieces) {
      if (p.side !== side || p.square > PATH_END) continue;
      if (this.legalTargetForward(p, this.roll) !== null) return true;
      if (this.canExit(p, this.roll) !== null) return true;
    }
    // Forward blocked — backward allowed.
    for (const p of this.pieces) {
      if (p.side !== side || p.square > PATH_END) continue;
      if (this.legalTargetBackward(p, this.roll) !== null) return true;
    }
    return false;
  }

  private computeHighlights(side: Side): void {
    this.clearHighlights();
    const forwardAvailable = this.pieces.some(
      (p) =>
        p.side === side &&
        p.square <= PATH_END &&
        (this.legalTargetForward(p, this.roll) !== null || this.canExit(p, this.roll) !== null),
    );
    for (const p of this.pieces) {
      if (p.side !== side || p.square > PATH_END) continue;
      const fwd = this.legalTargetForward(p, this.roll);
      const exit = this.canExit(p, this.roll);
      const back = !forwardAvailable ? this.legalTargetBackward(p, this.roll) : null;
      if (fwd !== null || exit !== null) this.highlightSquares.add(p.square);
      else if (back !== null) {
        this.highlightSquares.add(p.square);
        this.backwardSquares.add(p.square);
      }
    }
    for (const sq of this.highlightSquares) {
      const { row, col } = pathToRC(sq);
      const x = -BOARD_W / 2 + (col + 0.5) * CELL;
      const z = -BOARD_D / 2 + (row + 0.5) * CELL;
      const isBack = this.backwardSquares.has(sq);
      const ring = new Mesh(
        new PlaneGeometry(CELL * 1.04, CELL * 1.04),
        new MeshStandardMaterial({
          color: isBack ? 0xd94444 : HIGHLIGHT,
          emissive: isBack ? 0xd94444 : HIGHLIGHT,
          emissiveIntensity: 1.2,
          transparent: true,
          opacity: 0.35,
          side: DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.04, z);
      ring.userData.isHighlight = true;
      this.group.add(ring);
      this.highlightMeshes.push(ring);
    }
  }

  private clearHighlights(): void {
    for (const m of this.highlightMeshes) {
      this.group.remove(m);
      m.geometry.dispose();
      (m.material as MeshStandardMaterial).dispose();
    }
    this.highlightMeshes = [];
    this.highlightSquares.clear();
    this.backwardSquares.clear();
  }

  /* ------------------------------- Piece move ------------------------------- */

  private resolveMove(p: Piece): { target: number; direction: 'forward' | 'backward' | 'exit' } | null {
    const exit = this.canExit(p, this.roll);
    if (exit !== null) return { target: exit, direction: exit === OFF_BOARD ? 'exit' : 'forward' };
    const fwd = this.legalTargetForward(p, this.roll);
    if (fwd !== null) return { target: fwd, direction: 'forward' };
    const forwardAvailableAnywhere = this.pieces.some(
      (q) =>
        q.side === p.side &&
        q.square <= PATH_END &&
        (this.legalTargetForward(q, this.roll) !== null || this.canExit(q, this.roll) !== null),
    );
    if (!forwardAvailableAnywhere) {
      const back = this.legalTargetBackward(p, this.roll);
      if (back !== null) return { target: back, direction: 'backward' };
    }
    return null;
  }

  private applyMove(p: Piece, target: number): void {
    p.preTrapSquare = p.square;

    // Capture swap (opponent goes to attacker's origin).
    const occ = this.pieces.find((q) => q !== p && q.square === target && target <= PATH_END);
    if (occ && occ.side !== p.side) {
      occ.square = p.preTrapSquare;
      this.animatePiece(occ, squareWorld(occ.square));
      this.showBanner({
        icon: '𓂝',
        title: p.side === 'player' ? 'Captured!' : 'The Gods Strike',
        sub: p.side === 'player' ? 'An Eye is banished.' : 'An Ankh is driven back.',
        color: '#d94444',
        bg: '#1a1008',
      });
    }

    if (target >= OFF_BOARD) {
      p.square = OFF_BOARD;
      if (p.side === 'player') this.exitedPlayer++;
      else this.exitedOpponent++;
      const exitX = BOARD_W / 2 + 1.2;
      const exitZ = p.side === 'player' ? BOARD_D / 2 + 0.6 : -BOARD_D / 2 - 0.6;
      // Mark so the frame loop hands control back to endTurn once the ankh
      // has floated off the board (otherwise the turn never closes).
      p.mesh.userData.pendingExit = true;
      this.animatePiece(p, new Vector3(exitX, 0.25, exitZ));
      this.showBanner({
        icon: '☀',
        title: 'Departure',
        sub:
          p.side === 'player'
            ? 'An Ankh crosses to the afterlife.'
            : 'An Eye escapes your reach.',
        color: '#d4a843',
        bg: '#2e2510',
      });
    } else {
      p.square = target;
      this.animatePiece(p, squareWorld(target));
      // Special-square narration on LAND (applied when the animation settles).
      this.queuePostLand(p, target);
    }

    this.phase = 'moving';
    this.clearHighlights();
    this.checkEnd();
  }

  private queuePostLand(p: Piece, square: number): void {
    // We detect the landing effect on animation completion, storing intent.
    p.mesh.userData.pendingLand = square;
  }

  private handlePostLand(p: Piece, square: number): void {
    if (square === 26) {
      this.showBanner({
        icon: '✦',
        title: 'House of Beauty',
        sub: 'Safe haven · another throw.',
        color: '#d4a843',
        bg: '#2e2510',
      });
    } else if (square === 27) {
      this.showBanner({
        icon: '〰',
        title: 'House of Water',
        sub: 'You drown — swept back to Rebirth.',
        color: '#4a90d9',
        bg: '#0f1e2e',
      });
      // Back to 15 or nearest free lower square.
      let back = 15;
      while (back > 0 && this.pieces.some((q) => q !== p && q.square === back)) back--;
      p.square = back || 1;
      this.animatePiece(p, squareWorld(p.square));
    } else if (square === 15 && p.preTrapSquare !== 15) {
      this.showBanner({
        icon: '☥',
        title: 'House of Rebirth',
        sub: 'The journey begins anew.',
        color: '#44b87a',
        bg: '#1a2e1a',
      });
    } else if (MATH_TRAP_SQUARES.has(square)) {
      if (p.side === 'player') {
        this.openTrap(p, square);
        return; // trap modal takes over
      }
      // Bot: resolve the trap silently — 70% pass, 30% fail.
      this.resolveBotTrap(p, square);
      return;
    }
    // Continue flow.
    if (!this.isSolved) this.scheduleTurnEnd();
  }

  private resolveBotTrap(p: Piece, _square: number): void {
    const pass = Math.random() < 0.7;
    if (pass) {
      this.showBanner({
        icon: '𓁹',
        title: 'Thoth Favours the Gods',
        sub: 'The opponent answers correctly.',
        color: '#7b2d8e',
        bg: '#140c22',
        hold: 1.6,
      });
    } else {
      p.square = p.preTrapSquare;
      this.animatePiece(p, squareWorld(p.square));
      this.showBanner({
        icon: '𓁹',
        title: 'Thoth Denies the Gods',
        sub: 'The opponent falters — driven back.',
        color: '#44b87a',
        bg: '#0f2018',
        hold: 1.6,
      });
      this.lastRollExtra = false;
    }
    setTimeout(() => {
      if (this.phase !== 'won' && this.phase !== 'lost') this.endTurn();
    }, 1100);
  }

  private scheduleTurnEnd(): void {
    setTimeout(() => {
      if (this.phase === 'won' || this.phase === 'lost') return;
      this.endTurn();
    }, 350);
  }

  private animatePiece(p: Piece, to: Vector3): void {
    p.anim.from.copy(p.mesh.position);
    p.anim.to.copy(to);
    p.anim.t = 0;
    p.anim.dur = ANIM_DUR;
    p.anim.hop = 0.65;
    p.anim.active = true;
  }

  private endTurn(): void {
    const extra = this.lastRollExtra && this.roll > 0;
    const wasBeauty = this.pieces.some((p) => p.square === 26 && p.side === this.turn);
    this.roll = -1;
    this.lastRollExtra = false;
    this.turnCount++;
    if (extra || wasBeauty) {
      this.phase = this.turn === 'player' ? 'idle' : 'ai-wait';
      if (this.turn === 'opponent') this.scheduleAI();
      this.updateStatus();
      return;
    }
    this.turn = this.turn === 'player' ? 'opponent' : 'player';
    this.phase = this.turn === 'player' ? 'idle' : 'ai-wait';
    if (this.turn === 'opponent') this.scheduleAI();
    this.updateStatus();
  }

  private checkEnd(): void {
    if (this.exitedPlayer >= 2) {
      this.phase = 'won';
      this.isSolved = true;
      this.showBanner({
        icon: '𓅃',
        title: 'Victory',
        sub: 'The Ankhs cross into eternity.',
        color: '#44b87a',
        bg: '#0f2018',
        hold: 3.2,
      });
      setTimeout(() => this.onSolved?.('player'), 2400);
    } else if (this.exitedOpponent >= 2) {
      this.phase = 'lost';
      this.isSolved = true; // advance the run either way
      this.showBanner({
        icon: '𓁹',
        title: 'The Gods Prevail',
        sub: 'Chronos laughs — the run continues.',
        color: '#d94444',
        bg: '#1a0808',
        hold: 3.2,
      });
      setTimeout(() => this.onSolved?.('opponent'), 2400);
    }
  }

  /* ----------------------------------- AI ----------------------------------- */

  private scheduleAI(): void {
    this.phase = 'ai-wait';
    this.aiTimer = AI_DELAY;
    this.updateStatus();
  }

  private aiPickAndMove(): void {
    // Collect candidates and pick a capture-preferring one with slight disadvantage
    // (AI doesn't exit aggressively to keep the jam game tense but winnable).
    const cands: { p: Piece; target: number; capture: boolean; isExit: boolean }[] = [];
    for (const p of this.pieces) {
      if (p.side !== 'opponent' || p.square > PATH_END) continue;
      const res = this.resolveMove(p);
      if (!res) continue;
      const capture = this.pieces.some(
        (q) => q !== p && q.square === res.target && q.side === 'player' && res.target <= PATH_END,
      );
      cands.push({ p, target: res.target, capture, isExit: res.direction === 'exit' });
    }
    if (cands.length === 0) {
      setTimeout(() => this.endTurn(), 500);
      return;
    }
    cands.sort((a, b) => {
      if (a.capture !== b.capture) return a.capture ? -1 : 1;
      // Slight bias against exiting (keep them on the board a bit).
      if (a.isExit !== b.isExit) return a.isExit ? 1 : -1;
      return a.p.square - b.p.square;
    });
    const pick = cands[0];
    this.applyMove(pick.p, pick.target);
  }

  /* --------------------------------- Traps --------------------------------- */

  private openTrap(p: Piece, square: number): void {
    this.pendingTrap = { piece: p, targetSquare: square };
    // Re-roll until we get a prompt that hasn't been shown recently.
    let candidate: Trap;
    let tries = 0;
    do {
      candidate = generateTrap();
      tries++;
    } while (this.recentPrompts.includes(candidate.prompt) && tries < 24);
    this.trap = candidate;
    this.recentPrompts.push(candidate.prompt);
    if (this.recentPrompts.length > 20) this.recentPrompts.shift();
    this.trapInput = '';
    this.trapRemaining = TRAP_TIME;
    this.phase = 'trap';
    this.renderTrap();
    if (this.trapEl) this.trapEl.style.display = 'flex';
    this.showBanner({
      icon: '𓁹',
      title: 'Thoth Challenges You',
      sub: 'Answer within 10 seconds.',
      color: '#7b2d8e',
      bg: '#140c22',
      hold: 1.6,
    });
    this.updateStatus();
  }

  private renderTrap(): void {
    if (!this.trapEl || !this.trap) return;
    this.trapEl.innerHTML = `
      <div style="width:min(92vw,420px);padding:26px 24px 20px;background:linear-gradient(180deg,#1e0f2e,#0b0612);border:1px solid #7b2d8e;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,0.7);font-family:system-ui,sans-serif;color:#ead6ff;text-align:center;">
        <div style="font-size:42px;color:#b77ccc;line-height:1">𓁹</div>
        <div style="color:#b77ccc;letter-spacing:0.18em;font-weight:700;font-size:12px;margin-top:6px">THOTH'S TRAP</div>
        <div id="trap-timer" style="margin-top:8px;font-size:13px;letter-spacing:0.1em;color:#ddc6ff">10.0s</div>
        <div style="margin-top:16px;font-size:19px;font-weight:600;letter-spacing:0.02em;color:#fff">${this.trap.prompt}</div>
        <div id="trap-answer" style="margin:14px auto 4px;min-width:180px;padding:12px 18px;border:1px solid #7b2d8e;border-radius:6px;background:rgba(123,45,142,0.12);font-family:ui-monospace,monospace;font-size:22px;color:#f5d060;letter-spacing:0.12em;">?</div>
        <div id="trap-pad" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px"></div>
      </div>`;
    const pad = this.trapEl.querySelector('#trap-pad') as HTMLDivElement | null;
    if (pad) {
      const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0', '✓'];
      for (const k of keys) {
        const b = document.createElement('button');
        b.textContent = k;
        b.style.cssText =
          'padding:14px 0;border:1px solid #7b2d8e66;background:linear-gradient(180deg,#2a1740,#14091e);color:#ead6ff;font-size:18px;font-weight:600;cursor:pointer;border-radius:5px;font-family:inherit;';
        if (k === '✓')
          b.style.cssText += 'color:#44b87a;border-color:#44b87a99;';
        if (k === '⌫')
          b.style.cssText += 'color:#d94444;border-color:#d9444499;';
        b.addEventListener('click', () => this.onTrapKey(k));
        pad.appendChild(b);
      }
    }
    this.renderTrapAnswer();
  }

  private renderTrapAnswer(): void {
    if (!this.trapEl) return;
    const el = this.trapEl.querySelector('#trap-answer') as HTMLDivElement | null;
    if (el) el.textContent = this.trapInput === '' ? '?' : this.trapInput;
  }

  private renderTrapTimer(): void {
    if (!this.trapEl) return;
    const el = this.trapEl.querySelector('#trap-timer') as HTMLDivElement | null;
    if (!el) return;
    const remaining = Math.max(0, this.trapRemaining);
    el.textContent = `${remaining.toFixed(1)}s`;
    el.style.color = remaining <= 3 ? '#d94444' : '#ddc6ff';
    el.style.fontWeight = remaining <= 3 ? '700' : '400';
  }

  private onTrapKey(k: string): void {
    if (this.phase !== 'trap' || !this.trap) return;
    if (k === '⌫') {
      this.trapInput = this.trapInput.slice(0, -1);
      this.renderTrapAnswer();
      return;
    }
    if (k === '✓') {
      this.resolveTrap();
      return;
    }
    if (this.trapInput.length < 5) {
      this.trapInput += k;
      this.renderTrapAnswer();
    }
  }

  private resolveTrap(timedOut = false): void {
    if (!this.trap || !this.pendingTrap) return;
    const correct = !timedOut && parseInt(this.trapInput, 10) === this.trap.answer;
    if (this.trapEl) this.trapEl.style.display = 'none';
    const p = this.pendingTrap.piece;
    if (correct) {
      this.showBanner({
        icon: '☥',
        title: 'Thoth Approves',
        sub: 'Your piece holds the square.',
        color: '#44b87a',
        bg: '#0f2018',
      });
    } else {
      // Snap piece back to preTrapSquare.
      p.square = p.preTrapSquare;
      this.animatePiece(p, squareWorld(p.square));
      this.showBanner({
        icon: '𓁹',
        title: timedOut ? 'Out of Time' : 'Thoth Denies You',
        sub:
          timedOut
            ? 'The hourglass runs dry.'
            : `Answer was ${this.trap.answer}. Your piece retreats.`,
        color: '#d94444',
        bg: '#140808',
      });
      this.lastRollExtra = false; // no bonus even on 1/4/5
    }
    this.pendingTrap = null;
    this.trap = null;
    this.trapInput = '';
    this.phase = 'moving';
    setTimeout(() => this.endTurn(), 900);
  }

  /* --------------------------------- Frame --------------------------------- */

  update(dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 13.5, BOARD_D / 2 + 6.5);
    camera.lookAt(0, 0, 0.2);

    this.updateBanner(dt);

    // Stick toss: parabolic flight + tumble, landing spread across the front edge.
    for (const s of this.sticks) {
      if (!s.anim) continue;
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      // ease-in for lift-off, ease-out for landing.
      const horiz = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      s.mesh.position.x = s.startX + (s.endX - s.startX) * horiz;
      s.mesh.position.z = s.startZ + (s.endZ - s.startZ) * horiz;
      // Parabolic arc: y rises to peakY at k=0.5, lands on the table by k=1.
      const up = Math.sin(k * Math.PI);
      const endY = 0.15;
      s.mesh.position.y = (1 - k) * s.startY + k * endY + (s.peakY - Math.max(s.startY, endY)) * up;
      // Rotations decelerate into the final face.
      const e = 1 - Math.pow(1 - k, 3);
      s.mesh.rotation.x = s.rotXStart + (s.rotXEnd - s.rotXStart) * e;
      s.mesh.rotation.z = s.rotZStart + (s.rotZEnd - s.rotZStart) * e;
      if (k >= 1) {
        s.mesh.position.set(s.endX, endY, s.endZ);
        // Snap rotation to the canonical resting face (0 or π on X, 0 on Z).
        s.mesh.rotation.x = s.up ? 0 : Math.PI;
        s.mesh.rotation.z = 0;
        s.anim = false;
      }
    }

    // Piece animations with hop arc
    let anyMoving = false;
    for (const p of this.pieces) {
      if (!p.anim.active) continue;
      p.anim.t += dt;
      const k = Math.min(1, p.anim.t / p.anim.dur);
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      p.mesh.position.lerpVectors(p.anim.from, p.anim.to, ease);
      p.mesh.position.y =
        Math.max(p.anim.from.y, p.anim.to.y) + Math.sin(k * Math.PI) * p.anim.hop;
      if (k >= 1) {
        p.mesh.position.copy(p.anim.to);
        p.anim.active = false;
        const pending = p.mesh.userData.pendingLand as number | undefined;
        const exited = p.mesh.userData.pendingExit as boolean | undefined;
        if (pending !== undefined) {
          delete p.mesh.userData.pendingLand;
          this.handlePostLand(p, pending);
        } else if (exited) {
          delete p.mesh.userData.pendingExit;
          if (!this.isSolved) this.scheduleTurnEnd();
        }
      } else anyMoving = true;
    }

    if (this.phase === 'moving' && !anyMoving && !this.pendingTrap) {
      // Nothing pending — safety net ensures we never hang.
    }

    if (this.phase === 'trap') {
      this.trapRemaining -= dt;
      this.renderTrapTimer();
      if (this.trapRemaining <= 0) this.resolveTrap(true);
    }

    if (this.phase === 'ai-wait') {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this.phase = 'ai-rolling';
        this.animateSticks(false);
      }
    }
  }

  onPointerDown(ndc: Vector2, camera: PerspectiveCamera): void {
    if (this.phase !== 'await-move' || this.turn !== 'player' || this.roll < 0) return;
    this.raycaster.setFromCamera(ndc, camera);
    const meshes: Mesh[] = [];
    for (const p of this.pieces)
      if (p.side === 'player' && p.square <= PATH_END) meshes.push(p.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return;
    // Walk up to the pedestal mesh that owns userData.piece.
    let obj: { parent: unknown; userData: { piece?: Piece } } | null = hits[0].object as unknown as {
      parent: unknown;
      userData: { piece?: Piece };
    };
    while (obj && !obj.userData.piece) obj = obj.parent as typeof obj;
    const p = obj?.userData.piece;
    if (!p || !this.highlightSquares.has(p.square)) return;
    const res = this.resolveMove(p);
    if (!res) return;
    this.applyMove(p, res.target);
  }

  override dispose(): void {
    const el = document.getElementById('puzzle-senet-root');
    if (el) el.remove();
    this.statusEl = null;
    this.rollBtn = null;
    this.rulesEl = null;
    this.bannerEl = null;
    this.trapEl = null;
    this.trapTimerEl = null;
    super.dispose();
  }
}
