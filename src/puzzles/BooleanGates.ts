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
 * Boolean Gates — Boole's algebra brought to life.
 * Aligned with iOS BooleanGatesView.swift:
 *   - 5 difficulty levels with configurable gate types
 *   - Two modes: "predict" (given inputs, predict output) and "findInputs" (toggle inputs to match target)
 *   - Deterministic seeded circuit generation per round
 *   - Lives system (3 bolts), progress bar, hint bubble
 *   - Canvas-drawn circuit board with gates, wires, terminals
 *   - Industrial revolution palette (maroon, copper, gas-yellow)
 */

/* ── Gate types & mode ────────────────────────────────────────── */

type GateType = 'and' | 'or' | 'not' | 'xor' | 'nand';
type Mode = 'predict' | 'findInputs';
type Phase = 'playing' | 'won' | 'lost';

/* ── Colors (revolution palette, matches iOS) ─────────────────── */

const C_DARK_BG = '#0F0A14';
const C_BOARD_BG = '#1A1020';
const C_MAROON = '#4A1942';
const C_CREAM = '#F5E6D3';
const C_PURPLE = '#9B59B6';
const C_COPPER = '#B87333';
const C_GAS_YELLOW = '#F0D060';
const C_RAIL_RED = '#C0392B';
const C_WIRE_ON = '#F0D060';
const C_WIRE_OFF = '#4A4055';
const C_GATE_BODY = '#2A1F30';
const C_TRACE = '#2A2035';

/* ── Circuit data models ──────────────────────────────────────── */

interface BLGate {
  type: GateType;
  inputIndices: number[];
  inputValues: boolean[];
  output: boolean;
  yOffset: number;
}

interface BLRoundData {
  inputLabels: string[];
  gates: BLGate[];
  targetOutput: boolean;
}

interface BLCircuit {
  rounds: number;
  mode: Mode;
  gateTypes: GateType[];
  inputCount: number;
  gateDescription: string;
  hint: string;
}

/* ── Seeded RNG (matches iOS SeededRNG) ───────────────────────── */

class SeededRNG {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    // xorshift32
    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;
    this.state = this.state >>> 0;
    return this.state;
  }
}

/* ── Circuit factory ──────────────────────────────────────────── */

function circuitForLevel(level: number): BLCircuit {
  switch (level) {
    case 1: return { rounds: 5, mode: 'predict', gateTypes: ['or', 'not'], inputCount: 2, gateDescription: 'OR, NOT', hint: 'OR outputs 1 if any input is 1. NOT flips the value.' };
    case 2: return { rounds: 6, mode: 'predict', gateTypes: ['and', 'or', 'xor'], inputCount: 2, gateDescription: 'AND, OR, XOR', hint: 'AND needs both 1. XOR outputs 1 when inputs differ.' };
    case 3: return { rounds: 6, mode: 'findInputs', gateTypes: ['and', 'or', 'not'], inputCount: 3, gateDescription: 'AND, OR, NOT', hint: 'Toggle inputs until the output matches the target.' };
    case 4: return { rounds: 7, mode: 'findInputs', gateTypes: ['and', 'or', 'not', 'xor', 'nand'], inputCount: 3, gateDescription: 'AND, OR, NOT, XOR, NAND', hint: 'NAND is the opposite of AND.' };
    default: return { rounds: 8, mode: 'findInputs', gateTypes: ['and', 'or', 'not', 'xor', 'nand'], inputCount: 4, gateDescription: 'AND, OR, NOT, XOR, NAND', hint: 'Trace the signal through each gate step by step.' };
  }
}

function evaluateGate(type: GateType, inputs: boolean[]): boolean {
  switch (type) {
    case 'and': return inputs.every(Boolean);
    case 'or': return inputs.some(Boolean);
    case 'not': return !inputs[0];
    case 'xor': return inputs[0] !== inputs[1];
    case 'nand': return !inputs.every(Boolean);
  }
}

function circuitLevel(circuit: BLCircuit): number {
  switch (circuit.rounds) {
    case 5: return 1;
    case 6: return circuit.mode === 'predict' ? 2 : 3;
    case 7: return 4;
    default: return 5;
  }
}

