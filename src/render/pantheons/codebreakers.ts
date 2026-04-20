import type { Figure, Palette, Pantheon } from './types.ts';
import { circle, ring } from './common.ts';

/**
 * Codebreakers pantheon — WWII cryptanalysis at Bletchley Park and beyond.
 * Hut-ink palette with amber CRT-phosphor accent and a cool signal-green
 * secondary. Icons of the era: the people, the machines, and the marks
 * they left on information theory.
 */

const CODE_PALETTE: Palette = {
  ink: '#0d1210',
  accent: '#f0b84a',
  accent2: '#6adf9a',
  glowInner: 'rgba(180, 255, 200, 0.9)',
  glowMid: 'rgba(70, 160, 120, 0.5)',
  glowEdge: 'rgba(6, 14, 10, 0)',
  halo: 'rgba(130, 230, 170, 0.6)',
};

function skin(g: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  g.fillStyle = '#e7c5a2';
  g.beginPath();
  g.ellipse(cx, cy, s * 0.15, s * 0.18, 0, 0, Math.PI * 2);
  g.fill();
}

function militaryJacket(g: CanvasRenderingContext2D, s: number, p: Palette): void {
  g.fillStyle = p.ink;
  // Shoulders
  g.beginPath();
  g.moveTo(-s * 0.26, -s * 0.04);
  g.quadraticCurveTo(0, s * 0.04, s * 0.26, -s * 0.04);
  g.lineTo(s * 0.3, s * 0.12);
  g.lineTo(-s * 0.3, s * 0.12);
  g.closePath();
  g.fill();
  // Jacket body
  g.beginPath();
  g.moveTo(-s * 0.3, s * 0.12);
  g.lineTo(s * 0.3, s * 0.12);
  g.lineTo(s * 0.34, s * 0.96);
  g.lineTo(-s * 0.34, s * 0.96);
  g.closePath();
  g.fill();
  // Tie
  g.fillStyle = p.accent;
  g.beginPath();
  g.moveTo(-s * 0.035, -s * 0.02);
  g.lineTo(s * 0.035, -s * 0.02);
  g.lineTo(s * 0.05, s * 0.26);
  g.lineTo(0, s * 0.34);
  g.lineTo(-s * 0.05, s * 0.26);
  g.closePath();
  g.fill();
  // Jacket lapels
  g.fillStyle = '#1a221e';
  g.beginPath();
  g.moveTo(-s * 0.22, s * 0.04);
  g.lineTo(-s * 0.035, -s * 0.02);
  g.lineTo(-s * 0.05, s * 0.26);
  g.lineTo(-s * 0.28, s * 0.28);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(s * 0.22, s * 0.04);
  g.lineTo(s * 0.035, -s * 0.02);
  g.lineTo(s * 0.05, s * 0.26);
  g.lineTo(s * 0.28, s * 0.28);
  g.closePath();
  g.fill();
}

