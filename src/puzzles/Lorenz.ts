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
 * Lorenz SZ40/42 cipher machine — Bill Tutte's legendary cryptanalysis.
 * 10 progressive levels aligned with the iOS implementation:
 *   - Levels 1–2: XOR Trainer (manually XOR cipher ⊕ key)
 *   - Levels 3–4: Pattern Finder (spot repeating wheel cycles)
 *   - Levels 5–7: Wheel Set (adjust chi wheel positions)
 *   - Levels 8–9: Multi-Wheel (chi + psi layers)
 *   - Level 10: Full Machine (chi + psi + motor)
 *
 * Codebreakers palette: matrix green, amber, brass gold, copper.
 * Baudot/ITA2 5-bit teleprinter encoding throughout.
 */

/* ═══════════════════════════════════════════════════════════════════ */
/* Baudot / ITA2 Encoding                                            */
/* ═══════════════════════════════════════════════════════════════════ */

const BAUDOT_TABLE: Record<string, number[]> = {
  A: [1,1,0,0,0], B: [1,0,0,1,1], C: [0,1,1,1,0], D: [1,0,0,1,0],
  E: [1,0,0,0,0], F: [1,0,1,1,0], G: [0,1,0,1,1], H: [0,0,1,0,1],
  I: [0,1,1,0,0], J: [1,1,0,1,0], K: [1,1,1,1,0], L: [0,1,0,0,1],
  M: [0,0,1,1,1], N: [0,0,1,1,0], O: [0,0,0,1,1], P: [0,1,1,0,1],
  Q: [1,1,1,0,1], R: [0,1,0,1,0], S: [1,0,1,0,0], T: [0,0,0,0,1],
  U: [1,1,1,0,0], V: [0,1,1,1,1], W: [1,1,0,0,1], X: [1,0,1,1,1],
  Y: [1,0,1,0,1], Z: [1,0,0,0,1], ' ': [0,0,1,0,0],
};

const BAUDOT_REVERSE: Map<string, string> = new Map();
for (const [ch, bits] of Object.entries(BAUDOT_TABLE)) {
  BAUDOT_REVERSE.set(bits.join(''), ch);
}

function charToBits(ch: string): number[] {
  return BAUDOT_TABLE[ch.toUpperCase()] ?? [0, 0, 0, 0, 0];
}

function bitsToChar(bits: number[]): string {
  return BAUDOT_REVERSE.get(bits.join('')) ?? '?';
}

