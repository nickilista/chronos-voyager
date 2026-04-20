/**
 * Per-era orbiting-pantheon rendering types.
 *
 * Each era provides its own set of ~8 figures drawn onto a CanvasTexture and
 * billboarded into the sky as slow-orbiting celestial motifs. Egypt has the
 * traditional pharaonic pantheon; later eras use their own iconography —
 * local deities, philosophers, engineers, or coded symbols — chosen to feel
 * distinctive *of* the era, not a generic reskin.
 *
 * A figure is a pure drawing function: called with a canvas context
 * centred on the figure's footprint, a linear scale `s`, and the era's
 * palette. It renders the figure in-place. The CelestialGods system owns
 * the backdrop glow / halo and composites figures on top.
 */

export interface Palette {
  /** Main silhouette colour — typically a very dark, slightly warm ink. */
  readonly ink: string;
  /** Metallic / bright accent used for highlights and attributes. */
  readonly accent: string;
  /** Secondary accent for variation (trim, jewels, flames). */
  readonly accent2: string;
  /** Inner glow for the radial backdrop — brightest point. */
  readonly glowInner: string;
  /** Mid-stop of the radial backdrop — the characteristic era hue. */
  readonly glowMid: string;
  /** Outer fade of the radial backdrop — transparent edge. */
  readonly glowEdge: string;
  /** Halo disc behind the figure's head — same family as accent. */
  readonly halo: string;
}

export interface Figure {
  readonly id: string;
  readonly draw: (g: CanvasRenderingContext2D, s: number, p: Palette) => void;
}

export interface Pantheon {
  readonly palette: Palette;
  readonly figures: readonly Figure[];
}
