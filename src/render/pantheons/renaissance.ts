import { drawTogaBody } from './common.ts';
import type { Figure, Palette, Pantheon } from './types.ts';

/**
 * Italian Renaissance pantheon — the revival's cultural icons: Leonardo's
 * Vitruvian Man, Michelangelo's David, Botticelli's Venus, Galileo with
 * telescope, Dante with laurel, Brunelleschi cupola, Raphael's cherub, and
 * the Mona Lisa silhouette. Palette: sepia-ink on aged-parchment cream with
 * cobalt-azure accents — the canonical "study from a sketchbook" look
 * set against the Renaissance flow's deep-red sky.
 */

const RENAISSANCE_PALETTE: Palette = {
  ink: '#2d1c0a', // sepia ink
  accent: '#c98a3e', // burnt sienna / gold leaf
  accent2: '#2a6fa6', // Florentine cobalt
  glowInner: 'rgba(245, 228, 190, 0.95)',
  glowMid: 'rgba(160, 110, 70, 0.5)',
  glowEdge: 'rgba(40, 18, 8, 0)',
  halo: 'rgba(230, 200, 140, 0.7)',
};

const VITRUVIAN: Figure = {
  id: 'vitruvian',
  draw(g, s, p) {
    // Circle + inscribed square + the four-limbed figure.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.014;
    g.beginPath();
    g.arc(0, s * 0.04, s * 0.48, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.014;
    g.strokeRect(-s * 0.42, -s * 0.38, s * 0.84, s * 0.84);
    // Standing figure — spread-eagle with overlaid outstretched variant.
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.02;
    // Head
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(0, -s * 0.34, s * 0.08, 0, Math.PI * 2);
    g.fill();
    // Torso
    g.beginPath();
    g.moveTo(0, -s * 0.26);
    g.lineTo(0, s * 0.2);
    g.stroke();
    // Legs straight down
    g.beginPath();
    g.moveTo(0, s * 0.2);
    g.lineTo(-s * 0.14, s * 0.46);
    g.moveTo(0, s * 0.2);
    g.lineTo(s * 0.14, s * 0.46);
    g.stroke();
    // Legs spread
    g.beginPath();
    g.moveTo(0, s * 0.2);
    g.lineTo(-s * 0.3, s * 0.44);
    g.moveTo(0, s * 0.2);
    g.lineTo(s * 0.3, s * 0.44);
    g.stroke();
    // Arms level
    g.beginPath();
    g.moveTo(0, -s * 0.18);
    g.lineTo(-s * 0.42, -s * 0.18);
    g.moveTo(0, -s * 0.18);
    g.lineTo(s * 0.42, -s * 0.18);
    g.stroke();
    // Arms raised
    g.beginPath();
    g.moveTo(0, -s * 0.18);
    g.lineTo(-s * 0.34, -s * 0.38);
    g.moveTo(0, -s * 0.18);
    g.lineTo(s * 0.34, -s * 0.38);
    g.stroke();
    // Mirror-script notation strokes at top/bottom (decorative).
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.006;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(-s * 0.46 + i * s * 0.08, -s * 0.5);
      g.bezierCurveTo(
        -s * 0.44 + i * s * 0.08, -s * 0.52,
        -s * 0.42 + i * s * 0.08, -s * 0.48,
        -s * 0.4 + i * s * 0.08, -s * 0.5,
      );
      g.stroke();
    }
  },
};

