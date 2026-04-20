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
 * Soroban — Japanese abacus. A 4-column frame shows one "heaven" bead worth
 * 5 above the reckoning bar and four "earth" beads worth 1 below it. Each
 * round the player is given a target number (1–9999) and has to push beads
 * until the abacus reads that value. Three correct rounds close the puzzle.
 */

const COLUMNS = 4;
const ROUNDS_TO_WIN = 3;

interface Round {
  readonly target: number;
  readonly blurb: string;
}

function randomTarget(round: number): Round {
  if (round === 0) {
    const t = 10 + Math.floor(Math.random() * 90);
    return { target: t, blurb: `Set the frame to ${t}.` };
  }
  if (round === 1) {
    const t = 100 + Math.floor(Math.random() * 900);
    return { target: t, blurb: `Represent ${t} on the rods.` };
  }
  // Round 2+: 4-digit.
  const a = 400 + Math.floor(Math.random() * 600);
  const b = 200 + Math.floor(Math.random() * 500);
  return { target: a + b, blurb: `Reckon ${a} + ${b} on the soroban.` };
}

function digits(value: number, width: number): number[] {
  const out = new Array(width).fill(0);
  let v = value;
  for (let i = width - 1; i >= 0; i--) {
    out[i] = v % 10;
    v = Math.floor(v / 10);
  }
  return out;
}

export class SorobanPuzzle extends Puzzle {
  readonly title = 'SOROBAN';
  readonly subtitle = 'the reckoning frame';
  readonly instructions =
    'Tap + and − on each rod to set the target number. Each heavenly bead is worth five, each earthly bead is worth one. Three rounds to close the ledger.';

  private cols: number[] = new Array(COLUMNS).fill(0);
  private roundIndex = 0;
  private round: Round = randomTarget(0);
  private locked = false;

  private root: HTMLDivElement | null = null;
  private frameEl: HTMLDivElement | null = null;
  private readoutEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private progressEl: HTMLDivElement | null = null;
  private checkBtn: HTMLButtonElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.buildDom();
    this.render();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const floor = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#1a0d06'),
        roughness: 0.7,
        metalness: 0.18,
        side: DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    this.group.add(floor);

    const seal = new Mesh(
      new RingGeometry(3.0, 3.15, 6),
      new MeshStandardMaterial({
        color: new Color('#c41e3a'),
        emissive: new Color('#2a0606'),
        emissiveIntensity: 0.5,
        roughness: 0.45,
        metalness: 0.85,
        side: DoubleSide,
      }),
    );
    seal.rotation.x = -Math.PI / 2;
    seal.position.y = -2.37;
    this.group.add(seal);

    const paper = new PointLight('#f6d89c', 2.2, 24, 1.6);
    paper.position.set(0, 6, 4);
    this.group.add(paper);
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-soroban';
    root.style.cssText = `
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      z-index:20; pointer-events:none; font-family:'Cormorant Garamond', Georgia, serif;
    `;
    this.root = root;

    const panel = document.createElement('div');
    panel.style.cssText = `
      display:flex; flex-direction:column; align-items:center; gap:14px;
      pointer-events:auto;
      padding:22px 26px;
      background:rgba(10,18,34,0.8); backdrop-filter:blur(12px);
      border:1px solid rgba(159,200,255,0.25);
      border-top:3px solid var(--era-accent);
      border-radius:10px;
      box-shadow:0 18px 60px rgba(0,0,0,0.55);
      color:#f4ebd2;
      min-width:420px;
    `;
    root.appendChild(panel);

    const title = document.createElement('div');
    title.style.cssText = `font-size:18px; letter-spacing:0.26em; color:var(--era-accent); font-weight:600;`;
    title.textContent = 'SOROBAN';
    panel.appendChild(title);

    const progress = document.createElement('div');
    progress.style.cssText = `font-size:12px; letter-spacing:0.18em; opacity:0.75;`;
    this.progressEl = progress;
    panel.appendChild(progress);

    const readout = document.createElement('div');
    readout.style.cssText = `
      font-size:15px; letter-spacing:0.04em; text-align:center;
      color:#f6e9c8; min-height:42px;
    `;
    this.readoutEl = readout;
    panel.appendChild(readout);

