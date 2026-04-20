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
 * Lorenz SZ40 — three coprime pin-wheels XORed together form the
 * keystream. The wheel patterns are fixed; the player rotates each to
 * set its initial offset so that the generated keystream matches the
 * target bit sequence transmitted from Bletchley. Three rounds.
 */

type Wheel = { readonly period: number; readonly pattern: readonly number[] };

const WHEELS: readonly Wheel[] = [
  { period: 5, pattern: [1, 0, 1, 1, 0] },
  { period: 7, pattern: [1, 0, 0, 1, 1, 1, 0] },
  { period: 9, pattern: [1, 1, 0, 0, 1, 0, 1, 1, 0] },
];

const STREAM_LEN = 8;
const ROUNDS_TO_WIN = 3;

function keystream(offsets: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < STREAM_LEN; i++) {
    let bit = 0;
    for (let w = 0; w < WHEELS.length; w++) {
      const wh = WHEELS[w];
      bit ^= wh.pattern[(offsets[w] + i) % wh.period];
    }
    out.push(bit);
  }
  return out;
}

function bitsEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function randomTarget(): number[] {
  // Pick random offsets so a valid solution is guaranteed to exist.
  const offsets = WHEELS.map((w) => Math.floor(Math.random() * w.period));
  return keystream(offsets);
}

export class LorenzPuzzle extends Puzzle {
  readonly title = 'LORENZ';
  readonly subtitle = 'tunny at bletchley';
  readonly instructions =
    'Three pin-wheels XOR together to form the keystream. Rotate each wheel until the generated bits match the target transmission. Three rounds.';

  private offsets: number[] = [0, 0, 0];
  private targets: number[][] = [];
  private roundIdx = 0;