const DAVID: Figure = {
  id: 'david',
  draw(g, s, p) {
    // Marble David — contrapposto, sling on shoulder.
    // Use pale marble for the body over the sepia ink.
    g.fillStyle = '#f4e8d0';
    // Torso + kneeling leg stance
    g.beginPath();
    g.moveTo(-s * 0.14, -s * 0.04);
    g.lineTo(s * 0.14, -s * 0.04);
    g.lineTo(s * 0.1, s * 0.18);
    g.lineTo(-s * 0.12, s * 0.22);
    g.closePath();
    g.fill();
    // Hips/sash
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.14, s * 0.18);
    g.lineTo(s * 0.14, s * 0.14);
    g.lineTo(s * 0.14, s * 0.26);
    g.lineTo(-s * 0.14, s * 0.3);
    g.closePath();
    g.fill();
    // Legs
    g.fillStyle = '#f4e8d0';
    g.fillRect(-s * 0.1, s * 0.26, s * 0.08, s * 0.5);
    g.save();
    g.translate(s * 0.04, s * 0.26);
    g.rotate(0.2);
    g.fillRect(0, 0, s * 0.08, s * 0.5);
    g.restore();
    // Head
    g.fillStyle = '#f4e8d0';
    g.beginPath();
    g.ellipse(0, -s * 0.18, s * 0.1, s * 0.13, 0, 0, Math.PI * 2);
    g.fill();
    // Curly hair
    g.fillStyle = p.ink;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.arc(i * s * 0.04, -s * 0.3, s * 0.03, 0, Math.PI * 2);
      g.fill();
    }
    // Eye hints
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(-s * 0.04, -s * 0.18, s * 0.008, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.04, -s * 0.18, s * 0.008, 0, Math.PI * 2);
    g.fill();
    // Arms — left slung with sling, right relaxed at side.
    g.strokeStyle = '#f4e8d0';
    g.lineWidth = s * 0.06;
    g.beginPath();
    g.moveTo(-s * 0.12, -s * 0.02);
    g.lineTo(-s * 0.28, s * 0.2);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.12, -s * 0.02);
    g.lineTo(s * 0.22, s * 0.24);
    g.stroke();
    // Sling strap over shoulder
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.01;
    g.beginPath();
    g.moveTo(-s * 0.12, -s * 0.02);
    g.bezierCurveTo(-s * 0.24, -s * 0.3, s * 0.2, -s * 0.3, s * 0.22, s * 0.0);
    g.stroke();
    // Pedestal
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.26, s * 0.78, s * 0.52, s * 0.1);
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.28, s * 0.88, s * 0.56, s * 0.04);
  },
};

const VENUS: Figure = {
  id: 'venus',
  draw(g, s, p) {
    // Botticelli's Venus on a scallop shell — flowing hair, demure pose.
    // Scallop shell
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.46, s * 0.72);
    g.quadraticCurveTo(0, s * 0.52, s * 0.46, s * 0.72);
    g.lineTo(s * 0.42, s * 0.96);
    g.lineTo(-s * 0.42, s * 0.96);
    g.closePath();
    g.fill();
    // Shell ridges
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.01;
    for (let i = -4; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * s * 0.1, s * 0.96);
      g.lineTo(i * s * 0.04, s * 0.54);
      g.stroke();
    }
    // Body — pale with flowing red-gold hair as modesty.
    g.fillStyle = '#f4e8d0';
    g.beginPath();
    g.moveTo(-s * 0.14, s * 0.5);
    g.lineTo(s * 0.14, s * 0.5);
    g.lineTo(s * 0.1, s * 0.2);
    g.lineTo(-s * 0.1, s * 0.2);
    g.closePath();
    g.fill();
    // Head
    g.beginPath();
    g.ellipse(0, -s * 0.04, s * 0.13, s * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    // Long cascading hair
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.12, -s * 0.16);
    g.quadraticCurveTo(-s * 0.4, s * 0.06, -s * 0.16, s * 0.36);
    g.lineTo(s * 0.0, s * 0.18);
    g.lineTo(-s * 0.12, -s * 0.04);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.12, -s * 0.16);
    g.quadraticCurveTo(s * 0.3, -s * 0.04, s * 0.2, s * 0.2);
    g.quadraticCurveTo(s * 0.12, s * 0.32, s * 0.0, s * 0.24);
    g.closePath();
    g.fill();
    // Eyes
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(-s * 0.04, -s * 0.04, s * 0.008, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.04, -s * 0.04, s * 0.008, 0, Math.PI * 2);
    g.fill();
    // Arms covering
    g.strokeStyle = '#f4e8d0';
    g.lineWidth = s * 0.08;
    g.beginPath();
    g.moveTo(-s * 0.12, s * 0.28);
    g.lineTo(-s * 0.02, s * 0.42);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.12, s * 0.28);
    g.lineTo(s * 0.12, s * 0.5);
    g.stroke();
    // Wind-swept rose petals
    g.fillStyle = p.accent2;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.ellipse(-s * 0.4 - i * s * 0.05, -s * 0.2 + i * s * 0.04, s * 0.024, s * 0.012, 0.4, 0, Math.PI * 2);
      g.fill();
    }
  },
};

