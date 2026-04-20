import { drawRobedBody } from './common.ts';
import type { Figure, Palette, Pantheon } from './types.ts';

/**
 * Chinese pantheon — mythic figures and immortals: dragon, phoenix, Jade
 * Emperor, Guan Yu, Sun Wukong, Nüwa, Chang'e, Guanyin. Palette is imperial
 * cinnabar red ink on jade-green glow — red and green are the canonical
 * Chinese-festival pairing, and the green halo cuts cleanly against the
 * warm gold/amber sky of the China flow.
 */

const CHINA_PALETTE: Palette = {
  ink: '#7a0e1c', // deep cinnabar
  accent: '#f4c542', // imperial gold
  accent2: '#1a8a5a', // jade green secondary
  glowInner: 'rgba(255, 230, 170, 0.95)',
  glowMid: 'rgba(60, 160, 90, 0.5)',
  glowEdge: 'rgba(20, 40, 24, 0)',
  halo: 'rgba(120, 220, 160, 0.7)',
};

function head(g: CanvasRenderingContext2D, s: number, p: Palette): void {
  g.fillStyle = p.ink;
  g.fillRect(-s * 0.06, -s * 0.1, s * 0.12, s * 0.14);
  g.beginPath();
  g.ellipse(0, -s * 0.28, s * 0.16, s * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  // Slim eye lines
  g.strokeStyle = p.accent;
  g.lineWidth = s * 0.012;
  g.beginPath();
  g.moveTo(-s * 0.1, -s * 0.3);
  g.lineTo(-s * 0.04, -s * 0.3);
  g.moveTo(s * 0.04, -s * 0.3);
  g.lineTo(s * 0.1, -s * 0.3);
  g.stroke();
}

const DRAGON: Figure = {
  id: 'dragon',
  draw(g, s, p) {
    // Coiling oriental dragon — long sinuous body, no human form.
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.12;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-s * 0.42, s * 0.6);
    g.bezierCurveTo(-s * 0.1, s * 0.86, s * 0.32, s * 0.4, s * 0.1, s * 0.06);
    g.bezierCurveTo(-s * 0.18, -s * 0.22, -s * 0.18, -s * 0.5, s * 0.1, -s * 0.6);
    g.stroke();
    // Belly accent — gold underside.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.04;
    g.beginPath();
    g.moveTo(-s * 0.42, s * 0.6);
    g.bezierCurveTo(-s * 0.1, s * 0.86, s * 0.32, s * 0.4, s * 0.1, s * 0.06);
    g.bezierCurveTo(-s * 0.18, -s * 0.22, -s * 0.18, -s * 0.5, s * 0.1, -s * 0.6);
    g.stroke();
    // Head — bearded dragon with antlers.
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(s * 0.16, -s * 0.62, s * 0.14, s * 0.1, 0.3, 0, Math.PI * 2);
    g.fill();
    // Snout
    g.beginPath();
    g.moveTo(s * 0.26, -s * 0.62);
    g.lineTo(s * 0.4, -s * 0.56);
    g.lineTo(s * 0.4, -s * 0.5);
    g.lineTo(s * 0.24, -s * 0.54);
    g.closePath();
    g.fill();
    // Antlers
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.018;
    g.beginPath();
    g.moveTo(s * 0.1, -s * 0.7);
    g.lineTo(s * 0.0, -s * 0.84);
    g.moveTo(s * 0.04, -s * 0.78);
    g.lineTo(-s * 0.06, -s * 0.82);
    g.stroke();
    // Whiskers
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.01;
    g.beginPath();
    g.moveTo(s * 0.32, -s * 0.5);
    g.quadraticCurveTo(s * 0.46, -s * 0.4, s * 0.5, -s * 0.32);
    g.moveTo(s * 0.32, -s * 0.48);
    g.quadraticCurveTo(s * 0.5, -s * 0.36, s * 0.56, -s * 0.22);
    g.stroke();
    // Glowing pearl chased by the dragon.
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(-s * 0.36, -s * 0.46, s * 0.08, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff5cc';
    g.beginPath();
    g.arc(-s * 0.38, -s * 0.48, s * 0.04, 0, Math.PI * 2);
    g.fill();
    // Eye on the head
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(s * 0.18, -s * 0.62, s * 0.018, 0, Math.PI * 2);
    g.fill();
  },
};

const PHOENIX: Figure = {
  id: 'fenghuang',
  draw(g, s, p) {
    // Fenghuang — phoenix with sweeping plumes.
    g.fillStyle = p.ink;
    // Body
    g.beginPath();
    g.ellipse(0, s * 0.1, s * 0.14, s * 0.22, 0, 0, Math.PI * 2);
    g.fill();
    // Long elegant neck
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.06;
    g.beginPath();
    g.moveTo(0, -s * 0.1);
    g.quadraticCurveTo(s * 0.16, -s * 0.34, s * 0.12, -s * 0.5);
    g.stroke();
    // Head
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(s * 0.12, -s * 0.5, s * 0.08, 0, Math.PI * 2);
    g.fill();
    // Beak
    g.beginPath();
    g.moveTo(s * 0.18, -s * 0.5);
    g.lineTo(s * 0.3, -s * 0.46);
    g.lineTo(s * 0.18, -s * 0.42);
    g.closePath();
    g.fill();
    // Crest of three plumes
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.018;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(s * 0.1, -s * 0.58);
      g.quadraticCurveTo(s * 0.0 + i * s * 0.04, -s * 0.74, s * 0.04 + i * s * 0.04, -s * 0.84);
      g.stroke();
    }
    // Long tail feathers — five layers of color.
    const tailColors = [p.accent, p.accent2, p.accent, '#d44', p.accent];
    for (let i = 0; i < tailColors.length; i++) {
      g.strokeStyle = tailColors[i];
      g.lineWidth = s * 0.022;
      const dir = (i - 2) * 0.08;
      g.beginPath();
      g.moveTo(-s * 0.06, s * 0.18);
      g.bezierCurveTo(
        -s * 0.3 + dir * s * 0.4,
        s * 0.4,
        -s * 0.34 + dir * s * 0.5,
        s * 0.7,
        -s * 0.4 + dir * s * 0.5,
        s * 0.96,
      );
      g.stroke();
      // Eye-spot at tail tip.
      g.fillStyle = tailColors[i];
      g.beginPath();
      g.arc(-s * 0.4 + dir * s * 0.5, s * 0.96, s * 0.025, 0, Math.PI * 2);
      g.fill();
    }
    // Wing arc
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.024;
    g.beginPath();
    g.moveTo(s * 0.06, -s * 0.04);
    g.quadraticCurveTo(s * 0.42, s * 0.0, s * 0.46, s * 0.32);
    g.stroke();
  },
};

