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
 * Moksha Patam (मोक्ष पटम्) — the Vedic ancestor of Snakes & Ladders,
 * reimagined as a deterministic strategy puzzle with math questions.
 *
 * Aligned with the iOS "Math Vs Time" implementation:
 *   - Canvas-drawn snakes (bezier curves) and ladders (rails + rungs)
 *   - Math questions (timed, 10s) required to climb question-ladders
 *   - Shield mechanic: collect shields, choose to use vs. snakes
 *   - Deterministic per-turn move options (not random dice)
 *   - Question cells that reward shields or advance moves
 *   - Indian temple color theme with rich visual board
 */

/* ── Board config ─────────────────────────────────────────────── */

const ROWS = 6;
const COLS = 6;
const GOAL = ROWS * COLS; // 36
const MAX_TURNS = 8;
const CELL_PX = 72;
const BOARD_W = COLS * CELL_PX;
const BOARD_H = ROWS * CELL_PX;
const QUESTION_TIME = 10; // seconds

/* ── Colors (Indian temple theme, matches iOS) ────────────────── */

const C_BOARD_BG = '#1A0F0A';
const C_CELL_BASE = '#2A1A12';
const C_CELL_ALT = '#3D2519';
const C_LADDER_GOLD = '#D4AF37';
const C_SNAKE_RED = '#C0392B';
const C_SNAKE_GREEN = '#27AE60';
const C_SHIELD_BLUE = '#3498DB';
const C_GOAL_GOLD = '#F5D76E';
const C_QUESTION_PURP = '#8E44AD';
const C_PLAYER = '#E67E22';
const C_CREAM = '#F5E6CC';
const C_SUCCESS = '#00B894';
const C_ERROR = '#FF4040';

/* ── Level data (matches iOS level 3: 6×6) ────────────────────── */

interface LadderDef { from: number; to: number; questionID: string | null }
interface SnakeDef { head: number; tail: number }
interface QuestionCellDef { cell: number; questionID: string; reward: 'shield' | number }

const TURN_OPTIONS: number[][] = [
  [2, 3], [1, 3], [1, 2], [2, 3], [1, 3],
  [1, 2], [2, 3], [1, 3], [1, 2], [2, 3], [1, 3],
];

const LADDERS: LadderDef[] = [
  { from: 7, to: 21, questionID: 'q4' },
  { from: 16, to: 28, questionID: 'q5' },
];

const SNAKES: SnakeDef[] = [
  { head: 23, tail: 12 },
  { head: 26, tail: 15 },
  { head: 31, tail: 20 },
  { head: 34, tail: 25 },
];

const SHIELD_CELLS = [10];

const QUESTION_CELLS: QuestionCellDef[] = [];

/* ── Math questions ───────────────────────────────────────────── */

interface MathQ { id: string; prompt: string; options: string[]; correctIndex: number }

const QUESTIONS: Record<string, MathQ> = {
  q4: { id: 'q4', prompt: 'What is 1 + 2 + 3 + … + 15?', options: ['105', '112', '120'], correctIndex: 2 },
  q5: { id: 'q5', prompt: 'How many prime numbers are there from 1 to 30?', options: ['8', '9', '10'], correctIndex: 2 },
};

/* ── Helpers ───────────────────────────────────────────────────── */

type CellType = 'goal' | 'ladder_start' | 'ladder_end' | 'snake_head' | 'snake_tail' | 'shield' | 'question' | 'normal';

function cellType(cell: number): CellType {
  if (cell === GOAL) return 'goal';
  if (LADDERS.some(l => l.from === cell)) return 'ladder_start';
  if (LADDERS.some(l => l.to === cell)) return 'ladder_end';
  if (SNAKES.some(s => s.head === cell)) return 'snake_head';
  if (SNAKES.some(s => s.tail === cell)) return 'snake_tail';
  if (SHIELD_CELLS.includes(cell)) return 'shield';
  if (QUESTION_CELLS.some(q => q.cell === cell)) return 'question';
  return 'normal';
}

/** Serpentine layout: row 0 = bottom, even rows L→R, odd rows R→L */
function cellToRowCol(cell: number): { row: number; col: number } {
  const idx = cell - 1;
  const rowFromBottom = Math.floor(idx / COLS);
  const row = ROWS - 1 - rowFromBottom;
  const col = rowFromBottom % 2 === 0
    ? idx % COLS
    : COLS - 1 - (idx % COLS);
  return { row, col };
}