const TURING: Figure = {
  id: 'turing',
  draw(g, s, p) {
    militaryJacket(g, s, p);
    skin(g, 0, -s * 0.3, s);
    // Dark short hair, side parted
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.16, -s * 0.44);
    g.quadraticCurveTo(-s * 0.04, -s * 0.52, s * 0.16, -s * 0.4);
    g.lineTo(s * 0.14, -s * 0.3);
    g.lineTo(-s * 0.14, -s * 0.3);
    g.closePath();
    g.fill();
    // Eyes
    circle(g, -s * 0.05, -s * 0.3, s * 0.012, p.ink);
    circle(g, s * 0.05, -s * 0.3, s * 0.012, p.ink);
    // Apple — in right hand, bitten
    g.fillStyle = '#b23a48';
    g.beginPath();
    g.arc(s * 0.38, s * 0.44, s * 0.09, 0, Math.PI * 2);
    g.fill();
    // Bite
    g.fillStyle = p.glowEdge.replace('0)', '0.0)');
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(s * 0.45, s * 0.4, s * 0.04, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    // Stem + leaf
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.01;
    g.beginPath();
    g.moveTo(s * 0.38, s * 0.36);
    g.lineTo(s * 0.38, s * 0.3);
    g.stroke();
    g.fillStyle = p.accent2;
    g.beginPath();
    g.moveTo(s * 0.38, s * 0.32);
    g.quadraticCurveTo(s * 0.44, s * 0.28, s * 0.4, s * 0.3);
    g.closePath();
    g.fill();
    // Turing-machine tape on left (with 0s and 1s)
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.48, s * 0.4, s * 0.28, s * 0.1);
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.008;
    for (let i = 1; i < 7; i++) {
      g.beginPath();
      g.moveTo(-s * 0.48 + i * s * 0.04, s * 0.4);
      g.lineTo(-s * 0.48 + i * s * 0.04, s * 0.5);
      g.stroke();
    }
    g.fillStyle = p.ink;
    g.font = `bold ${Math.round(s * 0.06)}px monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const bits = ['1', '0', '1', '1', '0', '1', '0'];
    for (let i = 0; i < 7; i++) {
      g.fillText(bits[i], -s * 0.46 + i * s * 0.04, s * 0.45);
    }
    // Read-head indicator
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.014;
    g.beginPath();
    g.moveTo(-s * 0.34, s * 0.52);
    g.lineTo(-s * 0.34, s * 0.58);
    g.lineTo(-s * 0.3, s * 0.6);
    g.lineTo(-s * 0.38, s * 0.6);
    g.closePath();
    g.stroke();
  },
};

const ENIGMA: Figure = {
  id: 'enigma',
  draw(g, s, p) {
    // Wooden case
    g.fillStyle = '#3a2812';
    g.fillRect(-s * 0.48, -s * 0.28, s * 0.96, s * 0.82);
    // Inner metal plate
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.44, -s * 0.24, s * 0.88, s * 0.48);
    // Three rotor windows with letters
    const rotors = ['A', 'Q', 'F'];
    for (let i = 0; i < 3; i++) {
      const x = -s * 0.18 + i * s * 0.18;
      // Rotor well
      g.fillStyle = '#1d2a22';
      g.fillRect(x - s * 0.07, -s * 0.2, s * 0.14, s * 0.16);
      // Rotor disc
      g.fillStyle = p.accent;
      g.beginPath();
      g.arc(x, -s * 0.12, s * 0.05, 0, Math.PI * 2);
      g.fill();
      // Letter
      g.fillStyle = p.ink;
      g.font = `bold ${Math.round(s * 0.08)}px monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(rotors[i], x, -s * 0.115);
      // Knurled edge
      for (let t = 0; t < 16; t++) {
        const a = (t / 16) * Math.PI * 2;
        g.fillStyle = p.ink;
        g.fillRect(x + Math.cos(a) * s * 0.05 - s * 0.004, -s * 0.12 + Math.sin(a) * s * 0.05 - s * 0.004, s * 0.008, s * 0.008);
      }
    }
    // Lampboard (upper row of letters)
    const letters = 'QWERTZUIOPASDFGHJKLYXCVBNM';
    g.fillStyle = '#1a231c';
    g.fillRect(-s * 0.44, s * 0.0, s * 0.88, s * 0.18);
    // 13 lamps, a few lit
    const lit = [3, 7, 11];
    for (let i = 0; i < 13; i++) {
      const x = -s * 0.4 + i * s * 0.068;
      const isLit = lit.includes(i);
      g.fillStyle = isLit ? p.accent : '#30403a';
      circle(g, x, s * 0.06, s * 0.022, g.fillStyle);
      g.fillStyle = isLit ? p.ink : '#8a9b90';
      g.font = `bold ${Math.round(s * 0.028)}px monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(letters[i], x, s * 0.06);
    }
    // Keyboard row
    g.fillStyle = p.ink;
    for (let i = 0; i < 13; i++) {
      const x = -s * 0.4 + i * s * 0.068;
      circle(g, x, s * 0.26, s * 0.024, p.ink);
      ring(g, x, s * 0.26, s * 0.024, p.accent, s * 0.004);
      g.fillStyle = p.accent;
      g.font = `bold ${Math.round(s * 0.028)}px monospace`;
      g.fillText(letters[i + 13] ?? 'Z', x, s * 0.265);
      g.fillStyle = p.ink;
    }
    // Plugboard wires below
    g.strokeStyle = '#a02020';
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.moveTo(-s * 0.3, s * 0.42);
    g.quadraticCurveTo(-s * 0.1, s * 0.52, s * 0.1, s * 0.42);
    g.stroke();
    g.strokeStyle = p.accent2;
    g.beginPath();
    g.moveTo(-s * 0.12, s * 0.42);
    g.quadraticCurveTo(s * 0.1, s * 0.5, s * 0.28, s * 0.42);
    g.stroke();
    g.strokeStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.36, s * 0.42);
    g.quadraticCurveTo(s * 0.0, s * 0.54, s * 0.34, s * 0.42);
    g.stroke();
    // Plug jacks
    g.fillStyle = p.accent;
    for (let i = 0; i < 10; i++) {
      circle(g, -s * 0.36 + i * s * 0.08, s * 0.42, s * 0.01, p.accent);
    }
  },
};

const BOMBE: Figure = {
  id: 'bombe',
  draw(g, s, p) {
    // Tall cabinet
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.46, -s * 0.5, s * 0.92, s);
    // Metallic frame
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.012;
    g.strokeRect(-s * 0.46, -s * 0.5, s * 0.92, s);
    // Bank of rotating drums — 3 rows x 8 columns
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) {
        const cx = -s * 0.4 + c * s * 0.1;
        const cy = -s * 0.4 + r * s * 0.22;
        // Drum
        g.fillStyle = p.accent;
        circle(g, cx, cy, s * 0.04, p.accent);
        // Concentric grooves
        g.strokeStyle = p.ink;
        g.lineWidth = s * 0.004;
        ring(g, cx, cy, s * 0.03, p.ink, s * 0.004);
        ring(g, cx, cy, s * 0.02, p.ink, s * 0.004);
        // Index pip
        const pipA = ((r + c) * 0.4) % (Math.PI * 2);
        g.fillStyle = p.ink;
        circle(g, cx + Math.cos(pipA) * s * 0.028, cy + Math.sin(pipA) * s * 0.028, s * 0.006, p.ink);
      }
    }
    // Cable loom at bottom
    g.strokeStyle = '#884422';
    g.lineWidth = s * 0.02;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(-s * 0.4 + i * s * 0.14, s * 0.28);
      g.quadraticCurveTo(-s * 0.4 + i * s * 0.14 + s * 0.05, s * 0.42, -s * 0.3 + i * s * 0.14, s * 0.5);
      g.stroke();
    }
    // Label plate
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.2, s * 0.34, s * 0.4, s * 0.12);
    g.fillStyle = p.ink;
    g.font = `bold ${Math.round(s * 0.08)}px monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('BOMBE', 0, s * 0.4);
  },
};

