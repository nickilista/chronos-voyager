import { drawRobedBody } from './common.ts';
import type { Figure, Palette, Pantheon } from './types.ts';

/**
 * Hindu pantheon — eight major deities with iconic attributes: Ganesha,
 * Shiva Nataraja, Vishnu, Lakshmi, Hanuman, Saraswati, Krishna, Durga.
 * Palette: deep saffron-orange ink with peacock teal and marigold accents.
 * Saffron over the India sky's warm red horizon stays warm-on-warm but the
 * teal accent gives the eyes something cool to land on.
 */

const INDIA_PALETTE: Palette = {
  ink: '#4a1106', // deep mahogany-saffron
  accent: '#f4a52a', // marigold
  accent2: '#1f8a8a', // peacock teal
  glowInner: 'rgba(255, 220, 160, 0.95)',
  glowMid: 'rgba(220, 100, 60, 0.5)',
  glowEdge: 'rgba(40, 12, 4, 0)',
  halo: 'rgba(255, 180, 90, 0.7)',
};

function head(g: CanvasRenderingContext2D, s: number, p: Palette): void {
  g.fillStyle = p.ink;
  g.fillRect(-s * 0.06, -s * 0.1, s * 0.12, s * 0.14);
  g.beginPath();
  g.ellipse(0, -s * 0.28, s * 0.16, s * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  // Tilak — vertical mark on forehead.
  g.fillStyle = p.accent;
  g.fillRect(-s * 0.008, -s * 0.42, s * 0.016, s * 0.06);
  // Eyes
  g.fillStyle = p.accent2;
  g.beginPath();
  g.arc(-s * 0.06, -s * 0.3, s * 0.012, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(s * 0.06, -s * 0.3, s * 0.012, 0, Math.PI * 2);
  g.fill();
}

const GANESHA: Figure = {
  id: 'ganesha',
  draw(g, s, p) {
    drawRobedBody(g, s, p, p.accent2);
    // Round elephant head with one tusk.
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(0, -s * 0.32, s * 0.22, 0, Math.PI * 2);
    g.fill();
    // Big floppy ears
    g.beginPath();
    g.ellipse(-s * 0.24, -s * 0.3, s * 0.1, s * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.24, -s * 0.3, s * 0.1, s * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    // Trunk curling down and to the right.
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.08;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, -s * 0.18);
    g.bezierCurveTo(s * 0.04, s * 0.0, s * 0.22, s * 0.06, s * 0.16, s * 0.18);
    g.stroke();
    // One tusk (broken — Ganesha lost one)
    g.fillStyle = '#f6e8a0';
    g.beginPath();
    g.moveTo(-s * 0.06, -s * 0.18);
    g.lineTo(-s * 0.16, -s * 0.04);
    g.lineTo(-s * 0.1, -s * 0.06);
    g.closePath();
    g.fill();
    // Crown
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.5);
    g.lineTo(-s * 0.1, -s * 0.62);
    g.lineTo(0, -s * 0.5);
    g.lineTo(s * 0.1, -s * 0.62);
    g.lineTo(s * 0.18, -s * 0.5);
    g.lineTo(s * 0.18, -s * 0.42);
    g.lineTo(-s * 0.18, -s * 0.42);
    g.closePath();
    g.fill();
    g.fillStyle = p.accent2;
    g.beginPath();
    g.arc(0, -s * 0.66, s * 0.018, 0, Math.PI * 2);
    g.fill();
    // Tilak on forehead
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.008, -s * 0.46, s * 0.016, s * 0.06);
    // Eyes
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(-s * 0.08, -s * 0.32, s * 0.018, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.08, -s * 0.32, s * 0.018, 0, Math.PI * 2);
    g.fill();
    // Modaka sweet held in lower left hand
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.34, s * 0.34);
    g.lineTo(-s * 0.22, s * 0.34);
    g.lineTo(-s * 0.28, s * 0.22);
    g.closePath();
    g.fill();
    // Mouse vahana at his feet.
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(s * 0.32, s * 0.92, s * 0.1, s * 0.05, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.42, s * 0.9, s * 0.04, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.accent2;
    g.beginPath();
    g.arc(s * 0.44, s * 0.88, s * 0.01, 0, Math.PI * 2);
    g.fill();
  },
};

