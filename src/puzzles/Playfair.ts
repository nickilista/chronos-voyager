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
 * Playfair Cipher — Aligned with iOS PlayfairCipherView.swift
 *
 * Levels 1-4: Single Playfair grid, decrypt cipher digraphs by picking
 * plaintext letter pairs from the 5×5 key square.
 * Levels 5-7: Two-Square (Double Playfair) with two grids.
 *
 * Mechanics:
 *   - Player sees cipher digraphs, must tap the correct plaintext pair in the grid(s)
 *   - 5 lives, lose one per wrong answer
 *   - Shake animation on error, flash on correct
 *   - Scanline overlay, codebreaker green theme
 *   - Hint toggle, rules sheet
 */

/* ═══════════════════════════════════════════════════════════════════════
   Playfair Cryptography Helpers
   ═══════════════════════════════════════════════════════════════════════ */

const GRID_SIZE = 5;

function pfMakeGrid(keyword: string): string[][] {
  const seen = new Set<string>();
  const letters: string[] = [];
  const up = keyword.toUpperCase().replace(/J/g, 'I');
  for (const ch of up) {
    if (ch >= 'A' && ch <= 'Z' && !seen.has(ch)) {
      seen.add(ch);
      letters.push(ch);
    }
  }
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    if (ch === 'J') continue;
    if (!seen.has(ch)) {
      seen.add(ch);
      letters.push(ch);
    }
  }
  const grid: string[][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    grid.push(letters.slice(r * 5, r * 5 + 5));
  }
  return grid;
}

function pfFind(grid: string[][], ch: string): [number, number] | null {
  const c = ch === 'J' ? 'I' : ch;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (grid[r][col] === c) return [r, col];
    }
  }
  return null;
}

function pfEncrypt(grid: string[][], a: string, b: string): [string, string] {
  const p1 = pfFind(grid, a);
  const p2 = pfFind(grid, b);
  if (!p1 || !p2) return [a, b];
  const [r1, c1] = p1;
  const [r2, c2] = p2;
  if (r1 === r2) return [grid[r1][(c1 + 1) % 5], grid[r2][(c2 + 1) % 5]];
  if (c1 === c2) return [grid[(r1 + 1) % 5][c1], grid[(r2 + 1) % 5][c2]];
  return [grid[r1][c2], grid[r2][c1]];
}

function pfEncryptTwoSquare(g1: string[][], g2: string[][], a: string, b: string): [string, string] {
  const p1 = pfFind(g1, a);
  const p2 = pfFind(g2, b);
  if (!p1 || !p2) return [a, b];
  const [r1, c1] = p1;
  const [r2, c2] = p2;
  return [g1[r1][c2], g2[r2][c1]];
}

