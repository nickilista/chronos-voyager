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
 * Cardano Dice — Renaissance probability. The player solves a small series
 * of dice-probability scenarios: single-die events, two-dice sums, three-dice
 * joint outcomes. Each round shows illustrative dice plus a question; the
 * player chooses the correct fraction from four options. Three correct
 * answers closes the puzzle.
 */

const ROUNDS_TO_WIN = 3;

interface Scenario {
  readonly question: string;
  readonly correct: string;
  readonly options: readonly string[];
  readonly dice: readonly number[];
}

const POOL: readonly (() => Scenario)[] = [
  () => ({
    question: 'One die — probability the result is greater than 4?',
    correct: '1/3',
    options: ['1/6', '1/3', '1/2', '2/3'],
    dice: [5 + Math.floor(Math.random() * 2)],
  }),
  () => ({
    question: 'One die — probability of a prime number?',
    correct: '1/2',
    options: ['1/3', '1/2', '2/3', '5/6'],
    dice: [[2, 3, 5][Math.floor(Math.random() * 3)]],
  }),
  () => ({
    question: 'One die — probability it is NOT a six?',
    correct: '5/6',
    options: ['5/6', '1/6', '2/3', '4/6'],
    dice: [1 + Math.floor(Math.random() * 5)],
  }),
  () => ({
    question: 'Two dice — probability the sum equals 7?',
    correct: '1/6',
    options: ['1/9', '5/36', '1/6', '1/4'],
    dice: [3, 4],
  }),
  () => ({
    question: 'Two dice — probability the sum equals 12?',
    correct: '1/36',
    options: ['1/36', '1/18', '1/12', '1/6'],
    dice: [6, 6],
  }),
  () => ({
    question: 'Two dice — probability of a double (both faces equal)?',
    correct: '1/6',
    options: ['1/36', '1/12', '1/6', '1/3'],
    dice: (() => {
      const d = 1 + Math.floor(Math.random() * 6);
      return [d, d];
    })(),
  }),
  () => ({
    question: 'Two dice — probability of at least one six?',
    correct: '11/36',
    options: ['1/6', '10/36', '11/36', '1/3'],
    dice: [6, 2 + Math.floor(Math.random() * 5)],
  }),
  () => ({
    question: 'Two dice — probability the sum is 10 or more?',
    correct: '1/6',
    options: ['1/9', '1/6', '1/4', '5/18'],
    dice: [5, 5 + Math.floor(Math.random() * 2)],
  }),
  () => ({
    question: 'Two dice — probability both are even?',
    correct: '1/4',
    options: ['1/6', '1/4', '1/3', '1/2'],
    dice: [2 * (1 + Math.floor(Math.random() * 3)), 2 * (1 + Math.floor(Math.random() * 3))],
  }),
  () => ({
    question: 'Three dice — probability all three show the same face?',
    correct: '1/36',
    options: ['1/216', '1/36', '1/18', '1/6'],
    dice: (() => {
      const d = 1 + Math.floor(Math.random() * 6);
      return [d, d, d];
    })(),
  }),
  () => ({
    question: 'Three dice — probability the three are all different?',
    correct: '5/9',
    options: ['4/9', '1/2', '5/9', '2/3'],
    dice: [1, 4, 6],
  }),
];

function pickRound(): Scenario {
  return POOL[Math.floor(Math.random() * POOL.length)]();
}

