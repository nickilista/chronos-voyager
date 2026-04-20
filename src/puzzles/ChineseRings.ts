import {
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  TorusGeometry,
  Vector2,
} from 'three';
import { Puzzle } from './PuzzleBase.ts';

/**
 * Chinese Rings (baguenaudier). Six rings sit on a horizontal bar; each is
 * either ON (threaded on the bar) or OFF (hanging below). The legality rule:
 *
 *   • ring 0 (rightmost in classical ordering, leftmost in our rendering)
 *     may always be toggled;
 *   • ring i+1 may be toggled iff ring i is ON and rings 0..i-1 are OFF.
 *
 * The optimal solution count for n=6 is 42 moves. The puzzle is solved when
 * every ring is OFF. The scene draws the bar and rings in 3D; a DOM side
 * panel shows the legal moves, move count, and undo.
 */

const RING_COUNT = 6;
const OPTIMAL_MOVES = 42; // (2^(n+1) - 2) / 3 for even n

const BAR_LEN = 12;
const RING_SPACING = 1.5;
const RING_RADIUS = 0.7;
const RING_TUBE = 0.09;
const BAR_RADIUS = 0.13;

interface RingItem {
  readonly group: Group;
  readonly mesh: Mesh;
  readonly index: number;
  on: boolean;
  /** Animation easing from current visual y to target y. */
  animT: number;
}

const BAR_Y = 0.8;
const RING_Y_ON = BAR_Y;
const RING_Y_OFF = -0.9;
const ANIM_DUR = 0.35;

export class ChineseRingsPuzzle extends Puzzle {
  readonly title = 'NINE LINKED RINGS';
  readonly subtitle = 'jiǔ lián huán';
  readonly instructions =
    'Remove every ring from the bar. Only the first ring is always free — each subsequent ring needs the one before it ON and everything further in OFF.';

  private rings: RingItem[] = [];
  private moveCount = 0;
  private history: boolean[][] = [];

  private root: HTMLDivElement | null = null;
  private movesEl: HTMLDivElement | null = null;
  private legalEl: HTMLDivElement | null = null;
  private binaryEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private undoBtn: HTMLButtonElement | null = null;
  private ringBtns: HTMLButtonElement[] = [];

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.buildRings();
    this.buildDom();
    this.refresh();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const floor = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#1a1a22'),
        roughness: 0.65,
        metalness: 0.25,
        side: DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    this.group.add(floor);

    const warm = new PointLight('#f5b870', 2.4, 24, 1.6);
    warm.position.set(0, 5, 4);
    this.group.add(warm);

    const cool = new PointLight('#9acdea', 1.2, 18, 1.8);
    cool.position.set(-4, 3, -3);
    this.group.add(cool);

    // Horizontal bar (the "handle" across which rings thread).
    const barGeo = new CylinderGeometry(BAR_RADIUS, BAR_RADIUS, BAR_LEN, 32);
    const barMat = new MeshStandardMaterial({
      color: new Color('#c49a42'),
      roughness: 0.4,
      metalness: 0.85,
    });
    const bar = new Mesh(barGeo, barMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, BAR_Y, 0);
    this.group.add(bar);