const SHIVA: Figure = {
  id: 'shiva_nataraja',
  draw(g, s, p) {
    // Shiva as Nataraja in a ring of fire — dancing pose.
    // Outer prabhamandala (ring of fire)
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.04;
    g.beginPath();
    g.arc(0, s * 0.0, s * 0.5, 0, Math.PI * 2);
    g.stroke();
    // Flame tongues around the ring
    g.fillStyle = p.accent;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5);
      g.lineTo(Math.cos(a + 0.1) * s * 0.58, Math.sin(a + 0.1) * s * 0.58);
      g.lineTo(Math.cos(a - 0.1) * s * 0.58, Math.sin(a - 0.1) * s * 0.58);
      g.closePath();
      g.fill();
    }
    // Body — angled torso (dance pose).
    g.fillStyle = p.ink;
    g.save();
    g.rotate(0.18);
    g.beginPath();
    g.moveTo(-s * 0.12, -s * 0.04);
    g.lineTo(s * 0.12, -s * 0.04);
    g.lineTo(s * 0.16, s * 0.2);
    g.lineTo(-s * 0.16, s * 0.2);
    g.closePath();
    g.fill();
    g.restore();
    // Standing leg + raised leg
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.04, s * 0.22, s * 0.06, s * 0.22);
    g.save();
    g.translate(s * 0.04, s * 0.24);
    g.rotate(-0.7);
    g.fillRect(-s * 0.03, 0, s * 0.06, s * 0.24);
    g.restore();
    // Standing on a tiny demon (Apasmara) — small humped silhouette.
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(s * 0.0, s * 0.46, s * 0.18, s * 0.06, 0, 0, Math.PI * 2);
    g.fill();
    // Head with crescent moon and flowing hair.
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(0, -s * 0.26, s * 0.13, s * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    // Crescent
    g.fillStyle = p.accent2;
    g.beginPath();
    g.arc(s * 0.14, -s * 0.4, s * 0.07, 0.4, Math.PI - 0.4, false);
    g.arc(s * 0.18, -s * 0.4, s * 0.05, Math.PI - 0.4, 0.4, true);
    g.closePath();
    g.fill();
    // Wild hair flying out
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.014;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI + (i / 5) * Math.PI;
      g.beginPath();
      g.moveTo(Math.cos(a) * s * 0.12, -s * 0.26 + Math.sin(a) * s * 0.16);
      g.lineTo(Math.cos(a) * s * 0.32, -s * 0.26 + Math.sin(a) * s * 0.32);
      g.stroke();
    }
    // Four arms — symbolic tools.
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.024;
    // Upper right — drum (damaru)
    g.beginPath();
    g.moveTo(s * 0.04, -s * 0.04);
    g.lineTo(s * 0.32, -s * 0.32);
    g.stroke();
    g.fillStyle = p.accent;
    g.fillRect(s * 0.3, -s * 0.4, s * 0.06, s * 0.12);
    // Upper left — fire
    g.beginPath();
    g.moveTo(-s * 0.04, -s * 0.04);
    g.lineTo(-s * 0.32, -s * 0.32);
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.3, -s * 0.3);
    g.quadraticCurveTo(-s * 0.42, -s * 0.46, -s * 0.32, -s * 0.46);
    g.quadraticCurveTo(-s * 0.36, -s * 0.36, -s * 0.28, -s * 0.32);
    g.closePath();
    g.fill();
    // Lower right — abhaya gesture
    g.beginPath();
    g.moveTo(s * 0.1, s * 0.06);
    g.lineTo(s * 0.32, s * 0.0);
    g.stroke();
    g.fillStyle = p.ink;
    g.fillRect(s * 0.32, -s * 0.06, s * 0.04, s * 0.12);
    // Lower left — pointing to raised foot
    g.beginPath();
    g.moveTo(-s * 0.1, s * 0.06);
    g.lineTo(s * 0.0, s * 0.16);
    g.stroke();
  },
};

