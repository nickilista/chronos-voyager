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
 * Four-Color Map — Guthrie's Four Color Theorem (1852).
 * Color map regions so no adjacent regions share a color.
 * Five difficulty levels (9 to 24 regions).
 * Aligned with iOS FourColorView.swift.
 */

/* ── Region & Map models ─────────────────────────────────────── */

interface FCRegion {
  readonly id: number;
  readonly label: string;
  readonly vertices: ReadonlyArray<[number, number]>; // normalized polygon
  readonly center: [number, number];
  readonly labelSize: number;
}

interface FCMap {
  readonly regions: readonly FCRegion[];
  readonly adjacencies: ReadonlyArray<[number, number]>;
  readonly prefilled: Record<number, number>; // regionID → colorIndex
  readonly hint: string;
}

/* ── Revolution palette ──────────────────────────────────────── */

const C_MAROON = '#4A1942';
const C_CREAM = '#F5E6D3';
const C_PURPLE = '#9B59B6';
const C_DARK_BG = '#0F0A14';
const C_COPPER = '#B87333';
const C_GAS_YELLOW = '#F0D060';
const C_RAIL_RED = '#C0392B';

// Map coloring palette (4 Victorian ink/dye colors)
const MAP_COLORS = ['#C0392B', '#2980B9', '#27AE60', '#F39C12'] as const;

/* ── Map data (5 levels, matches iOS) ────────────────────────── */

function buildLevel1(): FCMap {
  const regions: FCRegion[] = [
    { id: 0, label: 'A', vertices: [[0.02,0.02],[0.35,0.02],[0.3,0.3],[0.02,0.25]], center: [0.17,0.15], labelSize: 12 },
    { id: 1, label: 'B', vertices: [[0.35,0.02],[0.65,0.02],[0.6,0.25],[0.3,0.3]], center: [0.48,0.14], labelSize: 12 },
    { id: 2, label: 'C', vertices: [[0.65,0.02],[0.98,0.02],[0.98,0.3],[0.6,0.25]], center: [0.80,0.14], labelSize: 12 },
    { id: 3, label: 'D', vertices: [[0.02,0.25],[0.3,0.3],[0.25,0.6],[0.02,0.55]], center: [0.15,0.42], labelSize: 12 },
    { id: 4, label: 'E', vertices: [[0.3,0.3],[0.6,0.25],[0.65,0.55],[0.25,0.6]], center: [0.45,0.42], labelSize: 12 },
    { id: 5, label: 'F', vertices: [[0.6,0.25],[0.98,0.3],[0.98,0.6],[0.65,0.55]], center: [0.80,0.42], labelSize: 12 },
    { id: 6, label: 'G', vertices: [[0.02,0.55],[0.25,0.6],[0.3,0.98],[0.02,0.98]], center: [0.15,0.78], labelSize: 12 },
    { id: 7, label: 'H', vertices: [[0.25,0.6],[0.65,0.55],[0.7,0.98],[0.3,0.98]], center: [0.48,0.78], labelSize: 12 },
    { id: 8, label: 'I', vertices: [[0.65,0.55],[0.98,0.6],[0.98,0.98],[0.7,0.98]], center: [0.82,0.78], labelSize: 12 },
  ];
  const adjacencies: [number, number][] = [[0,1],[0,3],[1,2],[1,4],[2,5],[3,4],[3,6],[4,5],[4,7],[5,8],[6,7],[7,8]];
  return { regions, adjacencies, prefilled: { 0: 0 }, hint: 'Start from the pre-colored region and work outward.' };
}

function buildLevel2(): FCMap {
  const regions: FCRegion[] = [
    { id: 0, label: 'I', vertices: [[0.02,0.02],[0.25,0.02],[0.22,0.22],[0.02,0.18]], center: [0.13,0.11], labelSize: 10 },
    { id: 1, label: 'II', vertices: [[0.25,0.02],[0.5,0.02],[0.48,0.2],[0.26,0.24],[0.22,0.22]], center: [0.36,0.11], labelSize: 10 },
    { id: 2, label: 'III', vertices: [[0.5,0.02],[0.75,0.02],[0.72,0.18],[0.51,0.22],[0.48,0.2]], center: [0.61,0.10], labelSize: 10 },
    { id: 3, label: 'IV', vertices: [[0.75,0.02],[0.98,0.02],[0.98,0.22],[0.74,0.20],[0.72,0.18]], center: [0.86,0.11], labelSize: 10 },
    { id: 4, label: 'V', vertices: [[0.02,0.18],[0.22,0.22],[0.26,0.24],[0.28,0.48],[0.02,0.45]], center: [0.13,0.33], labelSize: 10 },
    { id: 5, label: 'VI', vertices: [[0.26,0.24],[0.48,0.2],[0.51,0.22],[0.55,0.45],[0.32,0.50],[0.28,0.48]], center: [0.38,0.34], labelSize: 10 },
    { id: 6, label: 'VII', vertices: [[0.51,0.22],[0.72,0.18],[0.74,0.20],[0.75,0.42],[0.58,0.47],[0.55,0.45]], center: [0.62,0.31], labelSize: 10 },
    { id: 7, label: 'VIII', vertices: [[0.74,0.20],[0.98,0.22],[0.98,0.48],[0.75,0.42]], center: [0.86,0.32], labelSize: 9 },
    { id: 8, label: 'IX', vertices: [[0.02,0.45],[0.28,0.48],[0.32,0.50],[0.35,0.75],[0.02,0.72]], center: [0.17,0.60], labelSize: 10 },
    { id: 9, label: 'X', vertices: [[0.32,0.50],[0.55,0.45],[0.58,0.47],[0.6,0.72],[0.35,0.75]], center: [0.44,0.60], labelSize: 10 },
    { id: 10, label: 'XI', vertices: [[0.58,0.47],[0.75,0.42],[0.98,0.48],[0.98,0.75],[0.6,0.72]], center: [0.78,0.60], labelSize: 10 },
    { id: 11, label: 'XII', vertices: [[0.02,0.72],[0.35,0.75],[0.6,0.72],[0.98,0.75],[0.98,0.98],[0.02,0.98]], center: [0.50,0.86], labelSize: 10 },
  ];
  const adjacencies: [number, number][] = [
    [0,1],[0,4],[1,2],[1,5],[2,3],[2,6],[3,7],[4,5],[4,8],[5,6],[5,9],[6,7],[8,9],[8,11],[9,10],[9,11],[10,11],
    [1,4],[2,5],[3,6],[6,10],[5,8],
  ];
  return { regions, adjacencies, prefilled: {}, hint: 'Look for regions with many neighbors — color those first.' };
}

