import type { Figure, Palette, Pantheon } from './types.ts';
import { circle, ring } from './common.ts';

/**
 * Industrial Revolution pantheon — the age of steam, gears, and reform.
 * Not gods but the era's icons: engineers, inventors, pioneers, and
 * machines. Palette: coal-soot ink with brass/copper highlights and a
 * suffragette-purple secondary for variety, sitting against the era's
 * deep-violet sky.
 */

const REVOLUTION_PALETTE: Palette = {
  ink: '#1a120a',
  accent: '#c98a3e',
  accent2: '#a468c9',
  glowInner: 'rgba(245, 210, 150, 0.9)',
  glowMid: 'rgba(170, 110, 60, 0.5)',
  glowEdge: 'rgba(30, 18, 10, 0)',
  halo: 'rgba(240, 198, 130, 0.65)',
};

function skin(g: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  g.fillStyle = '#e7c5a2';
  g.beginPath();
  g.ellipse(cx, cy, s * 0.15, s * 0.18, 0, 0, Math.PI * 2);
  g.fill();
}

function frockCoat(g: CanvasRenderingContext2D, s: number, p: Palette): void {
  g.fillStyle = p.ink;
  // Shoulders
  g.beginPath();
  g.moveTo(-s * 0.26, -s * 0.04);
  g.quadraticCurveTo(0, s * 0.04, s * 0.26, -s * 0.04);
  g.lineTo(s * 0.3, s * 0.12);
  g.lineTo(-s * 0.3, s * 0.12);
  g.closePath();
  g.fill();
  // Long coat
  g.beginPath();
  g.moveTo(-s * 0.3, s * 0.12);
  g.lineTo(s * 0.3, s * 0.12);
  g.lineTo(s * 0.38, s * 0.96);
  g.lineTo(-s * 0.38, s * 0.96);
  g.closePath();
  g.fill();
  // Lapels V
  g.fillStyle = '#2a1f12';
  g.beginPath();
  g.moveTo(-s * 0.18, s * 0.02);
  g.lineTo(0, s * 0.36);
  g.lineTo(s * 0.18, s * 0.02);
  g.lineTo(s * 0.08, s * 0.02);
  g.lineTo(0, s * 0.18);
  g.lineTo(-s * 0.08, s * 0.02);
  g.closePath();
  g.fill();
  // Brass buttons
  g.fillStyle = p.accent;
  for (let i = 0; i < 4; i++) {
    circle(g, 0, s * 0.22 + i * s * 0.18, s * 0.018, p.accent);
  }
}

function topHat(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, p: Palette): void {
  g.fillStyle = p.ink;
  // Brim
  g.beginPath();
  g.ellipse(cx, cy + s * 0.14, s * 0.2, s * 0.035, 0, 0, Math.PI * 2);
  g.fill();
  // Crown
  g.fillRect(cx - s * 0.13, cy - s * 0.24, s * 0.26, s * 0.38);
  // Band
  g.fillStyle = p.accent;
  g.fillRect(cx - s * 0.13, cy + s * 0.08, s * 0.26, s * 0.04);
}

