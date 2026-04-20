import type { Figure, Palette, Pantheon } from './types.ts';

/**
 * Islamic Golden Age pantheon — figurative depiction of named persons is
 * generally avoided in this era's visual tradition, so the "deities" become
 * a set of geometric and instrumental icons: astrolabe, girih panel,
 * calligraphic tughra, alembic, celestial sphere, eight-point star,
 * astronomer's quadrant, arched mihrab. Three abstract robed silhouettes
 * suggest scholars without showing faces — they read as scholar archetypes
 * in line with traditional Islamic miniatures.
 *
 * Palette: deep lapis-blue ink with turquoise and gold accents — the
 * signature Iznik/Timurid colour pairing — over a warm amber halo for
 * pleasant contrast against the desert/aqua sky.
 */

const ISLAMIC_PALETTE: Palette = {
  ink: '#0a3360', // lapis blue ink
  accent: '#c9a14a', // gold leaf
  accent2: '#3aa49a', // turquoise tile
  glowInner: 'rgba(255, 232, 174, 0.95)',
  glowMid: 'rgba(180, 130, 60, 0.5)',
  glowEdge: 'rgba(20, 24, 40, 0)',
  halo: 'rgba(220, 200, 130, 0.7)',
};

function strokeArc(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  color: string,
  w: number,
): void {
  g.strokeStyle = color;
  g.lineWidth = w;
  g.beginPath();
  g.arc(cx, cy, r, a0, a1);
  g.stroke();
}

const ASTROLABE: Figure = {
  id: 'astrolabe',
  draw(g, s, p) {
    // Concentric rings, central rete, suspension ring at top.
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(0, s * 0.04, s * 0.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(0, s * 0.04, s * 0.46, 0, Math.PI * 2);
    g.fill();
    // Outer degree marks
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.012;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * s * 0.46, s * 0.04 + Math.sin(a) * s * 0.46);
      g.lineTo(Math.cos(a) * s * 0.42, s * 0.04 + Math.sin(a) * s * 0.42);
      g.stroke();
    }
    // Mid ring
    strokeArc(g, 0, s * 0.04, s * 0.36, 0, Math.PI * 2, p.accent2, s * 0.014);
    strokeArc(g, 0, s * 0.04, s * 0.26, 0, Math.PI * 2, p.accent, s * 0.014);
    // Rete star pointers
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.01;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.1;
      g.beginPath();
      g.moveTo(0, s * 0.04);
      g.lineTo(Math.cos(a) * s * 0.36, s * 0.04 + Math.sin(a) * s * 0.36);
      g.stroke();
      g.fillStyle = p.accent2;
      g.beginPath();
      g.arc(Math.cos(a) * s * 0.34, s * 0.04 + Math.sin(a) * s * 0.34, s * 0.018, 0, Math.PI * 2);
      g.fill();
    }
    // Central pivot
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(0, s * 0.04, s * 0.04, 0, Math.PI * 2);
    g.fill();
    // Suspension ring
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.018;
    g.beginPath();
    g.arc(0, -s * 0.62, s * 0.08, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(0, -s * 0.54);
    g.lineTo(0, -s * 0.46);
    g.stroke();
  },
};

const GIRIH: Figure = {
  id: 'girih',
  draw(g, s, p) {
    // 10-point girih star surrounded by interlocked decagons + bowties.
    g.fillStyle = p.accent2;
    const drawStar = (cx: number, cy: number, r: number, points: number, rotate: number) => {
      g.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const a = rotate + (i / (points * 2)) * Math.PI * 2;
        const rr = i % 2 === 0 ? r : r * 0.42;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.fill();
    };
    // Background tile field
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.5, -s * 0.5, s, s);
    // Gold lattice
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.008;
    for (let x = -4; x <= 4; x++) {
      g.beginPath();
      g.moveTo(x * s * 0.12, -s * 0.5);
      g.lineTo(x * s * 0.12 + s * 0.5, s * 0.5);
      g.stroke();
      g.beginPath();
      g.moveTo(x * s * 0.12, -s * 0.5);
      g.lineTo(x * s * 0.12 - s * 0.5, s * 0.5);
      g.stroke();
    }
    // Central 10-point star.
    g.fillStyle = p.accent;
    drawStar(0, 0, s * 0.34, 10, Math.PI / 10);
    // Inner decagon hole
    g.fillStyle = p.ink;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 10 + (i / 10) * Math.PI * 2;
      const x = Math.cos(a) * s * 0.14;
      const y = Math.sin(a) * s * 0.14;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
    // Small accent stars at corners.
    g.fillStyle = p.accent2;
    drawStar(-s * 0.36, -s * 0.36, s * 0.1, 8, 0);
    drawStar(s * 0.36, -s * 0.36, s * 0.1, 8, 0);
    drawStar(-s * 0.36, s * 0.36, s * 0.1, 8, 0);
    drawStar(s * 0.36, s * 0.36, s * 0.1, 8, 0);
  },
};

