import { drawTogaBody } from './common.ts';
import type { Figure, Palette, Pantheon } from './types.ts';

/**
 * Greek pantheon — eight Olympians rendered as marble-pale figures with a
 * cool cyan halo. Palette deliberately contrasts the Greek sky's deep
 * indigo: warm bronze accents over chalky white skin make the silhouettes
 * pop instead of dissolving into the background.
 */

const GREECE_PALETTE: Palette = {
  ink: '#f4ecdc', // cream marble (figures are bright on dark sky)
  accent: '#c89752', // bronze / olive-bronze accent
  accent2: '#7fd6ff', // sky cyan secondary
  glowInner: 'rgba(220, 240, 255, 0.95)',
  glowMid: 'rgba(80, 150, 220, 0.5)',
  glowEdge: 'rgba(8, 16, 40, 0)',
  halo: 'rgba(160, 220, 255, 0.7)',
};

function head(g: CanvasRenderingContext2D, s: number, p: Palette): void {
  g.fillStyle = p.ink;
  // Head + neck — clean marble oval.
  g.fillRect(-s * 0.06, -s * 0.1, s * 0.12, s * 0.14);
  g.beginPath();
  g.ellipse(0, -s * 0.28, s * 0.16, s * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  // Subtle facial hint — a thin bronze browline + eye dot.
  g.fillStyle = p.accent;
  g.fillRect(-s * 0.06, -s * 0.32, s * 0.12, s * 0.012);
  g.beginPath();
  g.arc(s * 0.04, -s * 0.28, s * 0.018, 0, Math.PI * 2);
  g.fill();
}

function curlyHair(
  g: CanvasRenderingContext2D,
  s: number,
  p: Palette,
  laurel = false,
): void {
  g.fillStyle = p.accent;
  // Curls cap on the head.
  for (let i = -3; i <= 3; i++) {
    g.beginPath();
    g.arc(i * s * 0.04, -s * 0.42 + Math.abs(i) * s * 0.005, s * 0.04, 0, Math.PI * 2);
    g.fill();
  }
  if (laurel) {
    // Laurel wreath of small leaves over the curls.
    g.fillStyle = p.accent2;
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const x = dir * (s * 0.06 + i * s * 0.04);
        const y = -s * 0.46 + i * s * 0.01;
        g.save();
        g.translate(x, y);
        g.rotate(dir * (-0.4 - i * 0.15));
        g.beginPath();
        g.ellipse(0, 0, s * 0.04, s * 0.014, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
  }
}

const ZEUS: Figure = {
  id: 'zeus',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    head(g, s, p);
    // Beard — long bronze wedge.
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.12, -s * 0.18);
    g.quadraticCurveTo(0, -s * 0.04, s * 0.12, -s * 0.18);
    g.lineTo(s * 0.08, -s * 0.06);
    g.quadraticCurveTo(0, s * 0.04, -s * 0.08, -s * 0.06);
    g.closePath();
    g.fill();
    curlyHair(g, s, p);
    // Lightning bolt held in the right hand — jagged zig-zag.
    g.fillStyle = p.accent2;
    g.beginPath();
    g.moveTo(s * 0.32, -s * 0.18);
    g.lineTo(s * 0.42, s * 0.04);
    g.lineTo(s * 0.34, s * 0.04);
    g.lineTo(s * 0.46, s * 0.34);
    g.lineTo(s * 0.34, s * 0.18);
    g.lineTo(s * 0.4, s * 0.18);
    g.lineTo(s * 0.28, -s * 0.06);
    g.closePath();
    g.fill();
    // Arm + hand to bolt
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.06;
    g.beginPath();
    g.moveTo(s * 0.2, s * 0.08);
    g.lineTo(s * 0.32, -s * 0.1);
    g.stroke();
  },
};

