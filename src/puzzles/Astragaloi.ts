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
 * Astragaloi (Αστραγάλοι) — Ancient Greek knucklebone dice game.
 * Roll astragaloi (4 faces: 1, 3, 4, 6), then combine bone values
 * with arithmetic operations to reach a target number.
 *
 * Aligned with iOS AstragaloiGameView.swift:
 *   - Canvas-drawn bones with hourglass knucklebone shape
 *   - Greek Ionic numerals for display
 *   - Merge mechanic: select two bones + operator → merged result
 *   - Undo / restart round support
 *   - Solvability checker warns when target is unreachable
 *   - Round-based with laurel wreath win tracking
 *   - Timer for higher difficulty levels
 *   - Mediterranean blue/gold color theme
 */

/* ── Constants ───────────────────────────────────────────────── */

const BONE_FACES = [1, 3, 4, 6] as const;

type Op = '+' | '−' | '×' | '÷';
const ALL_OPS: Op[] = ['+', '−', '×', '÷'];

/* ── Level config (matches iOS boneCount/totalRounds/requiredWins arrays) ── */

interface LevelConfig {
  boneCount: number;
  totalRounds: number;
  requiredWins: number;
  hasTimer: boolean;
  roundTime: number;
  ops: Op[];
  targetMin: number;
  targetMax: number;
}

const LEVELS: LevelConfig[] = [
  { boneCount: 3, totalRounds: 3, requiredWins: 2, hasTimer: false, roundTime: 0,  ops: ['+', '−'],                targetMin: 2,  targetMax: 15 },
  { boneCount: 3, totalRounds: 4, requiredWins: 3, hasTimer: false, roundTime: 0,  ops: ['+', '−', '×'],          targetMin: 2,  targetMax: 25 },
  { boneCount: 4, totalRounds: 4, requiredWins: 3, hasTimer: true,  roundTime: 45, ops: ['+', '−', '×', '÷'],     targetMin: 3,  targetMax: 35 },
  { boneCount: 4, totalRounds: 5, requiredWins: 4, hasTimer: true,  roundTime: 35, ops: ['+', '−', '×', '÷'],     targetMin: 5,  targetMax: 45 },
  { boneCount: 5, totalRounds: 5, requiredWins: 4, hasTimer: true,  roundTime: 30, ops: ['+', '−', '×', '÷'],     targetMin: 5,  targetMax: 55 },
];

/* ── Colors (Mediterranean blue/gold, matches iOS) ───────────── */

const C_BG_DARK    = '#0A1628';
const C_MARBLE     = '#F2F0EB';
const C_GOLD       = '#D4AF37';
const C_DARK_GOLD  = '#8B6914';
const C_WINE       = '#8B3A4A';
const C_BLUE       = '#4A90D9';
const C_CLAY       = '#3A5A8A';

/* ── Canvas sizes ────────────────────────────────────────────── */

function BOARD_W(): number { return Math.min(380, window.innerWidth - 48); }
function BOARD_H(): number { return Math.round(BOARD_W() * 0.9); }

/* ── Bone data ───────────────────────────────────────────────── */

interface BoneData {
  id: number;
  value: number;
}

/* ── Greek Ionic numerals (matches iOS) ──────────────────────── */

const GREEK_UNITS   = ['', '\u03B1', '\u03B2', '\u03B3', '\u03B4', '\u03B5', '\u03DB', '\u03B6', '\u03B7', '\u03B8'];
const GREEK_TENS    = ['', '\u03B9', '\u03BA', '\u03BB', '\u03BC', '\u03BD', '\u03BE', '\u03BF', '\u03C0', '\u03DF'];
const GREEK_HUNDREDS = ['', '\u03C1', '\u03C3', '\u03C4', '\u03C5', '\u03C6', '\u03C7', '\u03C8', '\u03C9'];

function greekNumeral(n: number): string {
  if (n <= 0 || n > 999) return String(n);
  let result = '';
  let num = n;
  if (num >= 100 && Math.floor(num / 100) < GREEK_HUNDREDS.length) {
    result += GREEK_HUNDREDS[Math.floor(num / 100)];
    num %= 100;
  }
  if (num >= 10 && Math.floor(num / 10) < GREEK_TENS.length) {
    result += GREEK_TENS[Math.floor(num / 10)];
    num %= 10;
  }
  if (num > 0 && num < GREEK_UNITS.length) {
    result += GREEK_UNITS[num];
  }
  return result || String(n);
}

/* ── Solver (matches iOS allReachable / isSolvable) ──────────── */

function applyOp(a: number, b: number, op: Op): number | null {
  switch (op) {
    case '+': return a + b;
    case '−': return a >= b ? a - b : null;
    case '×': return a * b;
    case '÷': return b > 0 && a % b === 0 ? a / b : null;
  }
}

function allReachable(values: number[], ops: Op[]): Set<number> {
  if (values.length === 1) return new Set(values);
  const results = new Set<number>();
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values.length; j++) {
      if (j === i) continue;
      for (const op of ops) {
        const r = applyOp(values[i], values[j], op);
        if (r === null) continue;
        const remaining: number[] = [];
        for (let k = 0; k < values.length; k++) {
          if (k !== i && k !== j) remaining.push(values[k]);
        }
        remaining.push(r);
        for (const v of allReachable(remaining, ops)) results.add(v);
      }
    }
  }
  return results;
}

function generateTarget(values: number[], ops: Op[], min: number, max: number): number {
  const reachable = allReachable(values, ops);
  const valSet = new Set(values);
  const valid = [...reachable].filter(v => v >= min && v <= max && !valSet.has(v) && v > 0);
  if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)];
  const fallback = [...reachable].filter(v => v > 0 && v !== values[0]);
  if (fallback.length > 0) return fallback[Math.floor(Math.random() * fallback.length)];
  return values.reduce((a, b) => a + b, 0);
}

