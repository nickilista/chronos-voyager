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
 * Al-Kindi's Frequency Analysis Puzzle
 * Al-Kindi (801-873 CE) wrote the first known treatise on cryptanalysis,
 * inventing frequency analysis to break substitution ciphers.
 * The player deciphers encrypted text by matching symbol frequencies
 * to known English letter frequencies.
 *
 * Aligned with the iOS FrequencyAnalysisView.swift implementation:
 *   - Cipher uses geometric symbols (not letter-to-letter)
 *   - Multi-level difficulty with pre-revealed letters
 *   - Frequency chart with clickable symbol rows
 *   - Letter picker grid (9 columns)
 *   - Language frequency reference bar chart
 *   - Wrong guess limit per level
 *   - Islamic golden age color theme
 */

/* ── Colors (Islamic aesthetic, matches iOS) ─────────────────────── */

const C_GOLD = '#C4A44A';
const C_GOLD_BRIGHT = '#E8D48B';
const C_TEAL = '#1B8A6B';
const C_CREAM = '#F4E4BC';
const C_ERROR_RED = '#E74C3C';
const C_SUCCESS_GREEN = '#00B894';

/* ── Cipher Symbols (Islamic geometric aesthetic) ────────────────── */

const ALL_SYMBOLS: string[] = Array.from('✦◆⬡★●◈◇■△⊕☽◎⬢♦▲◐✧⊗□⊙○▽◑♢✶⬟');

/* ── Level Configuration ─────────────────────────────────────────── */

interface LevelConfig {
  plaintext: string;
  preRevealed: Set<string>;
  maxWrong: number;
  showReference: boolean;
}

const LEVELS: LevelConfig[] = [
  {
    plaintext: 'THERE IS A SECRET HIDDEN IN EVERY WRITTEN MESSAGE AND THE WISE SCHOLAR CAN LEARN TO REVEAL IT',
    preRevealed: new Set(['G', 'Y', 'M', 'W', 'O']),
    maxWrong: 12,
    showReference: true,
  },
  {
    plaintext: 'THOSE WHO STUDY THE SCIENCE OF LETTERS DISCOVER THAT EACH LANGUAGE HAS ITS OWN PATTERN OF SOUNDS AND SIGNS THAT REVEAL ITS SECRETS',
    preRevealed: new Set(['P', 'Y']),
    maxWrong: 9,
    showReference: true,
  },
  {
    plaintext: 'THE ANCIENT SCHOLARS OF THE HOUSE OF WISDOM LEARNED THAT THE HIDDEN ORDER OF LETTERS IN ANY LANGUAGE IS A TREASURE THAT CAN NEVER BE LOST OR STOLEN',
    preRevealed: new Set<string>(),
    maxWrong: 7,
    showReference: true,
  },
  {
    plaintext: 'KNOWLEDGE OF THE SECRET PATTERNS WITHIN LANGUAGE IS THE GREATEST TREASURE FOR THOSE WHO LEARN THIS ART CAN READ MESSAGES THAT OTHERS CANNOT UNDERSTAND AND SHARE THEIR WISDOM WITH THE WORLD',
    preRevealed: new Set<string>(),
    maxWrong: 5,
    showReference: true,
  },
  {
    plaintext: 'IN THE GREAT HOUSE OF WISDOM THE SCHOLARS GATHERED TO TRANSLATE AND PRESERVE THE ANCIENT KNOWLEDGE OF EVERY CIVILIZATION FOR WITHIN THOSE WRITTEN TREASURES THEY FOUND THE HIDDEN PATTERNS THAT CONNECT ALL LANGUAGES AND REVEAL THE SECRETS OF THE UNIVERSE',
    preRevealed: new Set<string>(),
    maxWrong: 4,
    showReference: false,
  },
];

/* ── English letter frequency reference (top 14) ─────────────────── */

