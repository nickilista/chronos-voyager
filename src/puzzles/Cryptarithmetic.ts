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
 * Cryptarithmetic — Renaissance verbal arithmetic puzzle.
 * Each letter maps to a unique digit 0–9. Solve: WORD1 + WORD2 = RESULT.
 * Leading letters cannot be zero. Difficulty 1–5.
 *
 * Aligned with iOS CryptarithmeticView.swift:
 *   - Renaissance Italian color theme (marble, lapis, Florentine gold)
 *   - Canvas-drawn marble tablet with veins, fleur-de-lis, arch ornament
 *   - Letter selection row with marble-style tiles
 *   - Digit pad (0–9) with used/leading-zero constraints
 *   - Shake animation on wrong answer, auto-clear after 2s
 *   - Auto-advance to next unassigned letter
 *   - Validates equation (not just stored solution)
 *   - Level-based letter pools from Italian Renaissance words
 */

/* ── Renaissance Italian Colors (matches iOS) ────────────────────── */

const C_MARBLE_LIGHT = '#F0EDE8';
const C_MARBLE_MID = '#E2DDD5';
const C_MARBLE_DARK = '#D4CFC6';
const C_MEDICI_RED = '#8B1A1A';
const C_LAPIS_BLUE = '#1F3A6E';
const C_FLO_GOLD = '#C5972C';
const C_INK_BROWN = '#3B2414';
const C_WARM_IVORY = '#FAF6EF';
const C_SUCCESS_GOLD = '#D4AF37';
const C_VEIN = '#C8BDA8';

/* ── Level configs (matches iOS) ─────────────────────────────────── */

interface LevelConfig {
  minVal: number;
  maxVal: number;
  minLetters: number;
  maxLetters: number;
}

const LEVEL_CONFIGS: LevelConfig[] = [
  { minVal: 10, maxVal: 99, minLetters: 3, maxLetters: 5 },
  { minVal: 10, maxVal: 99, minLetters: 4, maxLetters: 6 },
  { minVal: 100, maxVal: 999, minLetters: 5, maxLetters: 7 },
  { minVal: 100, maxVal: 999, minLetters: 6, maxLetters: 8 },
  { minVal: 1000, maxVal: 9999, minLetters: 7, maxLetters: 10 },
];

/* ── Letter pools per level (Renaissance Italian words) ──────────── */

const LETTER_POOLS: string[][] = [
  [...'ARTES'],
  [...'LUCESOM'],
  [...'ROMAFIED'],
  [...'GALILEOSC'],
  [...'RINASCMETO'],
];

/* ── Canvas dimensions ───────────────────────────────────────────── */

const TABLET_W = 380;
const TABLET_H = 230;

/* ── Helpers ─────────────────────────────────────────────────────── */

function uniqueDigitsOf(...nums: number[]): Set<number> {
  const s = new Set<number>();
  for (const n of nums) for (const ch of String(n)) s.add(Number(ch));
  return s;
}