const JADE_EMPEROR: Figure = {
  id: 'jade_emperor',
  draw(g, s, p) {
    drawRobedBody(g, s, p, p.accent);
    head(g, s, p);
    // Long imperial beard.
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.06, -s * 0.16);
    g.lineTo(-s * 0.1, s * 0.14);
    g.lineTo(s * 0.1, s * 0.14);
    g.lineTo(s * 0.06, -s * 0.16);
    g.closePath();
    g.fill();
    // Mian crown — flat board over the head with bead curtains hanging front and back.
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.22, -s * 0.5, s * 0.44, s * 0.04);
    // Front bead curtain
    g.fillStyle = p.accent2;
    for (let i = 0; i < 7; i++) {
      const x = -s * 0.18 + i * s * 0.06;
      g.beginPath();
      g.arc(x, -s * 0.42, s * 0.012, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(x, -s * 0.38, s * 0.012, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(x, -s * 0.34, s * 0.012, 0, Math.PI * 2);
      g.fill();
    }
    // Hu tablet held in both hands.
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.06, s * 0.18, s * 0.12, s * 0.32);
    g.fillStyle = p.ink;
    for (let i = 0; i < 4; i++) {
      g.fillRect(-s * 0.04, s * 0.22 + i * s * 0.07, s * 0.08, s * 0.012);
    }
  },
};

