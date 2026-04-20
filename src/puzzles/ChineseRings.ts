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
 * Chinese Nine Rings (九连环 Jiǔliánhuán) — remove all rings from the bar
 * using the two allowed operations:
 *   1. Always toggle ring 1 (index 0) freely
 *   2. Toggle ring i+1 if ring i is ON and all rings 0..<i are OFF
 *
 * This is equivalent to Gray code traversal. Aligned with the iOS
 * ChineseRingsView.swift implementation: Canvas 2D board, binary view,
 * undo/reset/hint, cloud motifs, bronze/jade/gold color theme.
 */

/* ── Configuration ───────────────────────────────────────────── */

const NUM_RINGS = 9;

/** Minimum moves for n rings (Gray code formula) */
function minMovesFor(n: number): number {
  if (n % 2 === 1) return Math.floor((Math.pow(2, n + 1) - 1) / 3);
  return Math.floor((Math.pow(2, n + 1) - 2) / 3);
}

const MIN_MOVES = minMovesFor(NUM_RINGS);

/* ── Canvas dimensions ───────────────────────────────────────── */

function CANVAS_W(): number { return Math.min(520, window.innerWidth - 48); }
function CANVAS_H(): number { return Math.round(CANVAS_W() * 0.55); }

/* ── Colors (Chinese Bronze / Jade — matches iOS) ────────────── */

const C_BG_TOP       = '#0D0F1A';
const C_BG_BOTTOM    = '#1A1525';
const C_BAR_BRONZE   = '#CD7F32';
const C_BAR_HI       = '#E8A849';
const C_BAR_SHADOW   = '#7A4A1E';
const C_RING_GOLD    = '#D4AF37';
const C_RING_BRONZE  = '#B8860B';
const C_RING_DARK    = '#8B6914';
const C_GHOST        = '#333333';
const C_WIRE_SILVER  = '#A0A0A0';
const C_JADE         = '#2E8B57';
const C_CREAM        = '#F5E6CC';
const C_DANGER       = '#FF4040';
const C_GLOW_GOLD    = '#FFD700';

/* ── Puzzle class ─────────────────────────────────────────────── */

export class ChineseRingsPuzzle extends Puzzle {
  readonly title = 'NINE LINKED RINGS';
  readonly subtitle = '九连环 jiǔliánhuán';
  readonly instructions =
    'Remove every ring from the bar. Ring 1 is always free. Ring i+1 can be toggled only when ring i is ON and all rings before it are OFF.';

  private rings: boolean[] = [];       // true = on bar
  private moveCount = 0;
  private history: boolean[][] = [];
  private lastToggled = -1;
  private invalidRing = -1;
  private shakeTimer = 0;
  private pulsePhase = 0;
  private solved = false;
  private hintsUsed = 0;

  // DOM
  private root: HTMLDivElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private movesEl: HTMLSpanElement | null = null;
  private minEl: HTMLSpanElement | null = null;
  private hintLineEl: HTMLDivElement | null = null;
  private binaryEl: HTMLDivElement | null = null;
  private remainEl: HTMLSpanElement | null = null;
  private statusEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.rings = Array(NUM_RINGS).fill(true);
    this.moveCount = 0;
    this.history = [];
    this.lastToggled = -1;
    this.solved = false;

