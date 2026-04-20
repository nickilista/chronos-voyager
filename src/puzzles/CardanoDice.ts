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
 * Cardano Dice — Renaissance probability puzzle.
 * The player calculates the probability of dice outcomes.
 * Difficulty levels 1-5 control number of dice and complexity.
 * Aligned with the iOS CardanoProbabilityView implementation.
 */

/* ── Renaissance Italian Colors ──────────────────────────────────── */

const C_MARBLE_LIGHT = '#F0EDE8';
const C_MARBLE_MID = '#E2DDD5';
const C_MARBLE_DARK = '#D4CFC6';
const C_MEDICI_RED = '#8B1A1A';
const C_LAPIS_BLUE = '#1F3A6E';
const C_FLO_GOLD = '#C5972C';
const C_INK_BROWN = '#3B2414';
const C_WARM_IVORY = '#FAF6EF';
const C_SUCCESS_GLOW = '#D4AF37';
const C_DIE_IVORY = '#F5F0E6';
const C_DIE_BORDER = '#5C4A3A';
const C_VEIN = '#C8BDA8';

/* ── Scenario interface ──────────────────────────────────────────── */

interface Scenario {
  question: string;
  correct: string;
  distractors: string[];
  exampleDice: number[];
}

/* ── Puzzle generation (all 5 levels from iOS) ───────────────────── */

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateLevel1(): Scenario {
  const scenarios: (() => Scenario)[] = [
    () => {
      const target = randInt(1, 6);
      return { question: `What is the probability of rolling exactly a ${target}?`, correct: '1/6', distractors: ['1/3', '1/2', '1/4'], exampleDice: [target] };
    },
    () => ({ question: 'What is the probability of rolling an even number?', correct: '1/2', distractors: ['1/3', '1/6', '2/3'], exampleDice: [pickRandom([2, 4, 6])] }),
    () => ({ question: 'What is the probability of rolling an odd number?', correct: '1/2', distractors: ['1/3', '1/6', '2/3'], exampleDice: [pickRandom([1, 3, 5])] }),
    () => ({ question: 'What is the probability of rolling less than 3?', correct: '1/3', distractors: ['1/6', '1/2', '2/3'], exampleDice: [pickRandom([1, 2])] }),
    () => ({ question: 'What is the probability of rolling greater than 4?', correct: '1/3', distractors: ['1/6', '1/2', '2/3'], exampleDice: [pickRandom([5, 6])] }),
  ];
  return pickRandom(scenarios)();
}

function generateLevel2(): Scenario {
  const scenarios: (() => Scenario)[] = [
    () => ({ question: 'What is the probability of rolling 4 or higher?', correct: '1/2', distractors: ['1/3', '2/3', '1/6'], exampleDice: [pickRandom([4, 5, 6])] }),
    () => ({ question: 'What is the probability of rolling 2 or less?', correct: '1/3', distractors: ['1/6', '1/2', '2/3'], exampleDice: [pickRandom([1, 2])] }),
    () => ({ question: 'What is the probability of rolling a prime number?', correct: '1/2', distractors: ['1/3', '2/3', '1/6'], exampleDice: [pickRandom([2, 3, 5])] }),
    () => ({ question: 'What is the probability of rolling a multiple of 3?', correct: '1/3', distractors: ['1/6', '1/2', '2/3'], exampleDice: [pickRandom([3, 6])] }),
    () => ({ question: 'What is the probability of NOT rolling a 6?', correct: '5/6', distractors: ['1/6', '2/3', '4/6'], exampleDice: [randInt(1, 5)] }),
  ];
  return pickRandom(scenarios)();
}

