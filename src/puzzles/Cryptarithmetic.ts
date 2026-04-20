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
 * Cryptarithmetic — verbal arithmetic. A hand-composed addition equation
 * reads as three words; each letter stands for a unique digit 0–9, and no
 * leading letter may be zero. The player assigns digits to letters until
 * the sum works out. A letter pool drawn from Italian Renaissance words
 * (LUCE, ROMA, FIDE, GALILEO…) keeps the theming.
 */

interface Problem {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly digitToLetter: Readonly<Record<number, string>>;
}

const LETTER_POOL = 'ARTESLUCOMFIDGA'; // shared across problems

function uniqueDigitsOf(...nums: number[]): Set<number> {
  const s = new Set<number>();
  for (const n of nums) for (const ch of String(n)) s.add(Number(ch));
  return s;
}

function generateProblem(): Problem {
  for (let attempt = 0; attempt < 600; attempt++) {
    const a = 10 + Math.floor(Math.random() * 90);
    const b = 10 + Math.floor(Math.random() * 90);
    const c = a + b;
    if (c < 100 || c > 199) continue;
    const digits = uniqueDigitsOf(a, b, c);
    if (digits.size < 5 || digits.size > 7) continue;
    // Map digits → distinct pool letters.
    const shuffled = LETTER_POOL.split('').sort(() => Math.random() - 0.5);
    const map: Record<number, string> = {};
    const used = new Set<string>();
    let idx = 0;
    let ok = true;
    for (const d of [...digits].sort()) {
      while (idx < shuffled.length && used.has(shuffled[idx])) idx++;
      if (idx >= shuffled.length) {
        ok = false;
        break;
      }
      map[d] = shuffled[idx];
      used.add(shuffled[idx]);
      idx++;
    }
    if (!ok) continue;
    return { a, b, c, digitToLetter: map };
  }
  // Fallback.
  return { a: 89, b: 10, c: 99, digitToLetter: { 0: 'E', 1: 'T', 8: 'A', 9: 'R' } };
}

function numberToWord(n: number, map: Readonly<Record<number, string>>): string {
  return String(n)
    .split('')
    .map((d) => map[Number(d)])
    .join('');
}

export class CryptarithmeticPuzzle extends Puzzle {
  readonly title = 'CRYPTARITHMETIC';
  readonly subtitle = 'verbal addition';
  readonly instructions =
    'Every letter is a different digit. Assign 0–9 so the sum is true. Leading letters must not be zero.';

  private wordA = '';
  private wordB = '';
  private wordC = '';
  private letters: string[] = []; // unique letters in first-seen order
  private leading = new Set<string>();
  private assignments = new Map<string, number>();
  private selected: string | null = null;
  private problem!: Problem;