function roundData(circuit: BLCircuit, round: number, inputs: boolean[]): BLRoundData {
  const level = circuitLevel(circuit);
  const seed = level * 100 + round;
  const rng = new SeededRNG(seed);

  const labels = Array.from({ length: circuit.inputCount }, (_, i) => `X${i}`);
  const actualInputs = inputs.length === 0
    ? Array.from({ length: circuit.inputCount }, () => false)
    : inputs;

  const gateCount = Math.min(circuit.gateTypes.length, level <= 2 ? 1 : (level <= 5 ? 2 : 3));
  const gates: BLGate[] = [];

  for (let gi = 0; gi < gateCount; gi++) {
    const gateType = circuit.gateTypes[rng.next() % circuit.gateTypes.length];
    const isNot = gateType === 'not';

    let gateInputIndices: number[];
    let gateInputValues: boolean[];

    if (gi === 0) {
      if (isNot) {
        const idx = rng.next() % circuit.inputCount;
        gateInputIndices = [idx];
        gateInputValues = [actualInputs[idx]];
      } else {
        const idx0 = rng.next() % circuit.inputCount;
        let idx1 = rng.next() % circuit.inputCount;
        if (idx1 === idx0) idx1 = (idx0 + 1) % circuit.inputCount;
        gateInputIndices = [idx0, idx1];
        gateInputValues = [actualInputs[idx0], actualInputs[idx1]];
      }
    } else {
      const prevOut = gates[gi - 1].output;
      if (isNot) {
        gateInputIndices = [100 + gi - 1];
        gateInputValues = [prevOut];
      } else {
        const idx = rng.next() % circuit.inputCount;
        gateInputIndices = [100 + gi - 1, idx];
        gateInputValues = [prevOut, actualInputs[idx]];
      }
    }

    const output = evaluateGate(gateType, gateInputValues);
    gates.push({ type: gateType, inputIndices: gateInputIndices, inputValues: gateInputValues, output, yOffset: 0 });
  }

  const targetOutput = rng.next() % 2 === 0;
  return { inputLabels: labels, gates, targetOutput };
}

/* ── Canvas dimensions ────────────────────────────────────────── */

const CANVAS_W = 380;
const CANVAS_H = 200;

/* ── Puzzle class ─────────────────────────────────────────────── */

export class BooleanGatesPuzzle extends Puzzle {
  readonly title = 'BOOLEAN GATES';
  readonly subtitle = "boole's algebra";
  readonly instructions =
    'Predict the circuit output or toggle inputs to match the target. Complete all rounds with lives remaining.';

  private level = 1;
  private circuit: BLCircuit = circuitForLevel(1);
  private currentRound = 0;
  private score = 0;
  private lives = 3;
  private phase: Phase = 'playing';
  private inputs: boolean[] = [];
  private selectedAnswer: boolean | null = null;
  private feedbackText = '';
  private showHint = false;

  // DOM
  private root: HTMLDivElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private overlayEl: HTMLDivElement | null = null;