function buildLevel3(): FCMap {
  const regions: FCRegion[] = [
    { id: 0, label: '1', vertices: [[0.02,0.02],[0.28,0.02],[0.25,0.25],[0.02,0.22]], center: [0.14,0.13], labelSize: 10 },
    { id: 1, label: '2', vertices: [[0.28,0.02],[0.52,0.02],[0.5,0.2],[0.25,0.25]], center: [0.39,0.12], labelSize: 10 },
    { id: 2, label: '3', vertices: [[0.52,0.02],[0.78,0.02],[0.75,0.22],[0.5,0.2]], center: [0.64,0.11], labelSize: 10 },
    { id: 3, label: '4', vertices: [[0.78,0.02],[0.98,0.02],[0.98,0.25],[0.75,0.22]], center: [0.87,0.12], labelSize: 10 },
    { id: 4, label: '5', vertices: [[0.02,0.22],[0.25,0.25],[0.3,0.5],[0.02,0.48]], center: [0.15,0.36], labelSize: 10 },
    { id: 5, label: '6', vertices: [[0.25,0.25],[0.5,0.2],[0.45,0.42],[0.33,0.52],[0.3,0.5]], center: [0.37,0.34], labelSize: 10 },
    { id: 6, label: '7', vertices: [[0.5,0.2],[0.75,0.22],[0.7,0.45],[0.47,0.44],[0.45,0.42]], center: [0.60,0.32], labelSize: 10 },
    { id: 7, label: '8', vertices: [[0.75,0.22],[0.98,0.25],[0.98,0.5],[0.7,0.45]], center: [0.85,0.35], labelSize: 10 },
    { id: 8, label: '9', vertices: [[0.02,0.48],[0.3,0.5],[0.33,0.52],[0.28,0.72],[0.02,0.7]], center: [0.15,0.60], labelSize: 10 },
    { id: 9, label: '10', vertices: [[0.33,0.52],[0.45,0.42],[0.47,0.44],[0.5,0.55],[0.51,0.74],[0.48,0.72],[0.28,0.72]], center: [0.40,0.58], labelSize: 9 },
    { id: 10, label: '11', vertices: [[0.47,0.44],[0.7,0.45],[0.68,0.55],[0.5,0.55]], center: [0.58,0.49], labelSize: 9 },
    { id: 11, label: '12', vertices: [[0.7,0.45],[0.98,0.5],[0.98,0.72],[0.72,0.7],[0.68,0.55]], center: [0.85,0.58], labelSize: 9 },
    { id: 12, label: '13', vertices: [[0.02,0.7],[0.28,0.72],[0.32,0.98],[0.02,0.98]], center: [0.16,0.84], labelSize: 9 },
    { id: 13, label: '14', vertices: [[0.28,0.72],[0.48,0.72],[0.51,0.74],[0.55,0.98],[0.32,0.98]], center: [0.41,0.85], labelSize: 9 },
    { id: 14, label: '15', vertices: [[0.51,0.74],[0.48,0.72],[0.72,0.7],[0.75,0.98],[0.55,0.98]], center: [0.63,0.85], labelSize: 9 },
    { id: 15, label: '16', vertices: [[0.72,0.7],[0.98,0.72],[0.98,0.98],[0.75,0.98]], center: [0.86,0.84], labelSize: 9 },
  ];
  const adjacencies: [number, number][] = [
    [0,1],[0,4],[1,2],[1,5],[2,3],[2,6],[3,7],
    [4,5],[4,8],[5,6],[5,9],[6,7],[6,10],[7,11],
    [8,9],[8,12],[9,10],[9,13],[10,11],[11,15],
    [12,13],[13,14],[14,15],
    [5,8],[6,9],[6,11],[10,14],[9,12],[10,13],
  ];
  return { regions, adjacencies, prefilled: {}, hint: 'Central regions have many neighbors — plan carefully around them.' };
}

