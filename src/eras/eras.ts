/**
 * Era catalog — 10 eras mirroring the iOS game "Chronos Mathematica".
 *
 * Each era drives one flow (corridor) in the galactic map. For v1 all flows
 * share Egyptian geometry/content and only differ in palette + metadata; as
 * each era's content ships (obstacles, gods, decorations, checkpoint games)
 * it will hook into these configs by id.
 *
 * Each era has:
 *   - palette: runtime colors applied to lighting, fog, flow haze, HUD accents
 *   - skybox: uniforms for the procedural nebula shader
 *   - mathObstacles: DESIGN NOTES for Day 3+. All obstacles must be coherent
 *     MATH tools / numerals / symbols of the era — never generic architectural.
 *
 * MATH OBSTACLE CATALOG (design reference for Day 3 implementation):
 *   egypt        → hieroglyphic numerals (|, ∩, 𓏺, 𓆼),
 *                  knotted rope triangles (3-4-5 surveyors' ropes),
 *                  unit fractions (𓂋 symbol stacks), seked slopes
 *   greece       → Platonic solids (tetra/icosa/dodecahedra),
 *                  greek letters π, φ, ψ, Σ,
 *                  compass-and-straightedge constructions (circle+line)
 *   china        → jade abacus rods, rod numerals, magic squares (lo shu),
 *                  bamboo counting rods, tangram triangles
 *   islamic      → Arabic numerals (٠١٢٣٤٥٦٧٨٩) fluttuanti,
 *                  girih tile panels (pentagonal/decagonal),
 *                  astrolabe rings, algebra symbols (x², √)
 *   india        → Brahmi numerals, zero glyph (•), infinity (∞),
 *                  Kerala series spirals, Sulba-sutra altar diagrams
 *   renaissance  → perspective vanishing-lines grids, Vitruvian circles,
 *                  Roman numerals, Cardano cubic coefficients
 *   edo          → soroban beads (stacked disks on rods),
 *                  wasan sangaku problems (circles inscribed in triangles),
 *                  kanji numerals 一二三
 *   enlightenment → Newton prism triangles, Leibniz ∫ / d, logarithm curves,
 *                   Euler identity wheels
 *   revolution   → gear trains, steam-era differential pulleys,
 *                  Fourier sine waves, Gaussian bell curves
 *   codebreakers → Enigma rotors (disks with letters),
 *                  binary digits 0/1 as rain,
 *                  matrix brackets [ ], XOR/AND gate glyphs,
 *                  Turing machine tape segments
 */

export interface EraPalette {
  /** dust / detail tint; also feeds flow-haze mid/cool band */
  primary: number;
  /** night-sky base, dune / horizon depth */
  bg: number;
  /** key light, accent glows, flow-haze hot band */
  accent: number;
  /** fog color (slightly lifted bg) */
  fog: number;
}

export interface EraSkybox {
  /** 0..1 — base hue of the nebula/gas */
  hueBase: number;
  /** variation around hueBase */
  hueSpread: number;
  /** 0..1 — nebula thickness */
  density: number;
  /** 0..1 */
  starBrightness: number;
}

export type EraId =
  | 'egypt'
  | 'greece'
  | 'china'
  | 'islamic'
  | 'india'
  | 'renaissance'
  | 'edo'
  | 'enlightenment'
  | 'revolution'
  | 'codebreakers';

export interface Era {
  id: EraId;
  name: string;
  subtitle: string;
  palette: EraPalette;
  skybox: EraSkybox;
  mathObstacles: readonly string[];
}