function cellCenter(cell: number): { x: number; y: number } {
  const { row, col } = cellToRowCol(cell);
  return { x: col * CELL_PX + CELL_PX * 0.5, y: row * CELL_PX + CELL_PX * 0.5 };
}

/* ── Puzzle class ─────────────────────────────────────────────── */

export class MokshaPatamPuzzle extends Puzzle {
  readonly title = 'MOKSHA PATAM';
  readonly subtitle = 'the way to liberation';
  readonly instructions =
    'Navigate the dharma board from cell 1 to the temple. Answer math questions to climb ladders. Avoid serpents or use shields.';

  private playerCell = 1;
  private turnIndex = 0;
  private shields = 0;
  private phase: 'playing' | 'won' | 'lost' = 'playing';

  // Question state
  private showingQuestion = false;
  private pendingQuestion: MathQ | null = null;
  private questionPurpose: { type: 'ladder'; to: number } | { type: 'cell'; reward: 'shield' | number } | null = null;
  private questionCountdown = QUESTION_TIME;
  private questionTimerId = 0;

  // Shield choice state
  private showingShieldChoice = false;
  private pendingSnakeTo = 0;

  // Processing lock (prevents double-clicks during animations)
  private processing = false;

  // DOM
  private root: HTMLDivElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private pawnEl: HTMLDivElement | null = null;
  private hudEl: HTMLDivElement | null = null;
  private turnEl: HTMLSpanElement | null = null;
  private posEl: HTMLSpanElement | null = null;
  private shieldEl: HTMLSpanElement | null = null;
  private movesEl: HTMLDivElement | null = null;
  private statusEl: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private resetBtnEl: HTMLButtonElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.buildDom();
    this.drawBoard();
    this.placePawn(false);
    this.refreshUI();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color('#231208'), roughness: 0.65, metalness: 0.2, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const mandala = new Mesh(
      new RingGeometry(3.0, 3.18, 12),
      new MeshStandardMaterial({
        color: new Color('#e69a3a'), emissive: new Color('#402004'),
        emissiveIntensity: 0.55, roughness: 0.45, metalness: 0.85, side: DoubleSide,
      }),
    );
    mandala.rotation.x = -Math.PI / 2;
    mandala.position.y = -2.37;
    this.group.add(mandala);