    const frame = document.createElement('div');
    frame.style.cssText = `
      display:flex; gap:10px;
      padding:18px 20px;
      background:linear-gradient(160deg,#3a1f0d,#2a1506);
      border:2px solid #5c3a1a;
      border-radius:8px;
      box-shadow:inset 0 2px 5px rgba(0,0,0,0.5);
    `;
    this.frameEl = frame;
    panel.appendChild(frame);

    const check = document.createElement('button');
    check.type = 'button';
    check.textContent = 'CONFIRM';
    check.style.cssText = `
      padding:9px 26px;
      background:rgba(196,30,58,0.15);
      border:1px solid rgba(196,30,58,0.55);
      color:#f6e9c8;
      font-family:'Cormorant Garamond', Georgia, serif;
      font-size:14px; letter-spacing:0.3em; font-weight:600;
      border-radius:4px; cursor:pointer;
    `;
    check.addEventListener('click', () => this.check());
    this.checkBtn = check;
    panel.appendChild(check);

    const status = document.createElement('div');
    status.style.cssText = `font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;`;
    this.statusEl = status;
    panel.appendChild(status);

    document.body.appendChild(root);
  }

  /* ------------------------------ Rendering ------------------------------ */

  private render(): void {
    if (this.progressEl) {
      this.progressEl.textContent = `ROUND ${Math.min(this.roundIndex + 1, ROUNDS_TO_WIN)} / ${ROUNDS_TO_WIN}`;
    }
    if (this.readoutEl) {
      const cur = this.currentValue();
      this.readoutEl.innerHTML =
        `<div style="font-size:14px; opacity:0.85;">${this.round.blurb}</div>` +
        `<div style="font-size:22px; letter-spacing:0.22em; color:var(--era-accent); margin-top:4px;">TARGET ${this.round.target}  ·  NOW ${cur}</div>`;
    }
    this.renderFrame();
    if (this.statusEl && !this.isSolved) {
      this.statusEl.textContent = 'nudge the beads';
      this.statusEl.style.color = '';
    }
    if (this.checkBtn) this.checkBtn.disabled = this.locked || this.isSolved;
  }

  private renderFrame(): void {
    if (!this.frameEl) return;
    this.frameEl.innerHTML = '';
    for (let c = 0; c < COLUMNS; c++) {
      const col = document.createElement('div');
      col.style.cssText = `
        display:flex; flex-direction:column; align-items:center; gap:0;
        width:58px;
      `;
      const rod = document.createElement('div');
      rod.style.cssText = `
        position:relative; width:58px; height:190px;
        display:flex; flex-direction:column; align-items:center;
      `;
      // Rod shaft
      const shaft = document.createElement('div');
      shaft.style.cssText = `
        position:absolute; left:50%; top:0; bottom:0; width:2px;
        transform:translateX(-50%); background:rgba(255,210,120,0.5);
      `;
      rod.appendChild(shaft);

      const digit = this.digit(c);
      const heaven = digit >= 5;
      const earth = digit % 5;

      // Heaven bead — top half.
      const heavenBead = this.makeBead('heaven', heaven);
      heavenBead.style.position = 'absolute';
      heavenBead.style.left = '50%';
      heavenBead.style.transform = 'translateX(-50%)';
      heavenBead.style.top = heaven ? '58px' : '8px';
      rod.appendChild(heavenBead);

      // Reckoning bar.
      const bar = document.createElement('div');
      bar.style.cssText = `
        position:absolute; left:4px; right:4px; top:84px; height:3px;
        background:#c41e3a; box-shadow:0 0 4px rgba(196,30,58,0.7);
      `;
      rod.appendChild(bar);

      // Earth beads — 4 slots below bar. Active ones are pushed up toward the bar.
      for (let i = 0; i < 4; i++) {
        const active = i < earth;
        const bead = this.makeBead('earth', active);
        const baseTop = 96;
        const slotStep = 22;
        const inactivePushDown = (3 - i) * slotStep; // rest at bottom
        const activePushUp = i * slotStep; // pack against bar
        const top = active ? baseTop + activePushUp : baseTop + (3 - i) * slotStep - 0 + (3 - i) * 0;
        bead.style.position = 'absolute';
        bead.style.left = '50%';
        bead.style.transform = 'translateX(-50%)';
        bead.style.top = `${active ? baseTop + activePushUp : 96 + inactivePushDown}px`;
        rod.appendChild(bead);
      }
      col.appendChild(rod);

      const ctrls = document.createElement('div');
      ctrls.style.cssText = 'display:flex; gap:6px; margin-top:8px;';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.style.cssText = this.btnCss();
      minus.addEventListener('click', () => this.adjust(c, -1));
      const plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.style.cssText = this.btnCss();
      plus.addEventListener('click', () => this.adjust(c, +1));
      ctrls.appendChild(minus);
      ctrls.appendChild(plus);
      col.appendChild(ctrls);

      const label = document.createElement('div');
      label.style.cssText = `font-size:18px; color:#f6d89c; margin-top:6px; font-weight:700;`;
      label.textContent = String(this.digit(c));
      col.appendChild(label);

      this.frameEl.appendChild(col);
    }
  }

  private makeBead(kind: 'heaven' | 'earth', active: boolean): HTMLDivElement {
    const d = document.createElement('div');
    d.style.cssText = `
      width:36px; height:22px; border-radius:50%;
      background:${
        kind === 'heaven'
          ? active
            ? 'radial-gradient(ellipse at 35% 30%,#e85b55,#801818)'
            : 'radial-gradient(ellipse at 35% 30%,#b53a38,#5a0e0e)'
          : active
            ? 'radial-gradient(ellipse at 35% 30%,#c49660,#5a3a1a)'
            : 'radial-gradient(ellipse at 35% 30%,#865a30,#3a1f0d)'
      };
      border:1px solid rgba(0,0,0,0.6);
      box-shadow:inset 0 1px 2px rgba(255,220,170,0.4), 0 2px 3px rgba(0,0,0,0.45);
      transition:top 0.18s ease;
    `;
    return d;
  }

  private btnCss(): string {
    return `
      width:26px; height:26px;
      background:rgba(245,230,200,0.08);
      border:1px solid rgba(197,151,44,0.4);
      color:#f6e9c8;
      font-family:inherit; font-size:15px; font-weight:700;
      border-radius:4px; cursor:pointer;
    `;
  }

  /* -------------------------------- Flow --------------------------------- */

  private digit(colIndex: number): number {
    // Column 0 is the most-significant; we store cols[0] = thousands, etc.
    return this.cols[colIndex];
  }

  private currentValue(): number {
    let v = 0;
    for (let i = 0; i < COLUMNS; i++) v = v * 10 + this.cols[i];
    return v;
  }

  private adjust(col: number, delta: number): void {
    if (this.locked || this.isSolved) return;
    const next = Math.max(0, Math.min(9, this.cols[col] + delta));
    this.cols[col] = next;
    this.render();
  }

  private check(): void {
    if (this.locked || this.isSolved) return;
    const cur = this.currentValue();
    if (cur === this.round.target) {
      this.locked = true;
      this.roundIndex++;
      if (this.statusEl) {
        this.statusEl.textContent = 'the ledger agrees';
        this.statusEl.style.color = '#9fe0a6';
      }
      if (this.roundIndex >= ROUNDS_TO_WIN) {
        this.isSolved = true;
        if (this.statusEl) {
          this.statusEl.textContent = 'BOOKS ARE BALANCED';
        }
        setTimeout(() => this.onSolved?.(), 1100);
        return;
      }
      setTimeout(() => {
        this.round = randomTarget(this.roundIndex);
        this.cols = new Array(COLUMNS).fill(0);
        this.locked = false;
        this.render();
      }, 900);
    } else {
      if (this.statusEl) {
        this.statusEl.textContent = `${cur} is not ${this.round.target}`;
        this.statusEl.style.color = '#e89090';
      }
    }
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
    this.frameEl = null;
    this.readoutEl = null;
    this.statusEl = null;
    this.progressEl = null;
    this.checkBtn = null;
    super.dispose();
  }
}
