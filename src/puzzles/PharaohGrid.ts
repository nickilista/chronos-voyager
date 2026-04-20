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
 * Pharaoh Grid — Pyramid Block Puzzle
 *
 * Aligned with the iOS PyramidBlockPuzzleView:
 *   - A numeric pyramid where each cell above equals the sum of the two cells below it
 *   - Player places all blocks from a shuffled pool into the pyramid slots
 *   - Tap a block from the pool to select, then tap a slot to place
 *   - Tap a placed block to return it to the pool
 *   - Check validates the addition rule for every row
 *   - Reset re-shuffles and clears all placements
 *   - Egyptian gold theme with era-appropriate styling
 */

/* ── Config ──────────────────────────────────────────────────────── */

const DEFAULT_BASE = [3, 7, 2, 5, 4, 6];
const C_ACCENT = '#C9A84C';
const C_CREAM = '#F5E6CC';
const C_SUCCESS = '#00B894';
const C_ERROR = '#FF6B6B';

/* ── Helpers ─────────────────────────────────────────────────────── */

function buildFullPyramid(baseRow: number[]): number[][] {
  // Build bottom-up, then reverse so index 0 = top (1 element)
  const rows: number[][] = [baseRow];
  let current = baseRow;
  while (current.length > 1) {
    const next: number[] = [];
    for (let i = 0; i < current.length - 1; i++) {
      next.push(current[i] + current[i + 1]);
    }
    rows.push(next);
    current = next;
  }
  rows.reverse(); // top-first for display
  return rows;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ── Puzzle class ────────────────────────────────────────────────── */

export class PharaohGridPuzzle extends Puzzle {
  readonly title = 'PHARAOH GRID';
  readonly subtitle = 'the pyramid of sums';
  readonly instructions =
    'Each block above must equal the sum of the two blocks below it. Select a number from the pool, then tap a slot to place it. Tap a placed block to remove it.';

  private baseRow: number[] = DEFAULT_BASE;
  private fullPyramid: number[][] = [];
  // pyramidSlots[row][col] — null means empty
  private pyramidSlots: (number | null)[][] = [];
  private availableBlocks: number[] = [];
  private selectedBlockIndex: number | null = null;

  // DOM elements
  private root: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private pyramidEl: HTMLDivElement | null = null;
  private poolEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.setupPyramid();
    this.buildDom();
    this.renderPyramid();
    this.renderPool();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color('#1a1005'), roughness: 0.7, metalness: 0.15, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.2, 3), // triangle ring for pyramid motif
      new MeshStandardMaterial({
        color: new Color(C_ACCENT), emissive: new Color('#3d2a08'),
        emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.85, side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const lamp = new PointLight('#fac675', 2.4, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ═══════════════════ Pyramid data setup ═══════════════════════ */

  private setupPyramid(): void {
    this.fullPyramid = buildFullPyramid(this.baseRow);
    // All slots empty
    this.pyramidSlots = this.fullPyramid.map(row => row.map(() => null));
    // All values from the full pyramid, shuffled
    const allValues: number[] = [];
    for (const row of this.fullPyramid) {
      for (const v of row) allValues.push(v);
    }
    this.availableBlocks = shuffleArray(allValues);
    this.selectedBlockIndex = null;
  }

  /* ═══════════════════ DOM construction ═════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-pharaoh-grid';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
      pointerEvents: 'auto', padding: 'clamp(12px,2vw,20px) clamp(14px,3vw,24px)',
      background: 'rgba(26,15,5,0.93)', backdropFilter: 'blur(12px)',
      border: `1px solid rgba(201,168,76,0.25)`, borderTop: `3px solid ${C_ACCENT}`,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.7)', color: C_CREAM,
      maxHeight: '96vh', overflowY: 'auto',
    });
    root.appendChild(panel);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '16px', letterSpacing: '0.22em', color: C_ACCENT, fontWeight: '700' });
    title.textContent = 'PHARAOH GRID · PYRAMID OF SUMS';
    panel.appendChild(title);

    // Pyramid display area
    this.pyramidEl = document.createElement('div');
    Object.assign(this.pyramidEl.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
      padding: '8px',
    });
    panel.appendChild(this.pyramidEl);

    // Separator
    const sep = document.createElement('div');
    Object.assign(sep.style, { width: '80%', height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' });
    panel.appendChild(sep);

    // Rule text
    const rule = document.createElement('div');
    Object.assign(rule.style, { fontSize: '12px', fontWeight: '500', color: 'rgba(255,255,255,0.45)', textAlign: 'center' });
    rule.textContent = 'Each block = sum of the two blocks below it.';
    panel.appendChild(rule);

    // Tap hint
    const hint = document.createElement('div');
    Object.assign(hint.style, { fontSize: '11px', color: 'rgba(255,255,255,0.30)', textAlign: 'center' });
    hint.textContent = 'Tap a number below, then tap a slot to place it. Tap placed blocks to remove.';
    panel.appendChild(hint);

    // Pool area
    this.poolEl = document.createElement('div');
    Object.assign(this.poolEl.style, {
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px',
      padding: '4px 16px', maxWidth: 'min(360px, calc(100vw - 48px))',
    });
    panel.appendChild(this.poolEl);

    // Status message
    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, {
      fontSize: '14px', fontWeight: '600', textAlign: 'center', minHeight: '20px',
    });
    panel.appendChild(this.statusEl);

    // Buttons row
    const btnsRow = document.createElement('div');
    Object.assign(btnsRow.style, { display: 'flex', gap: '16px', marginTop: '4px' });

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = 'RESET';
    Object.assign(resetBtn.style, {
      padding: '10px 20px', fontSize: '14px', fontWeight: '500', fontFamily: 'inherit',
      color: `${C_ACCENT}88`, background: 'rgba(201,168,76,0.05)',
      border: `1px solid rgba(201,168,76,0.15)`, borderRadius: '6px', cursor: 'pointer',
      letterSpacing: '0.1em',
    });
    resetBtn.addEventListener('click', () => this.resetPyramid());
    btnsRow.appendChild(resetBtn);

    // Check button
    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.textContent = 'CHECK';
    Object.assign(checkBtn.style, {
      padding: '10px 24px', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
      color: C_ACCENT, background: 'rgba(201,168,76,0.12)',
      border: `1px solid rgba(201,168,76,0.3)`, borderRadius: '6px', cursor: 'pointer',
      letterSpacing: '0.1em',
    });
    checkBtn.addEventListener('click', () => this.checkPyramid());
    btnsRow.appendChild(checkBtn);

    panel.appendChild(btnsRow);

    // Overlay (for future dialogs if needed)
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    document.body.appendChild(root);
  }

  /* ═══════════════════ Render pyramid slots ═════════════════════ */

  private renderPyramid(): void {
    if (!this.pyramidEl) return;
    this.pyramidEl.innerHTML = '';

    const layers = this.pyramidSlots.length;
    const cellW = layers > 6 ? 36 : layers > 4 ? 48 : 56;
    const cellH = cellW * 0.75;
    const fontSize = cellW * 0.30;
    const spacing = layers > 6 ? 2 : 4;

    for (let row = 0; row < layers; row++) {
      const rowEl = document.createElement('div');
      Object.assign(rowEl.style, { display: 'flex', gap: spacing + 'px', justifyContent: 'center' });

      for (let col = 0; col < this.pyramidSlots[row].length; col++) {
        const value = this.pyramidSlots[row][col];
        const isHighlighted = this.selectedBlockIndex !== null && value === null;

        const slot = document.createElement('div');
        Object.assign(slot.style, {
          width: cellW + 'px', height: cellH + 'px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '5px', cursor: 'pointer', position: 'relative',
          background: value !== null
            ? `rgba(201,168,76,0.20)`
            : isHighlighted
              ? `rgba(201,168,76,0.08)`
              : `rgba(255,255,255,0.04)`,
          border: value !== null
            ? `1px solid rgba(201,168,76,0.4)`
            : isHighlighted
              ? `2px solid rgba(201,168,76,0.3)`
              : `1px solid rgba(255,255,255,0.08)`,
          transition: 'background 0.15s, border-color 0.15s',
        });

        const text = document.createElement('span');
        if (value !== null) {
          text.textContent = String(value);
          Object.assign(text.style, {
            fontSize: fontSize + 'px', fontWeight: '700', color: C_ACCENT,
          });
        } else {
          text.textContent = '?';
          Object.assign(text.style, {
            fontSize: (fontSize * 0.85) + 'px', fontWeight: '300', color: 'rgba(255,255,255,0.15)',
          });
        }
        slot.appendChild(text);

        // Capture row/col for handler
        const r = row, c = col;
        slot.addEventListener('click', () => this.handleSlotTap(r, c));
        rowEl.appendChild(slot);
      }

      this.pyramidEl.appendChild(rowEl);
    }
  }

  /* ═══════════════════ Render available blocks pool ═════════════ */

  private renderPool(): void {
    if (!this.poolEl) return;
    this.poolEl.innerHTML = '';

    const layers = this.fullPyramid.length;
    const blockSize = layers > 6 ? 36 : 50;

    for (let i = 0; i < this.availableBlocks.length; i++) {
      const value = this.availableBlocks[i];
      const isSelected = this.selectedBlockIndex === i;

      const block = document.createElement('div');
      Object.assign(block.style, {
        width: blockSize + 'px', height: blockSize + 'px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '6px', cursor: 'pointer',
        background: isSelected ? 'rgba(201,168,76,0.30)' : 'rgba(201,168,76,0.12)',
        border: isSelected ? `2.5px solid ${C_ACCENT}` : `1px solid rgba(201,168,76,0.3)`,
        transform: isSelected ? 'scale(1.08)' : 'scale(1)',
        transition: 'transform 0.15s, background 0.15s, border-color 0.15s',
      });

      const text = document.createElement('span');
      text.textContent = String(value);
      Object.assign(text.style, {
        fontSize: (blockSize * 0.36) + 'px', fontWeight: '700',
        color: isSelected ? '#fff' : C_ACCENT,
      });
      block.appendChild(text);

      const idx = i;
      block.addEventListener('click', () => {
        this.selectedBlockIndex = this.selectedBlockIndex === idx ? null : idx;
        this.renderPyramid();
        this.renderPool();
      });

      this.poolEl.appendChild(block);
    }
  }

  /* ═══════════════════ Interaction handlers ═════════════════════ */

  private handleSlotTap(row: number, col: number): void {
    if (this.selectedBlockIndex !== null && this.selectedBlockIndex < this.availableBlocks.length) {
      // Place block if slot is empty
      if (this.pyramidSlots[row][col] === null) {
        this.pyramidSlots[row][col] = this.availableBlocks[this.selectedBlockIndex];
        this.availableBlocks.splice(this.selectedBlockIndex, 1);
        this.selectedBlockIndex = null;

        this.clearStatus();
        this.renderPyramid();
        this.renderPool();
      }
    } else {
      // Remove block from slot, return to pool
      const value = this.pyramidSlots[row][col];
      if (value !== null) {
        this.pyramidSlots[row][col] = null;
        this.availableBlocks.push(value);
        this.availableBlocks.sort((a, b) => a - b);

        this.clearStatus();
        this.renderPyramid();
        this.renderPool();
      }
    }
  }

  private resetPyramid(): void {
    this.setupPyramid();
    this.clearStatus();
    this.renderPyramid();
    this.renderPool();
  }

  private checkPyramid(): void {
    // Check all slots filled
    const allFilled = this.pyramidSlots.every(row => row.every(v => v !== null));
    if (!allFilled) {
      this.showStatus('Fill all slots before checking.', C_ERROR);
      return;
    }

    // Validate: each cell above = sum of two cells below
    let valid = true;
    for (let row = 0; row < this.pyramidSlots.length - 1; row++) {
      for (let col = 0; col < this.pyramidSlots[row].length; col++) {
        const above = this.pyramidSlots[row][col]!;
        const belowLeft = this.pyramidSlots[row + 1][col]!;
        const belowRight = this.pyramidSlots[row + 1][col + 1]!;
        if (above !== belowLeft + belowRight) {
          valid = false;
        }
      }
    }

    if (valid) {
      this.showStatus('The pyramid is complete!', C_SUCCESS);
      if (!this.isSolved) {
        this.isSolved = true;
        setTimeout(() => this.onSolved?.(), 900);
      }
    } else {
      this.showStatus('Not quite — check the sums.', C_ERROR);
    }
  }

  /* ═══════════════════ Status helpers ═══════════════════════════ */

  private showStatus(msg: string, color: string): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.style.color = color;
  }

  private clearStatus(): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = '';
  }

  /* ═══════════════════ Lifecycle ════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    if (this.root) { this.root.remove(); this.root = null; }
    this.pyramidEl = null;
    this.poolEl = null;
    this.statusEl = null;
    this.overlayEl = null;
    super.dispose();
  }
}
