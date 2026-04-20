import { drawTogaBody } from './common.ts';
import type { Figure, Palette, Pantheon } from './types.ts';

/**
 * Enlightenment pantheon — the great reasoners and their emblematic tools:
 * Newton with prism, Voltaire with quill, Rousseau with nature scroll, Kant
 * with pocket watch, Lavoisier at the balance, Franklin with kite, Euler at
 * the chalkboard, Encyclopédie volume. Palette: pale ivory over candle-gold
 * with a cold steel-blue accent — the look of an academy library at dusk.
 */

const ENLIGHT_PALETTE: Palette = {
  ink: '#1f1a0f', // dark brown-black ink
  accent: '#e8b96a', // candle gold
  accent2: '#6ea4c8', // steel blue
  glowInner: 'rgba(255, 228, 174, 0.95)',
  glowMid: 'rgba(160, 120, 70, 0.5)',
  glowEdge: 'rgba(24, 20, 12, 0)',
  halo: 'rgba(240, 220, 160, 0.7)',
};

function wig(g: CanvasRenderingContext2D, s: number, p: Palette): void {
  // Powdered wig with side curls — signature of 18th-century European scholars.
  g.fillStyle = '#e8e0c8';
  g.beginPath();
  g.moveTo(-s * 0.22, -s * 0.3);
  g.quadraticCurveTo(-s * 0.24, -s * 0.52, 0, -s * 0.56);
  g.quadraticCurveTo(s * 0.24, -s * 0.52, s * 0.22, -s * 0.3);
  g.lineTo(s * 0.22, -s * 0.08);
  g.lineTo(-s * 0.22, -s * 0.08);
  g.closePath();
  g.fill();
  // Side curls (three stacked lobes on each side).
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(dir * s * 0.22, -s * 0.24 + i * s * 0.08, s * 0.06, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Ribbon at the back.
  g.fillStyle = p.accent2;
  g.fillRect(-s * 0.04, -s * 0.08, s * 0.08, s * 0.06);
}

function scholarHead(g: CanvasRenderingContext2D, s: number, p: Palette): void {
  g.fillStyle = '#f0d9b0';
  g.fillRect(-s * 0.06, -s * 0.1, s * 0.12, s * 0.14);
  g.beginPath();
  g.ellipse(0, -s * 0.28, s * 0.14, s * 0.17, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = p.ink;
  g.beginPath();
  g.arc(-s * 0.05, -s * 0.3, s * 0.008, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(s * 0.05, -s * 0.3, s * 0.008, 0, Math.PI * 2);
  g.fill();
  // Rosy cheek + lip hint.
  g.fillStyle = '#c87860';
  g.fillRect(-s * 0.02, -s * 0.22, s * 0.04, s * 0.008);
}

const NEWTON: Figure = {
  id: 'newton',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    scholarHead(g, s, p);
    wig(g, s, p);
    // Prism refracting a beam into rainbow.
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.42, s * 0.18);
    g.lineTo(-s * 0.18, s * 0.06);
    g.lineTo(-s * 0.28, s * 0.42);
    g.closePath();
    g.fill();
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.006;
    g.beginPath();
    g.moveTo(-s * 0.42, s * 0.18);
    g.lineTo(-s * 0.18, s * 0.06);
    g.lineTo(-s * 0.28, s * 0.42);
    g.closePath();
    g.stroke();
    // White light entering from upper-left.
    g.strokeStyle = '#fff5cc';
    g.lineWidth = s * 0.014;
    g.beginPath();
    g.moveTo(-s * 0.54, -s * 0.02);
    g.lineTo(-s * 0.32, s * 0.18);
    g.stroke();
    // Rainbow exiting to the right.
    const colors = ['#c83a3a', '#e8962c', '#f4d22c', '#2aa84a', '#2a6fc8', '#4a2a9c', '#8a2ab0'];
    for (let i = 0; i < colors.length; i++) {
      g.strokeStyle = colors[i];
      g.lineWidth = s * 0.008;
      g.beginPath();
      g.moveTo(-s * 0.22, s * 0.22 + i * s * 0.012);
      g.lineTo(s * 0.14, s * 0.12 + i * s * 0.03);
      g.stroke();
    }
    // Apple held in right hand (Newton's legend).
    g.fillStyle = '#c83838';
    g.beginPath();
    g.arc(s * 0.3, s * 0.18, s * 0.07, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#3a7030';
    g.lineWidth = s * 0.01;
    g.beginPath();
    g.moveTo(s * 0.3, s * 0.11);
    g.lineTo(s * 0.34, s * 0.05);
    g.stroke();
    // Principia book under his arm.
    g.fillStyle = '#5a3a1a';
    g.fillRect(-s * 0.14, s * 0.58, s * 0.28, s * 0.08);
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.12, s * 0.6, s * 0.24, s * 0.01);
  },
};

const VOLTAIRE: Figure = {
  id: 'voltaire',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    scholarHead(g, s, p);
    wig(g, s, p);
    // Wry smirk
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.moveTo(-s * 0.02, -s * 0.22);
    g.quadraticCurveTo(s * 0.02, -s * 0.18, s * 0.06, -s * 0.22);
    g.stroke();
    // Inkwell on a writing desk (left) + quill in right hand.
    g.fillStyle = '#5a3a1a';
    g.fillRect(-s * 0.5, s * 0.3, s * 0.28, s * 0.12);
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.46, s * 0.32, s * 0.08, s * 0.08);
    // Stack of pamphlets
    g.fillStyle = '#f0e8c8';
    for (let i = 0; i < 5; i++) {
      g.fillRect(-s * 0.34 + i * s * 0.008, s * 0.34 + i * s * 0.01, s * 0.1, s * 0.012);
    }
    // Quill
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.02;
    g.beginPath();
    g.moveTo(s * 0.24, s * 0.1);
    g.lineTo(s * 0.4, -s * 0.32);
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(s * 0.4, -s * 0.32);
    g.quadraticCurveTo(s * 0.56, -s * 0.3, s * 0.42, -s * 0.5);
    g.quadraticCurveTo(s * 0.34, -s * 0.42, s * 0.4, -s * 0.32);
    g.closePath();
    g.fill();
    // Feather ribs
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.004;
    for (let i = 0; i < 5; i++) {
      const t = (i + 1) / 6;
      g.beginPath();
      g.moveTo(s * 0.4 - t * s * 0.04, -s * 0.32 - t * s * 0.1);
      g.lineTo(s * 0.44 - t * s * 0.04, -s * 0.36 - t * s * 0.1);
      g.stroke();
    }
    // "Écrasez l'Infâme" scroll under left arm — just a rolled paper shape.
    g.fillStyle = '#f0e8c8';
    g.fillRect(-s * 0.34, s * 0.1, s * 0.06, s * 0.26);
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.004;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(-s * 0.32, s * 0.14 + i * s * 0.04);
      g.lineTo(-s * 0.3, s * 0.14 + i * s * 0.04);
      g.stroke();
    }
  },
};