    // Decorative posts at either end.
    for (const sx of [-1, 1]) {
      const post = new Mesh(
        new CylinderGeometry(0.18, 0.22, 1.2, 20),
        new MeshStandardMaterial({ color: new Color('#8a6428'), roughness: 0.6, metalness: 0.5 }),
      );
      post.position.set(sx * (BAR_LEN / 2), BAR_Y - 0.45, 0);
      this.group.add(post);
    }
  }

  /* --------------------------- Ring model -------------------------------- */

  private buildRings(): void {
    const ringMat = new MeshStandardMaterial({
      color: new Color('#e6c45a'),
      emissive: new Color('#2e1f08'),
      emissiveIntensity: 0.25,
      roughness: 0.32,
      metalness: 0.92,
    });
    const offset = -((RING_COUNT - 1) * RING_SPACING) / 2;
    for (let i = 0; i < RING_COUNT; i++) {
      const group = new Group();
      const mesh = new Mesh(new TorusGeometry(RING_RADIUS, RING_TUBE, 16, 48), ringMat);
      mesh.rotation.y = Math.PI / 2;
      group.add(mesh);
      group.position.set(offset + i * RING_SPACING, RING_Y_ON, 0);
      this.rings.push({ group, mesh, index: i, on: true, animT: 1 });
      this.group.add(group);
    }
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-chinese-rings';
    root.style.cssText = `
      position:fixed; inset:0; z-index:20; pointer-events:none;
      font-family:'Cormorant Garamond', Georgia, serif;
    `;
    this.root = root;

    const panel = document.createElement('div');
    panel.style.cssText = `
      position:absolute; left:32px; top:50%; transform:translateY(-50%);
      width:280px; pointer-events:auto;
      padding:18px 22px;
      background:rgba(10,18,34,0.78); backdrop-filter:blur(12px);
      border:1px solid rgba(159,200,255,0.25);
      border-top:3px solid var(--era-accent);
      border-radius:10px;
      box-shadow:0 18px 60px rgba(0,0,0,0.55);
      color:#e6eefb;
      display:flex; flex-direction:column; gap:12px;
    `;
    root.appendChild(panel);

    const title = document.createElement('div');
    title.style.cssText = `font-size:17px; letter-spacing:0.24em; color:var(--era-accent); font-weight:600;`;
    title.textContent = 'NINE LINKED RINGS';
    panel.appendChild(title);

    const moves = document.createElement('div');
    moves.style.cssText = `font-size:13px; letter-spacing:0.08em; opacity:0.8;`;
    this.movesEl = moves;
    panel.appendChild(moves);

    const binary = document.createElement('div');
    binary.style.cssText = `
      font-family:'Courier New', monospace; font-size:17px; letter-spacing:0.32em;
      background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:4px;
      text-align:center; color:#f3e7c8;
    `;
    this.binaryEl = binary;
    panel.appendChild(binary);

    // Ring buttons — one per ring, mirroring the 3D ordering.
    const ringRow = document.createElement('div');
    ringRow.style.cssText = `display:flex; gap:5px; justify-content:center;`;
    panel.appendChild(ringRow);
    for (let i = 0; i < RING_COUNT; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = String(i + 1);
      b.style.cssText = `
        width:34px; height:34px;
        background:rgba(159,200,255,0.08);
        border:1px solid rgba(159,200,255,0.35);
        color:var(--era-accent);
        font-family:'Cormorant Garamond', Georgia, serif;
        font-size:15px; font-weight:600;
        border-radius:5px; cursor:pointer;
      `;
      b.addEventListener('click', () => this.toggle(i));
      ringRow.appendChild(b);
      this.ringBtns.push(b);
    }

    const legal = document.createElement('div');
    legal.style.cssText = `font-size:12px; letter-spacing:0.06em; opacity:0.65; min-height:14px;`;
    this.legalEl = legal;
    panel.appendChild(legal);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = `display:flex; gap:8px;`;
    panel.appendChild(btnRow);

    const undo = document.createElement('button');
    undo.type = 'button';
    undo.textContent = 'UNDO';
    undo.style.cssText = this.secondaryBtnCss();
    undo.addEventListener('click', () => this.undo());
    btnRow.appendChild(undo);
    this.undoBtn = undo;

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'RESET';
    reset.style.cssText = this.secondaryBtnCss();
    reset.addEventListener('click', () => this.reset());
    btnRow.appendChild(reset);

    const status = document.createElement('div');
    status.style.cssText = `font-size:12px; letter-spacing:0.06em; opacity:0.8; min-height:14px;`;
    this.statusEl = status;
    panel.appendChild(status);

    document.body.appendChild(root);
  }

  private secondaryBtnCss(): string {
    return `
      flex:1;
      padding:7px 10px;
      background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.25);
      color:#e6eefb; opacity:0.85;
      font-family:inherit; font-size:11px; letter-spacing:0.22em; font-weight:600;
      border-radius:5px; cursor:pointer;
    `;
  }

  /* ------------------------------ Logic ---------------------------------- */

  /** Ring i is toggleable iff i==0, or ring i-1 is ON and all further-in
   *  rings (0..i-2) are OFF. */
  private canToggle(i: number): boolean {
    if (i === 0) return true;
    if (!this.rings[i - 1].on) return false;
    for (let j = 0; j < i - 1; j++) if (this.rings[j].on) return false;
    return true;
  }

  private toggle(i: number): void {
    if (this.isSolved) return;
    if (!this.canToggle(i)) {
      this.flashIllegal();
      return;
    }
    this.history.push(this.rings.map((r) => r.on));
    this.rings[i].on = !this.rings[i].on;
    this.rings[i].animT = 0;
    this.moveCount++;
    this.refresh();
    this.checkSolved();
  }

  private undo(): void {
    if (this.history.length === 0 || this.isSolved) return;
    const prev = this.history.pop();
    if (!prev) return;
    for (let i = 0; i < this.rings.length; i++) {
      if (this.rings[i].on !== prev[i]) this.rings[i].animT = 0;
      this.rings[i].on = prev[i];
    }
    this.moveCount = Math.max(0, this.moveCount - 1);
    this.refresh();
  }

  private reset(): void {
    if (this.isSolved) return;
    this.history = [];
    this.moveCount = 0;
    for (const r of this.rings) {
      if (!r.on) r.animT = 0;
      r.on = true;
    }
    this.refresh();
  }

  private flashIllegal(): void {
    if (this.statusEl) {
      this.statusEl.textContent = 'illegal move — check the chain';
      this.statusEl.style.color = '#e89090';
      setTimeout(() => {
        if (this.statusEl && !this.isSolved) {
          this.statusEl.style.color = '';
          this.refresh();
        }
      }, 900);
    }
  }

  private checkSolved(): void {
    if (this.rings.every((r) => !r.on)) {
      this.isSolved = true;
      if (this.statusEl) {
        this.statusEl.textContent = `EVERY RING FREED IN ${this.moveCount} MOVES`;
        this.statusEl.style.color = '#9fe0a6';
      }
      setTimeout(() => this.onSolved?.(), 900);
    }
  }

  /* ------------------------------ Render --------------------------------- */

  private refresh(): void {
    if (this.movesEl) {
      this.movesEl.textContent = `MOVES  ${this.moveCount}   ·   OPTIMAL  ${OPTIMAL_MOVES}`;
    }
    if (this.binaryEl) {
      // Ring 0 on the left in the ring row is shown as the rightmost bit
      // (LSB), to match the Gray-code reading used in classical analysis.
      const bits = this.rings.map((r) => (r.on ? '1' : '0')).reverse().join(' ');
      this.binaryEl.textContent = bits;
    }
    if (this.legalEl) {
      const idxs: number[] = [];
      for (let i = 0; i < this.rings.length; i++) if (this.canToggle(i)) idxs.push(i + 1);
      this.legalEl.textContent = idxs.length === 0 ? '' : `free rings: ${idxs.join(', ')}`;
    }
    for (let i = 0; i < this.ringBtns.length; i++) {
      const b = this.ringBtns[i];
      const on = this.rings[i].on;
      const legal = this.canToggle(i);
      b.style.background = on ? 'rgba(230,196,90,0.25)' : 'rgba(159,200,255,0.05)';
      b.style.borderColor = legal ? 'var(--era-accent)' : 'rgba(159,200,255,0.18)';
      b.style.opacity = legal ? '1' : '0.4';
      b.style.cursor = legal ? 'pointer' : 'default';
    }
    if (this.undoBtn) {
      this.undoBtn.style.opacity = this.history.length === 0 ? '0.4' : '0.85';
      this.undoBtn.style.cursor = this.history.length === 0 ? 'default' : 'pointer';
    }
    if (this.statusEl && !this.isSolved) {
      const remaining = this.rings.filter((r) => r.on).length;
      this.statusEl.textContent = `${remaining} ring${remaining === 1 ? '' : 's'} still on the bar`;
      this.statusEl.style.color = '';
    }
  }

  /* -------------------------- Lifecycle ---------------------------------- */

  update(dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 2.4, 8.5);
    camera.lookAt(0, 0.2, 0);
    // Ease each ring vertically toward its state.
    for (const r of this.rings) {
      if (r.animT < 1) {
        r.animT = Math.min(1, r.animT + dt / ANIM_DUR);
      }
      const target = r.on ? RING_Y_ON : RING_Y_OFF;
      const start = r.on ? RING_Y_OFF : RING_Y_ON;
      const k = r.animT;
      const ease = 1 - Math.pow(1 - k, 3);
      r.group.position.y = start + (target - start) * ease;
      // Small idle sway when OFF.
      if (!r.on && r.animT >= 1) {
        r.group.position.y = RING_Y_OFF + Math.sin(performance.now() * 0.001 + r.index) * 0.02;
      }
    }
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
    this.movesEl = null;
    this.legalEl = null;
    this.binaryEl = null;
    this.statusEl = null;
    this.undoBtn = null;
    this.ringBtns = [];
    this.rings = [];
    this.history = [];
    super.dispose();
  }
}
