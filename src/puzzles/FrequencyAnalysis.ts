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
 * Frequency Analysis — crack a monoalphabetic substitution cipher. A short
 * plaintext drawn from the Islamic golden age is encoded with a random
 * permutation of A..Z; the player maps each cipher symbol to its plaintext
 * letter one at a time. Wrong guesses accumulate; five wrong and the round
 * fails and resets. A frequency histogram is shown so the classical Arab
 * technique — pair the most common symbol with the most common letter —
 * can be applied directly.
 */

const MAX_WRONG = 5;

const PLAINTEXTS: readonly string[] = [
  'KNOWLEDGE IS THE LIFE OF THE MIND AND THE FOOD OF THE SOUL',
  'SCIENCE IS FINDING THE LIGHT WHERE OTHERS SEE ONLY DARKNESS',
  'THE INK OF THE SCHOLAR IS HOLIER THAN THE BLOOD OF THE MARTYR',
  'GEOMETRY HAS TWO GREAT TREASURES THE PYTHAGOREAN THEOREM AND THE GOLDEN RATIO',
  'HE WHO LEARNS AND LEARNS AND DOES NOT PRACTICE IS LIKE ONE WHO SOWS AND SOWS AND NEVER REAPS',
];

// English letter frequency, used for the reference chart. Percentages.
const LETTER_FREQ_EN: readonly [string, number][] = [
  ['E', 12.7], ['T', 9.1], ['A', 8.2], ['O', 7.5], ['I', 7.0], ['N', 6.7], ['S', 6.3], ['H', 6.1],
  ['R', 6.0], ['D', 4.3], ['L', 4.0], ['C', 2.8], ['U', 2.8], ['M', 2.4], ['W', 2.4],
];

function shuffleAlphabet(): Map<string, string> {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const target = [...letters];
  for (let i = target.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [target[i], target[j]] = [target[j], target[i]];
  }
  // Ensure no fixed points so every letter is genuinely disguised.
  for (let i = 0; i < 26; i++) {
    if (target[i] === letters[i]) {
      const j = (i + 1) % 26;
      [target[i], target[j]] = [target[j], target[i]];
    }
  }
  const map = new Map<string, string>();
  for (let i = 0; i < 26; i++) map.set(letters[i], target[i]);
  return map;
}

export class FrequencyAnalysisPuzzle extends Puzzle {
  readonly title = 'FREQUENCY ANALYSIS';
  readonly subtitle = 'al-Kindi’s craft';
  readonly instructions =
    'Match each cipher letter to its plaintext counterpart. The tallest bar is almost always E or T in English.';

  private plaintext!: string;
  private cipherMap!: Map<string, string>; // plaintext letter -> cipher symbol
  private reverseMap!: Map<string, string>; // cipher symbol -> plaintext
  private ciphertext!: string;
  private guessed = new Map<string, string>(); // cipher symbol -> player guess
  private selectedSymbol: string | null = null;
  private wrongCount = 0;

  private root: HTMLDivElement | null = null;
  private textEl: HTMLDivElement | null = null;
  private freqEl: HTMLDivElement | null = null;
  private refEl: HTMLDivElement | null = null;
  private pickerEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private wrongEl: HTMLDivElement | null = null;
  private symbolBtns = new Map<string, HTMLButtonElement>();
  private letterBtns = new Map<string, HTMLButtonElement>();

  onSolved?: () => void;

