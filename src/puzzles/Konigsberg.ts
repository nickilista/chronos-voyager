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
 * Königsberg Bridges — Euler's bridge-crossing puzzle with 7 difficulty levels.
 * Aligned with the iOS "Math Vs Time" implementation:
 *   - Canvas 2D for graph drawing (water background, bridges as curves, trail path)
 *   - Node overlays with degree display (from level 3+)
 *   - Reset / Undo controls
 *   - Hint system
 *   - Result overlay (won/lost with wax-seal motif)
 *   - Enlightenment-era color palette (gold, deep blue, cream, navy)
 */

/* ── Enlightenment palette ─────────────────────────────────────── */

const C_GOLD = '#C4944A';
const C_DEEP_BLUE = '#2B4570';
const C_CREAM = '#F0E6D3';
const C_NAVY = '#0D1520';
const C_WATER = '#3B6D99';
const C_WATER_LT = '#5A8DB8';
const C_BRIDGE = '#8B7355';
const C_BRIDGE_HI = '#D4A854';
const C_ERROR = '#FF6B6B';

/* ── Graph model ──────────────────────────────────────────────── */

interface KBNode {
  readonly id: number;
  readonly x: number; // 0..1 normalized
  readonly y: number;
  readonly label: string;
}

interface KBEdge {
  readonly id: number;
  readonly from: number;
  readonly to: number;
  readonly curve: number | null; // null = straight, ±value = curve offset
}

interface KBGraph {
  readonly nodes: KBNode[];
  readonly edges: KBEdge[];
  readonly hint: string;
}

function degree(graph: KBGraph, nodeID: number): number {
  return graph.edges.filter(e => e.from === nodeID || e.to === nodeID).length;
}

function findEdge(graph: KBGraph, a: number, b: number): number | null {
  const e = graph.edges.find(e => (e.from === a && e.to === b) || (e.from === b && e.to === a));
  return e ? e.id : null;
}

function findUntraversedEdge(graph: KBGraph, a: number, b: number, traversed: Set<number>): number | null {
  const e = graph.edges.find(e =>
    ((e.from === a && e.to === b) || (e.from === b && e.to === a)) && !traversed.has(e.id)
  );
  return e ? e.id : null;
}

/* ── Level definitions ────────────────────────────────────────── */

function getGraph(level: number): KBGraph {
  switch (level) {
    case 1: return level1();
    case 2: return level2();
    case 3: return level3();
    case 4: return level4();
    case 5: return level5();
    case 6: return level6();
    default: return level7();
  }
}

function level1(): KBGraph {
  return {
    nodes: [
      { id: 0, x: 0.5, y: 0.15, label: 'A' },
      { id: 1, x: 0.2, y: 0.8, label: 'B' },
      { id: 2, x: 0.8, y: 0.8, label: 'C' },
    ],
    edges: [
      { id: 0, from: 0, to: 1, curve: null },
      { id: 1, from: 1, to: 2, curve: null },
      { id: 2, from: 2, to: 0, curve: null },
    ],
    hint: 'All nodes have even degree — an Euler circuit exists. Start anywhere!',
  };
}

function level2(): KBGraph {
  return {
    nodes: [
      { id: 0, x: 0.2, y: 0.2, label: 'A' },
      { id: 1, x: 0.8, y: 0.2, label: 'B' },
      { id: 2, x: 0.8, y: 0.8, label: 'C' },
      { id: 3, x: 0.2, y: 0.8, label: 'D' },
    ],
    edges: [
      { id: 0, from: 0, to: 1, curve: null },
      { id: 1, from: 1, to: 2, curve: null },
      { id: 2, from: 2, to: 3, curve: null },
      { id: 3, from: 3, to: 0, curve: null },
      { id: 4, from: 0, to: 2, curve: null },
    ],
    hint: 'Two nodes have odd degree (A and C). Start at one of them!',
  };
}

