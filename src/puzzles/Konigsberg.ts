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
 * Königsberg Bridges — Euler's original problem, rewritten so a solution
 * exists. The graph has four landmasses (A, B, C, D) and seven bridges;
 * the degrees are (4, 4, 3, 3). An Euler path therefore exists starting
 * at C (or D) and ending at D (or C). The player traces the path by
 * tapping a landmass, then successive adjacent masses, consuming one
 * bridge at each step. When every bridge has been crossed once, the
 * puzzle is solved.
 */

const NODE_COUNT = 4;
const VIEW = 380;

interface Node {
  readonly id: number;
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

interface Bridge {
  readonly id: number;
  readonly a: number;
  readonly b: number;
  readonly curve: number; // offset controlling parallel-edge separation
}

const NODES: readonly Node[] = [
  { id: 0, label: 'A', x: 110, y: 80 },
  { id: 1, label: 'B', x: 270, y: 80 },
  { id: 2, label: 'C', x: 110, y: 280 },
  { id: 3, label: 'D', x: 270, y: 280 },
];

const BRIDGES: readonly Bridge[] = [
  { id: 0, a: 0, b: 1, curve: 30 },
  { id: 1, a: 0, b: 1, curve: -30 },
  { id: 2, a: 0, b: 2, curve: 0 },
  { id: 3, a: 0, b: 3, curve: 0 },
  { id: 4, a: 1, b: 2, curve: 0 },
  { id: 5, a: 1, b: 3, curve: 0 },
  { id: 6, a: 2, b: 3, curve: 0 },
];

export class KonigsbergPuzzle extends Puzzle {
  readonly title = 'KÖNIGSBERG';
  readonly subtitle = "euler's bridges";
  readonly instructions =
    'Cross every bridge exactly once. Tap a landmass to begin, then keep stepping to adjacent shores along a fresh span. No bridge may be retraced.';

  private used: Set<number> = new Set();
  private currentNode: number | null = null;

  private root: HTMLDivElement | null = null;
  private svg: SVGSVGElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private counterEl: HTMLDivElement | null = null;

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
    root.id = 'puzzle-konigsberg';
    root.style.cssText = `
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      z-index:20; pointer-events:none; font-family:'Cormorant Garamond', Georgia, serif;
    `;
    this.root = root;