const LETTER_FREQ_EN: readonly [string, number][] = [
  ['E', 12.7], ['T', 9.1], ['A', 8.2], ['O', 7.5], ['I', 7.0],
  ['N', 6.7], ['S', 6.3], ['H', 6.1], ['R', 6.0], ['D', 4.3],
  ['L', 4.0], ['C', 2.8], ['U', 2.8], ['M', 2.4],
];

/* ── Puzzle class ────────────────────────────────────────────────── */

export class FrequencyAnalysisPuzzle extends Puzzle {
  readonly title = 'FREQUENCY ANALYSIS';
  readonly subtitle = "al-Kindi's cipher craft";
  readonly instructions =
    'Tap a symbol in the frequency chart, then pick the letter you think it represents. Use the frequency reference to guide your guesses.';

  private level = 4; // 0-indexed (max difficulty)
  private config!: LevelConfig;

  // Cipher state
  private cipherMap = new Map<string, string>(); // plainLetter -> symbol
  private reverseMap = new Map<string, string>(); // symbol -> plainLetter
  private decodedSymbols = new Map<string, string>(); // symbol -> confirmedLetter
  private selectedSymbol: string | null = null;
  private wrongGuesses = 0;
  private flashWrongSymbol: string | null = null;
  private solved = false;
  private processing = false;

