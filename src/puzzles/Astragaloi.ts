import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Vector2,
  Vector3,
} from 'three';
import { Puzzle } from './PuzzleBase.ts';

/**
 * Astragaloi — the Greek knucklebone toss. Three bones fall onto a stone
 * table; each bone lands on one of four historic faces (1, 3, 4, 6). The
 * player combines the values with addition and subtraction to match a
 * target. Best-of-three wins the checkpoint.
 *
 * The three bones are actual 3D boxes that tumble on each roll, marked with
 * pip counts on every face. The target display, operator buttons, running
 * expression, and round tracker all live in a DOM panel on the left of the
 * table so the bones stay visible.
 */

const BONE_FACES: readonly number[] = [1, 3, 4, 6];
const MAX_BONES = 5;
const TOTAL_ROUNDS = 5;
const ROUNDS_TO_WIN = 3;
const ROLL_DUR = 1.1;

type Op = '+' | '-' | '×' | '÷';

interface RoundSpec {
  readonly bones: number;
  readonly ops: readonly Op[];
  readonly targetMin: number;
  readonly targetMax: number;
  readonly label: string;
}

// Five rounds of escalating difficulty — more bones, more operators, higher
// targets. The first two are addition/subtraction only so the player learns
// the controls, then multiplication enters, then division for the final push.
const ROUNDS: readonly RoundSpec[] = [
  { bones: 3, ops: ['+', '-'], targetMin: 2, targetMax: 15, label: 'apprentice' },
  { bones: 3, ops: ['+', '-', '×'], targetMin: 2, targetMax: 25, label: 'initiate' },
  { bones: 4, ops: ['+', '-', '×'], targetMin: 3, targetMax: 35, label: 'agora' },
  { bones: 4, ops: ['+', '-', '×', '÷'], targetMin: 5, targetMax: 45, label: 'gymnasium' },
  { bones: 5, ops: ['+', '-', '×', '÷'], targetMin: 5, targetMax: 55, label: 'oracle' },
];

interface Bone {
  readonly mesh: Mesh;
  value: number;
  consumed: boolean;
  roll: { from: Vector3; to: Vector3; t: number; dur: number; active: boolean; spin: Vector3 };
  originPos: Vector3;
}

/* Greek Ionic numerals for flavour — only the ones we ever render. */
const GREEK_UNITS = ['', 'α', 'β', 'γ', 'δ', 'ε', 'ϛ', 'ζ', 'η', 'θ'];
const GREEK_TENS = ['', 'ι', 'κ', 'λ', 'μ'];

function greekNumeral(n: number): string {
  if (n <= 0 || n >= 50) return String(n);
  const tens = Math.floor(n / 10);
  const units = n % 10;
  return (GREEK_TENS[tens] ?? '') + (GREEK_UNITS[units] ?? '');
}