const ROUSSEAU: Figure = {
  id: 'rousseau',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    scholarHead(g, s, p);
    // Armenian hat + natural unwigged look.
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(0, -s * 0.48, s * 0.22, s * 0.06, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(-s * 0.16, -s * 0.5);
    g.quadraticCurveTo(0, -s * 0.66, s * 0.16, -s * 0.5);
    g.closePath();
    g.fill();
    g.fillStyle = p.accent2;
    g.beginPath();
    g.arc(0, -s * 0.6, s * 0.018, 0, Math.PI * 2);
    g.fill();
    // Curls peeking out at the sides
    g.fillStyle = '#5a3a1a';
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.arc(dir * s * 0.2, -s * 0.32, s * 0.04, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(dir * s * 0.22, -s * 0.22, s * 0.04, 0, Math.PI * 2);
      g.fill();
    }
    // Oak leaf and acorn ("return to nature") in left hand.
    g.fillStyle = '#3a7030';
    g.beginPath();
    g.moveTo(-s * 0.3, s * 0.24);
    g.quadraticCurveTo(-s * 0.4, s * 0.14, -s * 0.46, s * 0.26);
    g.quadraticCurveTo(-s * 0.44, s * 0.32, -s * 0.4, s * 0.34);
    g.quadraticCurveTo(-s * 0.48, s * 0.36, -s * 0.42, s * 0.42);
    g.quadraticCurveTo(-s * 0.32, s * 0.36, -s * 0.3, s * 0.24);
    g.closePath();
    g.fill();
    // Acorn
    g.fillStyle = '#7a4a1a';
    g.beginPath();
    g.ellipse(-s * 0.24, s * 0.46, s * 0.03, s * 0.04, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c98a3e';
    g.fillRect(-s * 0.27, s * 0.42, s * 0.06, s * 0.02);
    // Open manuscript "Du Contrat Social" in right hand.
    g.fillStyle = '#f0e8c8';
    g.beginPath();
    g.moveTo(s * 0.2, s * 0.16);
    g.lineTo(s * 0.48, s * 0.16);
    g.lineTo(s * 0.44, s * 0.42);
    g.lineTo(s * 0.16, s * 0.42);
    g.closePath();
    g.fill();
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.004;
    for (let r = 0; r < 4; r++) {
      const y = s * 0.22 + r * s * 0.044;
      g.beginPath();
      g.moveTo(s * 0.22, y);
      g.lineTo(s * 0.42, y);
      g.stroke();
    }
  },
};

const KANT: Figure = {
  id: 'kant',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    scholarHead(g, s, p);
    wig(g, s, p);
    // Pocket watch on a chain.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.006;
    g.beginPath();
    g.moveTo(-s * 0.1, s * 0.1);
    g.bezierCurveTo(-s * 0.12, s * 0.2, -s * 0.08, s * 0.22, -s * 0.04, s * 0.28);
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(-s * 0.04, s * 0.34, s * 0.08, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f4e8d0';
    g.beginPath();
    g.arc(-s * 0.04, s * 0.34, s * 0.062, 0, Math.PI * 2);
    g.fill();
    // Watch face
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.004;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(-s * 0.04 + Math.cos(a) * s * 0.048, s * 0.34 + Math.sin(a) * s * 0.048);
      g.lineTo(-s * 0.04 + Math.cos(a) * s * 0.056, s * 0.34 + Math.sin(a) * s * 0.056);
      g.stroke();
    }
    // Hands pointing to 3:30
    g.beginPath();
    g.moveTo(-s * 0.04, s * 0.34);
    g.lineTo(-s * 0.04 + s * 0.04, s * 0.34);
    g.stroke();
    g.beginPath();
    g.moveTo(-s * 0.04, s * 0.34);
    g.lineTo(-s * 0.04, s * 0.34 + s * 0.044);
    g.stroke();
    // Starry sky above / moral law below — dual motif.
    g.fillStyle = p.accent2;
    for (const [x, y] of [[-0.46, -0.24], [-0.36, -0.36], [-0.22, -0.3], [0.36, -0.32], [0.5, -0.22]]) {
      g.beginPath();
      g.arc(x * s, y * s, s * 0.012, 0, Math.PI * 2);
      g.fill();
    }
    // Tablet with a severe equals sign in right hand — the categorical imperative abstracted.
    g.fillStyle = '#f0e8c8';
    g.fillRect(s * 0.2, s * 0.22, s * 0.2, s * 0.28);
    g.fillStyle = p.ink;
    g.fillRect(s * 0.24, s * 0.3, s * 0.12, s * 0.02);
    g.fillRect(s * 0.24, s * 0.4, s * 0.12, s * 0.02);
  },
};