function buildLevel4(): FCMap {
  const regions: FCRegion[] = [
    { id: 0, label: 'A', vertices: [[0.02,0.02],[0.22,0.02],[0.2,0.18],[0.02,0.16]], center: [0.12,0.10], labelSize: 9 },
    { id: 1, label: 'B', vertices: [[0.22,0.02],[0.42,0.02],[0.4,0.16],[0.2,0.18]], center: [0.31,0.09], labelSize: 9 },
    { id: 2, label: 'C', vertices: [[0.42,0.02],[0.6,0.02],[0.58,0.18],[0.4,0.16]], center: [0.50,0.09], labelSize: 9 },
    { id: 3, label: 'D', vertices: [[0.6,0.02],[0.8,0.02],[0.78,0.16],[0.58,0.18]], center: [0.69,0.09], labelSize: 9 },
    { id: 4, label: 'E', vertices: [[0.8,0.02],[0.98,0.02],[0.98,0.18],[0.78,0.16]], center: [0.89,0.09], labelSize: 9 },
    { id: 5, label: 'F', vertices: [[0.02,0.16],[0.2,0.18],[0.22,0.38],[0.02,0.35]], center: [0.12,0.27], labelSize: 9 },
    { id: 6, label: 'G', vertices: [[0.2,0.18],[0.4,0.16],[0.38,0.32],[0.24,0.40],[0.22,0.38]], center: [0.30,0.26], labelSize: 9 },
    { id: 7, label: 'H', vertices: [[0.4,0.16],[0.58,0.18],[0.62,0.35],[0.64,0.37],[0.38,0.32]], center: [0.50,0.25], labelSize: 9 },
    { id: 8, label: 'I', vertices: [[0.58,0.18],[0.78,0.16],[0.8,0.35],[0.62,0.35]], center: [0.70,0.26], labelSize: 9 },
    { id: 9, label: 'J', vertices: [[0.78,0.16],[0.98,0.18],[0.98,0.38],[0.8,0.35]], center: [0.89,0.27], labelSize: 9 },
    { id: 10, label: 'K', vertices: [[0.02,0.35],[0.22,0.38],[0.24,0.40],[0.25,0.6],[0.02,0.58]], center: [0.13,0.48], labelSize: 9 },
    { id: 11, label: 'L', vertices: [[0.24,0.40],[0.38,0.32],[0.64,0.37],[0.62,0.35],[0.6,0.58],[0.27,0.62],[0.25,0.6]], center: [0.42,0.48], labelSize: 9 },
    { id: 12, label: 'M', vertices: [[0.64,0.37],[0.62,0.35],[0.8,0.35],[0.98,0.38],[0.98,0.6],[0.6,0.58]], center: [0.80,0.48], labelSize: 9 },
    { id: 13, label: 'N', vertices: [[0.02,0.58],[0.25,0.6],[0.27,0.62],[0.28,0.78],[0.02,0.76]], center: [0.14,0.68], labelSize: 9 },
    { id: 14, label: 'O', vertices: [[0.27,0.62],[0.6,0.58],[0.55,0.75],[0.28,0.78]], center: [0.42,0.68], labelSize: 9 },
    { id: 15, label: 'P', vertices: [[0.6,0.58],[0.98,0.6],[0.98,0.78],[0.57,0.77],[0.55,0.75]], center: [0.78,0.68], labelSize: 9 },
    { id: 16, label: 'Q', vertices: [[0.02,0.76],[0.28,0.78],[0.3,0.98],[0.02,0.98]], center: [0.16,0.88], labelSize: 9 },
    { id: 17, label: 'R', vertices: [[0.28,0.78],[0.55,0.75],[0.52,0.98],[0.3,0.98]], center: [0.41,0.87], labelSize: 9 },
    { id: 18, label: 'S', vertices: [[0.55,0.75],[0.57,0.77],[0.78,0.78],[0.75,0.98],[0.52,0.98]], center: [0.65,0.87], labelSize: 9 },
    { id: 19, label: 'T', vertices: [[0.78,0.78],[0.98,0.78],[0.98,0.98],[0.75,0.98]], center: [0.87,0.88], labelSize: 9 },
  ];
  const adjacencies: [number, number][] = [
    [0,1],[0,5],[1,2],[1,6],[2,3],[2,7],[3,4],[3,8],[4,9],
    [5,6],[5,10],[6,7],[7,8],[8,9],
    [10,11],[10,13],[11,12],[11,14],[12,15],
    [13,14],[13,16],[14,15],[14,17],[15,19],
    [16,17],[17,18],[18,19],
    [6,11],[7,12],[6,10],[11,13],[12,14],[11,15],[13,17],[15,18],
  ];
  return { regions, adjacencies, prefilled: {}, hint: 'This map requires all 4 colors. Focus on regions with 4+ neighbors.' };
}