function level3(): KBGraph {
  return {
    nodes: [
      { id: 0, x: 0.5, y: 0.15, label: 'N' },
      { id: 1, x: 0.2, y: 0.5, label: 'W' },
      { id: 2, x: 0.8, y: 0.5, label: 'E' },
      { id: 3, x: 0.5, y: 0.85, label: 'S' },
    ],
    edges: [
      { id: 0, from: 0, to: 1, curve: null },
      { id: 1, from: 0, to: 2, curve: null },
      { id: 2, from: 1, to: 2, curve: null },
      { id: 3, from: 1, to: 3, curve: null },
      { id: 4, from: 2, to: 3, curve: null },
      { id: 5, from: 1, to: 3, curve: -0.4 },
    ],
    hint: 'Two nodes have odd degree. An Euler path must start/end at odd-degree nodes.',
  };
}

function level4(): KBGraph {
  return {
    nodes: [
      { id: 0, x: 0.5, y: 0.1, label: 'A' },
      { id: 1, x: 0.2, y: 0.4, label: 'B' },
      { id: 2, x: 0.8, y: 0.4, label: 'C' },
      { id: 3, x: 0.2, y: 0.8, label: 'D' },
      { id: 4, x: 0.8, y: 0.8, label: 'E' },
    ],
    edges: [
      { id: 0, from: 0, to: 1, curve: null },
      { id: 1, from: 0, to: 2, curve: null },
      { id: 2, from: 1, to: 2, curve: null },
      { id: 3, from: 1, to: 3, curve: null },
      { id: 4, from: 2, to: 4, curve: null },
      { id: 5, from: 3, to: 4, curve: null },
      { id: 6, from: 1, to: 4, curve: null },
      { id: 7, from: 2, to: 3, curve: null },
    ],
    hint: 'All nodes have even degree — an Euler circuit exists. Start anywhere and return!',
  };
}

function level5(): KBGraph {
  return {
    nodes: [
      { id: 0, x: 0.15, y: 0.3, label: 'A' },
      { id: 1, x: 0.5, y: 0.1, label: 'B' },
      { id: 2, x: 0.85, y: 0.3, label: 'C' },
      { id: 3, x: 0.15, y: 0.7, label: 'D' },
      { id: 4, x: 0.5, y: 0.9, label: 'E' },
      { id: 5, x: 0.85, y: 0.7, label: 'F' },
    ],
    edges: [
      { id: 0, from: 0, to: 1, curve: null },
      { id: 1, from: 1, to: 2, curve: null },
      { id: 2, from: 0, to: 3, curve: null },
      { id: 3, from: 2, to: 5, curve: null },
      { id: 4, from: 3, to: 4, curve: null },
      { id: 5, from: 4, to: 5, curve: null },
      { id: 6, from: 0, to: 4, curve: null },
      { id: 7, from: 1, to: 5, curve: null },
      { id: 8, from: 1, to: 4, curve: null },
    ],
    hint: 'A and F have odd degree (3). Start at A or F for an Euler path.',
  };
}

function level6(): KBGraph {
  return {
    nodes: [
      { id: 0, x: 0.15, y: 0.2, label: 'A' },
      { id: 1, x: 0.5, y: 0.15, label: 'B' },
      { id: 2, x: 0.85, y: 0.2, label: 'C' },
      { id: 3, x: 0.15, y: 0.7, label: 'D' },
      { id: 4, x: 0.5, y: 0.65, label: 'E' },
      { id: 5, x: 0.85, y: 0.7, label: 'F' },
      { id: 6, x: 0.5, y: 0.92, label: 'G' },
    ],
    edges: [
      { id: 0, from: 0, to: 1, curve: null },
      { id: 1, from: 1, to: 2, curve: null },
      { id: 2, from: 3, to: 4, curve: null },
      { id: 3, from: 4, to: 5, curve: null },
      { id: 4, from: 0, to: 3, curve: null },
      { id: 5, from: 1, to: 4, curve: null },
      { id: 6, from: 2, to: 5, curve: null },
      { id: 7, from: 0, to: 4, curve: null },
      { id: 8, from: 1, to: 5, curve: null },
      { id: 9, from: 3, to: 6, curve: null },
      { id: 10, from: 6, to: 5, curve: null },
    ],
    hint: 'A and D have odd degree — Euler path from A to D (or D to A).',
  };
}

