import { drawRobedBody } from './common.ts';
import type { Figure, Palette, Pantheon } from './types.ts';

/**
 * Edo Japan pantheon — kami and yokai: Amaterasu (sun goddess), Raijin
 * (thunder god) and Fujin (wind god), Kitsune (fox spirit), Tengu (mountain
 * yokai), Oni (ogre), Samurai ancestor, Geisha. Palette: sumi-e black ink
 * with plum-indigo and gold, set off by white. Indigo + plum contrast the
 * Edo flow's warm red sky — the ink silhouettes read instantly as woodblock
 * prints.
 */

const EDO_PALETTE: Palette = {
  ink: '#0f0a14', // sumi-e black with violet undertone
  accent: '#f0c44a', // imperial gold
  accent2: '#3a5ca8', // indigo (aizome)
  glowInner: 'rgba(255, 220, 230, 0.95)',
  glowMid: 'rgba(200, 80, 120, 0.5)',
  glowEdge: 'rgba(40, 16, 24, 0)',
  halo: 'rgba(240, 200, 200, 0.7)',
};

function head(g: CanvasRenderingContext2D, s: number, p: Palette): void {
  g.fillStyle = '#f4e8d8';
  g.fillRect(-s * 0.06, -s * 0.1, s * 0.12, s * 0.14);
  g.beginPath();
  g.ellipse(0, -s * 0.28, s * 0.14, s * 0.17, 0, 0, Math.PI * 2);
  g.fill();
  // Thin ink eyes + mouth.
  g.fillStyle = p.ink;
  g.beginPath();
  g.arc(-s * 0.05, -s * 0.3, s * 0.008, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(s * 0.05, -s * 0.3, s * 0.008, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(0, -s * 0.22, s * 0.01, 0, Math.PI);
  g.fill();
}

const AMATERASU: Figure = {
  id: 'amaterasu',
  draw(g, s, p) {
    // Rising sun rays behind her.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.018;
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * s * 0.22, -s * 0.22 + Math.sin(a) * s * 0.22);
      g.lineTo(Math.cos(a) * s * 0.5, -s * 0.22 + Math.sin(a) * s * 0.5);
      g.stroke();
    }
    // Solar disc
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(0, -s * 0.22, s * 0.26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c83838';
    g.beginPath();
    g.arc(0, -s * 0.22, s * 0.2, 0, Math.PI * 2);
    g.fill();
    drawRobedBody(g, s, p, '#c83838');
    head(g, s, p);
    // Long flowing hair down.
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.14, -s * 0.28);
    g.quadraticCurveTo(-s * 0.28, s * 0.2, -s * 0.12, s * 0.5);
    g.lineTo(0, s * 0.1);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.14, -s * 0.28);
    g.quadraticCurveTo(s * 0.28, s * 0.2, s * 0.12, s * 0.5);
    g.lineTo(0, s * 0.1);
    g.closePath();
    g.fill();
    // Sacred mirror (yata no kagami) in hands.
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(0, s * 0.36, s * 0.12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f2ece0';
    g.beginPath();
    g.arc(0, s * 0.36, s * 0.08, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.006;
    g.beginPath();
    g.moveTo(-s * 0.06, s * 0.32);
    g.lineTo(s * 0.06, s * 0.4);
    g.stroke();
  },
};

const RAIJIN: Figure = {
  id: 'raijin',
  draw(g, s, p) {
    // Thunder demon — drums arranged in circle around him, green skin.
    // Drum ring behind
    g.fillStyle = '#c83838';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      g.beginPath();
      g.ellipse(Math.cos(a) * s * 0.46, -s * 0.1 + Math.sin(a) * s * 0.46, s * 0.06, s * 0.05, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Loincloth + body — green-skinned yokai.
    g.fillStyle = '#3a6050';
    g.beginPath();
    g.moveTo(-s * 0.26, s * 0.2);
    g.lineTo(s * 0.26, s * 0.2);
    g.lineTo(s * 0.3, s * 0.66);
    g.lineTo(-s * 0.3, s * 0.66);
    g.closePath();
    g.fill();
    // Tiger-skin wrap
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.3, s * 0.5, s * 0.6, s * 0.12);
    g.fillStyle = p.ink;
    for (let i = -4; i <= 4; i++) {
      g.fillRect(i * s * 0.06 - s * 0.006, s * 0.5, s * 0.012, s * 0.12);
    }
    // Torso
    g.fillStyle = '#3a6050';
    g.beginPath();
    g.moveTo(-s * 0.2, -s * 0.06);
    g.lineTo(s * 0.2, -s * 0.06);
    g.lineTo(s * 0.26, s * 0.2);
    g.lineTo(-s * 0.26, s * 0.2);
    g.closePath();
    g.fill();
    // Demon head — green with horns, wild hair.
    g.fillStyle = '#3a6050';
    g.beginPath();
    g.ellipse(0, -s * 0.26, s * 0.17, s * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    // Wild white hair erupting
    g.strokeStyle = '#f2ece0';
    g.lineWidth = s * 0.02;
    g.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const a = Math.PI + (i / 9) * Math.PI;
      g.beginPath();
      g.moveTo(Math.cos(a) * s * 0.15, -s * 0.26 + Math.sin(a) * s * 0.18);
      g.lineTo(Math.cos(a) * s * 0.32, -s * 0.26 + Math.sin(a) * s * 0.34);
      g.stroke();
    }
    // Horns
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.14, -s * 0.36);
    g.lineTo(-s * 0.2, -s * 0.54);
    g.lineTo(-s * 0.08, -s * 0.42);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.14, -s * 0.36);
    g.lineTo(s * 0.2, -s * 0.54);
    g.lineTo(s * 0.08, -s * 0.42);
    g.closePath();
    g.fill();
    // Angry eyes + fanged grin
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(-s * 0.07, -s * 0.28, s * 0.022, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.07, -s * 0.28, s * 0.022, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(-s * 0.07, -s * 0.28, s * 0.01, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.07, -s * 0.28, s * 0.01, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f2ece0';
    g.fillRect(-s * 0.06, -s * 0.18, s * 0.12, s * 0.03);
    g.beginPath();
    g.moveTo(-s * 0.06, -s * 0.15);
    g.lineTo(-s * 0.03, -s * 0.1);
    g.lineTo(0, -s * 0.15);
    g.lineTo(s * 0.03, -s * 0.1);
    g.lineTo(s * 0.06, -s * 0.15);
    g.closePath();
    g.fill();
    // Mallets in hands.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.024;
    g.beginPath();
    g.moveTo(-s * 0.22, s * 0.04);
    g.lineTo(-s * 0.4, -s * 0.22);
    g.stroke();
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.46, -s * 0.3, s * 0.12, s * 0.16);
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.024;
    g.beginPath();
    g.moveTo(s * 0.22, s * 0.04);
    g.lineTo(s * 0.4, -s * 0.22);
    g.stroke();
    g.fillStyle = p.ink;
    g.fillRect(s * 0.34, -s * 0.3, s * 0.12, s * 0.16);
    // Lightning bolts
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.38, s * 0.6);
    g.lineTo(-s * 0.32, s * 0.76);
    g.lineTo(-s * 0.38, s * 0.78);
    g.lineTo(-s * 0.34, s * 0.92);
    g.lineTo(-s * 0.42, s * 0.78);
    g.lineTo(-s * 0.36, s * 0.78);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.38, s * 0.6);
    g.lineTo(s * 0.44, s * 0.76);
    g.lineTo(s * 0.38, s * 0.78);
    g.lineTo(s * 0.44, s * 0.92);
    g.lineTo(s * 0.34, s * 0.78);
    g.lineTo(s * 0.4, s * 0.78);
    g.closePath();
    g.fill();
  },
};