const COLOSSUS: Figure = {
  id: 'colossus',
  draw(g, s, p) {
    // Large rack
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.48, -s * 0.44, s * 0.96, s * 0.92);
    // Vacuum-tube rows glowing amber
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 10; c++) {
        const cx = -s * 0.42 + c * s * 0.094;
        const cy = -s * 0.36 + r * s * 0.12;
        // Tube glass
        g.fillStyle = 'rgba(255, 200, 100, 0.35)';
        g.fillRect(cx - s * 0.018, cy - s * 0.04, s * 0.036, s * 0.08);
        // Glow centre
        g.fillStyle = p.accent;
        circle(g, cx, cy, s * 0.012, p.accent);
        // Cap
        g.fillStyle = '#888';
        g.fillRect(cx - s * 0.02, cy - s * 0.05, s * 0.04, s * 0.012);
        g.fillRect(cx - s * 0.02, cy + s * 0.04, s * 0.04, s * 0.012);
      }
    }
    // Paper-tape loop
    g.strokeStyle = p.accent2;
    g.lineWidth = s * 0.024;
    g.beginPath();
    g.moveTo(-s * 0.44, s * 0.2);
    g.quadraticCurveTo(-s * 0.2, s * 0.44, s * 0.0, s * 0.2);
    g.quadraticCurveTo(s * 0.2, s * 0.0, s * 0.44, s * 0.24);
    g.stroke();
    // Perforations
    g.fillStyle = p.ink;
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const x = -s * 0.44 + t * s * 0.88;
      const y = s * 0.2 + Math.sin(t * Math.PI * 2) * s * 0.1;
      if (i % 2 === 0) circle(g, x, y, s * 0.006, p.ink);
    }
    // Output teleprinter
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.44, s * 0.32, s * 0.36, s * 0.14);
    g.fillStyle = p.ink;
    g.font = `bold ${Math.round(s * 0.05)}px monospace`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('XZQ..LK.', -s * 0.42, s * 0.39);
  },
};