/* ── Puzzle class ─────────────────────────────────────────────── */

let boneIdCounter = 0;

export class AstragaloiPuzzle extends Puzzle {
  readonly title = 'ASTRAGALOI';
  readonly subtitle = 'the knucklebone toss';
  readonly instructions =
    'Roll the astragaloi, then combine bone values with arithmetic to reach the target. Win enough rounds to clear the gate.';

  private level = 4; // 0-indexed into LEVELS (max difficulty)
  private cfg(): LevelConfig { return LEVELS[Math.min(this.level, LEVELS.length - 1)]; }

  // Game state
  private bones: BoneData[] = [];
  private originalBones: BoneData[] = [];
  private target = 0;
  private selectedFirst: number | null = null;
  private selectedOp: Op | null = null;
  private phase: 'rolling' | 'playing' | 'roundEnd' | 'gameOver' = 'rolling';
  private currentRound = 0;
  private roundsWon = 0;
  private timeLeft = 0;
  private timerId = 0;
  private undoStack: BoneData[][] = [];
  private historyLines: string[] = [];
  private errorMsg = '';
  private canReachTarget = true;
  private rollTickCount = 0;
  private rollTimerId = 0;

  // Banner state
  private showBanner = false;
  private bannerTitle = '';
  private bannerDesc = '';
  private bannerIsWin = false;