const LAVOISIER: Figure = {
  id: 'lavoisier',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    scholarHead(g, s, p);
    wig(g, s, p);
    // Chemistry balance — central fulcrum with two pans.
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.008, s * 0.12, s * 0.016, s * 0.32);
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.01;
    g.beginPath();
    g.moveTo(-s * 0.28, s * 0.12);
    g.lineTo(s * 0.28, s * 0.12);
    g.stroke();
    g.beginPath();
    g.moveTo(-s * 0.28, s * 0.12);
    g.lineTo(-s * 0.28, s * 0.22);
    g.moveTo(s * 0.28, s * 0.12);
    g.lineTo(s * 0.28, s * 0.22);
    g.stroke();
    // Left pan — a flask
    g.fillStyle = p.accent2;
    g.beginPath();
    g.moveTo(-s * 0.36, s * 0.22);
    g.lineTo(-s * 0.2, s * 0.22);
    g.lineTo(-s * 0.24, s * 0.28);
    g.lineTo(-s * 0.16, s * 0.42);
    g.lineTo(-s * 0.4, s * 0.42);
    g.lineTo(-s * 0.32, s * 0.28);
    g.closePath();
    g.fill();
    // Right pan — weights
    g.fillStyle = p.accent;
    g.fillRect(s * 0.2, s * 0.28, s * 0.16, s * 0.14);
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.004;
    g.beginPath();
    g.moveTo(s * 0.24, s * 0.28);
    g.lineTo(s * 0.24, s * 0.22);
    g.lineTo(s * 0.32, s * 0.22);
    g.lineTo(s * 0.32, s * 0.28);
    g.stroke();
    // Oxygen bubble above the flask — his discovery.
    g.fillStyle = 'rgba(200,240,255,0.8)';
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(-s * 0.28 + i * s * 0.02, s * 0.2 - i * s * 0.04, s * 0.01, 0, Math.PI * 2);
      g.fill();
    }
  },
};