  // Containers for quick refresh
  private progressEl: HTMLDivElement | null = null;
  private instructionEl: HTMLDivElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private controlsEl: HTMLDivElement | null = null;
  private feedbackEl: HTMLDivElement | null = null;
  private livesEl: HTMLDivElement | null = null;
  private hintEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.setupLevel();
    this.buildDom();
    this.drawCircuit();
    this.refreshUI();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color('#0b0814'), roughness: 0.65, metalness: 0.25, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color(C_COPPER), emissive: new Color('#1a1020'),
        emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.95, side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const lamp = new PointLight('#9B59B6', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ═══════════════════ Level setup ═══════════════════════════════ */

  private setupLevel(): void {
    this.circuit = circuitForLevel(this.level);
    this.currentRound = 0;
    this.score = 0;
    this.lives = 3;
    this.phase = 'playing';
    this.feedbackText = '';
    this.selectedAnswer = null;
    this.generateInputs();
  }

  private generateInputs(): void {
    const data = roundData(this.circuit, this.currentRound, []);
    this.inputs = Array.from({ length: data.inputLabels.length }, () => Math.random() < 0.5);
  }

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-boolean-gates';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: 'rgba(15,10,20,0.92)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(155,89,182,0.25)', borderTop: `3px solid ${C_PURPLE}`,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_CREAM,
      maxHeight: '96vh', overflowY: 'auto', maxWidth: '440px', width: '95%',
    });
    root.appendChild(panel);

    // Header row (rules, level, lives, hint)
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px',
    });

    const levelLabel = document.createElement('div');
    Object.assign(levelLabel.style, { fontSize: '12px', letterSpacing: '0.16em', color: `${C_CREAM}b3`, fontWeight: '500' });
    levelLabel.textContent = `LEVEL ${this.level}`;
    header.appendChild(levelLabel);

    // Lives (bolts)
    this.livesEl = document.createElement('div');
    Object.assign(this.livesEl.style, { display: 'flex', gap: '4px', alignItems: 'center' });
    header.appendChild(this.livesEl);

    // Hint toggle
    const hintBtn = document.createElement('button');
    hintBtn.type = 'button';
    Object.assign(hintBtn.style, {
      background: 'none', border: 'none', color: C_GAS_YELLOW, fontSize: '16px',
      cursor: 'pointer', padding: '4px', opacity: '0.8',
    });
    hintBtn.textContent = '💡';
    hintBtn.addEventListener('click', () => { this.showHint = !this.showHint; this.refreshUI(); });
    header.appendChild(hintBtn);

    panel.appendChild(header);

    // Instruction card
    this.instructionEl = document.createElement('div');
    Object.assign(this.instructionEl.style, {
      textAlign: 'center', padding: '8px 16px', width: '100%',
      background: 'rgba(255,255,255,0.06)', borderRadius: '8px',
      border: `1px solid ${C_PURPLE}44`,
    });
    panel.appendChild(this.instructionEl);

    // Progress bar
    this.progressEl = document.createElement('div');
    Object.assign(this.progressEl.style, { display: 'flex', gap: '3px', width: '100%', padding: '0 4px' });
    panel.appendChild(this.progressEl);

    // Circuit canvas
    const canvasWrap = document.createElement('div');
    Object.assign(canvasWrap.style, {
      position: 'relative', width: CANVAS_W + 'px', height: CANVAS_H + 'px',
      borderRadius: '10px', overflow: 'hidden', border: `1px solid ${C_MAROON}55`,
    });
    const cvs = document.createElement('canvas');
    cvs.width = CANVAS_W * 2;
    cvs.height = CANVAS_H * 2;
    Object.assign(cvs.style, { width: CANVAS_W + 'px', height: CANVAS_H + 'px', display: 'block' });
    this.ctx2d = cvs.getContext('2d')!;
    this.canvasEl = cvs;
    canvasWrap.appendChild(cvs);
    panel.appendChild(canvasWrap);

    // Controls (predict buttons or input toggles)
    this.controlsEl = document.createElement('div');
    Object.assign(this.controlsEl.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' });
    panel.appendChild(this.controlsEl);

    // Feedback text
    this.feedbackEl = document.createElement('div');
    Object.assign(this.feedbackEl.style, { fontSize: '13px', fontWeight: '600', letterSpacing: '0.04em', minHeight: '18px', textAlign: 'center' });
    panel.appendChild(this.feedbackEl);

    // Hint bubble
    this.hintEl = document.createElement('div');
    Object.assign(this.hintEl.style, {
      padding: '8px 14px', borderRadius: '8px',
      background: `${C_GAS_YELLOW}18`, border: `1px solid ${C_GAS_YELLOW}44`,
      fontSize: '12px', color: `${C_CREAM}dd`, display: 'none', textAlign: 'center',
    });
    panel.appendChild(this.hintEl);

    // Overlay for result dialog
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    // Inject animation
    if (!document.getElementById('boolean-gates-anims')) {
      const style = document.createElement('style');
      style.id = 'boolean-gates-anims';
      style.textContent = `
        @keyframes bg-pop { from { transform: scale(0.92); opacity:0; } to { transform: scale(1); opacity:1; } }
        @keyframes bg-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(8px)} 50%{transform:translateX(-6px)} 75%{transform:translateX(4px)} }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(root);
  }

  /* ═══════════════════ Circuit canvas drawing ════════════════════ */

  private drawCircuit(): void {
    const c = this.ctx2d!;
    const s = 2;
    const w = CANVAS_W;
    const h = CANVAS_H;
    c.clearRect(0, 0, w * s, h * s);
    c.save();
    c.scale(s, s);

    // Background
    c.fillStyle = C_BOARD_BG;
    c.beginPath();
    c.roundRect(0, 0, w, h, 10);
    c.fill();

    // Grid traces
    c.strokeStyle = C_TRACE;
    c.lineWidth = 0.3;
    for (let x = 0; x <= w; x += 20) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke();
    }
    for (let y = 0; y <= h; y += 20) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    }

    // Get round data
    const data = roundData(this.circuit, this.currentRound, this.inputs);
    const inputX = 40;
    const outputX = w - 50;
    const gateCount = data.gates.length;
    const inputCount = data.inputLabels.length;
    const hideOutput = this.circuit.mode === 'predict' && this.selectedAnswer === null;

    // Draw input terminals
    c.font = '600 10px "JetBrains Mono", monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    for (let i = 0; i < inputCount; i++) {
      const y = h * (i + 1) / (inputCount + 1);
      const isOn = i < this.inputs.length && this.inputs[i];

      // Terminal circle
      c.beginPath();
      c.arc(inputX, y, 8, 0, Math.PI * 2);
      c.fillStyle = isOn ? C_WIRE_ON : C_WIRE_OFF;
      c.fill();
      c.strokeStyle = C_COPPER;
      c.lineWidth = 1.5;
      c.stroke();

      // Label
      c.fillStyle = isOn ? C_GAS_YELLOW : `${C_CREAM}88`;
      c.font = 'bold 10px "JetBrains Mono", monospace';
      c.fillText(data.inputLabels[i], inputX - 22, y);

      // Value
      c.font = 'bold 9px "JetBrains Mono", monospace';
      c.fillStyle = isOn ? C_GAS_YELLOW : `${C_CREAM}66`;
      c.fillText(isOn ? '1' : '0', inputX, y);
    }

    // Draw gates
    for (let gi = 0; gi < gateCount; gi++) {
      const gate = data.gates[gi];
      const gateX = w * (gi + 1) / (gateCount + 1);
      const gateY = h / 2;

      // Input wires to gate
      for (let ii = 0; ii < gate.inputIndices.length; ii++) {
        const inputIdx = gate.inputIndices[ii];
        let fromX: number, fromY: number;

        if (inputIdx >= 100) {
          const prevGi = inputIdx - 100;
          fromX = w * (prevGi + 1) / (gateCount + 1) + 22;
          fromY = h / 2;
        } else {
          fromX = inputX + 8;
          fromY = h * (inputIdx + 1) / (inputCount + 1);
        }

        const wireVal = gate.inputValues[ii];
        c.beginPath();
        c.moveTo(fromX, fromY);
        c.lineTo(gateX - 22, gateY + (ii === 0 ? -8 : 8));
        c.strokeStyle = wireVal ? C_WIRE_ON : C_WIRE_OFF;
        c.lineWidth = 2;
        c.stroke();
      }

      // Gate shape
      this.drawGateShape(c, gate, gateX, gateY);

      // Output wire from gate
      const outX = gi < gateCount - 1
        ? w * (gi + 2) / (gateCount + 1) - 22
        : outputX - 8;
      const outY = h / 2;

      c.beginPath();
      c.moveTo(gateX + 22, gateY);
      c.lineTo(outX, outY);
      c.strokeStyle = (gi === gateCount - 1 && hideOutput) ? C_WIRE_OFF : (gate.output ? C_WIRE_ON : C_WIRE_OFF);
      c.lineWidth = 2;
      c.stroke();
    }

    // Output terminal
    const outY = h / 2;
    const finalOutput = data.gates.length > 0 ? data.gates[data.gates.length - 1].output : false;
    c.beginPath();
    c.arc(outputX, outY, 8, 0, Math.PI * 2);
    c.fillStyle = hideOutput ? C_WIRE_OFF : (finalOutput ? C_WIRE_ON : C_WIRE_OFF);
    c.fill();
    c.strokeStyle = C_COPPER;
    c.lineWidth = 1.5;
    c.stroke();

    // Output label
    c.font = 'bold 11px "JetBrains Mono", monospace';
    c.fillStyle = C_CREAM;
    c.fillText(this.circuit.mode === 'predict' ? '?' : (finalOutput ? '1' : '0'), outputX, outY);

    // Target indicator for find-inputs mode
    if (this.circuit.mode === 'findInputs') {
      const target = data.targetOutput;
      c.font = 'bold 10px "JetBrains Mono", monospace';
      c.fillStyle = target ? C_GAS_YELLOW : C_RAIL_RED;
      c.fillText(`TARGET: ${target ? '1' : '0'}`, outputX, outY + 20);
    }

    c.restore();
  }

  private drawGateShape(c: CanvasRenderingContext2D, gate: BLGate, x: number, y: number): void {
    const gw = 40, gh = 30;

    switch (gate.type) {
      case 'and': {
        c.beginPath();
        c.moveTo(x - gw / 2, y - gh / 2);
        c.lineTo(x, y - gh / 2);
        c.arc(x, y, gh / 2, -Math.PI / 2, Math.PI / 2);
        c.lineTo(x - gw / 2, y + gh / 2);
        c.closePath();
        c.fillStyle = C_GATE_BODY;
        c.fill();
        c.strokeStyle = C_COPPER;
        c.lineWidth = 1.5;
        c.stroke();
        c.font = 'bold 7px "JetBrains Mono", monospace';
        c.fillStyle = C_CREAM;
        c.fillText('AND', x - 4, y);
        break;
      }
      case 'or': {
        c.beginPath();
        c.moveTo(x - gw / 2, y - gh / 2);
        c.quadraticCurveTo(x + 4, y - gh / 2, x + gw / 2, y);
        c.quadraticCurveTo(x + 4, y + gh / 2, x - gw / 2, y + gh / 2);
        c.quadraticCurveTo(x - gw / 4, y, x - gw / 2, y - gh / 2);
        c.fillStyle = C_GATE_BODY;
        c.fill();
        c.strokeStyle = C_COPPER;
        c.lineWidth = 1.5;
        c.stroke();
        c.font = 'bold 7px "JetBrains Mono", monospace';
        c.fillStyle = C_CREAM;
        c.fillText('OR', x, y);
        break;
      }
      case 'not': {
        c.beginPath();
        c.moveTo(x - gw / 2, y - gh / 2);
        c.lineTo(x + gw / 3, y);
        c.lineTo(x - gw / 2, y + gh / 2);
        c.closePath();
        c.fillStyle = C_GATE_BODY;
        c.fill();
        c.strokeStyle = C_COPPER;
        c.lineWidth = 1.5;
        c.stroke();
        // Bubble
        c.beginPath();
        c.arc(x + gw / 3 + 4, y, 4, 0, Math.PI * 2);
        c.fillStyle = C_GATE_BODY;
        c.fill();
        c.strokeStyle = C_COPPER;
        c.lineWidth = 1.5;
        c.stroke();
        c.font = 'bold 6px "JetBrains Mono", monospace';
        c.fillStyle = C_CREAM;
        c.fillText('NOT', x - 4, y);
        break;
      }
      case 'xor': {
        c.beginPath();
        c.moveTo(x - gw / 2, y - gh / 2);
        c.quadraticCurveTo(x + 4, y - gh / 2, x + gw / 2, y);
        c.quadraticCurveTo(x + 4, y + gh / 2, x - gw / 2, y + gh / 2);
        c.quadraticCurveTo(x - gw / 4, y, x - gw / 2, y - gh / 2);
        c.fillStyle = C_GATE_BODY;
        c.fill();
        c.strokeStyle = C_COPPER;
        c.lineWidth = 1.5;
        c.stroke();
        // Extra input curve
        c.beginPath();
        c.moveTo(x - gw / 2 - 4, y - gh / 2);
        c.quadraticCurveTo(x - gw / 4 - 4, y, x - gw / 2 - 4, y + gh / 2);
        c.strokeStyle = C_COPPER;
        c.lineWidth = 1.5;
        c.stroke();
        c.font = 'bold 6px "JetBrains Mono", monospace';
        c.fillStyle = C_CREAM;
        c.fillText('XOR', x, y);
        break;
      }
      case 'nand': {
        c.beginPath();
        c.moveTo(x - gw / 2, y - gh / 2);
        c.lineTo(x - 2, y - gh / 2);
        c.arc(x - 2, y, gh / 2, -Math.PI / 2, Math.PI / 2);
        c.lineTo(x - gw / 2, y + gh / 2);
        c.closePath();
        c.fillStyle = C_GATE_BODY;
        c.fill();
        c.strokeStyle = C_COPPER;
        c.lineWidth = 1.5;
        c.stroke();
        // Bubble
        c.beginPath();
        c.arc(x + gh / 2 - 2, y, 4, 0, Math.PI * 2);
        c.fillStyle = C_GATE_BODY;
        c.fill();
        c.strokeStyle = C_COPPER;
        c.lineWidth = 1.5;
        c.stroke();
        c.font = 'bold 5px "JetBrains Mono", monospace';
        c.fillStyle = C_CREAM;
        c.fillText('NAND', x - 6, y);
        break;
      }
    }
  }

  /* ═══════════════════ UI refresh ════════════════════════════════ */

  private refreshUI(): void {
    // Lives (bolt icons)
    if (this.livesEl) {
      this.livesEl.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const bolt = document.createElement('span');
        bolt.textContent = '⚡';
        Object.assign(bolt.style, {
          fontSize: '14px', opacity: i < this.lives ? '1' : '0.2',
          filter: i < this.lives ? 'none' : 'grayscale(1)',
        });
        this.livesEl.appendChild(bolt);
      }
    }

    // Instruction
    if (this.instructionEl) {
      const modeText = this.circuit.mode === 'predict' ? 'Predict the output' : 'Find inputs for target output';
      this.instructionEl.innerHTML = `
        <div style="font-size:13px;font-weight:600;color:${C_CREAM}">${modeText}</div>
        <div style="font-size:11px;color:${C_CREAM}99;margin-top:2px">${this.circuit.gateDescription}</div>
      `;
    }

    // Progress bar
    if (this.progressEl) {
      this.progressEl.innerHTML = '';
      for (let i = 0; i < this.circuit.rounds; i++) {
        const seg = document.createElement('div');
        let bg: string;
        if (i < this.currentRound) bg = C_PURPLE;
        else if (i === this.currentRound) bg = `${C_PURPLE}66`;
        else bg = `${C_CREAM}1a`;
        Object.assign(seg.style, { flex: '1', height: '4px', borderRadius: '2px', background: bg });
        this.progressEl.appendChild(seg);
      }
    }

    // Controls
    if (this.controlsEl) {
      this.controlsEl.innerHTML = '';
      if (this.phase === 'playing') {
        if (this.circuit.mode === 'predict') {
          this.buildPredictControls();
        } else {
          this.buildInputToggles();
        }
      }
    }

    // Feedback
    if (this.feedbackEl) {
      this.feedbackEl.textContent = this.feedbackText;
      if (this.feedbackText.includes('\u2713')) {
        this.feedbackEl.style.color = C_GAS_YELLOW;
      } else if (this.feedbackText.includes('\u2717')) {
        this.feedbackEl.style.color = C_RAIL_RED;
      } else {
        this.feedbackEl.style.color = `${C_CREAM}aa`;
      }
    }

    // Hint
    if (this.hintEl) {
      this.hintEl.style.display = this.showHint ? 'block' : 'none';
      this.hintEl.textContent = `💡 ${this.circuit.hint}`;
    }

    // Draw circuit
    this.drawCircuit();

    // Check for result overlay
    if (this.phase === 'won' || this.phase === 'lost') {
      this.showResultOverlay();
    }
  }

  private buildPredictControls(): void {
    if (!this.controlsEl) return;

    const label = document.createElement('div');
    Object.assign(label.style, { fontSize: '12px', color: `${C_CREAM}99`, fontWeight: '500' });
    label.textContent = 'What is the output?';
    this.controlsEl.appendChild(label);

    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '16px' });

    for (const val of [false, true]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = val ? '1' : '0';
      const isSelected = this.selectedAnswer === val;
      Object.assign(btn.style, {
        width: '64px', height: '50px', fontSize: '22px', fontWeight: '700',
        fontFamily: '"JetBrains Mono", monospace',
        background: val ? C_MAROON : C_GATE_BODY,
        color: val ? C_GAS_YELLOW : C_CREAM,
        border: `${isSelected ? '2' : '1'}px solid ${isSelected ? C_PURPLE : C_COPPER + '55'}`,
        borderRadius: '10px', cursor: 'pointer',
      });
      btn.addEventListener('click', () => this.submitPrediction(val));
      row.appendChild(btn);
    }
    this.controlsEl.appendChild(row);
  }

  private buildInputToggles(): void {
    if (!this.controlsEl) return;

    const label = document.createElement('div');
    Object.assign(label.style, { fontSize: '12px', color: `${C_CREAM}99`, fontWeight: '500' });
    label.textContent = 'Toggle inputs to match target';
    this.controlsEl.appendChild(label);

    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' });

    const data = roundData(this.circuit, this.currentRound, this.inputs);

    for (let i = 0; i < this.inputs.length; i++) {
      const isOn = this.inputs[i];
      const btn = document.createElement('button');
      btn.type = 'button';
      Object.assign(btn.style, {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
        padding: '6px 8px', background: isOn ? C_MAROON : C_GATE_BODY,
        border: `1px solid ${C_COPPER}55`, borderRadius: '8px', cursor: 'pointer',
      });
      btn.innerHTML = `
        <span style="font-size:10px;font-family:'JetBrains Mono',monospace;color:${C_CREAM}88">${data.inputLabels[i]}</span>
        <span style="font-size:18px;font-weight:700;font-family:'JetBrains Mono',monospace;color:${isOn ? C_GAS_YELLOW : C_CREAM + '55'}">${isOn ? '1' : '0'}</span>
      `;
      btn.addEventListener('click', () => this.toggleInput(i));
      row.appendChild(btn);
    }

    // Submit button
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = 'SUBMIT';
    Object.assign(submit.style, {
      padding: '8px 16px', fontSize: '13px', fontWeight: '700',
      fontFamily: 'inherit', letterSpacing: '0.1em',
      color: C_PURPLE, background: `${C_PURPLE}1f`,
      border: `1.5px solid ${C_PURPLE}88`, borderRadius: '20px', cursor: 'pointer',
    });
    submit.addEventListener('click', () => this.submitInputs());
    row.appendChild(submit);

    this.controlsEl.appendChild(row);
  }

  /* ═══════════════════ Game logic ════════════════════════════════ */

  private toggleInput(index: number): void {
    if (this.phase !== 'playing' || index >= this.inputs.length) return;
    this.inputs[index] = !this.inputs[index];
    this.refreshUI();
  }

  private submitPrediction(value: boolean): void {
    if (this.phase !== 'playing') return;
    this.selectedAnswer = value;

    const data = roundData(this.circuit, this.currentRound, this.inputs);
    const correct = data.gates.length > 0 ? data.gates[data.gates.length - 1].output : false;

    if (value === correct) {
      this.score++;
      this.feedbackText = '\u2713 Correct!';
    } else {
      this.lives--;
      this.feedbackText = `\u2717 Wrong! Output was ${correct ? '1' : '0'}`;
      this.triggerShake();
    }

    this.advanceRound();
  }

  private submitInputs(): void {
    if (this.phase !== 'playing') return;

    const data = roundData(this.circuit, this.currentRound, this.inputs);
    const actual = data.gates.length > 0 ? data.gates[data.gates.length - 1].output : false;
    const target = data.targetOutput;

    if (actual === target) {
      this.score++;
      this.feedbackText = '\u2713 Correct!';
    } else {
      this.lives--;
      this.feedbackText = '\u2717 Wrong inputs!';
      this.triggerShake();
    }

    this.advanceRound();
  }

  private advanceRound(): void {
    if (this.lives <= 0) {
      setTimeout(() => { this.phase = 'lost'; this.refreshUI(); }, 1200);
      this.refreshUI();
      return;
    }

    setTimeout(() => {
      this.feedbackText = '';
      this.selectedAnswer = null;
      if (this.currentRound + 1 < this.circuit.rounds) {
        this.currentRound++;
        this.generateInputs();
        this.refreshUI();
      } else {
        this.phase = 'won';
        this.refreshUI();
      }
    }, 1200);

    this.refreshUI();
  }

  private triggerShake(): void {
    if (this.canvasEl) {
      this.canvasEl.style.animation = 'bg-shake 0.3s ease';
      setTimeout(() => { if (this.canvasEl) this.canvasEl.style.animation = ''; }, 350);
    }
  }

  /* ═══════════════════ Result overlay ════════════════════════════ */

  private showResultOverlay(): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const won = this.phase === 'won';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '320px', width: '90%', padding: '28px', textAlign: 'center',
      background: `${C_DARK_BG}f8`,
      border: `2px solid ${won ? C_COPPER : C_RAIL_RED}`,
      borderRadius: '16px',
      boxShadow: `0 0 40px ${won ? C_GAS_YELLOW + '22' : C_RAIL_RED + '22'}`,
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      animation: 'bg-pop 0.25s ease-out',
    });

    // Decorative rule
    const deco = `<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin:8px 0">
      <div style="width:30px;height:1px;background:${C_COPPER}88"></div>
      <span style="color:${C_COPPER}99;font-size:10px">◆</span>
      <div style="width:30px;height:1px;background:${C_COPPER}88"></div>
    </div>`;

    // Badge
    let badge: string;
    if (won) {
      badge = `<div style="width:80px;height:80px;margin:0 auto 12px;border-radius:50%;background:${C_COPPER};display:flex;align-items:center;justify-content:center;font-size:32px;box-shadow:0 0 20px ${C_GAS_YELLOW}44">⚙️</div>`;
    } else {
      badge = `<div style="width:56px;height:56px;margin:0 auto 12px;border-radius:50%;background:${C_RAIL_RED};display:flex;align-items:center;justify-content:center;font-size:24px">✗</div>`;
    }

    const title = won ? 'CIRCUIT COMPLETE' : 'SHORT CIRCUIT';
    const titleColor = won ? C_GAS_YELLOW : C_RAIL_RED;
    const msg = won
      ? 'You have mastered Boolean logic!'
      : 'The circuit failed. Try again.';
    const scoreText = won
      ? `<div style="margin:8px 0;font-size:14px;color:${C_GAS_YELLOW};font-weight:700;font-family:'JetBrains Mono',monospace">${this.score}/${this.circuit.rounds} correct</div>`
      : '';

    const btnLabel = won ? 'CONTINUE' : 'TRY AGAIN';
    const btnColor = won ? C_GAS_YELLOW : C_RAIL_RED;

    card.innerHTML = `
      ${deco}
      ${badge}
      <div style="font-size:20px;font-weight:700;color:${titleColor};letter-spacing:0.1em">${title}</div>
      <div style="font-size:13px;color:${C_CREAM}cc;margin:6px 0">${msg}</div>
      ${scoreText}
      ${deco}
    `;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = btnLabel;
    Object.assign(btn.style, {
      marginTop: '12px', padding: '10px 28px', fontSize: '14px', fontWeight: '700',
      fontFamily: 'inherit', letterSpacing: '0.2em',
      color: C_DARK_BG, background: btnColor, border: 'none',
      borderRadius: '20px', cursor: 'pointer',
    });
    btn.addEventListener('click', () => {
      if (won) {
        this.isSolved = true;
        this.overlayEl!.style.display = 'none';
        this.onSolved?.();
      } else {
        this.overlayEl!.style.display = 'none';
        this.setupLevel();
        this.refreshUI();
      }
    });
    card.appendChild(btn);

    this.overlayEl.appendChild(card);
  }

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('boolean-gates-anims');
    if (animStyle) animStyle.remove();
    this.ctx2d = null;
    this.canvasEl = null;
    this.overlayEl = null;
    this.progressEl = null;
    this.instructionEl = null;
    this.controlsEl = null;
    this.feedbackEl = null;
    this.livesEl = null;
    this.hintEl = null;
    super.dispose();
  }
}
