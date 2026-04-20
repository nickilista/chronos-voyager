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
 * Soroban (そろばん) — Interactive Japanese abacus puzzle with 8 difficulty levels.
 * Aligned with the iOS "Math Vs Time" SorobanGameView implementation:
 *   - Canvas-drawn bicone beads (heaven = red, earth = brown)
 *   - Heaven bead worth 5, four earth beads worth 1 each
 *   - Tap beads directly to move them (heaven toggles, earth activates/deactivates)
 *   - 8 levels: single digit → mixed 5-digit operations
 *   - Lives system, optional countdown timer (levels 6–8)
 *   - Edo-period Japanese aesthetic with seigaiha, asanoha patterns
 */

/* ── Configuration per level ─────────────────────────────────── */

function colCountForLevel(level: number): number { return level <= 2 ? 4 : 5; }
function roundsForLevel(level: number): number { return [3, 3, 4, 4, 4, 5, 5, 5][Math.min(level, 8) - 1]; }
function maxLivesForLevel(level: number): number { return level <= 6 ? 3 : 2; }
function timerLimitForLevel(level: number): number | null {
  switch (level) { case 6: return 30; case 7: return 25; case 8: return 20; default: return null; }
}

/* ── Edo palette ─────────────────────────────────────────────── */

const C_WOOD_DARK = '#26140a';
const C_WOOD_MED = '#4d2e14';
const C_WOOD_LIGHT = '#6b4d29';
const C_ROD_GOLD = '#ae9461';
const C_HEAVEN_HI = '#b81f1a';
const C_HEAVEN_LO = '#6b0f0a';
const C_EARTH_HI = '#59402e';
const C_EARTH_LO = '#24170a';
const C_PARCHMENT = '#f5e8cc';
const C_GOLD_LEAF = '#c7a661';
const C_ACCENT = '#C41E3A';
const C_INDIGO_DEEP = '#140d26';
const C_CORRECT_GREEN = '#6B8E23';

/* ── Place value kanji ───────────────────────────────────────── */

const PLACE_KANJI_ALL = ['万', '千', '百', '十', '一'];
function placeKanjiForCols(colCount: number): string[] {
  return PLACE_KANJI_ALL.slice(PLACE_KANJI_ALL.length - colCount);
}

/* ── Problem generation ──────────────────────────────────────── */

interface Problem {
  target: number;
  expr: string;
  hint: string;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function gen5Complement(): { a: number; b: number } {
  const aO = randInt(1, 4);
  const minB = Math.max(1, 5 - aO);
  const maxB = Math.min(4, 9 - aO);
  const bO = randInt(minB, Math.max(minB, maxB));
  const aT = randInt(1, 5);
  const bT = randInt(0, 2);
  return { a: aT * 10 + aO, b: bT * 10 + bO };
}

function gen10Complement(): { a: number; b: number } {
  const aO = randInt(4, 9);
  const minB = Math.max(1, 10 - aO);
  const maxB = Math.min(9, 18 - aO);
  const bO = randInt(minB, Math.max(minB, maxB));
  const aT = randInt(1, 6);
  const bT = randInt(0, Math.min(2, 8 - aT));
  return { a: aT * 10 + aO, b: bT * 10 + bO };
}

function generateProblem(level: number): Problem {
  switch (level) {
    case 1: {
      const t = randInt(1, 9);
      return { target: t, expr: `${t}`, hint: 'Top bead = 5, bottom beads = 1 each. Push toward the beam to activate.' };
    }
    case 2: {
      const t = randInt(10, 99);
      return { target: t, expr: `${t}`, hint: 'Set each column to the correct digit. Left = tens, right = ones.' };
    }
    case 3: {
      const a = randInt(5, 40);
      const b = randInt(3, Math.min(40, 99 - a));
      return { target: a + b, expr: `${a} + ${b}`, hint: 'Add from left to right, one digit at a time.' };
    }
    case 4: {
      const { a, b } = gen5Complement();
      const bO = b % 10;
      return { target: a + b, expr: `${a} + ${b}`, hint: `5-complement: add ${5 - bO} then remove from heaven bead (${bO} = 5 − ${5 - bO}).` };
    }
    case 5: {
      const { a, b } = gen10Complement();
      const bO = b % 10;
      return { target: a + b, expr: `${a} + ${b}`, hint: `10-complement: add 10 to tens column, subtract ${10 - bO} from ones (${bO} = 10 − ${10 - bO}).` };
    }
    case 6: {
      const a = randInt(30, 99);
      const b = randInt(10, a - 5);
      return { target: a - b, expr: `${a} − ${b}`, hint: 'Subtract right to left. Borrow from tens when needed.' };
    }
    case 7: {
      const a = randInt(12, 50);
      const b = randInt(3, 9);
      return { target: a * b, expr: `${a} × ${b}`, hint: 'Multiply digit by digit, accumulating partial products.' };
    }
    default: { // Level 8: mixed
      const op = randInt(0, 2);
      if (op === 0) {
        const a = randInt(100, 4999);
        const b = randInt(100, Math.min(4999, 99999 - a));
        return { target: a + b, expr: `${a} + ${b}`, hint: 'Work left to right, carrying as needed.' };
      } else if (op === 1) {
        const a = randInt(200, 9999);
        const b = randInt(50, a - 50);
        return { target: a - b, expr: `${a} − ${b}`, hint: 'Subtract right to left. Borrow from tens when needed.' };
      } else {
        const a = randInt(11, 99);
        const b = randInt(2, 9);
        return { target: a * b, expr: `${a} × ${b}`, hint: 'Multiply digit by digit, accumulating partial products.' };
      }
    }
  }
}

/* ── Puzzle class ─────────────────────────────────────────────── */

export class SorobanPuzzle extends Puzzle {
  readonly title = 'SOROBAN';
  readonly subtitle = 'the reckoning frame';
  readonly instructions =
    'Tap beads to move them toward the beam. Heaven bead = 5, earth beads = 1 each. Set the target value and submit.';