const GALILEO: Figure = {
  id: 'galileo',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    // Bearded scholar — head with skullcap + cascading beard.
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.06, -s * 0.1, s * 0.12, s * 0.14);
    g.beginPath();
    g.ellipse(0, -s * 0.28, s * 0.15, s * 0.19, 0, 0, Math.PI * 2);
    g.fill();
    // Skullcap
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(0, -s * 0.42, s * 0.16, s * 0.07, 0, Math.PI, 0);
    g.fill();
    // Beard
    g.fillStyle = '#5a3a1a';
    g.beginPath();
    g.moveTo(-s * 0.1, -s * 0.14);
    g.quadraticCurveTo(0, s * 0.06, s * 0.1, -s * 0.14);
    g.lineTo(s * 0.06, -s * 0.02);
    g.quadraticCurveTo(0, s * 0.1, -s * 0.06, -s * 0.02);
    g.closePath();
    g.fill();
    // Telescope pointed up.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.05;
    g.lineCap = 'round';
    g.save();
    g.translate(s * 0.14, s * 0.04);
    g.rotate(-0.9);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(s * 0.48, 0);
    g.stroke();
    // Eyepiece
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.06;
    g.beginPath();
    g.moveTo(-s * 0.02, 0);
    g.lineTo(s * 0.04, 0);
    g.stroke();
    // Objective lens cap
    g.fillStyle = p.accent2;
    g.beginPath();
    g.arc(s * 0.5, 0, s * 0.04, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // Stars visible through telescope
    g.fillStyle = p.accent2;
    for (const [dx, dy] of [[-0.42, -0.5], [-0.3, -0.58], [-0.18, -0.62], [-0.34, -0.4]]) {
      g.beginPath();
      g.arc(dx * s, dy * s, s * 0.018, 0, Math.PI * 2);
      g.fill();
    }
    // Jupiter + four moons at far upper left
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(-s * 0.48, -s * 0.44, s * 0.04, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff5cc';
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(-s * 0.5 + i * s * 0.024, -s * 0.52, s * 0.01, 0, Math.PI * 2);
      g.fill();
    }
  },
};

const DANTE: Figure = {
  id: 'dante',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    // Head with red cappuccio + laurel crown.
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.06, -s * 0.1, s * 0.12, s * 0.14);
    g.beginPath();
    g.ellipse(0, -s * 0.28, s * 0.15, s * 0.19, 0, 0, Math.PI * 2);
    g.fill();
    // Red cappuccio hood
    g.fillStyle = '#a03030';
    g.beginPath();
    g.moveTo(-s * 0.2, -s * 0.1);
    g.quadraticCurveTo(-s * 0.2, -s * 0.5, 0, -s * 0.54);
    g.quadraticCurveTo(s * 0.2, -s * 0.5, s * 0.2, -s * 0.1);
    g.lineTo(s * 0.18, -s * 0.3);
    g.lineTo(-s * 0.18, -s * 0.3);
    g.closePath();
    g.fill();
    // Earflap
    g.beginPath();
    g.moveTo(-s * 0.2, -s * 0.1);
    g.lineTo(-s * 0.3, s * 0.02);
    g.lineTo(-s * 0.1, -s * 0.14);
    g.closePath();
    g.fill();
    // Laurel crown
    g.fillStyle = p.accent2;
    for (let i = 0; i < 8; i++) {
      const a = Math.PI + (i / 7) * Math.PI;
      const x = Math.cos(a) * s * 0.22;
      const y = -s * 0.48 + Math.sin(a) * s * 0.16 * 0.5;
      g.save();
      g.translate(x, y);
      g.rotate(a + Math.PI / 2);
      g.beginPath();
      g.ellipse(0, 0, s * 0.05, s * 0.014, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    // Eye hint
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(s * 0.04, -s * 0.28, s * 0.016, 0, Math.PI * 2);
    g.fill();
    // Open book (Divina Commedia) in hands.
    g.fillStyle = '#f4e8d0';
    g.beginPath();
    g.moveTo(-s * 0.28, s * 0.26);
    g.lineTo(s * 0.28, s * 0.26);
    g.lineTo(s * 0.24, s * 0.5);
    g.lineTo(-s * 0.24, s * 0.5);
    g.closePath();
    g.fill();
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.006;
    g.beginPath();
    g.moveTo(0, s * 0.26);
    g.lineTo(0, s * 0.5);
    g.stroke();
    // Faint lines of text
    for (let row = 0; row < 5; row++) {
      const y = s * 0.3 + row * s * 0.038;
      g.beginPath();
      g.moveTo(-s * 0.22, y);
      g.lineTo(-s * 0.04, y);
      g.moveTo(s * 0.04, y);
      g.lineTo(s * 0.22, y);
      g.stroke();
    }
    // Hellfire glow at his feet
    g.fillStyle = 'rgba(220,80,40,0.7)';
    g.beginPath();
    g.ellipse(0, s * 0.96, s * 0.36, s * 0.06, 0, 0, Math.PI * 2);
    g.fill();
  },
};

