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
 * Boolean Gates — the age of reason in silicon prologue. Three rounds;
 * each round sets four input bits (A, B, C, D) wired into a small
 * expression of AND/OR/NOT gates. The player toggles the inputs to make
 * the output light up. Three rounds correct = solved.
 */

type Op = 'AND' | 'OR' | 'NOT' | 'XOR';

interface Problem {
  readonly formula: string;
  readonly evaluate: (a: boolean, b: boolean, c: boolean, d: boolean) => boolean;
}

const PROBLEMS: readonly Problem[] = [
  {
    formula: '(A AND B) OR (NOT C)',
    evaluate: (a, b, c) => (a && b) || !c,
  },
  {
    formula: '(A XOR B) AND (C OR D)',
    evaluate: (a, b, c, d) => a !== b && (c || d),
  },
  {
    formula: '((A OR B) AND C) XOR D',
    evaluate: (a, b, c, d) => ((a || b) && c) !== d,
  },
  {
    formula: 'NOT (A AND B) AND (C XOR D)',
    evaluate: (a, b, c, d) => !(a && b) && c !== d,
  },
  {
    formula: '(A AND C) OR (B AND NOT D)',
    evaluate: (a, b, c, d) => (a && c) || (b && !d),
  },
  {
    formula: 'NOT A XOR (B AND (C OR D))',
    evaluate: (a, b, c, d) => !a !== (b && (c || d)),
  },
];