const FUJIN: Figure = {
  id: 'fujin',
  draw(g, s, p) {
    // Wind god — green skin, big wind bag over shoulders.
    // Wind bag — long tube drape behind him.
    g.fillStyle = p.accent2;
    g.beginPath();
    g.moveTo(-s * 0.5, -s * 0.24);
    g.bezierCurveTo(-s * 0.3, -s * 0.5, s * 0.3, -s * 0.5, s * 0.5, -s * 0.24);
    g.bezierCurveTo(s * 0.3, -s * 0.14, -s * 0.3, -s * 0.14, -s * 0.5, -s * 0.24);
    g.closePath();
    g.fill();
    // Drape ends
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.01;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(-s * 0.5 - i * s * 0.02, -s * 0.24 + i * s * 0.02);
      g.lineTo(-s * 0.56 - i * s * 0.02, -s * 0.18 + i * s * 0.02);
      g.stroke();
      g.beginPath();
      g.moveTo(s * 0.5 + i * s * 0.02, -s * 0.24 + i * s * 0.02);
      g.lineTo(s * 0.56 + i * s * 0.02, -s * 0.18 + i * s * 0.02);
      g.stroke();
    }
    // Body — loincloth
    g.fillStyle = '#3a6050';
    g.beginPath();
    g.moveTo(-s * 0.22, -s * 0.06);
    g.lineTo(s * 0.22, -s * 0.06);
    g.lineTo(s * 0.3, s * 0.66);
    g.lineTo(-s * 0.3, s * 0.66);
    g.closePath();
    g.fill();
    // Green head
    g.fillStyle = '#3a6050';
    g.beginPath();
    g.ellipse(0, -s * 0.22, s * 0.17, s * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    // Flowing red hair blowing to the side
    g.fillStyle = '#c83838';
    g.beginPath();
    g.moveTo(-s * 0.14, -s * 0.32);
    g.quadraticCurveTo(-s * 0.4, -s * 0.44, -s * 0.46, -s * 0.18);
    g.quadraticCurveTo(-s * 0.3, -s * 0.28, -s * 0.14, -s * 0.22);
    g.closePath();
    g.fill();
    // Eyes + open mouth (blowing)
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(-s * 0.06, -s * 0.24, s * 0.02, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.06, -s * 0.24, s * 0.02, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(0, -s * 0.14, s * 0.024, s * 0.04, 0, 0, Math.PI * 2);
    g.fill();
    // Wind swirls
    g.strokeStyle = '#f2ece0';
    g.lineWidth = s * 0.008;
    for (let i = 0; i < 5; i++) {
      const y = -s * 0.12 + i * s * 0.06;
      g.beginPath();
      g.moveTo(s * 0.2, y);
      g.bezierCurveTo(s * 0.36, y - s * 0.02, s * 0.52, y + s * 0.02, s * 0.64, y - s * 0.01);
      g.stroke();
    }
    // Tiger-skin wrap
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.3, s * 0.5, s * 0.6, s * 0.1);
    g.fillStyle = p.ink;
    for (let i = -4; i <= 4; i++) {
      g.fillRect(i * s * 0.06 - s * 0.006, s * 0.5, s * 0.012, s * 0.1);
    }
  },
};