const TUGHRA: Figure = {
  id: 'tughra',
  draw(g, s, p) {
    // Calligraphic tughra-style monogram — sweeping vertical strokes capped
    // by interlocking loops. Pure shape; no actual letters.
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.46, -s * 0.46, s * 0.92, s * 0.92);
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.05;
    g.lineCap = 'round';
    // Three vertical reeds (ascenders).
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(i * s * 0.16 - s * 0.04, s * 0.36);
      g.lineTo(i * s * 0.16 - s * 0.02, -s * 0.36);
      g.stroke();
    }
    // Big sweeping baseline
    g.lineWidth = s * 0.06;
    g.beginPath();
    g.moveTo(-s * 0.4, s * 0.28);
    g.bezierCurveTo(-s * 0.2, s * 0.36, s * 0.2, s * 0.36, s * 0.4, s * 0.28);
    g.stroke();
    // Looping ribbons on the left
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.022;
    g.beginPath();
    g.moveTo(-s * 0.4, s * 0.0);
    g.bezierCurveTo(-s * 0.6, -s * 0.12, -s * 0.5, s * 0.18, -s * 0.32, s * 0.06);
    g.bezierCurveTo(-s * 0.18, s * 0.0, -s * 0.24, -s * 0.16, -s * 0.36, -s * 0.08);
    g.stroke();
    // Dots above (hamza-style)
    g.fillStyle = p.accent2;
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.arc(i * s * 0.16, -s * 0.42, s * 0.018, 0, Math.PI * 2);
      g.fill();
    }
  },
};