  // DOM
  private root: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private textEl: HTMLDivElement | null = null;
  private progressEl: HTMLDivElement | null = null;
  private freqChartEl: HTMLDivElement | null = null;
  private pickerEl: HTMLDivElement | null = null;
  private referenceEl: HTMLDivElement | null = null;
  private successEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.config = LEVELS[Math.min(this.level, LEVELS.length - 1)];
    this.buildBackdrop();
    this.buildDom();
    this.generateCipher();
    this.refresh();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color('#0f1a28'), roughness: 0.6, metalness: 0.2, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    // Islamic compass-rose medallion
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

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-frequency';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
      pointerEvents: 'auto', padding: '18px 22px',
      maxWidth: '640px', width: '92%', maxHeight: '96vh', overflowY: 'auto',
      background: 'rgba(22,33,62,0.92)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(196,164,74,0.25)', borderTop: `3px solid ${C_GOLD}`,
      borderRadius: '12px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_CREAM,
    });
    root.appendChild(panel);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '15px', letterSpacing: '0.22em', color: C_GOLD, fontWeight: '700' });
    title.textContent = 'FREQUENCY ANALYSIS';
    panel.appendChild(title);

    // Encrypted text section
    this.textEl = document.createElement('div');
    Object.assign(this.textEl.style, {
      fontFamily: "'Courier New', monospace", fontSize: '15px', lineHeight: '2.0',
      textAlign: 'center', padding: '14px 16px', width: '100%',
      background: `rgba(22,33,62,0.5)`, borderRadius: '12px',
      border: `1px solid ${C_GOLD}33`, wordBreak: 'break-word',
    });
    panel.appendChild(this.textEl);

    // Progress section
    this.progressEl = document.createElement('div');
    Object.assign(this.progressEl.style, {
      display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '0 4px',
    });
    panel.appendChild(this.progressEl);

    // Frequency chart section
    this.freqChartEl = document.createElement('div');
    Object.assign(this.freqChartEl.style, {
      width: '100%', padding: '12px',
      background: 'rgba(255,255,255,0.03)', borderRadius: '10px',
      border: `1px solid ${C_TEAL}26`,
    });
    panel.appendChild(this.freqChartEl);

    // Letter picker section (hidden until symbol selected)
    this.pickerEl = document.createElement('div');
    Object.assign(this.pickerEl.style, {
      width: '100%', padding: '12px', display: 'none',
      background: `${C_TEAL}0a`, borderRadius: '10px',
      border: `1px solid ${C_GOLD}26`,
    });
    panel.appendChild(this.pickerEl);

    // Reference section
    this.referenceEl = document.createElement('div');
    Object.assign(this.referenceEl.style, {
      width: '100%', padding: '10px',
      background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
      border: `0.5px solid ${C_CREAM}10`,
    });
    panel.appendChild(this.referenceEl);

    // Success section
    this.successEl = document.createElement('div');
    Object.assign(this.successEl.style, {
      display: 'none', flexDirection: 'column', alignItems: 'center', gap: '8px',
    });
    panel.appendChild(this.successEl);

    // Overlay for dialogs
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    document.body.appendChild(root);

    // Inject animation keyframe
    if (!document.getElementById('freq-anims')) {
      const style = document.createElement('style');
      style.id = 'freq-anims';
      style.textContent = `
        @keyframes freq-pop { from { transform: scale(0.92); opacity:0; } to { transform: scale(1); opacity:1; } }
        @keyframes freq-flash { 0%,100% { background: transparent; } 50% { background: ${C_ERROR_RED}33; } }
      `;
      document.head.appendChild(style);
    }
  }

  /* ═══════════════════ Cipher generation ═════════════════════════ */

  private generateCipher(): void {
    const letters = Array.from(new Set(this.config.plaintext.split('').filter(ch => /[A-Z]/.test(ch)))).sort();
    const symbols = [...ALL_SYMBOLS].sort(() => Math.random() - 0.5);

    this.cipherMap.clear();
    this.reverseMap.clear();
    this.decodedSymbols.clear();
    this.wrongGuesses = 0;
    this.selectedSymbol = null;
    this.solved = false;
    this.processing = false;

    for (let i = 0; i < letters.length && i < symbols.length; i++) {
      this.cipherMap.set(letters[i], symbols[i]);
      this.reverseMap.set(symbols[i], letters[i]);
    }

    // Pre-reveal letters
    for (const letter of this.config.preRevealed) {
      const sym = this.cipherMap.get(letter);
      if (sym) {
        this.decodedSymbols.set(sym, letter);
      }
    }
  }

  /* ═══════════════════ Computed properties ═══════════════════════ */

  private get decodedLetters(): Set<string> {
    const result = new Set(this.config.preRevealed);
    for (const letter of this.decodedSymbols.values()) {
      result.add(letter);
    }
    return result;
  }

  private get uniqueLetterCount(): number {
    return new Set(this.config.plaintext.split('').filter(ch => /[A-Z]/.test(ch))).size;
  }

  private get symbolsByFrequency(): { symbol: string; count: number }[] {
    const freq = new Map<string, number>();
    for (const ch of this.config.plaintext) {
      if (/[A-Z]/.test(ch)) {
        const sym = this.cipherMap.get(ch);
        if (sym) freq.set(sym, (freq.get(sym) ?? 0) + 1);
      }
    }
    return [...freq.entries()]
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((a, b) => b.count - a.count);
  }

  private get maxFrequency(): number {
    const syms = this.symbolsByFrequency;
    return syms.length > 0 ? syms[0].count : 1;
  }

  private get allDecoded(): boolean {
    return this.decodedLetters.size >= this.uniqueLetterCount;
  }

  private get lettersInPlaintext(): Set<string> {
    return new Set(this.config.plaintext.split('').filter(ch => /[A-Z]/.test(ch)));
  }

  /* ═══════════════════ Rendering ═════════════════════════════════ */

  private refresh(): void {
    this.renderEncryptedText();
    this.renderProgress();
    this.renderFrequencyChart();
    this.renderLetterPicker();
    this.renderReference();
    this.renderSuccess();
  }

  private renderEncryptedText(): void {
    if (!this.textEl) return;
    const decoded = this.decodedLetters;
    const parts: string[] = [];

    for (const ch of this.config.plaintext) {
      if (ch === ' ') {
        parts.push('<span style="margin:0 3px"> </span>');
        continue;
      }
      if (!/[A-Z]/.test(ch)) {
        parts.push(`<span style="color:${C_CREAM}4d">${ch}</span>`);
        continue;
      }

      if (decoded.has(ch)) {
        const isPreRevealed = this.config.preRevealed.has(ch);
        const color = isPreRevealed ? C_GOLD_BRIGHT : C_GOLD;
        const weight = isPreRevealed ? '700' : '600';
        parts.push(`<span style="color:${color};font-weight:${weight};font-size:17px">${ch}</span>`);
      } else {
        const sym = this.cipherMap.get(ch);
        if (sym) {
          const isSelected = this.selectedSymbol === sym;
          const isWrong = this.flashWrongSymbol === sym;
          const color = isWrong ? C_ERROR_RED : isSelected ? C_GOLD_BRIGHT : `${C_TEAL}b3`;
          parts.push(`<span style="color:${color};font-size:15px;font-weight:500;cursor:pointer" data-sym="${sym}">${sym}</span>`);
        } else {
          parts.push(`<span style="color:gray">?</span>`);
        }
      }
    }
    this.textEl.innerHTML = parts.join('');

    // Add click handlers for symbols in text
    this.textEl.querySelectorAll('[data-sym]').forEach(el => {
      el.addEventListener('click', () => {
        const sym = (el as HTMLElement).dataset.sym!;
        this.selectSymbol(sym);
      });
    });
  }

  private renderProgress(): void {
    if (!this.progressEl) return;
    const decoded = this.decodedLetters.size;
    const total = this.uniqueLetterCount;
    const progress = decoded / Math.max(total, 1);
    const wrongRatio = this.wrongGuesses / this.config.maxWrong;
    const wrongColor = wrongRatio > 0.5 ? C_ERROR_RED : `${C_CREAM}66`;

    this.progressEl.innerHTML = `
      <span style="font-size:12px;font-weight:700;font-family:monospace;color:${C_GOLD}">${decoded}/${total}</span>
      <div style="flex:1;height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
        <div style="width:${progress * 100}%;height:100%;background:linear-gradient(to right,${C_TEAL},${C_GOLD});opacity:0.7;border-radius:3px;transition:width 0.3s"></div>
      </div>
      <span style="font-size:11px;font-weight:500;font-family:monospace;color:${wrongColor}">✕ ${this.wrongGuesses}/${this.config.maxWrong}</span>
    `;
  }

  private renderFrequencyChart(): void {
    if (!this.freqChartEl) return;
    const syms = this.symbolsByFrequency;
    const maxF = this.maxFrequency;

    let html = `<div style="font-size:11px;font-weight:500;color:${C_CREAM}66;text-align:center;margin-bottom:6px">SYMBOL FREQUENCY</div>`;
    html += '<div style="display:flex;flex-direction:column;gap:2px">';

    for (const { symbol, count } of syms) {
      const trueLetter = this.reverseMap.get(symbol) ?? '?';
      const isPreRevealed = this.config.preRevealed.has(trueLetter);
      const isDecoded = this.decodedSymbols.has(symbol) || isPreRevealed;
      const isSelected = this.selectedSymbol === symbol;
      const isWrong = this.flashWrongSymbol === symbol;

      const barWidth = Math.max(2, (count / Math.max(maxF, 1)) * 100);
      const barColor = isDecoded ? `${C_GOLD}80` : isWrong ? `${C_ERROR_RED}99` : isSelected ? `${C_GOLD_BRIGHT}99` : `${C_TEAL}66`;
      const bgColor = isSelected ? `${C_GOLD}14` : 'transparent';
      const borderColor = isSelected ? `${C_GOLD}4d` : 'transparent';
      const cursor = isDecoded || this.solved ? 'default' : 'pointer';
      const opacity = isDecoded ? '0.7' : '1';

      const mappedLabel = isDecoded
        ? `<span style="font-size:14px;font-weight:700;font-family:monospace;color:${C_GOLD};width:22px;text-align:center">${trueLetter}</span>`
        : `<span style="font-size:14px;font-weight:500;font-family:monospace;color:${isSelected ? C_GOLD_BRIGHT : C_CREAM + '33'};width:22px;text-align:center">${isSelected ? '?' : '\u00B7'}</span>`;

      html += `
        <div class="freq-row" data-sym="${symbol}" style="
          display:flex;align-items:center;gap:6px;padding:4px 8px;
          background:${bgColor};border:1px solid ${borderColor};border-radius:6px;
          cursor:${cursor};opacity:${opacity};transition:background 0.15s
        ">
          <span style="font-size:16px;width:24px;text-align:center">${symbol}</span>
          <div style="flex:1;height:14px;position:relative">
            <div style="width:${barWidth}%;height:100%;background:${barColor};border-radius:2px;min-width:2px"></div>
          </div>
          <span style="font-size:11px;font-weight:500;font-family:monospace;color:${C_CREAM}80;width:20px;text-align:right">${count}</span>
          <span style="font-size:10px;color:${C_CREAM}33">\u2192</span>
          ${mappedLabel}
        </div>
      `;
    }
    html += '</div>';
    this.freqChartEl.innerHTML = html;

    // Add click handlers for frequency rows
    this.freqChartEl.querySelectorAll('.freq-row').forEach(el => {
      el.addEventListener('click', () => {
        const sym = (el as HTMLElement).dataset.sym!;
        const trueLetter = this.reverseMap.get(sym) ?? '?';
        const isPreRevealed = this.config.preRevealed.has(trueLetter);
        const isDecoded = this.decodedSymbols.has(sym) || isPreRevealed;
        if (!isDecoded && !this.solved) {
          this.selectSymbol(sym);
        }
      });
    });
  }

  private renderLetterPicker(): void {
    if (!this.pickerEl) return;

    if (!this.selectedSymbol || this.solved) {
      this.pickerEl.style.display = 'none';
      return;
    }
    this.pickerEl.style.display = 'block';

    const decoded = this.decodedLetters;
    const inText = this.lettersInPlaintext;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    let html = `<div style="font-size:11px;font-weight:500;color:${C_CREAM}66;text-align:center;margin-bottom:8px">ASSIGN LETTER</div>`;
    html += '<div style="display:grid;grid-template-columns:repeat(9,1fr);gap:4px">';

    for (const letter of alphabet) {
      const isInText = inText.has(letter);
      const isDecoded = decoded.has(letter);
      const isAvailable = isInText && !isDecoded;

      const textColor = !isInText ? `${C_CREAM}10` : isDecoded ? `${C_GOLD}59` : C_CREAM;
      const bgColor = !isInText ? 'transparent' : isDecoded ? `${C_GOLD}0a` : `${C_TEAL}26`;
      const borderColor = !isInText ? 'transparent' : isDecoded ? `${C_GOLD}1a` : `${C_TEAL}4d`;
      const cursor = isAvailable ? 'pointer' : 'default';

      html += `
        <button type="button" class="letter-btn" data-letter="${letter}" ${!isAvailable ? 'disabled' : ''} style="
          width:100%;height:34px;border:1px solid ${borderColor};background:${bgColor};
          color:${textColor};font-family:'Rajdhani',system-ui,sans-serif;font-size:15px;font-weight:600;
          border-radius:6px;cursor:${cursor};position:relative;
        ">
          ${!isInText ? `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span style="width:16px;height:1px;background:${C_CREAM}10"></span></span>` : letter}
        </button>
      `;
    }
    html += '</div>';
    this.pickerEl.innerHTML = html;

    // Add click handlers
    this.pickerEl.querySelectorAll('.letter-btn:not([disabled])').forEach(el => {
      el.addEventListener('click', () => {
        const letter = (el as HTMLElement).dataset.letter!;
        this.handleLetterTap(letter);
      });
    });
  }

  private renderReference(): void {
    if (!this.referenceEl) return;

    if (!this.config.showReference) {
      this.referenceEl.style.display = 'none';
      return;
    }
    this.referenceEl.style.display = 'block';

    let html = `<div style="font-size:10px;font-weight:500;color:${C_CREAM}4d;text-align:center;margin-bottom:4px">ENGLISH LETTER FREQUENCY</div>`;
    html += '<div style="display:flex;align-items:flex-end;height:45px">';

    for (const [letter, pct] of LETTER_FREQ_EN) {
      const h = pct * 2.2;
      html += `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
          <div style="width:6px;height:${h}px;background:${C_CREAM}26;border-radius:1px"></div>
          <span style="font-size:9px;font-weight:700;font-family:monospace;color:${C_CREAM}73;margin-top:2px">${letter}</span>
        </div>
      `;
    }
    html += '</div>';
    this.referenceEl.innerHTML = html;
  }

  private renderSuccess(): void {
    if (!this.successEl) return;

    if (!this.solved) {
      this.successEl.style.display = 'none';
      return;
    }
    this.successEl.style.display = 'flex';

    // 8-pointed star victory badge (Islamic geometric pattern) drawn via canvas
    this.successEl.innerHTML = `
      <canvas id="freq-victory-badge" width="112" height="112" style="width:56px;height:56px"></canvas>
      <div style="font-size:16px;font-weight:700;color:${C_SUCCESS_GREEN}">MESSAGE DECIPHERED</div>
      <div style="font-size:12px;font-weight:500;color:${C_CREAM}99;text-align:center">
        Al-Kindi's frequency analysis triumphs once more.
      </div>
    `;

    // Draw the 8-pointed star
    const canvas = document.getElementById('freq-victory-badge') as HTMLCanvasElement | null;
    if (canvas) {
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);
      const cx = 28, cy = 28;

      // Star path
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const outerAngle = (i * Math.PI) / 4 - Math.PI / 2;
        const innerAngle = outerAngle + Math.PI / 8;
        const ox = cx + Math.cos(outerAngle) * 26;
        const oy = cy + Math.sin(outerAngle) * 26;
        const ix = cx + Math.cos(innerAngle) * 15;
        const iy = cy + Math.sin(innerAngle) * 15;
        if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
        ctx.lineTo(ix, iy);
      }
      ctx.closePath();
      ctx.fillStyle = '#C8A432';
      ctx.fill();
      ctx.strokeStyle = '#8B7023';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Checkmark
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy);
      ctx.lineTo(cx - 2, cy + 7);
      ctx.lineTo(cx + 10, cy - 7);
      ctx.strokeStyle = '#1A1408';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }

  /* ═══════════════════ Input handling ════════════════════════════ */

  private selectSymbol(sym: string): void {
    if (this.solved || this.processing) return;
    if (this.decodedSymbols.has(sym)) return;
    this.selectedSymbol = this.selectedSymbol === sym ? null : sym;
    this.refresh();
  }

  private handleLetterTap(letter: string): void {
    if (!this.selectedSymbol || this.processing || this.solved) return;
    const trueLetter = this.reverseMap.get(this.selectedSymbol);

    if (trueLetter === letter) {
      // Correct!
      this.decodedSymbols.set(this.selectedSymbol, letter);
      this.selectedSymbol = null;
      this.refresh();

      if (this.allDecoded) {
        this.processing = true;
        setTimeout(() => {
          this.solved = true;
          this.refresh();
          setTimeout(() => {
            this.isSolved = true;
            this.onSolved?.();
          }, 1200);
        }, 300);
      }
    } else {
      // Wrong guess
      this.wrongGuesses++;
      this.flashWrongSymbol = this.selectedSymbol;
      this.refresh();

      setTimeout(() => {
        this.flashWrongSymbol = null;
        this.refresh();
      }, 500);

      if (this.wrongGuesses >= this.config.maxWrong) {
        // Failed — reset the round
        this.processing = true;
        setTimeout(() => this.resetRound(), 800);
      }
    }
  }

  private resetRound(): void {
    this.generateCipher();
    this.refresh();
  }

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('freq-anims');
    if (animStyle) animStyle.remove();
    this.textEl = null;
    this.progressEl = null;
    this.freqChartEl = null;
    this.pickerEl = null;
    this.referenceEl = null;
    this.successEl = null;
    this.overlayEl = null;
    this.cipherMap.clear();
    this.reverseMap.clear();
    this.decodedSymbols.clear();
    super.dispose();
  }
}