const ROUNDS_TO_WIN = 3;

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export class BooleanGatesPuzzle extends Puzzle {
  readonly title = 'BOOLEAN GATES';
  readonly subtitle = "boole's calculus";
  readonly instructions =
    'Toggle A, B, C, D so the expression evaluates to TRUE. Three rounds — each harder — must be solved in sequence.';

  private roundProblems: Problem[] = [];
  private roundIdx = 0;
  private inputs = { a: false, b: false, c: false, d: false };

  private root: HTMLDivElement | null = null;
  private formulaEl: HTMLDivElement | null = null;
  private roundEl: HTMLDivElement | null = null;
  private outputEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private verifyBtn: HTMLButtonElement | null = null;
  private inputBtns: HTMLButtonElement[] = [];

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.roundProblems = shuffle(PROBLEMS.slice()).slice(0, ROUNDS_TO_WIN);
    this.buildDom();
    this.refresh();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const floor = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#0b1016'),
        roughness: 0.65,
        metalness: 0.25,
        side: DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    this.group.add(floor);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color('#b0c0d0'),
        emissive: new Color('#1a2a3a'),
        emissiveIntensity: 0.55,
        roughness: 0.3,
        metalness: 0.95,
        side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const lamp = new PointLight('#9ac4ff', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-boolean-gates';
    root.style.cssText = `
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      z-index:20; pointer-events:none; font-family:'Cormorant Garamond', Georgia, serif;
    `;
    this.root = root;

    const panel = document.createElement('div');
    panel.style.cssText = `
      display:flex; flex-direction:column; align-items:center; gap:14px;
      pointer-events:auto;
      padding:22px 30px;
      min-width:340px;
      background:rgba(13,21,32,0.85); backdrop-filter:blur(12px);
      border:1px solid rgba(196,148,74,0.35);
      border-top:3px solid var(--era-accent);
      border-radius:10px;
      box-shadow:0 18px 60px rgba(0,0,0,0.55);
      color:#f0e6d3;
    `;
    root.appendChild(panel);

    const title = document.createElement('div');
    title.style.cssText = `font-size:18px; letter-spacing:0.26em; color:var(--era-accent); font-weight:600;`;
    title.textContent = 'BOOLEAN GATES';
    panel.appendChild(title);

    const round = document.createElement('div');
    round.style.cssText = `font-size:11px; letter-spacing:0.3em; opacity:0.7;`;
    this.roundEl = round;
    panel.appendChild(round);

    const formula = document.createElement('div');
    formula.style.cssText = `
      font-family:'JetBrains Mono', 'Courier New', monospace;
      font-size:18px; letter-spacing:0.04em; color:#f0e6d3;
      background:rgba(0,0,0,0.35); border:1px solid rgba(196,148,74,0.3);
      padding:12px 20px; border-radius:6px; min-width:300px; text-align:center;
    `;
    this.formulaEl = formula;
    panel.appendChild(formula);

    const inputs = document.createElement('div');
    inputs.style.cssText = `display:flex; gap:10px;`;
    for (const [i, label] of ['A', 'B', 'C', 'D'].entries()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${label} 0`;
      b.dataset.idx = String(i);
      b.style.cssText = `
        width:64px; height:64px;
        background:rgba(60,70,90,0.4);
        border:2px solid rgba(255,255,255,0.2);
        color:#f0e6d3;
        font-family:inherit; font-size:15px; font-weight:700;
        letter-spacing:0.1em;
        border-radius:6px; cursor:pointer;
      `;
      b.addEventListener('click', () => this.toggle(i));
      inputs.appendChild(b);
      this.inputBtns.push(b);
    }
    panel.appendChild(inputs);

    const output = document.createElement('div');
    output.style.cssText = `
      font-family:'JetBrains Mono', monospace;
      font-size:22px; letter-spacing:0.22em; font-weight:700;
      padding:10px 24px; border-radius:5px;
    `;
    this.outputEl = output;
    panel.appendChild(output);

    const status = document.createElement('div');
    status.style.cssText = `font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;`;
    this.statusEl = status;
    panel.appendChild(status);

    const verify = document.createElement('button');
    verify.type = 'button';
    verify.textContent = 'LOCK';
    verify.style.cssText = `
      padding:9px 30px;
      background:rgba(196,148,74,0.12);
      border:1px solid rgba(196,148,74,0.5);
      color:var(--era-accent);
      font-family:inherit; font-size:14px; letter-spacing:0.3em; font-weight:600;
      border-radius:4px; cursor:pointer;
    `;
    verify.addEventListener('click', () => this.lockIn());
    this.verifyBtn = verify;
    panel.appendChild(verify);

    document.body.appendChild(root);
  }

  /* --------------------------------- UI ---------------------------------- */

  private toggle(i: number): void {
    if (this.isSolved) return;
    const keys = ['a', 'b', 'c', 'd'] as const;
    this.inputs[keys[i]] = !this.inputs[keys[i]];
    this.refresh();
  }

  private currentOutput(): boolean {
    const p = this.roundProblems[this.roundIdx];
    return p.evaluate(this.inputs.a, this.inputs.b, this.inputs.c, this.inputs.d);
  }

  private refresh(): void {
    if (this.roundEl) {
      this.roundEl.textContent = `STAGE ${this.roundIdx + 1} / ${ROUNDS_TO_WIN}`;
    }
    if (this.formulaEl) {
      this.formulaEl.textContent = this.roundProblems[this.roundIdx].formula;
    }
    const keys = ['a', 'b', 'c', 'd'] as const;
    this.inputBtns.forEach((btn, i) => {
      const v = this.inputs[keys[i]];
      btn.textContent = `${keys[i].toUpperCase()} ${v ? '1' : '0'}`;
      btn.style.background = v ? 'rgba(80,200,140,0.35)' : 'rgba(60,70,90,0.4)';
      btn.style.borderColor = v ? '#80e0a8' : 'rgba(255,255,255,0.2)';
      btn.style.color = v ? '#ccffd8' : '#f0e6d3';
    });
    const out = this.currentOutput();
    if (this.outputEl) {
      this.outputEl.textContent = `OUT ${out ? '1' : '0'}`;
      this.outputEl.style.background = out ? 'rgba(80,200,140,0.28)' : 'rgba(120,120,120,0.15)';
      this.outputEl.style.color = out ? '#ccffd8' : 'rgba(240,230,211,0.6)';
    }
    if (this.statusEl && !this.isSolved) {
      this.statusEl.textContent = 'drive OUT to 1';
      this.statusEl.style.color = '';
    }
    if (this.verifyBtn) {
      this.verifyBtn.disabled = this.isSolved;
      this.verifyBtn.style.opacity = this.isSolved ? '0.35' : '1';
    }
  }

  private lockIn(): void {
    if (this.isSolved) return;
    if (!this.currentOutput()) {
      if (this.statusEl) {
        this.statusEl.textContent = 'OUT still 0 — try another combination';
        this.statusEl.style.color = '#e89090';
      }
      return;
    }
    this.roundIdx++;
    if (this.roundIdx >= ROUNDS_TO_WIN) {
      this.isSolved = true;
      if (this.statusEl) {
        this.statusEl.textContent = 'ALL STAGES LOCKED';
        this.statusEl.style.color = '#9fe0a6';
      }
      setTimeout(() => this.onSolved?.(), 1000);
      return;
    }
    this.inputs = { a: false, b: false, c: false, d: false };
    if (this.statusEl) {
      this.statusEl.textContent = 'stage cleared — next formula';
      this.statusEl.style.color = '#9fe0a6';
    }
    this.refresh();
  }

  /* ------------------------------ Lifecycle ------------------------------ */

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
    this.formulaEl = null;
    this.roundEl = null;
    this.outputEl = null;
    this.statusEl = null;
    this.verifyBtn = null;
    this.inputBtns = [];
    super.dispose();
  }
}