function generateLevel3(): Scenario {
  const scenarios: (() => Scenario)[] = [
    () => ({ question: 'Two dice — probability the sum equals 7?', correct: '1/6', distractors: ['1/9', '5/36', '1/4'], exampleDice: [3, 4] }),
    () => ({ question: 'Two dice — probability the sum equals 2?', correct: '1/36', distractors: ['1/18', '1/6', '1/12'], exampleDice: [1, 1] }),
    () => ({ question: 'Two dice — probability the sum equals 12?', correct: '1/36', distractors: ['1/18', '1/12', '1/6'], exampleDice: [6, 6] }),
    () => ({ question: 'Two dice — probability the sum is 10 or more?', correct: '1/6', distractors: ['1/4', '1/9', '1/12'], exampleDice: [5, 6] }),
    () => ({ question: 'Two dice — probability the sum equals 6?', correct: '5/36', distractors: ['1/6', '1/9', '1/12'], exampleDice: [2, 4] }),
  ];
  return pickRandom(scenarios)();
}

function generateLevel4(): Scenario {
  const d = randInt(1, 6);
  const scenarios: (() => Scenario)[] = [
    () => ({ question: 'Two dice — probability of a double?', correct: '1/6', distractors: ['1/12', '1/3', '1/4'], exampleDice: [d, d] }),
    () => ({ question: 'Two dice — probability the product is 20 or more?', correct: '2/9', distractors: ['1/6', '1/4', '5/36'], exampleDice: [5, 6] }),
    () => ({ question: 'Two dice — probability at least one die shows 6?', correct: '11/36', distractors: ['1/6', '1/3', '10/36'], exampleDice: [6, 3] }),
    () => ({ question: 'Two dice — probability the difference is 0?', correct: '1/6', distractors: ['1/12', '5/36', '1/3'], exampleDice: [4, 4] }),
    () => ({ question: 'Two dice — probability both are even?', correct: '1/4', distractors: ['1/6', '1/3', '1/2'], exampleDice: [2, 4] }),
  ];
  return pickRandom(scenarios)();
}

function generateLevel5(): Scenario {
  const t = randInt(1, 6);
  const scenarios: (() => Scenario)[] = [
    () => ({ question: 'Three dice — probability all three show the same face?', correct: '1/36', distractors: ['1/216', '1/18', '1/6'], exampleDice: [t, t, t] }),
    () => ({ question: 'Three dice — probability the sum equals 10?', correct: '1/8', distractors: ['1/6', '5/36', '1/12'], exampleDice: [2, 3, 5] }),
    () => ({ question: 'Three dice — probability at least two dice show 6?', correct: '2/27', distractors: ['1/36', '1/12', '5/108'], exampleDice: [6, 6, 2] }),
    () => ({ question: 'Three dice — probability all three are different?', correct: '5/9', distractors: ['1/2', '2/3', '4/9'], exampleDice: [1, 4, 6] }),
    () => ({ question: 'Three dice — probability the sum is 16 or more?', correct: '5/108', distractors: ['1/36', '1/18', '1/27'], exampleDice: [5, 5, 6] }),
  ];
  return pickRandom(scenarios)();
}

function generateScenario(level: number): Scenario {
  switch (level) {
    case 1: return generateLevel1();
    case 2: return generateLevel2();
    case 3: return generateLevel3();
    case 4: return generateLevel4();
    case 5: return generateLevel5();
    default: return generateLevel5();
  }
}

/* ── Dice count per level (matches iOS) ──────────────────────────── */

function diceCountForLevel(level: number): number {
  if (level <= 2) return 1;
  if (level <= 4) return 2;
  return 3;
}

/* ── Canvas drawing helpers ──────────────────────────────────────── */

const CANVAS_W = 380;
const CANVAS_H = 400;
const DIE_SIZE = 64;
const DIE_SPACING = 16;