function pfPrepareDigraphs(text: string): [string, string][] {
  const chars = text.toUpperCase().replace(/[^A-Z]/g, '').replace(/J/g, 'I').split('');
  const result: [string, string][] = [];
  let i = 0;
  while (i < chars.length) {
    const a = chars[i];
    if (i + 1 < chars.length) {
      const b = chars[i + 1];
      if (a === b) {
        result.push([a, 'X']);
        i += 1;
      } else {
        result.push([a, b]);
        i += 2;
      }
    } else {
      result.push([a, 'X']);
      i += 1;
    }
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════════════════
   Mission Data (matches iOS PFMission levels)
   ═══════════════════════════════════════════════════════════════════════ */

interface PFMission {
  title: string;
  briefing: string;
  hint: string;
  isDoubleSquare: boolean;
  grid1: string[][];
  grid2: string[][] | null;
  cipherDigraphs: [string, string][];
  plainDigraphs: [string, string][];
}

function missionForLevel(level: number): PFMission {
  switch (level) {
    case 1: return missionLevel1();
    case 2: return missionLevel2();
    case 3: return missionLevel3();
    case 4: return missionLevel4();
    case 5: return missionLevel5();
    case 6: return missionLevel6();
    default: return missionLevel7();
  }
}

function missionLevel1(): PFMission {
  const grid = pfMakeGrid('CIPHER');
  const plain = pfPrepareDigraphs('HELP');
  const cipher = plain.map(([a, b]) => pfEncrypt(grid, a, b));
  return { title: 'FIRST INTERCEPT', briefing: 'A short coded message was intercepted. Decrypt the digraphs by selecting the correct plaintext letters from the grid.', hint: 'Look at the cipher letters in the grid. Apply Playfair rules: same row shift left, same column shift up, rectangle swap columns.', isDoubleSquare: false, grid1: grid, grid2: null, cipherDigraphs: cipher, plainDigraphs: plain };
}

function missionLevel2(): PFMission {
  const grid = pfMakeGrid('ENIGMA');
  const plain = pfPrepareDigraphs('SENDPLAN');
  const cipher = plain.map(([a, b]) => pfEncrypt(grid, a, b));
  return { title: 'SHORT MESSAGE', briefing: 'Intelligence reports a longer transmission. Decrypt all pairs to reveal the plaintext.', hint: 'Remember: to decrypt, reverse the rules. Same row → shift LEFT. Same column → shift UP. Rectangle → same swap.', isDoubleSquare: false, grid1: grid, grid2: null, cipherDigraphs: cipher, plainDigraphs: plain };
}

function missionLevel3(): PFMission {
  const grid = pfMakeGrid('TURING');
  const plain = pfPrepareDigraphs('BREAKTHECODE');
  const cipher = plain.map(([a, b]) => pfEncrypt(grid, a, b));
  return { title: 'LONGER INTERCEPT', briefing: 'Bletchley Park needs your help. A 6-pair message must be cracked.', hint: 'Find each cipher letter in the grid. Determine if they share a row, column, or form a rectangle, then apply the decryption rule.', isDoubleSquare: false, grid1: grid, grid2: null, cipherDigraphs: cipher, plainDigraphs: plain };
}

function missionLevel4(): PFMission {
  const grid = pfMakeGrid('BLETCHLEY');
  const plain = pfPrepareDigraphs('INTERCEPTURGENT');
  const cipher = plain.map(([a, b]) => pfEncrypt(grid, a, b));
  return { title: 'FULL INTERCEPT', briefing: 'An urgent 8-pair transmission from the field. Time is critical.', hint: 'Work methodically pair by pair. The grid keyword is BLETCHLEY.', isDoubleSquare: false, grid1: grid, grid2: null, cipherDigraphs: cipher, plainDigraphs: plain };
}

function missionLevel5(): PFMission {
  const g1 = pfMakeGrid('TURING');
  const g2 = pfMakeGrid('CLARKE');
  const plain = pfPrepareDigraphs('STOPHIM');
  const cipher = plain.map(([a, b]) => pfEncryptTwoSquare(g1, g2, a, b));
  return { title: 'TWO-SQUARE INTRO', briefing: 'A new cipher variant uses two key squares. First plaintext letter from Grid I, second from Grid II.', hint: 'In Two-Square: find cipher letter 1 in Grid I, cipher letter 2 in Grid II. The plaintext letters are at the rectangle corners.', isDoubleSquare: true, grid1: g1, grid2: g2, cipherDigraphs: cipher, plainDigraphs: plain };
}

function missionLevel6(): PFMission {
  const g1 = pfMakeGrid('COLOSSUS');
  const g2 = pfMakeGrid('FLOWERS');
  const plain = pfPrepareDigraphs('CIPHERFOUND');
  const cipher = plain.map(([a, b]) => pfEncryptTwoSquare(g1, g2, a, b));
  return { title: 'TWO-SQUARE MESSAGE', briefing: 'Colossus has intercepted a two-square encrypted dispatch. 6 pairs to decrypt.', hint: 'Pick first plaintext letter from Grid I, second from Grid II. They form the rectangle corners with the cipher letters.', isDoubleSquare: true, grid1: g1, grid2: g2, cipherDigraphs: cipher, plainDigraphs: plain };
}

function missionLevel7(): PFMission {
  const g1 = pfMakeGrid('PLAYFAIR');
  const g2 = pfMakeGrid('FRIEDMAN');
  const plain = pfPrepareDigraphs('ULTRATOPSECRET');
  const cipher = plain.map(([a, b]) => pfEncryptTwoSquare(g1, g2, a, b));
  return { title: "FRIEDMAN'S CHALLENGE", briefing: 'The ultimate two-square cipher. 7 pairs stand between you and ULTRA clearance.', hint: 'Grid I keyword: PLAYFAIR. Grid II keyword: FRIEDMAN. Rectangle rule applies across both grids.', isDoubleSquare: true, grid1: g1, grid2: g2, cipherDigraphs: cipher, plainDigraphs: plain };
}

/* ═══════════════════════════════════════════════════════════════════════
   Colors (Codebreaker palette — matches iOS)
   ═══════════════════════════════════════════════════════════════════════ */

const C_BG_DARK = '#0A1210';
const C_MATRIX_GREEN = '#2ECC71';
const C_TERM_GREEN = '#00FF41';
const C_AMBER = '#E8A040';
const C_BRASS_GOLD = '#B5A642';
const C_ERROR_RED = '#FF4040';
const C_CREAM = '#E8F5E9';
const C_DARK_PANEL = '#141E1A';
const C_STEEL_GRAY = '#4A5859';

/* ═══════════════════════════════════════════════════════════════════════
   Puzzle Class
   ═══════════════════════════════════════════════════════════════════════ */

export class PlayfairPuzzle extends Puzzle {
  readonly title = 'PLAYFAIR CIPHER';
  readonly subtitle = 'codebreaker challenge';
  readonly instructions =
    'Decrypt the cipher digraphs by tapping the correct plaintext letter pair from the grid. Same row → shift left, same column → shift up, rectangle → swap columns.';

  private level = 7; // max difficulty
  private mission!: PFMission;

  // State
  private phase: 'playing' | 'won' | 'lost' = 'playing';
  private currentPair = 0;
  private firstPick: { grid: number; row: number; col: number } | null = null;
  private solvedPairs: boolean[] = [];
  private lives = 5;
  private isProcessing = false;
  private showHint = false;
  private showRules = false;
  private feedbackText = '';
  private feedbackColor = '';
  private pairFlash: number | null = null;
  private shakeX = 0;
  private scanlineAnim = 0;

  // DOM
  private root: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.setupMission();
    this.buildDom();
    this.refresh();
  }

  /* ═══════════════════ 3D Backdrop ══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color(C_BG_DARK), roughness: 0.7, metalness: 0.2, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color(C_MATRIX_GREEN), emissive: new Color('#0a2a1a'),
        emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.9, side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const lamp = new PointLight(C_TERM_GREEN, 1.8, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ═══════════════════ Mission Setup ════════════════════════════ */

  private setupMission(): void {
    this.mission = missionForLevel(this.level);
    this.phase = 'playing';
    this.currentPair = 0;
    this.firstPick = null;
    this.solvedPairs = new Array(this.mission.cipherDigraphs.length).fill(false);
    this.lives = 5;
    this.isProcessing = false;
    this.feedbackText = '';
    this.pairFlash = null;
    this.shakeX = 0;
  }

  /* ═══════════════════ DOM Construction ═════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-playfair';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    // Scanline overlay
    const scanline = document.createElement('div');
    scanline.id = 'pf-scanline';
    Object.assign(scanline.style, {
      position: 'absolute', left: '0', right: '0', height: '40px',
      background: `linear-gradient(to bottom, transparent, ${C_MATRIX_GREEN}08, transparent)`,
      pointerEvents: 'none', top: '0', transition: 'top 0.1s linear',
    });
    root.appendChild(scanline);

    // Main panel
    const panel = document.createElement('div');
    panel.id = 'pf-panel';
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
      pointerEvents: 'auto', padding: '16px 18px',
      background: 'rgba(10,18,16,0.94)', backdropFilter: 'blur(12px)',
      border: `1px solid ${C_MATRIX_GREEN}40`, borderTop: `3px solid ${C_MATRIX_GREEN}`,
      borderRadius: '10px', boxShadow: `0 18px 60px rgba(0,0,0,0.7)`, color: C_CREAM,
      maxHeight: '96vh', overflowY: 'auto', maxWidth: 'min(420px, calc(100vw - 16px))', width: '95%', boxSizing: 'border-box',
    });
    root.appendChild(panel);

    // Overlay for rules/results
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    // Inject animation keyframes
    if (!document.getElementById('pf-anims')) {
      const style = document.createElement('style');
      style.id = 'pf-anims';
      style.textContent = `
        @keyframes pf-pop { from { transform: scale(0.92); opacity:0; } to { transform: scale(1); opacity:1; } }
        @keyframes pf-shake { 0%{transform:translateX(0)} 20%{transform:translateX(10px)} 40%{transform:translateX(-8px)} 60%{transform:translateX(5px)} 80%{transform:translateX(-3px)} 100%{transform:translateX(0)} }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(root);
  }

  /* ═══════════════════ Rendering ════════════════════════════════ */

  private refresh(): void {
    const panel = this.root?.querySelector('#pf-panel') as HTMLDivElement | null;
    if (!panel) return;
    panel.innerHTML = '';

    // Header row (rules button, lives, hint button)
    panel.appendChild(this.buildHeader());

    // Mission briefing
    panel.appendChild(this.buildMissionBriefing());

    // Cipher strip
    panel.appendChild(this.buildCipherStrip());

    // Grid section
    panel.appendChild(this.buildGridSection());

    // Selection hint
    panel.appendChild(this.buildSelectionHint());

    // Feedback bubble
    if (this.feedbackText) {
      panel.appendChild(this.buildFeedbackBubble());
    }

    // Result overlay
    if (this.phase === 'won' || this.phase === 'lost') {
      this.showResultOverlay();
    }

    // Rules overlay
    if (this.showRules) {
      this.showRulesOverlay();
    }
  }

  private buildHeader(): HTMLElement {
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
    });

    // Rules button (info circle)
    const rulesBtn = document.createElement('button');
    rulesBtn.type = 'button';
    Object.assign(rulesBtn.style, {
      width: '28px', height: '28px', borderRadius: '50%', border: `1.5px solid ${C_MATRIX_GREEN}80`,
      background: `${C_MATRIX_GREEN}26`, cursor: 'pointer', display: 'flex',
      alignItems: 'center', justifyContent: 'center', color: C_MATRIX_GREEN,
      fontSize: '14px', fontWeight: '700', fontFamily: 'monospace',
    });
    rulesBtn.textContent = 'i';
    rulesBtn.addEventListener('click', () => { this.showRules = true; this.refresh(); });
    header.appendChild(rulesBtn);

    // Lives dots
    const livesWrap = document.createElement('div');
    Object.assign(livesWrap.style, { display: 'flex', gap: '4px', alignItems: 'center' });
    for (let i = 0; i < 5; i++) {
      const dot = document.createElement('div');
      Object.assign(dot.style, {
        width: '10px', height: '10px', borderRadius: '50%',
        background: i < this.lives ? C_MATRIX_GREEN : `${C_STEEL_GRAY}4d`,
      });
      livesWrap.appendChild(dot);
    }
    header.appendChild(livesWrap);

    // Hint button
    const hintBtn = document.createElement('button');
    hintBtn.type = 'button';
    Object.assign(hintBtn.style, {
      width: '28px', height: '28px', borderRadius: '50%', border: `1.5px solid ${C_AMBER}80`,
      background: this.showHint ? `${C_AMBER}4d` : `${C_AMBER}1a`, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: C_AMBER,
      fontSize: '14px', fontWeight: '700', fontFamily: 'monospace',
    });
    hintBtn.textContent = '?';
    hintBtn.addEventListener('click', () => { this.showHint = !this.showHint; this.refresh(); });
    header.appendChild(hintBtn);

    return header;
  }

  private buildMissionBriefing(): HTMLElement {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      width: '100%', padding: '10px 14px', textAlign: 'center',
      background: C_DARK_PANEL, borderRadius: '8px',
      border: `1px solid ${C_MATRIX_GREEN}33`,
    });

    const title = document.createElement('div');
    Object.assign(title.style, {
      fontSize: '13px', fontWeight: '700', color: C_MATRIX_GREEN,
      letterSpacing: '0.08em', fontFamily: 'monospace', marginBottom: '4px',
    });
    title.textContent = this.mission.title;
    wrap.appendChild(title);

    const briefing = document.createElement('div');
    Object.assign(briefing.style, { fontSize: '11px', color: `${C_CREAM}b3`, lineHeight: '1.4' });
    briefing.textContent = this.mission.briefing;
    wrap.appendChild(briefing);

    if (this.showHint) {
      const hint = document.createElement('div');
      Object.assign(hint.style, { fontSize: '10px', color: C_AMBER, marginTop: '6px', lineHeight: '1.3' });
      hint.textContent = this.mission.hint;
      wrap.appendChild(hint);
    }

    return wrap;
  }

  private buildCipherStrip(): HTMLElement {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      width: '100%', padding: '10px', textAlign: 'center',
      background: 'rgba(0,0,0,0.3)', borderRadius: '8px',
      border: `1px solid ${C_STEEL_GRAY}4d`,
      transition: 'transform 0.3s',
    });
    if (this.shakeX !== 0) {
      wrap.style.animation = 'pf-shake 0.4s ease-out';
      setTimeout(() => { this.shakeX = 0; }, 400);
    }

    const label = document.createElement('div');
    Object.assign(label.style, {
      fontSize: '9px', fontWeight: '700', color: `${C_ERROR_RED}99`,
      letterSpacing: '1px', fontFamily: 'monospace', marginBottom: '6px',
    });
    label.textContent = 'CIPHER TEXT';
    wrap.appendChild(label);

    const pairsRow = document.createElement('div');
    Object.assign(pairsRow.style, {
      display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap',
    });

    for (let i = 0; i < this.mission.cipherDigraphs.length; i++) {
      const pair = this.mission.cipherDigraphs[i];
      const isCurrent = i === this.currentPair && this.phase === 'playing';
      const isSolved = this.solvedPairs[i];
      const isFlashing = this.pairFlash === i;

      const pairEl = document.createElement('div');
      Object.assign(pairEl.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' });

      const lettersRow = document.createElement('div');
      Object.assign(lettersRow.style, { display: 'flex', gap: '1px' });

      for (const ch of [pair[0], pair[1]]) {
        const cell = document.createElement('div');
        const color = isSolved ? C_MATRIX_GREEN : C_ERROR_RED;
        Object.assign(cell.style, {
          width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: '800', fontFamily: 'monospace',
          color: isFlashing ? C_BG_DARK : color,
          background: isFlashing ? C_MATRIX_GREEN : (isCurrent ? `${color}26` : 'transparent'),
          border: `${isCurrent ? '1.5' : '0.5'}px solid ${isCurrent ? `${color}99` : `${color}33`}`,
          borderRadius: '3px',
        });
        cell.textContent = ch;
        lettersRow.appendChild(cell);
      }
      pairEl.appendChild(lettersRow);

      // Show plaintext below if solved
      if (isSolved) {
        const plainRow = document.createElement('div');
        Object.assign(plainRow.style, { display: 'flex', gap: '1px' });
        const plain = this.mission.plainDigraphs[i];
        for (const ch of [plain[0], plain[1]]) {
          const cell = document.createElement('div');
          Object.assign(cell.style, {
            fontSize: '9px', fontWeight: '700', fontFamily: 'monospace', color: C_MATRIX_GREEN,
          });
          cell.textContent = ch;
          plainRow.appendChild(cell);
        }
        pairEl.appendChild(plainRow);
      }

      pairsRow.appendChild(pairEl);
    }

    wrap.appendChild(pairsRow);
    return wrap;
  }

  private buildGridSection(): HTMLElement {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' });

    if (this.mission.isDoubleSquare) {
      wrap.appendChild(this.buildGrid(this.mission.grid1, 0, 'I'));
      wrap.appendChild(this.buildGrid(this.mission.grid2!, 1, 'II'));
    } else {
      wrap.appendChild(this.buildGrid(this.mission.grid1, 0, null));
    }

    return wrap;
  }

  private buildGrid(grid: string[][], gridIndex: number, label: string | null): HTMLElement {
    const currentCipher = this.currentPair < this.mission.cipherDigraphs.length
      ? this.mission.cipherDigraphs[this.currentPair] : null;

    // Find cipher letter positions highlighted in this grid
    const cipherHighlights: string[] = [];
    if (currentCipher && this.phase === 'playing') {
      if (this.mission.isDoubleSquare) {
        if (gridIndex === 0) {
          const pos = pfFind(grid, currentCipher[0]);
          if (pos) cipherHighlights.push(`${pos[0]},${pos[1]}`);
        }
        if (gridIndex === 1) {
          const pos = pfFind(grid, currentCipher[1]);
          if (pos) cipherHighlights.push(`${pos[0]},${pos[1]}`);
        }
      } else {
        const pos0 = pfFind(grid, currentCipher[0]);
        if (pos0) cipherHighlights.push(`${pos0[0]},${pos0[1]}`);
        const pos1 = pfFind(grid, currentCipher[1]);
        if (pos1) cipherHighlights.push(`${pos1[0]},${pos1[1]}`);
      }
    }

    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px',
      border: `1px solid ${C_STEEL_GRAY}33`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
    });

    if (label) {
      const lbl = document.createElement('div');
      Object.assign(lbl.style, {
        fontSize: '9px', fontWeight: '700', color: `${C_BRASS_GOLD}99`,
        letterSpacing: '1px', fontFamily: 'monospace',
      });
      lbl.textContent = `GRID ${label}`;
      wrap.appendChild(lbl);
    }

    const gridEl = document.createElement('div');
    Object.assign(gridEl.style, {
      display: 'grid', gridTemplateColumns: `repeat(5, ${Math.min(38, Math.floor((Math.min(window.innerWidth, 500) - 80) / 5))}px)`, gridTemplateRows: `repeat(5, ${Math.min(38, Math.floor((Math.min(window.innerWidth, 500) - 80) / 5))}px)`,
      gap: '2px',
    });

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const ch = grid[r][c];
        const isCipherHL = cipherHighlights.includes(`${r},${c}`);
        const isFirstPick = this.firstPick !== null && this.firstPick.grid === gridIndex
          && this.firstPick.row === r && this.firstPick.col === c;

        const btn = document.createElement('button');
        btn.type = 'button';
        Object.assign(btn.style, {
          width: `${Math.min(38, Math.floor((Math.min(window.innerWidth, 500) - 80) / 5))}px`, height: `${Math.min(38, Math.floor((Math.min(window.innerWidth, 500) - 80) / 5))}px`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', fontWeight: '700', fontFamily: 'monospace',
          color: isFirstPick ? C_BG_DARK : (isCipherHL ? C_ERROR_RED : `${C_CREAM}cc`),
          background: isFirstPick ? C_MATRIX_GREEN : (isCipherHL ? `${C_ERROR_RED}1f` : C_DARK_PANEL),
          border: `${(isFirstPick || isCipherHL) ? '1.5' : '0.5'}px solid ${isFirstPick ? C_MATRIX_GREEN : (isCipherHL ? `${C_ERROR_RED}80` : `${C_STEEL_GRAY}40`)}`,
          borderRadius: '4px', cursor: this.phase === 'playing' ? 'pointer' : 'default',
        });
        btn.textContent = ch;
        btn.disabled = this.phase !== 'playing';
        btn.addEventListener('click', () => this.cellTapped(gridIndex, r, c));
        gridEl.appendChild(btn);
      }
    }

    wrap.appendChild(gridEl);
    return wrap;
  }

  private buildSelectionHint(): HTMLElement {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { height: '20px', textAlign: 'center', fontSize: '10px', fontFamily: 'monospace' });

    if (this.phase !== 'playing') return wrap;

    if (this.firstPick) {
      const grid = this.mission.isDoubleSquare
        ? (this.firstPick.grid === 0 ? this.mission.grid1 : this.mission.grid2!)
        : this.mission.grid1;
      const ch = grid[this.firstPick.row][this.firstPick.col];

      const text = this.mission.isDoubleSquare
        ? `${ch} _ \u2190 tap Grid ${this.firstPick.grid === 0 ? 'II' : 'I'}`
        : `${ch} _ \u2190 tap second letter`;
      wrap.style.color = `${C_AMBER}99`;
      wrap.textContent = text;
    } else {
      let ruleText = '';
      if (this.currentPair < this.mission.cipherDigraphs.length) {
        const cp = this.mission.cipherDigraphs[this.currentPair];
        if (this.mission.isDoubleSquare) {
          ruleText = 'Rectangle rule: pick plaintext from opposite grid corners';
        } else {
          const pos1 = pfFind(this.mission.grid1, cp[0]);
          const pos2 = pfFind(this.mission.grid1, cp[1]);
          if (pos1 && pos2) {
            if (this.level <= 2) {
              if (pos1[0] === pos2[0]) ruleText = 'Same row \u2192 shift LEFT to decrypt';
              else if (pos1[1] === pos2[1]) ruleText = 'Same column \u2192 shift UP to decrypt';
              else ruleText = 'Rectangle \u2192 swap columns to decrypt';
            } else {
              ruleText = 'Tap the first plaintext letter';
            }
          }
        }
      }
      wrap.style.color = `${C_AMBER}b3`;
      wrap.textContent = ruleText;
    }

    return wrap;
  }

  private buildFeedbackBubble(): HTMLElement {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '6px 12px', borderRadius: '6px',
      background: `${this.feedbackColor}14`,
      border: `0.5px solid ${this.feedbackColor}33`,
    });

    const dot = document.createElement('div');
    Object.assign(dot.style, { width: '8px', height: '8px', borderRadius: '50%', background: this.feedbackColor });
    wrap.appendChild(dot);

    const text = document.createElement('div');
    Object.assign(text.style, { fontSize: '10px', fontFamily: 'monospace', color: this.feedbackColor });
    text.textContent = this.feedbackText;
    wrap.appendChild(text);

    return wrap;
  }

  /* ═══════════════════ Result Overlay ═══════════════════════════ */

  private showResultOverlay(): void {
    if (!this.overlayEl) return;
    const won = this.phase === 'won';
    const accent = won ? C_MATRIX_GREEN : C_ERROR_RED;

    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '320px', width: '90%', padding: '24px', textAlign: 'center',
      background: `${C_BG_DARK}f2`, border: `1px solid ${accent}4d`,
      borderRadius: '16px', boxShadow: `0 0 30px ${accent}22`,
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      animation: 'pf-pop 0.3s ease-out',
    });

    // Shield icon
    const icon = document.createElement('div');
    Object.assign(icon.style, { fontSize: '40px', marginBottom: '12px' });
    icon.textContent = won ? '\u2713' : '\u2717';
    Object.assign(icon.style, { color: accent, fontWeight: '900', fontSize: '48px' });
    card.appendChild(icon);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '16px', fontWeight: '800', color: accent, fontFamily: 'monospace', marginBottom: '8px' });
    title.textContent = won ? 'DECRYPTION COMPLETE' : 'DECRYPTION FAILED';
    card.appendChild(title);

    // Message
    const msg = document.createElement('div');
    Object.assign(msg.style, { fontSize: '11px', color: `${C_CREAM}b3`, marginBottom: '14px', lineHeight: '1.4' });
    msg.textContent = won
      ? 'The cipher has been broken. The message is revealed.'
      : 'Too many errors. The message remains encrypted.';
    card.appendChild(msg);

    // Show decrypted text if won
    if (won) {
      const plainWrap = document.createElement('div');
      Object.assign(plainWrap.style, {
        display: 'flex', gap: '4px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '14px',
      });
      for (const pair of this.mission.plainDigraphs) {
        const span = document.createElement('span');
        Object.assign(span.style, { fontSize: '16px', fontWeight: '800', fontFamily: 'monospace', color: C_MATRIX_GREEN });
        span.textContent = pair[0] + pair[1];
        plainWrap.appendChild(span);
      }
      card.appendChild(plainWrap);
    }

    // Button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = won ? 'CONTINUE' : 'TRY AGAIN';
    Object.assign(btn.style, {
      padding: '10px 24px', fontSize: '13px', fontWeight: '700', fontFamily: 'inherit',
      color: accent, background: `${accent}1f`, border: `1.5px solid ${accent}80`,
      borderRadius: '20px', cursor: 'pointer', letterSpacing: '0.08em',
    });
    btn.addEventListener('click', () => {
      this.overlayEl!.style.display = 'none';
      if (won) {
        this.isSolved = true;
        this.onSolved?.();
      } else {
        this.setupMission();
        this.refresh();
      }
    });
    card.appendChild(btn);

    this.overlayEl.appendChild(card);
  }

  /* ═══════════════════ Rules Overlay ═══════════════════════════ */

  private showRulesOverlay(): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '340px', width: '90%', padding: '20px', textAlign: 'left',
      background: C_BG_DARK, border: `1px solid ${C_MATRIX_GREEN}40`,
      borderRadius: '16px', fontFamily: "'Rajdhani', system-ui, sans-serif",
      maxHeight: '80vh', overflowY: 'auto',
    });

    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '16px', fontWeight: '800', color: C_MATRIX_GREEN, fontFamily: 'monospace', marginBottom: '12px' });
    title.textContent = 'PLAYFAIR CIPHER RULES';
    card.appendChild(title);

    const rules = [
      'A 5\u00d75 grid is filled with the keyword letters first, then remaining alphabet (I and J share a cell).',
      'Same Row: to decrypt, shift each letter LEFT (wrap around).',
      'Same Column: to decrypt, shift each letter UP (wrap around).',
      'Rectangle: the two cipher letters define corners. Plaintext letters are at the other two corners (same rows, swapped columns).',
    ];
    if (this.mission.isDoubleSquare) {
      rules.push('Two-Square: uses two grids. First cipher letter is in Grid I, second in Grid II. Plaintext letters are at the rectangle corners across grids.');
    }
    rules.push('Invented by Charles Wheatstone in 1854, promoted by Lord Playfair. Used by the British military into the 20th century.');

    for (const rule of rules) {
      const item = document.createElement('div');
      Object.assign(item.style, { display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' });

      const dot = document.createElement('div');
      Object.assign(dot.style, { width: '6px', height: '6px', borderRadius: '50%', background: C_MATRIX_GREEN, marginTop: '5px', flexShrink: '0' });
      item.appendChild(dot);

      const text = document.createElement('div');
      Object.assign(text.style, { fontSize: '12px', color: `${C_CREAM}cc`, lineHeight: '1.4' });
      text.textContent = rule;
      item.appendChild(text);

      card.appendChild(item);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'CLOSE';
    Object.assign(closeBtn.style, {
      marginTop: '14px', padding: '8px 20px', fontSize: '12px', fontWeight: '700',
      color: C_MATRIX_GREEN, background: 'transparent', border: `1px solid ${C_MATRIX_GREEN}80`,
      borderRadius: '5px', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.1em',
    });
    closeBtn.addEventListener('click', () => {
      this.showRules = false;
      this.overlayEl!.style.display = 'none';
      this.refresh();
    });
    card.appendChild(closeBtn);

    this.overlayEl.appendChild(card);
  }

  /* ═══════════════════ Game Actions ═════════════════════════════ */

  private cellTapped(gridIndex: number, row: number, col: number): void {
    if (this.phase !== 'playing' || this.isProcessing) return;
    if (this.currentPair >= this.mission.cipherDigraphs.length) return;

    if (this.firstPick === null) {
      // First letter selection
      if (this.mission.isDoubleSquare) {
        // First pick MUST come from grid 0
        if (gridIndex !== 0) {
          this.feedbackText = 'Pick first letter from Grid I';
          this.feedbackColor = C_AMBER;
          this.refresh();
          setTimeout(() => { if (this.feedbackColor === C_AMBER) { this.feedbackText = ''; this.refresh(); } }, 1500);
          return;
        }
      }
      this.firstPick = { grid: gridIndex, row, col };
      this.refresh();
    } else {
      // Second letter selection
      if (this.mission.isDoubleSquare) {
        // Second pick MUST come from grid 1
        if (gridIndex !== 1) {
          this.feedbackText = 'Pick second letter from Grid II';
          this.feedbackColor = C_AMBER;
          this.refresh();
          setTimeout(() => { if (this.feedbackColor === C_AMBER) { this.feedbackText = ''; this.refresh(); } }, 1500);
          return;
        }
      }

      const fp = this.firstPick;
      this.firstPick = null;
      this.checkPair(fp, { grid: gridIndex, row, col });
    }
  }

  private checkPair(first: { grid: number; row: number; col: number }, second: { grid: number; row: number; col: number }): void {
    const expected = this.mission.plainDigraphs[this.currentPair];
    const g1 = this.mission.grid1;
    const g2 = this.mission.grid2 ?? this.mission.grid1;

    const picked1 = first.grid === 0 ? g1[first.row][first.col] : g2[first.row][first.col];
    const picked2 = second.grid === 0 ? g1[second.row][second.col] : g2[second.row][second.col];

    if (picked1 === expected[0] && picked2 === expected[1]) {
      this.handleCorrect();
    } else {
      this.handleWrong();
    }
  }

  private handleCorrect(): void {
    this.isProcessing = true;
    this.solvedPairs[this.currentPair] = true;
    this.pairFlash = this.currentPair;
    this.feedbackText = '\u2713 Correct pair decrypted';
    this.feedbackColor = C_MATRIX_GREEN;
    this.refresh();

    setTimeout(() => {
      this.pairFlash = null;
      this.feedbackText = '';
      this.currentPair++;
      if (this.currentPair >= this.mission.cipherDigraphs.length) {
        this.phase = 'won';
      }
      this.isProcessing = false;
      this.refresh();
    }, 600);
  }

  private handleWrong(): void {
    this.isProcessing = true;
    this.lives--;
    this.feedbackText = 'Wrong pair \u2014 try again';
    this.feedbackColor = C_ERROR_RED;
    this.shakeX = 1; // triggers shake animation
    this.refresh();

    if (this.lives <= 0) {
      setTimeout(() => {
        this.phase = 'lost';
        this.isProcessing = false;
        this.refresh();
      }, 1000);
    } else {
      setTimeout(() => {
        this.feedbackText = '';
        this.isProcessing = false;
        this.refresh();
      }, 1200);
    }
  }

  /* ═══════════════════ Lifecycle ════════════════════════════════ */

  update(dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);

    // Animate scanline
    this.scanlineAnim += dt * 0.25;
    if (this.scanlineAnim > 1) this.scanlineAnim -= 1;
    const scanEl = this.root?.querySelector('#pf-scanline') as HTMLElement | null;
    if (scanEl) {
      scanEl.style.top = `${this.scanlineAnim * 100}%`;
    }
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('pf-anims');
    if (animStyle) animStyle.remove();
    this.overlayEl = null;
    super.dispose();
  }
}