const ATHENA: Figure = {
  id: 'athena',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    head(g, s, p);
    // Corinthian helmet with crest.
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.32);
    g.quadraticCurveTo(0, -s * 0.6, s * 0.18, -s * 0.32);
    g.lineTo(s * 0.18, -s * 0.18);
    g.lineTo(-s * 0.18, -s * 0.18);
    g.closePath();
    g.fill();
    // Eye slit + nasal guard
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.12, -s * 0.34, s * 0.24, s * 0.04);
    g.fillRect(-s * 0.014, -s * 0.34, s * 0.028, s * 0.18);
    // Crest plume — sweeping arc of cyan bristles.
    g.fillStyle = p.accent2;
    g.beginPath();
    g.moveTo(0, -s * 0.6);
    g.quadraticCurveTo(s * 0.32, -s * 0.5, s * 0.34, -s * 0.18);
    g.lineTo(s * 0.22, -s * 0.18);
    g.quadraticCurveTo(s * 0.18, -s * 0.42, 0, -s * 0.5);
    g.closePath();
    g.fill();
    // Owl perched on left shoulder — small round body + ear tufts.
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(-s * 0.32, -s * 0.04, s * 0.08, s * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(-s * 0.38, -s * 0.12);
    g.lineTo(-s * 0.34, -s * 0.18);
    g.lineTo(-s * 0.3, -s * 0.12);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(-s * 0.34, -s * 0.12);
    g.lineTo(-s * 0.3, -s * 0.18);
    g.lineTo(-s * 0.26, -s * 0.12);
    g.closePath();
    g.fill();
    g.fillStyle = p.accent2;
    g.beginPath();
    g.arc(-s * 0.34, -s * 0.06, s * 0.014, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(-s * 0.28, -s * 0.06, s * 0.014, 0, Math.PI * 2);
    g.fill();
    // Spear in right hand.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.025;
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.6);
    g.lineTo(s * 0.34, s * 0.86);
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.7);
    g.lineTo(s * 0.4, -s * 0.58);
    g.lineTo(s * 0.28, -s * 0.58);
    g.closePath();
    g.fill();
  },
};

const APOLLO: Figure = {
  id: 'apollo',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    head(g, s, p);
    curlyHair(g, s, p, true);
    // Lyre on the left.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.026;
    // Curved arms of the lyre.
    g.beginPath();
    g.moveTo(-s * 0.32, s * 0.46);
    g.quadraticCurveTo(-s * 0.5, s * 0.18, -s * 0.42, -s * 0.04);
    g.stroke();
    g.beginPath();
    g.moveTo(-s * 0.18, s * 0.46);
    g.quadraticCurveTo(-s * 0.04, s * 0.18, -s * 0.16, -s * 0.04);
    g.stroke();
    // Crossbar
    g.beginPath();
    g.moveTo(-s * 0.42, -s * 0.04);
    g.lineTo(-s * 0.16, -s * 0.04);
    g.stroke();
    // Strings
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.008;
    for (let i = 0; i < 5; i++) {
      const x = -s * 0.4 + i * s * 0.06;
      g.beginPath();
      g.moveTo(x, -s * 0.04);
      g.lineTo(x, s * 0.42);
      g.stroke();
    }
    // Sound box at base
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(-s * 0.25, s * 0.46, s * 0.14, s * 0.06, 0, 0, Math.PI * 2);
    g.fill();
    // Sun-burst halo behind the head.
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.014;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * s * 0.22, -s * 0.28 + Math.sin(a) * s * 0.22);
      g.lineTo(Math.cos(a) * s * 0.3, -s * 0.28 + Math.sin(a) * s * 0.3);
      g.stroke();
    }
  },
};

const POSEIDON: Figure = {
  id: 'poseidon',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    head(g, s, p);
    // Thick wavy hair + beard suggesting sea foam.
    g.fillStyle = p.accent2;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.arc(i * s * 0.045, -s * 0.42, s * 0.045, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.moveTo(-s * 0.14, -s * 0.18);
    g.quadraticCurveTo(0, s * 0.04, s * 0.14, -s * 0.18);
    g.lineTo(s * 0.1, -s * 0.04);
    g.quadraticCurveTo(0, s * 0.08, -s * 0.1, -s * 0.04);
    g.closePath();
    g.fill();
    // Trident — central shaft + three prongs.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.03;
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.6);
    g.lineTo(s * 0.34, s * 0.86);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.6);
    g.lineTo(s * 0.18, -s * 0.78);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.6);
    g.lineTo(s * 0.34, -s * 0.84);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.6);
    g.lineTo(s * 0.5, -s * 0.78);
    g.stroke();
    // Wave at his feet.
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.018;
    g.beginPath();
    g.moveTo(-s * 0.36, s * 0.96);
    g.quadraticCurveTo(-s * 0.18, s * 0.86, 0, s * 0.96);
    g.quadraticCurveTo(s * 0.18, s * 1.06, s * 0.36, s * 0.96);
    g.stroke();
  },
};