const KITSUNE: Figure = {
  id: 'kitsune',
  draw(g, s, p) {
    // White nine-tailed fox sitting.
    g.fillStyle = '#f2ece0';
    // Body — curved back.
    g.beginPath();
    g.ellipse(0, s * 0.34, s * 0.3, s * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    // Head with fox ears.
    g.beginPath();
    g.arc(-s * 0.04, s * 0.0, s * 0.18, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.1);
    g.lineTo(-s * 0.12, -s * 0.3);
    g.lineTo(-s * 0.04, -s * 0.14);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.04, -s * 0.14);
    g.lineTo(s * 0.1, -s * 0.3);
    g.lineTo(s * 0.14, -s * 0.1);
    g.closePath();
    g.fill();
    // Inner ears
    g.fillStyle = '#c83a3a';
    g.beginPath();
    g.moveTo(-s * 0.14, -s * 0.14);
    g.lineTo(-s * 0.12, -s * 0.22);
    g.lineTo(-s * 0.08, -s * 0.14);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.08, -s * 0.14);
    g.lineTo(s * 0.1, -s * 0.22);
    g.lineTo(s * 0.14, -s * 0.14);
    g.closePath();
    g.fill();
    // Snout
    g.fillStyle = '#f2ece0';
    g.beginPath();
    g.moveTo(-s * 0.04, -s * 0.04);
    g.lineTo(s * 0.16, s * 0.0);
    g.lineTo(s * 0.16, s * 0.08);
    g.lineTo(-s * 0.04, s * 0.04);
    g.closePath();
    g.fill();
    // Eyes (glowing gold)
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(-s * 0.06, -s * 0.02, s * 0.014, s * 0.022, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.04, -s * 0.02, s * 0.014, s * 0.022, 0, 0, Math.PI * 2);
    g.fill();
    // Nose
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(s * 0.16, s * 0.02, s * 0.012, 0, Math.PI * 2);
    g.fill();
    // Nine tails fanning out behind.
    g.fillStyle = '#f2ece0';
    const tailAngles = [-0.2, -0.05, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0];
    for (const a of tailAngles) {
      g.save();
      g.translate(s * 0.2, s * 0.34);
      g.rotate(-Math.PI / 4 + a * 0.4);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(s * 0.2, -s * 0.14, s * 0.34, -s * 0.2);
      g.quadraticCurveTo(s * 0.24, -s * 0.04, s * 0.04, s * 0.04);
      g.closePath();
      g.fill();
      // Red tail tip
      g.fillStyle = '#c83a3a';
      g.beginPath();
      g.ellipse(s * 0.32, -s * 0.2, s * 0.04, s * 0.02, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f2ece0';
      g.restore();
    }
    // Floating kitsunebi (fox fire) flames.
    g.fillStyle = p.accent;
    for (let i = 0; i < 3; i++) {
      const x = -s * 0.32 - i * s * 0.02;
      const y = -s * 0.12 - i * s * 0.12;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + s * 0.04, y - s * 0.08, x, y - s * 0.1);
      g.quadraticCurveTo(x - s * 0.04, y - s * 0.04, x, y);
      g.closePath();
      g.fill();
    }
  },
};