  private level = 8; // max difficulty
  private colCount = 5;
  private rounds = 4;
  private maxLives = 3;
  private timerLimit: number | null = null;

  private cols: number[] = [];
  private target = 0;
  private expr = '';
  private hint = '';
  private round = 0;
  private score = 0;
  private lives = 3;
  private countdown = 0;
  private countdownTimer = 0;
  private phase: 'playing' | 'correct' | 'wrong' | 'complete' | 'failed' = 'playing';
  private showHint = false;
  private showLiveValue = false;
  private feedback = '';

  // DOM
  private root: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private sorobanCanvas: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private exprEl: HTMLDivElement | null = null;
  private valueEl: HTMLDivElement | null = null;
  private livesEl: HTMLDivElement | null = null;
  private feedbackEl: HTMLDivElement | null = null;
  private timerEl: HTMLDivElement | null = null;
  private roundEl: HTMLDivElement | null = null;
  private hintEl: HTMLDivElement | null = null;
  private placeLabelsEl: HTMLDivElement | null = null;

  // Soroban layout metrics (computed from canvas size)
  private sW = 360;
  private sH = 240;
  private sPad = 8;
  private beamFrac = 0.28;
  private beadH = 18;

  onSolved?: () => void;

  /** Optionally set level before init. */
  setLevel(lvl: number): void {
    this.level = Math.max(1, Math.min(8, lvl));
  }

  init(): void {
    this.colCount = colCountForLevel(this.level);
    this.rounds = roundsForLevel(this.level);
    this.maxLives = maxLivesForLevel(this.level);
    this.timerLimit = timerLimitForLevel(this.level);
    this.lives = this.maxLives;
    this.showLiveValue = this.level <= 2;
    this.cols = new Array(this.colCount).fill(0);

    this.buildBackdrop();
    this.buildDom();
    this.newProblem();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color(C_INDIGO_DEEP), roughness: 0.7, metalness: 0.15, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const seal = new Mesh(
      new RingGeometry(3.0, 3.15, 8),
      new MeshStandardMaterial({
        color: new Color(C_ACCENT), emissive: new Color('#2a0606'),
        emissiveIntensity: 0.5, roughness: 0.45, metalness: 0.85, side: DoubleSide,
      }),
    );
    seal.rotation.x = -Math.PI / 2;
    seal.position.y = -2.37;
    this.group.add(seal);

    const lamp = new PointLight('#f6d89c', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-soroban';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: 'rgba(14,8,24,0.92)', backdropFilter: 'blur(12px)',
      border: `1px solid ${C_GOLD_LEAF}40`, borderTop: `3px solid ${C_GOLD_LEAF}`,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_PARCHMENT,
      maxHeight: '96vh', overflowY: 'auto', minWidth: '380px',
    });
    root.appendChild(panel);