const STEPHENSON: Figure = {
  id: 'stephenson',
  draw(g, s, p) {
    // Locomotive "Rocket" — horizontal engine body
    // Boiler
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.42, -s * 0.04, s * 0.7, s * 0.3);
    // Smokestack
    g.fillRect(-s * 0.3, -s * 0.44, s * 0.1, s * 0.4);
    // Stack flare
    g.beginPath();
    g.moveTo(-s * 0.34, -s * 0.44);
    g.lineTo(-s * 0.16, -s * 0.44);
    g.lineTo(-s * 0.2, -s * 0.5);
    g.lineTo(-s * 0.3, -s * 0.5);
    g.closePath();
    g.fill();
    // Smoke plume
    g.fillStyle = 'rgba(180,180,180,0.55)';
    circle(g, -s * 0.18, -s * 0.58, s * 0.1, 'rgba(200,200,200,0.55)');
    circle(g, -s * 0.04, -s * 0.64, s * 0.14, 'rgba(220,220,220,0.45)');
    circle(g, s * 0.16, -s * 0.56, s * 0.11, 'rgba(200,200,200,0.4)');
    // Brass dome
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(s * 0.06, -s * 0.08, s * 0.06, Math.PI, 0);
    g.fill();
    // Firebox / cab
    g.fillStyle = p.ink;
    g.fillRect(s * 0.22, -s * 0.1, s * 0.14, s * 0.36);
    g.fillStyle = p.accent;
    g.fillRect(s * 0.24, -s * 0.06, s * 0.1, s * 0.12);
    // Wheels
    g.fillStyle = p.ink;
    circle(g, -s * 0.3, s * 0.32, s * 0.12, p.ink);
    circle(g, -s * 0.04, s * 0.32, s * 0.18, p.ink);
    circle(g, s * 0.24, s * 0.32, s * 0.12, p.ink);
    // Brass rings
    ring(g, -s * 0.3, s * 0.32, s * 0.08, p.accent, s * 0.018);
    ring(g, -s * 0.04, s * 0.32, s * 0.13, p.accent, s * 0.02);
    ring(g, s * 0.24, s * 0.32, s * 0.08, p.accent, s * 0.018);
    // Drive rod
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.018;
    g.beginPath();
    g.moveTo(-s * 0.3, s * 0.32);
    g.lineTo(s * 0.24, s * 0.32);
    g.stroke();
    // Track
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.44, s * 0.46, s * 0.88, s * 0.02);
  },
};

const BRUNEL: Figure = {
  id: 'brunel',
  draw(g, s, p) {
    frockCoat(g, s, p);
    skin(g, 0, -s * 0.3, s);
    // Muttonchop sideburns
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.15, -s * 0.34);
    g.quadraticCurveTo(-s * 0.2, -s * 0.2, -s * 0.12, -s * 0.18);
    g.lineTo(-s * 0.08, -s * 0.32);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.15, -s * 0.34);
    g.quadraticCurveTo(s * 0.2, -s * 0.2, s * 0.12, -s * 0.18);
    g.lineTo(s * 0.08, -s * 0.32);
    g.closePath();
    g.fill();
    // Tall stovepipe top hat
    topHat(g, 0, -s * 0.52, s, p);
    // Eyes
    circle(g, -s * 0.05, -s * 0.3, s * 0.012, p.ink);
    circle(g, s * 0.05, -s * 0.3, s * 0.012, p.ink);
    // Cigar
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.02;
    g.beginPath();
    g.moveTo(s * 0.05, -s * 0.22);
    g.lineTo(s * 0.18, -s * 0.2);
    g.stroke();
    g.fillStyle = '#ff6a2a';
    circle(g, s * 0.19, -s * 0.2, s * 0.012, '#ff6a2a');
    // Compass / dividers in hand
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.02;
    g.beginPath();
    g.moveTo(-s * 0.4, s * 0.5);
    g.lineTo(-s * 0.26, s * 0.3);
    g.moveTo(-s * 0.4, s * 0.5);
    g.lineTo(-s * 0.18, s * 0.5);
    g.stroke();
    circle(g, -s * 0.26, s * 0.3, s * 0.018, p.accent);
    // Rolled blueprint under arm
    g.fillStyle = p.accent;
    g.fillRect(s * 0.26, s * 0.38, s * 0.18, s * 0.05);
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.moveTo(s * 0.3, s * 0.4);
    g.lineTo(s * 0.42, s * 0.4);
    g.stroke();
  },
};