function buildLevel5(): FCMap {
  // 24-region map with shared vertices guaranteed to match exactly.
  // Grid junctions defined once, then referenced by index.
  const P: [number, number][] = [
    // Row 0 (top edge) — 7 points
    [0.02,0.02],[0.18,0.02],[0.34,0.02],[0.50,0.02],[0.66,0.02],[0.82,0.02],[0.98,0.02],
    // Row 1 — 7 points (indices 7–13)
    [0.02,0.18],[0.20,0.18],[0.36,0.20],[0.52,0.18],[0.68,0.20],[0.84,0.18],[0.98,0.18],
    // Row 2 — 7 points (indices 14–20)
    [0.02,0.34],[0.18,0.36],[0.36,0.34],[0.50,0.38],[0.66,0.34],[0.82,0.36],[0.98,0.34],
    // Row 3 — 7 points (indices 21–27)
    [0.02,0.52],[0.20,0.50],[0.34,0.52],[0.52,0.50],[0.68,0.52],[0.84,0.50],[0.98,0.52],
    // Row 4 — 7 points (indices 28–34)
    [0.02,0.68],[0.18,0.70],[0.36,0.68],[0.50,0.70],[0.66,0.68],[0.82,0.70],[0.98,0.68],
    // Row 5 (bottom edge) — 7 points (indices 35–41)
    [0.02,0.98],[0.20,0.98],[0.36,0.98],[0.52,0.98],[0.68,0.98],[0.84,0.98],[0.98,0.98],
  ];
  const v = (...indices: number[]): [number, number][] => indices.map(i => P[i]);
  const cx = (...indices: number[]): [number, number] => {
    let sx = 0, sy = 0;
    for (const i of indices) { sx += P[i][0]; sy += P[i][1]; }
    return [sx / indices.length, sy / indices.length];
  };
  const regions: FCRegion[] = [
    // Row 0–1
    { id: 0,  label: '1',  vertices: v(0,1,8,7),           center: cx(0,1,8,7),       labelSize: 8 },
    { id: 1,  label: '2',  vertices: v(1,2,9,8),            center: cx(1,2,9,8),       labelSize: 8 },
    { id: 2,  label: '3',  vertices: v(2,3,10,9),           center: cx(2,3,10,9),      labelSize: 8 },
    { id: 3,  label: '4',  vertices: v(3,4,11,10),          center: cx(3,4,11,10),     labelSize: 8 },
    { id: 4,  label: '5',  vertices: v(4,5,12,11),          center: cx(4,5,12,11),     labelSize: 8 },
    { id: 5,  label: '6',  vertices: v(5,6,13,12),          center: cx(5,6,13,12),     labelSize: 8 },
    // Row 1–2
    { id: 6,  label: '7',  vertices: v(7,8,15,14),          center: cx(7,8,15,14),     labelSize: 8 },
    { id: 7,  label: '8',  vertices: v(8,9,16,15),          center: cx(8,9,16,15),     labelSize: 8 },
    { id: 8,  label: '9',  vertices: v(9,10,11,18,17,16),   center: cx(9,10,17,16),    labelSize: 8 },
    { id: 9,  label: '10', vertices: v(11,12,19,18),        center: cx(11,12,19,18),   labelSize: 8 },
    { id: 10, label: '11', vertices: v(12,13,20,19),        center: cx(12,13,20,19),   labelSize: 8 },
    // Row 2–3
    { id: 11, label: '12', vertices: v(14,15,22,21),        center: cx(14,15,22,21),   labelSize: 8 },
    { id: 12, label: '13', vertices: v(15,16,17,23,22),     center: cx(15,16,23,22),   labelSize: 8 },
    { id: 13, label: '14', vertices: v(17,18,24,23),        center: cx(17,18,24,23),   labelSize: 8 },
    { id: 14, label: '15', vertices: v(18,19,25,24),        center: cx(18,19,25,24),   labelSize: 8 },
    { id: 15, label: '16', vertices: v(19,20,27,26,25),     center: cx(19,20,26,25),   labelSize: 8 },
    // Row 3–4
    { id: 16, label: '17', vertices: v(21,22,29,28),        center: cx(21,22,29,28),   labelSize: 8 },
    { id: 17, label: '18', vertices: v(22,23,24,31,30,29),  center: cx(22,23,30,29),   labelSize: 8 },
    { id: 18, label: '19', vertices: v(24,25,32,31),        center: cx(24,25,32,31),   labelSize: 8 },
    { id: 19, label: '20', vertices: v(25,26,27,34,33,32),  center: cx(25,26,33,32),   labelSize: 8 },
    // Row 4–5
    { id: 20, label: '21', vertices: v(28,29,36,35),        center: cx(28,29,36,35),   labelSize: 8 },
    { id: 21, label: '22', vertices: v(29,30,31,38,37,36),  center: cx(29,30,37,36),   labelSize: 8 },
    { id: 22, label: '23', vertices: v(31,32,33,39,38),     center: cx(31,32,39,38),   labelSize: 8 },
    { id: 23, label: '24', vertices: v(33,34,41,40,39),     center: cx(33,34,40,39),   labelSize: 8 },
  ];
  const adjacencies: [number, number][] = [
    // Horizontal row 0-1
    [0,1],[1,2],[2,3],[3,4],[4,5],
    // Vertical 0-1 → 1-2
    [0,6],[1,7],[2,8],[3,8],[4,9],[5,10],
    // Horizontal row 1-2
    [6,7],[7,8],[8,9],[9,10],
    // Vertical 1-2 → 2-3
    [6,11],[7,12],[8,12],[8,13],[9,14],[10,15],
    // Horizontal row 2-3
    [11,12],[12,13],[13,14],[14,15],
    // Vertical 2-3 → 3-4
    [11,16],[12,17],[13,17],[13,18],[14,18],[14,19],[15,19],
    // Horizontal row 3-4
    [16,17],[17,18],[18,19],
    // Vertical 3-4 → 4-5
    [16,20],[17,21],[18,21],[18,22],[19,22],[19,23],
    // Horizontal row 4-5
    [20,21],[21,22],[22,23],
  ];
  return { regions, adjacencies, prefilled: {}, hint: 'A dense colonial atlas. Work row by row, alternating colors.' };
}

function getMapForLevel(level: number): FCMap {
  switch (level) {
    case 1: return buildLevel1();
    case 2: return buildLevel2();
    case 3: return buildLevel3();
    case 4: return buildLevel4();
    default: return buildLevel5();
  }
}

/* ── Canvas drawing dimensions ───────────────────────────────── */

function MAP_W(): number { return Math.min(360, window.innerWidth - 48); }
function MAP_H(): number { return Math.round(MAP_W() * 300 / 360); }

/* ── Puzzle class ────────────────────────────────────────────── */

export class FourColorPuzzle extends Puzzle {
  readonly title = 'FOUR COLOURS';
  readonly subtitle = "guthrie's theorem · 1852";
  readonly instructions =
    'Color map regions so no two adjacent regions share the same color. Only four colors are needed.';