const GUAN_YU: Figure = {
  id: 'guan_yu',
  draw(g, s, p) {
    drawRobedBody(g, s, p, p.accent2);
    head(g, s, p);
    // Famous red face with long black beard.
    g.fillStyle = '#c83030';
    g.beginPath();
    g.ellipse(0, -s * 0.28, s * 0.16, s * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a0a05';
    g.beginPath();
    g.moveTo(-s * 0.08, -s * 0.16);
    g.lineTo(-s * 0.12, s * 0.18);
    g.lineTo(s * 0.12, s * 0.18);
    g.lineTo(s * 0.08, -s * 0.16);
    g.closePath();
    g.fill();
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.moveTo(-s * 0.1, -s * 0.3);
    g.lineTo(-s * 0.04, -s * 0.32);
    g.moveTo(s * 0.04, -s * 0.32);
    g.lineTo(s * 0.1, -s * 0.3);
    g.stroke();
    // Helmet — official cap with two side flaps.
    g.fillStyle = p.accent2;
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.42);
    g.lineTo(s * 0.18, -s * 0.42);
    g.lineTo(s * 0.14, -s * 0.56);
    g.lineTo(-s * 0.14, -s * 0.56);
    g.closePath();
    g.fill();
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.04, -s * 0.6, s * 0.08, s * 0.06);
    // Guandao polearm — long staff with crescent blade.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.028;
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.4);
    g.lineTo(s * 0.34, s * 0.86);
    g.stroke();
    g.fillStyle = '#bababa';
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.4);
    g.quadraticCurveTo(s * 0.5, -s * 0.66, s * 0.3, -s * 0.78);
    g.lineTo(s * 0.32, -s * 0.62);
    g.quadraticCurveTo(s * 0.42, -s * 0.5, s * 0.34, -s * 0.46);
    g.closePath();
    g.fill();
  },
};

const MONKEY_KING: Figure = {
  id: 'monkey_king',
  draw(g, s, p) {
    drawRobedBody(g, s, p, p.accent2);
    // Monkey face — golden simian features.
    g.fillStyle = '#b87838';
    g.beginPath();
    g.ellipse(0, -s * 0.28, s * 0.17, s * 0.18, 0, 0, Math.PI * 2);
    g.fill();
    // Lighter muzzle
    g.fillStyle = '#e8b878';
    g.beginPath();
    g.ellipse(0, -s * 0.22, s * 0.1, s * 0.08, 0, 0, Math.PI * 2);
    g.fill();
    // Eyes
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(-s * 0.06, -s * 0.32, s * 0.022, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.06, -s * 0.32, s * 0.022, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(-s * 0.06, -s * 0.32, s * 0.01, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.06, -s * 0.32, s * 0.01, 0, Math.PI * 2);
    g.fill();
    // Ears
    g.fillStyle = '#b87838';
    g.beginPath();
    g.arc(-s * 0.18, -s * 0.28, s * 0.04, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.18, -s * 0.28, s * 0.04, 0, Math.PI * 2);
    g.fill();
    // Phoenix-feather cap (his famous golden circlet + plumes).
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.022;
    g.beginPath();
    g.arc(0, -s * 0.4, s * 0.18, Math.PI, 0);
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.04, -s * 0.5);
    g.quadraticCurveTo(-s * 0.18, -s * 0.84, -s * 0.04, -s * 0.84);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.04, -s * 0.5);
    g.quadraticCurveTo(s * 0.18, -s * 0.84, s * 0.04, -s * 0.84);
    g.closePath();
    g.fill();
    // Ruyi Jingu Bang staff — gold rod with red tips.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.04;
    g.beginPath();
    g.moveTo(-s * 0.5, s * 0.86);
    g.lineTo(s * 0.5, -s * 0.18);
    g.stroke();
    g.fillStyle = '#c83030';
    g.fillRect(-s * 0.54, s * 0.82, s * 0.08, s * 0.08);
    g.save();
    g.translate(s * 0.5, -s * 0.18);
    g.rotate(-Math.atan2(1.04, 1.0));
    g.fillRect(-s * 0.04, -s * 0.04, s * 0.08, s * 0.08);
    g.restore();
  },
};