const EDISON: Figure = {
  id: 'edison',
  draw(g, s, p) {
    frockCoat(g, s, p);
    skin(g, 0, -s * 0.3, s);
    // Side-parted hair
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.16, -s * 0.42);
    g.quadraticCurveTo(0, -s * 0.52, s * 0.16, -s * 0.42);
    g.lineTo(s * 0.14, -s * 0.3);
    g.lineTo(-s * 0.14, -s * 0.3);
    g.closePath();
    g.fill();
    // Part line
    g.strokeStyle = '#e7c5a2';
    g.lineWidth = s * 0.014;
    g.beginPath();
    g.moveTo(-s * 0.04, -s * 0.46);
    g.lineTo(-s * 0.02, -s * 0.34);
    g.stroke();
    // Eyes
    circle(g, -s * 0.05, -s * 0.3, s * 0.012, p.ink);
    circle(g, s * 0.05, -s * 0.3, s * 0.012, p.ink);
    // Bow tie
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.08, -s * 0.06);
    g.lineTo(-s * 0.16, s * 0.02);
    g.lineTo(-s * 0.08, s * 0.06);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.08, -s * 0.06);
    g.lineTo(s * 0.16, s * 0.02);
    g.lineTo(s * 0.08, s * 0.06);
    g.closePath();
    g.fill();
    // Lightbulb held up - glass bulb
    g.fillStyle = 'rgba(245, 220, 140, 0.85)';
    g.beginPath();
    g.ellipse(-s * 0.42, -s * 0.08, s * 0.12, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    // Inner glow
    g.fillStyle = 'rgba(255, 240, 180, 0.9)';
    circle(g, -s * 0.42, -s * 0.08, s * 0.06, 'rgba(255, 240, 180, 0.9)');
    // Filament
    g.strokeStyle = '#ff9a2a';
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.moveTo(-s * 0.46, -s * 0.08);
    g.lineTo(-s * 0.44, -s * 0.02);
    g.lineTo(-s * 0.42, -s * 0.08);
    g.lineTo(-s * 0.4, -s * 0.02);
    g.lineTo(-s * 0.38, -s * 0.08);
    g.stroke();
    // Brass screw base
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.46, s * 0.04, s * 0.08, s * 0.06);
    // Rays from bulb
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.014;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(-s * 0.42 + Math.cos(a) * s * 0.16, -s * 0.08 + Math.sin(a) * s * 0.16);
      g.lineTo(-s * 0.42 + Math.cos(a) * s * 0.22, -s * 0.08 + Math.sin(a) * s * 0.22);
      g.stroke();
    }
    // Phonograph cylinder on right
    g.fillStyle = p.accent;
    g.fillRect(s * 0.26, s * 0.3, s * 0.14, s * 0.14);
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.008;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(s * 0.26, s * 0.32 + i * s * 0.025);
      g.lineTo(s * 0.4, s * 0.32 + i * s * 0.025);
      g.stroke();
    }
  },
};

const ADA_LOVELACE: Figure = {
  id: 'ada',
  draw(g, s, p) {
    // Victorian bell-skirt dress
    g.fillStyle = p.ink;
    // Bodice
    g.beginPath();
    g.moveTo(-s * 0.22, -s * 0.04);
    g.quadraticCurveTo(0, s * 0.02, s * 0.22, -s * 0.04);
    g.lineTo(s * 0.2, s * 0.3);
    g.lineTo(-s * 0.2, s * 0.3);
    g.closePath();
    g.fill();
    // Wide crinoline skirt
    g.beginPath();
    g.moveTo(-s * 0.2, s * 0.3);
    g.quadraticCurveTo(-s * 0.5, s * 0.7, -s * 0.44, s * 0.98);
    g.lineTo(s * 0.44, s * 0.98);
    g.quadraticCurveTo(s * 0.5, s * 0.7, s * 0.2, s * 0.3);
    g.closePath();
    g.fill();
    // Lace trim
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.012;
    for (let i = 0; i < 8; i++) {
      const x = -s * 0.44 + (i / 7) * s * 0.88;
      g.beginPath();
      g.arc(x, s * 0.98, s * 0.03, Math.PI, 0);
      g.stroke();
    }
    // Cameo brooch
    g.fillStyle = p.accent;
    circle(g, 0, s * 0.08, s * 0.03, p.accent);
    // Skin
    skin(g, 0, -s * 0.3, s);
    // Hair with side ringlets + center part
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(0, -s * 0.44, s * 0.2, s * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(-s * 0.2, -s * 0.24, s * 0.08, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.2, -s * 0.24, s * 0.08, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    // Eyes
    circle(g, -s * 0.05, -s * 0.3, s * 0.012, p.ink);
    circle(g, s * 0.05, -s * 0.3, s * 0.012, p.ink);
    // Punch card in hand
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.5, s * 0.44, s * 0.22, s * 0.12);
    // Punch holes
    g.fillStyle = p.ink;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 6; c++) {
        if ((r + c) % 3 !== 0) {
          circle(g, -s * 0.48 + c * s * 0.036, s * 0.48 + r * s * 0.04, s * 0.008, p.ink);
        }
      }
    }
    // Quill pen
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.018;
    g.beginPath();
    g.moveTo(s * 0.28, s * 0.56);
    g.lineTo(s * 0.46, s * 0.28);
    g.stroke();
    g.fillStyle = p.accent2;
    g.beginPath();
    g.moveTo(s * 0.42, s * 0.22);
    g.quadraticCurveTo(s * 0.5, s * 0.18, s * 0.5, s * 0.3);
    g.lineTo(s * 0.44, s * 0.32);
    g.closePath();
    g.fill();
  },
};

