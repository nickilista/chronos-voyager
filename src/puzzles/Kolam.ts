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
 * Kolam — south Indian threshold geometry. A 3×3 pulli (dot) grid sits in
 * front of the player; they trace a single unbroken curve that visits every
 * dot exactly once and then closes back to the start. Steps are allowed to
 * neighbouring dots, including diagonals. The puzzle accepts any valid
 * Hamiltonian cycle on the grid — there are several; the classic kolam
 * traces the perimeter and dives through the centre.
 */

const N = 3;
const BOARD_PX = 320;

interface Dot {
  readonly id: number;
  readonly col: number;
  readonly row: number;
}

export class KolamPuzzle extends Puzzle {
  readonly title = 'KOLAM';
  readonly subtitle = 'threshold tracing';
  readonly instructions =
    'Touch the dots one after another to sketch a single closed curve through every pulli. Steps may be orthogonal or diagonal; you may only return to the first dot once all nine have been touched.';

  private dots: Dot[] = [];
  private path: number[] = [];
  private visited = new Set<number>();

  private root: HTMLDivElement | null = null;
  private svg: SVGSVGElement | null = null;
  private pathEl: SVGPathElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private counterEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.buildDots();
    this.buildDom();
    this.refresh();
  }

  /* --------------------------- 3D backdrop -------------------------------- */

  private buildBackdrop(): void {
    const floor = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color('#2a1a10'),
        roughness: 0.7,
        metalness: 0.15,
        side: DoubleSide,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    this.group.add(floor);

    const halo = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color('#f6c878'),
        emissive: new Color('#402010'),
        emissiveIntensity: 0.45,
        roughness: 0.4,
        metalness: 0.85,
        side: DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -2.37;
    this.group.add(halo);

    const lamp = new PointLight('#ffd89a', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ---------------------------- Model ------------------------------------ */

  private buildDots(): void {
    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        this.dots.push({ id: row * N + col, col, row });
      }
    }
  }

  private dotXY(d: Dot): { x: number; y: number } {
    const step = BOARD_PX / (N + 1);
    return { x: (d.col + 1) * step, y: (d.row + 1) * step };
  }

  /* ------------------------------- DOM ----------------------------------- */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-kolam';
    root.style.cssText = `
      position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
      z-index:20; pointer-events:none; font-family:'Cormorant Garamond', Georgia, serif;
    `;
    this.root = root;

    const panel = document.createElement('div');
    panel.style.cssText = `
      display:flex; flex-direction:column; align-items:center; gap:12px;
      pointer-events:auto;
      padding:20px 24px;
      background:rgba(10,18,34,0.78); backdrop-filter:blur(12px);
      border:1px solid rgba(159,200,255,0.25);
      border-top:3px solid var(--era-accent);
      border-radius:10px;
      box-shadow:0 18px 60px rgba(0,0,0,0.55);
      color:#e6eefb;
    `;
    root.appendChild(panel);

    const title = document.createElement('div');
    title.style.cssText = `font-size:18px; letter-spacing:0.26em; color:var(--era-accent); font-weight:600;`;
    title.textContent = 'KOLAM';
    panel.appendChild(title);

    const counter = document.createElement('div');
    counter.style.cssText = `font-size:12px; letter-spacing:0.18em; opacity:0.75;`;
    this.counterEl = counter;
    panel.appendChild(counter);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(BOARD_PX));
    svg.setAttribute('height', String(BOARD_PX));
    svg.setAttribute('viewBox', `0 0 ${BOARD_PX} ${BOARD_PX}`);
    svg.style.cssText = 'display:block; touch-action:none; user-select:none;';
    this.svg = svg;

    const bg = document.createElementNS(svgNS, 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(BOARD_PX));
    bg.setAttribute('height', String(BOARD_PX));
    bg.setAttribute('rx', '8');
    bg.setAttribute('fill', 'rgba(30,16,6,0.85)');
    bg.setAttribute('stroke', 'rgba(246,200,120,0.3)');
    bg.setAttribute('stroke-width', '1.5');
    svg.appendChild(bg);

    const pathEl = document.createElementNS(svgNS, 'path');
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', '#f6c878');
    pathEl.setAttribute('stroke-width', '4');
    pathEl.setAttribute('stroke-linecap', 'round');
    pathEl.setAttribute('stroke-linejoin', 'round');
    pathEl.setAttribute('opacity', '0.92');
    svg.appendChild(pathEl);
    this.pathEl = pathEl;

    for (const d of this.dots) {
      const { x, y } = this.dotXY(d);
      const grp = document.createElementNS(svgNS, 'g');
      grp.style.cursor = 'pointer';
      grp.dataset.id = String(d.id);

      const hit = document.createElementNS(svgNS, 'circle');
      hit.setAttribute('cx', String(x));
      hit.setAttribute('cy', String(y));
      hit.setAttribute('r', '26');
      hit.setAttribute('fill', 'rgba(0,0,0,0)');
      grp.appendChild(hit);

      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('class', 'kolam-dot');
      dot.setAttribute('cx', String(x));
      dot.setAttribute('cy', String(y));
      dot.setAttribute('r', '8');
      dot.setAttribute('fill', '#f6c878');
      dot.setAttribute('stroke', '#6a3c0f');
      dot.setAttribute('stroke-width', '1.5');
      grp.appendChild(dot);

      grp.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        this.tapDot(d.id);
      });
      svg.appendChild(grp);
    }

    panel.appendChild(svg);

    const status = document.createElement('div');
    status.style.cssText = `font-size:13px; letter-spacing:0.06em; opacity:0.85; text-align:center; min-height:18px;`;
    this.statusEl = status;
    panel.appendChild(status);

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'CLEAR';
    reset.style.cssText = `
      padding:7px 16px;
      background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.25);
      color:#e6eefb;
      font-family:inherit; font-size:11px; letter-spacing:0.22em; font-weight:600;
      border-radius:5px; cursor:pointer;
    `;
    reset.addEventListener('click', () => this.clearPath());
    panel.appendChild(reset);

    document.body.appendChild(root);
  }

  /* ------------------------------ Flow ---------------------------------- */

  private tapDot(id: number): void {
    if (this.isSolved) return;

    if (this.path.length === 0) {
      this.path.push(id);
      this.visited.add(id);
      this.refresh();
      return;
    }

    const last = this.path[this.path.length - 1];
    if (last === id) return;

    // Undo: tapping the previous dot retracts the last segment.
    if (this.path.length >= 2 && this.path[this.path.length - 2] === id) {
      const removed = this.path.pop()!;
      if (!this.path.includes(removed)) this.visited.delete(removed);
      this.refresh();
      return;
    }

    if (!this.isLegalStep(last, id)) {
      this.flashStatus('too far — step to a neighbour', '#e89090');
      return;
    }

    const closing = id === this.path[0] && this.visited.size === N * N;
    if (this.visited.has(id) && !closing) {
      this.flashStatus('each dot once — unbroken line', '#e89090');
      return;
    }

    this.path.push(id);
    this.visited.add(id);

    if (closing) {
      this.isSolved = true;
      if (this.statusEl) {
        this.statusEl.textContent = 'THE THRESHOLD IS BLESSED';
        this.statusEl.style.color = '#9fe0a6';
      }
      this.refresh();
      setTimeout(() => this.onSolved?.(), 900);
      return;
    }
    this.refresh();
  }

  private isLegalStep(fromId: number, toId: number): boolean {
    const a = this.dots[fromId];
    const b = this.dots[toId];
    const dx = Math.abs(a.col - b.col);
    const dy = Math.abs(a.row - b.row);
    return dx <= 1 && dy <= 1 && !(dx === 0 && dy === 0);
  }

  private clearPath(): void {
    if (this.isSolved) return;
    this.path = [];
    this.visited.clear();
    this.refresh();
  }

  /* ------------------------------ Render --------------------------------- */

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
    if (this.path.length === 0) {
      this.statusEl.textContent = 'touch a dot to begin';
    } else if (this.visited.size === N * N) {
      this.statusEl.textContent = 'close the loop — return to the first dot';
    } else {
      this.statusEl.textContent = 'extend the line';
    }
    this.statusEl.style.color = '';
  }

  private refresh(): void {
    if (this.pathEl) {
      if (this.path.length === 0) {
        this.pathEl.setAttribute('d', '');
      } else {
        const parts = this.path.map((id, i) => {
          const { x, y } = this.dotXY(this.dots[id]);
          return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        });
        this.pathEl.setAttribute('d', parts.join(' '));
      }
    }
    if (this.counterEl) {
      this.counterEl.textContent = `DOTS ${this.visited.size} / ${N * N}`;
    }
    if (this.svg) {
      const groups = this.svg.querySelectorAll('g[data-id]');
      groups.forEach((g) => {
        const id = Number((g as unknown as HTMLElement).dataset.id);
        const circle = g.querySelector('.kolam-dot') as SVGCircleElement | null;
        if (!circle) return;
        const visited = this.visited.has(id);
        const isStart = this.path.length > 0 && this.path[0] === id;
        const isHead = this.path.length > 0 && this.path[this.path.length - 1] === id;
        if (isStart) {
          circle.setAttribute('fill', '#fff2c8');
          circle.setAttribute('r', '10');
        } else if (isHead) {
          circle.setAttribute('fill', '#ffb85c');
          circle.setAttribute('r', '10');
        } else if (visited) {
          circle.setAttribute('fill', '#e69a3a');
          circle.setAttribute('r', '9');
        } else {
          circle.setAttribute('fill', '#f6c878');
          circle.setAttribute('r', '8');
        }
      });
    }
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
    this.pathEl = null;
    this.statusEl = null;
    this.counterEl = null;
    this.path = [];
    this.visited.clear();
    super.dispose();
  }
}