const FRANKLIN: Figure = {
  id: 'franklin',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    scholarHead(g, s, p);
    // Bald on top, fringe of hair on sides + round bifocals.
    g.fillStyle = '#5a3a1a';
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.arc(dir * s * 0.16, -s * 0.24, s * 0.05, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(dir * s * 0.2, -s * 0.14, s * 0.04, 0, Math.PI * 2);
      g.fill();
    }
    // Bifocals
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.006;
    g.beginPath();
    g.arc(-s * 0.06, -s * 0.3, s * 0.04, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(s * 0.06, -s * 0.3, s * 0.04, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.moveTo(-s * 0.02, -s * 0.3);
    g.lineTo(s * 0.02, -s * 0.3);
    g.stroke();
    // Kite in the sky above.
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(s * 0.32, -s * 0.52);
    g.lineTo(s * 0.2, -s * 0.38);
    g.lineTo(s * 0.32, -s * 0.2);
    g.lineTo(s * 0.44, -s * 0.38);
    g.closePath();
    g.fill();
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.004;
    g.beginPath();
    g.moveTo(s * 0.32, -s * 0.52);
    g.lineTo(s * 0.32, -s * 0.2);
    g.moveTo(s * 0.2, -s * 0.38);
    g.lineTo(s * 0.44, -s * 0.38);
    g.stroke();
    // Kite tail with bows.
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.moveTo(s * 0.32, -s * 0.2);
    g.bezierCurveTo(s * 0.4, -s * 0.12, s * 0.24, -s * 0.04, s * 0.32, s * 0.04);
    g.stroke();
    // Kite string down to his hand.
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.006;
    g.beginPath();
    g.moveTo(s * 0.32, -s * 0.38);
    g.lineTo(s * 0.16, s * 0.06);
    g.stroke();
    // Key hanging from the string.
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(s * 0.2, -s * 0.08, s * 0.018, 0, Math.PI * 2);
    g.fill();
    g.fillRect(s * 0.2, -s * 0.08, s * 0.04, s * 0.012);
    g.fillRect(s * 0.222, -s * 0.06, s * 0.006, s * 0.018);
    // Tiny spark from key.
    g.fillStyle = '#fff5a0';
    g.beginPath();
    g.moveTo(s * 0.25, -s * 0.06);
    g.lineTo(s * 0.27, -s * 0.1);
    g.lineTo(s * 0.26, -s * 0.04);
    g.lineTo(s * 0.3, -s * 0.06);
    g.closePath();
    g.fill();
    // Dark storm cloud
    g.fillStyle = '#333040';
    g.beginPath();
    g.ellipse(s * 0.32, -s * 0.6, s * 0.2, s * 0.06, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.22, -s * 0.56, s * 0.1, s * 0.04, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.42, -s * 0.56, s * 0.1, s * 0.04, 0, 0, Math.PI * 2);
    g.fill();
  },
};

const EULER: Figure = {
  id: 'euler',
  draw(g, s, p) {
    drawTogaBody(g, s, p);
    scholarHead(g, s, p);
    // Simple skullcap, not a wig.
    g.fillStyle = '#3a2a18';
    g.beginPath();
    g.ellipse(0, -s * 0.44, s * 0.16, s * 0.06, 0, Math.PI, 0);
    g.fill();
    // Chalkboard behind him.
    g.fillStyle = '#223028';
    g.fillRect(-s * 0.46, -s * 0.6, s * 0.96, s * 0.56);
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.01;
    g.strokeRect(-s * 0.46, -s * 0.6, s * 0.96, s * 0.56);
    // Euler's identity written in chalk.
    g.fillStyle = '#f4ecd8';
    g.font = `italic bold ${s * 0.14}px serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('e^iπ + 1 = 0', 0, -s * 0.32);
    // Graph beneath — a sine wave.
    g.strokeStyle = '#6ea4c8';
    g.lineWidth = s * 0.008;
    g.beginPath();
    for (let x = -44; x <= 44; x++) {
      const xx = (x / 44) * s * 0.4;
      const yy = -s * 0.12 + Math.sin(x / 8) * s * 0.06;
      if (x === -44) g.moveTo(xx, yy);
      else g.lineTo(xx, yy);
    }
    g.stroke();
    // Eye patch (Euler lost sight late in life — small nod).
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(-s * 0.06, -s * 0.3, s * 0.03, s * 0.02, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.004;
    g.beginPath();
    g.moveTo(-s * 0.1, -s * 0.34);
    g.lineTo(-s * 0.02, -s * 0.28);
    g.stroke();
  },
};

const ENCYCLOPEDIE: Figure = {
  id: 'encyclopedie',
  draw(g, s, p) {
    // Towering stack of leather-bound encyclopedia volumes.
    const volumes = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    const colors = ['#6a2a1a', '#3a5a30', '#2a4a70', '#7a2a5a', '#5a3a20', '#2a6a5a', '#6a4a2a'];
    for (let i = 0; i < volumes.length; i++) {
      const y = s * 0.6 - i * s * 0.14;
      const w = s * (0.6 - i * 0.02);
      g.fillStyle = colors[i];
      g.fillRect(-w / 2, y, w, s * 0.12);
      // Gold band at top/bottom
      g.fillStyle = p.accent;
      g.fillRect(-w / 2, y, w, s * 0.008);
      g.fillRect(-w / 2, y + s * 0.112, w, s * 0.008);
      // Roman numeral
      g.fillStyle = p.accent;
      g.font = `bold ${s * 0.06}px serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(volumes[i], 0, y + s * 0.06);
      // Band lines on the spine.
      g.strokeStyle = p.accent;
      g.lineWidth = s * 0.003;
      g.beginPath();
      g.moveTo(-w / 2 + s * 0.02, y + s * 0.02);
      g.lineTo(w / 2 - s * 0.02, y + s * 0.02);
      g.moveTo(-w / 2 + s * 0.02, y + s * 0.1);
      g.lineTo(w / 2 - s * 0.02, y + s * 0.1);
      g.stroke();
    }
    // Quill resting on top.
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.moveTo(-s * 0.3, -s * 0.5);
    g.lineTo(s * 0.28, -s * 0.74);
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(s * 0.28, -s * 0.74);
    g.quadraticCurveTo(s * 0.44, -s * 0.72, s * 0.3, -s * 0.9);
    g.quadraticCurveTo(s * 0.2, -s * 0.82, s * 0.28, -s * 0.74);
    g.closePath();
    g.fill();
    // Ink droplet on lower-left corner.
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.32, -s * 0.5);
    g.quadraticCurveTo(-s * 0.36, -s * 0.4, -s * 0.3, -s * 0.36);
    g.quadraticCurveTo(-s * 0.24, -s * 0.44, -s * 0.32, -s * 0.5);
    g.closePath();
    g.fill();
  },
};

export const ENLIGHTENMENT_PANTHEON: Pantheon = {
  palette: ENLIGHT_PALETTE,
  figures: [NEWTON, VOLTAIRE, ROUSSEAU, KANT, LAVOISIER, FRANKLIN, EULER, ENCYCLOPEDIE],
};