function drawMarbleBackground(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  // Marble gradient fill
  const grad = c.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, C_MARBLE_LIGHT);
  grad.addColorStop(0.4, C_MARBLE_MID);
  grad.addColorStop(0.7, C_MARBLE_LIGHT);
  grad.addColorStop(1, C_MARBLE_DARK);
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = grad;
  c.fill();

  // Marble veins
  c.strokeStyle = C_VEIN + '4d'; // ~0.3 opacity
  c.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) {
    const yOff = y + h * (0.2 + i * 0.3);
    c.beginPath();
    c.moveTo(x + 10, yOff);
    c.quadraticCurveTo(x + w * 0.5, yOff + (i % 2 === 0 ? -10 : 12), x + w - 10, yOff + (i % 2 === 0 ? 6 : -5));
    c.stroke();
  }

  // Double classical border
  c.strokeStyle = C_FLO_GOLD + 'b3'; // ~0.7 opacity
  c.lineWidth = 2.5;
  c.beginPath();
  c.roundRect(x + 3, y + 3, w - 6, h - 6, r - 2);
  c.stroke();

  c.strokeStyle = C_LAPIS_BLUE + '66'; // ~0.4 opacity
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(x + 7, y + 7, w - 14, h - 14, r - 4);
  c.stroke();
}

function drawFleurDeLis(c: CanvasRenderingContext2D, cx: number, cy: number): void {
  const s = 7;
  // Center petal
  c.beginPath();
  c.moveTo(cx, cy - s);
  c.quadraticCurveTo(cx + s * 0.5, cy - s * 0.2, cx, cy + s * 0.3);
  c.quadraticCurveTo(cx - s * 0.5, cy - s * 0.2, cx, cy - s);
  c.fillStyle = C_FLO_GOLD + '99';
  c.fill();
  // Left
  c.beginPath();
  c.moveTo(cx, cy);
  c.quadraticCurveTo(cx - s * 0.7, cy + s * 0.3, cx - s, cy - s * 0.5);
  c.strokeStyle = C_FLO_GOLD + '80';
  c.lineWidth = 1.2;
  c.stroke();
  // Right
  c.beginPath();
  c.moveTo(cx, cy);
  c.quadraticCurveTo(cx + s * 0.7, cy + s * 0.3, cx + s, cy - s * 0.5);
  c.stroke();
}

function drawDie(c: CanvasRenderingContext2D, value: number, x: number, y: number, size: number): void {
  const r = 8;

  // Shadow
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.beginPath();
  c.roundRect(x + 2, y + 3, size, size, r);
  c.fill();

  // Die body — ivory/cream gradient
  const grad = c.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, C_DIE_IVORY);
  grad.addColorStop(1, '#EDE6D8');
  c.beginPath();
  c.roundRect(x, y, size, size, r);
  c.fillStyle = grad;
  c.fill();

  // Outer border — dark walnut
  c.strokeStyle = C_DIE_BORDER;
  c.lineWidth = 2;
  c.stroke();

  // Inner gold trim
  c.beginPath();
  c.roundRect(x + 3, y + 3, size - 6, size - 6, r - 2);
  c.strokeStyle = C_FLO_GOLD + '59'; // ~0.35 opacity
  c.lineWidth = 0.8;
  c.stroke();

  // Pips — deep lapis blue
  const pipR = 5.0;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const off = 16;

  let positions: [number, number][];
  switch (value) {
    case 1: positions = [[cx, cy]]; break;
    case 2: positions = [[cx - off, cy - off], [cx + off, cy + off]]; break;
    case 3: positions = [[cx - off, cy - off], [cx, cy], [cx + off, cy + off]]; break;
    case 4: positions = [[cx - off, cy - off], [cx + off, cy - off], [cx - off, cy + off], [cx + off, cy + off]]; break;
    case 5: positions = [[cx - off, cy - off], [cx + off, cy - off], [cx, cy], [cx - off, cy + off], [cx + off, cy + off]]; break;
    case 6: positions = [[cx - off, cy - off], [cx + off, cy - off], [cx - off, cy], [cx + off, cy], [cx - off, cy + off], [cx + off, cy + off]]; break;
    default: positions = [[cx, cy]];
  }

  c.fillStyle = C_LAPIS_BLUE;
  for (const [px, py] of positions) {
    c.beginPath();
    c.arc(px, py, pipR, 0, Math.PI * 2);
    c.fill();
  }
}

/* ── Puzzle class ────────────────────────────────────────────────── */

