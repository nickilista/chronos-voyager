import type { Palette } from './types.ts';

/**
 * Tiny shared drawing helpers reused across the per-era pantheons. Kept
 * deliberately small: each era provides most of its own body + head work
 * so the figures feel genuinely distinct, not a skinned template.
 */

export function circle(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string,
): void {
  g.fillStyle = fill;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
}

export function ring(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  stroke: string,
  width: number,
): void {
  g.strokeStyle = stroke;
  g.lineWidth = width;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
}

/**
 * Standing "toga" torso — works for Greek, Roman, Renaissance, and
 * Enlightenment figures. A ribbed drape effect is baked in via thin accent
 * bands so the silhouette doesn't read as flat.
 */
export function drawTogaBody(
  g: CanvasRenderingContext2D,
  s: number,
  p: Palette,
): void {
  g.fillStyle = p.ink;
  // Shoulders
  g.beginPath();
  g.moveTo(-s * 0.22, -s * 0.02);
  g.quadraticCurveTo(0, s * 0.06, s * 0.22, -s * 0.02);
  g.lineTo(s * 0.28, s * 0.1);
  g.lineTo(-s * 0.28, s * 0.1);
  g.closePath();
  g.fill();
  // Draped robe body
  g.beginPath();
  g.moveTo(-s * 0.28, s * 0.1);
  g.lineTo(s * 0.28, s * 0.1);
  g.lineTo(s * 0.36, s * 0.98);
  g.lineTo(-s * 0.36, s * 0.98);
  g.closePath();
  g.fill();
  // Drape folds
  g.strokeStyle = p.accent;
  g.lineWidth = s * 0.015;
  for (let i = 0; i < 3; i++) {
    const x = -s * 0.2 + i * s * 0.2;
    g.beginPath();
    g.moveTo(x, s * 0.14);
    g.quadraticCurveTo(x + s * 0.02, s * 0.5, x + s * 0.03, s * 0.94);
    g.stroke();
  }
  // Sash
  g.fillStyle = p.accent;
  g.beginPath();
  g.moveTo(-s * 0.3, s * 0.28);
  g.lineTo(s * 0.3, s * 0.22);
  g.lineTo(s * 0.32, s * 0.32);
  g.lineTo(-s * 0.28, s * 0.38);
  g.closePath();
  g.fill();
}

/**
 * Long-sleeved robe with a belt/obi — works for Chinese, Japanese, and
 * Indian seated/standing figures.
 */
export function drawRobedBody(
  g: CanvasRenderingContext2D,
  s: number,
  p: Palette,
  beltColor?: string,
): void {
  g.fillStyle = p.ink;
  // Broad-shouldered robe, flared at base.
  g.beginPath();
  g.moveTo(-s * 0.3, s * 0.02);
  g.lineTo(s * 0.3, s * 0.02);
  g.lineTo(s * 0.42, s * 0.98);
  g.lineTo(-s * 0.42, s * 0.98);
  g.closePath();
  g.fill();
  // Obi / belt
  g.fillStyle = beltColor ?? p.accent;
  g.fillRect(-s * 0.34, s * 0.46, s * 0.68, s * 0.08);
  g.fillStyle = p.accent2;
  g.fillRect(-s * 0.34, s * 0.54, s * 0.68, s * 0.012);
  // Front crossover line
  g.strokeStyle = p.accent2;
  g.lineWidth = s * 0.015;
  g.beginPath();
  g.moveTo(-s * 0.08, s * 0.04);
  g.lineTo(0, s * 0.46);
  g.moveTo(s * 0.08, s * 0.04);
  g.lineTo(0, s * 0.46);
  g.stroke();
}

/**
 * Basic oval head + neck, positioned centred above y=0. Used by most
 * anthropomorphic pantheons. Caller draws hair/crown/headgear on top.
 */
export function drawBareHead(
  g: CanvasRenderingContext2D,
  s: number,
  p: Palette,
  skin?: string,
): void {
  const fill = skin ?? p.ink;
  g.fillStyle = fill;
  // Neck
  g.fillRect(-s * 0.08, -s * 0.1, s * 0.16, s * 0.14);
  // Oval head
  g.beginPath();
  g.ellipse(0, -s * 0.28, s * 0.16, s * 0.2, 0, 0, Math.PI * 2);
  g.fill();
}

/** Short diagonal stroke used for a subtle eye hint on dark heads. */
export function drawHintEye(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string,
): void {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, s * 0.022, 0, Math.PI * 2);
  g.fill();
}
