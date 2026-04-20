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
 * Four-Colour Map — the Revolution's cartographic conjecture. A planar
 * graph of eight provinces is rendered as coloured polygons; adjacent
 * provinces must not share a colour. Four paints suffice (it's a
 * theorem) — the player cycles each region through the palette.
 */

interface Region {
  readonly id: number;
  readonly label: string;
  readonly path: string; // SVG path data
  readonly cx: number; // label centre
  readonly cy: number;
}

const PALETTE = ['#c44848', '#4a90d9', '#e2b34a', '#6cbf7a'] as const;

// Eight-province map — a stylised hexagonal-ish tessellation. Adjacency
// list derived from shared edges.
const REGIONS: readonly Region[] = [
  { id: 0, label: 'I', path: 'M 40 40 L 160 40 L 160 130 L 40 130 Z', cx: 100, cy: 85 },
  { id: 1, label: 'II', path: 'M 160 40 L 280 40 L 280 130 L 160 130 Z', cx: 220, cy: 85 },
  { id: 2, label: 'III', path: 'M 280 40 L 380 40 L 380 130 L 280 130 Z', cx: 330, cy: 85 },
  { id: 3, label: 'IV', path: 'M 40 130 L 220 130 L 220 230 L 40 230 Z', cx: 130, cy: 180 },
  { id: 4, label: 'V', path: 'M 220 130 L 380 130 L 380 230 L 220 230 Z', cx: 300, cy: 180 },
  { id: 5, label: 'VI', path: 'M 40 230 L 160 230 L 160 340 L 40 340 Z', cx: 100, cy: 285 },
  { id: 6, label: 'VII', path: 'M 160 230 L 300 230 L 300 340 L 160 340 Z', cx: 230, cy: 285 },
  { id: 7, label: 'VIII', path: 'M 300 230 L 380 230 L 380 340 L 300 340 Z', cx: 340, cy: 285 },
];

// Adjacency (shared edge → must differ in colour).
const ADJACENCY: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [0, 3],
  [1, 3],
  [1, 4],
  [2, 4],
  [3, 4],
  [3, 5],
  [3, 6],
  [4, 6],
  [4, 7],
  [5, 6],
  [6, 7],
];

export class FourColorPuzzle extends Puzzle {
  readonly title = 'FOUR COLOURS';
  readonly subtitle = 'guthrie & de morgan';
  readonly instructions =
    'Tap each province to cycle its colour. No two adjacent provinces may share a hue. Four paints suffice.';

  private colors: number[] = REGIONS.map(() => -1);

  private root: HTMLDivElement | null = null;
  private svg: SVGSVGElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private verifyBtn: HTMLButtonElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.buildDom();
    this.refresh();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const floor = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#0d1520'),
        roughness: 0.7,
        metalness: 0.18,
        side: DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    this.group.add(floor);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color('#c4944a'),
        emissive: new Color('#2a1a0a'),
        emissiveIntensity: 0.45,
        roughness: 0.4,
        metalness: 0.85,
        side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const lamp = new PointLight('#ffd79a', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-four-color';
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
    title.textContent = 'FOUR COLOURS';
    panel.appendChild(title);

    const hint = document.createElement('div');
    hint.style.cssText = `font-size:11px; letter-spacing:0.24em; opacity:0.7;`;
    hint.textContent = 'NO TWO NEIGHBOURS ALIKE';
    panel.appendChild(hint);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '420');
    svg.setAttribute('height', '380');
    svg.setAttribute('viewBox', '0 0 420 380');
    svg.style.cssText = 'display:block; touch-action:none; user-select:none;';
    this.svg = svg;

    for (const r of REGIONS) {
      const g = document.createElementNS(svgNS, 'g');
      g.dataset.regionId = String(r.id);
      g.style.cursor = 'pointer';
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', r.path);
      path.setAttribute('fill', 'rgba(40,50,70,0.55)');
      path.setAttribute('stroke', '#f0e6d3');
      path.setAttribute('stroke-width', '2');
      g.appendChild(path);
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', String(r.cx));
      text.setAttribute('y', String(r.cy + 7));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-family', 'Cormorant Garamond, serif');
      text.setAttribute('font-size', '22');
      text.setAttribute('font-weight', '700');
      text.setAttribute('fill', '#f0e6d3');
      text.setAttribute('pointer-events', 'none');
      text.textContent = r.label;
      g.appendChild(text);
      g.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        this.cycle(r.id);
      });
      svg.appendChild(g);
    }
    panel.appendChild(svg);

    const swatches = document.createElement('div');
    swatches.style.cssText = `display:flex; gap:10px;`;
    for (const c of PALETTE) {
      const sw = document.createElement('div');
      sw.style.cssText = `width:26px; height:26px; background:${c}; border:1px solid rgba(255,255,255,0.35); border-radius:3px;`;
      swatches.appendChild(sw);
    }
    panel.appendChild(swatches);

    const status = document.createElement('div');
    status.style.cssText = `font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;`;
    this.statusEl = status;
    panel.appendChild(status);

    const verify = document.createElement('button');
    verify.type = 'button';
    verify.textContent = 'VERIFY';
    verify.style.cssText = `
      padding:9px 26px;
      background:rgba(196,148,74,0.12);
      border:1px solid rgba(196,148,74,0.5);
      color:var(--era-accent);
      font-family:inherit; font-size:14px; letter-spacing:0.3em; font-weight:600;
      border-radius:4px; cursor:pointer;
    `;
    verify.addEventListener('click', () => this.verify());
    this.verifyBtn = verify;
    panel.appendChild(verify);

    document.body.appendChild(root);
  }

  /* ------------------------------- Flow ---------------------------------- */

  private cycle(id: number): void {
    if (this.isSolved) return;
    this.colors[id] = (this.colors[id] + 1) % PALETTE.length;
    this.refresh();
  }

  private refresh(): void {
    if (!this.svg) return;
    const groups = this.svg.querySelectorAll('g[data-region-id]');
    groups.forEach((g) => {
      const id = Number((g as unknown as HTMLElement).dataset.regionId);
      const path = g.querySelector('path');
      if (!path) return;
      const ci = this.colors[id];
      path.setAttribute('fill', ci < 0 ? 'rgba(40,50,70,0.55)' : PALETTE[ci]);
    });
    if (this.statusEl && !this.isSolved) {
      const unpainted = this.colors.filter((c) => c < 0).length;
      this.statusEl.textContent = unpainted > 0 ? `${unpainted} provinces unpainted` : 'all painted — verify';
      this.statusEl.style.color = '';
    }
  }

  private verify(): void {
    if (this.isSolved) return;
    if (this.colors.some((c) => c < 0)) {
      if (this.statusEl) {
        this.statusEl.textContent = 'colour every province first';
        this.statusEl.style.color = '#e89090';
      }
      return;
    }
    for (const [a, b] of ADJACENCY) {
      if (this.colors[a] === this.colors[b]) {
        if (this.statusEl) {
          this.statusEl.textContent = `${REGIONS[a].label} and ${REGIONS[b].label} share a hue`;
          this.statusEl.style.color = '#e89090';
        }
        return;
      }
    }
    this.isSolved = true;
    if (this.statusEl) {
      this.statusEl.textContent = 'THE CARTE IS COHERENT';
      this.statusEl.style.color = '#9fe0a6';
    }
    setTimeout(() => this.onSolved?.(), 1000);
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
    this.svg = null;
    this.statusEl = null;
    this.verifyBtn = null;
    super.dispose();
  }
}