const ARTEMIS: Figure = {
  id: 'artemis',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    head(g, s, p);
    // Long hair tied back, lunar crescent above.
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.16, -s * 0.36);
    g.lineTo(-s * 0.2, -s * 0.04);
    g.lineTo(-s * 0.1, -s * 0.08);
    g.lineTo(-s * 0.1, -s * 0.36);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.16, -s * 0.36);
    g.lineTo(s * 0.2, -s * 0.04);
    g.lineTo(s * 0.1, -s * 0.08);
    g.lineTo(s * 0.1, -s * 0.36);
    g.closePath();
    g.fill();
    // Crescent moon over head.
    g.fillStyle = p.accent2;
    g.beginPath();
    g.arc(0, -s * 0.58, s * 0.12, 0.2, Math.PI - 0.2, false);
    g.arc(s * 0.04, -s * 0.58, s * 0.1, Math.PI - 0.2, 0.2, true);
    g.closePath();
    g.fill();
    // Bow held vertically on the left.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.028;
    g.beginPath();
    g.arc(-s * 0.3, s * 0.18, s * 0.42, -Math.PI * 0.45, Math.PI * 0.45);
    g.stroke();
    // Bowstring
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.01;
    g.beginPath();
    g.moveTo(-s * 0.3 + Math.cos(-Math.PI * 0.45) * s * 0.42, s * 0.18 + Math.sin(-Math.PI * 0.45) * s * 0.42);
    g.lineTo(-s * 0.3 + Math.cos(Math.PI * 0.45) * s * 0.42, s * 0.18 + Math.sin(Math.PI * 0.45) * s * 0.42);
    g.stroke();
    // Arrow nocked
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.moveTo(-s * 0.06, s * 0.18);
    g.lineTo(-s * 0.34, s * 0.18);
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.06, s * 0.18);
    g.lineTo(-s * 0.14, s * 0.14);
    g.lineTo(-s * 0.14, s * 0.22);
    g.closePath();
    g.fill();
  },
};

const DIONYSUS: Figure = {
  id: 'dionysus',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    head(g, s, p);
    curlyHair(g, s, p);
    // Grapevine wreath — small clustered berries instead of laurel.
    g.fillStyle = '#7a3da8';
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const x = dir * (s * 0.04 + i * s * 0.04);
        const y = -s * 0.5 + Math.abs(i - 2) * s * 0.012;
        g.beginPath();
        g.arc(x, y, s * 0.022, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Vine leaf in the middle
    g.fillStyle = p.accent2;
    g.beginPath();
    g.moveTo(0, -s * 0.6);
    g.lineTo(s * 0.04, -s * 0.5);
    g.lineTo(0, -s * 0.46);
    g.lineTo(-s * 0.04, -s * 0.5);
    g.closePath();
    g.fill();
    // Kantharos cup in right hand.
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(s * 0.26, s * 0.0);
    g.lineTo(s * 0.42, s * 0.0);
    g.lineTo(s * 0.4, s * 0.18);
    g.lineTo(s * 0.28, s * 0.18);
    g.closePath();
    g.fill();
    // Curved handles
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.014;
    g.beginPath();
    g.arc(s * 0.26, s * 0.08, s * 0.06, -Math.PI / 2, Math.PI / 2);
    g.stroke();
    g.beginPath();
    g.arc(s * 0.42, s * 0.08, s * 0.06, Math.PI / 2, -Math.PI / 2, true);
    g.stroke();
    // Wine surface
    g.fillStyle = '#7a3da8';
    g.fillRect(s * 0.28, s * 0.0, s * 0.12, s * 0.012);
    // Thyrsus staff — pinecone tipped — in left hand.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.022;
    g.beginPath();
    g.moveTo(-s * 0.34, -s * 0.5);
    g.lineTo(-s * 0.34, s * 0.86);
    g.stroke();
    g.fillStyle = p.accent;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        g.beginPath();
        g.arc(-s * 0.34 + (c - 0.5) * s * 0.04, -s * 0.5 - r * s * 0.04, s * 0.024, 0, Math.PI * 2);
        g.fill();
      }
    }
  },
};