export class CardanoDicePuzzle extends Puzzle {
  readonly title = 'CARDANO DICE';
  readonly subtitle = 'the liber de ludo aleae';
  readonly instructions =
    'Cardano reckoned probability from the ratio of favourable outcomes to all outcomes. Select the correct fraction for the question shown.';

  private level = 5; // max difficulty
  private scenario: Scenario = generateScenario(5);
  private options: string[] = [];
  private correctIndex = 0;
  private selectedIndex: number | null = null;
  private attempts = 0;
  private diceValues: number[] = [1];
  private goldenGlow = 0;
  private wrongFlash = false;

  // DOM
  private root: HTMLDivElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private optionButtons: HTMLButtonElement[] = [];
  private checkBtn: HTMLButtonElement | null = null;
  private attemptsEl: HTMLDivElement | null = null;
  private solvedEl: HTMLDivElement | null = null;
  private rollTimer = 0;
  private glowTimer = 0;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.buildDom();
    this.generatePuzzle();
    this.rollDiceAnimation();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color(C_LAPIS_BLUE),
        roughness: 0.7,
        metalness: 0.25,
        side: DoubleSide,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const crown = new Mesh(
      new RingGeometry(2.9, 3.05, 48),
      new MeshStandardMaterial({
        color: new Color(C_FLO_GOLD),
        emissive: new Color('#3a2008'),
        emissiveIntensity: 0.45,
        roughness: 0.4,
        metalness: 0.9,
        side: DoubleSide,
      }),
    );
    crown.rotation.x = -Math.PI / 2;
    crown.position.y = -2.37;
    this.group.add(crown);