  init(): void {
    this.plaintext = PLAINTEXTS[Math.floor(Math.random() * PLAINTEXTS.length)];
    this.cipherMap = shuffleAlphabet();
    this.reverseMap = new Map();
    for (const [p, c] of this.cipherMap.entries()) this.reverseMap.set(c, p);
    this.ciphertext = this.plaintext
      .split('')
      .map((ch) => (this.cipherMap.get(ch) ?? ch))
      .join('');
    this.buildBackdrop();
    this.buildDom();
    this.refresh();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const tile = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#0f1a28'),
        roughness: 0.6,
        metalness: 0.2,
        side: DoubleSide,
      }),
    );
    tile.rotation.x = -Math.PI / 2;
    tile.position.y = -2.4;
    this.group.add(tile);

    // Geometric medallion — Islamic compass-rose nod.
    const medallion = new Mesh(
      new RingGeometry(3.1, 3.28, 8),
      new MeshStandardMaterial({
        color: new Color('#c9a94e'),
        emissive: new Color('#3a2a08'),
        emissiveIntensity: 0.55,
        roughness: 0.45,
        metalness: 0.85,
        side: DoubleSide,
      }),
    );
    medallion.rotation.x = -Math.PI / 2;
    medallion.position.y = -2.37;
    this.group.add(medallion);

    const lamp = new PointLight('#f5d590', 2.3, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-frequency';
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
      max-width:780px;
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
    title.textContent = 'FREQUENCY ANALYSIS';
    panel.appendChild(title);

    const wrong = document.createElement('div');
    wrong.style.cssText = `font-size:12px; letter-spacing:0.16em; opacity:0.75;`;
    this.wrongEl = wrong;
    panel.appendChild(wrong);

    // Ciphertext display.
    const textEl = document.createElement('div');
    textEl.style.cssText = `
      font-family:'Courier New', monospace; font-size:14px; line-height:1.8;
      letter-spacing:0.2em; text-align:center;
      padding:14px 18px;
      background:rgba(0,0,0,0.35); border-radius:6px;
      max-width:720px; word-break:break-word;
    `;
    this.textEl = textEl;
    panel.appendChild(textEl);

    // Frequency bars (bigger) and reference bars (smaller).
    const charts = document.createElement('div');
    charts.style.cssText = `
      display:flex; gap:28px; align-items:flex-end;
      padding:10px 0;
    `;
    panel.appendChild(charts);

    const freq = document.createElement('div');
    freq.style.cssText = `
      display:flex; gap:3px; align-items:flex-end; min-height:120px;
    `;
    this.freqEl = freq;
    charts.appendChild(freq);

    const ref = document.createElement('div');
    ref.style.cssText = `
      display:flex; gap:2px; align-items:flex-end; min-height:120px;
      padding-left:18px; border-left:1px dashed rgba(255,255,255,0.15);
    `;
    this.refEl = ref;
    charts.appendChild(ref);

    // Letter picker — 26 buttons.
    const picker = document.createElement('div');
    picker.style.cssText = `
      display:grid; grid-template-columns:repeat(13, 1fr); gap:4px;
      width:100%;
    `;
    this.pickerEl = picker;
    panel.appendChild(picker);

    const status = document.createElement('div');
    status.style.cssText = `font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;`;
    this.statusEl = status;
    panel.appendChild(status);

    this.buildFreqBars();
    this.buildRefBars();
    this.buildPicker();

    document.body.appendChild(root);
  }

  private buildFreqBars(): void {
    if (!this.freqEl) return;
    const counts = new Map<string, number>();
    for (const ch of this.ciphertext) {
      if (/[A-Z]/.test(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const max = sorted[0]?.[1] ?? 1;
    for (const [sym, n] of sorted) {
      const bar = document.createElement('button');
      bar.type = 'button';
      const h = Math.max(8, Math.round((n / max) * 110));
      bar.style.cssText = `
        width:28px; height:${h + 24}px;
        display:flex; flex-direction:column; align-items:center; justify-content:flex-end;
        padding:0;
        background:transparent; border:none; cursor:pointer;
        color:#e6eefb; font-family:inherit;
      `;
      const rect = document.createElement('div');
      rect.style.cssText = `
        width:26px; height:${h}px;
        background:rgba(201,169,78,0.7); border:1px solid rgba(201,169,78,0.9);
        border-radius:3px 3px 0 0;
      `;
      const label = document.createElement('div');
      label.style.cssText = `font-size:12px; letter-spacing:0.08em; margin-top:3px; font-weight:600;`;
      label.textContent = sym;
      bar.appendChild(rect);
      bar.appendChild(label);
      bar.addEventListener('click', () => this.selectSymbol(sym));
      this.freqEl.appendChild(bar);
      this.symbolBtns.set(sym, bar);
    }
  }

  private buildRefBars(): void {
    if (!this.refEl) return;
    const max = LETTER_FREQ_EN[0][1];
    for (const [letter, pct] of LETTER_FREQ_EN) {
      const col = document.createElement('div');
      col.style.cssText = `width:14px; display:flex; flex-direction:column; align-items:center;`;
      const h = Math.max(6, Math.round((pct / max) * 90));
      const rect = document.createElement('div');
      rect.style.cssText = `
        width:12px; height:${h}px;
        background:rgba(159,200,255,0.35); border-radius:2px 2px 0 0;
      `;
      const label = document.createElement('div');
      label.style.cssText = `font-size:10px; opacity:0.6; margin-top:2px;`;
      label.textContent = letter;
      col.appendChild(rect);
      col.appendChild(label);
      this.refEl.appendChild(col);
    }
    const caption = document.createElement('div');
    caption.style.cssText = `font-size:10px; opacity:0.5; letter-spacing:0.12em; align-self:flex-end; margin-left:8px;`;
    caption.textContent = 'ENGLISH';
    this.refEl.appendChild(caption);
  }

  private buildPicker(): void {
    if (!this.pickerEl) return;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    for (const L of letters) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = L;
      b.style.cssText = `
        padding:8px 0;
        background:rgba(159,200,255,0.08);
        border:1px solid rgba(159,200,255,0.3);
        color:#e6eefb;
        font-family:'Cormorant Garamond', Georgia, serif;
        font-size:15px; font-weight:600;
        border-radius:4px; cursor:pointer;
      `;
      b.addEventListener('click', () => this.guessLetter(L));
      this.pickerEl.appendChild(b);
      this.letterBtns.set(L, b);
    }
  }

  /* ------------------------------ Input ---------------------------------- */

  private selectSymbol(sym: string): void {
    if (this.isSolved) return;
    if (this.guessed.has(sym)) return;
    this.selectedSymbol = this.selectedSymbol === sym ? null : sym;
    this.refresh();
  }

  private guessLetter(L: string): void {
    if (this.isSolved) return;
    if (!this.selectedSymbol) return;
    // Disallow letters already mapped elsewhere.
    for (const v of this.guessed.values()) if (v === L) return;
    const correct = this.reverseMap.get(this.selectedSymbol);
    if (L === correct) {
      this.guessed.set(this.selectedSymbol, L);
      this.selectedSymbol = null;
      this.refresh();
      this.checkSolved();
    } else {
      this.wrongCount++;
      if (this.statusEl) {
        this.statusEl.textContent = `${L} doesn't match — ${MAX_WRONG - this.wrongCount} errors left`;
        this.statusEl.style.color = '#e89090';
      }
      if (this.wrongCount >= MAX_WRONG) {
        this.failRound();
        return;
      }
      // Brief visual flash on the letter button.
      const btn = this.letterBtns.get(L);
      if (btn) {
        const prev = btn.style.background;
        btn.style.background = 'rgba(220,100,100,0.3)';
        setTimeout(() => {
          btn.style.background = prev;
        }, 400);
      }
    }
  }

  private failRound(): void {
    // Reveal the full cipher to teach the lesson, then restart after a beat.
    if (this.statusEl) {
      this.statusEl.textContent = 'too many errors — the scribe shakes her head';
      this.statusEl.style.color = '#e89090';
    }
    setTimeout(() => this.resetRound(), 1800);
  }

  private resetRound(): void {
    this.guessed.clear();
    this.wrongCount = 0;
    this.selectedSymbol = null;
    // Optional: reshuffle the cipher so brute memorisation isn't possible.
    this.cipherMap = shuffleAlphabet();
    this.reverseMap.clear();
    for (const [p, c] of this.cipherMap.entries()) this.reverseMap.set(c, p);
    this.ciphertext = this.plaintext
      .split('')
      .map((ch) => (this.cipherMap.get(ch) ?? ch))
      .join('');
    // Rebuild bars with the new frequency ordering.
    if (this.freqEl) this.freqEl.innerHTML = '';
    this.symbolBtns.clear();
    this.buildFreqBars();
    this.refresh();
  }

  /* ------------------------------ Render --------------------------------- */

  private refresh(): void {
    if (this.textEl) {
      const parts: string[] = [];
      for (const ch of this.ciphertext) {
        if (!/[A-Z]/.test(ch)) {
          parts.push(`<span style="opacity:0.45">${ch}</span>`);
          continue;
        }
        const guess = this.guessed.get(ch);
        if (guess) {
          parts.push(`<span style="color:#f3e7c8; font-weight:600">${guess}</span>`);
        } else if (ch === this.selectedSymbol) {
          parts.push(`<span style="color:var(--era-accent); text-decoration:underline">${ch}</span>`);
        } else {
          parts.push(`<span>${ch}</span>`);
        }
      }
      this.textEl.innerHTML = parts.join('');
    }
    if (this.wrongEl) {
      this.wrongEl.textContent = `DECODED  ${this.guessed.size}  ·  ERRORS  ${this.wrongCount} / ${MAX_WRONG}`;
    }
    // Symbol button state.
    for (const [sym, btn] of this.symbolBtns.entries()) {
      const solved = this.guessed.has(sym);
      const sel = this.selectedSymbol === sym;
      const rect = btn.firstChild as HTMLDivElement | null;
      if (rect) {
        rect.style.background = solved
          ? 'rgba(120,200,150,0.6)'
          : sel
            ? 'rgba(245,214,144,0.85)'
            : 'rgba(201,169,78,0.55)';
        rect.style.borderColor = sel ? 'var(--era-accent)' : 'rgba(201,169,78,0.9)';
      }
      btn.style.cursor = solved ? 'default' : 'pointer';
      btn.style.opacity = solved ? '0.5' : '1';
    }
    // Letter button state — dim letters already used.
    const used = new Set([...this.guessed.values()]);
    for (const [L, btn] of this.letterBtns.entries()) {
      const dim = used.has(L);
      btn.style.opacity = dim ? '0.28' : '1';
      btn.style.cursor = dim ? 'default' : 'pointer';
    }
    if (this.statusEl && !this.isSolved && this.wrongCount < MAX_WRONG) {
      if (this.selectedSymbol) {
        this.statusEl.textContent = `pick the plaintext letter for ${this.selectedSymbol}`;
        this.statusEl.style.color = '';
      } else {
        this.statusEl.textContent = 'tap a bar to choose a symbol';
        this.statusEl.style.color = '';
      }
    }
  }

  private checkSolved(): void {
    // Solved when every unique cipher symbol in the ciphertext is mapped.
    const unique = new Set<string>();
    for (const ch of this.ciphertext) if (/[A-Z]/.test(ch)) unique.add(ch);
    for (const sym of unique) if (!this.guessed.has(sym)) return;
    this.isSolved = true;
    if (this.statusEl) {
      this.statusEl.textContent = 'THE CIPHER UNFURLS — AL-KINDI WOULD APPROVE';
      this.statusEl.style.color = '#9fe0a6';
    }
    setTimeout(() => this.onSolved?.(), 900);
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
    this.textEl = null;
    this.freqEl = null;
    this.refEl = null;
    this.pickerEl = null;
    this.statusEl = null;
    this.wrongEl = null;
    this.symbolBtns.clear();
    this.letterBtns.clear();
    this.guessed.clear();
    super.dispose();
  }
}