const NUWA: Figure = {
  id: 'nuwa',
  draw(g, s, p) {
    // Serpent-bodied creator goddess — human torso, long coiling tail.
    g.fillStyle = p.ink;
    // Coiling tail
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.12;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-s * 0.06, s * 0.04);
    g.bezierCurveTo(s * 0.42, s * 0.16, -s * 0.42, s * 0.5, s * 0.42, s * 0.86);
    g.stroke();
    // Scales hint
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.014;
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      const x = (-s * 0.06) + (s * 0.48) * Math.sin(t * Math.PI * 2.4);
      const y = s * 0.04 + t * s * 0.82;
      g.beginPath();
      g.arc(x, y, s * 0.02, Math.PI, 0);
      g.stroke();
    }
    // Human torso
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.04);
    g.lineTo(s * 0.18, -s * 0.04);
    g.lineTo(s * 0.14, s * 0.18);
    g.lineTo(-s * 0.14, s * 0.18);
    g.closePath();
    g.fill();
    // Head + flowing hair
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(0, -s * 0.28, s * 0.15, s * 0.19, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.36);
    g.quadraticCurveTo(-s * 0.32, -s * 0.04, -s * 0.22, s * 0.18);
    g.lineTo(-s * 0.1, s * 0.04);
    g.lineTo(-s * 0.12, -s * 0.32);
    g.closePath();
    g.fill();
    // Carpenter's compass (Nüwa's iconic creation tool) in right hand.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.028;
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.4);
    g.lineTo(s * 0.22, s * 0.0);
    g.moveTo(s * 0.34, -s * 0.4);
    g.lineTo(s * 0.46, s * 0.0);
    g.stroke();
    g.fillStyle = p.accent2;
    g.beginPath();
    g.arc(s * 0.34, -s * 0.4, s * 0.022, 0, Math.PI * 2);
    g.fill();
    // Five-color stones she used to mend the sky — small stones in left hand.
    const stoneColors = [p.accent, p.accent2, '#c83030', '#7a3da8', '#3a8acf'];
    for (let i = 0; i < 5; i++) {
      g.fillStyle = stoneColors[i];
      g.beginPath();
      g.arc(-s * 0.28 + (i - 2) * s * 0.04, -s * 0.32, s * 0.022, 0, Math.PI * 2);
      g.fill();
    }
  },
};

const CHANGE: Figure = {
  id: 'change',
  draw(g, s, p) {
    drawRobedBody(g, s, p);
    head(g, s, p);
    // Long sleeves trailing — flowing celestial garments.
    g.fillStyle = p.accent2;
    g.beginPath();
    g.moveTo(-s * 0.3, s * 0.04);
    g.quadraticCurveTo(-s * 0.6, s * 0.4, -s * 0.4, s * 0.86);
    g.lineTo(-s * 0.26, s * 0.84);
    g.quadraticCurveTo(-s * 0.4, s * 0.4, -s * 0.18, s * 0.1);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.3, s * 0.04);
    g.quadraticCurveTo(s * 0.6, s * 0.4, s * 0.4, s * 0.86);
    g.lineTo(s * 0.26, s * 0.84);
    g.quadraticCurveTo(s * 0.4, s * 0.4, s * 0.18, s * 0.1);
    g.closePath();
    g.fill();
    // Hair coils high.
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(-s * 0.08, -s * 0.5, s * 0.06, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.08, -s * 0.5, s * 0.06, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(0, -s * 0.6, s * 0.05, 0, Math.PI * 2);
    g.fill();
    // Full moon over her shoulder — her destination.
    g.fillStyle = '#fef3c0';
    g.beginPath();
    g.arc(s * 0.36, -s * 0.5, s * 0.16, 0, Math.PI * 2);
    g.fill();
    // Jade rabbit silhouette on the moon.
    g.fillStyle = p.accent2;
    g.beginPath();
    g.ellipse(s * 0.36, -s * 0.5, s * 0.05, s * 0.07, 0.2, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.32, -s * 0.6, s * 0.012, s * 0.04, -0.3, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.36, -s * 0.62, s * 0.012, s * 0.04, 0.1, 0, Math.PI * 2);
    g.fill();
    // Elixir flask in her hands.
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.06, s * 0.22);
    g.lineTo(s * 0.06, s * 0.22);
    g.lineTo(s * 0.04, s * 0.28);
    g.lineTo(s * 0.1, s * 0.36);
    g.lineTo(-s * 0.1, s * 0.36);
    g.lineTo(-s * 0.04, s * 0.28);
    g.closePath();
    g.fill();
  },
};