const CUPOLA: Figure = {
  id: 'brunelleschi_cupola',
  draw(g, s, p) {
    // Brunelleschi's Santa Maria del Fiore dome — octagonal cupola + lantern.
    // Octagonal drum
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.36, s * 0.2);
    g.lineTo(s * 0.36, s * 0.2);
    g.lineTo(s * 0.42, s * 0.7);
    g.lineTo(-s * 0.42, s * 0.7);
    g.closePath();
    g.fill();
    // Round arched windows in the drum
    g.fillStyle = p.accent2;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.arc(i * s * 0.14, s * 0.46, s * 0.035, Math.PI, 0);
      g.fill();
      g.fillRect(i * s * 0.14 - s * 0.035, s * 0.46, s * 0.07, s * 0.12);
    }
    // Red-tiled dome
    g.fillStyle = '#b04a2c';
    g.beginPath();
    g.moveTo(-s * 0.36, s * 0.2);
    g.bezierCurveTo(-s * 0.36, -s * 0.4, s * 0.36, -s * 0.4, s * 0.36, s * 0.2);
    g.closePath();
    g.fill();
    // White stone ribs
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.014;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(i * s * 0.1, s * 0.2);
      g.bezierCurveTo(
        i * s * 0.08, -s * 0.08,
        i * s * 0.04, -s * 0.3,
        0, -s * 0.38,
      );
      g.stroke();
    }
    // Marble lantern on top
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.06, -s * 0.54, s * 0.12, s * 0.18);
    g.beginPath();
    g.moveTo(-s * 0.08, -s * 0.54);
    g.lineTo(s * 0.08, -s * 0.54);
    g.lineTo(0, -s * 0.66);
    g.closePath();
    g.fill();
    // Gilded orb + cross
    g.beginPath();
    g.arc(0, -s * 0.72, s * 0.03, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.moveTo(0, -s * 0.8);
    g.lineTo(0, -s * 0.76);
    g.moveTo(-s * 0.02, -s * 0.78);
    g.lineTo(s * 0.02, -s * 0.78);
    g.stroke();
    // Stone foundation / arcade
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.48, s * 0.7, s * 0.96, s * 0.06);
    // Piazza
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.5, s * 0.76, s * 1.0, s * 0.2);
  },
};

const CHERUB: Figure = {
  id: 'cherub',
  draw(g, s, p) {
    // Raphael-style cherub — plump face, two wings, curly hair, resting on elbows.
    // Wings
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.18, s * 0.02);
    g.quadraticCurveTo(-s * 0.5, -s * 0.2, -s * 0.42, s * 0.2);
    g.quadraticCurveTo(-s * 0.28, s * 0.18, -s * 0.18, s * 0.1);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.18, s * 0.02);
    g.quadraticCurveTo(s * 0.5, -s * 0.2, s * 0.42, s * 0.2);
    g.quadraticCurveTo(s * 0.28, s * 0.18, s * 0.18, s * 0.1);
    g.closePath();
    g.fill();
    // Wing feathers
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.006;
    for (let i = 0; i < 4; i++) {
      const t = (i + 1) / 5;
      g.beginPath();
      g.moveTo(-s * 0.18 - t * s * 0.24, s * 0.02 + t * s * 0.12);
      g.lineTo(-s * 0.18 - t * s * 0.2, s * 0.02 + t * s * 0.04);
      g.stroke();
      g.beginPath();
      g.moveTo(s * 0.18 + t * s * 0.24, s * 0.02 + t * s * 0.12);
      g.lineTo(s * 0.18 + t * s * 0.2, s * 0.02 + t * s * 0.04);
      g.stroke();
    }
    // Round cherub head
    g.fillStyle = '#f4d9b0';
    g.beginPath();
    g.arc(0, -s * 0.12, s * 0.2, 0, Math.PI * 2);
    g.fill();
    // Curly hair
    g.fillStyle = p.accent;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.arc(i * s * 0.04, -s * 0.26, s * 0.04, 0, Math.PI * 2);
      g.fill();
    }
    // Rosy cheeks
    g.fillStyle = 'rgba(220,100,100,0.5)';
    g.beginPath();
    g.arc(-s * 0.1, -s * 0.06, s * 0.035, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.1, -s * 0.06, s * 0.035, 0, Math.PI * 2);
    g.fill();
    // Eyes looking up
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(-s * 0.06, -s * 0.12, s * 0.014, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.06, -s * 0.12, s * 0.014, 0, Math.PI * 2);
    g.fill();
    // Arms folded on a bar (resting pose).
    g.fillStyle = '#f4d9b0';
    g.fillRect(-s * 0.2, s * 0.16, s * 0.4, s * 0.12);
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.01;
    g.beginPath();
    g.moveTo(-s * 0.2, s * 0.16);
    g.lineTo(s * 0.2, s * 0.16);
    g.stroke();
    // Decorative shelf below
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.4, s * 0.28, s * 0.8, s * 0.06);
    g.fillStyle = p.accent2;
    g.fillRect(-s * 0.44, s * 0.34, s * 0.88, s * 0.04);
  },
};