const VISHNU: Figure = {
  id: 'vishnu',
  draw(g, s, p) {
    drawRobedBody(g, s, p);
    head(g, s, p);
    // Tall conical kirita crown.
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.42);
    g.lineTo(-s * 0.06, -s * 0.78);
    g.lineTo(s * 0.06, -s * 0.78);
    g.lineTo(s * 0.18, -s * 0.42);
    g.closePath();
    g.fill();
    g.fillStyle = p.accent2;
    g.fillRect(-s * 0.18, -s * 0.5, s * 0.36, s * 0.04);
    g.beginPath();
    g.arc(0, -s * 0.78, s * 0.022, 0, Math.PI * 2);
    g.fill();
    // Four arms holding attributes.
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.024;
    // Upper right — chakra
    g.beginPath();
    g.moveTo(s * 0.18, s * 0.04);
    g.lineTo(s * 0.4, -s * 0.16);
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(s * 0.46, -s * 0.22, s * 0.08, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(s * 0.46, -s * 0.22, s * 0.04, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.008;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(s * 0.46, -s * 0.22);
      g.lineTo(s * 0.46 + Math.cos(a) * s * 0.08, -s * 0.22 + Math.sin(a) * s * 0.08);
      g.stroke();
    }
    // Upper left — conch (shankha)
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.024;
    g.beginPath();
    g.moveTo(-s * 0.18, s * 0.04);
    g.lineTo(-s * 0.4, -s * 0.16);
    g.stroke();
    g.fillStyle = '#f6e8a0';
    g.beginPath();
    g.moveTo(-s * 0.5, -s * 0.3);
    g.quadraticCurveTo(-s * 0.36, -s * 0.4, -s * 0.36, -s * 0.16);
    g.quadraticCurveTo(-s * 0.5, -s * 0.1, -s * 0.5, -s * 0.3);
    g.closePath();
    g.fill();
    // Lower right — mace (gada)
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.024;
    g.beginPath();
    g.moveTo(s * 0.14, s * 0.2);
    g.lineTo(s * 0.36, s * 0.6);
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(s * 0.4, s * 0.66, s * 0.07, 0, Math.PI * 2);
    g.fill();
    // Lower left — lotus
    g.beginPath();
    g.moveTo(-s * 0.14, s * 0.2);
    g.lineTo(-s * 0.36, s * 0.5);
    g.stroke();
    g.fillStyle = p.accent;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI - Math.PI / 2;
      g.beginPath();
      g.ellipse(
        -s * 0.36 + Math.cos(a) * s * 0.04,
        s * 0.5 + Math.sin(a) * s * 0.04,
        s * 0.04,
        s * 0.018,
        a,
        0,
        Math.PI * 2,
      );
      g.fill();
    }
  },
};

const LAKSHMI: Figure = {
  id: 'lakshmi',
  draw(g, s, p) {
    drawRobedBody(g, s, p, p.accent);
    head(g, s, p);
    // Standing on a lotus throne — ovals at her feet.
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(0, s * 0.96, s * 0.36, s * 0.06, 0, 0, Math.PI * 2);
    g.fill();
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.ellipse(i * s * 0.06, s * 0.92, s * 0.04, s * 0.03, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Crown
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.42);
    g.lineTo(-s * 0.1, -s * 0.6);
    g.lineTo(0, -s * 0.46);
    g.lineTo(s * 0.1, -s * 0.6);
    g.lineTo(s * 0.18, -s * 0.42);
    g.closePath();
    g.fill();
    // Four arms with attributes.
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.022;
    // Upper hands hold lotuses
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.moveTo(dir * s * 0.18, s * 0.04);
      g.lineTo(dir * s * 0.36, -s * 0.18);
      g.stroke();
      g.fillStyle = p.accent2;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI - Math.PI / 2;
        g.beginPath();
        g.ellipse(
          dir * s * 0.4 + Math.cos(a) * s * 0.04,
          -s * 0.22 + Math.sin(a) * s * 0.04,
          s * 0.04,
          s * 0.018,
          a,
          0,
          Math.PI * 2,
        );
        g.fill();
      }
    }
    // Lower hands — gold coins flowing.
    g.fillStyle = p.accent;
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.arc(s * 0.16 + (i % 4) * s * 0.04, s * 0.36 + Math.floor(i / 4) * s * 0.06, s * 0.018, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(-s * 0.22 + (i % 4) * s * 0.04, s * 0.36 + Math.floor(i / 4) * s * 0.06, s * 0.018, 0, Math.PI * 2);
      g.fill();
    }
    // Two flanking elephants spraying water.
    g.fillStyle = p.accent2;
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.ellipse(dir * s * 0.42, -s * 0.24, s * 0.08, s * 0.06, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = p.accent2;
      g.lineWidth = s * 0.018;
      g.beginPath();
      g.moveTo(dir * s * 0.46, -s * 0.22);
      g.bezierCurveTo(dir * s * 0.6, -s * 0.36, dir * s * 0.24, -s * 0.6, dir * s * 0.04, -s * 0.5);
      g.stroke();
    }
  },
};