const OPERATOR: Figure = {
  id: 'operator',
  draw(g, s, p) {
    // Wren uniform dress (Women's Royal Naval Service — the Bombe operators)
    g.fillStyle = '#1a2a3a';
    // Bodice
    g.beginPath();
    g.moveTo(-s * 0.24, -s * 0.04);
    g.quadraticCurveTo(0, s * 0.02, s * 0.24, -s * 0.04);
    g.lineTo(s * 0.24, s * 0.3);
    g.lineTo(-s * 0.24, s * 0.3);
    g.closePath();
    g.fill();
    // Skirt
    g.beginPath();
    g.moveTo(-s * 0.24, s * 0.3);
    g.lineTo(s * 0.24, s * 0.3);
    g.lineTo(s * 0.34, s * 0.96);
    g.lineTo(-s * 0.34, s * 0.96);
    g.closePath();
    g.fill();
    // Navy collar
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.02);
    g.lineTo(0, s * 0.18);
    g.lineTo(s * 0.18, -s * 0.02);
    g.lineTo(s * 0.1, -s * 0.04);
    g.lineTo(0, s * 0.08);
    g.lineTo(-s * 0.1, -s * 0.04);
    g.closePath();
    g.fill();
    // Skin
    skin(g, 0, -s * 0.3, s);
    // Hair — rolled 1940s victory rolls
    g.fillStyle = '#4a2a14';
    g.beginPath();
    g.ellipse(-s * 0.12, -s * 0.46, s * 0.08, s * 0.08, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.12, -s * 0.46, s * 0.08, s * 0.08, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(0, -s * 0.38, s * 0.16, s * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(-s * 0.18, -s * 0.24, s * 0.06, s * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.18, -s * 0.24, s * 0.06, s * 0.12, 0, 0, Math.PI * 2);
    g.fill();
    // Wren tricorn-style cap
    g.fillStyle = '#1a2a3a';
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.5);
    g.lineTo(s * 0.18, -s * 0.5);
    g.lineTo(s * 0.12, -s * 0.56);
    g.lineTo(-s * 0.12, -s * 0.56);
    g.closePath();
    g.fill();
    g.fillStyle = p.accent;
    circle(g, 0, -s * 0.52, s * 0.02, p.accent);
    // Eyes
    circle(g, -s * 0.05, -s * 0.3, s * 0.01, p.ink);
    circle(g, s * 0.05, -s * 0.3, s * 0.01, p.ink);
    // Lipstick
    g.strokeStyle = '#c83040';
    g.lineWidth = s * 0.01;
    g.beginPath();
    g.moveTo(-s * 0.02, -s * 0.22);
    g.lineTo(s * 0.02, -s * 0.22);
    g.stroke();
    // Headphones on ears
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.012;
    g.beginPath();
    g.arc(0, -s * 0.44, s * 0.2, Math.PI * 0.9, Math.PI * 2.1);
    g.stroke();
    g.fillStyle = p.ink;
    circle(g, -s * 0.2, -s * 0.28, s * 0.04, p.ink);
    circle(g, s * 0.2, -s * 0.28, s * 0.04, p.ink);
    // Cable
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.moveTo(s * 0.22, -s * 0.24);
    g.quadraticCurveTo(s * 0.3, s * 0.0, s * 0.24, s * 0.3);
    g.stroke();
    // Clipboard with intercepts
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.46, s * 0.42, s * 0.22, s * 0.3);
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.44, s * 0.44, s * 0.18, s * 0.04);
    g.fillStyle = p.accent2;
    g.font = `bold ${Math.round(s * 0.03)}px monospace`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    const lines = ['KQWXZ ABFRT', 'NHGPC LMSOV', 'EEYIU JDAWB'];
    for (let i = 0; i < 3; i++) {
      g.fillText(lines[i], -s * 0.44, s * 0.52 + i * s * 0.06);
    }
  },
};