const MONA_LISA: Figure = {
  id: 'mona_lisa',
  draw(g, s, p) {
    // Mona Lisa silhouette — seated three-quarter pose in landscape frame.
    // Background landscape behind frame
    g.fillStyle = p.accent2;
    g.fillRect(-s * 0.48, -s * 0.58, s * 0.96, s * 1.3);
    // Distant hills
    g.fillStyle = 'rgba(40,100,140,0.7)';
    g.beginPath();
    g.moveTo(-s * 0.48, -s * 0.12);
    g.lineTo(-s * 0.2, -s * 0.3);
    g.lineTo(0, -s * 0.18);
    g.lineTo(s * 0.2, -s * 0.32);
    g.lineTo(s * 0.48, -s * 0.14);
    g.lineTo(s * 0.48, s * 0.08);
    g.lineTo(-s * 0.48, s * 0.08);
    g.closePath();
    g.fill();
    // Hair veil
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.28, -s * 0.1);
    g.quadraticCurveTo(-s * 0.3, -s * 0.46, 0, -s * 0.48);
    g.quadraticCurveTo(s * 0.3, -s * 0.46, s * 0.28, -s * 0.1);
    g.lineTo(s * 0.18, s * 0.0);
    g.lineTo(-s * 0.18, s * 0.0);
    g.closePath();
    g.fill();
    // Face
    g.fillStyle = '#f2d7aa';
    g.beginPath();
    g.ellipse(0, -s * 0.2, s * 0.15, s * 0.19, 0, 0, Math.PI * 2);
    g.fill();
    // Subtle eyes + half-smile
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(-s * 0.06, -s * 0.22, s * 0.018, s * 0.008, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.06, -s * 0.22, s * 0.018, s * 0.008, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.moveTo(-s * 0.04, -s * 0.12);
    g.quadraticCurveTo(0, -s * 0.08, s * 0.04, -s * 0.12);
    g.stroke();
    // Dress — dark with folded arms crossed.
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.28, s * 0.0);
    g.lineTo(s * 0.28, s * 0.0);
    g.lineTo(s * 0.4, s * 0.72);
    g.lineTo(-s * 0.4, s * 0.72);
    g.closePath();
    g.fill();
    // Crossed arms (sleeves)
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.26, s * 0.2);
    g.quadraticCurveTo(0, s * 0.36, s * 0.26, s * 0.2);
    g.lineTo(s * 0.22, s * 0.36);
    g.quadraticCurveTo(0, s * 0.5, -s * 0.22, s * 0.36);
    g.closePath();
    g.fill();
    // Ornate gold picture frame
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.024;
    g.strokeRect(-s * 0.48, -s * 0.58, s * 0.96, s * 1.3);
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.006;
    g.strokeRect(-s * 0.46, -s * 0.56, s * 0.92, s * 1.26);
  },
};

export const RENAISSANCE_PANTHEON: Pantheon = {
  palette: RENAISSANCE_PALETTE,
  figures: [VITRUVIAN, DAVID, VENUS, GALILEO, DANTE, CUPOLA, CHERUB, MONA_LISA],
};