const SCHOLAR: Figure = {
  id: 'scholar',
  draw(g, s, p) {
    // Robed, turbaned scholar — head bowed over a manuscript.
    g.fillStyle = p.ink;
    // Robe — wide, falling to feet.
    g.beginPath();
    g.moveTo(-s * 0.34, -s * 0.04);
    g.lineTo(s * 0.34, -s * 0.04);
    g.lineTo(s * 0.46, s * 0.96);
    g.lineTo(-s * 0.46, s * 0.96);
    g.closePath();
    g.fill();
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.4, s * 0.46, s * 0.8, s * 0.04);
    // Shoulders / neck shadow
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(0, -s * 0.04, s * 0.34, s * 0.1, 0, Math.PI, 0);
    g.fill();
    // Turban — wrapped layers.
    g.fillStyle = p.accent2;
    g.beginPath();
    g.ellipse(0, -s * 0.36, s * 0.22, s * 0.18, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(0, -s * 0.32, s * 0.22, s * 0.06, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.accent2;
    g.beginPath();
    g.ellipse(0, -s * 0.42, s * 0.18, s * 0.05, 0, 0, Math.PI * 2);
    g.fill();
    // Aigrette — gold feather pin
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(0, -s * 0.5);
    g.quadraticCurveTo(s * 0.04, -s * 0.7, 0, -s * 0.78);
    g.quadraticCurveTo(-s * 0.04, -s * 0.7, 0, -s * 0.5);
    g.closePath();
    g.fill();
    // Manuscript held open in hands.
    g.fillStyle = '#f6e9c4';
    g.fillRect(-s * 0.22, s * 0.16, s * 0.44, s * 0.18);
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.moveTo(0, s * 0.16);
    g.lineTo(0, s * 0.34);
    g.stroke();
    // Calligraphic squiggles on the page.
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.008;
    for (let row = 0; row < 4; row++) {
      const y = s * 0.2 + row * s * 0.034;
      g.beginPath();
      g.moveTo(-s * 0.18, y);
      g.bezierCurveTo(-s * 0.12, y - s * 0.005, -s * 0.06, y + s * 0.005, -s * 0.02, y);
      g.stroke();
      g.beginPath();
      g.moveTo(s * 0.04, y);
      g.bezierCurveTo(s * 0.1, y - s * 0.005, s * 0.16, y + s * 0.005, s * 0.18, y);
      g.stroke();
    }
  },
};

const ALEMBIC: Figure = {
  id: 'alembic',
  draw(g, s, p) {
    // Distillation flask + curved swan-neck condenser — alchemy / chemistry icon.
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(0, s * 0.4, s * 0.3, s * 0.36, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(0, s * 0.4, s * 0.26, s * 0.32, 0, 0, Math.PI * 2);
    g.fill();
    // Liquid inside
    g.fillStyle = p.accent2;
    g.beginPath();
    g.ellipse(0, s * 0.5, s * 0.22, s * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    // Neck rising up
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.05, s * 0.04, s * 0.1, s * 0.08);
    // Swan-neck condenser arching over to a small receiver.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.05;
    g.beginPath();
    g.moveTo(0, s * 0.04);
    g.bezierCurveTo(0, -s * 0.3, s * 0.4, -s * 0.3, s * 0.4, s * 0.1);
    g.lineTo(s * 0.4, s * 0.4);
    g.stroke();
    // Receiver flask
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(s * 0.4, s * 0.5, s * 0.12, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.accent2;
    g.beginPath();
    g.ellipse(s * 0.4, s * 0.55, s * 0.08, s * 0.08, 0, 0, Math.PI * 2);
    g.fill();
    // Flame underneath
    g.fillStyle = '#e07020';
    g.beginPath();
    g.moveTo(-s * 0.16, s * 0.84);
    g.quadraticCurveTo(-s * 0.06, s * 0.7, 0, s * 0.84);
    g.quadraticCurveTo(s * 0.06, s * 0.7, s * 0.16, s * 0.84);
    g.lineTo(s * 0.18, s * 0.92);
    g.lineTo(-s * 0.18, s * 0.92);
    g.closePath();
    g.fill();
    g.fillStyle = '#f4d878';
    g.beginPath();
    g.moveTo(-s * 0.08, s * 0.86);
    g.quadraticCurveTo(0, s * 0.78, s * 0.08, s * 0.86);
    g.lineTo(s * 0.08, s * 0.92);
    g.lineTo(-s * 0.08, s * 0.92);
    g.closePath();
    g.fill();
  },
};

const CELESTIAL_SPHERE: Figure = {
  id: 'celestial_sphere',
  draw(g, s, p) {
    // Brass armillary-style sphere with constellation marks — al-Sufi tradition.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.018;
    // Outer ring
    g.beginPath();
    g.arc(0, 0, s * 0.42, 0, Math.PI * 2);
    g.stroke();
    // Equator (horizontal ellipse)
    g.beginPath();
    g.ellipse(0, 0, s * 0.42, s * 0.12, 0, 0, Math.PI * 2);
    g.stroke();
    // Ecliptic — tilted ellipse
    g.strokeStyle = p.accent2;
    g.beginPath();
    g.ellipse(0, 0, s * 0.42, s * 0.16, 0.4, 0, Math.PI * 2);
    g.stroke();
    // Meridian
    g.strokeStyle = p.accent;
    g.beginPath();
    g.ellipse(0, 0, s * 0.12, s * 0.42, 0, 0, Math.PI * 2);
    g.stroke();
    // Zodiac tick marks on equator
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.12);
      g.lineTo(Math.cos(a) * s * 0.46, Math.sin(a) * s * 0.13);
      g.stroke();
    }
    // Star points sprinkled around
    g.fillStyle = p.accent;
    const stars = [
      [-0.22, -0.18], [0.18, -0.24], [0.3, 0.04], [-0.04, 0.22],
      [0.12, -0.04], [-0.3, 0.06], [0.26, 0.22], [-0.18, 0.28],
    ];
    for (const [sx, sy] of stars) {
      g.beginPath();
      g.arc(sx * s, sy * s, s * 0.012, 0, Math.PI * 2);
      g.fill();
    }
    // Stand pillar
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.04;
    g.beginPath();
    g.moveTo(0, s * 0.42);
    g.lineTo(0, s * 0.86);
    g.stroke();
    // Tripod base
    g.beginPath();
    g.moveTo(0, s * 0.86);
    g.lineTo(-s * 0.18, s * 0.96);
    g.moveTo(0, s * 0.86);
    g.lineTo(s * 0.18, s * 0.96);
    g.moveTo(-s * 0.18, s * 0.96);
    g.lineTo(s * 0.18, s * 0.96);
    g.stroke();
  },
};

const QUADRANT: Figure = {
  id: 'quadrant',
  draw(g, s, p) {
    // Astronomer's quadrant — quarter-circle scale + plumb line.
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.4, s * 0.4);
    g.lineTo(s * 0.5, s * 0.4);
    g.lineTo(-s * 0.4, -s * 0.5);
    g.closePath();
    g.fill();
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.36, s * 0.36);
    g.lineTo(s * 0.42, s * 0.36);
    g.lineTo(-s * 0.36, -s * 0.42);
    g.closePath();
    g.fill();
    // Arc edge
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.arc(-s * 0.4, s * 0.4, s * 0.84, -Math.PI / 2, 0);
    g.stroke();
    // Degree ticks
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.008;
    for (let i = 0; i <= 18; i++) {
      const a = -Math.PI / 2 + (i / 18) * (Math.PI / 2);
      const r0 = s * 0.78;
      const r1 = i % 3 === 0 ? s * 0.86 : s * 0.82;
      g.beginPath();
      g.moveTo(-s * 0.4 + Math.cos(a) * r0, s * 0.4 + Math.sin(a) * r0);
      g.lineTo(-s * 0.4 + Math.cos(a) * r1, s * 0.4 + Math.sin(a) * r1);
      g.stroke();
    }
    // Sighting alidade
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.024;
    g.beginPath();
    g.moveTo(-s * 0.4, s * 0.4);
    g.lineTo(s * 0.34, -s * 0.18);
    g.stroke();
    // Plumb line
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.moveTo(-s * 0.4, s * 0.4);
    g.lineTo(-s * 0.4, s * 1.0);
    g.stroke();
    g.fillStyle = p.accent2;
    g.beginPath();
    g.moveTo(-s * 0.42, s * 0.96);
    g.lineTo(-s * 0.38, s * 0.96);
    g.lineTo(-s * 0.4, s * 1.04);
    g.closePath();
    g.fill();
  },
};