  private level = 5;
  private mapData: FCMap = buildLevel5();
  private regionColors: Map<number, number> = new Map(); // regionID → colorIndex
  private selectedColor = 0;
  private conflicts: Set<number> = new Set();
  private phase: 'playing' | 'won' = 'playing';
  private hintVisible = false;
  private shakeTimer = 0;

  // DOM
  private root: HTMLDivElement | null = null;
  private canvasEl: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private overlayEl: HTMLDivElement | null = null;
  private feedbackEl: HTMLDivElement | null = null;
  private coloredCountEl: HTMLSpanElement | null = null;
  private hintBubbleEl: HTMLDivElement | null = null;
  private paletteEls: HTMLDivElement[] = [];

  onSolved?: () => void;

  setLevel(lv: number): void {
    this.level = Math.max(1, Math.min(5, lv));
  }

  init(): void {
    this.buildBackdrop();
    this.mapData = getMapForLevel(this.level);
    this.setupLevel();
    this.buildDom();
    this.drawMap();
    this.refreshUI();
  }

  /* ═══════════════════ 3D backdrop ═══════════════════════════════ */

  private buildBackdrop(): void {
    const ground = new Mesh(
      new PlaneGeometry(40, 40),
      new MeshStandardMaterial({ color: new Color(C_DARK_BG), roughness: 0.7, metalness: 0.18, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.4;
    this.group.add(ground);

    const ring = new Mesh(
      new RingGeometry(3.0, 3.15, 48),
      new MeshStandardMaterial({
        color: new Color(C_COPPER), emissive: new Color('#2a1a0a'),
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
    root.id = 'puzzle-four-color';
    Object.assign(root.style, {
      position: 'fixed', inset: '0', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20', pointerEvents: 'none', fontFamily: "'Rajdhani', 'Segoe UI', system-ui, sans-serif",
    });
    this.root = root;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
      pointerEvents: 'auto', padding: '16px 20px',
      background: 'rgba(15,10,20,0.92)', backdropFilter: 'blur(12px)',
      border: `1px solid ${C_COPPER}40`, borderTop: `3px solid ${C_PURPLE}`,
      borderRadius: '10px', boxShadow: '0 18px 60px rgba(0,0,0,0.65)', color: C_CREAM,
      maxHeight: '96vh', overflowY: 'auto',
    });
    root.appendChild(panel);

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center',
    });

    const levelLabel = document.createElement('div');
    Object.assign(levelLabel.style, { fontSize: '12px', letterSpacing: '0.12em', opacity: '0.7' });
    levelLabel.textContent = `LEVEL ${this.level}`;
    header.appendChild(levelLabel);

    const titleEl = document.createElement('div');
    Object.assign(titleEl.style, { fontSize: '16px', letterSpacing: '0.22em', color: C_PURPLE, fontWeight: '700' });
    titleEl.textContent = 'FOUR COLOURS';
    header.appendChild(titleEl);

    const hintBtn = document.createElement('button');
    hintBtn.type = 'button';
    Object.assign(hintBtn.style, {
      background: 'none', border: 'none', cursor: 'pointer', color: C_GAS_YELLOW, fontSize: '18px',
      opacity: '0.8', padding: '4px',
    });
    hintBtn.textContent = '💡';
    hintBtn.addEventListener('click', () => this.toggleHint());
    header.appendChild(hintBtn);

    panel.appendChild(header);

    // Instruction card
    const instrCard = document.createElement('div');
    Object.assign(instrCard.style, {
      padding: '8px 16px', textAlign: 'center',
      background: 'rgba(255,255,255,0.06)', borderRadius: '8px',
      border: `1px solid ${C_PURPLE}44`,
    });

    const instrText = document.createElement('div');
    Object.assign(instrText.style, { fontSize: '13px', fontWeight: '500', color: C_CREAM, marginBottom: '4px' });
    instrText.textContent = 'Color regions so no neighbors share a color';
    instrCard.appendChild(instrText);

    const statsRow = document.createElement('div');
    Object.assign(statsRow.style, { display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '11px', opacity: '0.7' });
    const regionsSpan = document.createElement('span');
    regionsSpan.textContent = `Regions: ${this.mapData.regions.length}`;
    const coloredSpan = document.createElement('span');
    coloredSpan.textContent = `Colored: 0/${this.mapData.regions.length}`;
    this.coloredCountEl = coloredSpan;
    statsRow.append(regionsSpan, coloredSpan);
    instrCard.appendChild(statsRow);
    panel.appendChild(instrCard);

    // Map canvas
    const canvasWrap = document.createElement('div');
    Object.assign(canvasWrap.style, {
      position: 'relative', borderRadius: '10px', overflow: 'hidden',
      border: `1px solid ${C_MAROON}55`,
    });
    const cvs = document.createElement('canvas');
    cvs.width = MAP_W() * 2;
    cvs.height = MAP_H() * 2;
    Object.assign(cvs.style, { width: MAP_W() + 'px', height: MAP_H() + 'px', display: 'block', cursor: 'pointer' });
    this.canvasEl = cvs;
    this.ctx2d = cvs.getContext('2d')!;
    cvs.addEventListener('pointerdown', (ev) => this.handleMapClick(ev));
    canvasWrap.appendChild(cvs);
    panel.appendChild(canvasWrap);

    // Hint bubble
    const hintBubble = document.createElement('div');
    Object.assign(hintBubble.style, {
      display: 'none', padding: '8px 12px', fontSize: '11px', color: `${C_CREAM}dd`,
      background: `${C_GAS_YELLOW}18`, border: `1px solid ${C_GAS_YELLOW}44`, borderRadius: '8px',
      maxWidth: '300px', textAlign: 'center',
    });
    hintBubble.textContent = this.mapData.hint;
    this.hintBubbleEl = hintBubble;
    panel.appendChild(hintBubble);

    // Color palette
    const palWrap = document.createElement('div');
    Object.assign(palWrap.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' });

    const palLabel = document.createElement('div');
    Object.assign(palLabel.style, { fontSize: '10px', opacity: '0.6', letterSpacing: '0.08em' });
    palLabel.textContent = 'PICK A COLOR';
    palWrap.appendChild(palLabel);

    const palRow = document.createElement('div');
    Object.assign(palRow.style, { display: 'flex', gap: '10px', alignItems: 'center' });

    // Eraser
    const eraserBtn = document.createElement('div');
    Object.assign(eraserBtn.style, {
      width: '40px', height: '40px', borderRadius: '8px', cursor: 'pointer',
      border: `2px solid ${C_CREAM}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '16px', background: 'transparent',
    });
    eraserBtn.textContent = '✕';
    eraserBtn.addEventListener('click', () => this.selectColor(-1));
    this.paletteEls.push(eraserBtn);
    palRow.appendChild(eraserBtn);

    // 4 color swatches
    for (let i = 0; i < 4; i++) {
      const sw = document.createElement('div');
      Object.assign(sw.style, {
        width: '40px', height: '40px', borderRadius: '8px', cursor: 'pointer',
        background: MAP_COLORS[i], border: '3px solid transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', color: '#fff', fontWeight: '700',
      });
      sw.addEventListener('click', () => this.selectColor(i));
      this.paletteEls.push(sw);
      palRow.appendChild(sw);
    }
    palWrap.appendChild(palRow);
    panel.appendChild(palWrap);

    // Action bar
    const actionBar = document.createElement('div');
    Object.assign(actionBar.style, {
      display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px',
    });

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = 'RESET';
    Object.assign(resetBtn.style, {
      padding: '7px 14px', background: 'none', border: `1px solid ${C_CREAM}40`,
      color: `${C_CREAM}bb`, fontFamily: 'inherit', fontSize: '12px', fontWeight: '600',
      letterSpacing: '0.12em', borderRadius: '20px', cursor: 'pointer',
    });
    resetBtn.addEventListener('click', () => this.resetColors());
    actionBar.appendChild(resetBtn);

    // Feedback
    const feedbackEl = document.createElement('div');
    Object.assign(feedbackEl.style, { fontSize: '12px', fontWeight: '600', textAlign: 'center', minHeight: '16px' });
    this.feedbackEl = feedbackEl;
    actionBar.appendChild(feedbackEl);

    // Check button
    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.textContent = 'CHECK';
    Object.assign(checkBtn.style, {
      padding: '7px 16px', background: `${C_PURPLE}1f`, border: `1.5px solid ${C_PURPLE}88`,
      color: C_PURPLE, fontFamily: 'inherit', fontSize: '12px', fontWeight: '700',
      letterSpacing: '0.12em', borderRadius: '20px', cursor: 'pointer',
    });
    checkBtn.addEventListener('click', () => this.checkSolution());
    actionBar.appendChild(checkBtn);

    panel.appendChild(actionBar);

    // Overlay for victory
    this.overlayEl = document.createElement('div');
    Object.assign(this.overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '25', display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(5,2,8,0.80)', pointerEvents: 'auto',
    });
    root.appendChild(this.overlayEl);

    // Inject animation keyframes
    if (!document.getElementById('fourcolor-anims')) {
      const style = document.createElement('style');
      style.id = 'fourcolor-anims';
      style.textContent = `
        @keyframes fc-pop { from { transform: scale(0.92); opacity:0; } to { transform: scale(1); opacity:1; } }
        @keyframes fc-shake { 0%{transform:translateX(0)} 20%{transform:translateX(10px)} 40%{transform:translateX(-8px)} 60%{transform:translateX(4px)} 80%{transform:translateX(-2px)} 100%{transform:translateX(0)} }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(root);
  }

  /* ═══════════════════ Map Canvas Drawing ════════════════════════ */

  private drawMap(): void {
    const c = this.ctx2d!;
    const s = 2;
    c.clearRect(0, 0, MAP_W() * s, MAP_H() * s);
    c.save();
    c.scale(s, s);

    // Victorian map background (aged paper)
    c.fillStyle = '#FDF6ED';
    c.beginPath();
    c.roundRect(0, 0, MAP_W(), MAP_H(), 10);
    c.fill();

    // Paper texture (cross-hatch)
    this.drawPaperTexture(c);

    // Draw each region
    for (const region of this.mapData.regions) {
      this.drawRegion(c, region);
    }

    // Compass rose
    this.drawCompass(c);

    c.restore();
  }

  private drawPaperTexture(c: CanvasRenderingContext2D): void {
    c.strokeStyle = 'rgba(212,197,160,0.12)';
    c.lineWidth = 0.3;
    for (let x = 0; x <= MAP_W(); x += 12) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, MAP_H());
      c.stroke();
    }
    for (let y = 0; y <= MAP_H(); y += 12) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(MAP_W(), y);
      c.stroke();
    }
  }

  private drawRegion(c: CanvasRenderingContext2D, region: FCRegion): void {
    const path = this.buildRegionPath2D(region);
    const hasConflict = this.conflicts.has(region.id);
    const colorIdx = this.regionColors.get(region.id);

    // Fill
    if (colorIdx !== undefined) {
      c.fillStyle = this.hexWithAlpha(MAP_COLORS[colorIdx], hasConflict ? 0.4 : 0.55);
    } else {
      c.fillStyle = '#EDE4D4';
    }
    c.fill(path);

    // Border
    c.strokeStyle = hasConflict ? '#FF0000' : '#5C4A3A';
    c.lineWidth = hasConflict ? 2.5 : 1.2;
    c.stroke(path);

    // Label
    const cx = region.center[0] * MAP_W();
    const cy = region.center[1] * MAP_H();
    c.fillStyle = '#3A2920';
    c.font = `600 ${region.labelSize}px "Rajdhani", serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(region.label, cx, cy);
  }

  private drawCompass(c: CanvasRenderingContext2D): void {
    const cx = MAP_W() - 24;
    const cy = 24;
    const r = 10;
    // N arrow
    c.beginPath();
    c.moveTo(cx, cy - r);
    c.lineTo(cx - 3, cy);
    c.lineTo(cx + 3, cy);
    c.closePath();
    c.fillStyle = `${C_MAROON}66`;
    c.fill();
    // N label
    c.fillStyle = `${C_MAROON}80`;
    c.font = 'bold 6px serif';
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    c.fillText('N', cx, cy - r - 2);
  }

  private buildRegionPath2D(region: FCRegion): Path2D {
    const path = new Path2D();
    if (region.vertices.length === 0) return path;
    path.moveTo(region.vertices[0][0] * MAP_W(), region.vertices[0][1] * MAP_H());
    for (let i = 1; i < region.vertices.length; i++) {
      path.lineTo(region.vertices[i][0] * MAP_W(), region.vertices[i][1] * MAP_H());
    }
    path.closePath();
    return path;
  }

  private hexWithAlpha(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ═══════════════════ Interaction ═══════════════════════════════ */

  private handleMapClick(ev: PointerEvent): void {
    if (this.phase !== 'playing') return;
    const rect = this.canvasEl!.getBoundingClientRect();
    const x = (ev.clientX - rect.left) / rect.width * MAP_W();
    const y = (ev.clientY - rect.top) / rect.height * MAP_H();

    // Find which region was clicked (point-in-polygon)
    for (const region of this.mapData.regions) {
      if (this.isPointInRegion(x, y, region)) {
        this.tapRegion(region.id);
        break;
      }
    }
  }

  private isPointInRegion(px: number, py: number, region: FCRegion): boolean {
    // Ray-casting point-in-polygon — works regardless of canvas transform state.
    const verts = region.vertices;
    const n = verts.length;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = verts[i][0] * MAP_W(), yi = verts[i][1] * MAP_H();
      const xj = verts[j][0] * MAP_W(), yj = verts[j][1] * MAP_H();
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  private tapRegion(regionID: number): void {
    // Can't change prefilled regions
    if (this.mapData.prefilled[regionID] !== undefined) return;

    if (this.selectedColor === -1) {
      // Eraser
      this.regionColors.delete(regionID);
    } else {
      this.regionColors.set(regionID, this.selectedColor);
    }
    this.updateConflicts();
    this.drawMap();
    this.refreshUI();
  }

  private selectColor(idx: number): void {
    this.selectedColor = idx;
    this.refreshPalette();
  }

  private toggleHint(): void {
    this.hintVisible = !this.hintVisible;
    if (this.hintBubbleEl) {
      this.hintBubbleEl.style.display = this.hintVisible ? 'block' : 'none';
    }
  }

  /* ═══════════════════ Game Logic ════════════════════════════════ */

  private setupLevel(): void {
    this.regionColors = new Map();
    this.conflicts = new Set();
    this.phase = 'playing';
    this.selectedColor = 0;
    // Pre-fill
    for (const [rid, cidx] of Object.entries(this.mapData.prefilled)) {
      this.regionColors.set(Number(rid), cidx);
    }
  }

  private updateConflicts(): void {
    const newConflicts = new Set<number>();
    for (const [a, b] of this.mapData.adjacencies) {
      const ca = this.regionColors.get(a);
      const cb = this.regionColors.get(b);
      if (ca !== undefined && cb !== undefined && ca === cb) {
        newConflicts.add(a);
        newConflicts.add(b);
      }
    }
    this.conflicts = newConflicts;
  }

  private checkSolution(): void {
    if (this.phase !== 'playing') return;

    // Check all regions colored
    if (this.regionColors.size < this.mapData.regions.length) {
      this.showFeedback('Color all regions first', C_RAIL_RED);
      this.shake();
      return;
    }

    this.updateConflicts();
    if (this.conflicts.size === 0) {
      this.phase = 'won';
      this.isSolved = true;
      this.showVictoryOverlay();
      this.drawMap();
      this.refreshUI();
    } else {
      this.showFeedback('Adjacent regions share colors!', C_RAIL_RED);
      this.shake();
      this.drawMap();
      this.refreshUI();
    }
  }

  private resetColors(): void {
    this.regionColors = new Map();
    this.conflicts = new Set();
    if (this.feedbackEl) this.feedbackEl.textContent = '';
    // Re-apply prefilled
    for (const [rid, cidx] of Object.entries(this.mapData.prefilled)) {
      this.regionColors.set(Number(rid), cidx);
    }
    this.drawMap();
    this.refreshUI();
  }

  private shake(): void {
    if (this.canvasEl) {
      this.canvasEl.style.animation = 'fc-shake 0.35s ease-out';
      setTimeout(() => {
        if (this.canvasEl) this.canvasEl.style.animation = '';
      }, 400);
    }
  }

  private showFeedback(msg: string, color: string): void {
    if (this.feedbackEl) {
      this.feedbackEl.textContent = msg;
      this.feedbackEl.style.color = color;
    }
    setTimeout(() => {
      if (this.feedbackEl) this.feedbackEl.textContent = '';
    }, 2500);
  }

  /* ═══════════════════ UI Refresh ════════════════════════════════ */

  private refreshUI(): void {
    // Colored count
    if (this.coloredCountEl) {
      const count = this.regionColors.size;
      const total = this.mapData.regions.length;
      this.coloredCountEl.textContent = `Colored: ${count}/${total}`;
      this.coloredCountEl.style.color = count === total ? C_GAS_YELLOW : '';
    }
    this.refreshPalette();
  }

  private refreshPalette(): void {
    // Update palette selection indicators
    for (let i = 0; i < this.paletteEls.length; i++) {
      const el = this.paletteEls[i];
      const colorIdx = i - 1; // -1 = eraser, 0-3 = colors
      if (colorIdx === this.selectedColor) {
        if (colorIdx === -1) {
          el.style.border = `2px solid ${C_CREAM}`;
        } else {
          el.style.border = '3px solid #fff';
        }
        el.textContent = colorIdx === -1 ? '✕' : '✓';
      } else {
        if (colorIdx === -1) {
          el.style.border = `2px solid ${C_CREAM}55`;
        } else {
          el.style.border = '3px solid transparent';
        }
        el.textContent = colorIdx === -1 ? '✕' : '';
      }
    }
  }

  /* ═══════════════════ Victory Overlay ═══════════════════════════ */

  private showVictoryOverlay(): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = '';
    this.overlayEl.style.display = 'flex';

    const card = document.createElement('div');
    Object.assign(card.style, {
      maxWidth: '340px', width: '90%', textAlign: 'center', padding: '28px 24px',
      background: `${C_DARK_BG}f8`, border: `1.5px solid ${C_COPPER}59`,
      borderRadius: '16px', boxShadow: `0 0 40px ${C_COPPER}22`,
      fontFamily: "'Rajdhani', system-ui, sans-serif",
      animation: 'fc-pop 0.3s ease-out',
    });

    // Decorative rule
    card.appendChild(this.createDecorativeRule());

    // Victory badge (4-color grid)
    const badge = document.createElement('div');
    Object.assign(badge.style, {
      width: '80px', height: '80px', margin: '12px auto',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px',
      border: `2px solid ${C_COPPER}`, borderRadius: '50%', overflow: 'hidden', padding: '16px',
    });
    for (let i = 0; i < 4; i++) {
      const cell = document.createElement('div');
      cell.style.background = MAP_COLORS[i];
      cell.style.borderRadius = '2px';
      badge.appendChild(cell);
    }
    card.appendChild(badge);

    // Title
    const title = document.createElement('div');
    Object.assign(title.style, { color: C_GAS_YELLOW, fontSize: '20px', fontWeight: '700', marginTop: '10px' });
    title.textContent = 'MAP COMPLETE';
    card.appendChild(title);

    // Subtitle
    const sub = document.createElement('div');
    Object.assign(sub.style, { color: C_COPPER, fontSize: '14px', fontWeight: '500', marginTop: '4px' });
    sub.textContent = `${this.mapData.regions.length} regions colored correctly`;
    card.appendChild(sub);

    // Message
    const msg = document.createElement('div');
    Object.assign(msg.style, { color: `${C_CREAM}bb`, fontSize: '12px', marginTop: '8px', lineHeight: '1.5' });
    msg.textContent = "Guthrie's conjecture holds — four colours suffice for any map.";
    card.appendChild(msg);

    // Decorative rule
    card.appendChild(this.createDecorativeRule());

    // Continue button
    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.textContent = 'CONTINUE';
    Object.assign(continueBtn.style, {
      marginTop: '16px', padding: '10px 28px',
      background: `${C_COPPER}26`, border: `1.5px solid ${C_COPPER}`,
      color: C_CREAM, fontFamily: 'inherit', fontSize: '13px', fontWeight: '700',
      letterSpacing: '0.18em', borderRadius: '20px', cursor: 'pointer',
    });
    continueBtn.addEventListener('click', () => {
      this.overlayEl!.style.display = 'none';
      this.onSolved?.();
    });
    card.appendChild(continueBtn);

    this.overlayEl.appendChild(card);
  }

  private createDecorativeRule(): HTMLElement {
    const rule = document.createElement('div');
    Object.assign(rule.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
      margin: '12px 0', opacity: '0.6',
    });
    rule.innerHTML = `<div style="flex:1;height:1px;background:${C_COPPER}80"></div><span style="color:${C_COPPER};font-size:8px">◆</span><div style="flex:1;height:1px;background:${C_COPPER}80"></div>`;
    return rule;
  }

  /* ═══════════════════ Lifecycle ═════════════════════════════════ */

  update(_dt: number, camera: PerspectiveCamera): void {
    camera.position.set(0, 3.2, 7);
    camera.lookAt(0, -1, 0);
  }

  onPointerDown(_ndc: Vector2, _camera: PerspectiveCamera): void {}

  override dispose(): void {
    if (this.shakeTimer) clearTimeout(this.shakeTimer);
    if (this.root) { this.root.remove(); this.root = null; }
    const animStyle = document.getElementById('fourcolor-anims');
    if (animStyle) animStyle.remove();
    this.canvasEl = null;
    this.ctx2d = null;
    this.overlayEl = null;
    this.feedbackEl = null;
    this.coloredCountEl = null;
    this.hintBubbleEl = null;
    this.paletteEls = [];
    super.dispose();
  }
}