    const lamp = new PointLight('#ffd79a', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-cardano';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: 'rgba(26,15,10,0.92)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(197,151,44,0.25)', borderTop: `3px solid ${C_FLO_GOLD}`,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_WARM_IVORY,
      maxHeight: '96vh', overflowY: 'auto',
    });
    root.appendChild(panel);

    // Header row
    const headerRow = document.createElement('div');
    Object.assign(headerRow.style, {
      display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center',
    });

    // Rules button (left)
    const rulesBtn = document.createElement('button');
    rulesBtn.type = 'button';
    rulesBtn.textContent = 'RULES';
    Object.assign(rulesBtn.style, {
      background: 'none', border: 'none', color: C_FLO_GOLD,
      fontFamily: 'inherit', fontSize: '12px', fontWeight: '600', letterSpacing: '0.12em',
      cursor: 'pointer', padding: '4px 8px',
    });
    rulesBtn.addEventListener('click', () => this.showRulesOverlay());
    headerRow.appendChild(rulesBtn);

    // Attempts (right)
    const attemptsEl = document.createElement('div');
    Object.assign(attemptsEl.style, {
      fontSize: '12px', fontWeight: '600', letterSpacing: '0.1em', color: C_MEDICI_RED,
    });
    this.attemptsEl = attemptsEl;
    headerRow.appendChild(attemptsEl);
    panel.appendChild(headerRow);

    // Question canvas (marble tablet)
    const cvs = document.createElement('canvas');
    cvs.width = CANVAS_W * 2;
    cvs.height = CANVAS_H * 2;
    Object.assign(cvs.style, { width: CANVAS_W + 'px', height: CANVAS_H + 'px', display: 'block', borderRadius: '14px' });
    this.ctx2d = cvs.getContext('2d')!;
    this.canvasEl = cvs;
    panel.appendChild(cvs);

    // Options grid (2x2)
    const optionsGrid = document.createElement('div');
    Object.assign(optionsGrid.style, {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '320px',
    });
    for (let i = 0; i < 4; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      Object.assign(btn.style, {
        padding: '14px 0', fontSize: '22px', fontWeight: '700', fontFamily: 'inherit',
        color: C_INK_BROWN, background: C_MARBLE_LIGHT,
        border: `1.5px solid ${C_LAPIS_BLUE}4d`,
        borderRadius: '10px', cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
      });
      btn.addEventListener('click', () => this.selectOption(i));
      optionsGrid.appendChild(btn);
      this.optionButtons.push(btn);
    }
    panel.appendChild(optionsGrid);

    // Check button
    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.textContent = 'CHECK';
    Object.assign(checkBtn.style, {
      padding: '11px 40px', fontSize: '16px', fontWeight: '700', fontFamily: 'inherit',
      color: C_WARM_IVORY, background: C_LAPIS_BLUE + '59',
      border: 'none', borderRadius: '10px', cursor: 'default',
      letterSpacing: '0.1em', transition: 'background 0.15s',
    });
    checkBtn.addEventListener('click', () => this.checkAnswer());
    this.checkBtn = checkBtn;
    panel.appendChild(checkBtn);

    // Solved message
    const solvedEl = document.createElement('div');
    Object.assign(solvedEl.style, {
      fontSize: '20px', fontWeight: '700', color: C_SUCCESS_GLOW,
      textShadow: `0 0 12px ${C_SUCCESS_GLOW}`, display: 'none',
    });
    solvedEl.textContent = 'CORRECT!';
    this.solvedEl = solvedEl;
    panel.appendChild(solvedEl);

    // Overlay container (for rules)
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    // Inject animation keyframes
    if (!document.getElementById('cardano-anims')) {
      const style = document.createElement('style');
      style.id = 'cardano-anims';
      style.textContent = `
        @keyframes cardano-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(12px)} 75%{transform:translateX(-12px)} }
        @keyframes cardano-glow { 0%,100%{opacity:0.3} 50%{opacity:1} }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(root);
  }

  /* ═══════════════════ Puzzle generation ═════════════════════════ */

  private generatePuzzle(): void {
    this.scenario = generateScenario(this.level);
    const allOptions = [this.scenario.correct, ...this.scenario.distractors];
    // Shuffle
    const indices = allOptions.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    this.options = indices.map(i => allOptions[i]);
    this.correctIndex = indices.indexOf(0);
    this.diceValues = Array(diceCountForLevel(this.level)).fill(1);
    this.selectedIndex = null;
    this.wrongFlash = false;
    this.renderUI();
  }

  /* ═══════════════════ Dice roll animation ═══════════════════════ */

  private rollDiceAnimation(): void {
    const totalDuration = 800;
    const steps = 12;
    const interval = totalDuration / steps;
    let step = 0;
    const diceCount = diceCountForLevel(this.level);

    this.rollTimer = window.setInterval(() => {
      step++;
      this.diceValues = Array.from({ length: diceCount }, () => randInt(1, 6));
      this.drawCanvas();
      if (step >= steps) {
        clearInterval(this.rollTimer);
        // Settle on context-appropriate values
        this.diceValues = this.scenario.exampleDice.length > 0
          ? [...this.scenario.exampleDice]
          : Array.from({ length: diceCount }, () => randInt(1, 6));
        this.drawCanvas();
      }
    }, interval);
  }

  /* ═══════════════════ Canvas rendering ══════════════════════════ */

  private drawCanvas(): void {
    const c = this.ctx2d!;
    const s = 2; // retina
    c.clearRect(0, 0, CANVAS_W * s, CANVAS_H * s);
    c.save();
    c.scale(s, s);

    // Question tablet (marble background, top area)
    const tabletH = 110;
    drawMarbleBackground(c, 0, 0, CANVAS_W, tabletH, 14);

    // Corner fleur-de-lis ornaments
    const inset = 16;
    drawFleurDeLis(c, inset, inset);
    drawFleurDeLis(c, CANVAS_W - inset, inset);
    drawFleurDeLis(c, inset, tabletH - inset);
    drawFleurDeLis(c, CANVAS_W - inset, tabletH - inset);

    // Golden glow on solve
    if (this.isSolved && this.goldenGlow > 0) {
      c.beginPath();
      c.roundRect(0, 0, CANVAS_W, tabletH, 14);
      c.fillStyle = `rgba(212,175,55,${this.goldenGlow * 0.12})`;
      c.fill();
    }

    // Question prefix
    c.font = '500 13px Rajdhani, system-ui';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = C_FLO_GOLD;
    c.fillText('WHAT IS THE PROBABILITY?', CANVAS_W / 2, 24);

    // Question text (wrapped)
    c.font = '700 15px Rajdhani, system-ui';
    c.fillStyle = C_INK_BROWN;
    this.drawWrappedText(c, this.scenario.question, CANVAS_W / 2, 55, CANVAS_W - 40, 20);

    // Dice area (below tablet)
    const diceY = tabletH + 20;
    const count = this.diceValues.length;
    const totalWidth = count * DIE_SIZE + (count - 1) * DIE_SPACING;
    const startX = (CANVAS_W - totalWidth) / 2;

    for (let i = 0; i < count; i++) {
      const dx = startX + i * (DIE_SIZE + DIE_SPACING);
      drawDie(c, this.diceValues[i], dx, diceY, DIE_SIZE);
    }

    c.restore();
  }

  private drawWrappedText(c: CanvasRenderingContext2D, text: string, cx: number, startY: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' ');
    let line = '';
    let y = startY;
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const metrics = c.measureText(testLine);
      if (metrics.width > maxWidth && line) {
        c.fillText(line, cx, y);
        line = word;
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line) c.fillText(line, cx, y);
  }

  /* ═══════════════════ UI updates ════════════════════════════════ */

  private renderUI(): void {
    // Update attempts display
    if (this.attemptsEl) {
      this.attemptsEl.textContent = this.attempts > 0 && !this.isSolved ? `ATTEMPTS: ${this.attempts}` : '';
    }

    // Update option buttons
    for (let i = 0; i < this.optionButtons.length; i++) {
      const btn = this.optionButtons[i];
      btn.textContent = this.options[i] || '';
      btn.disabled = this.isSolved;

      if (this.isSolved) {
        btn.style.display = 'none';
      } else {
        btn.style.display = '';
        const isSelected = this.selectedIndex === i;
        const isWrong = this.wrongFlash && isSelected;

        if (isWrong) {
          btn.style.background = C_MEDICI_RED;
          btn.style.color = C_WARM_IVORY;
          btn.style.borderColor = C_MEDICI_RED;
        } else if (isSelected) {
          btn.style.background = C_LAPIS_BLUE;
          btn.style.color = C_WARM_IVORY;
          btn.style.borderColor = C_FLO_GOLD;
          btn.style.borderWidth = '2.5px';
        } else {
          btn.style.background = C_MARBLE_LIGHT;
          btn.style.color = C_INK_BROWN;
          btn.style.borderColor = C_LAPIS_BLUE + '4d';
          btn.style.borderWidth = '1.5px';
        }
      }
    }

    // Check button
    if (this.checkBtn) {
      if (this.isSolved) {
        this.checkBtn.style.display = 'none';
      } else {
        this.checkBtn.style.display = '';
        const enabled = this.selectedIndex !== null;
        this.checkBtn.style.background = enabled ? C_LAPIS_BLUE : C_LAPIS_BLUE + '59';
        this.checkBtn.style.cursor = enabled ? 'pointer' : 'default';
      }
    }

    // Solved message
    if (this.solvedEl) {
      this.solvedEl.style.display = this.isSolved ? 'block' : 'none';
    }

    this.drawCanvas();
  }

  /* ═══════════════════ Interaction ═══════════════════════════════ */

  private selectOption(index: number): void {
    if (this.isSolved) return;
    this.selectedIndex = index;
    this.wrongFlash = false;
    this.renderUI();
  }

  private checkAnswer(): void {
    if (this.selectedIndex === null || this.isSolved) return;
    this.attempts++;

    if (this.selectedIndex === this.correctIndex) {
      // Correct!
      this.isSolved = true;
      this.renderUI();
      // Golden glow animation
      let dir = 1;
      this.glowTimer = window.setInterval(() => {
        this.goldenGlow += dir * 0.05;
        if (this.goldenGlow >= 1) dir = -1;
        if (this.goldenGlow <= 0.3) dir = 1;
        this.drawCanvas();
      }, 50);
      setTimeout(() => {
        clearInterval(this.glowTimer);
        this.onSolved?.();
      }, 1500);
    } else {
      // Wrong
      this.wrongFlash = true;
      this.renderUI();

      // Shake animation on canvas
      if (this.canvasEl) {
        this.canvasEl.style.animation = 'cardano-shake 0.3s ease-out';
        setTimeout(() => {
          if (this.canvasEl) this.canvasEl.style.animation = '';
        }, 300);
      }

      // Reset after delay
      setTimeout(() => {
        this.selectedIndex = null;
        this.wrongFlash = false;
        this.renderUI();
      }, 1200);
    }
  }

  /* ═══════════════════ Rules overlay ═════════════════════════════ */

  private showRulesOverlay(): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '360px', width: '90%', maxHeight: '80vh', overflowY: 'auto',
      padding: '24px', background: C_WARM_IVORY, borderRadius: '16px',
      fontFamily: "'Rajdhani', system-ui, sans-serif", color: C_INK_BROWN,
      boxShadow: `0 0 40px rgba(0,0,0,0.5)`,
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '\u2715';
    Object.assign(closeBtn.style, {
      float: 'right', background: 'none', border: 'none', fontSize: '20px',
      color: C_INK_BROWN + '99', cursor: 'pointer', padding: '0 4px',
    });
    closeBtn.addEventListener('click', () => { this.overlayEl!.style.display = 'none'; });
    card.appendChild(closeBtn);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '18px', fontWeight: '700', color: C_LAPIS_BLUE, marginBottom: '16px' });
    title.textContent = 'Probability Rules';
    card.appendChild(title);

    // Rule sections
    const rules = [
      { heading: 'How to Play', text: 'Read the probability question and select the correct fraction from the four options. Then press CHECK.' },
      { heading: 'Probability Basics', text: 'Probability = favorable outcomes / total outcomes. A single die has 6 faces, so each face has probability 1/6.' },
      { heading: 'One Die', text: 'With one six-sided die, there are 6 equally likely outcomes. Even numbers: {2,4,6} = 3/6 = 1/2.' },
      { heading: 'Two Dice', text: 'With two dice, there are 6\u00d76 = 36 equally likely outcomes. The sum of 7 can occur in 6 ways: 1/6.' },
      { heading: 'Three Dice', text: 'With three dice, there are 6\u00d76\u00d76 = 216 equally likely outcomes. Count favorable cases carefully.' },
      { heading: 'Tips', text: 'Simplify fractions. Remember: "at least one" is often easier as 1 minus the complement probability.' },
    ];

    for (const rule of rules) {
      const section = document.createElement('div');
      Object.assign(section.style, {
        marginBottom: '14px', padding: '12px', background: '#fff',
        borderRadius: '10px', border: `1px solid ${C_FLO_GOLD}40`,
      });
      const h = document.createElement('div');
      Object.assign(h.style, { fontSize: '15px', fontWeight: '700', color: C_LAPIS_BLUE, marginBottom: '6px' });
      h.textContent = rule.heading;
      section.appendChild(h);
      const p = document.createElement('div');
      Object.assign(p.style, { fontSize: '13px', lineHeight: '1.5', color: C_INK_BROWN });
      p.textContent = rule.text;
      section.appendChild(p);
      card.appendChild(section);
    }

    this.overlayEl.appendChild(card);
  }

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    clearInterval(this.rollTimer);
    clearInterval(this.glowTimer);
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('cardano-anims');
    if (animStyle) animStyle.remove();
    this.ctx2d = null;
    this.canvasEl = null;
    this.overlayEl = null;
    this.optionButtons = [];
    this.checkBtn = null;
    this.attemptsEl = null;
    this.solvedEl = null;
    super.dispose();
  }
}