export const ERAS: readonly Era[] = [
  {
    id: 'egypt',
    name: 'Ancient Egypt',
    subtitle: '3000 BCE · the dawn of numbers',
    palette: {
      primary: 0xc9a84c,
      bg: 0x2c1810,
      accent: 0xffd27f,
      fog: 0x3a2418,
    },
    skybox: { hueBase: 0.09, hueSpread: 0.08, density: 0.6, starBrightness: 0.9 },
    mathObstacles: ['hieroglyphic numerals', 'knotted 3-4-5 ropes', 'unit fractions', 'seked slopes'],
  },
  {
    id: 'greece',
    name: 'Ancient Greece',
    subtitle: '450 BCE · the birth of proof and reason',
    palette: {
      primary: 0x4a90d9,
      bg: 0x0a1628,
      accent: 0x9fc8ff,
      fog: 0x14203a,
    },
    skybox: { hueBase: 0.58, hueSpread: 0.1, density: 0.45, starBrightness: 1.0 },
    mathObstacles: ['Platonic solids', 'π / φ / ψ glyphs', 'compass constructions'],
  },
  {
    id: 'china',
    name: 'Ancient China',
    subtitle: '200 BCE · the jade abacus',
    palette: {
      primary: 0xd4af37,
      bg: 0x1a0f05,
      accent: 0xffd96b,
      fog: 0x271808,
    },
    skybox: { hueBase: 0.14, hueSpread: 0.08, density: 0.55, starBrightness: 0.9 },
    mathObstacles: ['jade abacus rods', 'lo-shu magic squares', 'bamboo counting rods', 'tangram triangles'],
  },
  {
    id: 'islamic',
    name: 'Islamic Golden Age',
    subtitle: '900 CE · the birth of algebra',
    palette: {
      primary: 0xc4a44a,
      bg: 0x0d1f2d,
      accent: 0x5adfc3,
      fog: 0x152938,
    },
    skybox: { hueBase: 0.44, hueSpread: 0.1, density: 0.55, starBrightness: 0.9 },
    mathObstacles: ['Arabic numerals', 'girih tile panels', 'astrolabe rings', 'algebra symbols'],
  },
  {
    id: 'india',
    name: 'Ancient India',
    subtitle: '1000 CE · the gift of zero and infinity',
    palette: {
      primary: 0xd4442a,
      bg: 0x1a0f08,
      accent: 0xff8c5a,
      fog: 0x2a170d,
    },
    skybox: { hueBase: 0.03, hueSpread: 0.08, density: 0.55, starBrightness: 0.92 },
    mathObstacles: ['Brahmi numerals', 'zero glyph', 'infinity ∞', 'Kerala-series spirals'],
  },
  {
    id: 'renaissance',
    name: 'Italian Renaissance',
    subtitle: '1500 CE · the rebirth of knowledge',
    palette: {
      primary: 0x8b1a1a,
      bg: 0x1c1008,
      accent: 0xe0a060,
      fog: 0x2a1a10,
    },
    skybox: { hueBase: 0.0, hueSpread: 0.07, density: 0.5, starBrightness: 0.9 },
    mathObstacles: ['perspective vanishing lines', 'Vitruvian circles', 'Roman numerals', 'cubic coefficients'],
  },
  {
    id: 'edo',
    name: 'Edo Japan',
    subtitle: '1700 CE · sacred geometry of the temples',
    palette: {
      primary: 0xc41e3a,
      bg: 0x1a0a0a,
      accent: 0xffc0cb,
      fog: 0x2c1015,
    },
    skybox: { hueBase: 0.97, hueSpread: 0.08, density: 0.5, starBrightness: 0.95 },
    mathObstacles: ['soroban beads', 'sangaku circles', 'kanji numerals'],
  },
  {
    id: 'enlightenment',
    name: 'Age of Enlightenment',
    subtitle: '1750 CE · the language of the universe',
    palette: {
      primary: 0xc4944a,
      bg: 0x0d1520,
      accent: 0xffd49a,
      fog: 0x18222d,
    },
    skybox: { hueBase: 0.1, hueSpread: 0.08, density: 0.5, starBrightness: 1.0 },
    mathObstacles: ['Newton prism triangles', 'Leibniz integral / d', 'log curves', 'Euler wheels'],
  },
  {
    id: 'revolution',
    name: 'Age of Revolution',
    subtitle: '1850 CE · romanticism and ruin',
    palette: {
      primary: 0x9b59b6,
      bg: 0x0f0a14,
      accent: 0xd6a4ff,
      fog: 0x1c1322,
    },
    skybox: { hueBase: 0.78, hueSpread: 0.08, density: 0.55, starBrightness: 0.95 },
    mathObstacles: ['gear trains', 'differential pulleys', 'Fourier sine waves', 'Gaussian curves'],
  },
  {
    id: 'codebreakers',
    name: 'The Codebreakers',
    subtitle: '1940 CE · the imitation game',
    palette: {
      primary: 0x2ecc71,
      bg: 0x0a1210,
      accent: 0x00ff88,
      fog: 0x0f1a16,
    },
    skybox: { hueBase: 0.35, hueSpread: 0.1, density: 0.4, starBrightness: 1.0 },
    mathObstacles: ['Enigma rotors', 'binary 0/1 rain', 'matrix brackets', 'Turing tape'],
  },
];

export function getEra(id: EraId): Era {
  const era = ERAS.find((e) => e.id === id);
  if (!era) throw new Error(`Unknown era: ${id}`);
  return era;
}