function level7(): KBGraph {
  return {
    nodes: [
      { id: 0, x: 0.15, y: 0.15, label: 'A' },
      { id: 1, x: 0.5, y: 0.1, label: 'B' },
      { id: 2, x: 0.85, y: 0.15, label: 'C' },
      { id: 3, x: 0.1, y: 0.5, label: 'D' },
      { id: 4, x: 0.5, y: 0.5, label: 'E' },
      { id: 5, x: 0.9, y: 0.5, label: 'F' },
      { id: 6, x: 0.3, y: 0.88, label: 'G' },
      { id: 7, x: 0.7, y: 0.88, label: 'H' },
    ],
    edges: [
      { id: 0, from: 0, to: 1, curve: null },
      { id: 1, from: 1, to: 2, curve: null },
      { id: 2, from: 2, to: 5, curve: null },
      { id: 3, from: 5, to: 7, curve: null },
      { id: 4, from: 7, to: 6, curve: null },
      { id: 5, from: 6, to: 3, curve: null },
      { id: 6, from: 3, to: 0, curve: null },
      { id: 7, from: 1, to: 4, curve: null },
      { id: 8, from: 3, to: 4, curve: null },
      { id: 9, from: 4, to: 7, curve: null },
      { id: 10, from: 4, to: 6, curve: null },
      { id: 11, from: 1, to: 3, curve: -0.3 },
    ],
    hint: 'G and H have odd degree (3). Start at G or H for the Euler path.',
  };
}

/* ── Canvas size ──────────────────────────────────────────────── */

function CANVAS_W(): number { return Math.min(360, window.innerWidth - 48); }
function CANVAS_H(): number { return Math.round(CANVAS_W() * 300 / 360); }
const NODE_RADIUS = 22;

/* ── Puzzle class ─────────────────────────────────────────────── */

export class KonigsbergPuzzle extends Puzzle {
  readonly title = 'KÖNIGSBERG';
  readonly subtitle = "euler's bridges";
  readonly instructions =
    'Cross every bridge exactly once. Tap a landmass to begin, then step to adjacent shores. No bridge may be retraced.';

  private level = 7;
  private graph: KBGraph = getGraph(7);
  private path: number[] = [];
  private traversedEdges: Set<number> = new Set();
  private phase: 'playing' | 'won' | 'lost' = 'playing';
  private feedbackText = '';
  private feedbackColor = '';
  private showHint = false;