const HANUMAN: Figure = {
  id: 'hanuman',
  draw(g, s, p) {
    drawRobedBody(g, s, p, p.accent);
    // Vanara face — orange-red monkey.
    g.fillStyle = '#c84020';
    g.beginPath();
    g.ellipse(0, -s * 0.28, s * 0.18, s * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f0c060';
    g.beginPath();
    g.ellipse(0, -s * 0.22, s * 0.12, s * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    // Eyes
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(-s * 0.06, -s * 0.32, s * 0.018, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.06, -s * 0.32, s * 0.018, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.008, -s * 0.42, s * 0.016, s * 0.06);
    // Crown
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.46);
    g.lineTo(0, -s * 0.62);
    g.lineTo(s * 0.18, -s * 0.46);
    g.closePath();
    g.fill();
    // Holding the Dronagiri mountain in his right hand — chunk of rock above.
    g.fillStyle = '#7a5848';
    g.beginPath();
    g.moveTo(s * 0.22, -s * 0.42);
    g.lineTo(s * 0.5, -s * 0.46);
    g.lineTo(s * 0.5, -s * 0.78);
    g.lineTo(s * 0.42, -s * 0.86);
    g.lineTo(s * 0.34, -s * 0.78);
    g.lineTo(s * 0.22, -s * 0.7);
    g.closePath();
    g.fill();
    // Tiny tree on the mountain top
    g.fillStyle = p.accent2;
    g.beginPath();
    g.arc(s * 0.42, -s * 0.86, s * 0.04, 0, Math.PI * 2);
    g.fill();
    // Arm to mountain
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.028;
    g.beginPath();
    g.moveTo(s * 0.18, s * 0.04);
    g.lineTo(s * 0.32, -s * 0.42);
    g.stroke();
    // Mace (gada) in left hand.
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.028;
    g.beginPath();
    g.moveTo(-s * 0.18, s * 0.04);
    g.lineTo(-s * 0.36, s * 0.6);
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(-s * 0.4, s * 0.66, s * 0.08, 0, Math.PI * 2);
    g.fill();
    // Tail curling up behind
    g.strokeStyle = '#c84020';
    g.lineWidth = s * 0.04;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-s * 0.32, s * 0.78);
    g.bezierCurveTo(-s * 0.5, s * 0.5, -s * 0.5, s * 0.06, -s * 0.32, -s * 0.06);
    g.stroke();
  },
};

const SARASWATI: Figure = {
  id: 'saraswati',
  draw(g, s, p) {
    drawRobedBody(g, s, p, p.accent2);
    head(g, s, p);
    // Crown
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.16, -s * 0.42);
    g.lineTo(0, -s * 0.6);
    g.lineTo(s * 0.16, -s * 0.42);
    g.closePath();
    g.fill();
    // Veena — long string instrument held diagonally.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.04;
    g.beginPath();
    g.moveTo(-s * 0.42, -s * 0.18);
    g.lineTo(s * 0.4, s * 0.6);
    g.stroke();
    // Two resonator gourds at the ends
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(-s * 0.46, -s * 0.22, s * 0.1, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.44, s * 0.64, s * 0.12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(-s * 0.46, -s * 0.22, s * 0.06, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.44, s * 0.64, s * 0.08, 0, Math.PI * 2);
    g.fill();
    // Strings
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.005;
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(-s * 0.46 + i * s * 0.012, -s * 0.22);
      g.lineTo(s * 0.44 + i * s * 0.012, s * 0.64);
      g.stroke();
    }
    // Swan vahana below
    g.fillStyle = '#f6e8d0';
    g.beginPath();
    g.ellipse(-s * 0.18, s * 0.92, s * 0.12, s * 0.05, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(-s * 0.18, s * 0.88);
    g.quadraticCurveTo(-s * 0.04, s * 0.78, -s * 0.04, s * 0.86);
    g.lineTo(-s * 0.1, s * 0.9);
    g.closePath();
    g.fill();
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.04, s * 0.86);
    g.lineTo(s * 0.02, s * 0.86);
    g.lineTo(-s * 0.02, s * 0.9);
    g.closePath();
    g.fill();
  },
};