function pipsFor(value: number): string {
  // Return a 3×3 pip layout using dot/empty characters.
  const pips: Record<number, number[][]> = {
    1: [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
    2: [[1, 0, 0], [0, 0, 0], [0, 0, 1]],
    3: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    4: [[1, 0, 1], [0, 0, 0], [1, 0, 1]],
    5: [[1, 0, 1], [0, 1, 0], [1, 0, 1]],
    6: [[1, 0, 1], [1, 0, 1], [1, 0, 1]],
  };
  return (pips[value] ?? pips[1])
    .map((r) => r.map((c) => (c ? '●' : ' ')).join(' '))
    .join('\n');
}

export class CardanoDicePuzzle extends Puzzle {
  readonly title = 'CARDANO DICE';
  readonly subtitle = 'the liber de ludo aleae';
  readonly instructions =
    'Cardano reckoned probability from the ratio of favourable outcomes to all outcomes. Answer three rounds correctly to pass.';

  private scenario: Scenario = pickRound();
  private roundsWon = 0;
  private locked = false;

  private root: HTMLDivElement | null = null;
  private questionEl: HTMLDivElement | null = null;
  private diceEl: HTMLDivElement | null = null;
  private optionsEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private progressEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.buildDom();
    this.renderRound();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#1e3a6e'),
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
        color: new Color('#c5972c'),
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

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-cardano';
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
      background:rgba(10,18,34,0.78); backdrop-filter:blur(12px);
      border:1px solid rgba(159,200,255,0.25);
      border-top:3px solid var(--era-accent);
      border-radius:10px;
      box-shadow:0 18px 60px rgba(0,0,0,0.55);
      color:#e6eefb;
      min-width:420px;
    `;
    root.appendChild(panel);

    const title = document.createElement('div');
    title.style.cssText = `font-size:18px; letter-spacing:0.26em; color:var(--era-accent); font-weight:600;`;
    title.textContent = 'CARDANO DICE';
    panel.appendChild(title);

    const progress = document.createElement('div');
    progress.style.cssText = `font-size:12px; letter-spacing:0.18em; opacity:0.75;`;
    this.progressEl = progress;
    panel.appendChild(progress);

    const question = document.createElement('div');
    question.style.cssText = `
      font-size:16px; letter-spacing:0.04em;
      text-align:center; max-width:380px; min-height:44px;
      color:#f6e9c8;
    `;
    this.questionEl = question;
    panel.appendChild(question);

    const dice = document.createElement('div');
    dice.style.cssText = `display:flex; gap:14px; min-height:84px; align-items:center;`;
    this.diceEl = dice;
    panel.appendChild(dice);

    const options = document.createElement('div');
    options.style.cssText = `display:grid; grid-template-columns:1fr 1fr; gap:10px; width:320px;`;
    this.optionsEl = options;
    panel.appendChild(options);

    const status = document.createElement('div');
    status.style.cssText = `font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;`;
    this.statusEl = status;
    panel.appendChild(status);

    document.body.appendChild(root);
  }

  /* ----------------------------- Rendering ------------------------------- */

  private renderRound(): void {
    if (this.progressEl) {
      this.progressEl.textContent = `ROUND ${Math.min(this.roundsWon + 1, ROUNDS_TO_WIN)} / ${ROUNDS_TO_WIN}`;
    }
    if (this.questionEl) this.questionEl.textContent = this.scenario.question;
    this.renderDice();
    this.renderOptions();
    if (this.statusEl && !this.isSolved) {
      this.statusEl.textContent = 'reckon the ratio';
      this.statusEl.style.color = '';
    }
  }

  private renderDice(): void {
    if (!this.diceEl) return;
    this.diceEl.innerHTML = '';
    for (const v of this.scenario.dice) {
      const die = document.createElement('pre');
      die.textContent = pipsFor(v);
      die.style.cssText = `
        width:64px; height:64px;
        margin:0; padding:8px 10px;
        background:#f5f0e6; color:#3b2414;
        border:2px solid #5c4a3a; border-radius:8px;
        font-family:'Menlo', monospace; font-size:14px; line-height:1.12;
        box-shadow:0 4px 10px rgba(0,0,0,0.45);
        display:flex; align-items:center; justify-content:center;
        white-space:pre;
      `;
      this.diceEl.appendChild(die);
    }
  }

  private renderOptions(): void {
    if (!this.optionsEl) return;
    this.optionsEl.innerHTML = '';
    for (const opt of this.scenario.options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = opt;
      b.disabled = this.locked || this.isSolved;
      b.style.cssText = `
        padding:12px 0;
        background:rgba(245,230,200,0.08);
        border:1px solid rgba(197,151,44,0.4);
        color:#f6e9c8;
        font-family:inherit; font-size:17px; font-weight:600; letter-spacing:0.1em;
        border-radius:5px; cursor:${this.locked ? 'default' : 'pointer'};
        opacity:${this.locked ? '0.7' : '1'};
      `;
      b.addEventListener('click', () => this.answer(opt, b));
      this.optionsEl.appendChild(b);
    }
  }

  /* -------------------------------- Flow --------------------------------- */

  private answer(opt: string, btn: HTMLButtonElement): void {
    if (this.locked || this.isSolved) return;
    this.locked = true;
    const correct = opt === this.scenario.correct;
    btn.style.background = correct ? 'rgba(150,220,160,0.35)' : 'rgba(220,120,120,0.32)';
    btn.style.borderColor = correct ? '#9fe0a6' : '#e89090';
    if (correct) {
      this.roundsWon++;
      if (this.statusEl) {
        this.statusEl.textContent = 'correct';
        this.statusEl.style.color = '#9fe0a6';
      }
      if (this.roundsWon >= ROUNDS_TO_WIN) {
        this.isSolved = true;
        if (this.statusEl) {
          this.statusEl.textContent = 'THE CALCULUS OF CHANCE IS YOURS';
          this.statusEl.style.color = '#9fe0a6';
        }
        setTimeout(() => this.onSolved?.(), 1100);
        return;
      }
      setTimeout(() => {
        this.scenario = pickRound();
        this.locked = false;
        this.renderRound();
      }, 700);
    } else {
      if (this.statusEl) {
        this.statusEl.textContent = `the true odds were ${this.scenario.correct}`;
        this.statusEl.style.color = '#e89090';
      }
      setTimeout(() => {
        this.scenario = pickRound();
        this.locked = false;
        this.renderRound();
      }, 1400);
    }
  }

  /* ------------------------------ Lifecycle ----------------------------- */

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
    this.questionEl = null;
    this.diceEl = null;
    this.optionsEl = null;
    this.statusEl = null;
    this.progressEl = null;
    super.dispose();
  }
}