const HERMES: Figure = {
  id: 'hermes',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    head(g, s, p);
    curlyHair(g, s, p);
    // Petasos cap with small wings.
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(0, -s * 0.46, s * 0.16, s * 0.05, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(0, -s * 0.5, s * 0.1, s * 0.08, 0, Math.PI, 0);
    g.fill();
    // Wings on the cap
    g.fillStyle = p.accent2;
    g.beginPath();
    g.moveTo(-s * 0.16, -s * 0.46);
    g.quadraticCurveTo(-s * 0.32, -s * 0.58, -s * 0.32, -s * 0.42);
    g.lineTo(-s * 0.16, -s * 0.42);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.16, -s * 0.46);
    g.quadraticCurveTo(s * 0.32, -s * 0.58, s * 0.32, -s * 0.42);
    g.lineTo(s * 0.16, -s * 0.42);
    g.closePath();
    g.fill();
    // Caduceus — staff with two intertwined snakes + wings on top.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.03;
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.32);
    g.lineTo(s * 0.34, s * 0.86);
    g.stroke();
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.012;
    for (let i = 0; i < 3; i++) {
      const y0 = -s * 0.2 + i * s * 0.18;
      g.beginPath();
      g.moveTo(s * 0.28, y0);
      g.quadraticCurveTo(s * 0.4, y0 + s * 0.045, s * 0.28, y0 + s * 0.09);
      g.stroke();
      g.beginPath();
      g.moveTo(s * 0.4, y0);
      g.quadraticCurveTo(s * 0.28, y0 + s * 0.045, s * 0.4, y0 + s * 0.09);
      g.stroke();
    }
    // Top wings of caduceus
    g.fillStyle = p.accent2;
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.32);
    g.quadraticCurveTo(s * 0.18, -s * 0.42, s * 0.22, -s * 0.3);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.32);
    g.quadraticCurveTo(s * 0.5, -s * 0.42, s * 0.46, -s * 0.3);
    g.closePath();
    g.fill();
    // Small wings at the ankles (sandals).
    g.fillStyle = p.accent2;
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.moveTo(dir * s * 0.06, s * 0.94);
      g.quadraticCurveTo(dir * s * 0.22, s * 0.86, dir * s * 0.18, s * 0.98);
      g.closePath();
      g.fill();
    }
  },
};

const HADES: Figure = {
  id: 'hades',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    head(g, s, p);
    // Dark crown of cypress points.
    g.fillStyle = '#3a2a18';
    g.beginPath();
    for (let i = 0; i < 7; i++) {
      const x = -s * 0.18 + (i * s * 0.06);
      g.lineTo(x, -s * 0.5);
      g.lineTo(x + s * 0.03, -s * 0.62);
    }
    g.lineTo(s * 0.18, -s * 0.42);
    g.lineTo(-s * 0.18, -s * 0.42);
    g.closePath();
    g.fill();
    // Beard
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.12, -s * 0.18);
    g.quadraticCurveTo(0, -s * 0.04, s * 0.12, -s * 0.18);
    g.lineTo(s * 0.08, -s * 0.04);
    g.quadraticCurveTo(0, s * 0.06, -s * 0.08, -s * 0.04);
    g.closePath();
    g.fill();
    // Bident — two-pronged staff.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.028;
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.42);
    g.lineTo(s * 0.34, s * 0.86);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.42);
    g.lineTo(s * 0.22, -s * 0.7);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.42);
    g.lineTo(s * 0.46, -s * 0.7);
    g.stroke();
    // Cerberus — three small dog heads at his feet.
    g.fillStyle = '#22140a';
    for (let i = 0; i < 3; i++) {
      const x = -s * 0.36 + i * s * 0.18;
      g.beginPath();
      g.ellipse(x, s * 0.86, s * 0.08, s * 0.06, 0, 0, Math.PI * 2);
      g.fill();
      // Ears
      g.beginPath();
      g.moveTo(x - s * 0.06, s * 0.82);
      g.lineTo(x - s * 0.04, s * 0.74);
      g.lineTo(x - s * 0.02, s * 0.82);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(x + s * 0.02, s * 0.82);
      g.lineTo(x + s * 0.04, s * 0.74);
      g.lineTo(x + s * 0.06, s * 0.82);
      g.closePath();
      g.fill();
      // Glowing eyes
      g.fillStyle = p.accent2;
      g.beginPath();
      g.arc(x - s * 0.025, s * 0.86, s * 0.012, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(x + s * 0.025, s * 0.86, s * 0.012, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#22140a';
    }
  },
};

export const GREECE_PANTHEON: Pantheon = {
  palette: GREECE_PALETTE,
  figures: [ZEUS, ATHENA, APOLLO, POSEIDON, ARTEMIS, DIONYSUS, HERMES, HADES],
};