    this.buildBackdrop();
    this.buildDom();
    this.drawBoard();
    this.refreshUI();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({
        color: new Color(C_BG_BOTTOM),
        roughness: 0.65,
        metalness: 0.2,
        side: DoubleSide,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    // Decorative jade ring on floor
    const jadeRing = new Mesh(
      new RingGeometry(3.0, 3.18, 12),
      new MeshStandardMaterial({
        color: new Color(C_JADE),
        emissive: new Color('#0a2a15'),
        emissiveIntensity: 0.55,
        roughness: 0.45,
        metalness: 0.85,
        side: DoubleSide,
      }),
    );
    jadeRing.rotation.x = -Math.PI / 2;
    jadeRing.position.y = -2.37;
    this.group.add(jadeRing);

    const warm = new PointLight('#f5b870', 2.2, 24, 1.6);
    warm.position.set(0, 6, 4);
    this.group.add(warm);
  }

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-chinese-rings';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: 'rgba(13,15,26,0.92)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(212,175,55,0.25)', borderTop: '3px solid ' + C_RING_GOLD,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_CREAM,
      maxHeight: '96vh', overflowY: 'auto', maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box',
    });
    root.appendChild(panel);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '16px', letterSpacing: '0.22em', color: C_RING_GOLD, fontWeight: '700' });
    title.textContent = '九连环 · NINE LINKED RINGS';
    panel.appendChild(title);

    // HUD row: moves / min
    const hud = document.createElement('div');
    Object.assign(hud.style, {
      display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'center',
      fontSize: '13px', letterSpacing: '0.08em',
    });

    this.movesEl = document.createElement('span');
    Object.assign(this.movesEl.style, { fontWeight: '700', fontFamily: 'monospace' });
    const sep = document.createElement('span');
    sep.textContent = '/';
    Object.assign(sep.style, { opacity: '0.4', fontSize: '12px' });
    this.minEl = document.createElement('span');
    Object.assign(this.minEl.style, { opacity: '0.5', fontFamily: 'monospace' });

    hud.append(this.movesEl, sep, this.minEl);
    panel.appendChild(hud);

    // Hint line (toggleable rings)
    this.hintLineEl = document.createElement('div');
    Object.assign(this.hintLineEl.style, {
      fontSize: '11px', opacity: '0.5', textAlign: 'center', minHeight: '14px',
    });
    panel.appendChild(this.hintLineEl);

    // Board canvas
    const boardWrap = document.createElement('div');
    Object.assign(boardWrap.style, {
      position: 'relative', width: CANVAS_W() + 'px', height: CANVAS_H() + 'px',
      borderRadius: '12px', overflow: 'hidden',
      border: '1px solid rgba(205,127,50,0.3)',
    });

    const cvs = document.createElement('canvas');
    cvs.width = CANVAS_W() * 2;
    cvs.height = CANVAS_H() * 2;
    Object.assign(cvs.style, { width: CANVAS_W() + 'px', height: CANVAS_H() + 'px', display: 'block', cursor: 'pointer' });
    this.ctx2d = cvs.getContext('2d')!;
    cvs.addEventListener('click', (e) => this.handleCanvasClick(e));
    boardWrap.appendChild(cvs);
    panel.appendChild(boardWrap);

    // Binary view
    const binaryRow = document.createElement('div');
    Object.assign(binaryRow.style, {
      display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center',
      fontSize: '11px', width: '100%', padding: '0 8px',
    });

    const bLabel = document.createElement('span');
    bLabel.textContent = 'BIN';
    Object.assign(bLabel.style, { fontFamily: 'monospace', opacity: '0.4' });

    this.binaryEl = document.createElement('div');
    Object.assign(this.binaryEl.style, {
      fontFamily: 'monospace', fontSize: '13px', fontWeight: '700', letterSpacing: '0.2em',
    });

    this.remainEl = document.createElement('span');
    Object.assign(this.remainEl.style, { fontFamily: 'monospace', opacity: '0.4', marginLeft: 'auto' });

    binaryRow.append(bLabel, this.binaryEl, this.remainEl);
    panel.appendChild(binaryRow);

    // Button bar: Undo / Reset / Hint
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '10px', marginTop: '4px' });

    const undoBtn = this.makeButton('UNDO', () => this.undo());
    const resetBtn = this.makeButton('RESET', () => this.resetPuzzle());
    const hintBtn = this.makeButton('HINT', () => this.handleHint(), C_GLOW_GOLD);

    btnRow.append(undoBtn, resetBtn, hintBtn);
    panel.appendChild(btnRow);

    // Status line
    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, {
      fontSize: '13px', letterSpacing: '0.06em', textAlign: 'center', minHeight: '20px',
    });
    panel.appendChild(this.statusEl);

    // Overlay container (for hint warning)
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    document.body.appendChild(root);

    // Inject animation keyframes
    if (!document.getElementById('rings-anims')) {
      const style = document.createElement('style');
      style.id = 'rings-anims';
      style.textContent = `
        @keyframes rings-pop { from { transform: scale(0.92); opacity:0; } to { transform: scale(1); opacity:1; } }
      `;
      document.head.appendChild(style);
    }
  }

  private makeButton(label: string, handler: () => void, color?: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    Object.assign(b.style, {
      padding: '7px 14px',
      background: color ? `${color}11` : 'rgba(255,255,255,0.04)',
      border: `1px solid ${color ? color + '44' : 'rgba(255,255,255,0.25)'}`,
      color: color ?? C_CREAM,
      fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.22em', fontWeight: '600',
      borderRadius: '5px', cursor: 'pointer', opacity: '0.85',
    });
    b.addEventListener('click', handler);
    return b;
  }

  /* ═══════════════════ Canvas board drawing ══════════════════════ */

  private drawBoard(): void {
    const c = this.ctx2d!;
    const s = 2;
    c.clearRect(0, 0, CANVAS_W() * s, CANVAS_H() * s);
    c.save();
    c.scale(s, s);

    const W = CANVAS_W();
    const H = CANVAS_H();

    // Background gradient
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, C_BG_TOP);
    bg.addColorStop(1, C_BG_BOTTOM);
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);

    // Cloud motifs
    this.drawCloudMotifs(c, W, H);

    // Bar + ornaments
    this.drawBar(c, W, H);

    // Wire
    this.drawWire(c, W, H);

    // Rings
    this.drawRings(c, W, H);

    c.restore();
  }

  /* ── Cloud motifs (matches iOS) ──────────────────────────────── */

  private drawCloudMotifs(c: CanvasRenderingContext2D, W: number, H: number): void {
    const cloudColor = 'rgba(255,255,255,0.03)';
    const positions = [
      [W * 0.1, H * 0.12], [W * 0.88, H * 0.1],
      [W * 0.08, H * 0.85], [W * 0.92, H * 0.88],
    ];
    for (const [cx, cy] of positions) {
      this.drawCloud(c, cx, cy, W * 0.06, cloudColor);
    }

    // Lattice lines
    c.strokeStyle = 'rgba(255,255,255,0.015)';
    c.lineWidth = 0.5;
    for (let x = 0; x <= W; x += W / 12) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + W * 0.05, H);
      c.stroke();
    }
  }

  private drawCloud(c: CanvasRenderingContext2D, cx: number, cy: number, scale: number, color: string): void {
    const offsets: [number, number, number][] = [
      [-0.6, 0, 0.8], [0, -0.4, 1.0], [0.6, 0, 0.8],
    ];
    c.fillStyle = color;
    for (const [dx, dy, r] of offsets) {
      const x = cx + dx * scale;
      const y = cy + dy * scale;
      const radius = r * scale;
      c.beginPath();
      c.ellipse(x, y, radius, radius, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  /* ── Bar drawing (matches iOS) ───────────────────────────────── */

  private drawBar(c: CanvasRenderingContext2D, W: number, H: number): void {
    const barY = H * 0.42;
    const barH = H * 0.06;
    const barLeft = W * 0.06;
    const barRight = W * 0.94;

    // Main bar with metallic gradient
    const barGrad = c.createLinearGradient(barLeft, barY - barH / 2, barLeft, barY + barH / 2);
    barGrad.addColorStop(0, C_BAR_HI);
    barGrad.addColorStop(0.3, C_BAR_BRONZE);
    barGrad.addColorStop(0.5, C_BAR_SHADOW);
    barGrad.addColorStop(0.7, C_BAR_BRONZE);
    barGrad.addColorStop(1, C_BAR_HI);

    this.roundRect(c, barLeft, barY - barH / 2, barRight - barLeft, barH, barH / 2);
    c.fillStyle = barGrad;
    c.fill();

    // Highlight line
    c.fillStyle = 'rgba(255,255,255,0.2)';
    this.roundRect(c, barLeft + 4, barY - barH * 0.3, barRight - barLeft - 8, barH * 0.15, 1);
    c.fill();

    // Left ornament (diamond finial)
    this.drawFinial(c, W * 0.06, barY, H * 0.08);

    // Right ornament (knot tassel)
    this.drawKnotTassel(c, W * 0.94, barY, H * 0.08);
  }

  private drawFinial(c: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    c.beginPath();
    c.moveTo(cx, cy - size);
    c.lineTo(cx + size * 0.7, cy);
    c.lineTo(cx, cy + size);
    c.lineTo(cx - size * 0.7, cy);
    c.closePath();

    const grad = c.createLinearGradient(cx - size, cy - size, cx + size, cy + size);
    grad.addColorStop(0, C_RING_GOLD);
    grad.addColorStop(0.5, C_BAR_BRONZE);
    grad.addColorStop(1, C_RING_DARK);
    c.fillStyle = grad;
    c.fill();

    c.strokeStyle = hexAlpha(C_RING_GOLD, 0.6);
    c.lineWidth = 1;
    c.stroke();
  }

  private drawKnotTassel(c: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    // Red knot circle
    const grad = c.createLinearGradient(cx, cy - size * 0.5, cx, cy + size * 0.5);
    grad.addColorStop(0, hexAlpha(C_DANGER, 0.8));
    grad.addColorStop(1, '#8B0000');
    c.beginPath();
    c.ellipse(cx, cy, size * 0.5, size * 0.5, 0, 0, Math.PI * 2);
    c.fillStyle = grad;
    c.fill();
    c.strokeStyle = hexAlpha(C_RING_GOLD, 0.5);
    c.lineWidth = 1;
    c.stroke();

    // Tassel lines
    c.strokeStyle = hexAlpha(C_DANGER, 0.5);
    c.lineWidth = 1.2;
    for (const dx of [-0.25, 0, 0.25]) {
      c.beginPath();
      c.moveTo(cx + dx * size, cy + size * 0.5);
      c.lineTo(cx + dx * size * 1.2, cy + size * 1.6);
      c.stroke();
    }
  }

  /* ── Wire drawing (matches iOS) ──────────────────────────────── */

  private drawWire(c: CanvasRenderingContext2D, W: number, H: number): void {
    const barY = H * 0.42;
    const spacing = this.ringSpacing(W);
    const startX = this.ringStartX(W);
    const radius = this.ringRadius(W, H);

    const wireStartX = startX - radius * 1.5;
    const wireEndX = NUM_RINGS > 1
      ? startX + (NUM_RINGS - 1) * spacing + radius * 1.5
      : startX + radius * 1.5;

    // Main horizontal wire
    c.strokeStyle = hexAlpha(C_WIRE_SILVER, 0.35);
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(wireStartX, barY - radius * 0.3);
    c.lineTo(wireEndX, barY - radius * 0.3);
    c.stroke();

    // Loop through each ON ring
    for (let i = 0; i < this.rings.length; i++) {
      if (this.rings[i]) {
        const x = startX + i * spacing;
        c.strokeStyle = hexAlpha(C_WIRE_SILVER, 0.5);
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(x - radius * 0.4, barY - radius * 0.3);
        c.quadraticCurveTo(x, barY + radius * 0.6, x + radius * 0.4, barY - radius * 0.3);
        c.stroke();
      }
    }
  }

  /* ── Ring drawing (matches iOS) ──────────────────────────────── */

  private drawRings(c: CanvasRenderingContext2D, W: number, H: number): void {
    const barY = H * 0.42;
    const spacing = this.ringSpacing(W);
    const startX = this.ringStartX(W);
    const radius = this.ringRadius(W, H);
    const offBarY = barY + H * 0.28;

    for (let i = 0; i < this.rings.length; i++) {
      const x = startX + i * spacing;
      const isOn = this.rings[i];
      const centerY = isOn ? barY : offBarY;
      const toggleable = this.canToggle(i);

      // Shake offset for invalid move
      let shakeOff = 0;
      if (this.invalidRing === i && this.shakeTimer > 0) {
        shakeOff = Math.sin(this.shakeTimer * 40) * 4 * this.shakeTimer;
      }
      const rx = x + shakeOff;

      if (isOn) {
        this.drawRingOn(c, rx, centerY, radius, i, toggleable, this.lastToggled === i);
      } else {
        this.drawRingOff(c, rx, centerY, radius, i, toggleable);
      }

      // Ring number label
      const labelY = isOn ? centerY - radius * 1.5 : centerY + radius * 1.5;
      c.fillStyle = isOn ? C_CREAM : C_GHOST;
      c.font = `bold ${Math.max(9, radius * 0.6)}px serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(i + 1), rx, labelY);
    }
  }

  private drawRingOn(c: CanvasRenderingContext2D, cx: number, cy: number,
                     radius: number, _index: number, toggleable: boolean, highlight: boolean): void {
    const thickness = Math.max(3, radius * 0.28);

    // Glow for toggleable rings
    if (toggleable) {
      const glowAlpha = 0.15 + 0.1 * Math.sin(this.pulsePhase * Math.PI * 2);
      c.fillStyle = hexAlpha(C_GLOW_GOLD, glowAlpha);
      c.beginPath();
      c.ellipse(cx, cy, radius * 1.3, radius * 1.3, 0, 0, Math.PI * 2);
      c.fill();
    }

    // Outer ring with gradient
    const ringGrad = c.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    ringGrad.addColorStop(0, C_RING_GOLD);
    ringGrad.addColorStop(0.3, C_RING_BRONZE);
    ringGrad.addColorStop(0.5, C_RING_DARK);
    ringGrad.addColorStop(0.7, C_RING_BRONZE);
    ringGrad.addColorStop(1, C_RING_GOLD);
    c.strokeStyle = ringGrad;
    c.lineWidth = thickness;
    c.beginPath();
    c.ellipse(cx, cy, radius, radius, 0, 0, Math.PI * 2);
    c.stroke();

    // Inner highlight for 3D metallic effect
    c.fillStyle = 'rgba(255,255,255,0.08)';
    c.beginPath();
    c.ellipse(cx, cy - radius * 0.2, radius * 0.75, radius * 0.2, 0, 0, Math.PI * 2);
    c.fill();

    // Recent toggle flash
    if (highlight) {
      c.strokeStyle = hexAlpha(C_GLOW_GOLD, 0.5);
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(cx, cy, radius + 2, radius + 2, 0, 0, Math.PI * 2);
      c.stroke();
    }
  }

  private drawRingOff(c: CanvasRenderingContext2D, cx: number, cy: number,
                      radius: number, _index: number, toggleable: boolean): void {
    const thickness = Math.max(2, radius * 0.18);

    // Glow for toggleable
    if (toggleable) {
      const glowAlpha = 0.08 + 0.06 * Math.sin(this.pulsePhase * Math.PI * 2);
      c.fillStyle = hexAlpha(C_GLOW_GOLD, glowAlpha);
      c.beginPath();
      c.ellipse(cx, cy, radius * 1.3, radius * 1.3, 0, 0, Math.PI * 2);
      c.fill();
    }

    // Ghost ring outline (dashed)
    c.strokeStyle = hexAlpha(C_GHOST, 0.5);
    c.lineWidth = thickness;
    c.setLineDash([4, 3]);
    c.beginPath();
    c.ellipse(cx, cy, radius, radius, 0, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
  }

  /* ── Layout helpers (matches iOS ratios) ─────────────────────── */

  private ringSpacing(W: number): number {
    const usable = W * 0.7;
    return NUM_RINGS > 1 ? usable / (NUM_RINGS - 1) : 0;
  }

  private ringStartX(W: number): number {
    return W * 0.15;
  }

  private ringRadius(W: number, H: number): number {
    const maxR = H * 0.14;
    const spacingR = this.ringSpacing(W) * 0.42;
    return Math.min(maxR, spacingR);
  }

  /* ── Canvas click handling ───────────────────────────────────── */

  private handleCanvasClick(e: MouseEvent): void {
    if (this.solved) return;
    const cvs = e.currentTarget as HTMLCanvasElement;
    const rect = cvs.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (CANVAS_W() / rect.width);
    const my = (e.clientY - rect.top) * (CANVAS_H() / rect.height);

    const W = CANVAS_W();
    const H = CANVAS_H();
    const barY = H * 0.42;
    const spacing = this.ringSpacing(W);
    const startX = this.ringStartX(W);
    const radius = this.ringRadius(W, H);
    const offBarY = barY + H * 0.28;

    for (let i = 0; i < this.rings.length; i++) {
      const rx = startX + i * spacing;
      const ry = this.rings[i] ? barY : offBarY;
      const hitR = radius * 1.4;
      const dx = mx - rx;
      const dy = my - ry;
      if (dx * dx + dy * dy <= hitR * hitR) {
        this.tapRing(i);
        return;
      }
    }
  }

  /* ═══════════════════ Game logic (matches iOS) ═════════════════ */

  private canToggle(index: number): boolean {
    if (index < 0 || index >= this.rings.length) return false;
    if (index === 0) return true;
    if (!this.rings[index - 1]) return false;
    for (let i = 0; i < index - 1; i++) {
      if (this.rings[i]) return false;
    }
    return true;
  }

  private tapRing(index: number): void {
    if (this.solved) return;
    if (this.canToggle(index)) {
      this.toggleRing(index);
    } else {
      this.triggerInvalid(index);
    }
  }

  private toggleRing(index: number): void {
    this.history.push([...this.rings]);
    this.rings[index] = !this.rings[index];
    this.moveCount++;
    this.lastToggled = index;

    this.drawBoard();
    this.refreshUI();

    // Check win
    if (this.rings.every(r => !r)) {
      this.solved = true;
      this.isSolved = true;
      this.showStatus(`ALL RINGS FREED IN ${this.moveCount} MOVES`, C_JADE);
      setTimeout(() => this.onSolved?.(), 800);
    }
  }

  private triggerInvalid(index: number): void {
    this.invalidRing = index;
    this.shakeTimer = 0.4;
    this.showStatus('Invalid move — check the chain rules', hexAlpha(C_DANGER, 0.9));
    setTimeout(() => {
      this.invalidRing = -1;
      this.shakeTimer = 0;
      if (!this.solved) this.drawBoard();
      this.refreshUI();
    }, 400);
  }

  private undo(): void {
    if (this.history.length === 0 || this.solved) return;
    const prev = this.history.pop()!;
    this.rings = prev;
    this.moveCount = Math.max(0, this.moveCount - 1);
    this.lastToggled = -1;
    this.drawBoard();
    this.refreshUI();
  }

  private resetPuzzle(): void {
    if (this.solved) return;
    this.rings = Array(NUM_RINGS).fill(true);
    this.moveCount = 0;
    this.history = [];
    this.lastToggled = -1;
    this.drawBoard();
    this.refreshUI();
  }

  /* ── Hint (auto-play optimal move, matches iOS Gray code solver) */

  private handleHint(): void {
    if (this.solved) return;
    if (this.hintsUsed >= 3) {
      this.showHintWarning();
    } else {
      this.executeHint();
    }
  }

  private executeHint(): void {
    if (this.solved) return;
    const next = this.findNextOptimalToggle();
    if (next == null) return;
    this.hintsUsed++;
    this.toggleRing(next);
  }

  /**
   * Gray code solver (matches iOS findNextOptimalToggle).
   * Encode ring state as Gray code, subtract 1 in binary, convert back,
   * XOR to find the single bit that changed.
   */
  private findNextOptimalToggle(): number | null {
    const n = this.rings.length;
    if (n === 0) return null;

    // Encode current state as Gray code int (ring 0 = LSB)
    let gray = 0;
    for (let i = 0; i < n; i++) {
      if (this.rings[i]) gray |= (1 << i);
    }
    if (gray === 0) return null;

    // Gray -> binary
    let binary = gray;
    let shift = 1;
    while (shift < n) {
      binary ^= (binary >> shift);
      shift <<= 1;
    }

    // Step backward
    const prevBinary = binary - 1;

    // Binary -> Gray
    const prevGray = prevBinary ^ (prevBinary >> 1);

    // Differing bit = ring to toggle
    const diff = gray ^ prevGray;
    // Count trailing zeros
    if (diff === 0) return null;
    let tz = 0;
    let d = diff;
    while ((d & 1) === 0) { tz++; d >>= 1; }
    return tz;
  }

  /* ── Hint warning overlay (matches iOS) ──────────────────────── */

  private showHintWarning(): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '300px', width: '90%', padding: '20px', textAlign: 'center',
      background: `linear-gradient(to bottom, ${C_BG_TOP}, ${C_BG_BOTTOM})`,
      border: `1.5px solid ${hexAlpha(C_RING_GOLD, 0.4)}`,
      borderRadius: '16px', boxShadow: `0 0 20px ${hexAlpha(C_RING_GOLD, 0.15)}`,
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      animation: 'rings-pop 0.25s ease-out',
    });

    const warn = document.createElement('div');
    warn.textContent = '\u26A0\uFE0F';
    Object.assign(warn.style, { fontSize: '32px', marginBottom: '8px' });
    card.appendChild(warn);

    const title = document.createElement('div');
    title.textContent = 'Hint Penalty';
    Object.assign(title.style, { color: C_DANGER, fontSize: '16px', fontWeight: '700', marginBottom: '8px' });
    card.appendChild(title);

    const msg = document.createElement('div');
    msg.textContent = 'Using more hints may affect your score. Continue?';
    Object.assign(msg.style, { color: hexAlpha(C_CREAM, 0.8), fontSize: '13px', marginBottom: '16px', lineHeight: '1.5' });
    card.appendChild(msg);

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '12px' });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      flex: '1', padding: '10px', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit',
      color: hexAlpha(C_CREAM, 0.6), background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer',
    });
    cancelBtn.addEventListener('click', () => { this.overlayEl!.style.display = 'none'; });

    const contBtn = document.createElement('button');
    contBtn.type = 'button';
    contBtn.textContent = 'Continue';
    Object.assign(contBtn.style, {
      flex: '1', padding: '10px', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
      color: C_RING_GOLD, background: 'rgba(212,175,55,0.08)',
      border: '1px solid rgba(212,175,55,0.3)', borderRadius: '8px', cursor: 'pointer',
    });
    contBtn.addEventListener('click', () => {
      this.overlayEl!.style.display = 'none';
      this.executeHint();
    });

    btnRow.append(cancelBtn, contBtn);
    card.appendChild(btnRow);
    this.overlayEl.appendChild(card);
  }

  /* ═══════════════════ UI refresh ════════════════════════════════ */

  private refreshUI(): void {
    if (this.movesEl) {
      this.movesEl.textContent = `Moves: ${this.moveCount}`;
    }
    if (this.minEl) {
      this.minEl.textContent = `Min: ${MIN_MOVES}`;
    }

    // Legal moves hint
    if (this.hintLineEl) {
      if (this.solved) {
        this.hintLineEl.textContent = 'Puzzle complete!';
        this.hintLineEl.style.color = C_JADE;
      } else {
        const toggleable = [];
        for (let i = 0; i < this.rings.length; i++) {
          if (this.canToggle(i)) toggleable.push(i + 1);
        }
        this.hintLineEl.textContent = `Toggleable: ${toggleable.join(', ')}`;
        this.hintLineEl.style.color = '';
      }
    }

    // Binary view (MSB on left, matches iOS reversed display)
    if (this.binaryEl) {
      const bits = [...this.rings].reverse().map(r => {
        const val = r ? '1' : '0';
        const color = r ? C_RING_GOLD : hexAlpha(C_GHOST, 0.6);
        return `<span style="color:${color}">${val}</span>`;
      }).join(' ');
      this.binaryEl.innerHTML = bits;
    }

    if (this.remainEl) {
      const on = this.rings.filter(r => r).length;
      this.remainEl.textContent = `${on}/${NUM_RINGS} on bar`;
    }

    if (!this.solved && this.statusEl) {
      const remaining = this.rings.filter(r => r).length;
      this.statusEl.textContent = `${remaining} ring${remaining === 1 ? '' : 's'} still on the bar`;
      this.statusEl.style.color = hexAlpha(C_CREAM, 0.8);
    }
  }

  private showStatus(msg: string, color: string): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.style.color = color;
  }

  /* ═══════════════════ Helpers ═══════════════════════════════════ */

  private roundRect(c: CanvasRenderingContext2D, x: number, y: number,
                    w: number, h: number, r: number): void {
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

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);

    // Animate pulse phase
    this.pulsePhase += dt * 0.5;
    if (this.pulsePhase > 1) this.pulsePhase -= 1;

    // Animate shake
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      this.drawBoard();
    }
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('rings-anims');
    if (animStyle) animStyle.remove();
    this.ctx2d = null;
    this.overlayEl = null;
    this.movesEl = null;
    this.minEl = null;
    this.hintLineEl = null;
    this.binaryEl = null;
    this.remainEl = null;
    this.statusEl = null;
    this.rings = [];
    this.history = [];
    super.dispose();
  }
}

/* ── Utility ─────────────────────────────────────────────────── */

function hexAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return hex + a;
}