  // DOM
  private root: HTMLDivElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  /** The canvas element itself — kept as a field so we can attach the
   *  click-to-select handler once in mount() instead of per-frame. */
  private canvasEl: HTMLCanvasElement | null = null;
  /** AABB (CSS-pixel) of each drawn bone for click hit-testing. Refreshed
   *  every `renderBoard()` call so the hit-zone stays aligned with the
   *  currently rendered layout (bone count varies by level). */
  private boneHitRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  private overlayEl: HTMLDivElement | null = null;
  private hudEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private bonesRowEl: HTMLDivElement | null = null;
  private opsRowEl: HTMLDivElement | null = null;
  private actionRowEl: HTMLDivElement | null = null;
  private legendEl: HTMLDivElement | null = null;
  private bannerEl: HTMLDivElement | null = null;
  private retryBtnEl: HTMLButtonElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.buildDom();
    this.startGame();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color(C_BG_DARK), roughness: 0.7, metalness: 0.15, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.18, 12),
      new MeshStandardMaterial({
        color: new Color(C_GOLD), emissive: new Color('#402004'),
        emissiveIntensity: 0.5, roughness: 0.45, metalness: 0.85, side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const warm = new PointLight('#f5cf82', 2.0, 22, 1.6);
    warm.position.set(0, 5.5, 3.5);
    this.group.add(warm);

    const cool = new PointLight('#4A90D9', 0.5, 14, 1.8);
    cool.position.set(-3, 2.5, -3);
    this.group.add(cool);
  }

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-astragaloi';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: 'rgba(10,22,40,0.92)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(212,175,55,0.25)', borderTop: `3px solid ${C_GOLD}`,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_MARBLE,
      maxHeight: '96vh', overflowY: 'auto', maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box',
    });
    root.appendChild(panel);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '16px', letterSpacing: '0.22em', color: C_GOLD, fontWeight: '700' });
    title.textContent = 'ASTRAGALOI · Αστραγάλοι';
    panel.appendChild(title);

    // HUD row
    this.hudEl = document.createElement('div');
    Object.assign(this.hudEl.style, {
      display: 'flex', gap: '14px', alignItems: 'center', justifyContent: 'center', width: '100%',
      fontSize: '12px', letterSpacing: '0.12em', opacity: '0.9',
    });
    panel.appendChild(this.hudEl);

    // Board wrapper (canvas + banner overlay)
    const boardWrap = document.createElement('div');
    Object.assign(boardWrap.style, {
      position: 'relative', width: BOARD_W() + 'px', height: BOARD_H() + 'px',
      borderRadius: '8px', overflow: 'hidden',
      border: `2px solid rgba(212,175,55,0.25)`,
    });

    // Canvas for board background + bones
    const cvs = document.createElement('canvas');
    cvs.width = BOARD_W() * 2;
    cvs.height = BOARD_H() * 2;
    Object.assign(cvs.style, {
      width: BOARD_W() + 'px', height: BOARD_H() + 'px', display: 'block',
      // The bones are clickable targets — the pointer cursor is the
      // visual cue. We don't change it on non-bone areas because the
      // board background is also a click target for dismissing the
      // banner, and we want the affordance to feel lightweight.
      cursor: 'pointer',
    });
    this.ctx2d = cvs.getContext('2d')!;
    this.canvasEl = cvs;

    // Click-to-select: hit-test against the cached bone AABBs drawn
    // last frame. event.offsetX/Y are already in CSS-pixel coords
    // matching our BOARD_W() × BOARD_H() canvas, so no scaling needed.
    cvs.addEventListener('click', (ev) => {
      if (this.phase !== 'playing') return;
      const x = ev.offsetX;
      const y = ev.offsetY;
      for (let i = 0; i < this.boneHitRects.length; i++) {
        const r = this.boneHitRects[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
          this.tapBone(i);
          return;
        }
      }
    });
    boardWrap.appendChild(cvs);

    // Banner overlay container (inside board)
    this.bannerEl = document.createElement('div');
    Object.assign(this.bannerEl.style, {
      position: 'absolute', inset: '0', display: 'none',
      alignItems: 'center', justifyContent: 'center', zIndex: '5',
      background: 'rgba(0,0,0,0.55)', cursor: 'pointer',
    });
    this.bannerEl.addEventListener('click', () => this.dismissBanner());
    boardWrap.appendChild(this.bannerEl);

    panel.appendChild(boardWrap);

    // Status / instruction text
    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, {
      fontSize: '12px', letterSpacing: '0.06em', textAlign: 'center', minHeight: '18px',
      fontWeight: '500',
    });
    panel.appendChild(this.statusEl);

    // Bones row (clickable bone buttons)
    this.bonesRowEl = document.createElement('div');
    Object.assign(this.bonesRowEl.style, {
      display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap',
    });
    panel.appendChild(this.bonesRowEl);

    // Operator row
    this.opsRowEl = document.createElement('div');
    Object.assign(this.opsRowEl.style, { display: 'flex', gap: '8px', justifyContent: 'center' });
    panel.appendChild(this.opsRowEl);

    // Action row (undo, restart, solvability warning)
    this.actionRowEl = document.createElement('div');
    Object.assign(this.actionRowEl.style, {
      display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', width: '100%',
    });
    panel.appendChild(this.actionRowEl);

    // Retry button (game over, not won)
    this.retryBtnEl = document.createElement('button');
    this.retryBtnEl.type = 'button';
    this.retryBtnEl.textContent = 'TRY AGAIN';
    Object.assign(this.retryBtnEl.style, {
      display: 'none', padding: '10px 28px', marginTop: '4px',
      background: `linear-gradient(to right, ${C_GOLD}, ${C_DARK_GOLD})`,
      border: 'none', color: '#fff', fontFamily: 'inherit', fontSize: '14px',
      letterSpacing: '0.18em', fontWeight: '700', borderRadius: '20px', cursor: 'pointer',
    });
    this.retryBtnEl.addEventListener('click', () => this.startGame());
    panel.appendChild(this.retryBtnEl);

    // Greek numeral legend
    this.legendEl = document.createElement('div');
    Object.assign(this.legendEl.style, {
      display: 'none', flexDirection: 'column', alignItems: 'center', gap: '4px',
      padding: '6px 12px',
      background: `rgba(18,34,64,0.6)`,
      border: `0.5px solid rgba(212,175,55,0.15)`,
      borderRadius: '8px', fontSize: '11px',
    });
    panel.appendChild(this.legendEl);

    // Overlay container (for future use, e.g. rules)
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    // Inject animation keyframes
    if (!document.getElementById('astragaloi-anims')) {
      const style = document.createElement('style');
      style.id = 'astragaloi-anims';
      style.textContent = `
        @keyframes astra-pop { from { transform: scale(0.88); opacity:0; } to { transform: scale(1); opacity:1; } }
        @keyframes astra-bounce { 0% { transform: scale(1); } 30% { transform: scale(1.12); } 100% { transform: scale(1); } }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(root);
  }

  /* ═══════════════════ Canvas board drawing ══════════════════════ */

  private drawBoard(): void {
    const c = this.ctx2d!;
    const s = 2;
    c.clearRect(0, 0, BOARD_W() * s, BOARD_H() * s);
    c.save();
    c.scale(s, s);

    // Deep Mediterranean blue gradient background
    const grad = c.createLinearGradient(0, 0, BOARD_W(), BOARD_H());
    grad.addColorStop(0, '#0F1E38');
    grad.addColorStop(0.3, '#142848');
    grad.addColorStop(0.6, '#0F2240');
    grad.addColorStop(1, '#122640');
    c.fillStyle = grad;
    c.fillRect(0, 0, BOARD_W(), BOARD_H());

    // Subtle veins
    c.strokeStyle = 'rgba(74,144,217,0.04)';
    c.lineWidth = 0.5;
    for (let i = 0; i < BOARD_W(); i += 35) {
      c.beginPath();
      c.moveTo(i, 0);
      c.quadraticCurveTo(i + 20, BOARD_H() / 2, i + 12, BOARD_H());
      c.stroke();
    }

    // Double gold border
    c.strokeStyle = 'rgba(212,175,55,0.5)';
    c.lineWidth = 2;
    this.roundRect(c, 6, 6, BOARD_W() - 12, BOARD_H() - 12, 8);
    c.stroke();
    c.strokeStyle = 'rgba(212,175,55,0.25)';
    c.lineWidth = 1;
    this.roundRect(c, 11, 11, BOARD_W() - 22, BOARD_H() - 22, 6);
    c.stroke();

    // Greek key motif top
    this.drawGreekKey(c, 3, 20, BOARD_W() - 20, 8, 'rgba(212,175,55,0.22)');
    // Greek key bottom
    this.drawGreekKey(c, BOARD_H() - 7, 20, BOARD_W() - 20, 8, 'rgba(212,175,55,0.22)');

    // Corner diamonds
    const cs = 5;
    const corners = [
      { x: 14, y: 14 }, { x: BOARD_W() - 14, y: 14 },
      { x: 14, y: BOARD_H() - 14 }, { x: BOARD_W() - 14, y: BOARD_H() - 14 },
    ];
    c.fillStyle = 'rgba(212,175,55,0.4)';
    for (const corner of corners) {
      c.beginPath();
      c.moveTo(corner.x, corner.y - cs);
      c.lineTo(corner.x + cs, corner.y);
      c.lineTo(corner.x, corner.y + cs);
      c.lineTo(corner.x - cs, corner.y);
      c.closePath();
      c.fill();
    }

    // Target medallion (if playing or roundEnd)
    if (this.phase !== 'rolling') {
      this.drawTargetMedallion(c, BOARD_W() / 2, 60, 42);
    } else {
      // Rolling text
      c.fillStyle = 'rgba(212,175,55,0.7)';
      c.font = '500 14px Rajdhani, system-ui';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('Rolling the bones...', BOARD_W() / 2, 50);
    }

    // Draw bones on canvas. We also record an AABB for each so the
    // canvas click handler can hit-test. The rect is slightly padded
    // outward so hitting "near enough" the hourglass silhouette still
    // registers — the hourglass has pinched sides and strict pixel
    // tests would frustrate players who click between the lobes.
    this.boneHitRects.length = 0;
    if (this.bones.length > 0) {
      const boneW = Math.min(56, (BOARD_W() - 60 - (this.bones.length - 1) * 12) / this.bones.length);
      const boneH = boneW * 1.3;
      const totalW = this.bones.length * boneW + (this.bones.length - 1) * 12;
      const startX = (BOARD_W() - totalW) / 2;
      const boneY = BOARD_H() / 2 - boneH / 2 + 10;
      const pad = 6;

      for (let i = 0; i < this.bones.length; i++) {
        const x = startX + i * (boneW + 12);
        const selected = this.selectedFirst === i;
        this.drawBone(c, x, boneY, boneW, boneH, this.bones[i].value, selected);
        this.boneHitRects.push({
          x: x - pad,
          y: boneY - pad,
          w: boneW + pad * 2,
          h: boneH + pad * 2,
        });
      }
    }

    // History lines
    if (this.historyLines.length > 0 && this.phase === 'playing') {
      const lines = this.historyLines.slice(-3);
      c.fillStyle = 'rgba(212,175,55,0.5)';
      c.font = '400 10px Rajdhani, system-ui';
      c.textAlign = 'center';
      c.textBaseline = 'top';
      for (let i = 0; i < lines.length; i++) {
        c.fillText(lines[i], BOARD_W() / 2, BOARD_H() - 50 + i * 14);
      }
    }

    c.restore();
  }

  private drawTargetMedallion(c: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    // Gold medallion background
    c.fillStyle = 'rgba(212,175,55,0.12)';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(212,175,55,0.5)';
    c.lineWidth = 2;
    c.stroke();

    // Inner ring
    c.strokeStyle = 'rgba(212,175,55,0.25)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cx, cy, r - 6, 0, Math.PI * 2);
    c.stroke();

    // Laurel wreath
    this.drawLaurelWreath(c, cx, cy, r * 0.75);

    // "TARGET" label
    c.fillStyle = 'rgba(212,175,55,0.6)';
    c.font = '500 8px Rajdhani, system-ui';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('TARGET', cx, cy - 12);

    // Greek numeral
    c.fillStyle = C_GOLD;
    c.font = 'bold 22px Rajdhani, system-ui';
    c.fillText(greekNumeral(this.target), cx, cy + 6);
  }

  private drawLaurelWreath(c: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    const leafCount = 6;
    for (const sideSign of [-1, 1]) {
      for (let i = 0; i < leafCount; i++) {
        const t = i / leafCount;
        const angle = Math.PI * (0.2 + t * 0.6);
        const x = cx + Math.cos(angle) * radius * sideSign;
        const y = cy - Math.sin(angle) * radius;
        const leafAngle = angle * sideSign + Math.PI / 2;
        const leafW = 4;
        const leafH = 9;

        c.save();
        c.translate(x, y);
        c.rotate(leafAngle);
        c.fillStyle = `rgba(107,142,78,${0.5 + t * 0.3})`;
        c.beginPath();
        c.ellipse(0, 0, leafW / 2, leafH / 2, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }
  }

  private drawBone(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, value: number, selected: boolean): void {
    const cx = x + w / 2;
    const cy = y + h / 2;

    // Shadow
    c.fillStyle = 'rgba(0,0,0,0.25)';
    this.roundRect(c, x + 3, y + 4, w - 2, h - 2, 10);
    c.fill();

    // Bone body — hourglass knucklebone shape
    const topW = w * 0.88;
    const midW = w * 0.6;
    c.beginPath();
    c.moveTo(cx - topW / 2, y + h * 0.08);
    c.quadraticCurveTo(cx, y - h * 0.04, cx + topW / 2, y + h * 0.08);
    c.quadraticCurveTo(cx + topW / 2, y + h * 0.32, cx + midW / 2, cy);
    c.quadraticCurveTo(cx + topW / 2, y + h * 0.68, cx + topW / 2, y + h * 0.92);
    c.quadraticCurveTo(cx, y + h * 1.04, cx - topW / 2, y + h * 0.92);
    c.quadraticCurveTo(cx - topW / 2, y + h * 0.68, cx - midW / 2, cy);
    c.quadraticCurveTo(cx - topW / 2, y + h * 0.32, cx - topW / 2, y + h * 0.08);
    c.closePath();

    // Fill with ivory gradient
    const boneGrad = c.createLinearGradient(x, y, x + w * 0.3, y + h);
    boneGrad.addColorStop(0, '#FFF8E7');
    boneGrad.addColorStop(0.5, '#E8D5B0');
    boneGrad.addColorStop(1, '#D4C4A0');
    c.fillStyle = boneGrad;
    c.fill();

    // Outline
    c.strokeStyle = '#8B7B5A';
    c.lineWidth = 1.2;
    c.stroke();

    // Highlight strip
    c.fillStyle = 'rgba(255,255,255,0.25)';
    c.beginPath();
    c.ellipse(cx, y + h * 0.18, w * 0.2, h * 0.06, 0, 0, Math.PI * 2);
    c.fill();

    // Value — dots for natural faces, Greek numeral for computed values
    if ([1, 3, 4, 6].includes(value)) {
      this.drawBoneDots(c, cx, cy, value, Math.min(w, h) * 0.1);
    } else {
      c.fillStyle = '#3A2A1A';
      c.font = `bold ${Math.min(w, h) * 0.34}px Rajdhani, system-ui`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(greekNumeral(value), cx, cy);
    }

    // Selection glow
    if (selected) {
      // Re-trace bone path for glow
      c.beginPath();
      c.moveTo(cx - topW / 2, y + h * 0.08);
      c.quadraticCurveTo(cx, y - h * 0.04, cx + topW / 2, y + h * 0.08);
      c.quadraticCurveTo(cx + topW / 2, y + h * 0.32, cx + midW / 2, cy);
      c.quadraticCurveTo(cx + topW / 2, y + h * 0.68, cx + topW / 2, y + h * 0.92);
      c.quadraticCurveTo(cx, y + h * 1.04, cx - topW / 2, y + h * 0.92);
      c.quadraticCurveTo(cx - topW / 2, y + h * 0.68, cx - midW / 2, cy);
      c.quadraticCurveTo(cx - topW / 2, y + h * 0.32, cx - topW / 2, y + h * 0.08);
      c.closePath();
      c.strokeStyle = C_BLUE;
      c.lineWidth = 3;
      c.stroke();
      c.strokeStyle = 'rgba(74,144,217,0.3)';
      c.lineWidth = 7;
      c.stroke();
    }
  }

  private drawBoneDots(c: CanvasRenderingContext2D, cx: number, cy: number, value: number, dotSize: number): void {
    const ds = dotSize;
    c.fillStyle = '#3A2A1A';

    let positions: Array<{ x: number; y: number }>;
    switch (value) {
      case 1:
        positions = [{ x: cx, y: cy }];
        break;
      case 3:
        positions = [
          { x: cx, y: cy - ds * 2 }, { x: cx, y: cy }, { x: cx, y: cy + ds * 2 },
        ];
        break;
      case 4:
        positions = [
          { x: cx - ds * 1.1, y: cy - ds * 1.1 }, { x: cx + ds * 1.1, y: cy - ds * 1.1 },
          { x: cx - ds * 1.1, y: cy + ds * 1.1 }, { x: cx + ds * 1.1, y: cy + ds * 1.1 },
        ];
        break;
      case 6:
        positions = [
          { x: cx - ds * 1.1, y: cy - ds * 2 }, { x: cx + ds * 1.1, y: cy - ds * 2 },
          { x: cx - ds * 1.1, y: cy },           { x: cx + ds * 1.1, y: cy },
          { x: cx - ds * 1.1, y: cy + ds * 2 }, { x: cx + ds * 1.1, y: cy + ds * 2 },
        ];
        break;
      default:
        positions = [{ x: cx, y: cy }];
    }

    for (const pos of positions) {
      c.beginPath();
      c.arc(pos.x, pos.y, ds / 2, 0, Math.PI * 2);
      c.fill();
    }
  }

  private drawGreekKey(c: CanvasRenderingContext2D, y: number, startX: number, endX: number, unitSize: number, color: string): void {
    const u = unitSize;
    c.strokeStyle = color;
    c.lineWidth = 1;
    c.beginPath();
    let x = startX;
    c.moveTo(x, y);
    while (x + u * 2 <= endX) {
      c.lineTo(x + u * 0.5, y);
      c.lineTo(x + u * 0.5, y + u * 0.5);
      c.lineTo(x + u, y + u * 0.5);
      c.lineTo(x + u, y);
      x += u;
    }
    c.lineTo(endX, y);
    c.stroke();
  }

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
  }

  /* ═══════════════════ HUD refresh ══════════════════════════════ */

  private refreshUI(): void {
    this.drawBoard();
    this.refreshHud();
    this.refreshStatus();
    this.refreshBonesRow();
    this.refreshOpsRow();
    this.refreshActionRow();
    this.refreshLegend();
    this.refreshBanner();
    this.refreshRetryBtn();
  }

  private refreshHud(): void {
    if (!this.hudEl) return;
    this.hudEl.innerHTML = '';
    const cfg = this.cfg();

    // Round indicator
    const roundSpan = document.createElement('span');
    roundSpan.style.color = C_GOLD;
    roundSpan.textContent = `ROUND ${this.currentRound + 1}/${cfg.totalRounds}`;
    this.hudEl.appendChild(roundSpan);

    // Win/loss wreaths
    const wreathsWrap = document.createElement('span');
    Object.assign(wreathsWrap.style, { display: 'flex', gap: '3px', alignItems: 'center' });
    for (let i = 0; i < cfg.totalRounds; i++) {
      const wreathCvs = document.createElement('canvas');
      wreathCvs.width = 32;
      wreathCvs.height = 32;
      Object.assign(wreathCvs.style, { width: '16px', height: '16px' });
      const wc = wreathCvs.getContext('2d')!;
      wc.scale(2, 2);
      const wCenter = 8;
      if (i < this.roundsWon) {
        // Won — mini wreath
        this.drawMiniWreath(wc, wCenter, wCenter, 5);
      } else if (i < this.currentRound) {
        // Lost — X mark
        wc.strokeStyle = `rgba(139,58,74,0.6)`;
        wc.lineWidth = 1.5;
        wc.beginPath();
        wc.moveTo(wCenter - 4, wCenter - 4);
        wc.lineTo(wCenter + 4, wCenter + 4);
        wc.moveTo(wCenter + 4, wCenter - 4);
        wc.lineTo(wCenter - 4, wCenter + 4);
        wc.stroke();
      } else {
        // Pending — empty circle
        wc.strokeStyle = 'rgba(212,175,55,0.3)';
        wc.lineWidth = 1;
        wc.beginPath();
        wc.arc(wCenter, wCenter, 5, 0, Math.PI * 2);
        wc.stroke();
      }
      wreathsWrap.appendChild(wreathCvs);
    }
    this.hudEl.appendChild(wreathsWrap);

    // Timer
    if (cfg.hasTimer && this.phase === 'playing') {
      const timerSpan = document.createElement('span');
      timerSpan.style.color = this.timeLeft <= 10 ? C_WINE : C_GOLD;
      timerSpan.style.fontWeight = '700';
      timerSpan.style.fontVariantNumeric = 'tabular-nums';
      timerSpan.textContent = `⏳ ${this.timeLeft}s`;
      this.hudEl.appendChild(timerSpan);
    }
  }

  private drawMiniWreath(c: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    for (const sideSign of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const t = i / 4;
        const angle = Math.PI * (0.2 + t * 0.6);
        const x = cx + Math.cos(angle) * radius * sideSign;
        const y = cy - Math.sin(angle) * radius;
        c.fillStyle = `rgba(107,142,78,${0.6 + t * 0.3})`;
        c.beginPath();
        c.ellipse(x, y, 1.5, 2.5, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  private refreshStatus(): void {
    if (!this.statusEl) return;
    if (this.phase === 'rolling') {
      this.statusEl.textContent = 'Rolling the bones...';
      this.statusEl.style.color = `${C_GOLD}aa`;
    } else if (this.phase === 'playing') {
      if (this.errorMsg) {
        this.statusEl.textContent = this.errorMsg;
        this.statusEl.style.color = C_WINE;
      } else if (this.selectedFirst === null) {
        this.statusEl.textContent = 'Select a bone to begin';
        this.statusEl.style.color = `${C_MARBLE}bb`;
      } else if (this.selectedOp === null) {
        this.statusEl.textContent = 'Choose an operator';
        this.statusEl.style.color = `${C_MARBLE}bb`;
      } else {
        this.statusEl.textContent = 'Select a second bone';
        this.statusEl.style.color = `${C_MARBLE}bb`;
      }
    } else {
      this.statusEl.textContent = '';
    }
  }

  /**
   * Bone selection happens via direct canvas clicks now (see the click
   * handler installed in mount()), so this DOM row of duplicate buttons
   * is redundant — we keep the element around in case we ever need a
   * fallback accessibility layer, but hide it unconditionally. If a
   * screen reader needs tap targets we'll reintroduce it behind a
   * media-query / setting instead.
   */
  private refreshBonesRow(): void {
    if (!this.bonesRowEl) return;
    this.bonesRowEl.innerHTML = '';
    this.bonesRowEl.style.display = 'none';
  }

  private refreshOpsRow(): void {
    if (!this.opsRowEl) return;
    this.opsRowEl.innerHTML = '';
    if (this.phase !== 'playing') {
      this.opsRowEl.style.display = 'none';
      return;
    }
    this.opsRowEl.style.display = 'flex';
    const cfg = this.cfg();
    const disabled = this.selectedFirst === null;

    for (const op of ALL_OPS) {
      if (!cfg.ops.includes(op)) continue;
      const isActive = this.selectedOp === op;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = op;
      Object.assign(btn.style, {
        width: '48px', height: '48px', padding: '0',
        background: isActive ? `rgba(212,175,55,0.9)` : 'rgba(212,175,55,0.08)',
        border: `1px solid rgba(212,175,55,${isActive ? '0.8' : '0.3'})`,
        color: isActive ? C_BG_DARK : C_MARBLE,
        fontFamily: 'inherit', fontSize: '22px', fontWeight: '700',
        borderRadius: '10px', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? '0.4' : '1',
        transition: 'background 0.15s',
      });
      btn.disabled = disabled;
      btn.addEventListener('click', () => this.tapOperator(op));
      this.opsRowEl.appendChild(btn);
    }
  }

  private refreshActionRow(): void {
    if (!this.actionRowEl) return;
    this.actionRowEl.innerHTML = '';
    if (this.phase !== 'playing') {
      this.actionRowEl.style.display = 'none';
      return;
    }
    this.actionRowEl.style.display = 'flex';

    // Undo button
    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.textContent = 'UNDO';
    const undoDisabled = this.undoStack.length === 0;
    Object.assign(undoBtn.style, {
      padding: '6px 14px',
      background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.25)',
      color: undoDisabled ? `${C_CLAY}66` : C_GOLD,
      fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.15em', fontWeight: '600',
      borderRadius: '5px', cursor: undoDisabled ? 'default' : 'pointer',
      opacity: undoDisabled ? '0.5' : '1',
    });
    undoBtn.disabled = undoDisabled;
    undoBtn.addEventListener('click', () => this.undo());
    this.actionRowEl.appendChild(undoBtn);

    // Restart button
    const restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.textContent = 'RESTART';
    Object.assign(restartBtn.style, {
      padding: '6px 14px',
      background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.25)',
      color: C_GOLD, fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.15em', fontWeight: '600',
      borderRadius: '5px', cursor: 'pointer',
    });
    restartBtn.addEventListener('click', () => this.restartRound());
    this.actionRowEl.appendChild(restartBtn);

    // Solvability warning
    if (!this.canReachTarget && this.bones.length > 1) {
      const warn = document.createElement('span');
      Object.assign(warn.style, { color: `${C_WINE}cc`, fontSize: '10px', fontWeight: '500', marginLeft: '8px' });
      warn.textContent = '⚠ Target unreachable';
      this.actionRowEl.appendChild(warn);
    }
  }

  private refreshLegend(): void {
    if (!this.legendEl) return;
    if (this.phase !== 'playing' && this.phase !== 'roundEnd') {
      this.legendEl.style.display = 'none';
      return;
    }

    // Collect unique values that have Greek representations
    const values = new Set<number>();
    values.add(this.target);
    for (const bone of this.bones) values.add(bone.value);
    const entries: Array<{ greek: string; arabic: number }> = [];
    for (const v of [...values].sort((a, b) => a - b)) {
      const g = greekNumeral(v);
      if (g !== String(v)) entries.push({ greek: g, arabic: v });
    }

    if (entries.length === 0) {
      this.legendEl.style.display = 'none';
      return;
    }

    this.legendEl.style.display = 'flex';
    this.legendEl.innerHTML = '';

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, { display: 'flex', gap: '4px', alignItems: 'center' });
    const headerIcon = document.createElement('span');
    headerIcon.style.color = C_GOLD;
    headerIcon.style.fontWeight = '700';
    headerIcon.textContent = '\u03B1';
    const headerText = document.createElement('span');
    Object.assign(headerText.style, { color: `${C_GOLD}bb`, fontSize: '10px', fontWeight: '600' });
    headerText.textContent = 'GREEK NUMERALS';
    header.append(headerIcon, headerText);
    this.legendEl.appendChild(header);

    // Entries
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' });
    for (const entry of entries) {
      const item = document.createElement('span');
      item.innerHTML = `<span style="color:${C_GOLD};font-weight:700;font-size:13px">${entry.greek}</span>` +
        `<span style="color:${C_MARBLE}66;font-size:10px">=</span>` +
        `<span style="color:${C_MARBLE}99;font-size:11px;font-weight:500">${entry.arabic}</span>`;
      row.appendChild(item);
    }
    this.legendEl.appendChild(row);
  }

  private refreshBanner(): void {
    if (!this.bannerEl) return;
    if (!this.showBanner) {
      this.bannerEl.style.display = 'none';
      return;
    }
    this.bannerEl.style.display = 'flex';
    this.bannerEl.innerHTML = '';

    const accent = this.bannerIsWin ? C_GOLD : C_WINE;
    const bgColor = this.bannerIsWin ? '#0F2838' : '#2A1018';
    const bgColor2 = this.bannerIsWin ? '#0A1E30' : '#201018';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '280px', width: '85%', textAlign: 'center', padding: '20px',
      background: `linear-gradient(to bottom, ${bgColor}, ${bgColor2})`,
      border: `2px solid ${accent}99`,
      borderRadius: '12px', boxShadow: `0 0 20px ${accent}33`,
      animation: 'astra-pop 0.3s ease-out',
    });

    const titleEl = document.createElement('div');
    Object.assign(titleEl.style, { color: accent, fontSize: '18px', fontWeight: '700', marginBottom: '8px' });
    titleEl.textContent = this.bannerTitle;
    card.appendChild(titleEl);

    const descEl = document.createElement('div');
    Object.assign(descEl.style, { color: '#E8E0D0cc', fontSize: '13px', lineHeight: '1.5', marginBottom: '10px' });
    descEl.textContent = this.bannerDesc;
    card.appendChild(descEl);

    const hint = document.createElement('div');
    Object.assign(hint.style, { color: '#E8E0D066', fontSize: '10px', fontWeight: '500' });
    hint.textContent = 'Tap to continue';
    card.appendChild(hint);

    this.bannerEl.appendChild(card);
  }

  private refreshRetryBtn(): void {
    if (!this.retryBtnEl) return;
    this.retryBtnEl.style.display =
      (this.phase === 'gameOver' && !this.showBanner && !this.bannerIsWin) ? 'inline-block' : 'none';
  }

  /* ═══════════════════ Game logic ════════════════════════════════ */

  private startGame(): void {
    this.currentRound = 0;
    this.roundsWon = 0;
    this.startNewRound();
  }

  private startNewRound(): void {
    this.selectedFirst = null;
    this.selectedOp = null;
    this.undoStack = [];
    this.historyLines = [];
    this.errorMsg = '';
    this.canReachTarget = true;
    this.showBanner = false;
    this.phase = 'rolling';
    this.rollBones();
  }

  private rollBones(): void {
    const cfg = this.cfg();
    // Initial random bones
    this.bones = [];
    for (let i = 0; i < cfg.boneCount; i++) {
      this.bones.push({ id: ++boneIdCounter, value: BONE_FACES[Math.floor(Math.random() * 4)] });
    }
    this.refreshUI();

    this.rollTickCount = 0;
    const bc = cfg.boneCount;

    this.rollTimerId = window.setInterval(() => {
      this.rollTickCount++;
      if (this.rollTickCount < 7) {
        // Shuffle visual
        this.bones = [];
        for (let i = 0; i < bc; i++) {
          this.bones.push({ id: ++boneIdCounter, value: BONE_FACES[Math.floor(Math.random() * 4)] });
        }
        this.drawBoard();
      } else {
        // Stop rolling
        clearInterval(this.rollTimerId);
        const finalValues: number[] = [];
        for (let i = 0; i < bc; i++) finalValues.push(BONE_FACES[Math.floor(Math.random() * 4)]);
        this.bones = finalValues.map(v => ({ id: ++boneIdCounter, value: v }));
        this.originalBones = this.bones.map(b => ({ ...b }));
        this.target = generateTarget(finalValues, cfg.ops, cfg.targetMin, cfg.targetMax);
        this.phase = 'playing';
        if (cfg.hasTimer) this.startRoundTimer();
        this.refreshUI();
      }
    }, 100);
  }

  private tapBone(index: number): void {
    if (this.phase !== 'playing' || index >= this.bones.length) return;
    this.errorMsg = '';

    if (this.selectedFirst !== null && this.selectedOp !== null && this.selectedFirst !== index) {
      // Second bone selected — try merge
      const first = this.selectedFirst;
      if (first >= this.bones.length) {
        this.selectedFirst = null;
        this.selectedOp = null;
        this.refreshUI();
        return;
      }
      const a = this.bones[first].value;
      const b = this.bones[index].value;
      const result = applyOp(a, b, this.selectedOp);
      if (result !== null) {
        this.performMerge(first, index, this.selectedOp, result);
      } else {
        // Invalid operation
        if (this.selectedOp === '−') {
          this.errorMsg = 'Subtraction requires first ≥ second';
        } else {
          this.errorMsg = 'Division must be exact with no remainder';
        }
        this.selectedFirst = null;
        this.selectedOp = null;
        setTimeout(() => {
          if (this.errorMsg.startsWith('Subtraction') || this.errorMsg.startsWith('Division')) {
            this.errorMsg = '';
            this.refreshUI();
          }
        }, 1500);
      }
    } else if (this.selectedFirst === index) {
      // Deselect
      this.selectedFirst = null;
      this.selectedOp = null;
    } else {
      // Select first bone
      this.selectedFirst = index;
      this.selectedOp = null;
    }
    this.refreshUI();
  }

  private tapOperator(op: Op): void {
    if (this.selectedFirst === null) return;
    this.errorMsg = '';
    this.selectedOp = this.selectedOp === op ? null : op;
    this.refreshUI();
  }

  private performMerge(first: number, second: number, op: Op, result: number): void {
    // Save undo state
    this.undoStack.push(this.bones.map(b => ({ ...b })));

    const a = this.bones[first].value;
    const b = this.bones[second].value;
    this.historyLines.push(`${greekNumeral(a)} ${op} ${greekNumeral(b)} = ${greekNumeral(result)}`);

    // Remove bones and insert result
    const hi = Math.max(first, second);
    const lo = Math.min(first, second);
    this.bones.splice(hi, 1);
    this.bones.splice(lo, 1);
    this.bones.splice(Math.min(lo, this.bones.length), 0, { id: ++boneIdCounter, value: result });

    this.selectedFirst = null;
    this.selectedOp = null;
    this.refreshUI();

    // Check win/loss
    setTimeout(() => {
      if (this.bones.length === 1) {
        if (this.bones[0].value === this.target) {
          this.endRound(true);
        } else {
          this.endRound(false);
        }
      } else {
        // Check solvability
        this.canReachTarget = allReachable(this.bones.map(b => b.value), this.cfg().ops).has(this.target);
        this.refreshUI();
      }
    }, 300);
  }

  private undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.bones = previous;
    if (this.historyLines.length > 0) this.historyLines.pop();
    this.selectedFirst = null;
    this.selectedOp = null;
    this.canReachTarget = true;
    this.errorMsg = '';
    this.refreshUI();
  }

  private restartRound(): void {
    this.bones = this.originalBones.map(b => ({ ...b }));
    this.undoStack = [];
    this.historyLines = [];
    this.selectedFirst = null;
    this.selectedOp = null;
    this.canReachTarget = true;
    this.errorMsg = '';
    if (this.cfg().hasTimer) this.timeLeft = this.cfg().roundTime;
    this.refreshUI();
  }

  private endRound(won: boolean): void {
    if (this.phase !== 'playing') return;
    this.stopRoundTimer();
    if (won) this.roundsWon++;
    this.currentRound++;

    const cfg = this.cfg();
    const remaining = cfg.totalRounds - this.currentRound;

    if (this.roundsWon >= cfg.requiredWins) {
      this.phase = 'gameOver';
      this.showBannerWith('VICTORY!', 'The knucklebones favor you. The oracle grants passage.', true);
    } else if (this.roundsWon + remaining < cfg.requiredWins) {
      this.phase = 'gameOver';
      this.showBannerWith('DEFEAT', 'The bones have spoken against you. Try again.', false);
    } else {
      this.phase = 'roundEnd';
      if (won) {
        this.showBannerWith('Round Won!', 'Well played! The target was struck.', true);
      } else {
        this.showBannerWith('Round Lost', 'The target was missed. Continue on.', false);
      }
    }
    this.refreshUI();
  }

  private showBannerWith(title: string, desc: string, isWin: boolean): void {
    this.bannerTitle = title;
    this.bannerDesc = desc;
    this.bannerIsWin = isWin;
    this.showBanner = true;
  }

  private dismissBanner(): void {
    this.showBanner = false;
    this.refreshUI();

    if (this.phase === 'gameOver') {
      setTimeout(() => {
        if (this.bannerIsWin) {
          this.isSolved = true;
          this.onSolved?.();
        }
        // If lost, refreshRetryBtn will show TRY AGAIN
        this.refreshUI();
      }, 400);
    } else if (this.phase === 'roundEnd') {
      setTimeout(() => this.startNewRound(), 300);
    }
  }

  /* ═══════════════════ Timer ═════════════════════════════════════ */

  private startRoundTimer(): void {
    this.timeLeft = this.cfg().roundTime;
    this.timerId = window.setInterval(() => {
      if (this.timeLeft > 1) {
        this.timeLeft--;
        this.refreshHud();
      } else {
        this.stopRoundTimer();
        this.endRound(false);
      }
    }, 1000);
  }

  private stopRoundTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = 0;
    }
  }

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {
    // All input via DOM buttons
  }

  override dispose(): void {
    clearInterval(this.timerId);
    clearInterval(this.rollTimerId);
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('astragaloi-anims');
    if (animStyle) animStyle.remove();
    this.ctx2d = null;
    this.overlayEl = null;
    this.hudEl = null;
    this.statusEl = null;
    this.bonesRowEl = null;
    this.opsRowEl = null;
    this.actionRowEl = null;
    this.legendEl = null;
    this.bannerEl = null;
    this.retryBtnEl = null;
    super.dispose();
  }
}
