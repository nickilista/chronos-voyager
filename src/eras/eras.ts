/**
 * Era catalog — 5 eras for MVP (polished over 10 mediocre).
 *
 * Each era has:
 *   - palette: runtime colors applied to lighting, fog, ship trails, HUD accents
 *   - skybox: uniforms for the procedural nebula shader
 *   - obstacles: DESIGN NOTES for Day 3+. All obstacles must be coherent MATH
 *     tools / numerals / symbols of the era — never generic architectural shapes.
 *
 * MATH OBSTACLE CATALOG (design reference for Day 3 implementation):
 *   egypt        → hieroglyphic numerals (|, ∩, 𓏺, 𓆼),
 *                  knotted rope triangles (3-4-5 surveyors' ropes),
 *                  unit fractions (𓂋 symbol stacks), seked slopes
 *   greece       → Platonic solids (tetra/icosa/dodecahedra),
 *                  greek letters π, φ, ψ, Σ,
 *                  compass-and-straightedge constructions (circle+line)
 *   islamic      → Arabic numerals (٠١٢٣٤٥٦٧٨٩) fluttuanti,
 *                  girih tile panels (pentagonal/decagonal),
 *                  astrolabe rings, algebra symbols (x², √)
 *   edo          → soroban beads (stacked disks on rods),
 *                  wasan sangaku problems (circles inscribed in triangles),
 *                  kanji numerals 一二三
 *   codebreakers → Enigma rotors (disks with letters),
 *                  binary digits 0/1 as rain,
 *                  matrix brackets [ ], XOR/AND gate glyphs,
 *                  Turing machine tape segments
 */

export interface EraPalette {
  primary: number;
  bg: number;
  accent: number;
  fog: number;
}

export interface EraSkybox {
  hueBase: number; // 0..1 — primary hue
  hueSpread: number; // variation around hueBase
  density: number; // 0..1 — nebula thickness
  starBrightness: number; // 0..1
}

export interface Era {
  id: 'egypt' | 'greece' | 'islamic' | 'edo' | 'codebreakers';
  name: string;
  subtitle: string;
  palette: EraPalette;
  skybox: EraSkybox;
  /** Design notes — drives obstacle catalog in Day 3 implementation. */
  mathObstacles: readonly string[];
}

export const ERAS: readonly Era[] = [
  {
    id: 'egypt',
    name: 'Ancient Egypt',
    subtitle: '3000 BCE · land of the surveyors',
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
    subtitle: '450 BCE · geometers of the Academy',
    palette: {
      primary: 0xe0e8f0,
      bg: 0x0a1628,
      accent: 0xd4af37,
      fog: 0x14203a,
    },
    skybox: { hueBase: 0.58, hueSpread: 0.1, density: 0.45, starBrightness: 1.0 },
    mathObstacles: ['Platonic solids', 'π / φ / ψ glyphs', 'compass constructions'],
  },
  {
    id: 'islamic',
    name: 'Islamic Golden Age',
    subtitle: '900 CE · House of Wisdom',
    palette: {
      primary: 0x1b8a6b,
      bg: 0x0d1f2d,
      accent: 0xd4af37,
      fog: 0x152938,
    },
    skybox: { hueBase: 0.42, hueSpread: 0.12, density: 0.55, starBrightness: 0.85 },
    mathObstacles: ['Arabic numerals', 'girih tile panels', 'astrolabe rings', 'algebra symbols'],
  },
  {
    id: 'edo',
    name: 'Edo Japan',
    subtitle: '1700 CE · wasan mathematicians',
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
    id: 'codebreakers',
    name: 'Codebreakers',
    subtitle: '1940 CE · Bletchley and beyond',
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

export function getEra(id: Era['id']): Era {
  const era = ERAS.find((e) => e.id === id);
  if (!era) throw new Error(`Unknown era: ${id}`);
  return era;
}