function numberToWord(n: number, map: Record<number, string>): string {
  return String(n)
    .split('')
    .map((d) => map[Number(d)])
    .join('');
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Puzzle class ────────────────────────────────────────────────── */

export class CryptarithmeticPuzzle extends Puzzle {
  readonly title = 'CRYPTARITHMETIC';
  readonly subtitle = 'Renaissance verbal arithmetic';
  readonly instructions =
    'Each letter stands for a unique digit 0–9. Assign digits so the addition is correct. Leading letters cannot be zero.';

  private level = 5;
  private wordA = '';
  private wordB = '';
  private wordResult = '';
  private allLetters: string[] = [];
  private leadingLetters = new Set<string>();
  private assignments = new Map<string, number>();
  private selectedLetter: string | null = null;
  private wrongLetters = new Set<string>();
  private attempts = 0;
  private goldenGlow = 0;
  private glowDir = 1;

  // DOM
  private root: HTMLDivElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private letterRowEl: HTMLDivElement | null = null;
  private digitPadEl: HTMLDivElement | null = null;
  private btnRowEl: HTMLDivElement | null = null;
  private headerEl: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.generatePuzzle();
    this.buildDom();
    this.refresh();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#ebe4d6'),
        roughness: 0.6,
        metalness: 0.2,
        side: DoubleSide,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color(C_FLO_GOLD),
        emissive: new Color('#4a2a08'),
        emissiveIntensity: 0.4,
        roughness: 0.4,
        metalness: 0.9,
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

  /* ═══════════════════ Puzzle Generation (matches iOS) ═══════════ */

  private generatePuzzle(): void {
    const lvl = Math.min(Math.max(this.level, 1), 5);
    const config = LEVEL_CONFIGS[lvl - 1];
    const pool = LETTER_POOLS[lvl - 1];

    let bestA = 0, bestB = 0, bestC = 0;
    let bestMap: Record<number, string> = {};
    let found = false;

    for (let attempt = 0; attempt < 500; attempt++) {
      const a = config.minVal + Math.floor(Math.random() * (config.maxVal - config.minVal + 1));
      const b = config.minVal + Math.floor(Math.random() * (config.maxVal - config.minVal + 1));
      const c = a + b;

      const digits = uniqueDigitsOf(a, b, c);
      if (digits.size < config.minLetters || digits.size > Math.min(config.maxLetters, pool.length, 10)) continue;
      if (c >= config.maxVal * 2 + 1) continue;

      const shuffledPool = shuffleArray(pool);
      const digitToLetter: Record<number, string> = {};
      const usedLetters = new Set<string>();
      let poolIdx = 0;
      let ok = true;

      for (const d of [...digits].sort((a, b) => a - b)) {
        while (poolIdx < shuffledPool.length && usedLetters.has(shuffledPool[poolIdx])) poolIdx++;
        if (poolIdx >= shuffledPool.length) { ok = false; break; }
        digitToLetter[d] = shuffledPool[poolIdx];
        usedLetters.add(shuffledPool[poolIdx]);
        poolIdx++;
      }
      if (!ok || Object.keys(digitToLetter).length !== digits.size) continue;

      bestA = a; bestB = b; bestC = c;
      bestMap = digitToLetter;
      found = true;
      break;
    }

    if (!found) {
      bestA = 89; bestB = 10; bestC = 99;
      bestMap = { 8: 'A', 9: 'R', 1: 'T', 0: 'E' };
    }

    this.wordA = numberToWord(bestA, bestMap);
    this.wordB = numberToWord(bestB, bestMap);
    this.wordResult = numberToWord(bestC, bestMap);

    // Collect unique letters in first-seen order
    const seen = new Set<string>();
    this.allLetters = [];
    for (const ch of this.wordA + this.wordB + this.wordResult) {
      if (!seen.has(ch)) {
        seen.add(ch);
        this.allLetters.push(ch);
      }
    }

    // Leading letters
    this.leadingLetters = new Set<string>();
    if (this.wordA[0]) this.leadingLetters.add(this.wordA[0]);
    if (this.wordB[0]) this.leadingLetters.add(this.wordB[0]);
    if (this.wordResult[0]) this.leadingLetters.add(this.wordResult[0]);

    this.selectedLetter = this.allLetters[0] ?? null;
  }

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-cryptarithmetic';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: 'rgba(240,237,232,0.94)', backdropFilter: 'blur(12px)',
      border: `1.5px solid ${C_FLO_GOLD}66`,
      borderTop: `3px solid ${C_FLO_GOLD}`,
      borderRadius: '14px',
      boxShadow: `0 18px 60px rgba(59,36,20,0.35)`,
      color: C_INK_BROWN,
      maxHeight: '96vh', overflowY: 'auto',
    });
    root.appendChild(panel);

    // Header row (rules button + attempts)
    this.headerEl = document.createElement('div');
    Object.assign(this.headerEl.style, {
      display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center',
    });
    panel.appendChild(this.headerEl);

    // Rules button
    const rulesBtn = document.createElement('button');
    rulesBtn.type = 'button';
    rulesBtn.textContent = 'Rules';
    Object.assign(rulesBtn.style, {
      padding: '6px 12px', fontSize: '12px', fontWeight: '600', fontFamily: 'inherit',
      color: C_LAPIS_BLUE, background: C_WARM_IVORY,
      border: `1.5px solid ${C_LAPIS_BLUE}80`, borderRadius: '8px', cursor: 'pointer',
      letterSpacing: '0.04em',
    });
    rulesBtn.addEventListener('click', () => this.showRulesOverlay());
    this.headerEl.appendChild(rulesBtn);

    // Attempts counter (filled later in refresh)
    const attemptsEl = document.createElement('span');
    attemptsEl.id = 'crypto-attempts';
    Object.assign(attemptsEl.style, { fontSize: '12px', fontWeight: '500', color: C_MEDICI_RED });
    this.headerEl.appendChild(attemptsEl);

    // Equation canvas (marble tablet)
    const cvs = document.createElement('canvas');
    cvs.width = TABLET_W * 2;
    cvs.height = TABLET_H * 2;
    Object.assign(cvs.style, { width: TABLET_W + 'px', height: TABLET_H + 'px', borderRadius: '14px' });
    this.canvasEl = cvs;
    this.ctx2d = cvs.getContext('2d')!;
    panel.appendChild(cvs);

    // Letter row
    this.letterRowEl = document.createElement('div');
    Object.assign(this.letterRowEl.style, {
      display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '420px',
    });
    panel.appendChild(this.letterRowEl);

    // Digit pad
    this.digitPadEl = document.createElement('div');
    Object.assign(this.digitPadEl.style, {
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', maxWidth: '320px', width: '100%',
    });
    panel.appendChild(this.digitPadEl);

    // Button row (Clear + Check)
    this.btnRowEl = document.createElement('div');
    Object.assign(this.btnRowEl.style, { display: 'flex', gap: '16px', marginTop: '4px' });
    panel.appendChild(this.btnRowEl);

    // Overlay for rules dialog
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    document.body.appendChild(root);

    // Inject animation keyframes
    if (!document.getElementById('crypto-anims')) {
      const style = document.createElement('style');
      style.id = 'crypto-anims';
      style.textContent = `
        @keyframes crypto-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(12px)} 40%{transform:translateX(-10px)} 60%{transform:translateX(6px)} 80%{transform:translateX(-4px)} }
        @keyframes crypto-pop { from{transform:scale(0.92);opacity:0} to{transform:scale(1);opacity:1} }
      `;
      document.head.appendChild(style);
    }
  }

  /* ═══════════════════ Canvas tablet drawing (matches iOS) ═══════ */

  private drawTablet(): void {
    const c = this.ctx2d!;
    const s = 2;
    const w = TABLET_W;
    const h = TABLET_H;
    c.clearRect(0, 0, w * s, h * s);
    c.save();
    c.scale(s, s);

    // Marble background gradient
    const grad = c.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, C_MARBLE_LIGHT);
    grad.addColorStop(0.4, C_MARBLE_MID);
    grad.addColorStop(0.7, C_MARBLE_LIGHT);
    grad.addColorStop(1, C_MARBLE_DARK);
    this.roundRect(c, 0, 0, w, h, 14);
    c.fillStyle = grad;
    c.fill();

    // Golden glow on solve
    if (this.isSolved) {
      this.roundRect(c, 0, 0, w, h, 14);
      c.fillStyle = `rgba(212,175,55,${this.goldenGlow * 0.12})`;
      c.fill();
    }

    // Marble veins
    this.drawMarbleVeins(c, w, h);

    // Double classical border (outer gold, inner lapis)
    this.roundRectStroke(c, 3, 3, w - 6, h - 6, 12, C_FLO_GOLD + 'b3', 2.5);
    this.roundRectStroke(c, 7, 7, w - 14, h - 14, 10, C_LAPIS_BLUE + '66', 1);

    // Corner fleur-de-lis ornaments
    this.drawFleurDeLis(c, w, h);

    // Top center arch ornament
    this.drawArchOrnament(c, w);

    // Equation layout (vertical addition, right-aligned)
    const lvl = this.level;
    const fontSize = lvl <= 2 ? 28 : (lvl <= 4 ? 24 : 20);
    const lineHeight = fontSize + 10;
    const maxLen = Math.max(this.wordA.length, this.wordB.length, this.wordResult.length);
    const charWidth = fontSize * 0.7;
    const blockWidth = maxLen * charWidth;
    const startX = (w - blockWidth) / 2 + blockWidth;
    const startY = h * 0.20;

    // Word A
    this.drawWord(c, this.wordA, startX, startY, fontSize, charWidth);

    // Plus sign + Word B
    c.font = `bold ${fontSize * 0.8}px 'Rajdhani', serif`;
    c.fillStyle = C_INK_BROWN;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('+', startX - blockWidth - charWidth * 0.6, startY + lineHeight + fontSize / 2);
    this.drawWord(c, this.wordB, startX, startY + lineHeight, fontSize, charWidth);

    // Divider double line
    const lineY = startY + lineHeight * 2 + 4;
    const lineStart = startX - blockWidth - charWidth * 0.8;
    const lineEnd = startX + charWidth * 0.3;
    c.beginPath();
    c.moveTo(lineStart, lineY);
    c.lineTo(lineEnd, lineY);
    c.strokeStyle = C_INK_BROWN;
    c.lineWidth = 2.5;
    c.stroke();
    c.beginPath();
    c.moveTo(lineStart, lineY + 4);
    c.lineTo(lineEnd, lineY + 4);
    c.strokeStyle = C_INK_BROWN + '66';
    c.lineWidth = 1;
    c.stroke();

    // Result word
    this.drawWord(c, this.wordResult, startX, lineY + 8, fontSize, charWidth);

    c.restore();
  }

  private drawMarbleVeins(c: CanvasRenderingContext2D, w: number, h: number): void {
    c.strokeStyle = C_VEIN + '4d'; // 0.3 opacity
    c.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) {
      const yOff = h * (0.15 + i * 0.22);
      c.beginPath();
      c.moveTo(10, yOff);
      c.quadraticCurveTo(
        w * 0.4, yOff + (i % 2 === 0 ? -12 : 14),
        w - 10, yOff + (i % 2 === 0 ? 8 : -6),
      );
      c.stroke();
    }
  }

  private drawFleurDeLis(c: CanvasRenderingContext2D, w: number, h: number): void {
    const inset = 16;
    const sz = 7;
    const corners = [
      { x: inset, y: inset },
      { x: w - inset, y: inset },
      { x: inset, y: h - inset },
      { x: w - inset, y: h - inset },
    ];
    for (const pt of corners) {
      // Center petal
      c.beginPath();
      c.moveTo(pt.x, pt.y - sz);
      c.quadraticCurveTo(pt.x + sz * 0.5, pt.y - sz * 0.2, pt.x, pt.y + sz * 0.3);
      c.quadraticCurveTo(pt.x - sz * 0.5, pt.y - sz * 0.2, pt.x, pt.y - sz);
      c.fillStyle = C_FLO_GOLD + '99';
      c.fill();
      // Left petal
      c.beginPath();
      c.moveTo(pt.x, pt.y);
      c.quadraticCurveTo(pt.x - sz * 0.7, pt.y + sz * 0.3, pt.x - sz, pt.y - sz * 0.5);
      c.strokeStyle = C_FLO_GOLD + '80';
      c.lineWidth = 1.2;
      c.stroke();
      // Right petal
      c.beginPath();
      c.moveTo(pt.x, pt.y);
      c.quadraticCurveTo(pt.x + sz * 0.7, pt.y + sz * 0.3, pt.x + sz, pt.y - sz * 0.5);
      c.stroke();
    }
  }

  private drawArchOrnament(c: CanvasRenderingContext2D, w: number): void {
    const archW = 40;
    const archH = 12;
    const cx = w / 2;
    const topY = 10;
    c.beginPath();
    c.moveTo(cx - archW / 2, topY + archH);
    c.quadraticCurveTo(cx, topY - archH * 0.3, cx + archW / 2, topY + archH);
    c.strokeStyle = C_FLO_GOLD + '80';
    c.lineWidth = 1.5;
    c.stroke();
    // Keystone dot
    c.beginPath();
    c.arc(cx, topY + 3, 2, 0, Math.PI * 2);
    c.fillStyle = C_FLO_GOLD + '99';
    c.fill();
  }

  private drawWord(
    c: CanvasRenderingContext2D, word: string,
    rightX: number, y: number, fontSize: number, charWidth: number,
  ): void {
    c.font = `bold ${fontSize}px 'Rajdhani', serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    const chars = [...word].reverse();
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const x = rightX - i * charWidth;
      const isWrong = this.wrongLetters.has(ch);
      const isSelected = this.selectedLetter === ch;

      let displayText: string;
      let textColor: string;

      if (this.isSolved) {
        const val = this.assignments.get(ch);
        displayText = val !== undefined ? String(val) : ch;
        textColor = C_SUCCESS_GOLD;
      } else if (this.assignments.has(ch)) {
        displayText = String(this.assignments.get(ch));
        textColor = isWrong ? C_MEDICI_RED : C_FLO_GOLD;
      } else {
        displayText = ch;
        textColor = isSelected ? C_LAPIS_BLUE : C_INK_BROWN;
      }

      c.fillStyle = textColor;
      c.fillText(displayText, x, y + fontSize / 2);
    }
  }

  /* ═══════════════════ Letter row (matches iOS) ═════════════════ */

  private renderLetters(): void {
    if (!this.letterRowEl) return;
    this.letterRowEl.innerHTML = '';

    if (this.isSolved) return;

    for (const letter of this.allLetters) {
      const isSelected = this.selectedLetter === letter;
      const hasValue = this.assignments.has(letter);
      const isWrong = this.wrongLetters.has(letter);

      const btn = document.createElement('button');
      btn.type = 'button';
      Object.assign(btn.style, {
        width: '44px', height: '44px', position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '1px',
        background: isSelected ? C_LAPIS_BLUE :
          (isWrong ? C_MEDICI_RED + '40' :
            (hasValue ? C_FLO_GOLD + '26' : C_MARBLE_LIGHT)),
        border: `${isSelected ? '2.5' : '1.5'}px solid ${isSelected ? C_FLO_GOLD : C_LAPIS_BLUE + '4d'}`,
        borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
      });

      // Letter label
      const letterSpan = document.createElement('span');
      Object.assign(letterSpan.style, {
        fontSize: '16px', fontWeight: '700',
        color: isSelected ? C_WARM_IVORY : C_INK_BROWN,
      });
      letterSpan.textContent = letter;
      btn.appendChild(letterSpan);

      // Digit value (if assigned)
      if (hasValue) {
        const valSpan = document.createElement('span');
        Object.assign(valSpan.style, {
          fontSize: '10px', fontWeight: '600',
          color: isWrong ? C_MEDICI_RED : C_FLO_GOLD,
        });
        valSpan.textContent = String(this.assignments.get(letter));
        btn.appendChild(valSpan);
      }

      btn.addEventListener('click', () => {
        if (this.isSolved) return;
        this.selectedLetter = letter;
        this.refresh();
      });
      this.letterRowEl.appendChild(btn);
    }
  }

  /* ═══════════════════ Digit pad (matches iOS) ══════════════════ */

  private renderDigits(): void {
    if (!this.digitPadEl) return;
    this.digitPadEl.innerHTML = '';

    if (this.isSolved) return;

    const usedDigits = new Set(this.assignments.values());

    for (let digit = 0; digit <= 9; digit++) {
      const isUsed = usedDigits.has(digit);
      const isLeadingZero = digit === 0 && this.selectedLetter !== null && this.leadingLetters.has(this.selectedLetter);
      const disabled = isUsed || this.selectedLetter === null || isLeadingZero;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(digit);
      btn.disabled = disabled;
      Object.assign(btn.style, {
        height: '40px', fontSize: '16px', fontWeight: '600', fontFamily: 'inherit',
        color: isUsed ? C_INK_BROWN + '40' :
          (isLeadingZero ? C_MEDICI_RED + '80' : C_INK_BROWN),
        background: isUsed ? C_MARBLE_DARK + '66' : C_MARBLE_LIGHT,
        border: `1px solid ${isLeadingZero ? C_MEDICI_RED + '80' : C_LAPIS_BLUE + '4d'}`,
        borderRadius: '8px', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? '0.5' : '1',
      });

      btn.addEventListener('click', () => {
        if (disabled || this.isSolved) return;
        this.assignDigit(digit);
      });
      this.digitPadEl.appendChild(btn);
    }
  }

  /* ═══════════════════ Button row (Clear + Check) ═══════════════ */

  private renderButtons(): void {
    if (!this.btnRowEl) return;
    this.btnRowEl.innerHTML = '';

    if (this.isSolved) {
      const solvedLabel = document.createElement('div');
      Object.assign(solvedLabel.style, {
        fontSize: '18px', fontWeight: '700', color: C_SUCCESS_GOLD,
        textAlign: 'center',
      });
      solvedLabel.textContent = 'CORRECT!';
      this.btnRowEl.appendChild(solvedLabel);
      return;
    }

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'CLEAR';
    Object.assign(clearBtn.style, {
      padding: '9px 20px', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit',
      color: C_INK_BROWN + 'b3', background: 'transparent',
      border: `1.5px solid ${C_LAPIS_BLUE}4d`, borderRadius: '10px',
      cursor: 'pointer', letterSpacing: '0.06em',
    });
    clearBtn.addEventListener('click', () => {
      this.assignments.clear();
      this.selectedLetter = this.allLetters[0] ?? null;
      this.wrongLetters.clear();
      this.refresh();
    });
    this.btnRowEl.appendChild(clearBtn);

    // Check button
    const allAssigned = this.allLetters.every((l) => this.assignments.has(l));
    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.textContent = 'CHECK';
    checkBtn.disabled = !allAssigned;
    Object.assign(checkBtn.style, {
      padding: '10px 28px', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
      color: C_WARM_IVORY,
      background: allAssigned ? C_LAPIS_BLUE : C_LAPIS_BLUE + '59',
      border: 'none', borderRadius: '10px',
      cursor: allAssigned ? 'pointer' : 'default',
      letterSpacing: '0.08em',
      opacity: allAssigned ? '1' : '0.6',
    });
    checkBtn.addEventListener('click', () => this.checkSolution());
    this.btnRowEl.appendChild(checkBtn);
  }

  /* ═══════════════════ Actions (matches iOS) ════════════════════ */

  private assignDigit(digit: number): void {
    if (!this.selectedLetter) return;
    this.assignments.set(this.selectedLetter, digit);
    this.wrongLetters.delete(this.selectedLetter);

    // Auto-advance to next unassigned letter
    const nextUnassigned = this.allLetters.find((l) => !this.assignments.has(l));
    if (nextUnassigned && nextUnassigned !== this.selectedLetter) {
      this.selectedLetter = nextUnassigned;
    } else {
      this.selectedLetter = null;
    }
    this.refresh();
  }

  private checkSolution(): void {
    const allAssigned = this.allLetters.every((l) => this.assignments.has(l));
    if (!allAssigned || this.isSolved) return;
    this.attempts++;

    const isCorrect = this.validateEquation();

    if (isCorrect) {
      this.isSolved = true;
      this.goldenGlow = 1;
      this.refresh();
      setTimeout(() => this.onSolved?.(), 1500);
    } else {
      // Wrong — mark all letters as wrong, shake
      this.wrongLetters = new Set(this.allLetters);
      this.shakeTablet();
      this.refresh();

      // After 2s, clear and reset
      setTimeout(() => {
        this.assignments.clear();
        this.wrongLetters.clear();
        this.selectedLetter = this.allLetters[0] ?? null;
        this.refresh();
      }, 2000);
    }
  }

  private validateEquation(): boolean {
    // Check all digits are unique
    const usedDigits = new Set(this.assignments.values());
    if (usedDigits.size !== this.assignments.size) return false;

    // Check no leading zeros
    for (const letter of this.leadingLetters) {
      if (this.assignments.get(letter) === 0) return false;
    }

    // Convert words to numbers
    const a = this.wordToNumber(this.wordA);
    const b = this.wordToNumber(this.wordB);
    const res = this.wordToNumber(this.wordResult);
    if (a === null || b === null || res === null) return false;

    return a + b === res;
  }

  private wordToNumber(word: string): number | null {
    let result = 0;
    for (const ch of word) {
      const digit = this.assignments.get(ch);
      if (digit === undefined) return null;
      result = result * 10 + digit;
    }
    return result;
  }

  private shakeTablet(): void {
    if (!this.canvasEl) return;
    this.canvasEl.style.animation = 'crypto-shake 0.4s ease-out';
    setTimeout(() => {
      if (this.canvasEl) this.canvasEl.style.animation = '';
    }, 400);
  }

  /* ═══════════════════ Rules overlay ════════════════════════════ */

  private showRulesOverlay(): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '360px', width: '90%', padding: '24px',
      background: C_WARM_IVORY,
      border: `1.5px solid ${C_FLO_GOLD}66`,
      borderRadius: '16px',
      boxShadow: `0 12px 40px rgba(59,36,20,0.3)`,
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      animation: 'crypto-pop 0.25s ease-out',
      maxHeight: '80vh', overflowY: 'auto',
    });

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, {
      fontSize: '18px', fontWeight: '700', color: C_LAPIS_BLUE, textAlign: 'center',
      marginBottom: '16px', letterSpacing: '0.08em',
    });
    title.textContent = 'CRYPTARITHMETIC RULES';
    card.appendChild(title);

    const rules = [
      { heading: 'What is it?', text: 'A verbal arithmetic puzzle where each letter represents a unique digit. The goal is to find the digit assignment that makes the addition equation correct.' },
      { heading: 'How to play', text: 'Tap a letter tile to select it, then tap a digit (0–9) to assign it. The equation updates live as you make assignments.' },
      { heading: 'Rules', text: '• Each letter maps to exactly one digit\n• Each digit is used by at most one letter\n• Leading letters (first letter of each word) cannot be zero' },
      { heading: 'Example', text: 'If AR + TE = RES, you must find digits for A, R, T, E, S such that the numerical addition holds.' },
      { heading: 'Tips', text: '• Start with the carry columns\n• Look at which digits must be odd/even\n• Leading-letter constraint eliminates 0 quickly' },
    ];

    for (const rule of rules) {
      const section = document.createElement('div');
      Object.assign(section.style, {
        marginBottom: '14px', padding: '12px',
        background: C_MARBLE_LIGHT, borderRadius: '10px',
        border: `0.8px solid ${C_FLO_GOLD}40`,
      });
      const h = document.createElement('div');
      Object.assign(h.style, { fontSize: '14px', fontWeight: '700', color: C_LAPIS_BLUE, marginBottom: '6px' });
      h.textContent = rule.heading;
      section.appendChild(h);
      const p = document.createElement('div');
      Object.assign(p.style, { fontSize: '13px', color: C_INK_BROWN, lineHeight: '1.5', whiteSpace: 'pre-line' });
      p.textContent = rule.text;
      section.appendChild(p);
      card.appendChild(section);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'CLOSE';
    Object.assign(closeBtn.style, {
      width: '100%', padding: '10px', marginTop: '8px',
      fontSize: '13px', fontWeight: '700', fontFamily: 'inherit',
      color: C_LAPIS_BLUE, background: 'transparent',
      border: `1.5px solid ${C_LAPIS_BLUE}4d`, borderRadius: '10px',
      cursor: 'pointer', letterSpacing: '0.1em',
    });
    closeBtn.addEventListener('click', () => {
      this.overlayEl!.style.display = 'none';
    });
    card.appendChild(closeBtn);

    this.overlayEl.appendChild(card);
  }

  /* ═══════════════════ Refresh all UI ═══════════════════════════ */

  private refresh(): void {
    this.drawTablet();
    this.renderLetters();
    this.renderDigits();
    this.renderButtons();

    // Update attempts counter
    const attemptsEl = this.headerEl?.querySelector('#crypto-attempts') as HTMLSpanElement | null;
    if (attemptsEl) {
      attemptsEl.textContent = this.attempts > 0 && !this.isSolved ? `Attempts: ${this.attempts}` : '';
    }
  }

  /* ═══════════════════ Canvas helpers ═══════════════════════════ */

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

  private roundRectStroke(
    c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
    r: number, color: string, lineWidth: number,
  ): void {
    this.roundRect(c, x, y, w, h, r);
    c.strokeStyle = color;
    c.lineWidth = lineWidth;
    c.stroke();
  }

  /* ═══════════════════ Lifecycle ════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);

    // Animate golden glow on solved
    if (this.isSolved) {
      this.goldenGlow += this.glowDir * _dt * 0.8;
      if (this.goldenGlow >= 1) { this.goldenGlow = 1; this.glowDir = -1; }
      if (this.goldenGlow <= 0) { this.goldenGlow = 0; this.glowDir = 1; }
      this.drawTablet();
    }
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('crypto-anims');
    if (animStyle) animStyle.remove();
    this.canvasEl = null;
    this.ctx2d = null;
    this.letterRowEl = null;
    this.digitPadEl = null;
    this.btnRowEl = null;
    this.headerEl = null;
    this.overlayEl = null;
    this.assignments.clear();
    this.wrongLetters.clear();
    super.dispose();
  }
}