function makeFaceTexture(pips: number): CanvasTexture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  if (!g) return new CanvasTexture(c);

  // Weathered bone colour with subtle grain.
  const grad = g.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, '#f2e6c4');
  grad.addColorStop(1, '#bba275');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  g.strokeStyle = '#5a4622';
  g.lineWidth = 4;
  g.strokeRect(3, 3, s - 6, s - 6);

  // Pip layout — centres normalised to [0..1].
  const layouts: Record<number, Array<[number, number]>> = {
    1: [[0.5, 0.5]],
    3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
    6: [
      [0.27, 0.22], [0.73, 0.22],
      [0.27, 0.5], [0.73, 0.5],
      [0.27, 0.78], [0.73, 0.78],
    ],
  };
  const pts = layouts[pips] ?? [];
  g.fillStyle = '#3a2408';
  for (const [nx, ny] of pts) {
    g.beginPath();
    g.arc(nx * s, ny * s, s * 0.07, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new CanvasTexture(c);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  return tex;
}

function faceMaterials(): MeshStandardMaterial[] {
  // Build six materials for a box: +X/-X/+Y/-Y/+Z/-Z. The four historic
  // faces are 1, 3, 4, 6; the two "absent" faces get blank end-caps so the
  // bone reads from any angle.
  const blank = new MeshStandardMaterial({
    color: 0xbba275,
    roughness: 0.65,
    metalness: 0.12,
  });
  const mats: MeshStandardMaterial[] = [];
  for (const pips of [1, 6, -1, -1, 3, 4]) {
    if (pips < 0) {
      mats.push(blank.clone());
    } else {
      mats.push(
        new MeshStandardMaterial({
          map: makeFaceTexture(pips),
          roughness: 0.55,
          metalness: 0.1,
        }),
      );
    }
  }
  return mats;
}

// Mapping from a desired pip value to an Euler rotation that puts that face on
// top. Material order above is [+X=1, -X=6, +Y=blank, -Y=blank, +Z=3, -Z=4].
// We always land with +Y = top, so rotate the bone to move the chosen face onto +Y.
function restRotationFor(value: number): Vector3 {
  switch (value) {
    case 1:
      return new Vector3(0, 0, -Math.PI / 2); // +X becomes +Y
    case 6:
      return new Vector3(0, 0, Math.PI / 2); // -X becomes +Y
    case 3:
      return new Vector3(Math.PI / 2, 0, 0); // +Z becomes +Y
    case 4:
      return new Vector3(-Math.PI / 2, 0, 0); // -Z becomes +Y
    default:
      return new Vector3(0, 0, 0);
  }
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export class AstragaloiPuzzle extends Puzzle {
  readonly title = 'ASTRAGALOI';
  readonly subtitle = 'the knucklebone toss';
  readonly instructions =
    'Toss the bones, then combine their values with + and − to hit the target. First to two round wins clears the gate.';

  private bones: Bone[] = [];
  private phase: 'rolling' | 'playing' | 'round-end' | 'done' = 'rolling';
  private target = 0;
  private round = 0;
  private roundsWon = 0;

  private expr: Array<{ kind: 'num'; boneIndex: number; value: number } | { kind: 'op'; op: Op }> = [];
  private pendingOp: Op | null = null;

  private root: HTMLDivElement | null = null;
  private targetEl: HTMLDivElement | null = null;
  private roundEl: HTMLDivElement | null = null;
  private exprEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private rollBtn: HTMLButtonElement | null = null;
  private undoBtn: HTMLButtonElement | null = null;
  private resetBtn: HTMLButtonElement | null = null;
  private boneBtns: HTMLButtonElement[] = [];
  private opBtns: Partial<Record<Op, HTMLButtonElement>> = {};

  private spec(): RoundSpec {
    const idx = Math.min(Math.max(this.round, 1), TOTAL_ROUNDS) - 1;
    return ROUNDS[idx];
  }
  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.buildBones();
    this.buildDom();
    this.startRound();
  }

  /* ----------------------------- Backdrop -------------------------------- */

  private buildBackdrop(): void {
    const table = new Mesh(
      new PlaneGeometry(14, 10),
      new MeshStandardMaterial({
        color: new Color('#2a2012'),
        roughness: 0.92,
        metalness: 0.08,
        side: DoubleSide,
      }),
    );
    table.rotation.x = -Math.PI / 2;
    table.position.y = -1.2;
    this.group.add(table);

    const warm = new PointLight('#f5cf82', 1.9, 18, 1.7);
    warm.position.set(0, 4.5, 3);
    this.group.add(warm);

    const cool = new PointLight('#6faaff', 0.6, 14, 1.8);
    cool.position.set(-3, 2.5, -3);
    this.group.add(cool);
  }

  /* ------------------------------ Bones ---------------------------------- */

  private buildBones(): void {
    const spacing = 1.35;
    for (let i = 0; i < MAX_BONES; i++) {
      const mesh = new Mesh(new BoxGeometry(0.85, 0.85, 0.85), faceMaterials());
      const x = (i - (MAX_BONES - 1) / 2) * spacing;
      const origin = new Vector3(x, 0, 1);
      mesh.position.copy(origin);
      this.group.add(mesh);
      this.bones.push({
        mesh,
        value: 1,
        consumed: false,
        originPos: origin,
        roll: {
          from: new Vector3(),
          to: new Vector3(),
          t: 0,
          dur: 0,
          active: false,
          spin: new Vector3(),
        },
      });
    }
  }

  /** How many bones this round uses — the rest are hidden. */
  private activeBoneCount(): number {
    return this.spec().bones;
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-astragaloi';
    root.style.cssText = `
      position:fixed; inset:0; pointer-events:none; z-index:20;
      font-family:'Cormorant Garamond', Georgia, serif; color:#e6eefb;
    `;
    this.root = root;

    const panel = document.createElement('div');
    panel.style.cssText = `
      position:absolute; left:32px; top:50%; transform:translateY(-50%);
      display:flex; flex-direction:column; gap:14px; width:300px;
      pointer-events:auto;
      padding:18px 22px;
      background:rgba(10,18,34,0.78); backdrop-filter:blur(12px);
      border:1px solid rgba(159,200,255,0.25);
      border-left:3px solid var(--era-accent);
      border-radius:10px;
      box-shadow:0 18px 60px rgba(0,0,0,0.55);
    `;
    root.appendChild(panel);

    const title = document.createElement('div');
    title.style.cssText =
      'font-size:16px; letter-spacing:0.32em; color:var(--era-accent); font-weight:600;';
    title.textContent = 'ASTRAGALOI';
    panel.appendChild(title);

    const round = document.createElement('div');
    round.style.cssText = 'font-size:12px; letter-spacing:0.2em; opacity:0.7;';
    this.roundEl = round;
    panel.appendChild(round);

    const targetBox = document.createElement('div');
    targetBox.style.cssText = `
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:14px 0;
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(159,200,255,0.25);
      border-radius:8px;
    `;
    const targetHdr = document.createElement('div');
    targetHdr.style.cssText =
      'font-size:11px; letter-spacing:0.3em; opacity:0.6; margin-bottom:4px;';
    targetHdr.textContent = 'TARGET';
    targetBox.appendChild(targetHdr);
    const targetVal = document.createElement('div');
    targetVal.style.cssText =
      'font-size:38px; font-weight:600; letter-spacing:0.04em; color:var(--era-accent);';
    this.targetEl = targetVal;
    targetBox.appendChild(targetVal);
    panel.appendChild(targetBox);

    const expr = document.createElement('div');
    expr.style.cssText = `
      min-height:34px; padding:8px 10px;
      font-size:18px; letter-spacing:0.08em; text-align:center;
      background:rgba(0,0,0,0.3); border-radius:6px;
      font-family:'JetBrains Mono', Menlo, monospace;
    `;
    this.exprEl = expr;
    panel.appendChild(expr);

    // Bone buttons row — all MAX_BONES buttons exist; we hide the unused
    // ones per round via display:none.
    const boneRow = document.createElement('div');
    boneRow.style.cssText = 'display:flex; gap:6px; justify-content:space-between;';
    for (let i = 0; i < MAX_BONES; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.boneIndex = String(i);
      b.style.cssText = `
        flex:1; padding:10px 0;
        background:rgba(159,200,255,0.08);
        border:1px solid rgba(159,200,255,0.3);
        color:#e6eefb;
        font-family:inherit; font-size:17px; font-weight:600;
        border-radius:6px; cursor:pointer;
      `;
      b.addEventListener('click', () => this.pickBone(i));
      boneRow.appendChild(b);
      this.boneBtns.push(b);
    }
    panel.appendChild(boneRow);

    // Op buttons row — all four operators rendered; per-round spec hides
    // the ones not yet available.
    const opRow = document.createElement('div');
    opRow.style.cssText = 'display:flex; gap:6px;';
    for (const op of ['+', '-', '×', '÷'] as Op[]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = op === '-' ? '−' : op;
      b.style.cssText = `
        flex:1; padding:10px 0;
        background:rgba(255,255,255,0.04);
        border:1px solid rgba(159,200,255,0.3);
        color:var(--era-accent);
        font-family:inherit; font-size:20px; font-weight:700;
        border-radius:6px; cursor:pointer;
      `;
      b.addEventListener('click', () => this.pickOp(op));
      opRow.appendChild(b);
      this.opBtns[op] = b;
    }
    panel.appendChild(opRow);

    // Control buttons row.
    const ctrlRow = document.createElement('div');
    ctrlRow.style.cssText = 'display:flex; gap:8px;';
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.textContent = 'UNDO';
    undo.style.cssText = this.smallBtnStyle();
    undo.addEventListener('click', () => this.undo());
    this.undoBtn = undo;
    ctrlRow.appendChild(undo);

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'CLEAR';
    reset.style.cssText = this.smallBtnStyle();
    reset.addEventListener('click', () => this.clearExpr());
    this.resetBtn = reset;
    ctrlRow.appendChild(reset);
    panel.appendChild(ctrlRow);

    const roll = document.createElement('button');
    roll.type = 'button';
    roll.textContent = 'TOSS THE BONES';
    roll.style.cssText = `
      pointer-events:auto; padding:11px 0;
      background:rgba(159,200,255,0.12);
      border:1px solid rgba(159,200,255,0.45);
      color:var(--era-accent);
      font-family:inherit; font-size:13px; letter-spacing:0.28em; font-weight:700;
      border-radius:6px; cursor:pointer;
    `;
    roll.addEventListener('click', () => this.startRound());
    this.rollBtn = roll;
    panel.appendChild(roll);

    const status = document.createElement('div');
    status.style.cssText =
      'min-height:20px; font-size:13px; letter-spacing:0.06em; text-align:center; opacity:0.85;';
    this.statusEl = status;
    panel.appendChild(status);

    document.body.appendChild(root);
  }

  private smallBtnStyle(): string {
    return `
      flex:1; padding:8px 0;
      background:rgba(255,255,255,0.03);
      border:1px solid rgba(159,200,255,0.2);
      color:#e6eefb; opacity:0.85;
      font-family:inherit; font-size:11px; letter-spacing:0.2em; font-weight:600;
      border-radius:5px; cursor:pointer;
    `;
  }

  /* ----------------------------- Game flow ------------------------------- */

  private startRound(): void {
    if (this.phase === 'done') return;
    // First entry from init() has round=0. Subsequent entries must come
    // from round-end (the Toss Again button).
    if (this.round > 0 && this.phase !== 'round-end') return;
    this.round += 1;
    if (this.round > TOTAL_ROUNDS) return;
    const spec = this.spec();
    this.expr = [];
    this.pendingOp = null;
    for (const bone of this.bones) bone.consumed = false;
    // Hide bones beyond the active count for this round; show the ones in use.
    for (let i = 0; i < this.bones.length; i++) {
      this.bones[i].mesh.visible = i < spec.bones;
    }
    this.phase = 'rolling';
    // Roll first so the bone values are fixed, THEN pick a target that is
    // actually reachable with those exact values. Picking a target from
    // phantom values before the roll would let unreachable matchups slip in.
    this.rollBones();
    this.target = this.pickReachableTarget(spec);
    this.refreshDom();
  }

  /** Pick a target reachable from the bones' *current* values. Must be called
   *  after rollBones() so we match the dice actually on the table. */
  private pickReachableTarget(spec: RoundSpec): number {
    const values = this.bones.slice(0, spec.bones).map((b) => b.value);
    // Enumerate everything reachable and sample a candidate within the spec's
    // target window. Space is small (≤5 bones × ≤4 ops) so full enumeration
    // is instant.
    const reachable = new Set<number>();
    const used = values.map(() => false);
    const walk = (acc: number, depth: number): void => {
      if (depth === values.length) {
        reachable.add(acc);
        return;
      }
      for (let i = 0; i < values.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        for (const op of depth === 0 ? (['+'] as Op[]) : spec.ops) {
          const next = depth === 0 ? values[i] : this.applyOp(acc, op, values[i]);
          if (next === null || !Number.isFinite(next)) continue;
          walk(next, depth + 1);
        }
        used[i] = false;
      }
    };
    walk(0, 0);
    const pool = [...reachable].filter(
      (v) => Number.isInteger(v) && v >= spec.targetMin && v <= spec.targetMax,
    );
    if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
    // No reachable candidate in the preferred window — fall back to any
    // reachable integer, or finally the bones' sum.
    const any = [...reachable].filter((v) => Number.isInteger(v) && v > 0);
    if (any.length > 0) return any[Math.floor(Math.random() * any.length)];
    return values.reduce((a, b) => a + b, 0);
  }

  private applyOp(a: number, op: Op, b: number): number | null {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '×':
        return a * b;
      case '÷':
        if (b === 0 || a % b !== 0) return null;
        return a / b;
    }
  }

  private rollBones(): void {
    const active = this.activeBoneCount();
    for (let i = 0; i < this.bones.length; i++) {
      const bone = this.bones[i];
      if (i >= active) continue;
      bone.value = BONE_FACES[Math.floor(Math.random() * BONE_FACES.length)];
      const end = restRotationFor(bone.value);
      bone.roll.from.set(
        bone.mesh.position.x,
        bone.mesh.position.y,
        bone.mesh.position.z,
      );
      bone.roll.to.copy(bone.originPos);
      bone.roll.spin.set(
        end.x + Math.PI * 2 * (Math.random() < 0.5 ? -1 : 1) * rand(1, 2),
        end.y + Math.PI * 2 * rand(1, 2),
        end.z + Math.PI * 2 * (Math.random() < 0.5 ? -1 : 1) * rand(1, 2),
      );
      bone.roll.t = 0;
      bone.roll.dur = ROLL_DUR;
      bone.roll.active = true;
      // Start from slightly lifted off the table so the tumble reads.
      bone.mesh.position.set(
        bone.originPos.x + rand(-0.6, 0.6),
        2.2,
        bone.originPos.z + rand(-0.6, 0.6),
      );
      bone.mesh.rotation.set(rand(0, Math.PI * 2), rand(0, Math.PI * 2), rand(0, Math.PI * 2));
    }
    if (this.statusEl) this.statusEl.textContent = 'the bones are falling…';
  }

  private finishRoll(): void {
    this.phase = 'playing';
    // Lock each bone into its face-up rest rotation so pips read cleanly.
    for (const bone of this.bones) {
      const rest = restRotationFor(bone.value);
      bone.mesh.rotation.set(rest.x, rest.y, rest.z);
      bone.mesh.position.copy(bone.originPos);
    }
    if (this.statusEl) this.statusEl.textContent = 'pick a bone, then an operator';
    this.refreshDom();
  }

  /* --------------------------- Expression input --------------------------- */

  private pickBone(index: number): void {
    if (this.phase !== 'playing') return;
    if (index >= this.activeBoneCount()) return;
    const bone = this.bones[index];
    if (bone.consumed) return;
    if (this.expr.length === 0) {
      this.expr.push({ kind: 'num', boneIndex: index, value: bone.value });
    } else {
      if (!this.pendingOp) return;
      this.expr.push({ kind: 'op', op: this.pendingOp });
      this.expr.push({ kind: 'num', boneIndex: index, value: bone.value });
      this.pendingOp = null;
    }
    bone.consumed = true;
    this.evaluate();
    this.refreshDom();
  }

  private pickOp(op: Op): void {
    if (this.phase !== 'playing') return;
    if (!this.spec().ops.includes(op)) return;
    if (this.expr.length === 0) return;
    // Operator only has effect after a number; replace any existing pending op.
    this.pendingOp = op;
    this.refreshDom();
  }

  private undo(): void {
    if (this.phase !== 'playing') return;
    if (this.pendingOp) {
      this.pendingOp = null;
      this.refreshDom();
      return;
    }
    if (this.expr.length === 0) return;
    // Remove trailing number + preceding operator.
    const last = this.expr[this.expr.length - 1];
    if (last.kind === 'num') {
      this.bones[last.boneIndex].consumed = false;
      this.expr.pop();
      if (this.expr.length > 0 && this.expr[this.expr.length - 1].kind === 'op') {
        this.expr.pop();
      }
    }
    this.refreshDom();
  }

  private clearExpr(): void {
    if (this.phase !== 'playing') return;
    this.expr = [];
    this.pendingOp = null;
    for (let i = 0; i < this.activeBoneCount(); i++) this.bones[i].consumed = false;
    this.refreshDom();
  }

  private currentTotal(): number | null {
    if (this.expr.length === 0) return null;
    let total = 0;
    let currentOp: Op = '+';
    for (const tok of this.expr) {
      if (tok.kind === 'num') {
        const next = this.applyOp(total, currentOp, tok.value);
        if (next === null) return null; // unreachable mid-expression (e.g. non-integer ÷)
        total = next;
      } else {
        currentOp = tok.op;
      }
    }
    return total;
  }

  private evaluate(): void {
    // Once every active bone is consumed, judge the round.
    const active = this.activeBoneCount();
    let used = 0;
    for (let i = 0; i < active; i++) if (this.bones[i].consumed) used++;
    if (used < active) return;
    const total = this.currentTotal();
    const hit = total === this.target;
    if (hit) {
      this.roundsWon += 1;
      if (this.statusEl) this.statusEl.textContent = 'target struck — the oracle nods';
    } else if (this.statusEl) {
      this.statusEl.textContent = `reached ${total ?? '—'}, not ${this.target}`;
    }
    this.phase = 'round-end';
    // All five rounds must be played through — decide the match only at
    // the end, or early on a clinching win.
    if (this.roundsWon >= ROUNDS_TO_WIN) {
      this.completeGame(true);
    } else if (this.round >= TOTAL_ROUNDS) {
      this.completeGame(false);
    }
  }

  private completeGame(won: boolean): void {
    this.phase = 'done';
    if (this.statusEl) {
      this.statusEl.textContent = won
        ? 'the knucklebones favour you — gate cleared'
        : 'the oracle shakes her head. try again';
    }
    if (this.rollBtn) {
      this.rollBtn.textContent = won ? 'PROCEED' : 'THROW AGAIN';
      this.rollBtn.onclick = () => {
        if (won) {
          this.isSolved = true;
          this.onSolved?.();
        } else {
          // Reset the match.
          this.round = 0;
          this.roundsWon = 0;
          this.phase = 'rolling';
          this.startRound();
        }
      };
    }
    this.refreshDom();
  }

  /* ------------------------------ Render --------------------------------- */

  private refreshDom(): void {
    const spec = this.spec();
    if (this.roundEl) {
      const lbl = this.round >= 1 ? ` · ${spec.label}` : '';
      this.roundEl.textContent = `ROUND ${Math.min(this.round, TOTAL_ROUNDS)} / ${TOTAL_ROUNDS}  ·  WON ${this.roundsWon}${lbl}`;
    }
    if (this.targetEl) {
      this.targetEl.textContent = `${this.target}`;
      this.targetEl.setAttribute('title', `ionic: ${greekNumeral(this.target)}`);
    }
    if (this.exprEl) {
      const parts = this.expr.map((t) => (t.kind === 'num' ? String(t.value) : t.op));
      if (this.pendingOp) parts.push(this.pendingOp);
      const total = this.currentTotal();
      const line = parts.length === 0 ? '—' : parts.join(' ');
      this.exprEl.textContent = total !== null ? `${line} = ${total}` : line;
    }
    const active = this.activeBoneCount();
    for (let i = 0; i < this.boneBtns.length; i++) {
      const btn = this.boneBtns[i];
      const bone = this.bones[i];
      if (i >= active) {
        btn.style.display = 'none';
        continue;
      }
      btn.style.display = '';
      btn.textContent = this.phase === 'rolling' ? '…' : String(bone.value);
      const disabled = this.phase !== 'playing' || bone.consumed;
      btn.disabled = disabled;
      btn.style.opacity = disabled ? '0.3' : '1';
    }
    const interactive = this.phase === 'playing';
    for (const op of ['+', '-', '×', '÷'] as Op[]) {
      const b = this.opBtns[op];
      if (!b) continue;
      const allowed = spec.ops.includes(op);
      b.style.display = allowed ? '' : 'none';
      const disabled = !interactive || this.expr.length === 0;
      b.disabled = disabled;
      b.style.opacity = disabled ? '0.3' : '1';
      b.style.background =
        this.pendingOp === op ? 'rgba(159,200,255,0.25)' : 'rgba(255,255,255,0.04)';
    }
    if (this.undoBtn) this.undoBtn.disabled = !interactive;
    if (this.resetBtn) this.resetBtn.disabled = !interactive;
    if (this.rollBtn) {
      if (this.phase === 'playing') {
        this.rollBtn.disabled = true;
        this.rollBtn.style.opacity = '0.3';
      } else if (this.phase === 'round-end') {
        this.rollBtn.textContent = this.round >= TOTAL_ROUNDS ? '—' : 'NEXT TOSS';
        this.rollBtn.disabled = this.round >= TOTAL_ROUNDS;
        this.rollBtn.style.opacity = this.round >= TOTAL_ROUNDS ? '0.3' : '1';
      } else if (this.phase === 'rolling') {
        this.rollBtn.disabled = true;
        this.rollBtn.style.opacity = '0.5';
      }
    }
  }

  /* --------------------------- Lifecycle --------------------------------- */

  update(dt: number, camera: PerspectiveCamera): void {
    camera.position.set(2.5, 3.8, 5);
    camera.lookAt(2.5, -0.4, 1);

    let anyActive = false;
    for (const bone of this.bones) {
      if (!bone.roll.active) continue;
      bone.roll.t += dt;
      const k = Math.min(1, bone.roll.t / bone.roll.dur);
      // Ease-out cubic.
      const ease = 1 - Math.pow(1 - k, 3);
      // Ballistic arc: interpolate XZ, parabola for Y.
      bone.mesh.position.x = bone.roll.from.x + (bone.roll.to.x - bone.roll.from.x) * ease;
      bone.mesh.position.z = bone.roll.from.z + (bone.roll.to.z - bone.roll.from.z) * ease;
      const yBase = bone.roll.from.y + (bone.roll.to.y - bone.roll.from.y) * ease;
      const bounce = Math.sin(ease * Math.PI) * 0.8;
      bone.mesh.position.y = yBase + bounce;
      // Tumble: spin toward the rest rotation.
      const rest = restRotationFor(bone.value);
      bone.mesh.rotation.x = bone.roll.spin.x * (1 - ease) + rest.x * ease;
      bone.mesh.rotation.y = bone.roll.spin.y * (1 - ease) + rest.y * ease;
      bone.mesh.rotation.z = bone.roll.spin.z * (1 - ease) + rest.z * ease;
      if (k >= 1) {
        bone.roll.active = false;
      } else {
        anyActive = true;
      }
    }
    if (this.phase === 'rolling' && !anyActive) {
      this.finishRoll();
    }
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {
    // All input is via DOM buttons.
  }

  override dispose(): void {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this.targetEl = null;
    this.roundEl = null;
    this.exprEl = null;
    this.statusEl = null;
    this.rollBtn = null;
    this.undoBtn = null;
    this.resetBtn = null;
    this.boneBtns = [];
    this.opBtns = {};
    this.bones = [];
    super.dispose();
  }
}