const TENGU: Figure = {
  id: 'tengu',
  draw(g, s, p) {
    drawRobedBody(g, s, p, p.accent);
    // Red face with famously long nose.
    g.fillStyle = '#c83a3a';
    g.beginPath();
    g.ellipse(0, -s * 0.28, s * 0.16, s * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    // Long nose — wedge jutting forward.
    g.beginPath();
    g.moveTo(s * 0.02, -s * 0.28);
    g.lineTo(s * 0.38, -s * 0.22);
    g.lineTo(s * 0.02, -s * 0.2);
    g.closePath();
    g.fill();
    // White bushy eyebrows + beard
    g.fillStyle = '#f2ece0';
    g.beginPath();
    g.moveTo(-s * 0.14, -s * 0.36);
    g.lineTo(-s * 0.04, -s * 0.34);
    g.lineTo(-s * 0.04, -s * 0.32);
    g.lineTo(-s * 0.14, -s * 0.32);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(-s * 0.08, -s * 0.12);
    g.lineTo(-s * 0.12, s * 0.06);
    g.lineTo(s * 0.0, s * 0.02);
    g.closePath();
    g.fill();
    // Eyes
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(-s * 0.08, -s * 0.28, s * 0.016, 0, Math.PI * 2);
    g.fill();
    // Small black tokin cap
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(-s * 0.08, -s * 0.48, s * 0.04, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.accent2;
    g.fillRect(-s * 0.18, -s * 0.46, s * 0.2, s * 0.02);
    // Feathered wings sprouting from back.
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.16, s * 0.08);
    g.quadraticCurveTo(-s * 0.56, s * 0.0, -s * 0.48, s * 0.38);
    g.quadraticCurveTo(-s * 0.3, s * 0.22, -s * 0.14, s * 0.24);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.16, s * 0.08);
    g.quadraticCurveTo(s * 0.56, s * 0.0, s * 0.48, s * 0.38);
    g.quadraticCurveTo(s * 0.3, s * 0.22, s * 0.14, s * 0.24);
    g.closePath();
    g.fill();
    // Feather ribs
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.008;
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      g.beginPath();
      g.moveTo(-s * 0.16 - t * s * 0.32, s * 0.08 + t * s * 0.12);
      g.lineTo(-s * 0.14 - t * s * 0.3, s * 0.2 + t * s * 0.08);
      g.stroke();
      g.beginPath();
      g.moveTo(s * 0.16 + t * s * 0.32, s * 0.08 + t * s * 0.12);
      g.lineTo(s * 0.14 + t * s * 0.3, s * 0.2 + t * s * 0.08);
      g.stroke();
    }
    // Wooden geta clogs at feet (flashes of brown).
    g.fillStyle = '#7a4e2a';
    g.fillRect(-s * 0.2, s * 0.94, s * 0.14, s * 0.04);
    g.fillRect(s * 0.06, s * 0.94, s * 0.14, s * 0.04);
    // Fan (uchiwa) held in right hand.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.018;
    g.beginPath();
    g.moveTo(s * 0.26, s * 0.12);
    g.lineTo(s * 0.4, -s * 0.2);
    g.stroke();
    g.fillStyle = p.accent2;
    g.beginPath();
    g.arc(s * 0.4, -s * 0.2, s * 0.1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.ink;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(s * 0.4, -s * 0.2);
      g.lineTo(s * 0.4 + Math.cos(a) * s * 0.1, -s * 0.2 + Math.sin(a) * s * 0.1);
      g.stroke();
    }
  },
};