  // DOM
  private root: HTMLDivElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private nodeButtons: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private counterEl: HTMLDivElement | null = null;
  private hintEl: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private controlsEl: HTMLDivElement | null = null;
  private degreeInfoEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.buildDom();
    this.setupLevel();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color(C_NAVY), roughness: 0.7, metalness: 0.18, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color(C_GOLD), emissive: new Color('#2a1a0a'),
        emissiveIntensity: 0.45, roughness: 0.4, metalness: 0.85, side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const lamp = new PointLight('#ffd79a', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-konigsberg';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: 'rgba(13,21,32,0.92)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(196,148,74,0.25)', borderTop: `3px solid ${C_GOLD}`,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_CREAM,
      maxHeight: '96vh', overflowY: 'auto', maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box',
    });
    root.appendChild(panel);

    // Header row (hint toggle + level + help)
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: '4px', borderBottom: `1px solid ${C_GOLD}40`,
    });

    const hintBtn = document.createElement('button');
    hintBtn.type = 'button';
    hintBtn.textContent = '💡';
    Object.assign(hintBtn.style, {
      background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '4px',
    });
    hintBtn.addEventListener('click', () => { this.showHint = !this.showHint; this.refreshUI(); });

    const levelLabel = document.createElement('div');
    Object.assign(levelLabel.style, { fontSize: '12px', color: `${C_CREAM}99`, letterSpacing: '0.1em' });
    levelLabel.textContent = `LEVEL ${this.level}`;

    const helpBtn = document.createElement('button');
    helpBtn.type = 'button';
    helpBtn.textContent = '?';
    Object.assign(helpBtn.style, {
      background: 'none', border: `1px solid ${C_GOLD}66`, borderRadius: '50%',
      width: '24px', height: '24px', color: C_GOLD, fontSize: '13px', cursor: 'pointer',
      fontWeight: '700', lineHeight: '1',
    });
    helpBtn.addEventListener('click', () => this.showRulesOverlay());

    header.append(hintBtn, levelLabel, helpBtn);
    panel.appendChild(header);

    // Instruction card
    const instrCard = document.createElement('div');
    Object.assign(instrCard.style, {
      textAlign: 'center', padding: '8px 16px',
      background: `${C_DEEP_BLUE}80`, borderRadius: '8px',
      border: `1px solid ${C_GOLD}33`,
    });
    instrCard.innerHTML = `
      <div style="font-size:13px;font-weight:500;color:${C_CREAM}">Find a path crossing every bridge exactly once</div>
      <div id="kb-bridge-count" style="font-size:11px;color:${C_GOLD}80;margin-top:2px"></div>
    `;
    panel.appendChild(instrCard);

    // Status row
    const statusRow = document.createElement('div');
    Object.assign(statusRow.style, {
      display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
      fontSize: '12px', padding: '2px 4px',
    });

    this.counterEl = document.createElement('div');
    Object.assign(this.counterEl.style, { color: `${C_GOLD}b3`, fontWeight: '500' });

    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, { fontSize: '12px', fontWeight: '500', textAlign: 'center', flex: '1' });

    this.degreeInfoEl = document.createElement('div');
    Object.assign(this.degreeInfoEl.style, { color: `${C_CREAM}66`, fontSize: '11px' });

    statusRow.append(this.counterEl, this.statusEl, this.degreeInfoEl);
    panel.appendChild(statusRow);

    // Graph canvas wrapper
    const canvasWrap = document.createElement('div');
    Object.assign(canvasWrap.style, {
      position: 'relative', width: CANVAS_W() + 'px', height: CANVAS_H() + 'px',
      borderRadius: '12px', overflow: 'hidden',
      border: `1px solid ${C_GOLD}33`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    });

    const cvs = document.createElement('canvas');
    cvs.width = CANVAS_W() * 2;
    cvs.height = CANVAS_H() * 2;
    Object.assign(cvs.style, { width: CANVAS_W() + 'px', height: CANVAS_H() + 'px', display: 'block' });
    this.ctx2d = cvs.getContext('2d')!;
    this.canvasEl = cvs;
    canvasWrap.appendChild(cvs);

    // Node buttons overlay
    this.nodeButtons = document.createElement('div');
    Object.assign(this.nodeButtons.style, {
      position: 'absolute', inset: '0', pointerEvents: 'none',
    });
    canvasWrap.appendChild(this.nodeButtons);

    panel.appendChild(canvasWrap);

    // Control buttons
    this.controlsEl = document.createElement('div');
    Object.assign(this.controlsEl.style, { display: 'flex', gap: '8px', width: '100%' });
    panel.appendChild(this.controlsEl);

    // Hint bubble
    this.hintEl = document.createElement('div');
    Object.assign(this.hintEl.style, {
      display: 'none', padding: '8px 12px', borderRadius: '8px',
      background: `${C_GOLD}14`, border: `1px solid ${C_GOLD}33`,
      fontSize: '12px', color: `${C_CREAM}dd`, textAlign: 'center',
      maxWidth: CANVAS_W() + 'px',
    });
    panel.appendChild(this.hintEl);

    // Overlay container (for results & rules)
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    // Inject animation keyframe
    if (!document.getElementById('kb-anims')) {
      const style = document.createElement('style');
      style.id = 'kb-anims';
      style.textContent = `
        @keyframes kb-pop { from { transform: scale(0.92); opacity:0; } to { transform: scale(1); opacity:1; } }
        @keyframes kb-shake { 0%{transform:translateX(0)} 20%{transform:translateX(10px)} 40%{transform:translateX(-8px)} 60%{transform:translateX(4px)} 80%{transform:translateX(-2px)} 100%{transform:translateX(0)} }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(root);
  }

  /* ═══════════════════ Level setup ═══════════════════════════════ */

  private setupLevel(): void {
    this.graph = getGraph(this.level);
    this.path = [];
    this.traversedEdges = new Set();
    this.phase = 'playing';
    this.feedbackText = '';
    this.showHint = false;
    this.drawCanvas();
    this.buildNodeButtons();
    this.refreshUI();
  }

  /* ═══════════════════ Canvas drawing ════════════════════════════ */

  private drawCanvas(): void {
    const c = this.ctx2d!;
    const s = 2;
    c.clearRect(0, 0, CANVAS_W() * s, CANVAS_H() * s);
    c.save();
    c.scale(s, s);

    // Water background gradient
    const grad = c.createLinearGradient(0, 0, 0, CANVAS_H());
    grad.addColorStop(0, hexToRGBA(C_WATER, 0.25));
    grad.addColorStop(1, hexToRGBA(C_WATER_LT, 0.15));
    c.fillStyle = grad;
    roundRect(c, 0, 0, CANVAS_W(), CANVAS_H(), 12);
    c.fill();

    // Water ripples
    c.strokeStyle = hexToRGBA(C_WATER, 0.15);
    c.lineWidth = 0.8;
    for (let i = 0; i < CANVAS_W(); i += 40) {
      c.beginPath();
      c.moveTo(i, CANVAS_H() * 0.3);
      c.quadraticCurveTo(i + 10, CANVAS_H() * 0.3 - 3, i + 20, CANVAS_H() * 0.3);
      c.stroke();
    }

    // Draw bridges (edges)
    this.drawBridges(c);

    // Draw trail path
    this.drawTrailPath(c);

    // Draw nodes
    this.drawNodes(c);

    c.restore();
  }

  private drawBridges(c: CanvasRenderingContext2D): void {
    for (const edge of this.graph.edges) {
      const from = this.nodePos(edge.from);
      const to = this.nodePos(edge.to);
      const traversed = this.traversedEdges.has(edge.id);

      const midX = (from.x + to.x) / 2 + (edge.curve ?? 0) * 30;
      const midY = (from.y + to.y) / 2 + (edge.curve ?? 0) * 30;

      // Bridge body
      c.beginPath();
      c.moveTo(from.x, from.y);
      c.quadraticCurveTo(midX, midY, to.x, to.y);
      c.strokeStyle = traversed ? C_BRIDGE_HI : C_BRIDGE;
      c.lineWidth = traversed ? 6 : 4;
      c.lineCap = 'round';
      c.stroke();

      // Dashed outline for untraversed
      if (!traversed) {
        c.beginPath();
        c.moveTo(from.x, from.y);
        c.quadraticCurveTo(midX, midY, to.x, to.y);
        c.strokeStyle = hexToRGBA(C_BRIDGE, 0.4);
        c.lineWidth = 8;
        c.setLineDash([2, 4]);
        c.stroke();
        c.setLineDash([]);
      }
    }
  }

  private drawTrailPath(c: CanvasRenderingContext2D): void {
    if (this.path.length < 2) return;
    c.beginPath();
    const start = this.nodePos(this.path[0]);
    c.moveTo(start.x, start.y);

    for (let i = 1; i < this.path.length; i++) {
      const edgeID = findEdge(this.graph, this.path[i - 1], this.path[i]);
      const edge = this.graph.edges.find(e => e.id === edgeID);
      const from = this.nodePos(this.path[i - 1]);
      const to = this.nodePos(this.path[i]);
      const midX = (from.x + to.x) / 2 + (edge?.curve ?? 0) * 30;
      const midY = (from.y + to.y) / 2 + (edge?.curve ?? 0) * 30;
      c.quadraticCurveTo(midX, midY, to.x, to.y);
    }

    c.strokeStyle = 'rgba(255,60,60,0.6)';
    c.lineWidth = 3;
    c.setLineDash([6, 3]);
    c.stroke();
    c.setLineDash([]);
  }

  private drawNodes(c: CanvasRenderingContext2D): void {
    for (const node of this.graph.nodes) {
      const pos = this.nodePos(node.id);
      const isActive = this.path.length > 0 && this.path[this.path.length - 1] === node.id;
      const isStart = this.path.length > 0 && this.path[0] === node.id;
      const visited = this.path.includes(node.id);
      const deg = degree(this.graph, node.id);
      const isOdd = deg % 2 !== 0;

      // Node circle
      c.beginPath();
      c.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
      if (isActive) {
        c.fillStyle = C_GOLD;
      } else if (visited) {
        c.fillStyle = hexToRGBA(C_GOLD, 0.3);
      } else {
        c.fillStyle = hexToRGBA(C_DEEP_BLUE, 0.6);
      }
      c.fill();

      // Border
      c.beginPath();
      c.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
      c.strokeStyle = isActive ? C_GOLD : (visited ? hexToRGBA(C_GOLD, 0.5) : hexToRGBA(C_CREAM, 0.3));
      c.lineWidth = isActive ? 2.5 : 1;
      c.stroke();

      // Start indicator
      if (isStart) {
        c.beginPath();
        c.arc(pos.x, pos.y, NODE_RADIUS + 4, 0, Math.PI * 2);
        c.strokeStyle = hexToRGBA('#00cc00', 0.6);
        c.lineWidth = 2;
        c.stroke();
      }

      // Label
      c.fillStyle = isActive ? C_NAVY : C_CREAM;
      c.font = 'bold 13px Rajdhani, system-ui';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(node.label, pos.x, pos.y - (this.level >= 3 ? 4 : 0));

      // Degree display (from level 3+)
      if (this.level >= 3) {
        c.font = '600 9px monospace';
        c.fillStyle = isOdd ? 'rgba(255,80,80,0.8)' : 'rgba(80,200,80,0.7)';
        c.fillText(String(deg), pos.x, pos.y + 10);
      }
    }
  }

  private nodePos(id: number): { x: number; y: number } {
    const node = this.graph.nodes.find(n => n.id === id);
    if (!node) return { x: 0, y: 0 };
    return { x: node.x * CANVAS_W(), y: node.y * CANVAS_H() };
  }

  /* ═══════════════════ Node buttons ═════════════════════════════ */

  private buildNodeButtons(): void {
    if (!this.nodeButtons) return;
    this.nodeButtons.innerHTML = '';

    for (const node of this.graph.nodes) {
      const pos = this.nodePos(node.id);
      const btn = document.createElement('div');
      Object.assign(btn.style, {
        position: 'absolute',
        left: (pos.x - NODE_RADIUS - 2) + 'px',
        top: (pos.y - NODE_RADIUS - 2) + 'px',
        width: (NODE_RADIUS * 2 + 4) + 'px',
        height: (NODE_RADIUS * 2 + 4) + 'px',
        borderRadius: '50%',
        cursor: 'pointer',
        pointerEvents: 'auto',
      });
      btn.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        this.tapNode(node.id);
      });
      this.nodeButtons.appendChild(btn);
    }
  }

  /* ═══════════════════ Game logic ════════════════════════════════ */

  private tapNode(nodeID: number): void {
    if (this.phase !== 'playing') return;

    if (this.path.length === 0) {
      this.path.push(nodeID);
      this.feedbackText = '';
      this.drawCanvas();
      this.refreshUI();
      return;
    }

    const lastNode = this.path[this.path.length - 1];
    if (nodeID === lastNode) return;

    // Check adjacency — find untraversed edge
    const edgeID = findUntraversedEdge(this.graph, lastNode, nodeID, this.traversedEdges);
    if (edgeID !== null) {
      this.path.push(nodeID);
      this.traversedEdges.add(edgeID);
      this.feedbackText = '';

      // Check win
      if (this.traversedEdges.size === this.graph.edges.length) {
        this.phase = 'won';
        this.isSolved = true;
        this.drawCanvas();
        this.refreshUI();
        setTimeout(() => this.showResultOverlay(true), 400);
        return;
      }

      this.drawCanvas();
      this.refreshUI();
    } else {
      // Not adjacent or no untraversed edge
      this.shake();
      this.feedbackText = 'No available bridge there';
      this.feedbackColor = C_ERROR;
      this.refreshUI();
      setTimeout(() => {
        if (this.phase === 'playing') {
          this.feedbackText = '';
          this.refreshUI();
        }
      }, 1500);
    }
  }

  private resetPath(): void {
    this.path = [];
    this.traversedEdges = new Set();
    this.feedbackText = '';
    this.drawCanvas();
    this.refreshUI();
  }

  private undoLast(): void {
    if (this.path.length < 2) return;
    const last = this.path.pop()!;
    const prev = this.path[this.path.length - 1];
    const edgeID = findEdge(this.graph, prev, last);
    if (edgeID !== null) {
      this.traversedEdges.delete(edgeID);
    }
    this.drawCanvas();
    this.refreshUI();
  }

  private shake(): void {
    if (!this.canvasEl) return;
    this.canvasEl.style.animation = 'kb-shake 0.3s ease-out';
    setTimeout(() => {
      if (this.canvasEl) this.canvasEl.style.animation = '';
    }, 300);
  }

  /* ═══════════════════ UI refresh ════════════════════════════════ */

  private refreshUI(): void {
    // Counter
    if (this.counterEl) {
      this.counterEl.textContent = `${this.traversedEdges.size}/${this.graph.edges.length}`;
    }

    // Feedback status
    if (this.statusEl) {
      this.statusEl.textContent = this.feedbackText;
      this.statusEl.style.color = this.feedbackColor || '';
    }

    // Degree info
    if (this.degreeInfoEl) {
      const oddCount = this.graph.nodes.filter(n => degree(this.graph, n.id) % 2 !== 0).length;
      this.degreeInfoEl.textContent = `Odd: ${oddCount}`;
    }

    // Bridge count in instruction
    const bcEl = document.getElementById('kb-bridge-count');
    if (bcEl) {
      bcEl.textContent = `${this.graph.edges.length} bridges · ${this.graph.nodes.length} landmasses`;
    }

    // Controls
    if (this.controlsEl) {
      this.controlsEl.innerHTML = '';
      if (this.phase === 'playing') {
        const resetBtn = this.makeControlBtn('↺ Reset', () => this.resetPath());
        this.controlsEl.appendChild(resetBtn);

        if (this.path.length > 1) {
          const undoBtn = this.makeControlBtn('↩ Undo', () => this.undoLast());
          undoBtn.style.color = `${C_GOLD}cc`;
          undoBtn.style.borderColor = `${C_GOLD}33`;
          this.controlsEl.appendChild(undoBtn);
        }
      }
    }

    // Hint bubble
    if (this.hintEl) {
      this.hintEl.style.display = this.showHint ? 'block' : 'none';
      this.hintEl.textContent = `💡 ${this.graph.hint}`;
    }
  }

  private makeControlBtn(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    Object.assign(btn.style, {
      flex: '1', padding: '8px 10px',
      background: 'rgba(255,255,255,0.05)', border: `1px solid ${C_GOLD}26`,
      color: `${C_CREAM}99`, fontFamily: 'inherit', fontSize: '12px',
      fontWeight: '500', borderRadius: '20px', cursor: 'pointer',
      letterSpacing: '0.04em',
    });
    btn.addEventListener('click', onClick);
    return btn;
  }

  /* ═══════════════════ Result overlay ════════════════════════════ */

  private showResultOverlay(won: boolean): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '320px', width: '90%', textAlign: 'center', padding: '28px 32px',
      background: `linear-gradient(to bottom, rgba(6,9,16,0.95), ${C_NAVY})`,
      border: `1px solid ${C_GOLD}4d`, borderRadius: '14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      animation: 'kb-pop 0.3s ease-out',
    });

    // Wax seal canvas
    const sealCanvas = document.createElement('canvas');
    sealCanvas.width = 128;
    sealCanvas.height = 128;
    Object.assign(sealCanvas.style, { width: '64px', height: '64px', margin: '0 auto 14px' });
    this.drawSeal(sealCanvas, won);
    card.appendChild(sealCanvas);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '22px', fontWeight: '700', color: C_CREAM, marginBottom: '6px' });
    title.textContent = won ? 'Path Complete!' : 'No Solution Found';
    card.appendChild(title);

    // Message
    const msg = document.createElement('div');
    Object.assign(msg.style, { fontSize: '14px', color: `${C_CREAM}b3`, marginBottom: '18px', lineHeight: '1.5' });
    msg.textContent = won
      ? 'You have successfully crossed every bridge exactly once. Euler would be proud!'
      : 'The path cannot be completed from this position. Try a different starting node.';
    card.appendChild(msg);

    // Button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = won ? 'CONTINUE' : 'TRY AGAIN';
    Object.assign(btn.style, {
      padding: '10px 24px', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
      color: C_GOLD, background: `${C_GOLD}1f`,
      border: `1.5px solid ${C_GOLD}80`, borderRadius: '20px',
      cursor: 'pointer', letterSpacing: '0.08em',
    });
    btn.addEventListener('click', () => {
      this.overlayEl!.style.display = 'none';
      if (won) {
        this.onSolved?.();
      } else {
        this.setupLevel();
      }
    });
    card.appendChild(btn);

    this.overlayEl.appendChild(card);
  }

  private drawSeal(canvas: HTMLCanvasElement, won: boolean): void {
    const c = canvas.getContext('2d')!;
    c.scale(2, 2);
    const cx = 32, cy = 32, r = 28;
    const sealColor = won ? C_GOLD : '#b33333';

    // Starburst
    c.beginPath();
    const pts = 12;
    for (let i = 0; i < pts * 2; i++) {
      const angle = (i * Math.PI) / pts - Math.PI / 2;
      const pr = i % 2 === 0 ? r : r * 0.78;
      const px = cx + Math.cos(angle) * pr;
      const py = cy + Math.sin(angle) * pr;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = sealColor;
    c.fill();

    // Inner circle
    c.beginPath();
    c.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(255,255,255,0.3)';
    c.lineWidth = 1;
    c.stroke();

    if (won) {
      // Bridge icon
      c.beginPath();
      c.arc(cx, cy + 4, 12, (200 * Math.PI) / 180, (340 * Math.PI) / 180, false);
      c.strokeStyle = 'white';
      c.lineWidth = 2.5;
      c.lineCap = 'round';
      c.stroke();
      // Pillars
      for (const px of [cx - 10, cx + 10]) {
        c.beginPath();
        c.moveTo(px, cy - 2);
        c.lineTo(px, cy + 10);
        c.strokeStyle = 'white';
        c.lineWidth = 2;
        c.stroke();
      }
    } else {
      // X mark
      const s = 9;
      c.beginPath();
      c.moveTo(cx - s, cy - s);
      c.lineTo(cx + s, cy + s);
      c.strokeStyle = 'white';
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.stroke();
      c.beginPath();
      c.moveTo(cx + s, cy - s);
      c.lineTo(cx - s, cy + s);
      c.stroke();
    }
  }

  /* ═══════════════════ Rules overlay ═════════════════════════════ */

  private showRulesOverlay(): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '340px', width: '90%', padding: '24px',
      background: C_CREAM, borderRadius: '14px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      animation: 'kb-pop 0.25s ease-out',
    });

    const title = document.createElement('div');
    Object.assign(title.style, {
      fontSize: '18px', fontWeight: '700', color: C_DEEP_BLUE,
      textAlign: 'center', marginBottom: '16px',
    });
    title.textContent = 'Königsberg Bridges';
    card.appendChild(title);

    const rules = [
      ['🌉', 'Each line is a bridge connecting two landmasses.'],
      ['🚶', 'Cross every bridge exactly once in a single path.'],
      ['🔢', 'The number on each node shows its degree (connection count).'],
      ['📐', 'An Euler path exists only if 0 or 2 nodes have odd degree.'],
      ['❌', 'If more than 2 nodes have odd degree, no solution exists.'],
    ];

    for (const [icon, text] of rules) {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px',
      });
      const iconEl = document.createElement('div');
      Object.assign(iconEl.style, {
        width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${C_DEEP_BLUE}14`, borderRadius: '50%', fontSize: '16px', flexShrink: '0',
      });
      iconEl.textContent = icon;
      const textEl = document.createElement('div');
      Object.assign(textEl.style, { fontSize: '13px', color: `${C_DEEP_BLUE}dd`, lineHeight: '1.4' });
      textEl.textContent = text;
      row.append(iconEl, textEl);
      card.appendChild(row);
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'CLOSE';
    Object.assign(closeBtn.style, {
      display: 'block', margin: '14px auto 0', padding: '8px 24px',
      background: C_DEEP_BLUE, border: 'none', borderRadius: '6px',
      color: 'white', fontSize: '12px', fontWeight: '600', letterSpacing: '0.1em',
      cursor: 'pointer',
    });
    closeBtn.addEventListener('click', () => { this.overlayEl!.style.display = 'none'; });
    card.appendChild(closeBtn);

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
    const animStyle = document.getElementById('kb-anims');
    if (animStyle) animStyle.remove();
    this.ctx2d = null;
    this.canvasEl = null;
    this.nodeButtons = null;
    this.statusEl = null;
    this.counterEl = null;
    this.hintEl = null;
    this.overlayEl = null;
    this.controlsEl = null;
    this.degreeInfoEl = null;
    super.dispose();
  }
}

/* ── Utility ──────────────────────────────────────────────────── */

function hexToRGBA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}