const SHANNON: Figure = {
  id: 'shannon',
  draw(g, s, p) {
    militaryJacket(g, s, p);
    skin(g, 0, -s * 0.3, s);
    // Thin hair, swept back
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.15, -s * 0.42);
    g.quadraticCurveTo(0, -s * 0.48, s * 0.15, -s * 0.42);
    g.lineTo(s * 0.12, -s * 0.32);
    g.lineTo(-s * 0.12, -s * 0.32);
    g.closePath();
    g.fill();
    // Glasses — characteristic horn-rims
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.008;
    ring(g, -s * 0.06, -s * 0.3, s * 0.035, p.ink, s * 0.008);
    ring(g, s * 0.06, -s * 0.3, s * 0.035, p.ink, s * 0.008);
    g.beginPath();
    g.moveTo(-s * 0.025, -s * 0.3);
    g.lineTo(s * 0.025, -s * 0.3);
    g.stroke();
    // Eyes behind
    circle(g, -s * 0.06, -s * 0.3, s * 0.008, p.ink);
    circle(g, s * 0.06, -s * 0.3, s * 0.008, p.ink);
    // Small mustache
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.04, -s * 0.23, s * 0.08, s * 0.014);
    // Information-theory formula on a slate
    g.fillStyle = '#1a1a1a';
    g.fillRect(-s * 0.46, s * 0.34, s * 0.36, s * 0.28);
    ring(g, -s * 0.28, s * 0.48, s * 0.2, p.accent, s * 0.008);
    g.fillStyle = p.accent2;
    g.font = `bold ${Math.round(s * 0.06)}px serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('H = −Σ p log p', -s * 0.28, s * 0.48);
    // Juggling balls — Shannon's famous hobby
    circle(g, s * 0.3, s * 0.0, s * 0.028, p.accent);
    circle(g, s * 0.42, s * 0.22, s * 0.028, p.accent2);
    circle(g, s * 0.34, s * 0.44, s * 0.028, '#b23a48');
    // Arc trails
    g.strokeStyle = 'rgba(240, 184, 74, 0.35)';
    g.lineWidth = s * 0.008;
    g.beginPath();
    g.arc(s * 0.36, s * 0.22, s * 0.18, -Math.PI * 0.6, Math.PI * 0.6);
    g.stroke();
  },
};

const MORSE_KEY: Figure = {
  id: 'morse',
  draw(g, s, p) {
    // Wood base
    g.fillStyle = '#3a2810';
    g.fillRect(-s * 0.4, s * 0.28, s * 0.8, s * 0.2);
    // Brass plate
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.32, s * 0.22, s * 0.64, s * 0.1);
    // Key lever
    g.fillStyle = p.accent;
    g.beginPath();
    g.moveTo(-s * 0.28, s * 0.18);
    g.lineTo(s * 0.24, s * 0.04);
    g.lineTo(s * 0.24, s * 0.12);
    g.lineTo(-s * 0.28, s * 0.26);
    g.closePath();
    g.fill();
    // Knob
    g.fillStyle = '#1a0d04';
    circle(g, s * 0.24, s * 0.08, s * 0.06, '#1a0d04');
    ring(g, s * 0.24, s * 0.08, s * 0.06, p.accent, s * 0.006);
    circle(g, s * 0.24, s * 0.08, s * 0.03, '#2a1812');
    // Pivot
    g.fillStyle = p.ink;
    circle(g, -s * 0.26, s * 0.22, s * 0.02, p.ink);
    // Contact pin below key
    g.fillStyle = p.accent;
    g.fillRect(s * 0.18, s * 0.18, s * 0.04, s * 0.04);
    // Spark at the contact
    g.fillStyle = p.accent2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(s * 0.2, s * 0.2);
      g.lineTo(s * 0.2 + Math.cos(a) * s * 0.06, s * 0.2 + Math.sin(a) * s * 0.06);
      g.strokeStyle = p.accent2;
      g.lineWidth = s * 0.008;
      g.stroke();
    }
    // Morse above — dots and dashes spelling "SOS" and more
    g.fillStyle = p.accent2;
    const morse: Array<['dot' | 'dash', number]> = [
      ['dot', 0], ['dot', 1], ['dot', 2], ['dash', 4], ['dash', 6], ['dash', 8],
      ['dot', 11], ['dot', 12], ['dot', 13],
    ];
    const y = -s * 0.2;
    for (const [kind, i] of morse) {
      const x = -s * 0.4 + i * s * 0.06;
      if (kind === 'dot') circle(g, x, y, s * 0.018, p.accent2);
      else g.fillRect(x - s * 0.02, y - s * 0.012, s * 0.056, s * 0.024);
    }
    // Wave lines emanating upward
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.01;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(s * 0.24, s * 0.08, s * 0.12 + i * s * 0.08, -Math.PI * 0.7, -Math.PI * 0.3);
      g.stroke();
    }
  },
};

const BINARY: Figure = {
  id: 'binary',
  draw(g, s, p) {
    // Cascading binary rain — pure info-age icon
    g.font = `bold ${Math.round(s * 0.1)}px monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const cols = 7;
    const rows = 9;
    // Deterministic pseudo-random from position so it's stable across redraws
    const pseudo = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) & 0xffff;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = -s * 0.42 + c * s * 0.14;
        const y = -s * 0.42 + r * s * 0.1;
        const bit = (pseudo(c, r) >> 4) & 1;
        const depth = (pseudo(c, r) >> 8) & 0xf;
        // Top rows brighter green (fresh), fading down
        const bright = depth / 15;
        if (r === 0) {
          g.fillStyle = `rgba(255, 255, 255, ${0.9 * bright + 0.1})`;
        } else {
          g.fillStyle = `rgba(106, 223, 154, ${0.3 + bright * 0.7})`;
        }
        g.fillText(String(bit), x, y);
      }
    }
    // Highlighted decoded word at centre
    g.fillStyle = p.ink;
    g.fillRect(-s * 0.26, s * 0.18, s * 0.52, s * 0.14);
    ring(g, 0, s * 0.25, s * 0.3, p.accent, s * 0.01);
    g.strokeRect(-s * 0.26, s * 0.18, s * 0.52, s * 0.14);
    g.fillStyle = p.accent;
    g.font = `bold ${Math.round(s * 0.08)}px monospace`;
    g.fillText('DECODED', 0, s * 0.25);
  },
};

export const CODEBREAKERS_PANTHEON: Pantheon = {
  palette: CODE_PALETTE,
  figures: [
    TURING,
    ENIGMA,
    BOMBE,
    COLOSSUS,
    OPERATOR,
    SHANNON,
    MORSE_KEY,
    BINARY,
  ] as const,
};