const DARWIN: Figure = {
  id: 'darwin',
  draw(g, s, p) {
    frockCoat(g, s, p);
    skin(g, 0, -s * 0.28, s);
    // Bald dome
    g.fillStyle = '#e7c5a2';
    g.beginPath();
    g.ellipse(0, -s * 0.4, s * 0.15, s * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    // Long white beard
    g.fillStyle = '#e8e4d8';
    g.beginPath();
    g.moveTo(-s * 0.14, -s * 0.22);
    g.quadraticCurveTo(-s * 0.2, s * 0.04, -s * 0.08, s * 0.12);
    g.quadraticCurveTo(0, s * 0.2, s * 0.08, s * 0.12);
    g.quadraticCurveTo(s * 0.2, s * 0.04, s * 0.14, -s * 0.22);
    g.quadraticCurveTo(0, -s * 0.18, -s * 0.14, -s * 0.22);
    g.closePath();
    g.fill();
    // Bushy brows
    g.fillStyle = '#e8e4d8';
    g.fillRect(-s * 0.1, -s * 0.34, s * 0.07, s * 0.02);
    g.fillRect(s * 0.03, -s * 0.34, s * 0.07, s * 0.02);
    // Eyes
    circle(g, -s * 0.06, -s * 0.3, s * 0.01, p.ink);
    circle(g, s * 0.06, -s * 0.3, s * 0.01, p.ink);
    // Finch on shoulder
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(-s * 0.3, -s * 0.08, s * 0.08, s * 0.06, -0.2, 0, Math.PI * 2);
    g.fill();
    // Finch head
    circle(g, -s * 0.36, -s * 0.12, s * 0.04, p.accent);
    // Finch beak (notably large — Galapagos)
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.4, -s * 0.1);
    g.lineTo(-s * 0.46, -s * 0.08);
    g.lineTo(-s * 0.4, -s * 0.06);
    g.closePath();
    g.fill();
    circle(g, -s * 0.36, -s * 0.14, s * 0.007, p.ink);
    // Tree of life branch in hand
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.018;
    g.beginPath();
    g.moveTo(s * 0.3, s * 0.7);
    g.lineTo(s * 0.34, s * 0.42);
    g.moveTo(s * 0.34, s * 0.54);
    g.lineTo(s * 0.44, s * 0.5);
    g.moveTo(s * 0.34, s * 0.48);
    g.lineTo(s * 0.22, s * 0.42);
    g.moveTo(s * 0.34, s * 0.42);
    g.lineTo(s * 0.4, s * 0.3);
    g.moveTo(s * 0.34, s * 0.42);
    g.lineTo(s * 0.26, s * 0.32);
    g.stroke();
    // Leaves
    g.fillStyle = p.accent2;
    circle(g, s * 0.44, s * 0.5, s * 0.018, p.accent2);
    circle(g, s * 0.22, s * 0.42, s * 0.018, p.accent2);
    circle(g, s * 0.4, s * 0.3, s * 0.018, p.accent2);
    circle(g, s * 0.26, s * 0.32, s * 0.018, p.accent2);
  },
};