const ONI: Figure = {
  id: 'oni',
  draw(g, s, p) {
    // Red-skinned ogre with horns and club.
    // Body — loincloth
    g.fillStyle = '#c83a3a';
    g.beginPath();
    g.moveTo(-s * 0.3, -s * 0.06);
    g.lineTo(s * 0.3, -s * 0.06);
    g.lineTo(s * 0.38, s * 0.66);
    g.lineTo(-s * 0.38, s * 0.66);
    g.closePath();
    g.fill();
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.4, s * 0.5, s * 0.8, s * 0.12);
    g.fillStyle = p.ink;
    for (let i = -5; i <= 5; i++) {
      g.fillRect(i * s * 0.06 - s * 0.008, s * 0.5, s * 0.016, s * 0.12);
    }
    // Head — big red with two horns.
    g.fillStyle = '#c83a3a';
    g.beginPath();
    g.ellipse(0, -s * 0.28, s * 0.22, s * 0.22, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f2ece0';
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.38);
    g.lineTo(-s * 0.24, -s * 0.6);
    g.lineTo(-s * 0.1, -s * 0.4);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.18, -s * 0.38);
    g.lineTo(s * 0.24, -s * 0.6);
    g.lineTo(s * 0.1, -s * 0.4);
    g.closePath();
    g.fill();
    // Wild black hair between horns
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.14, -s * 0.38);
    for (let i = 0; i < 7; i++) {
      g.lineTo(-s * 0.14 + i * s * 0.04, -s * 0.48 + (i % 2) * s * 0.05);
    }
    g.lineTo(s * 0.14, -s * 0.38);
    g.closePath();
    g.fill();
    // Big round eyes with gold irises
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(-s * 0.09, -s * 0.28, s * 0.035, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.09, -s * 0.28, s * 0.035, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(-s * 0.09, -s * 0.28, s * 0.014, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.09, -s * 0.28, s * 0.014, 0, Math.PI * 2);
    g.fill();
    // Fanged mouth
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.08, -s * 0.16, s * 0.16, s * 0.04);
    g.fillStyle = '#f2ece0';
    g.beginPath();
    g.moveTo(-s * 0.06, -s * 0.12);
    g.lineTo(-s * 0.04, -s * 0.06);
    g.lineTo(-s * 0.02, -s * 0.12);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.02, -s * 0.12);
    g.lineTo(s * 0.04, -s * 0.06);
    g.lineTo(s * 0.06, -s * 0.12);
    g.closePath();
    g.fill();
    // Iron kanabō club
    g.fillStyle = p.ink;
    g.fillRect(s * 0.24, -s * 0.04, s * 0.2, s * 0.7);
    g.fillStyle = p.accent;
    for (let i = 0; i < 12; i++) {
      const yy = s * 0.02 + (i % 6) * s * 0.1;
      const xx = s * 0.26 + (i < 6 ? 0 : s * 0.12);
      g.beginPath();
      g.arc(xx, yy, s * 0.018, 0, Math.PI * 2);
      g.fill();
    }
  },
};