const KRISHNA: Figure = {
  id: 'krishna',
  draw(g, s, p) {
    // Krishna — blue-skinned with peacock-feather crown, playing the flute.
    drawRobedBody(g, s, p, p.accent);
    g.fillStyle = '#3a6fa8';
    g.fillRect(-s * 0.06, -s * 0.1, s * 0.12, s * 0.14);
    g.beginPath();
    g.ellipse(0, -s * 0.28, s * 0.16, s * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    // Eyes + tilak
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(-s * 0.06, -s * 0.3, s * 0.014, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.06, -s * 0.3, s * 0.014, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.008, -s * 0.42, s * 0.016, s * 0.06);
    // Crown / topknot
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(0, -s * 0.5, s * 0.1, 0, Math.PI * 2);
    g.fill();
    // Peacock feather sticking up — accent2 + accent ring.
    g.fillStyle = p.accent2;
    g.beginPath();
    g.ellipse(0, -s * 0.7, s * 0.06, s * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(0, -s * 0.66, s * 0.04, s * 0.08, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a2a18';
    g.beginPath();
    g.ellipse(0, -s * 0.66, s * 0.018, s * 0.04, 0, 0, Math.PI * 2);
    g.fill();
    // Bansuri flute held horizontally to lips.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.022;
    g.beginPath();
    g.moveTo(-s * 0.2, -s * 0.18);
    g.lineTo(s * 0.32, -s * 0.18);
    g.stroke();
    g.fillStyle = p.ink;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(-s * 0.06 + i * s * 0.06, -s * 0.18, s * 0.008, 0, Math.PI * 2);
      g.fill();
    }
    // Hands on the flute.
    g.strokeStyle = '#3a6fa8';
    g.lineWidth = s * 0.04;
    g.beginPath();
    g.moveTo(-s * 0.2, s * 0.04);
    g.lineTo(-s * 0.16, -s * 0.18);
    g.moveTo(s * 0.2, s * 0.04);
    g.lineTo(s * 0.22, -s * 0.18);
    g.stroke();
    // Floating musical notes
    g.fillStyle = p.accent2;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(s * 0.4 + i * s * 0.06, -s * 0.34 - i * s * 0.06, s * 0.018, 0, Math.PI * 2);
      g.fill();
      g.fillRect(s * 0.41 + i * s * 0.06, -s * 0.4 - i * s * 0.06, s * 0.006, s * 0.08);
    }
  },
};

const DURGA: Figure = {
  id: 'durga',
  draw(g, s, p) {
    // Durga riding a tiger, wielding many weapons.
    // Tiger first
    g.fillStyle = '#d68030';
    g.beginPath();
    g.ellipse(0, s * 0.7, s * 0.42, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    // Stripes
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.012;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(i * s * 0.1, s * 0.6);
      g.lineTo(i * s * 0.1 + s * 0.02, s * 0.8);
      g.stroke();
    }
    // Tiger head on the left
    g.fillStyle = '#d68030';
    g.beginPath();
    g.arc(-s * 0.42, s * 0.66, s * 0.1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(-s * 0.46, s * 0.64, s * 0.014, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(-s * 0.4, s * 0.64, s * 0.014, 0, Math.PI * 2);
    g.fill();
    // Legs
    g.fillStyle = '#d68030';
    g.fillRect(-s * 0.3, s * 0.78, s * 0.06, s * 0.18);
    g.fillRect(s * 0.24, s * 0.78, s * 0.06, s * 0.18);
    // Durga seated sideways on the tiger.
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.22, s * 0.56);
    g.lineTo(s * 0.22, s * 0.56);
    g.lineTo(s * 0.18, s * 0.18);
    g.lineTo(-s * 0.18, s * 0.18);
    g.closePath();
    g.fill();
    head(g, s, p);
    // Crown
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.42);
    g.lineTo(0, -s * 0.62);
    g.lineTo(s * 0.18, -s * 0.42);
    g.closePath();
    g.fill();
    // Eight arms fanned out, each with a small weapon icon (just suggestive lines + glyphs).
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.018;
    const angles = [-Math.PI * 0.55, -Math.PI * 0.4, -Math.PI * 0.25, -Math.PI * 0.1, Math.PI * 0.05, Math.PI * 0.2, Math.PI * 0.35, Math.PI * 0.5];
    for (const a of angles) {
      g.beginPath();
      g.moveTo(0, s * 0.04);
      g.lineTo(Math.cos(a) * s * 0.4, s * 0.04 + Math.sin(a) * s * 0.4);
      g.stroke();
    }
    // Weapon tips — alternating shapes
    const tipColors = [p.accent, p.accent2];
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i];
      g.fillStyle = tipColors[i % 2];
      g.beginPath();
      g.arc(Math.cos(a) * s * 0.42, s * 0.04 + Math.sin(a) * s * 0.42, s * 0.026, 0, Math.PI * 2);
      g.fill();
    }
  },
};

export const INDIA_PANTHEON: Pantheon = {
  palette: INDIA_PALETTE,
  figures: [GANESHA, SHIVA, VISHNU, LAKSHMI, HANUMAN, SARASWATI, KRISHNA, DURGA],
};