    const lamp = new PointLight('#fac675', 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ═══════════════════ DOM construction ══════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-moksha';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: 'rgba(26,15,10,0.92)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(212,175,55,0.25)', borderTop: '3px solid ' + C_LADDER_GOLD,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_CREAM,
      maxHeight: '96vh', overflowY: 'auto',
    });
    root.appendChild(panel);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '16px', letterSpacing: '0.22em', color: C_LADDER_GOLD, fontWeight: '700' });
    title.textContent = 'MOKSHA PATAM · मोक्ष पटम्';
    panel.appendChild(title);

    // HUD row
    this.hudEl = document.createElement('div');
    Object.assign(this.hudEl.style, {
      display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', letterSpacing: '0.12em', opacity: '0.9',
    });
    this.turnEl = document.createElement('span');
    this.posEl = document.createElement('span');
    this.shieldEl = document.createElement('span');
    this.hudEl.append(this.turnEl, this.posEl, this.shieldEl);
    panel.appendChild(this.hudEl);

    // Board wrapper (canvas + pawn overlay)
    const boardWrap = document.createElement('div');
    Object.assign(boardWrap.style, {
      position: 'relative', width: BOARD_W + 'px', height: BOARD_H + 'px',
      borderRadius: '8px', overflow: 'hidden',
      border: '2px solid rgba(212,175,55,0.25)',
    });

    // Canvas for board + snakes + ladders
    const cvs = document.createElement('canvas');
    cvs.width = BOARD_W * 2; // 2x for retina
    cvs.height = BOARD_H * 2;
    Object.assign(cvs.style, { width: BOARD_W + 'px', height: BOARD_H + 'px', display: 'block' });
    this.ctx2d = cvs.getContext('2d')!;
    boardWrap.appendChild(cvs);

    // Pawn
    const pawn = document.createElement('div');
    Object.assign(pawn.style, {
      position: 'absolute', width: (CELL_PX * 0.48) + 'px', height: (CELL_PX * 0.48) + 'px',
      background: `radial-gradient(circle at 40% 35%, #fff2c8, ${C_PLAYER} 70%, #6a3c0f 100%)`,
      border: '2px solid #f7d58f', borderRadius: '50%',
      boxShadow: `0 0 14px rgba(230,126,34,0.65)`,
      transition: 'left 0.45s cubic-bezier(.34,1.56,.64,1), top 0.45s cubic-bezier(.34,1.56,.64,1)',
      pointerEvents: 'none', zIndex: '8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: (CELL_PX * 0.28) + 'px',
    });
    pawn.textContent = '🧘';
    boardWrap.appendChild(pawn);
    this.pawnEl = pawn;

    panel.appendChild(boardWrap);

    // Legend
    const legend = document.createElement('div');
    Object.assign(legend.style, {
      display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center',
      fontSize: '10px', letterSpacing: '0.06em', opacity: '0.7',
    });
    legend.innerHTML = [
      `<span style="color:${C_LADDER_GOLD}">🪜 Ladder</span>`,
      `<span style="color:${C_SNAKE_RED}">🐍 Snake</span>`,
      `<span style="color:${C_SHIELD_BLUE}">🛡 Shield</span>`,
      `<span style="color:${C_QUESTION_PURP}">❓ Question</span>`,
      `<span style="color:${C_GOAL_GOLD}">🏛 Goal</span>`,
    ].join('');
    panel.appendChild(legend);

    // Move buttons
    this.movesEl = document.createElement('div');
    Object.assign(this.movesEl.style, { display: 'flex', gap: '10px', marginTop: '4px' });
    panel.appendChild(this.movesEl);

    // Status message
    this.statusEl = document.createElement('div');
    Object.assign(this.statusEl.style, {
      fontSize: '13px', letterSpacing: '0.06em', textAlign: 'center', minHeight: '20px',
    });
    panel.appendChild(this.statusEl);

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = 'TRY AGAIN';
    Object.assign(resetBtn.style, {
      padding: '8px 18px', display: 'none',
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.25)',
      color: C_CREAM, fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.22em',
      fontWeight: '600', borderRadius: '5px', cursor: 'pointer',
    });
    resetBtn.addEventListener('click', () => this.resetGame());
    this.resetBtnEl = resetBtn;
    panel.appendChild(resetBtn);

    // Overlay container (for questions & shield choice)
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    document.body.appendChild(root);
  }

  /* ═══════════════════ Canvas board drawing ══════════════════════ */

  private drawBoard(): void {
    const c = this.ctx2d!;
    const s = 2; // retina scale
    c.clearRect(0, 0, BOARD_W * s, BOARD_H * s);
    c.save();
    c.scale(s, s);

    // Draw cells
    for (let cell = 1; cell <= GOAL; cell++) {
      const { row, col } = cellToRowCol(cell);
      const x = col * CELL_PX;
      const y = row * CELL_PX;
      const type = cellType(cell);
      const isAlt = (row + col) % 2 === 0;

      // Base fill
      let fill: string;
      switch (type) {
        case 'goal': fill = 'rgba(245,215,110,0.25)'; break;
        case 'ladder_start': fill = 'rgba(212,175,55,0.12)'; break;
        case 'ladder_end': fill = 'rgba(212,175,55,0.08)'; break;
        case 'snake_head': fill = 'rgba(192,57,43,0.14)'; break;
        case 'snake_tail': fill = 'rgba(192,57,43,0.06)'; break;
        case 'shield': fill = 'rgba(52,152,219,0.14)'; break;
        case 'question': fill = 'rgba(142,68,173,0.14)'; break;
        default: fill = isAlt ? C_CELL_ALT : C_CELL_BASE;
      }
      c.fillStyle = fill;
      c.fillRect(x, y, CELL_PX, CELL_PX);

      // Cell border
      c.strokeStyle = 'rgba(255,195,90,0.1)';
      c.lineWidth = 0.5;
      c.strokeRect(x, y, CELL_PX, CELL_PX);

      // Cell number
      c.fillStyle = 'rgba(245,230,204,0.3)';
      c.font = '600 11px Rajdhani, system-ui';
      c.textAlign = 'left';
      c.textBaseline = 'top';
      c.fillText(String(cell), x + 4, y + 3);

      // Cell type icon
      const icon = type === 'goal' ? '🏛'
        : type === 'ladder_start' ? '🪜'
        : type === 'snake_head' ? '🐍'
        : type === 'shield' ? '🛡'
        : type === 'question' ? '❓'
        : null;
      if (icon) {
        c.font = `${CELL_PX * 0.32}px serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(icon, x + CELL_PX / 2, y + CELL_PX / 2 + 2);
      }
    }

    // Draw ladders
    for (const ladder of LADDERS) {
      this.drawLadder(c, ladder.from, ladder.to, ladder.questionID != null);
    }

    // Draw snakes
    for (const snake of SNAKES) {
      this.drawSnake(c, snake.head, snake.tail);
    }

    c.restore();
  }

  private drawLadder(c: CanvasRenderingContext2D, from: number, to: number, hasQuestion: boolean): void {
    const p1 = cellCenter(from);
    const p2 = cellCenter(to);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;

    const offset = CELL_PX * 0.12;
    const nx = -dy / len * offset;
    const ny = dx / len * offset;
    const color = hasQuestion ? C_QUESTION_PURP : C_LADDER_GOLD;

    // Two rails
    c.strokeStyle = color + 'aa';
    c.lineWidth = 2.5;
    c.lineCap = 'round';

    c.beginPath();
    c.moveTo(p1.x + nx, p1.y + ny);
    c.lineTo(p2.x + nx, p2.y + ny);
    c.stroke();

    c.beginPath();
    c.moveTo(p1.x - nx, p1.y - ny);
    c.lineTo(p2.x - nx, p2.y - ny);
    c.stroke();

    // Rungs
    const rungCount = Math.max(3, Math.floor(len / (CELL_PX * 0.4)));
    c.strokeStyle = color + '77';
    c.lineWidth = 1.8;
    for (let i = 1; i < rungCount; i++) {
      const t = i / rungCount;
      const mx = p1.x + dx * t;
      const my = p1.y + dy * t;
      c.beginPath();
      c.moveTo(mx + nx, my + ny);
      c.lineTo(mx - nx, my - ny);
      c.stroke();
    }

    // Question mark on ladder
    if (hasQuestion) {
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      c.fillStyle = C_QUESTION_PURP;
      c.font = 'bold ' + (CELL_PX * 0.28) + 'px Rajdhani, system-ui';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('?', mid.x, mid.y);
    }
  }

  private drawSnake(c: CanvasRenderingContext2D, head: number, tail: number): void {
    const p1 = cellCenter(head);
    const p2 = cellCenter(tail);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x;
    const perpOffset = CELL_PX * 0.5 * (dx > 0 ? 1 : -1);

    // Snake body (bezier curve)
    c.beginPath();
    c.moveTo(p1.x, p1.y);
    c.bezierCurveTo(
      midX + perpOffset, midY - CELL_PX * 0.3,
      midX - perpOffset, midY + CELL_PX * 0.3,
      p2.x, p2.y,
    );
    c.strokeStyle = C_SNAKE_RED + 'bb';
    c.lineWidth = CELL_PX * 0.08;
    c.lineCap = 'round';
    c.stroke();

    // Snake pattern (inner dashed line)
    c.beginPath();
    c.moveTo(p1.x, p1.y);
    c.bezierCurveTo(
      midX + perpOffset, midY - CELL_PX * 0.3,
      midX - perpOffset, midY + CELL_PX * 0.3,
      p2.x, p2.y,
    );
    c.strokeStyle = C_SNAKE_GREEN + '77';
    c.lineWidth = CELL_PX * 0.03;
    c.setLineDash([CELL_PX * 0.1, CELL_PX * 0.06]);
    c.stroke();
    c.setLineDash([]);

    // Head dot
    c.beginPath();
    c.arc(p1.x, p1.y, CELL_PX * 0.07, 0, Math.PI * 2);
    c.fillStyle = C_SNAKE_RED;
    c.fill();

    // Tail dot (smaller)
    c.beginPath();
    c.arc(p2.x, p2.y, CELL_PX * 0.04, 0, Math.PI * 2);
    c.fillStyle = C_SNAKE_RED + '88';
    c.fill();
  }

  /* ═══════════════════ Pawn placement ════════════════════════════ */

  private placePawn(animate = true): void {
    if (!this.pawnEl) return;
    const { x, y } = cellCenter(this.playerCell);
    const size = CELL_PX * 0.48;
    const px = x - size / 2;
    const py = y - size / 2;
    if (!animate) this.pawnEl.style.transition = 'none';
    this.pawnEl.style.left = px + 'px';
    this.pawnEl.style.top = py + 'px';
    if (!animate) {
      void this.pawnEl.offsetWidth; // force reflow
      this.pawnEl.style.transition = 'left 0.45s cubic-bezier(.34,1.56,.64,1), top 0.45s cubic-bezier(.34,1.56,.64,1)';
    }
  }

  /* ═══════════════════ UI refresh ════════════════════════════════ */

  private refreshUI(): void {
    const turnsLeft = MAX_TURNS - this.turnIndex;

    if (this.turnEl) {
      this.turnEl.style.color = turnsLeft <= 2 ? C_ERROR : C_CREAM;
      this.turnEl.textContent = `TURN ${this.turnIndex + 1}/${MAX_TURNS}`;
    }
    if (this.posEl) {
      this.posEl.style.color = C_PLAYER;
      this.posEl.textContent = `CELL ${this.playerCell}/${GOAL}`;
    }
    if (this.shieldEl) {
      this.shieldEl.style.color = this.shields > 0 ? C_SHIELD_BLUE : C_CREAM + '44';
      this.shieldEl.textContent = `🛡 ×${this.shields}`;
    }

    // Move buttons
    if (this.movesEl) {
      this.movesEl.innerHTML = '';
      if (this.phase === 'playing' && !this.showingQuestion && !this.showingShieldChoice) {
        const options = this.turnIndex < TURN_OPTIONS.length ? TURN_OPTIONS[this.turnIndex] : [];
        for (const delta of options) {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = `+${delta}`;
          Object.assign(b.style, {
            width: '68px', padding: '10px 0',
            background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.35)',
            color: C_LADDER_GOLD, fontFamily: 'inherit', fontSize: '18px', fontWeight: '700',
            borderRadius: '6px', cursor: 'pointer', letterSpacing: '0.05em',
            transition: 'background 0.15s, border-color 0.15s',
          });
          b.addEventListener('mouseenter', () => { b.style.background = 'rgba(212,175,55,0.22)'; b.style.borderColor = 'rgba(212,175,55,0.6)'; });
          b.addEventListener('mouseleave', () => { b.style.background = 'rgba(212,175,55,0.1)'; b.style.borderColor = 'rgba(212,175,55,0.35)'; });
          b.addEventListener('click', () => this.executeMove(delta));
          this.movesEl.appendChild(b);
        }
      }
    }

    // Reset button visibility
    if (this.resetBtnEl) {
      this.resetBtnEl.style.display = this.phase === 'lost' ? 'inline-block' : 'none';
    }
  }

  private showStatus(msg: string, color: string): void {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.style.color = color;
  }

  /* ═══════════════════ Game logic ════════════════════════════════ */

  private executeMove(steps: number): void {
    if (this.phase !== 'playing' || this.processing) return;
    if (this.turnIndex >= TURN_OPTIONS.length) return;
    this.processing = true;

    const dest = Math.min(this.playerCell + steps, GOAL);
    this.turnIndex++;
    this.playerCell = dest;
    this.placePawn();
    this.showStatus(`Moving to cell ${dest}…`, C_CREAM + 'cc');
    this.refreshUI();

    setTimeout(() => this.resolveCellEffect(dest), 500);
  }

  private resolveCellEffect(cell: number): void {
    // Goal?
    if (cell >= GOAL) {
      this.phase = 'won';
      this.showStatus('🏛 YOU HAVE REACHED MOKSHA', C_SUCCESS);
      this.refreshUI();
      setTimeout(() => { this.isSolved = true; this.onSolved?.(); }, 1000);
      return;
    }

    // Ladder?
    const ladder = LADDERS.find(l => l.from === cell);
    if (ladder) {
      if (ladder.questionID && QUESTIONS[ladder.questionID]) {
        // Ladder with math question
        this.pendingQuestion = QUESTIONS[ladder.questionID];
        this.questionPurpose = { type: 'ladder', to: ladder.to };
        this.showStatus('🪜 A ladder! Answer to climb.', C_LADDER_GOLD);
        this.showQuestionOverlay();
      } else {
        // Auto-climb
        this.climbLadder(ladder.to);
      }
      this.processing = false;
      return;
    }

    // Snake?
    const snake = SNAKES.find(s => s.head === cell);
    if (snake) {
      if (this.shields > 0) {
        this.pendingSnakeTo = snake.tail;
        this.showStatus('🐍 A serpent! Use your shield?', C_SNAKE_RED);
        this.showShieldChoiceOverlay();
      } else {
        this.slideDownSnake(snake.tail);
      }
      this.processing = false;
      return;
    }

    // Shield cell?
    if (SHIELD_CELLS.includes(cell)) {
      this.shields++;
      this.showStatus('🛡 Shield collected!', C_SHIELD_BLUE);
      this.checkLose();
      this.refreshUI();
      this.processing = false;
      return;
    }

    // Question cell?
    const qCell = QUESTION_CELLS.find(q => q.cell === cell);
    if (qCell && QUESTIONS[qCell.questionID]) {
      this.pendingQuestion = QUESTIONS[qCell.questionID];
      this.questionPurpose = { type: 'cell', reward: qCell.reward };
      this.showStatus('❓ A challenge appears!', C_QUESTION_PURP);
      this.showQuestionOverlay();
      this.processing = false;
      return;
    }

    // Normal cell
    this.showStatus('Choose your next step.', C_CREAM + 'aa');
    this.checkLose();
    this.refreshUI();
    this.processing = false;
  }

  private climbLadder(to: number): void {
    this.showStatus(`🪜 Climbing to cell ${to}!`, C_SUCCESS);
    setTimeout(() => {
      this.playerCell = to;
      this.placePawn();
      setTimeout(() => {
        if (this.playerCell >= GOAL) {
          this.resolveCellEffect(this.playerCell);
        } else {
          this.showStatus('Choose your next step.', C_CREAM + 'aa');
          this.checkLose();
          this.refreshUI();
        }
      }, 500);
    }, 300);
  }

  private slideDownSnake(to: number): void {
    this.showStatus(`🐍 Bitten! Down to cell ${to}.`, C_SNAKE_RED);
    setTimeout(() => {
      this.playerCell = to;
      this.placePawn();
      setTimeout(() => {
        this.showStatus('Choose your next step.', C_CREAM + 'aa');
        this.checkLose();
        this.refreshUI();
      }, 500);
    }, 300);
  }

  private checkLose(): void {
    if (this.turnIndex >= MAX_TURNS && this.playerCell < GOAL) {
      this.phase = 'lost';
      this.showStatus('Turns exhausted. The path remains unfinished.', C_ERROR);
      this.refreshUI();
    }
  }

  private resetGame(): void {
    this.playerCell = 1;
    this.turnIndex = 0;
    this.shields = 0;
    this.phase = 'playing';
    this.processing = false;
    this.placePawn();
    this.showStatus('Choose your first step.', C_CREAM + 'aa');
    this.refreshUI();
  }

  /* ═══════════════════ Question overlay ══════════════════════════ */

  private showQuestionOverlay(): void {
    if (!this.overlayEl || !this.pendingQuestion) return;
    this.showingQuestion = true;
    this.questionCountdown = QUESTION_TIME;
    this.refreshUI();

    const q = this.pendingQuestion;
    const purposeLabel = this.questionPurpose?.type === 'ladder' ? 'Answer to climb the ladder' : 'Answer the challenge';

    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '320px', width: '90%', padding: '0',
      background: `linear-gradient(to bottom, ${C_BOARD_BG}, ${C_CELL_ALT}f0)`,
      border: `1.5px solid ${C_LADDER_GOLD}55`,
      borderRadius: '16px', boxShadow: `0 0 30px ${C_LADDER_GOLD}22`,
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      animation: 'moksha-pop 0.25s ease-out',
    });

    // Inject animation keyframe
    if (!document.getElementById('moksha-anims')) {
      const style = document.createElement('style');
      style.id = 'moksha-anims';
      style.textContent = `
        @keyframes moksha-pop { from { transform: scale(0.92); opacity:0; } to { transform: scale(1); opacity:1; } }
      `;
      document.head.appendChild(style);
    }

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, { padding: '18px 20px 10px', textAlign: 'center' });

    // Decorative line
    const deco = document.createElement('div');
    Object.assign(deco.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px',
    });
    deco.innerHTML = `<div style="width:30px;height:1px;background:${C_LADDER_GOLD}66"></div><span style="color:${C_LADDER_GOLD}99;font-size:10px">✦</span><div style="width:30px;height:1px;background:${C_LADDER_GOLD}66"></div>`;
    header.appendChild(deco);

    // Title + timer
    const titleRow = document.createElement('div');
    Object.assign(titleRow.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center' });

    const titleText = document.createElement('div');
    Object.assign(titleText.style, { color: C_LADDER_GOLD, fontSize: '15px', fontWeight: '700', letterSpacing: '0.06em' });
    titleText.textContent = purposeLabel;

    const timerEl = document.createElement('div');
    timerEl.id = 'moksha-timer';
    Object.assign(timerEl.style, { color: C_LADDER_GOLD, fontSize: '16px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' });
    timerEl.textContent = `${QUESTION_TIME}s`;

    titleRow.append(titleText, timerEl);
    header.appendChild(titleRow);

    // Second deco
    header.appendChild(deco.cloneNode(true));
    card.appendChild(header);

    // Question prompt
    const promptEl = document.createElement('div');
    Object.assign(promptEl.style, {
      padding: '0 20px 16px', textAlign: 'center', color: C_CREAM,
      fontSize: '15px', fontWeight: '500', lineHeight: '1.5',
    });
    promptEl.textContent = q.prompt;
    card.appendChild(promptEl);

    // Answer buttons
    const answersWrap = document.createElement('div');
    Object.assign(answersWrap.style, { display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 20px 20px' });

    for (let i = 0; i < q.options.length; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = q.options[i];
      Object.assign(btn.style, {
        padding: '12px', fontSize: '15px', fontWeight: '600', fontFamily: 'inherit',
        color: C_LADDER_GOLD, background: 'rgba(212,175,55,0.08)',
        border: '1px solid rgba(212,175,55,0.3)', borderRadius: '10px',
        cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
      });
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(212,175,55,0.18)'; btn.style.borderColor = 'rgba(212,175,55,0.5)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(212,175,55,0.08)'; btn.style.borderColor = 'rgba(212,175,55,0.3)'; });
      btn.addEventListener('click', () => this.answerQuestion(i));
      answersWrap.appendChild(btn);
    }
    card.appendChild(answersWrap);
    this.overlayEl.appendChild(card);

    // Start countdown
    this.questionTimerId = window.setInterval(() => {
      this.questionCountdown--;
      const te = document.getElementById('moksha-timer');
      if (te) {
        te.textContent = `${this.questionCountdown}s`;
        te.style.color = this.questionCountdown <= 3 ? C_ERROR : C_LADDER_GOLD;
      }
      if (this.questionCountdown <= 0) {
        this.answerQuestion(-1); // time's up
      }
    }, 1000);
  }

  private answerQuestion(chosenIndex: number): void {
    clearInterval(this.questionTimerId);
    if (!this.overlayEl || !this.pendingQuestion) return;

    const correct = chosenIndex >= 0 && chosenIndex === this.pendingQuestion.correctIndex;
    this.overlayEl.style.display = 'none';
    this.showingQuestion = false;

    if (correct) {
      if (this.questionPurpose?.type === 'ladder') {
        this.climbLadder(this.questionPurpose.to);
      } else if (this.questionPurpose?.type === 'cell') {
        const reward = this.questionPurpose.reward;
        if (reward === 'shield') {
          this.shields++;
          this.showStatus('✓ Correct! Shield gained.', C_SUCCESS);
          this.checkLose();
          this.refreshUI();
        } else {
          const dest = Math.min(this.playerCell + reward, GOAL);
          this.playerCell = dest;
          this.placePawn();
          this.showStatus(`✓ Correct! Advance ${reward} cells.`, C_SUCCESS);
          setTimeout(() => this.resolveCellEffect(dest), 500);
        }
      }
    } else {
      this.showStatus('✗ Wrong answer. The ladder crumbles.', C_ERROR);
      this.checkLose();
      this.refreshUI();
    }

    this.pendingQuestion = null;
    this.questionPurpose = null;
  }

  /* ═══════════════════ Shield choice overlay ═════════════════════ */

  private showShieldChoiceOverlay(): void {
    if (!this.overlayEl) return;
    this.showingShieldChoice = true;
    this.refreshUI();

    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '300px', width: '90%', textAlign: 'center',
      background: `linear-gradient(to bottom, ${C_BOARD_BG}, ${C_CELL_ALT}f0)`,
      border: `1.5px solid ${C_SNAKE_RED}55`,
      borderRadius: '16px', boxShadow: `0 0 30px ${C_SNAKE_RED}22`,
      fontFamily: "'Rajdhani', system-ui, sans-serif", padding: '20px',
      animation: 'moksha-pop 0.25s ease-out',
    });

    // Cobra SVG drawing
    const cobraCanvas = document.createElement('canvas');
    cobraCanvas.width = 112;
    cobraCanvas.height = 112;
    Object.assign(cobraCanvas.style, { width: '56px', height: '56px', margin: '0 auto 10px' });
    const cc = cobraCanvas.getContext('2d')!;
    cc.scale(2, 2);
    // Hood
    cc.beginPath();
    cc.moveTo(10, 42);
    cc.bezierCurveTo(2, 8, 54, 8, 46, 42);
    cc.bezierCurveTo(38, 34, 18, 34, 10, 42);
    cc.closePath();
    cc.fillStyle = C_SNAKE_RED + 'cc';
    cc.fill();
    cc.strokeStyle = C_SNAKE_RED;
    cc.lineWidth = 1.5;
    cc.stroke();
    // Eyes
    cc.fillStyle = C_GOAL_GOLD;
    cc.beginPath(); cc.arc(20, 22, 2, 0, Math.PI * 2); cc.fill();
    cc.beginPath(); cc.arc(36, 22, 2, 0, Math.PI * 2); cc.fill();
    // Tongue
    cc.strokeStyle = C_SNAKE_RED;
    cc.lineWidth = 1;
    cc.beginPath();
    cc.moveTo(28, 30);
    cc.lineTo(25, 38);
    cc.moveTo(28, 30);
    cc.lineTo(31, 38);
    cc.stroke();
    card.appendChild(cobraCanvas);

    // Deco
    const deco = document.createElement('div');
    Object.assign(deco.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: '6px 0' });
    deco.innerHTML = `<div style="width:30px;height:1px;background:${C_SNAKE_RED}66"></div><span style="color:${C_SNAKE_RED}99;font-size:10px">✦</span><div style="width:30px;height:1px;background:${C_SNAKE_RED}66"></div>`;
    card.appendChild(deco);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { color: C_SNAKE_RED, fontSize: '16px', fontWeight: '700', margin: '6px 0' });
    title.textContent = '🐍 Serpent Encountered!';
    card.appendChild(title);

    // Message
    const msg = document.createElement('div');
    Object.assign(msg.style, { color: C_CREAM, fontSize: '13px', margin: '0 0 16px', lineHeight: '1.5' });
    msg.textContent = `You have a shield. Use it to block the serpent, or descend to cell ${this.pendingSnakeTo}.`;
    card.appendChild(msg);

    // Use shield button
    const useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.innerHTML = `🛡 Use Shield`;
    Object.assign(useBtn.style, {
      width: '100%', padding: '12px', fontSize: '15px', fontWeight: '700', fontFamily: 'inherit',
      color: C_SHIELD_BLUE, background: 'rgba(52,152,219,0.12)',
      border: '1px solid rgba(52,152,219,0.35)', borderRadius: '10px',
      cursor: 'pointer', marginBottom: '8px',
    });
    useBtn.addEventListener('click', () => {
      this.overlayEl!.style.display = 'none';
      this.showingShieldChoice = false;
      this.shields--;
      this.showStatus('🛡 Shield used! Serpent blocked.', C_SHIELD_BLUE);
      this.checkLose();
      this.refreshUI();
    });
    card.appendChild(useBtn);

    // Decline button
    const declineBtn = document.createElement('button');
    declineBtn.type = 'button';
    declineBtn.textContent = 'Accept the bite';
    Object.assign(declineBtn.style, {
      width: '100%', padding: '10px', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit',
      color: C_SNAKE_RED + 'cc', background: 'rgba(192,57,43,0.08)',
      border: '1px solid rgba(192,57,43,0.25)', borderRadius: '10px',
      cursor: 'pointer',
    });
    declineBtn.addEventListener('click', () => {
      this.overlayEl!.style.display = 'none';
      this.showingShieldChoice = false;
      this.slideDownSnake(this.pendingSnakeTo);
      this.refreshUI();
    });
    card.appendChild(declineBtn);

    this.overlayEl.appendChild(card);
  }

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    clearInterval(this.questionTimerId);
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('moksha-anims');
    if (animStyle) animStyle.remove();
    this.ctx2d = null;
    this.pawnEl = null;
    this.hudEl = null;
    this.turnEl = null;
    this.posEl = null;
    this.shieldEl = null;
    this.movesEl = null;
    this.statusEl = null;
    this.overlayEl = null;
    this.resetBtnEl = null;
    super.dispose();
  }
}