    const panel = document.createElement('div');
    panel.style.cssText = `
      display:flex; flex-direction:column; align-items:center; gap:12px;
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
    title.textContent = 'KÖNIGSBERG';
    panel.appendChild(title);

    const counter = document.createElement('div');
    counter.style.cssText = `font-size:12px; letter-spacing:0.18em; opacity:0.75;`;
    this.counterEl = counter;
    panel.appendChild(counter);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(VIEW));
    svg.setAttribute('height', String(VIEW));
    svg.setAttribute('viewBox', `0 0 ${VIEW} ${VIEW}`);
    svg.style.cssText = 'display:block; touch-action:none; user-select:none;';
    this.svg = svg;

    const bg = document.createElementNS(svgNS, 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(VIEW));
    bg.setAttribute('height', String(VIEW));
    bg.setAttribute('rx', '8');
    bg.setAttribute('fill', 'rgba(43,69,112,0.28)');
    bg.setAttribute('stroke', 'rgba(196,148,74,0.3)');
    bg.setAttribute('stroke-width', '1.5');
    svg.appendChild(bg);

    // River watermark.
    const river = document.createElementNS(svgNS, 'path');
    river.setAttribute(
      'd',
      `M 0 ${VIEW * 0.48} Q ${VIEW * 0.35} ${VIEW * 0.55}, ${VIEW * 0.6} ${VIEW * 0.48} T ${VIEW} ${VIEW * 0.5}`,
    );
    river.setAttribute('fill', 'none');
    river.setAttribute('stroke', 'rgba(74,144,217,0.18)');
    river.setAttribute('stroke-width', '36');
    river.setAttribute('stroke-linecap', 'round');
    svg.appendChild(river);

    // Bridges.
    for (const br of BRIDGES) {
      const path = document.createElementNS(svgNS, 'path');
      const a = NODES[br.a];
      const b = NODES[br.b];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      // Perpendicular offset for curved parallel bridges.
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len;
      const ny = dx / len;
      const cx = mx + nx * br.curve;
      const cy = my + ny * br.curve;
      path.setAttribute('d', `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#c4944a');
      path.setAttribute('stroke-width', '6');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('opacity', '0.9');
      path.dataset.bridgeId = String(br.id);
      path.style.cursor = 'pointer';
      path.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        this.tapBridge(br.id);
      });
      svg.appendChild(path);
    }

    // Nodes — draw last so they're on top.
    for (const n of NODES) {
      const g = document.createElementNS(svgNS, 'g');
      g.dataset.nodeId = String(n.id);
      g.style.cursor = 'pointer';
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', String(n.x));
      circle.setAttribute('cy', String(n.y));
      circle.setAttribute('r', '26');
      circle.setAttribute('fill', '#2b4570');
      circle.setAttribute('stroke', '#c4944a');
      circle.setAttribute('stroke-width', '2');
      g.appendChild(circle);
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', String(n.x));
      text.setAttribute('y', String(n.y + 6));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-family', 'Cormorant Garamond, serif');
      text.setAttribute('font-size', '18');
      text.setAttribute('font-weight', '700');
      text.setAttribute('fill', '#f0e6d3');
      text.textContent = n.label;
      g.appendChild(text);
      g.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        this.tapNode(n.id);
      });
      svg.appendChild(g);
    }

    panel.appendChild(svg);

    const status = document.createElement('div');
    status.style.cssText = `font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;`;
    this.statusEl = status;
    panel.appendChild(status);

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'RESET';
    reset.style.cssText = `
      padding:7px 18px;
      background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.22);
      color:#f0e6d3;
      font-family:inherit; font-size:11px; letter-spacing:0.22em; font-weight:600;
      border-radius:5px; cursor:pointer;
    `;
    reset.addEventListener('click', () => {
      if (this.isSolved) return;
      this.used.clear();
      this.currentNode = null;
      this.refresh();
    });
    panel.appendChild(reset);

    document.body.appendChild(root);
  }

  /* -------------------------------- Flow --------------------------------- */

  private tapNode(id: number): void {
    if (this.isSolved) return;
    if (this.currentNode === null) {
      this.currentNode = id;
      this.refresh();
      return;
    }
    const br = this.findBridge(this.currentNode, id);
    if (br === null) {
      this.flashStatus('no bridge available there', '#e89090');
      return;
    }
    this.used.add(br);
    this.currentNode = id;
    if (this.used.size === BRIDGES.length) {
      this.isSolved = true;
      if (this.statusEl) {
        this.statusEl.textContent = 'EVERY BRIDGE CROSSED';
        this.statusEl.style.color = '#9fe0a6';
      }
      this.refresh();
      setTimeout(() => this.onSolved?.(), 1000);
      return;
    }
    this.refresh();
  }

  private tapBridge(id: number): void {
    if (this.isSolved) return;
    const br = BRIDGES[id];
    if (this.currentNode === null) {
      this.flashStatus('start at a landmass first', '#e89090');
      return;
    }
    if (br.a !== this.currentNode && br.b !== this.currentNode) {
      this.flashStatus('that bridge does not touch the current shore', '#e89090');
      return;
    }
    if (this.used.has(id)) {
      this.flashStatus('that bridge has already been crossed', '#e89090');
      return;
    }
    const target = br.a === this.currentNode ? br.b : br.a;
    this.tapNode(target);
  }

  private findBridge(from: number, to: number): number | null {
    for (const br of BRIDGES) {
      if (this.used.has(br.id)) continue;
      if ((br.a === from && br.b === to) || (br.a === to && br.b === from)) return br.id;
    }
    return null;
  }

  /* ------------------------------ Rendering ------------------------------ */

  private flashStatus(msg: string, color: string): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.style.color = color;
    setTimeout(() => {
      if (!this.statusEl || this.isSolved) return;
      this.refreshStatusLine();
    }, 1200);
  }

  private refreshStatusLine(): void {
    if (!this.statusEl || this.isSolved) return;
    if (this.currentNode === null) {
      this.statusEl.textContent = 'pick a landmass to begin';
    } else {
      this.statusEl.textContent = `at ${NODES[this.currentNode].label} — step to a neighbour`;
    }
    this.statusEl.style.color = '';
  }

  private refresh(): void {
    if (this.counterEl) {
      this.counterEl.textContent = `BRIDGES ${this.used.size} / ${BRIDGES.length}`;
    }
    if (!this.svg) return;
    // Update bridge colours.
    const paths = this.svg.querySelectorAll('path[data-bridge-id]');
    paths.forEach((p) => {
      const id = Number((p as unknown as HTMLElement).dataset.bridgeId);
      const used = this.used.has(id);
      p.setAttribute('stroke', used ? '#3db87a' : '#c4944a');
      p.setAttribute('opacity', used ? '0.85' : '0.9');
    });
    // Highlight current node.
    const groups = this.svg.querySelectorAll('g[data-node-id]');
    groups.forEach((g) => {
      const id = Number((g as unknown as HTMLElement).dataset.nodeId);
      const circle = g.querySelector('circle');
      if (!circle) return;
      if (id === this.currentNode) {
        circle.setAttribute('fill', '#c4944a');
        circle.setAttribute('stroke', '#fff3c6');
      } else {
        circle.setAttribute('fill', '#2b4570');
        circle.setAttribute('stroke', '#c4944a');
      }
    });
    this.refreshStatusLine();
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
    this.svg = null;
    this.statusEl = null;
    this.counterEl = null;
    this.used.clear();
    super.dispose();
  }
}