const SUFFRAGETTE: Figure = {
  id: 'suffragette',
  draw(g, s, p) {
    // Edwardian walking dress
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.22, -s * 0.04);
    g.quadraticCurveTo(0, s * 0.02, s * 0.22, -s * 0.04);
    g.lineTo(s * 0.22, s * 0.3);
    g.lineTo(-s * 0.22, s * 0.3);
    g.closePath();
    g.fill();
    // Skirt
    g.beginPath();
    g.moveTo(-s * 0.22, s * 0.3);
    g.lineTo(s * 0.22, s * 0.3);
    g.lineTo(s * 0.36, s * 0.98);
    g.lineTo(-s * 0.36, s * 0.98);
    g.closePath();
    g.fill();
    // Purple/green/white suffragette sash
    g.fillStyle = p.accent2;
    g.save();
    g.translate(0, s * 0.14);
    g.rotate(-0.3);
    g.fillRect(-s * 0.4, -s * 0.04, s * 0.8, s * 0.07);
    g.fillStyle = '#ffffff';
    g.fillRect(-s * 0.4, s * 0.03, s * 0.8, s * 0.02);
    g.fillStyle = '#2a8a3a';
    g.fillRect(-s * 0.4, s * 0.05, s * 0.8, s * 0.04);
    g.restore();
    // Skin
    skin(g, 0, -s * 0.3, s);
    // Upswept Gibson-girl hair
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(0, -s * 0.48, s * 0.22, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(-s * 0.18, -s * 0.3, s * 0.08, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.18, -s * 0.3, s * 0.08, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    // Wide-brim hat
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(0, -s * 0.54, s * 0.3, s * 0.04, 0, 0, Math.PI * 2);
    g.fill();
    // Hat ribbon
    g.fillStyle = p.accent2;
    g.fillRect(-s * 0.18, -s * 0.58, s * 0.36, s * 0.03);
    // Eyes, determined
    circle(g, -s * 0.05, -s * 0.3, s * 0.012, p.ink);
    circle(g, s * 0.05, -s * 0.3, s * 0.012, p.ink);
    // "VOTES" placard on staff
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.02;
    g.beginPath();
    g.moveTo(s * 0.36, s * 0.96);
    g.lineTo(s * 0.36, -s * 0.2);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.fillRect(s * 0.18, -s * 0.4, s * 0.4, s * 0.22);
    g.fillStyle = p.accent2;
    g.font = `bold ${Math.round(s * 0.14)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('VOTES', s * 0.38, -s * 0.28);
  },
};

const MARX: Figure = {
  id: 'marx',
  draw(g, s, p) {
    frockCoat(g, s, p);
    skin(g, 0, -s * 0.28, s);
    // Massive beard & mustache
    g.fillStyle = '#c8c0b0';
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.3);
    g.quadraticCurveTo(-s * 0.28, -s * 0.1, -s * 0.12, s * 0.1);
    g.quadraticCurveTo(0, s * 0.22, s * 0.12, s * 0.1);
    g.quadraticCurveTo(s * 0.28, -s * 0.1, s * 0.18, -s * 0.3);
    g.quadraticCurveTo(0, -s * 0.14, -s * 0.18, -s * 0.3);
    g.closePath();
    g.fill();
    // Wild leonine hair
    g.fillStyle = '#c8c0b0';
    g.beginPath();
    g.ellipse(0, -s * 0.48, s * 0.24, s * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(-s * 0.18, -s * 0.38, s * 0.1, s * 0.14, -0.3, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.18, -s * 0.38, s * 0.1, s * 0.14, 0.3, 0, Math.PI * 2);
    g.fill();
    // Brow
    g.fillStyle = '#c8c0b0';
    g.fillRect(-s * 0.1, -s * 0.36, s * 0.07, s * 0.015);
    g.fillRect(s * 0.03, -s * 0.36, s * 0.07, s * 0.015);
    // Eyes
    circle(g, -s * 0.06, -s * 0.32, s * 0.01, p.ink);
    circle(g, s * 0.06, -s * 0.32, s * 0.01, p.ink);
    // Red-bound book (Das Kapital)
    g.fillStyle = '#a02020';
    g.fillRect(-s * 0.46, s * 0.38, s * 0.2, s * 0.26);
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.44, s * 0.4, s * 0.16, s * 0.02);
    g.fillRect(-s * 0.44, s * 0.6, s * 0.16, s * 0.02);
    // Title glyphs
    g.fillStyle = p.accent;
    g.font = `bold ${Math.round(s * 0.05)}px serif`;
    g.textAlign = 'center';
    g.fillText('K', -s * 0.36, s * 0.54);
    // Hammer-and-sickle in free hand
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.022;
    // Hammer handle
    g.beginPath();
    g.moveTo(s * 0.34, s * 0.58);
    g.lineTo(s * 0.48, s * 0.28);
    g.stroke();
    // Hammer head
    g.fillStyle = p.accent;
    g.fillRect(s * 0.42, s * 0.22, s * 0.12, s * 0.05);
    // Sickle blade
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.02;
    g.beginPath();
    g.arc(s * 0.42, s * 0.4, s * 0.12, -Math.PI * 0.2, Math.PI * 0.85);
    g.stroke();
  },
};

const FACTORY: Figure = {
  id: 'factory',
  draw(g, s, p) {
    // Ground
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.5, s * 0.86, s, s * 0.12);
    // Main building
    g.fillRect(-s * 0.4, s * 0.1, s * 0.7, s * 0.76);
    // Sawtooth roof
    g.beginPath();
    g.moveTo(-s * 0.4, s * 0.1);
    for (let i = 0; i < 4; i++) {
      const x = -s * 0.4 + i * s * 0.18;
      g.lineTo(x + s * 0.04, -s * 0.04);
      g.lineTo(x + s * 0.18, s * 0.1);
    }
    g.closePath();
    g.fill();
    // Tall chimneys
    g.fillRect(-s * 0.08, -s * 0.42, s * 0.08, s * 0.52);
    g.fillRect(s * 0.1, -s * 0.32, s * 0.06, s * 0.42);
    // Brick bands
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.08, -s * 0.4, s * 0.08, s * 0.02);
    g.fillRect(-s * 0.08, -s * 0.3, s * 0.08, s * 0.02);
    g.fillRect(s * 0.1, -s * 0.3, s * 0.06, s * 0.015);
    // Windows — lit
    g.fillStyle = p.accent;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        g.fillRect(-s * 0.36 + c * s * 0.16, s * 0.24 + r * s * 0.2, s * 0.08, s * 0.1);
      }
    }
    // Window cross
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.008;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const x = -s * 0.36 + c * s * 0.16;
        const y = s * 0.24 + r * s * 0.2;
        g.beginPath();
        g.moveTo(x + s * 0.04, y);
        g.lineTo(x + s * 0.04, y + s * 0.1);
        g.moveTo(x, y + s * 0.05);
        g.lineTo(x + s * 0.08, y + s * 0.05);
        g.stroke();
      }
    }
    // Smoke plumes
    g.fillStyle = 'rgba(140,140,140,0.55)';
    g.beginPath();
    g.ellipse(-s * 0.04, -s * 0.5, s * 0.12, s * 0.08, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(160,160,160,0.45)';
    g.beginPath();
    g.ellipse(s * 0.04, -s * 0.58, s * 0.16, s * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(190,190,190,0.35)';
    g.beginPath();
    g.ellipse(s * 0.16, -s * 0.48, s * 0.14, s * 0.09, 0, 0, Math.PI * 2);
    g.fill();
  },
};

export const REVOLUTION_PANTHEON: Pantheon = {
  palette: REVOLUTION_PALETTE,
  figures: [
    STEPHENSON,
    BRUNEL,
    EDISON,
    ADA_LOVELACE,
    DARWIN,
    SUFFRAGETTE,
    MARX,
    FACTORY,
  ] as const,
};