const SAMURAI: Figure = {
  id: 'samurai',
  draw(g, s, p) {
    // Standing samurai in armor, katana ready.
    // Armored skirt (kusazuri)
    g.fillStyle = p.accent2;
    g.beginPath();
    g.moveTo(-s * 0.3, s * 0.18);
    g.lineTo(s * 0.3, s * 0.18);
    g.lineTo(s * 0.42, s * 0.72);
    g.lineTo(-s * 0.42, s * 0.72);
    g.closePath();
    g.fill();
    // Lamellae bands
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.006;
    for (let y = 0; y < 5; y++) {
      g.beginPath();
      g.moveTo(-s * 0.36 + y * s * 0.012, s * 0.28 + y * s * 0.08);
      g.lineTo(s * 0.36 - y * s * 0.012, s * 0.28 + y * s * 0.08);
      g.stroke();
    }
    // Chest plate (do)
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.22, -s * 0.04);
    g.lineTo(s * 0.22, -s * 0.04);
    g.lineTo(s * 0.28, s * 0.2);
    g.lineTo(-s * 0.28, s * 0.2);
    g.closePath();
    g.fill();
    // Clan mon — gold circle on chest.
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(0, s * 0.1, s * 0.06, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(0, s * 0.1, s * 0.03, 0, Math.PI * 2);
    g.fill();
    // Kabuto helmet — bowl + horn-like maedate.
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.22, -s * 0.24);
    g.quadraticCurveTo(0, -s * 0.5, s * 0.22, -s * 0.24);
    g.lineTo(s * 0.2, -s * 0.08);
    g.lineTo(-s * 0.2, -s * 0.08);
    g.closePath();
    g.fill();
    // Horns maedate
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.04, -s * 0.42);
    g.quadraticCurveTo(-s * 0.18, -s * 0.66, -s * 0.04, -s * 0.66);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.04, -s * 0.42);
    g.quadraticCurveTo(s * 0.18, -s * 0.66, s * 0.04, -s * 0.66);
    g.closePath();
    g.fill();
    // Mask with menacing mustache.
    g.fillStyle = '#5a3a1a';
    g.fillRect(-s * 0.14, -s * 0.14, s * 0.28, s * 0.1);
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(-s * 0.06, -s * 0.1, s * 0.014, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.06, -s * 0.1, s * 0.014, 0, Math.PI * 2);
    g.fill();
    // Katana held diagonally in front.
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.moveTo(-s * 0.26, s * 0.12);
    g.lineTo(s * 0.46, -s * 0.26);
    g.stroke();
    // Blade edge
    g.strokeStyle = '#f2ece0';
    g.lineWidth = s * 0.006;
    g.beginPath();
    g.moveTo(-s * 0.24, s * 0.08);
    g.lineTo(s * 0.42, -s * 0.28);
    g.stroke();
    // Hilt
    g.fillStyle = p.accent;
    g.save();
    g.translate(-s * 0.26, s * 0.12);
    g.rotate(Math.atan2(-0.38, 0.72));
    g.fillRect(0, -s * 0.02, s * 0.12, s * 0.04);
    g.restore();
  },
};