const GUANYIN: Figure = {
  id: 'guanyin',
  draw(g, s, p) {
    // Bodhisattva of mercy — seated in lotus pose on a lotus throne.
    // Lotus throne base
    g.fillStyle = p.accent;
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.moveTo(i * s * 0.06, s * 0.86);
      g.quadraticCurveTo(i * s * 0.06, s * 0.7, (i - 0.5) * s * 0.06, s * 0.86);
      g.quadraticCurveTo((i + 0.5) * s * 0.06, s * 0.86, i * s * 0.06, s * 0.7);
      g.fill();
    }
    g.fillStyle = '#f6e8a0';
    g.beginPath();
    g.ellipse(0, s * 0.86, s * 0.34, s * 0.06, 0, 0, Math.PI * 2);
    g.fill();
    // Robed seated body — wider triangular silhouette.
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.3, s * 0.14);
    g.lineTo(s * 0.3, s * 0.14);
    g.lineTo(s * 0.42, s * 0.78);
    g.lineTo(-s * 0.42, s * 0.78);
    g.closePath();
    g.fill();
    // Crossed legs hint.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.014;
    g.beginPath();
    g.moveTo(-s * 0.36, s * 0.7);
    g.quadraticCurveTo(0, s * 0.6, s * 0.36, s * 0.7);
    g.stroke();
    head(g, s, p);
    // Tall bodhisattva crown (five-point Vajra crown).
    g.fillStyle = p.accent;
    for (let i = 0; i < 5; i++) {
      const x = -s * 0.16 + i * s * 0.08;
      g.beginPath();
      g.moveTo(x, -s * 0.42);
      g.lineTo(x + s * 0.04, -s * 0.6);
      g.lineTo(x + s * 0.08, -s * 0.42);
      g.closePath();
      g.fill();
    }
    g.fillRect(-s * 0.18, -s * 0.42, s * 0.36, s * 0.04);
    // Vase with willow branch.
    g.fillStyle = '#f6e8a0';
    g.beginPath();
    g.moveTo(s * 0.2, s * 0.18);
    g.quadraticCurveTo(s * 0.32, s * 0.3, s * 0.28, s * 0.46);
    g.quadraticCurveTo(s * 0.18, s * 0.5, s * 0.16, s * 0.46);
    g.quadraticCurveTo(s * 0.12, s * 0.3, s * 0.2, s * 0.18);
    g.closePath();
    g.fill();
    // Willow branch sprigs
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.014;
    g.beginPath();
    g.moveTo(s * 0.22, s * 0.18);
    g.quadraticCurveTo(s * 0.32, -s * 0.04, s * 0.36, -s * 0.18);
    g.stroke();
    for (let i = 0; i < 4; i++) {
      const t = i / 4;
      const x = s * 0.22 + (s * 0.14) * t;
      const y = s * 0.18 - (s * 0.36) * t;
      g.beginPath();
      g.ellipse(x + s * 0.04, y, s * 0.022, s * 0.008, 0.6, 0, Math.PI * 2);
      g.fill();
    }
    // Halo behind head — circular jade ring.
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.014;
    g.beginPath();
    g.arc(0, -s * 0.28, s * 0.26, 0, Math.PI * 2);
    g.stroke();
  },
};

export const CHINA_PANTHEON: Pantheon = {
  palette: CHINA_PALETTE,
  figures: [DRAGON, PHOENIX, JADE_EMPEROR, GUAN_YU, MONKEY_KING, NUWA, CHANGE, GUANYIN],
};