  private root: HTMLDivElement | null = null;
  private equationEl: HTMLDivElement | null = null;
  private letterRowEl: HTMLDivElement | null = null;
  private digitPadEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private checkBtn: HTMLButtonElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.generate();
    this.buildDom();
    this.refresh();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const marble = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#ebe4d6'),
        roughness: 0.6,
        metalness: 0.2,
        side: DoubleSide,
      }),
    );
    marble.rotation.x = -Math.PI / 2;
    marble.position.y = -2.4;
    this.group.add(marble);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color('#c5972c'),
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

  /* --------------------------- Model ------------------------------------- */

  private generate(): void {
    this.problem = generateProblem();
    this.wordA = numberToWord(this.problem.a, this.problem.digitToLetter);
    this.wordB = numberToWord(this.problem.b, this.problem.digitToLetter);
    this.wordC = numberToWord(this.problem.c, this.problem.digitToLetter);

    const seen = new Set<string>();
    this.letters = [];
    for (const ch of this.wordA + this.wordB + this.wordC) {
      if (!seen.has(ch)) {
        seen.add(ch);
        this.letters.push(ch);
      }
    }
    this.leading = new Set([this.wordA[0], this.wordB[0], this.wordC[0]]);
    this.selected = this.letters[0];
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-cryptarithmetic';
    root.style.cssText = `
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      z-index:20; pointer-events:none; font-family:'Cormorant Garamond', Georgia, serif;
    `;
    this.root = root;

    const panel = document.createElement('div');
    panel.style.cssText = `
      display:flex; flex-direction:column; align-items:center; gap:14px;
      pointer-events:auto;
      padding:20px 26px;
      background:rgba(10,18,34,0.78); backdrop-filter:blur(12px);
      border:1px solid rgba(159,200,255,0.25);
      border-top:3px solid var(--era-accent);
      border-radius:10px;
      box-shadow:0 18px 60px rgba(0,0,0,0.55);
      color:#e6eefb;
      min-width:380px;
    `;
    root.appendChild(panel);

    const title = document.createElement('div');
    title.style.cssText = `font-size:18px; letter-spacing:0.26em; color:var(--era-accent); font-weight:600;`;
    title.textContent = 'CRYPTARITHMETIC';
    panel.appendChild(title);

    const eq = document.createElement('div');
    eq.style.cssText = `
      display:flex; flex-direction:column; align-items:flex-end; gap:4px;
      font-size:34px; letter-spacing:0.1em;
      padding:18px 28px;
      background:rgba(245,240,230,0.06);
      border:1px solid rgba(197,151,44,0.35);
      border-radius:6px;
      min-width:220px;
    `;
    this.equationEl = eq;
    panel.appendChild(eq);

    const letters = document.createElement('div');
    letters.style.cssText = `display:flex; flex-wrap:wrap; gap:6px; justify-content:center; max-width:420px;`;
    this.letterRowEl = letters;
    panel.appendChild(letters);

    const digits = document.createElement('div');
    digits.style.cssText = `display:flex; gap:5px; flex-wrap:wrap; justify-content:center;`;
    this.digitPadEl = digits;
    panel.appendChild(digits);

    const status = document.createElement('div');
    status.style.cssText = `font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;`;
    this.statusEl = status;
    panel.appendChild(status);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = `display:flex; gap:12px;`;
    panel.appendChild(btnRow);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'CLEAR';
    clearBtn.style.cssText = `
      padding:8px 18px;
      background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.22);
      color:#e6eefb;
      font-family:inherit; font-size:11px; letter-spacing:0.2em; font-weight:600;
      border-radius:5px; cursor:pointer;
    `;
    clearBtn.addEventListener('click', () => {
      if (this.isSolved) return;
      this.assignments.clear();
      this.refresh();
    });
    btnRow.appendChild(clearBtn);

    const check = document.createElement('button');
    check.type = 'button';
    check.textContent = 'VERIFY';
    check.style.cssText = `
      padding:8px 24px;
      background:rgba(159,200,255,0.08);
      border:1px solid rgba(159,200,255,0.4);
      color:var(--era-accent);
      font-family:'Cormorant Garamond', Georgia, serif;
      font-size:14px; letter-spacing:0.3em; font-weight:600;
      border-radius:4px; cursor:pointer;
    `;
    check.addEventListener('click', () => this.verify());
    this.checkBtn = check;
    btnRow.appendChild(check);

    document.body.appendChild(root);
  }

  /* ------------------------------ Render --------------------------------- */

  private refresh(): void {
    this.renderEquation();
    this.renderLetters();
    this.renderDigits();
    if (this.checkBtn) {
      const ready = this.letters.every((l) => this.assignments.has(l));
      this.checkBtn.disabled = !ready;
      this.checkBtn.style.opacity = ready ? '1' : '0.35';
    }
    if (this.statusEl && !this.isSolved) {
      const assigned = this.assignments.size;
      this.statusEl.textContent =
        assigned === this.letters.length
          ? 'tap VERIFY when ready'
          : `tap a letter, then a digit  ·  ${assigned}/${this.letters.length} assigned`;
      this.statusEl.style.color = '';
    }
  }

  private charSpan(ch: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.style.cssText = `
      display:inline-block; width:1.1em; text-align:center;
      font-weight:700;
      color:${this.selected === ch ? '#ffd27a' : '#f6e9c8'};
    `;
    const digit = this.assignments.get(ch);
    span.textContent = digit !== undefined ? String(digit) : ch;
    if (digit === undefined) span.style.opacity = '0.85';
    return span;
  }

  private renderEquation(): void {
    if (!this.equationEl) return;
    this.equationEl.innerHTML = '';
    const rowA = document.createElement('div');
    for (const ch of this.wordA.padStart(this.wordC.length, ' ')) {
      if (ch === ' ') {
        const s = document.createElement('span');
        s.style.cssText = 'display:inline-block; width:1.1em;';
        rowA.appendChild(s);
      } else rowA.appendChild(this.charSpan(ch));
    }
    const rowB = document.createElement('div');
    const plus = document.createElement('span');
    plus.textContent = '+ ';
    plus.style.cssText = 'color:#c5972c; font-weight:600; margin-right:4px;';
    rowB.appendChild(plus);
    for (const ch of this.wordB.padStart(this.wordC.length - 1, ' ')) {
      if (ch === ' ') {
        const s = document.createElement('span');
        s.style.cssText = 'display:inline-block; width:1.1em;';
        rowB.appendChild(s);
      } else rowB.appendChild(this.charSpan(ch));
    }
    const hr = document.createElement('div');
    hr.style.cssText = 'border-top:2px solid rgba(197,151,44,0.6); width:100%; margin:4px 0;';
    const rowC = document.createElement('div');
    for (const ch of this.wordC) rowC.appendChild(this.charSpan(ch));
    this.equationEl.appendChild(rowA);
    this.equationEl.appendChild(rowB);
    this.equationEl.appendChild(hr);
    this.equationEl.appendChild(rowC);
  }

  private renderLetters(): void {
    if (!this.letterRowEl) return;
    this.letterRowEl.innerHTML = '';
    for (const ch of this.letters) {
      const b = document.createElement('button');
      b.type = 'button';
      const digit = this.assignments.get(ch);
      const isLead = this.leading.has(ch);
      b.textContent = digit !== undefined ? `${ch}=${digit}` : ch;
      b.style.cssText = `
        min-width:52px; padding:6px 10px;
        background:${this.selected === ch ? 'rgba(255,200,120,0.25)' : 'rgba(159,200,255,0.08)'};
        border:1px solid ${this.selected === ch ? '#ffd27a' : 'rgba(159,200,255,0.3)'};
        color:#f6e9c8;
        font-family:inherit; font-size:15px; font-weight:600; letter-spacing:0.08em;
        border-radius:5px; cursor:pointer;
      `;
      if (isLead) {
        b.title = 'leading letter — cannot be zero';
        b.style.borderBottom = '2px solid #c5972c';
      }
      b.addEventListener('click', () => {
        if (this.isSolved) return;
        this.selected = ch;
        this.refresh();
      });
      this.letterRowEl.appendChild(b);
    }
  }

  private renderDigits(): void {
    if (!this.digitPadEl) return;
    this.digitPadEl.innerHTML = '';
    const usedDigits = new Set(this.assignments.values());
    for (let d = 0; d <= 9; d++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(d);
      const isSelLead = this.selected ? this.leading.has(this.selected) : false;
      const forbidden = isSelLead && d === 0;
      const used = usedDigits.has(d) && this.assignments.get(this.selected || '') !== d;
      const disabled = forbidden || used || !this.selected || this.isSolved;
      b.disabled = disabled;
      b.style.cssText = `
        width:44px; height:44px;
        background:rgba(245,230,200,0.06);
        border:1px solid rgba(197,151,44,0.4);
        color:#f6e9c8;
        font-family:inherit; font-size:16px; font-weight:700;
        border-radius:5px; cursor:pointer;
        opacity:${disabled ? '0.3' : '1'};
      `;
      b.addEventListener('click', () => {
        if (!this.selected || disabled) return;
        this.assignments.set(this.selected, d);
        const nextUnassigned = this.letters.find((l) => !this.assignments.has(l));
        if (nextUnassigned) this.selected = nextUnassigned;
        this.refresh();
      });
      this.digitPadEl.appendChild(b);
    }
  }

  /* ------------------------------ Solve ---------------------------------- */

  private wordToNumber(w: string): number | null {
    let out = 0;
    for (const ch of w) {
      const d = this.assignments.get(ch);
      if (d === undefined) return null;
      out = out * 10 + d;
    }
    return out;
  }

  private verify(): void {
    for (const l of this.leading) {
      if (this.assignments.get(l) === 0) {
        this.flashStatus('a leading letter must not be zero', '#e89090');
        return;
      }
    }
    const a = this.wordToNumber(this.wordA);
    const b = this.wordToNumber(this.wordB);
    const c = this.wordToNumber(this.wordC);
    if (a === null || b === null || c === null) return;
    if (a + b === c) {
      this.isSolved = true;
      if (this.statusEl) {
        this.statusEl.textContent = `${a} + ${b} = ${c} — CONFIRMED`;
        this.statusEl.style.color = '#9fe0a6';
      }
      setTimeout(() => this.onSolved?.(), 1000);
    } else {
      this.flashStatus(`${a} + ${b} = ${a + b} ≠ ${c}`, '#e89090');
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
    this.equationEl = null;
    this.letterRowEl = null;
    this.digitPadEl = null;
    this.statusEl = null;
    this.checkBtn = null;
    this.assignments.clear();
    super.dispose();
  }
}