const GEISHA: Figure = {
  id: 'geisha',
  draw(g, s, p) {
    // Woman in a patterned kimono, obi, hair pinned up with kanzashi.
    // Kimono
    g.fillStyle = p.accent2;
    g.beginPath();
    g.moveTo(-s * 0.24, -s * 0.02);
    g.lineTo(s * 0.24, -s * 0.02);
    g.lineTo(s * 0.44, s * 0.96);
    g.lineTo(-s * 0.44, s * 0.96);
    g.closePath();
    g.fill();
    // Sakura blossoms sprinkled on kimono.
    g.fillStyle = '#f5aac4';
    for (let i = 0; i < 8; i++) {
      const x = (Math.random() - 0.5) * s * 0.7;
      const y = s * 0.1 + Math.random() * s * 0.8;
      g.beginPath();
      for (let pp = 0; pp < 5; pp++) {
        const a = (pp / 5) * Math.PI * 2;
        g.lineTo(x + Math.cos(a) * s * 0.03, y + Math.sin(a) * s * 0.03);
      }
      g.closePath();
      g.fill();
    }
    // Crossover neckline (inner white)
    g.fillStyle = '#f2ece0';
    g.beginPath();
    g.moveTo(-s * 0.08, -s * 0.02);
    g.lineTo(0, s * 0.28);
    g.lineTo(s * 0.08, -s * 0.02);
    g.closePath();
    g.fill();
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.005;
    g.beginPath();
    g.moveTo(-s * 0.08, -s * 0.02);
    g.lineTo(0, s * 0.28);
    g.lineTo(s * 0.08, -s * 0.02);
    g.stroke();
    // Wide red obi sash.
    g.fillStyle = '#c83838';
    g.fillRect(-s * 0.4, s * 0.32, s * 0.8, s * 0.16);
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.4, s * 0.32, s * 0.8, s * 0.02);
    g.fillRect(-s * 0.4, s * 0.46, s * 0.8, s * 0.02);
    // White painted face
    g.fillStyle = '#f2ece0';
    g.beginPath();
    g.ellipse(0, -s * 0.3, s * 0.15, s * 0.19, 0, 0, Math.PI * 2);
    g.fill();
    // Red lips
    g.fillStyle = '#c83838';
    g.fillRect(-s * 0.02, -s * 0.22, s * 0.04, s * 0.02);
    // Thin eyebrows + eyes
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.08, -s * 0.36, s * 0.04, s * 0.008);
    g.fillRect(s * 0.04, -s * 0.36, s * 0.04, s * 0.008);
    g.beginPath();
    g.arc(-s * 0.06, -s * 0.32, s * 0.008, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.06, -s * 0.32, s * 0.008, 0, Math.PI * 2);
    g.fill();
    // Piled-up black hair.
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.16, -s * 0.4);
    g.quadraticCurveTo(0, -s * 0.64, s * 0.16, -s * 0.4);
    g.lineTo(s * 0.14, -s * 0.3);
    g.lineTo(-s * 0.14, -s * 0.3);
    g.closePath();
    g.fill();
    // Kanzashi hair ornaments (gold pins with dangling petals).
    g.fillStyle = p.accent;
    for (let i = 0; i < 3; i++) {
      const x = -s * 0.1 + i * s * 0.1;
      g.beginPath();
      g.arc(x, -s * 0.56, s * 0.022, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#f5aac4';
      g.beginPath();
      g.ellipse(x, -s * 0.48, s * 0.012, s * 0.03, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = p.accent;
    }
  },
};

export const EDO_PANTHEON: Pantheon = {
  palette: EDO_PALETTE,
  figures: [AMATERASU, RAIJIN, FUJIN, KITSUNE, TENGU, ONI, SAMURAI, GEISHA],
};