  private root: HTMLDivElement | null = null;
  private targetEl: HTMLDivElement | null = null;
  private streamEl: HTMLDivElement | null = null;
  private wheelEls: HTMLDivElement[] = [];
  private roundEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.targets = Array.from({ length: ROUNDS_TO_WIN }, () => randomTarget());
    this.buildDom();
    this.refresh();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const floor = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#05080c'),
        roughness: 0.65,
        metalness: 0.2,
        side: DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    this.group.add(floor);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color('#6a8a9a'),
        emissive: new Color('#0a1420'),
        emissiveIntensity: 0.55,
        roughness: 0.35,
        metalness: 0.95,
        side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const lamp = new PointLight('#8cb0d4', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-lorenz';
    root.style.cssText = `
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      z-index:20; pointer-events:none; font-family:'Cormorant Garamond', Georgia, serif;
    `;
    this.root = root;

    const panel = document.createElement('div');
    panel.style.cssText = `
      display:flex; flex-direction:column; align-items:center; gap:12px;
      pointer-events:auto;
      padding:22px 28px;
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
    title.textContent = 'LORENZ';
    panel.appendChild(title);

    const round = document.createElement('div');
    round.style.cssText = `font-size:11px; letter-spacing:0.3em; opacity:0.7;`;
    this.roundEl = round;
    panel.appendChild(round);

    const targetRow = document.createElement('div');
    targetRow.style.cssText = `
      display:flex; flex-direction:column; gap:4px; align-items:center;
    `;
    const tLabel = document.createElement('div');
    tLabel.style.cssText = `font-size:10px; letter-spacing:0.3em; opacity:0.65;`;
    tLabel.textContent = 'TARGET';
    const tBits = document.createElement('div');
    tBits.style.cssText = `
      font-family:'JetBrains Mono', monospace; font-size:18px; letter-spacing:0.35em;
      color:#d8e3ef;
      padding:6px 14px; background:rgba(0,0,0,0.35); border:1px solid rgba(216,227,239,0.3);
      border-radius:4px;
    `;
    this.targetEl = tBits;
    targetRow.appendChild(tLabel);
    targetRow.appendChild(tBits);
    panel.appendChild(targetRow);

    const wheelRow = document.createElement('div');
    wheelRow.style.cssText = `display:flex; gap:18px; margin-top:4px;`;
    this.wheelEls = [];
    for (let w = 0; w < WHEELS.length; w++) {
      const col = document.createElement('div');
      col.style.cssText = `display:flex; flex-direction:column; align-items:center; gap:6px;`;
      const label = document.createElement('div');
      label.style.cssText = `font-size:10px; letter-spacing:0.25em; opacity:0.7;`;
      label.textContent = `WHEEL ${String.fromCharCode(945 + w)}`; // α β γ
      col.appendChild(label);

      const display = document.createElement('div');
      display.style.cssText = `
        font-family:'JetBrains Mono', monospace;
        width:68px; min-height:44px;
        padding:6px 0;
        background:rgba(0,0,0,0.35); border:1px solid rgba(196,148,74,0.3);
        border-radius:4px; text-align:center;
        font-size:15px; line-height:1.25; color:#f0e6d3;
        letter-spacing:0.06em;
      `;
      this.wheelEls.push(display);
      col.appendChild(display);

      const btnRow = document.createElement('div');
      btnRow.style.cssText = `display:flex; gap:4px;`;
      for (const dir of [-1, 1]) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = dir < 0 ? '◂' : '▸';
        b.style.cssText = `
          width:28px; height:28px;
          background:rgba(196,148,74,0.12);
          border:1px solid rgba(196,148,74,0.45);
          color:var(--era-accent);
          font-family:inherit; font-size:15px; font-weight:700;
          border-radius:4px; cursor:pointer;
        `;
        b.addEventListener('click', () => this.rotate(w, dir));
        btnRow.appendChild(b);
      }
      col.appendChild(btnRow);
      wheelRow.appendChild(col);
    }
    panel.appendChild(wheelRow);

    const sLabel = document.createElement('div');
    sLabel.style.cssText = `font-size:10px; letter-spacing:0.3em; opacity:0.65; margin-top:8px;`;
    sLabel.textContent = 'GENERATED KEYSTREAM';
    panel.appendChild(sLabel);

    const sBits = document.createElement('div');
    sBits.style.cssText = `
      font-family:'JetBrains Mono', monospace; font-size:18px; letter-spacing:0.35em;
      padding:6px 14px; background:rgba(0,0,0,0.35); border:1px solid rgba(196,148,74,0.3);
      border-radius:4px;
    `;
    this.streamEl = sBits;
    panel.appendChild(sBits);

    const status = document.createElement('div');
    status.style.cssText = `font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px; margin-top:6px;`;
    this.statusEl = status;
    panel.appendChild(status);

    document.body.appendChild(root);
  }

  /* ------------------------------- Flow ---------------------------------- */

  private rotate(w: number, dir: number): void {
    if (this.isSolved) return;
    const period = WHEELS[w].period;
    this.offsets[w] = (this.offsets[w] + dir + period) % period;
    this.refresh();
    this.autoCheck();
  }

  private renderWheel(w: number): string {
    const wh = WHEELS[w];
    const off = this.offsets[w];
    const bits: string[] = [];
    for (let i = 0; i < wh.period; i++) {
      const b = wh.pattern[(off + i) % wh.period];
      if (i === 0) {
        bits.push(`<span style="color:#ffd79a;font-weight:700">${b}</span>`);
      } else {
        bits.push(String(b));
      }
    }
    return bits.join(' ');
  }

  private renderBits(bits: readonly number[], highlightMatch?: readonly number[]): string {
    return bits
      .map((b, i) => {
        const match = highlightMatch ? bits[i] === highlightMatch[i] : true;
        return `<span style="color:${match ? '#f0e6d3' : '#e89090'}">${b}</span>`;
      })
      .join(' ');
  }

  private refresh(): void {
    if (this.roundEl) {
      this.roundEl.textContent = `TRANSMISSION ${this.roundIdx + 1} / ${ROUNDS_TO_WIN}`;
    }
    const target = this.targets[this.roundIdx] ?? this.targets[this.targets.length - 1];
    if (this.targetEl) {
      this.targetEl.innerHTML = target.map((b) => String(b)).join(' ');
    }
    for (let w = 0; w < WHEELS.length; w++) {
      this.wheelEls[w].innerHTML = this.renderWheel(w);
    }
    const stream = keystream(this.offsets);
    if (this.streamEl) {
      this.streamEl.innerHTML = this.renderBits(stream, target);
    }
    if (this.statusEl && !this.isSolved) {
      this.statusEl.textContent = 'align α, β, γ to match the target';
      this.statusEl.style.color = '';
    }
  }

  private autoCheck(): void {
    if (this.isSolved) return;
    const target = this.targets[this.roundIdx];
    const stream = keystream(this.offsets);
    if (!bitsEqual(stream, target)) return;
    this.roundIdx++;
    if (this.roundIdx >= ROUNDS_TO_WIN) {
      this.isSolved = true;
      if (this.statusEl) {
        this.statusEl.textContent = 'TUNNY BROKEN';
        this.statusEl.style.color = '#9fe0a6';
      }
      this.refresh();
      setTimeout(() => this.onSolved?.(), 1000);
      return;
    }
    this.offsets = [0, 0, 0];
    if (this.statusEl) {
      this.statusEl.textContent = 'transmission recovered — next';
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
    this.targetEl = null;
    this.streamEl = null;
    this.roundEl = null;
    this.statusEl = null;
    this.wheelEls = [];
    super.dispose();
  }
}