function xorBits(a: number[], b: number[]): number[] {
  return [0, 1, 2, 3, 4].map(i => ((a[i] ?? 0) ^ (b[i] ?? 0)));
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Mission Model                                                     */
/* ═══════════════════════════════════════════════════════════════════ */

type LZMode = 'xorTrainer' | 'patternFind' | 'wheelSet' | 'multiWheel' | 'fullMachine';

interface LZMission {
  title: string;
  briefing: string;
  mode: LZMode;
  plaintext: string;
  cipherBits: number[][];
  plainBits: number[][];
  keyBitsForTrainer: number[][];
  showKeyTape: boolean;
  exposedKeyStream: number[];
  patternLength: number;
  correctPattern: number[];
  wheelPatterns: number[][];
  wheelLabels: string[];
  correctWheelPositions: number[];
  anchorIndices: number[];
}

function computeAnchors(length: number): number[] {
  if (length < 2) return [];
  const count = length <= 6 ? 2 : 3;
  return Array.from({ length: count }, (_, i) =>
    Math.floor((i + 1) * length / (count + 1))
  );
}

/* ── Encryption helpers ─────────────────────────────────────────── */

function encryptMessage(plain: string, key: string): { cBits: number[][]; pBits: number[][]; kBits: number[][] } {
  const pChars = plain.toUpperCase().split('');
  const kChars = key.toUpperCase().split('');
  const cBits: number[][] = [];
  const pBits: number[][] = [];
  const kBits: number[][] = [];
  for (let i = 0; i < pChars.length; i++) {
    const pb = charToBits(pChars[i]);
    const kb = charToBits(kChars[i % kChars.length]);
    cBits.push(xorBits(pb, kb));
    pBits.push(pb);
    kBits.push(kb);
  }
  return { cBits, pBits, kBits };
}

function encryptWithWheels(plain: string, wheels: number[][], positions: number[]): { cBits: number[][]; pBits: number[][] } {
  const pChars = plain.toUpperCase().split('');
  const cBits: number[][] = [];
  const pBits: number[][] = [];
  for (let i = 0; i < pChars.length; i++) {
    const pb = charToBits(pChars[i]);
    const kb = [0, 1, 2, 3, 4].map(bi => {
      const pos = i * 5 + bi;
      let bit = 0;
      for (let wi = 0; wi < wheels.length; wi++) {
        const w = wheels[wi];
        bit ^= w[(positions[wi] + pos) % w.length];
      }
      return bit;
    });
    cBits.push(xorBits(pb, kb));
    pBits.push(pb);
  }
  return { cBits, pBits };
}

function encryptWithMotor(
  plain: string,
  chi: number[][], chiPos: number[],
  psi: number[][], psiPos: number[],
  motor: number[], motorPos: number,
): { cBits: number[][]; pBits: number[][] } {
  const pChars = plain.toUpperCase().split('');
  const cBits: number[][] = [];
  const pBits: number[][] = [];
  const psiOffsets = [...psiPos];
  let mPos = motorPos;
  for (let i = 0; i < pChars.length; i++) {
    const pb = charToBits(pChars[i]);
    const kb = [0, 1, 2, 3, 4].map(bi => {
      const pos = i * 5 + bi;
      let bit = 0;
      for (let wi = 0; wi < chi.length; wi++) {
        bit ^= chi[wi][(chiPos[wi] + pos) % chi[wi].length];
      }
      for (let wi = 0; wi < psi.length; wi++) {
        bit ^= psi[wi][psiOffsets[wi] % psi[wi].length];
      }
      return bit;
    });
    if (motor[mPos % motor.length] === 1) {
      for (let wi = 0; wi < psiOffsets.length; wi++) {
        psiOffsets[wi] = (psiOffsets[wi] + 1) % psi[wi].length;
      }
    }
    mPos = (mPos + 1) % motor.length;
    cBits.push(xorBits(pb, kb));
    pBits.push(pb);
  }
  return { cBits, pBits };
}

/* ── Level definitions ──────────────────────────────────────────── */

function missionForLevel(level: number): LZMission {
  switch (level) {
    case 1: return level1();
    case 2: return level2();
    case 3: return level3();
    case 4: return level4();
    case 5: return level5();
    case 6: return level6();
    case 7: return level7();
    case 8: return level8();
    case 9: return level9();
    default: return level10();
  }
}

function level1(): LZMission {
  const plain = 'HELLO';
  const key = 'KEYAB';
  const { cBits, pBits, kBits } = encryptMessage(plain, key);
  return {
    title: 'LEVEL 1: XOR BASICS', briefing: 'XOR each cipher bit with the key to reveal the plaintext.',
    mode: 'xorTrainer', plaintext: plain, cipherBits: cBits, plainBits: pBits,
    keyBitsForTrainer: kBits, showKeyTape: true,
    exposedKeyStream: [], patternLength: 0, correctPattern: [],
    wheelPatterns: [], wheelLabels: [], correctWheelPositions: [], anchorIndices: [],
  };
}

function level2(): LZMission {
  const plain = 'TUNNY FISH';
  const key = 'TUNNY FISH';
  const { cBits, pBits, kBits } = encryptMessage(plain, key);
  return {
    title: 'LEVEL 2: LONGER XOR', briefing: 'Decrypt a longer intercepted message. Key given.',
    mode: 'xorTrainer', plaintext: plain, cipherBits: cBits, plainBits: pBits,
    keyBitsForTrainer: kBits, showKeyTape: true,
    exposedKeyStream: [], patternLength: 0, correctPattern: [],
    wheelPatterns: [], wheelLabels: [], correctWheelPositions: [], anchorIndices: [],
  };
}

function level3(): LZMission {
  const pattern = [1, 0, 1, 1, 0];
  const stream = Array.from({ length: 15 }, (_, i) => pattern[i % 5]);
  return {
    title: 'LEVEL 3: CHI PATTERN', briefing: 'Spot the repeating pattern (period 5) in the key stream.',
    mode: 'patternFind', plaintext: 'CHI', cipherBits: [[0,0,0,0,0]], plainBits: [[0,0,0,0,0]],
    keyBitsForTrainer: [], showKeyTape: false,
    exposedKeyStream: stream, patternLength: 5, correctPattern: pattern,
    wheelPatterns: [], wheelLabels: [], correctWheelPositions: [], anchorIndices: [],
  };
}

function level4(): LZMission {
  const pattern = [1, 1, 0, 0, 1, 0, 1];
  const stream = Array.from({ length: 21 }, (_, i) => pattern[i % 7]);
  return {
    title: 'LEVEL 4: PSI PATTERN', briefing: 'Find a longer repeating pattern (period 7) in the stream.',
    mode: 'patternFind', plaintext: 'PSI', cipherBits: [[0,0,0,0,0]], plainBits: [[0,0,0,0,0]],
    keyBitsForTrainer: [], showKeyTape: false,
    exposedKeyStream: stream, patternLength: 7, correctPattern: pattern,
    wheelPatterns: [], wheelLabels: [], correctWheelPositions: [], anchorIndices: [],
  };
}

function level5(): LZMission {
  const plain = 'TUTTE';
  const chi: number[] = [1,0,1,1,0,1,0,0,1,1,0,1,0];
  const startPos = 3;
  const { cBits, pBits } = encryptWithWheels(plain, [chi], [startPos]);
  return {
    title: 'LEVEL 5: CHI WHEEL', briefing: 'Set the chi wheel start position to decrypt the message.',
    mode: 'wheelSet', plaintext: plain, cipherBits: cBits, plainBits: pBits,
    keyBitsForTrainer: [], showKeyTape: false,
    exposedKeyStream: [], patternLength: 0, correctPattern: [],
    wheelPatterns: [chi], wheelLabels: ['\u03C7\u2081'],
    correctWheelPositions: [startPos], anchorIndices: computeAnchors(plain.length),
  };
}

function level6(): LZMission {
  const plain = 'COLOSSUS';
  const chi1: number[] = [1,0,1,1,0,0,1,0,1,0,0];
  const chi2: number[] = [0,1,1,0,1,0,0,1,0,1,1,0,1];
  const pos1 = 2, pos2 = 5;
  const { cBits, pBits } = encryptWithWheels(plain, [chi1, chi2], [pos1, pos2]);
  return {
    title: 'LEVEL 6: TWO CHI WHEELS', briefing: 'Two chi wheels XOR together. Find both positions.',
    mode: 'wheelSet', plaintext: plain, cipherBits: cBits, plainBits: pBits,
    keyBitsForTrainer: [], showKeyTape: false,
    exposedKeyStream: [], patternLength: 0, correctPattern: [],
    wheelPatterns: [chi1, chi2], wheelLabels: ['\u03C7\u2081', '\u03C7\u2082'],
    correctWheelPositions: [pos1, pos2], anchorIndices: computeAnchors(plain.length),
  };
}

function level7(): LZMission {
  const plain = 'BLETCHLEY';
  const chi1: number[] = [1,0,0,1,1,0,1,0,1,0,1];
  const chi2: number[] = [0,1,1,0,0,1,0,1,0,1,1,0,1];
  const chi3: number[] = [1,1,0,1,0,0,1,1,0];
  const pos1 = 4, pos2 = 7, pos3 = 2;
  const { cBits, pBits } = encryptWithWheels(plain, [chi1, chi2, chi3], [pos1, pos2, pos3]);
  return {
    title: 'LEVEL 7: DELTA METHOD', briefing: 'Three chi wheels. Use Tutte\'s delta insight.',
    mode: 'wheelSet', plaintext: plain, cipherBits: cBits, plainBits: pBits,
    keyBitsForTrainer: [], showKeyTape: false,
    exposedKeyStream: [], patternLength: 0, correctPattern: [],
    wheelPatterns: [chi1, chi2, chi3], wheelLabels: ['\u03C7\u2081', '\u03C7\u2082', '\u03C7\u2083'],
    correctWheelPositions: [pos1, pos2, pos3], anchorIndices: computeAnchors(plain.length),
  };
}

function level8(): LZMission {
  const plain = 'FISH';
  const chi1: number[] = [1,0,1,0,0,1,1,0,1,0,0];
  const chi2: number[] = [0,1,0,1,1,0,0,1,0,1,1,0,1];
  const psi1: number[] = [1,1,0,0,1,0,1,0,0,1,1,0,1,0,1,0,0,1,0,1,1,0,1];
  const psi2: number[] = [0,1,1,0,1,0,0,1,1,0,0,1,0,1,1,0,0,1,0,1,0,1,1,0,1,0];
  const cp1 = 3, cp2 = 8, pp1 = 11, pp2 = 17;
  const { cBits, pBits } = encryptWithWheels(plain, [chi1, chi2, psi1, psi2], [cp1, cp2, pp1, pp2]);
  return {
    title: 'LEVEL 8: CHI + PSI', briefing: 'Add psi wheels. Key = chi XOR psi. Find all positions.',
    mode: 'multiWheel', plaintext: plain, cipherBits: cBits, plainBits: pBits,
    keyBitsForTrainer: [], showKeyTape: false,
    exposedKeyStream: [], patternLength: 0, correctPattern: [],
    wheelPatterns: [chi1, chi2, psi1, psi2],
    wheelLabels: ['\u03C7\u2081', '\u03C7\u2082', '\u03C8\u2081', '\u03C8\u2082'],
    correctWheelPositions: [cp1, cp2, pp1, pp2], anchorIndices: computeAnchors(plain.length),
  };
}

function level9(): LZMission {
  const plain = 'LORENZ';
  const chi1: number[] = [1,0,1,1,0,0,1,0,1,0,0,1,1];
  const chi2: number[] = [0,1,0,0,1,1,0,1,0,1,1];
  const psi1: number[] = [1,0,0,1,1,0,1,0,1,0,0,1,0,1,1,0,0,1,0,1,0,1,1];
  const psi2: number[] = [0,1,1,0,0,1,0,1,0,0,1,1,0,1,0,1,1,0,0,1,0,1,1,0,1,0,0,1,0];
  const mu: number[] = [1,0,1,1,0,0,1,0,0,1,0,1,1,0,1,0,0,1,1,0,1,0,0,1,1,0,0,1,0,1,0,1,1,0,1,0,1];
  const cp1 = 5, cp2 = 2, pp1 = 14, pp2 = 8, mp = 22;
  const { cBits, pBits } = encryptWithMotor(plain, [chi1, chi2], [cp1, cp2], [psi1, psi2], [pp1, pp2], mu, mp);
  return {
    title: 'LEVEL 9: MOTOR WHEEL', briefing: 'Motor wheel controls psi stepping. Find all 5 positions.',
    mode: 'multiWheel', plaintext: plain, cipherBits: cBits, plainBits: pBits,
    keyBitsForTrainer: [], showKeyTape: false,
    exposedKeyStream: [], patternLength: 0, correctPattern: [],
    wheelPatterns: [chi1, chi2, psi1, psi2, mu],
    wheelLabels: ['\u03C7\u2081', '\u03C7\u2082', '\u03C8\u2081', '\u03C8\u2082', '\u03BC'],
    correctWheelPositions: [cp1, cp2, pp1, pp2, mp], anchorIndices: computeAnchors(plain.length),
  };
}

function level10(): LZMission {
  const plain = 'BLETCHLEY PARK';
  const chi1: number[] = [1,0,1,1,0,0,1,0,1,0,0,1,0,1,1,0,0,1,0,1,0,1,1,0,0,1,0,1,0,1,0,1,1,0,1,0,0,1,0,1,1];
  const chi2: number[] = [0,1,0,0,1,1,0,1,0,1,1,0,1,0,0,1,0,1,0,0,1,1,0,1,0,1,1,0,1,0,1];
  const chi3: number[] = [1,1,0,1,0,0,1,1,0,0,1,0,1,0,0,1,1,0,1,0,0,1,0,1,0,0,1,0,1];
  const psi1: number[] = [1,0,0,1,1,0,1,0,1,0,0,1,0,1,1,0,0,1,0,1,0,1,1,0,1,0,0,1,0,1,1,0,1,0,1,0,0,1,1,0,1,0,1];
  const psi2: number[] = [0,1,1,0,0,1,0,1,0,0,1,1,0,1,0,1,1,0,0,1,0,1,0,1,1,0,1,0,0,1,0,1,1,0,0,1,0,1,0,1,1,0,1,0,1,0,1];
  const mu: number[] = [1,0,1,1,0,0,1,0,0,1,0,1,1,0,1,0,0,1,1,0,1,0,0,1,1,0,0,1,0,1,0,1,1,0,1,0,1,0,0,1,1,0,0,1,0,1,0,1,1,0,1,0,1,0,0,1,1,0,1];
  const cp1 = 17, cp2 = 9, cp3 = 14, pp1 = 28, pp2 = 33, mp2 = 41;
  const { cBits, pBits } = encryptWithMotor(plain, [chi1, chi2, chi3], [cp1, cp2, cp3], [psi1, psi2], [pp1, pp2], mu, mp2);
  return {
    title: 'LEVEL 10: COLOSSUS', briefing: 'Full Lorenz SZ40 with 6 wheels. The ultimate challenge.',
    mode: 'fullMachine', plaintext: plain, cipherBits: cBits, plainBits: pBits,
    keyBitsForTrainer: [], showKeyTape: false,
    exposedKeyStream: [], patternLength: 0, correctPattern: [],
    wheelPatterns: [chi1, chi2, chi3, psi1, psi2, mu],
    wheelLabels: ['\u03C7\u2081', '\u03C7\u2082', '\u03C7\u2083', '\u03C8\u2081', '\u03C8\u2082', '\u03BC'],
    correctWheelPositions: [cp1, cp2, cp3, pp1, pp2, mp2], anchorIndices: computeAnchors(plain.length),
  };
}

/* ═══════════════════════════════════════════════════════════════════ */
/* Colors (Codebreakers palette, matches iOS)                        */
/* ═══════════════════════════════════════════════════════════════════ */

const C_BG_DARK    = '#0A1210';
const C_MATRIX     = '#2ECC71';
const C_TERM_GREEN = '#00FF41';
const C_AMBER      = '#E8A040';
const C_BRASS      = '#B5A642';
const C_COPPER     = '#B87333';
const C_ERROR      = '#FF4040';
const C_CREAM      = '#E8F5E9';
const C_DARK_PANEL = '#141E1A';
const C_STEEL      = '#4A5859';
const C_TAPE_YELLOW = '#F5E6B8';
const C_PUNCH_HOLE = '#1A2E22';

/* ═══════════════════════════════════════════════════════════════════ */
/* Puzzle class                                                      */
/* ═══════════════════════════════════════════════════════════════════ */

export class LorenzPuzzle extends Puzzle {
  readonly title = 'LORENZ SZ40/42';
  readonly subtitle = 'tunny at bletchley';
  readonly instructions =
    'Break the Lorenz cipher used by the German High Command. Progress through 10 levels from XOR basics to the full Colossus machine.';

  private level = 1;
  private mission!: LZMission;
  private phase: 'playing' | 'decrypting' | 'won' = 'playing';
  private attempts = 0;

  // XOR trainer state
  private playerBits: number[] = [];
  // Pattern finder state
  private patternGuess: number[] = [];
  // Wheel positions state
  private wheelPositions: number[] = [];
  private activeWheel = 0;
  // Decryption reveal
  private revealedCount = 0;

  // Feedback
  private feedbackText = '';
  private feedbackColor = '';

  // DOM
  private root: HTMLDivElement | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private panelEl: HTMLDivElement | null = null;

  onSolved?: () => void;

  init(): void {
    this.buildBackdrop();
    this.mission = missionForLevel(this.level);
    this.setupMission();
    this.buildDom();
  }

  /* ═══════════════════════════════════════════════════════════════ */
  /* 3D Backdrop                                                    */
  /* ═══════════════════════════════════════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color(C_BG_DARK), roughness: 0.65, metalness: 0.2, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color(C_MATRIX), emissive: new Color('#0a2016'),
        emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.95, side: DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.37;
    this.group.add(ring);

    const lamp = new PointLight(C_MATRIX, 2.2, 24, 1.6);
    lamp.position.set(0, 6, 4);
    this.group.add(lamp);
  }

  /* ═══════════════════════════════════════════════════════════════ */
  /* Mission Setup                                                  */
  /* ═══════════════════════════════════════════════════════════════ */

  private setupMission(): void {
    this.phase = 'playing';
    this.feedbackText = '';
    this.feedbackColor = '';
    this.activeWheel = 0;
    this.attempts = 0;
    this.revealedCount = 0;

    const m = this.mission;
    this.wheelPositions = Array(m.wheelPatterns.length).fill(0);
    this.playerBits = Array(m.cipherBits.length * 5).fill(0);
    this.patternGuess = Array(m.patternLength).fill(0);
  }

  /* ═══════════════════════════════════════════════════════════════ */
  /* DOM Construction                                               */
  /* ═══════════════════════════════════════════════════════════════ */

  private buildDom(): void {
    const root = document.createElement('div');
    root.id = 'puzzle-lorenz';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'JetBrains Mono', monospace",
    });
    this.root = root;

    // Inject scanline CSS + animations
    if (!document.getElementById('lorenz-anims')) {
      const style = document.createElement('style');
      style.id = 'lorenz-anims';
      style.textContent = `
        @keyframes lorenz-pop { from { transform: scale(0.92); opacity:0; } to { transform: scale(1); opacity:1; } }
        @keyframes lorenz-scanline { from { top: 0%; } to { top: 100%; } }
        #puzzle-lorenz .lz-scanline {
          position: absolute; left:0; right:0; height:2px;
          background: ${C_MATRIX}10; pointer-events:none;
          animation: lorenz-scanline 4s linear infinite;
        }
      `;
      document.head.appendChild(style);
    }

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: 'rgba(10,18,16,0.94)', backdropFilter: 'blur(12px)',
      border: `1px solid ${C_MATRIX}40`, borderTop: `3px solid ${C_MATRIX}`,
      borderRadius: '10px', boxShadow: `0 18px 60px rgba(0,0,0,0.65)`,
      color: C_CREAM, maxHeight: '96vh', overflowY: 'auto', position: 'relative',
      animation: 'lorenz-pop 0.25s ease-out',
    });
    // Scanline
    const scanline = document.createElement('div');
    scanline.className = 'lz-scanline';
    panel.appendChild(scanline);

    this.panelEl = panel;
    root.appendChild(panel);

    // Overlay container
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    document.body.appendChild(root);
    this.renderPanel();
  }

  /* ═══════════════════════════════════════════════════════════════ */
  /* Panel Rendering                                                */
  /* ═══════════════════════════════════════════════════════════════ */

  private renderPanel(): void {
    if (!this.panelEl) return;
    // Keep the scanline element
    const scanline = this.panelEl.querySelector('.lz-scanline');
    this.panelEl.innerHTML = '';
    if (scanline) this.panelEl.appendChild(scanline);

    const m = this.mission;

    // Header
    this.el('div', this.panelEl, {
      fontSize: '11px', letterSpacing: '0.3em', color: C_AMBER, fontWeight: '700',
      fontFamily: "'JetBrains Mono', monospace",
    }, 'LORENZ SZ40/42');

    // Mission briefing
    const brief = this.el('div', this.panelEl, {
      padding: '10px 16px', background: C_DARK_PANEL,
      border: `1px solid ${C_MATRIX}33`, borderRadius: '8px',
      textAlign: 'center', maxWidth: '380px',
    });
    this.el('div', brief, {
      fontSize: '13px', fontWeight: '700', color: C_MATRIX,
      fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em',
    }, m.title);
    this.el('div', brief, {
      fontSize: '11px', color: `${C_CREAM}b3`, marginTop: '4px', lineHeight: '1.5',
      fontFamily: "'JetBrains Mono', monospace",
    }, m.briefing);

    // Tape display
    if (m.mode !== 'xorTrainer') {
      this.renderTapeSection();
    }

    // Mode-specific section
    if (m.mode === 'xorTrainer') {
      this.renderXORTrainer();
    } else if (m.mode === 'patternFind') {
      this.renderPatternFinder();
    } else {
      this.renderWheelControls();
    }

    // Control panel (Reset + Submit)
    this.renderControlPanel();

    // Feedback
    if (this.feedbackText) {
      this.el('div', this.panelEl, {
        fontSize: '11px', color: this.feedbackColor, padding: '6px 14px',
        background: `${this.feedbackColor}18`, border: `1px solid ${this.feedbackColor}4d`,
        borderRadius: '6px', fontFamily: "'JetBrains Mono', monospace",
      }, this.feedbackText);
    }
  }

  /* ── Tape display ──────────────────────────────────────────────── */

  private renderTapeSection(): void {
    if (!this.panelEl) return;
    const m = this.mission;

    const tapeWrap = this.el('div', this.panelEl, {
      padding: '10px', background: 'rgba(0,0,0,0.4)',
      border: `1px solid ${C_STEEL}4d`, borderRadius: '10px', width: '100%', maxWidth: '380px',
    });

    // Cipher tape
    this.renderTapeStrip(tapeWrap, 'CIPHER TAPE', m.cipherBits, C_ERROR, true);

    // Key tape (if visible)
    if (m.showKeyTape && m.keyBitsForTrainer.length > 0) {
      this.renderTapeStrip(tapeWrap, 'KEY TAPE', m.keyBitsForTrainer, C_AMBER, true);
    }

    // Plain tape (revealed)
    const plainDisplay = this.getPlainBitsDisplay();
    this.renderTapeStrip(tapeWrap, 'PLAIN TAPE', plainDisplay, C_MATRIX, false);

    // Anchor reference for wheel modes
    if (['wheelSet', 'multiWheel', 'fullMachine'].includes(m.mode) && m.anchorIndices.length > 0) {
      const anchorRow = this.el('div', tapeWrap, {
        display: 'flex', justifyContent: 'center', gap: '1px', marginTop: '4px',
      });
      const anchors = new Set(m.anchorIndices);
      for (let i = 0; i < m.plaintext.length; i++) {
        this.el('span', anchorRow, {
          fontSize: '13px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace",
          color: anchors.has(i) ? `${C_CREAM}d9` : `${C_STEEL}4d`,
        }, anchors.has(i) ? m.plaintext[i] : '\u00B7');
      }
    }

    // Decoded text
    const decodedRow = this.el('div', tapeWrap, {
      display: 'flex', justifyContent: 'center', gap: '1px', marginTop: '6px',
    });
    const isWheelMode = ['wheelSet', 'multiWheel', 'fullMachine'].includes(m.mode);
    if (isWheelMode && this.phase === 'playing') {
      const liveText = this.getLiveDecryptText();
      for (let i = 0; i < liveText.length; i++) {
        this.el('span', decodedRow, {
          fontSize: '14px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace",
          color: `${C_AMBER}cc`,
        }, liveText[i]);
      }
    } else {
      for (let i = 0; i < m.plaintext.length; i++) {
        this.el('span', decodedRow, {
          fontSize: '14px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace",
          color: i < this.revealedCount ? C_MATRIX : `${C_STEEL}66`,
        }, i < this.revealedCount ? m.plaintext[i] : '\u2022');
      }
    }
  }

  private renderTapeStrip(parent: HTMLElement, label: string, bits: number[][], color: string, showPunch: boolean): void {
    const wrap = this.el('div', parent, { marginBottom: '8px' });
    this.el('div', wrap, {
      fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em',
      color: `${color}99`, fontFamily: "'JetBrains Mono', monospace",
    }, label);

    const strip = this.el('div', wrap, {
      display: 'flex', gap: '3px', overflowX: 'auto', paddingTop: '4px', maxWidth: '360px',
    });

    for (let ci = 0; ci < bits.length; ci++) {
      const col = this.el('div', strip, {
        display: 'flex', flexDirection: 'column', gap: '1px', padding: '2px',
        background: showPunch ? `${C_TAPE_YELLOW}14` : `${C_TAPE_YELLOW}08`,
        borderRadius: '2px',
      });
      for (let bi = 0; bi < 5; bi++) {
        const bit = bi < bits[ci].length ? bits[ci][bi] : 0;
        const cell = this.el('div', col, {
          width: '14px', height: '14px', borderRadius: '2px', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: bit === 1 ? `${color}e6` : (showPunch ? C_PUNCH_HOLE : 'transparent'),
          fontSize: '8px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace",
          color: bit === 1 ? C_BG_DARK : `${C_STEEL}80`,
        });
        if (showPunch && bit === 1) {
          this.el('div', cell, {
            width: '8px', height: '8px', borderRadius: '50%',
            background: `${color}4d`,
          });
        }
      }
    }
  }

  /* ── XOR Trainer ───────────────────────────────────────────────── */

  private renderXORTrainer(): void {
    if (!this.panelEl) return;
    const m = this.mission;

    const section = this.el('div', this.panelEl, {
      padding: '10px', background: C_DARK_PANEL,
      border: `1px solid ${C_MATRIX}26`, borderRadius: '8px', maxWidth: '380px', width: '100%',
    });

    this.el('div', section, {
      fontSize: '11px', color: `${C_CREAM}b3`, textAlign: 'center', marginBottom: '8px',
      fontFamily: "'JetBrains Mono', monospace",
    }, 'Compute cipher \u2295 key for each bit column');

    const cols = m.cipherBits.length;
    const grid = this.el('div', section, {
      display: 'flex', gap: cols <= 6 ? '6px' : '4px', justifyContent: 'center', alignItems: 'flex-start',
    });

    for (let ci = 0; ci < cols; ci++) {
      const colEl = this.el('div', grid, {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
      });

      // Cipher bits column
      this.renderBitColumn(colEl, m.cipherBits[ci], C_ERROR);

      // XOR symbol
      this.el('div', colEl, {
        fontSize: '13px', fontWeight: '700', color: `${C_MATRIX}4d`,
        fontFamily: "'JetBrains Mono', monospace",
      }, '\u2295');

      // Key bits column
      this.renderBitColumn(colEl, m.keyBitsForTrainer[ci], C_AMBER);

      // Divider
      this.el('div', colEl, { width: '18px', height: '1px', background: `${C_MATRIX}66` });

      // Player answer column (interactive)
      for (let bi = 0; bi < 5; bi++) {
        const idx = ci * 5 + bi;
        const val = idx < this.playerBits.length ? this.playerBits[idx] : 0;
        const btn = this.el('button', colEl, {
          width: '18px', height: '14px', borderRadius: '2px', border: `0.5px solid ${C_MATRIX}4d`,
          background: val === 1 ? C_MATRIX : C_DARK_PANEL, cursor: 'pointer',
          fontSize: '8px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace",
          color: val === 1 ? C_BG_DARK : `${C_STEEL}80`, padding: '0',
        }) as HTMLButtonElement;
        btn.type = 'button';
        btn.textContent = String(val);
        btn.addEventListener('click', () => this.togglePlayerBit(ci, bi));
      }
    }
  }

  private renderBitColumn(parent: HTMLElement, bits: number[], color: string): void {
    for (let bi = 0; bi < 5; bi++) {
      const val = bi < bits.length ? bits[bi] : 0;
      this.el('div', parent, {
        width: '18px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '8px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace",
        color: val === 1 ? color : `${C_CREAM}59`,
      }, String(val));
    }
  }

  /* ── Pattern Finder ────────────────────────────────────────────── */

  private renderPatternFinder(): void {
    if (!this.panelEl) return;
    const m = this.mission;

    const section = this.el('div', this.panelEl, {
      padding: '10px', background: C_DARK_PANEL,
      border: `1px solid ${C_BRASS}33`, borderRadius: '8px', maxWidth: '380px', width: '100%',
    });

    this.el('div', section, {
      fontSize: '11px', color: `${C_CREAM}b3`, textAlign: 'center', marginBottom: '8px',
      fontFamily: "'JetBrains Mono', monospace",
    }, 'Find the repeating wheel pattern in the key stream');

    // Key stream display
    const streamRow = this.el('div', section, {
      display: 'flex', gap: '3px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '10px',
    });
    for (let i = 0; i < m.exposedKeyStream.length; i++) {
      const bit = m.exposedKeyStream[i];
      const cell = this.el('div', streamRow, {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
      });
      this.el('div', cell, {
        fontSize: '7px', color: `${C_STEEL}80`, fontFamily: "'JetBrains Mono', monospace",
      }, String(i + 1));
      this.el('div', cell, {
        width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace",
        color: bit === 1 ? C_AMBER : `${C_STEEL}66`,
        background: bit === 1 ? `${C_AMBER}26` : C_DARK_PANEL,
        borderRadius: '3px',
      }, String(bit));
    }

    // Pattern input
    this.el('div', section, {
      fontSize: '10px', fontWeight: '700', color: C_BRASS, textAlign: 'center', marginBottom: '4px',
      fontFamily: "'JetBrains Mono', monospace",
    }, `WHEEL PERIOD: ${m.patternLength}`);

    const patRow = this.el('div', section, {
      display: 'flex', gap: '4px', justifyContent: 'center',
    });
    for (let pi = 0; pi < m.patternLength; pi++) {
      const val = pi < this.patternGuess.length ? this.patternGuess[pi] : 0;
      const btnWrap = this.el('div', patRow, {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
      });
      this.el('div', btnWrap, {
        fontSize: '7px', color: `${C_STEEL}80`, fontFamily: "'JetBrains Mono', monospace",
      }, String(pi + 1));
      const btn = this.el('button', btnWrap, {
        width: '24px', height: '24px', borderRadius: '4px', cursor: 'pointer', padding: '0',
        border: `1px solid ${C_MATRIX}66`,
        background: val === 1 ? `${C_MATRIX}33` : C_DARK_PANEL,
        fontSize: '14px', fontWeight: '900', fontFamily: "'JetBrains Mono', monospace",
        color: val === 1 ? C_MATRIX : C_STEEL,
      }) as HTMLButtonElement;
      btn.type = 'button';
      btn.textContent = String(val);
      btn.addEventListener('click', () => this.togglePatternBit(pi));
    }
  }

  /* ── Wheel Controls ────────────────────────────────────────────── */

  private renderWheelControls(): void {
    if (!this.panelEl) return;
    const m = this.mission;

    const section = this.el('div', this.panelEl, {
      padding: '10px', background: C_DARK_PANEL,
      border: `1px solid ${C_COPPER}4d`, borderRadius: '8px', maxWidth: '400px', width: '100%',
    });

    this.el('div', section, {
      fontSize: '11px', fontWeight: '700', color: C_BRASS, textAlign: 'center', marginBottom: '8px',
      fontFamily: "'JetBrains Mono', monospace",
    }, 'SET WHEEL POSITIONS');

    const wheelCount = m.wheelPatterns.length;
    const perRow = wheelCount <= 5 ? wheelCount : Math.ceil(wheelCount / 2);

    const renderRow = (start: number, end: number) => {
      const row = this.el('div', section, {
        display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '8px',
      });
      for (let wi = start; wi < end; wi++) {
        this.renderWheelDial(row, wi);
      }
    };

    renderRow(0, Math.min(perRow, wheelCount));
    if (wheelCount > perRow) {
      renderRow(perRow, wheelCount);
    }
  }

  private renderWheelDial(parent: HTMLElement, wi: number): void {
    const m = this.mission;
    const pattern = m.wheelPatterns[wi];
    const pos = wi < this.wheelPositions.length ? this.wheelPositions[wi] : 0;
    const isActive = wi === this.activeWheel && this.phase === 'playing';

    const dialWrap = this.el('div', parent, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
    });

    // Label
    this.el('div', dialWrap, {
      fontSize: '8px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace",
      color: isActive ? C_MATRIX : C_STEEL,
    }, m.wheelLabels[wi]);

    // Wheel ring (canvas)
    const cvs = document.createElement('canvas');
    cvs.width = 100; cvs.height = 100;
    Object.assign(cvs.style, { width: '50px', height: '50px', cursor: 'pointer' });
    cvs.addEventListener('click', () => {
      if (this.phase === 'playing') { this.activeWheel = wi; this.renderPanel(); }
    });
    dialWrap.appendChild(cvs);

    const ctx = cvs.getContext('2d')!;
    ctx.scale(2, 2);
    const cx = 25, cy = 25, r = 22;

    // Ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = isActive ? `${C_MATRIX}66` : `${C_STEEL}33`;
    ctx.lineWidth = isActive ? 2 : 1.5;
    ctx.stroke();

    // Active glow
    if (isActive) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = `${C_MATRIX}4d`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Tooth marks
    for (let ti = 0; ti < pattern.length; ti++) {
      const angle = (ti / pattern.length) * Math.PI * 2 - Math.PI / 2;
      const bit = pattern[(ti + pos) % pattern.length];
      const tx = cx + Math.cos(angle) * (r - 3);
      const ty = cy + Math.sin(angle) * (r - 3);
      ctx.beginPath();
      ctx.arc(tx, ty, 2, 0, Math.PI * 2);
      ctx.fillStyle = bit === 1 ? C_AMBER : `${C_STEEL}33`;
      ctx.fill();
    }

    // Center position display
    ctx.fillStyle = isActive ? C_MATRIX : `${C_CREAM}99`;
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(pos), cx, cy);

    // +/- buttons
    const btnRow = this.el('div', dialWrap, { display: 'flex', gap: '8px' });
    for (const delta of [-1, 1]) {
      const btn = this.el('button', btnRow, {
        width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer', padding: '0',
        background: `${C_STEEL}4d`, border: 'none',
        fontSize: '10px', fontWeight: '700', color: `${C_CREAM}b3`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }) as HTMLButtonElement;
      btn.type = 'button';
      btn.textContent = delta < 0 ? '\u2212' : '+';
      btn.addEventListener('click', () => this.adjustWheel(wi, delta));
    }

    // Period label
    this.el('div', dialWrap, {
      fontSize: '8px', color: `${C_STEEL}80`, fontFamily: "'JetBrains Mono', monospace",
    }, `/ ${pattern.length}`);
  }

  /* ── Control Panel ─────────────────────────────────────────────── */

  private renderControlPanel(): void {
    if (!this.panelEl) return;
    const controls = this.el('div', this.panelEl, {
      display: 'flex', gap: '16px', marginTop: '4px',
    });

    // Reset
    const resetBtn = this.el('button', controls, {
      padding: '8px 14px', background: C_DARK_PANEL,
      border: `1px solid ${C_STEEL}4d`, borderRadius: '6px', cursor: 'pointer',
      fontSize: '12px', fontWeight: '500', fontFamily: "'JetBrains Mono', monospace",
      color: C_STEEL, display: 'flex', alignItems: 'center', gap: '4px',
    }) as HTMLButtonElement;
    resetBtn.type = 'button';
    resetBtn.textContent = '\u21BA RESET';
    resetBtn.addEventListener('click', () => this.resetMission());

    // Submit / Decrypt
    const submitBtn = this.el('button', controls, {
      padding: '10px 18px', background: C_MATRIX,
      border: 'none', borderRadius: '6px', cursor: 'pointer',
      fontSize: '13px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace",
      color: C_BG_DARK, display: 'flex', alignItems: 'center', gap: '4px',
      opacity: this.phase === 'playing' ? '1' : '0.5',
    }) as HTMLButtonElement;
    submitBtn.type = 'button';
    submitBtn.textContent = '\u26A1 DECRYPT';
    submitBtn.disabled = this.phase !== 'playing';
    submitBtn.addEventListener('click', () => this.submitAnswer());
  }

  /* ═══════════════════════════════════════════════════════════════ */
  /* Live Decrypt (for wheel modes)                                 */
  /* ═══════════════════════════════════════════════════════════════ */

  private getPlainBitsDisplay(): number[][] {
    const m = this.mission;
    const isWheelMode = ['wheelSet', 'multiWheel', 'fullMachine'].includes(m.mode);
    if (isWheelMode && this.phase === 'playing' && this.wheelPositions.length > 0) {
      return this.computeLiveDecrypt().bits;
    }
    return m.plainBits.map((bits, i) => i < this.revealedCount ? bits : [0, 0, 0, 0, 0]);
  }

  private getLiveDecryptText(): string {
    return this.computeLiveDecrypt().text;
  }

  private computeLiveDecrypt(): { bits: number[][]; text: string } {
    const m = this.mission;
    const cBits = m.cipherBits;
    const charCount = cBits.length;
    if (m.wheelPatterns.length === 0) return { bits: cBits, text: '' };

    const hasMotor = m.wheelLabels.includes('\u03BC');
    const plainBits: number[][] = [];
    let plainText = '';

    if (hasMotor) {
      const chiIndices: number[] = [];
      const psiIndices: number[] = [];
      let motorIdx = 0;
      for (let i = 0; i < m.wheelLabels.length; i++) {
        if (m.wheelLabels[i].startsWith('\u03C7')) chiIndices.push(i);
        else if (m.wheelLabels[i].startsWith('\u03C8')) psiIndices.push(i);
        else if (m.wheelLabels[i] === '\u03BC') motorIdx = i;
      }

      const psiOffsets = psiIndices.map(i => this.wheelPositions[i] ?? 0);
      let mPos = this.wheelPositions[motorIdx] ?? 0;
      const motorW = m.wheelPatterns[motorIdx];

      for (let i = 0; i < charCount; i++) {
        const kb = [0, 1, 2, 3, 4].map(bi => {
          const pos = i * 5 + bi;
          let bit = 0;
          for (const wi of chiIndices) {
            const w = m.wheelPatterns[wi];
            const p = this.wheelPositions[wi] ?? 0;
            bit ^= w[(p + pos) % w.length];
          }
          for (let pi = 0; pi < psiIndices.length; pi++) {
            const w = m.wheelPatterns[psiIndices[pi]];
            bit ^= w[psiOffsets[pi] % w.length];
          }
          return bit;
        });
        if (motorW[mPos % motorW.length] === 1) {
          for (let pi = 0; pi < psiOffsets.length; pi++) {
            psiOffsets[pi] = (psiOffsets[pi] + 1) % m.wheelPatterns[psiIndices[pi]].length;
          }
        }
        mPos = (mPos + 1) % motorW.length;
        const pb = xorBits(cBits[i], kb);
        plainBits.push(pb);
        plainText += bitsToChar(pb);
      }
    } else {
      for (let i = 0; i < charCount; i++) {
        const kb = [0, 1, 2, 3, 4].map(bi => {
          const pos = i * 5 + bi;
          let bit = 0;
          for (let wi = 0; wi < m.wheelPatterns.length; wi++) {
            const w = m.wheelPatterns[wi];
            const p = this.wheelPositions[wi] ?? 0;
            bit ^= w[(p + pos) % w.length];
          }
          return bit;
        });
        const pb = xorBits(cBits[i], kb);
        plainBits.push(pb);
        plainText += bitsToChar(pb);
      }
    }

    return { bits: plainBits, text: plainText };
  }

  /* ═══════════════════════════════════════════════════════════════ */
  /* Actions                                                        */
  /* ═══════════════════════════════════════════════════════════════ */

  private togglePlayerBit(ci: number, bi: number): void {
    if (this.phase !== 'playing') return;
    const idx = ci * 5 + bi;
    if (idx >= this.playerBits.length) return;
    this.playerBits[idx] = this.playerBits[idx] === 0 ? 1 : 0;
    this.renderPanel();
  }

  private togglePatternBit(pi: number): void {
    if (this.phase !== 'playing' || pi >= this.patternGuess.length) return;
    this.patternGuess[pi] = this.patternGuess[pi] === 0 ? 1 : 0;
    this.renderPanel();
  }

  private adjustWheel(wi: number, delta: number): void {
    if (this.phase !== 'playing' || wi >= this.wheelPositions.length) return;
    const pattern = this.mission.wheelPatterns[wi];
    this.wheelPositions[wi] = (this.wheelPositions[wi] + delta + pattern.length) % pattern.length;
    this.renderPanel();
  }

  private resetMission(): void {
    this.setupMission();
    this.renderPanel();
  }

  private submitAnswer(): void {
    if (this.phase !== 'playing') return;
    this.attempts++;

    let correct = false;
    const m = this.mission;

    switch (m.mode) {
      case 'xorTrainer': {
        correct = true;
        for (let ci = 0; ci < m.plainBits.length && correct; ci++) {
          for (let bi = 0; bi < 5; bi++) {
            const idx = ci * 5 + bi;
            const exp = bi < m.plainBits[ci].length ? m.plainBits[ci][bi] : 0;
            const got = idx < this.playerBits.length ? this.playerBits[idx] : 0;
            if (exp !== got) { correct = false; break; }
          }
        }
        break;
      }
      case 'patternFind':
        correct = this.arraysEqual(this.patternGuess, m.correctPattern);
        break;
      case 'wheelSet':
      case 'multiWheel':
      case 'fullMachine':
        correct = this.arraysEqual(this.wheelPositions, m.correctWheelPositions);
        break;
    }

    if (correct) {
      this.phase = 'decrypting';
      this.animateDecryption();
    } else {
      this.feedbackText = 'Incorrect. The cipher holds its secrets.';
      this.feedbackColor = C_ERROR;
      this.renderPanel();
      setTimeout(() => {
        if (this.feedbackColor === C_ERROR) {
          this.feedbackText = '';
          this.renderPanel();
        }
      }, 2000);
    }
  }

  private animateDecryption(): void {
    const total = this.mission.plaintext.length;
    for (let i = 0; i < total; i++) {
      setTimeout(() => {
        this.revealedCount = i + 1;
        this.renderPanel();
      }, i * 120);
    }
    setTimeout(() => {
      this.phase = 'won';
      this.showResultOverlay();
    }, total * 120 + 500);
  }

  private showResultOverlay(): void {
    if (!this.overlayEl) return;
    this.overlayEl.style.display = 'flex';
    this.overlayEl.innerHTML = '';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '320px', width: '90%', padding: '24px', textAlign: 'center',
      background: `linear-gradient(to bottom, ${C_BG_DARK}f2, ${C_DARK_PANEL}f0)`,
      border: `2px solid ${C_MATRIX}66`, borderRadius: '16px',
      fontFamily: "'Rajdhani', 'JetBrains Mono', monospace",
      animation: 'lorenz-pop 0.25s ease-out',
    });

    // Victory badge (antenna)
    const badge = document.createElement('canvas');
    badge.width = 112; badge.height = 112;
    Object.assign(badge.style, { width: '56px', height: '56px', margin: '0 auto 12px', display: 'block' });
    const bc = badge.getContext('2d')!;
    bc.scale(2, 2);
    const bx = 28, by = 28;
    // Mast
    bc.beginPath(); bc.moveTo(bx, by + 16); bc.lineTo(bx, by - 12);
    bc.strokeStyle = C_TERM_GREEN; bc.lineWidth = 2.5; bc.lineCap = 'round'; bc.stroke();
    // Radio waves
    for (let i = 1; i <= 3; i++) {
      const r2 = i * 7;
      bc.beginPath();
      bc.arc(bx, by - 10, r2, (210 * Math.PI) / 180, (270 * Math.PI) / 180);
      bc.strokeStyle = C_TERM_GREEN; bc.globalAlpha = 1.0 - i * 0.25; bc.lineWidth = 1.5; bc.stroke();
      bc.beginPath();
      bc.arc(bx, by - 10, r2, (270 * Math.PI) / 180, (330 * Math.PI) / 180);
      bc.stroke();
      bc.globalAlpha = 1.0;
    }
    // Tip dot
    bc.beginPath(); bc.arc(bx, by - 15, 3, 0, Math.PI * 2);
    bc.fillStyle = C_TERM_GREEN; bc.fill();
    card.appendChild(badge);

    this.el('div', card, {
      fontSize: '20px', fontWeight: '900', color: C_MATRIX, marginBottom: '8px',
      fontFamily: "'JetBrains Mono', monospace",
    }, 'CIPHER BROKEN');

    this.el('div', card, {
      fontSize: '12px', color: `${C_CREAM}b3`, marginBottom: '12px',
      fontFamily: "'JetBrains Mono', monospace",
    }, 'The transmission has been decrypted.');

    // Show plaintext
    this.el('div', card, {
      fontSize: '16px', fontWeight: '700', color: C_TERM_GREEN, padding: '8px',
      background: 'rgba(0,0,0,0.5)', borderRadius: '4px', marginBottom: '16px',
      fontFamily: "'JetBrains Mono', monospace",
    }, this.mission.plaintext);

    // Continue button
    const continueBtn = this.el('button', card, {
      padding: '10px 24px', background: `${C_MATRIX}1f`,
      border: `1.5px solid ${C_MATRIX}80`, borderRadius: '20px', cursor: 'pointer',
      fontSize: '14px', fontWeight: '700', fontFamily: "'JetBrains Mono', monospace",
      color: C_MATRIX,
    }) as HTMLButtonElement;
    continueBtn.type = 'button';
    continueBtn.textContent = this.level < 10 ? 'NEXT LEVEL' : 'COMPLETE';
    continueBtn.addEventListener('click', () => this.advanceOrComplete());

    this.overlayEl.appendChild(card);
  }

  private advanceOrComplete(): void {
    if (this.overlayEl) this.overlayEl.style.display = 'none';
    if (this.level >= 10) {
      this.isSolved = true;
      this.onSolved?.();
    } else {
      this.level++;
      this.mission = missionForLevel(this.level);
      this.setupMission();
      this.renderPanel();
    }
  }

  /* ═══════════════════════════════════════════════════════════════ */
  /* Utility                                                        */
  /* ═══════════════════════════════════════════════════════════════ */

  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return false; }
    return true;
  }

  /** Helper: create + append a styled element */
  private el(tag: string, parent: HTMLElement, style: Partial<CSSStyleDeclaration>, text?: string): HTMLElement {
    const e = document.createElement(tag);
    Object.assign(e.style, style);
    if (text !== undefined) e.textContent = text;
    parent.appendChild(e);
    return e;
  }

  /* ═══════════════════════════════════════════════════════════════ */
  /* Lifecycle                                                      */
  /* ═══════════════════════════════════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('lorenz-anims');
    if (animStyle) animStyle.remove();
    this.panelEl = null;
    this.overlayEl = null;
    super.dispose();
  }
}