const MIHRAB: Figure = {
  id: 'mihrab',
  draw(g, s, p) {
    // Pointed arch / mihrab niche framing a hanging mosque lamp.
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.36, s * 0.5);
    g.lineTo(-s * 0.36, -s * 0.18);
    g.quadraticCurveTo(-s * 0.36, -s * 0.5, 0, -s * 0.62);
    g.quadraticCurveTo(s * 0.36, -s * 0.5, s * 0.36, -s * 0.18);
    g.lineTo(s * 0.36, s * 0.5);
    g.closePath();
    g.fill();
    // Inner niche
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.3, s * 0.5);
    g.lineTo(-s * 0.3, -s * 0.16);
    g.quadraticCurveTo(-s * 0.3, -s * 0.46, 0, -s * 0.56);
    g.quadraticCurveTo(s * 0.3, -s * 0.46, s * 0.3, -s * 0.16);
    g.lineTo(s * 0.3, s * 0.5);
    g.closePath();
    g.fill();
    // Tile pattern fill — small stars
    g.fillStyle = p.accent2;
    for (let r = 0; r < 5; r++) {
      for (let c = -2; c <= 2; c++) {
        const x = c * s * 0.1;
        const y = -s * 0.2 + r * s * 0.12;
        if (Math.abs(x) > s * 0.24 - r * 0.02) continue;
        g.beginPath();
        g.arc(x, y, s * 0.012, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Hanging mosque lamp
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.moveTo(0, -s * 0.56);
    g.lineTo(0, -s * 0.18);
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(0, -s * 0.04, s * 0.12, s * 0.18, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff5cc';
    g.beginPath();
    g.ellipse(0, -s * 0.02, s * 0.07, s * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    // Floor
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.42, s * 0.5, s * 0.84, s * 0.08);
    g.fillRect(-s * 0.46, s * 0.58, s * 0.92, s * 0.04);
  },
};

export const ISLAMIC_PANTHEON: Pantheon = {
  palette: ISLAMIC_PALETTE,
  figures: [ASTROLABE, GIRIH, TUGHRA, SCHOLAR, ALEMBIC, CELESTIAL_SPHERE, QUADRANT, MIHRAB],
};