    // Header row: rules button | round label | hint button
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center',
      padding: '0 4px',
    });

    const rulesBtn = document.createElement('button');
    rulesBtn.type = 'button';
    rulesBtn.textContent = '?';
    Object.assign(rulesBtn.style, {
      width: '28px', height: '28px', borderRadius: '50%', border: `1px solid ${C_GOLD_LEAF}55`,
      background: 'transparent', color: C_GOLD_LEAF, fontSize: '14px', fontWeight: '700',
      cursor: 'pointer', fontFamily: 'inherit',
    });
    rulesBtn.addEventListener('click', () => this.showRulesOverlay());
    header.appendChild(rulesBtn);

    this.roundEl = document.createElement('div');
    Object.assign(this.roundEl.style, { fontSize: '12px', letterSpacing: '0.12em', opacity: '0.8' });
    header.appendChild(this.roundEl);

    const hintBtn = document.createElement('button');
    hintBtn.type = 'button';
    hintBtn.textContent = '💡';
    Object.assign(hintBtn.style, {
      width: '28px', height: '28px', borderRadius: '50%', border: `1px solid ${C_GOLD_LEAF}55`,
      background: 'transparent', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
    });
    hintBtn.addEventListener('click', () => { this.showHint = !this.showHint; this.refreshUI(); });
    header.appendChild(hintBtn);

    panel.appendChild(header);

    // Gold separator
    const sep = document.createElement('div');
    Object.assign(sep.style, {
      width: '100%', height: '1px',
      background: `linear-gradient(to right, transparent, ${C_GOLD_LEAF}66, ${C_GOLD_LEAF}99, ${C_GOLD_LEAF}66, transparent)`,
    });
    panel.appendChild(sep);

    // Problem card
    const problemCard = document.createElement('div');
    Object.assign(problemCard.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
      padding: '12px 32px',
      background: `linear-gradient(to bottom, ${C_WOOD_MED}e6, ${C_WOOD_DARK})`,
      borderRadius: '8px', border: `1px solid ${C_GOLD_LEAF}4d`,
      boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
    });

    const instrLabel = document.createElement('div');
    Object.assign(instrLabel.style, { fontSize: '11px', opacity: '0.5', fontWeight: '500' });
    instrLabel.textContent = this.level <= 2 ? 'SET THE NUMBER' : 'CALCULATE';
    problemCard.appendChild(instrLabel);

    this.exprEl = document.createElement('div');
    Object.assign(this.exprEl.style, {
      fontSize: '28px', fontWeight: '700', color: C_PARCHMENT, letterSpacing: '0.04em',
    });
    problemCard.appendChild(this.exprEl);
    panel.appendChild(problemCard);

    // Status bar: lives | feedback | timer
    const statusBar = document.createElement('div');
    Object.assign(statusBar.style, {
      display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center',
      padding: '0 4px', minHeight: '20px',
    });

    this.livesEl = document.createElement('div');
    Object.assign(this.livesEl.style, { display: 'flex', gap: '4px', fontSize: '12px' });
    statusBar.appendChild(this.livesEl);

    this.feedbackEl = document.createElement('div');
    Object.assign(this.feedbackEl.style, { fontSize: '12px', fontWeight: '600' });
    statusBar.appendChild(this.feedbackEl);

    this.timerEl = document.createElement('div');
    Object.assign(this.timerEl.style, { fontSize: '12px', fontWeight: '500', fontVariantNumeric: 'tabular-nums' });
    statusBar.appendChild(this.timerEl);

    panel.appendChild(statusBar);

    // Soroban canvas (interactive)
    const canvasWrap = document.createElement('div');
    Object.assign(canvasWrap.style, {
      position: 'relative', borderRadius: '12px', overflow: 'hidden',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      border: `1.5px solid ${C_GOLD_LEAF}4d`,
    });

    this.sW = Math.max(320, this.colCount * 68 + 40);
    this.sH = 240;

    const cvs = document.createElement('canvas');
    cvs.width = this.sW * 2;
    cvs.height = this.sH * 2;
    Object.assign(cvs.style, { width: this.sW + 'px', height: this.sH + 'px', display: 'block', cursor: 'pointer' });
    this.sorobanCanvas = cvs;
    this.ctx2d = cvs.getContext('2d')!;
    cvs.addEventListener('click', (e) => this.handleCanvasClick(e));
    canvasWrap.appendChild(cvs);
    panel.appendChild(canvasWrap);

    // Place labels (kanji)
    this.placeLabelsEl = document.createElement('div');
    Object.assign(this.placeLabelsEl.style, {
      display: 'flex', justifyContent: 'center', gap: '0', width: this.sW + 'px',
    });
    panel.appendChild(this.placeLabelsEl);

    // Value row (only for levels 1-2)
    this.valueEl = document.createElement('div');
    Object.assign(this.valueEl.style, {
      display: 'flex', gap: '6px', alignItems: 'center',
      padding: '6px 20px', borderRadius: '20px',
      background: 'rgba(255,255,255,0.06)', border: `1px solid ${C_GOLD_LEAF}26`,
    });
    panel.appendChild(this.valueEl);

    // Action buttons
    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', gap: '16px', marginTop: '4px' });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = '↺ CLEAR';
    Object.assign(clearBtn.style, {
      padding: '10px 20px', borderRadius: '20px', fontSize: '13px', fontWeight: '500',
      fontFamily: 'inherit', letterSpacing: '0.06em',
      color: `${C_PARCHMENT}b3`, background: 'rgba(255,255,255,0.06)',
      border: `1px solid ${C_PARCHMENT}33`, cursor: 'pointer',
    });
    clearBtn.addEventListener('click', () => { if (this.phase === 'playing') { this.clearAll(); this.refreshUI(); } });
    actions.appendChild(clearBtn);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.textContent = '✓ SUBMIT';
    Object.assign(submitBtn.style, {
      padding: '10px 24px', borderRadius: '20px', fontSize: '13px', fontWeight: '700',
      fontFamily: 'inherit', letterSpacing: '0.06em',
      color: C_PARCHMENT, background: `linear-gradient(to bottom, ${C_ACCENT}, ${C_ACCENT}b3)`,
      border: 'none', cursor: 'pointer',
    });
    submitBtn.addEventListener('click', () => this.submitAnswer());
    actions.appendChild(submitBtn);

    panel.appendChild(actions);

    // Hint bubble
    this.hintEl = document.createElement('div');
    Object.assign(this.hintEl.style, {
      display: 'none', padding: '8px 12px', borderRadius: '8px',
      background: `${C_GOLD_LEAF}14`, border: `1px solid ${C_GOLD_LEAF}33`,
      fontSize: '12px', color: `${C_PARCHMENT}d9`, maxWidth: '320px', textAlign: 'center',
    });
    panel.appendChild(this.hintEl);

    // Overlay for result / rules
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    document.body.appendChild(root);
  }

  /* ═══════════════════ Soroban Canvas Drawing ═══════════════════ */

  private getBeamY(): number {
    return this.sPad + (this.sH - 2 * this.sPad) * this.beamFrac;
  }

  private getColSpace(): number {
    return (this.sW - 2 * this.sPad) / (this.colCount + 1);
  }

  private getColX(colIndex: number): number {
    return this.sPad + this.getColSpace() * (colIndex + 1);
  }

  private drawSoroban(): void {
    const c = this.ctx2d!;
    const s = 2;
    const w = this.sW;
    const h = this.sH;
    c.clearRect(0, 0, w * s, h * s);
    c.save();
    c.scale(s, s);

    const pad = this.sPad;
    const beamY = this.getBeamY();
    const beamH = 6;
    const colSpace = this.getColSpace();
    const beadW = Math.min(colSpace * 0.72, 40);
    const beadH = this.beadH;

    // Frame background
    const frameGrad = c.createLinearGradient(0, 0, 0, h);
    frameGrad.addColorStop(0, '#331e0d');
    frameGrad.addColorStop(0.5, C_WOOD_DARK);
    frameGrad.addColorStop(1, '#1a0a05');
    c.fillStyle = frameGrad;
    this.roundRect(c, 0, 0, w, h, 12);
    c.fill();

    // Inner dark area
    const innerGrad = c.createLinearGradient(0, pad, 0, h - pad);
    innerGrad.addColorStop(0, '#120a05');
    innerGrad.addColorStop(1, '#1f1208');
    c.fillStyle = innerGrad;
    this.roundRect(c, pad, pad, w - 2 * pad, h - 2 * pad, 7);
    c.fill();

    // Inner border
    c.strokeStyle = `${C_GOLD_LEAF}26`;
    c.lineWidth = 0.5;
    this.roundRect(c, pad, pad, w - 2 * pad, h - 2 * pad, 7);
    c.stroke();

    // Rods
    for (let i = 0; i < this.colCount; i++) {
      const x = this.getColX(i);
      c.beginPath();
      c.moveTo(x, pad + 4);
      c.lineTo(x, h - pad - 4);
      c.strokeStyle = C_ROD_GOLD;
      c.lineWidth = 2.5;
      c.stroke();
    }

    // Beam
    const beamGrad = c.createLinearGradient(0, beamY - beamH / 2, 0, beamY + beamH / 2);
    beamGrad.addColorStop(0, C_WOOD_LIGHT);
    beamGrad.addColorStop(1, C_WOOD_MED);
    c.fillStyle = beamGrad;
    this.roundRect(c, pad, beamY - beamH / 2, w - 2 * pad, beamH, 2);
    c.fill();

    // Beam dots (position markers)
    for (let i = 0; i < this.colCount; i++) {
      if ((this.colCount - 1 - i) % 3 === 0) {
        const x = this.getColX(i);
        c.beginPath();
        c.arc(x, beamY, 2.5, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,255,255,0.45)';
        c.fill();
      }
    }

    // Bead positions
    const hTop = pad + beadH * 0.7;
    const hBot = beamY - beamH / 2 - beadH * 0.6;
    const eTop = beamY + beamH / 2 + beadH * 0.65;
    const eBot = h - pad - beadH * 0.7;
    const eSpace = Math.max((eBot - eTop) / 4.0, beadH + 2);

    // Draw beads
    for (let col = 0; col < this.colCount; col++) {
      const x = this.getColX(col);
      const val = this.cols[col];
      const heavenActive = val >= 5;
      const earthN = val % 5;

      // Heaven bead
      const hy = heavenActive ? hBot : hTop;
      this.drawBead(c, x, hy, beadW, beadH, true);

      // Earth beads (4 per column)
      for (let b = 0; b < 4; b++) {
        const active = b < earthN;
        const ey = active
          ? eTop + b * eSpace
          : eBot - (3 - b) * eSpace;
        this.drawBead(c, x, ey, beadW, beadH, false);
      }
    }

    c.restore();
  }

  private drawBead(c: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, heaven: boolean): void {
    const hw = w / 2;
    const hh = h / 2;
    const hi = heaven ? C_HEAVEN_HI : C_EARTH_HI;
    const lo = heaven ? C_HEAVEN_LO : C_EARTH_LO;

    // Bicone shape
    c.beginPath();
    c.moveTo(cx - hw, cy);
    c.quadraticCurveTo(cx - hw * 0.4, cy - hh * 0.92, cx, cy - hh);
    c.quadraticCurveTo(cx + hw * 0.4, cy - hh * 0.92, cx + hw, cy);
    c.quadraticCurveTo(cx + hw * 0.4, cy + hh * 0.92, cx, cy + hh);
    c.quadraticCurveTo(cx - hw * 0.4, cy + hh * 0.92, cx - hw, cy);
    c.closePath();

    const grad = c.createLinearGradient(cx - hw, cy - hh, cx + hw, cy + hh);
    grad.addColorStop(0, hi);
    grad.addColorStop(1, lo);
    c.fillStyle = grad;
    c.fill();

    // Highlight stroke
    c.beginPath();
    c.moveTo(cx - hw * 0.55, cy - 1);
    c.quadraticCurveTo(cx - hw * 0.15, cy - hh * 0.65, cx + hw * 0.2, cy - hh * 0.45);
    c.strokeStyle = 'rgba(255,255,255,0.22)';
    c.lineWidth = 1;
    c.stroke();

    // Rod hole
    c.beginPath();
    c.ellipse(cx, cy, 2, 1.5, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fill();
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

  /* ═══════════════════ Canvas Click Handling ════════════════════ */

  private handleCanvasClick(e: MouseEvent): void {
    if (this.phase !== 'playing') return;
    const rect = this.sorobanCanvas!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (this.sW / rect.width);
    const my = (e.clientY - rect.top) * (this.sH / rect.height);

    const colSpace = this.getColSpace();
    const beamY = this.getBeamY();
    const beamH = 6;

    // Find which column was clicked
    let clickedCol = -1;
    for (let i = 0; i < this.colCount; i++) {
      const cx = this.getColX(i);
      if (Math.abs(mx - cx) < colSpace * 0.45) {
        clickedCol = i;
        break;
      }
    }
    if (clickedCol < 0) return;

    // Determine if click is in heaven (above beam) or earth (below beam) area
    if (my < beamY - beamH / 2) {
      this.tapHeaven(clickedCol);
    } else if (my > beamY + beamH / 2) {
      this.tapEarth(clickedCol, my);
    }
  }

  private tapHeaven(col: number): void {
    if (this.cols[col] >= 5) {
      this.cols[col] -= 5;
    } else {
      this.cols[col] += 5;
    }
    this.refreshUI();
  }

  private tapEarth(col: number, clickY: number): void {
    const earthN = this.cols[col] % 5;
    const hVal = this.cols[col] >= 5 ? 5 : 0;
    const beamY = this.getBeamY();
    const beamH = 6;
    const pad = this.sPad;
    const beadH = this.beadH;
    const eTop = beamY + beamH / 2 + beadH * 0.65;
    const eBot = this.sH - pad - beadH * 0.7;
    const midY = (eTop + eBot) / 2;

    // Simpler: if click is in top half of earth zone, push beads up (activate)
    // If click is in bottom half, pull beads down (deactivate)
    if (clickY < midY) {
      // Activate: add one earth bead (max 4)
      if (earthN < 4) this.cols[col] = hVal + earthN + 1;
    } else {
      // Deactivate: remove one earth bead (min 0)
      if (earthN > 0) this.cols[col] = hVal + earthN - 1;
    }
    this.refreshUI();
  }

  /* ═══════════════════ UI Refresh ═══════════════════════════════ */

  private refreshUI(): void {
    // Round label
    if (this.roundEl) {
      this.roundEl.textContent = `ROUND ${this.round + 1} / ${this.rounds}`;
    }

    // Expression
    if (this.exprEl) {
      this.exprEl.textContent = this.expr;
    }

    // Lives
    if (this.livesEl) {
      this.livesEl.innerHTML = '';
      for (let i = 0; i < this.maxLives; i++) {
        const heart = document.createElement('span');
        heart.textContent = i < this.lives ? '♥' : '♡';
        heart.style.color = i < this.lives ? C_ACCENT : 'rgba(255,255,255,0.2)';
        this.livesEl.appendChild(heart);
      }
    }

    // Feedback
    if (this.feedbackEl) {
      this.feedbackEl.textContent = this.feedback;
      this.feedbackEl.style.color = this.phase === 'correct' ? C_CORRECT_GREEN : C_ACCENT;
    }

    // Timer
    if (this.timerEl) {
      if (this.timerLimit != null) {
        this.timerEl.textContent = `⏱ ${this.countdown}s`;
        this.timerEl.style.color = this.countdown <= 5 ? C_ACCENT : `${C_PARCHMENT}99`;
      } else {
        this.timerEl.textContent = '';
      }
    }

    // Value display (levels 1-2 only)
    if (this.valueEl) {
      if (this.showLiveValue) {
        this.valueEl.style.display = 'flex';
        this.valueEl.innerHTML = `
          <span style="font-size:13px;opacity:0.5;font-weight:500">VALUE</span>
          <span style="font-size:24px;font-weight:700;color:${C_GOLD_LEAF};font-variant-numeric:tabular-nums">${this.displayValue()}</span>
        `;
      } else {
        this.valueEl.style.display = 'none';
      }
    }

    // Place labels
    if (this.placeLabelsEl) {
      const kanji = placeKanjiForCols(this.colCount);
      this.placeLabelsEl.innerHTML = '';
      const colSpace = this.getColSpace();
      for (let i = 0; i < this.colCount; i++) {
        const lbl = document.createElement('span');
        lbl.textContent = kanji[i];
        Object.assign(lbl.style, {
          fontSize: '10px', color: `${C_GOLD_LEAF}80`, width: colSpace + 'px', textAlign: 'center',
        });
        this.placeLabelsEl.appendChild(lbl);
      }
    }

    // Hint
    if (this.hintEl) {
      if (this.showHint && this.hint) {
        this.hintEl.style.display = 'block';
        this.hintEl.textContent = '💡 ' + this.hint;
      } else {
        this.hintEl.style.display = 'none';
      }
    }

    // Redraw soroban
    this.drawSoroban();
  }

  /* ═══════════════════ Game Logic ═══════════════════════════════ */

  private displayValue(): number {
    return this.cols.reduce((acc, d) => acc * 10 + d, 0);
  }

  private clearAll(): void {
    this.cols = new Array(this.colCount).fill(0);
  }

  private setColumns(value: number): void {
    const newCols = new Array(this.colCount).fill(0);
    let v = value;
    for (let i = this.colCount - 1; i >= 0; i--) {
      newCols[i] = v % 10;
      v = Math.floor(v / 10);
    }
    this.cols = newCols;
  }

  private newProblem(): void {
    this.phase = 'playing';
    this.clearAll();
    this.feedback = '';
    const p = generateProblem(this.level);
    this.target = p.target;
    this.expr = p.expr;
    this.hint = p.hint;
    this.startTimer();
    this.refreshUI();
  }

  private submitAnswer(): void {
    if (this.phase !== 'playing') return;
    this.stopTimer();

    if (this.displayValue() === this.target) {
      this.handleCorrect();
    } else {
      this.handleWrong();
    }
  }

  private handleCorrect(): void {
    this.score++;
    this.phase = 'correct';
    this.feedback = '正解！ Correct!';
    this.refreshUI();

    setTimeout(() => {
      this.feedback = '';
      if (this.round + 1 >= this.rounds) {
        this.phase = 'complete';
        this.showResultOverlay(true);
      } else {
        this.round++;
        this.newProblem();
      }
    }, 1200);
  }

  private handleWrong(): void {
    this.lives--;
    this.phase = 'wrong';
    this.feedback = `✗ Answer was ${this.target}`;
    this.refreshUI();

    // Show correct answer on soroban after a short delay
    setTimeout(() => {
      this.setColumns(this.target);
      this.refreshUI();
    }, 600);

    if (this.lives <= 0) {
      setTimeout(() => {
        this.phase = 'failed';
        this.showResultOverlay(false);
      }, 2500);
    } else {
      setTimeout(() => {
        this.feedback = '';
        this.clearAll();
        this.phase = 'playing';
        this.startTimer();
        this.refreshUI();
      }, 2500);
    }
  }

  /* ═══════════════════ Timer ════════════════════════════════════ */

  private startTimer(): void {
    this.stopTimer();
    if (this.timerLimit == null) return;
    this.countdown = this.timerLimit;
    this.countdownTimer = window.setInterval(() => {
      if (this.countdown > 0) {
        this.countdown--;
        if (this.timerEl) {
          this.timerEl.textContent = `⏱ ${this.countdown}s`;
          this.timerEl.style.color = this.countdown <= 5 ? C_ACCENT : `${C_PARCHMENT}99`;
        }
      } else {
        this.stopTimer();
        if (this.phase === 'playing') this.handleWrong();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = 0;
    }
  }

  /* ═══════════════════ Result Overlay ══════════════════════════ */

  private showResultOverlay(won: boolean): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '320px', width: '90%', textAlign: 'center', padding: '28px 36px',
      background: `linear-gradient(to bottom, #1a0f05, ${C_WOOD_DARK})`,
      border: `1px solid ${C_GOLD_LEAF}4d`, borderRadius: '12px',
      boxShadow: '0 16px 48px rgba(0,0,0,0.6)', fontFamily: "'Rajdhani', system-ui, sans-serif",
    });

    // Kanji seal
    const seal = document.createElement('div');
    Object.assign(seal.style, {
      fontSize: '36px', fontWeight: '700', color: won ? C_GOLD_LEAF : C_ACCENT,
      marginBottom: '8px',
    });
    seal.textContent = won ? '合格' : '不合格';
    card.appendChild(seal);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '20px', fontWeight: '700', color: C_PARCHMENT, marginBottom: '6px' });
    title.textContent = won ? 'Mastery Achieved' : 'Training Failed';
    card.appendChild(title);

    // Message
    const msg = document.createElement('div');
    Object.assign(msg.style, { fontSize: '14px', color: `${C_PARCHMENT}b3`, marginBottom: '16px' });
    msg.textContent = won
      ? `Score: ${this.score}/${this.rounds} rounds completed.`
      : 'Your lives have been exhausted. Try again.';
    card.appendChild(msg);

    // Button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = won ? 'CONTINUE' : 'TRY AGAIN';
    Object.assign(btn.style, {
      padding: '10px 24px', borderRadius: '20px', fontSize: '14px', fontWeight: '700',
      fontFamily: 'inherit', letterSpacing: '0.08em',
      color: C_GOLD_LEAF, background: `${C_GOLD_LEAF}1f`,
      border: `1.5px solid ${C_GOLD_LEAF}80`, cursor: 'pointer',
    });
    btn.addEventListener('click', () => {
      this.overlayEl!.style.display = 'none';
      if (won) {
        this.isSolved = true;
        this.onSolved?.();
      } else {
        // Reset
        this.lives = this.maxLives;
        this.round = 0;
        this.score = 0;
        this.newProblem();
      }
    });
    card.appendChild(btn);

    this.overlayEl.appendChild(card);
  }

  /* ═══════════════════ Rules Overlay ═══════════════════════════ */

  private showRulesOverlay(): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '340px', width: '90%', padding: '24px', textAlign: 'left',
      background: C_PARCHMENT, borderRadius: '12px',
      boxShadow: '0 16px 48px rgba(0,0,0,0.6)', fontFamily: "'Rajdhani', system-ui, sans-serif",
      color: C_WOOD_DARK,
    });

    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '18px', fontWeight: '700', textAlign: 'center', marginBottom: '16px' });
    title.textContent = 'How to Use the Soroban';
    card.appendChild(title);

    const rules = [
      { icon: '🔴', text: 'The top bead (heaven) is worth 5. Tap to toggle it.' },
      { icon: '🟤', text: 'The four bottom beads (earth) are worth 1 each. Tap upper zone to add, lower zone to subtract.' },
      { icon: '👆', text: 'Push beads toward the beam (center bar) to activate them.' },
      { icon: '📍', text: 'Columns represent place values: 一(1), 十(10), 百(100), 千(1000), 万(10000).' },
    ];

    for (const r of rules) {
      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '12px' });

      const icon = document.createElement('span');
      icon.style.fontSize = '20px';
      icon.textContent = r.icon;
      row.appendChild(icon);

      const txt = document.createElement('span');
      Object.assign(txt.style, { fontSize: '13px', lineHeight: '1.5' });
      txt.textContent = r.text;
      row.appendChild(txt);

      card.appendChild(row);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'CLOSE';
    Object.assign(closeBtn.style, {
      display: 'block', margin: '12px auto 0', padding: '8px 20px',
      borderRadius: '20px', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit',
      letterSpacing: '0.12em', color: C_WOOD_DARK, background: 'transparent',
      border: `1px solid ${C_WOOD_DARK}55`, cursor: 'pointer',
    });
    closeBtn.addEventListener('click', () => { this.overlayEl!.style.display = 'none'; });
    card.appendChild(closeBtn);

    this.overlayEl.appendChild(card);
  }

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    this.stopTimer();
    if (this.root) { this.root.remove(); this.root = null; }
    this.ctx2d = null;
    this.sorobanCanvas = null;
    this.overlayEl = null;
    this.exprEl = null;
    this.valueEl = null;
    this.livesEl = null;
    this.feedbackEl = null;
    this.timerEl = null;
    this.roundEl = null;
    this.hintEl = null;
    this.placeLabelsEl = null;
    super.dispose();
  }
}
