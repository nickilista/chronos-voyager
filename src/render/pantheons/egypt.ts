import type { Figure, Palette, Pantheon } from './types.ts';

/**
 * Egyptian pantheon — the original eight, rendered in classic temple-wall
 * silhouette with pharaonic bodies and animal-headed gods. Palette: warm
 * desert ink on molten-gold backdrop.
 */

const EGYPT_PALETTE: Palette = {
  ink: '#1c0d04',
  accent: '#f2c85b',
  accent2: '#fff3c0',
  glowInner: 'rgba(255, 228, 148, 0.95)',
  glowMid: 'rgba(212, 148, 42, 0.55)',
  glowEdge: 'rgba(40, 20, 4, 0)',
  halo: 'rgba(255, 214, 120, 0.7)',
};

function body(g: CanvasRenderingContext2D, s: number, p: Palette): void {
  g.fillStyle = p.ink;
  // Torso
  g.beginPath();
  g.moveTo(-s * 0.22, 0);
  g.lineTo(s * 0.22, 0);
  g.lineTo(s * 0.18, s * 0.38);
  g.lineTo(-s * 0.18, s * 0.38);
  g.closePath();
  g.fill();
  // Kilt
  g.beginPath();
  g.moveTo(-s * 0.24, s * 0.38);
  g.lineTo(s * 0.24, s * 0.38);
  g.lineTo(s * 0.3, s * 0.72);
  g.lineTo(-s * 0.3, s * 0.72);
  g.closePath();
  g.fill();
  g.fillStyle = p.accent;
  g.fillRect(-s * 0.27, s * 0.52, s * 0.54, s * 0.05);
  g.fillRect(-s * 0.29, s * 0.66, s * 0.58, s * 0.05);
  // Wesekh collar
  g.fillStyle = p.accent;
  g.beginPath();
  g.ellipse(0, -s * 0.02, s * 0.26, s * 0.1, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = p.ink;
  g.fillRect(-s * 0.06, -s * 0.02, s * 0.12, s * 0.1);
  // Legs + feet
  g.fillStyle = p.ink;
  g.fillRect(-s * 0.14, s * 0.72, s * 0.1, s * 0.26);
  g.fillRect(s * 0.04, s * 0.72, s * 0.1, s * 0.26);
  g.beginPath();
  g.ellipse(-s * 0.1, s * 0.99, s * 0.1, s * 0.04, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(s * 0.1, s * 0.99, s * 0.1, s * 0.04, 0, 0, Math.PI * 2);
  g.fill();
}

function ankhStaff(g: CanvasRenderingContext2D, s: number, p: Palette): void {
  g.strokeStyle = p.accent;
  g.lineWidth = s * 0.03;
  g.beginPath();
  g.moveTo(-s * 0.34, s * 0.04);
  g.lineTo(-s * 0.34, s * 0.5);
  g.stroke();
  g.beginPath();
  g.moveTo(-s * 0.44, s * 0.18);
  g.lineTo(-s * 0.24, s * 0.18);
  g.stroke();
  g.beginPath();
  g.arc(-s * 0.34, s * 0.04, s * 0.09, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = p.ink;
  g.lineWidth = s * 0.06;
  g.beginPath();
  g.moveTo(-s * 0.2, s * 0.08);
  g.lineTo(-s * 0.34, s * 0.2);
  g.stroke();
}

function wasStaff(g: CanvasRenderingContext2D, s: number, p: Palette): void {
  g.strokeStyle = p.accent;
  g.lineWidth = s * 0.04;
  g.beginPath();
  g.moveTo(s * 0.34, -s * 0.12);
  g.lineTo(s * 0.34, s * 0.82);
  g.stroke();
  g.beginPath();
  g.moveTo(s * 0.28, s * 0.82);
  g.lineTo(s * 0.4, s * 0.82);
  g.stroke();
  g.beginPath();
  g.moveTo(s * 0.34, s * 0.78);
  g.lineTo(s * 0.4, s * 0.88);
  g.stroke();
  g.fillStyle = p.accent;
  g.beginPath();
  g.moveTo(s * 0.3, -s * 0.12);
  g.lineTo(s * 0.4, -s * 0.12);
  g.lineTo(s * 0.44, -s * 0.2);
  g.lineTo(s * 0.3, -s * 0.2);
  g.closePath();
  g.fill();
  g.strokeStyle = p.ink;
  g.lineWidth = s * 0.06;
  g.beginPath();
  g.moveTo(s * 0.2, s * 0.08);
  g.lineTo(s * 0.34, s * 0.2);
  g.stroke();
}

const ANUBIS: Figure = {
  id: 'anubis',
  draw(g, s, p) {
    body(g, s, p);
    g.fillStyle = p.ink;
    // Tall pointed jackal ears
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.48);
    g.lineTo(-s * 0.08, -s * 0.78);
    g.lineTo(-s * 0.02, -s * 0.46);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.02, -s * 0.46);
    g.lineTo(s * 0.08, -s * 0.78);
    g.lineTo(s * 0.18, -s * 0.48);
    g.closePath();
    g.fill();
    g.beginPath();
    g.ellipse(-s * 0.02, -s * 0.3, s * 0.17, s * 0.19, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.1, -s * 0.34);
    g.quadraticCurveTo(s * 0.4, -s * 0.3, s * 0.42, -s * 0.2);
    g.lineTo(s * 0.24, -s * 0.18);
    g.quadraticCurveTo(s * 0.1, -s * 0.22, s * 0.06, -s * 0.26);
    g.closePath();
    g.fill();
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(s * 0.04, -s * 0.32, s * 0.025, 0, Math.PI * 2);
    g.fill();
    ankhStaff(g, s, p);
    wasStaff(g, s, p);
  },
};

const HORUS: Figure = {
  id: 'horus',
  draw(g, s, p) {
    body(g, s, p);
    g.fillStyle = p.ink;
    // Pschent double crown
    g.beginPath();
    g.moveTo(-s * 0.14, -s * 0.78);
    g.lineTo(s * 0.14, -s * 0.78);
    g.lineTo(s * 0.1, -s * 0.48);
    g.lineTo(-s * 0.1, -s * 0.48);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.14, -s * 0.78);
    g.quadraticCurveTo(s * 0.26, -s * 0.6, s * 0.18, -s * 0.5);
    g.lineTo(s * 0.12, -s * 0.52);
    g.closePath();
    g.fill();
    // Falcon head
    g.beginPath();
    g.arc(0, -s * 0.32, s * 0.2, 0, Math.PI * 2);
    g.fill();
    // Beak
    g.beginPath();
    g.moveTo(s * 0.18, -s * 0.3);
    g.quadraticCurveTo(s * 0.4, -s * 0.28, s * 0.32, -s * 0.12);
    g.lineTo(s * 0.16, -s * 0.18);
    g.closePath();
    g.fill();
    // Udjat eye
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(s * 0.04, -s * 0.34, s * 0.035, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.022;
    g.beginPath();
    g.moveTo(-s * 0.05, -s * 0.28);
    g.quadraticCurveTo(-s * 0.15, -s * 0.18, -s * 0.22, -s * 0.22);
    g.stroke();
    ankhStaff(g, s, p);
    wasStaff(g, s, p);
  },
};

const RA: Figure = {
  id: 'ra',
  draw(g, s, p) {
    body(g, s, p);
    // Falcon head first
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(0, -s * 0.32, s * 0.2, 0, Math.PI * 2);
    g.fill();
    // Sun disc behind head
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(0, -s * 0.46, s * 0.22, 0, Math.PI * 2);
    g.fill();
    // Redraw head on top of disc overlap
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(0, -s * 0.32, s * 0.2, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.18, -s * 0.3);
    g.quadraticCurveTo(s * 0.4, -s * 0.28, s * 0.32, -s * 0.12);
    g.lineTo(s * 0.16, -s * 0.18);
    g.closePath();
    g.fill();
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(s * 0.04, -s * 0.34, s * 0.035, 0, Math.PI * 2);
    g.fill();
    // Uraeus
    g.fillStyle = p.ink;
    g.beginPath();
    g.moveTo(-s * 0.04, -s * 0.64);
    g.quadraticCurveTo(0, -s * 0.78, s * 0.06, -s * 0.64);
    g.lineTo(0, -s * 0.58);
    g.closePath();
    g.fill();
    // Rays
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.02;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * s * 0.24, -s * 0.46 + Math.sin(a) * s * 0.24);
      g.lineTo(Math.cos(a) * s * 0.36, -s * 0.46 + Math.sin(a) * s * 0.36);
      g.stroke();
    }
    wasStaff(g, s, p);
  },
};

const THOTH: Figure = {
  id: 'thoth',
  draw(g, s, p) {
    body(g, s, p);
    // Moon disc with crescent
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(0, -s * 0.62, s * 0.14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(s * 0.06, -s * 0.64, s * 0.11, 0, Math.PI * 2);
    g.fill();
    // Ibis head
    g.beginPath();
    g.arc(-s * 0.04, -s * 0.3, s * 0.16, 0, Math.PI * 2);
    g.fill();
    // Long curved beak
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.05;
    g.beginPath();
    g.moveTo(s * 0.08, -s * 0.28);
    g.quadraticCurveTo(s * 0.38, -s * 0.18, s * 0.32, s * 0.02);
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(-s * 0.02, -s * 0.33, s * 0.025, 0, Math.PI * 2);
    g.fill();
    // Reed + palette
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.028;
    g.beginPath();
    g.moveTo(-s * 0.32, s * 0.04);
    g.lineTo(-s * 0.32, s * 0.58);
    g.stroke();
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(-s * 0.32, s * 0.62, s * 0.08, s * 0.04, 0, 0, Math.PI * 2);
    g.fill();
    wasStaff(g, s, p);
  },
};

const BASTET: Figure = {
  id: 'bastet',
  draw(g, s, p) {
    body(g, s, p);
    g.fillStyle = p.ink;
    // Ears
    g.beginPath();
    g.moveTo(-s * 0.2, -s * 0.38);
    g.lineTo(-s * 0.12, -s * 0.68);
    g.lineTo(-s * 0.04, -s * 0.42);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.2, -s * 0.38);
    g.lineTo(s * 0.12, -s * 0.68);
    g.lineTo(s * 0.04, -s * 0.42);
    g.closePath();
    g.fill();
    // Round face
    g.beginPath();
    g.arc(0, -s * 0.28, s * 0.22, 0, Math.PI * 2);
    g.fill();
    // Eyes
    g.fillStyle = p.accent;
    g.beginPath();
    g.ellipse(-s * 0.08, -s * 0.3, s * 0.05, s * 0.022, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(s * 0.08, -s * 0.3, s * 0.05, s * 0.022, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = p.ink;
    g.beginPath();
    g.arc(-s * 0.08, -s * 0.3, s * 0.018, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.08, -s * 0.3, s * 0.018, 0, Math.PI * 2);
    g.fill();
    // Whiskers
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.012;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.moveTo(sx * s * 0.12, -s * 0.24);
      g.lineTo(sx * s * 0.24, -s * 0.2);
      g.stroke();
    }
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(0, -s * 0.42, s * 0.03, 0, Math.PI * 2);
    g.fill();
    ankhStaff(g, s, p);
    // Sistrum in right hand
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.03;
    g.beginPath();
    g.moveTo(s * 0.34, -s * 0.12);
    g.lineTo(s * 0.34, s * 0.58);
    g.stroke();
    g.beginPath();
    g.arc(s * 0.34, -s * 0.2, s * 0.07, Math.PI, Math.PI * 2);
    g.stroke();
  },
};

const SOBEK: Figure = {
  id: 'sobek',
  draw(g, s, p) {
    body(g, s, p);
    // Horned sun disc
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(0, -s * 0.58, s * 0.1, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.025;
    g.beginPath();
    g.moveTo(-s * 0.14, -s * 0.56);
    g.quadraticCurveTo(-s * 0.06, -s * 0.72, 0, -s * 0.64);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.14, -s * 0.56);
    g.quadraticCurveTo(s * 0.06, -s * 0.72, 0, -s * 0.64);
    g.stroke();
    // Head + snout
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(-s * 0.06, -s * 0.32, s * 0.16, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.08, -s * 0.34);
    g.lineTo(s * 0.46, -s * 0.3);
    g.lineTo(s * 0.46, -s * 0.22);
    g.lineTo(s * 0.08, -s * 0.24);
    g.closePath();
    g.fill();
    // Teeth
    g.fillStyle = '#f5ecc8';
    g.beginPath();
    g.moveTo(s * 0.1, -s * 0.24);
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const x = s * 0.1 + t * s * 0.34;
      const y = -s * 0.24 + (i % 2 === 0 ? 0 : s * 0.018);
      g.lineTo(x, y);
    }
    g.lineTo(s * 0.46, -s * 0.22);
    g.lineTo(s * 0.1, -s * 0.22);
    g.closePath();
    g.fill();
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(-s * 0.1, -s * 0.36, s * 0.028, 0, Math.PI * 2);
    g.fill();
    ankhStaff(g, s, p);
    wasStaff(g, s, p);
  },
};

const KHEPRI: Figure = {
  id: 'khepri',
  draw(g, s, p) {
    body(g, s, p);
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(0, -s * 0.3, s * 0.26, s * 0.32, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.02;
    g.beginPath();
    g.moveTo(0, -s * 0.58);
    g.lineTo(0, -s * 0.02);
    g.stroke();
    g.beginPath();
    g.moveTo(-s * 0.14, -s * 0.22);
    g.lineTo(s * 0.14, -s * 0.22);
    g.stroke();
    g.strokeStyle = p.ink;
    g.lineWidth = s * 0.035;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.moveTo(sx * s * 0.18, -s * 0.46);
      g.lineTo(sx * s * 0.36, -s * 0.56);
      g.stroke();
      g.beginPath();
      g.moveTo(sx * s * 0.24, -s * 0.3);
      g.lineTo(sx * s * 0.42, -s * 0.3);
      g.stroke();
      g.beginPath();
      g.moveTo(sx * s * 0.18, -s * 0.14);
      g.lineTo(sx * s * 0.36, -s * 0.04);
      g.stroke();
    }
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(0, -s * 0.64, s * 0.09, 0, Math.PI * 2);
    g.fill();
    wasStaff(g, s, p);
  },
};

const ISIS: Figure = {
  id: 'isis',
  draw(g, s, p) {
    body(g, s, p);
    g.fillStyle = p.ink;
    g.beginPath();
    g.ellipse(0, -s * 0.3, s * 0.15, s * 0.19, 0, 0, Math.PI * 2);
    g.fill();
    // Tripartite wig
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.32);
    g.lineTo(-s * 0.22, -s * 0.04);
    g.lineTo(-s * 0.12, -s * 0.08);
    g.lineTo(-s * 0.1, -s * 0.32);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(s * 0.18, -s * 0.32);
    g.lineTo(s * 0.22, -s * 0.04);
    g.lineTo(s * 0.12, -s * 0.08);
    g.lineTo(s * 0.1, -s * 0.32);
    g.closePath();
    g.fill();
    // Throne hieroglyph crown
    g.beginPath();
    g.moveTo(-s * 0.18, -s * 0.5);
    g.lineTo(-s * 0.18, -s * 0.74);
    g.lineTo(s * 0.18, -s * 0.74);
    g.lineTo(s * 0.18, -s * 0.5);
    g.lineTo(s * 0.06, -s * 0.5);
    g.lineTo(s * 0.06, -s * 0.6);
    g.lineTo(-s * 0.06, -s * 0.6);
    g.lineTo(-s * 0.06, -s * 0.5);
    g.closePath();
    g.fill();
    g.fillStyle = p.accent;
    g.fillRect(-s * 0.16, -s * 0.68, s * 0.32, s * 0.04);
    g.beginPath();
    g.arc(s * 0.04, -s * 0.32, s * 0.022, 0, Math.PI * 2);
    g.fill();
    ankhStaff(g, s, p);
    // Wings
    g.strokeStyle = p.accent;
    g.lineWidth = s * 0.024;
    g.beginPath();
    g.moveTo(-s * 0.24, s * 0.1);
    g.quadraticCurveTo(-s * 0.5, s * 0.3, -s * 0.42, s * 0.5);
    g.stroke();
    g.beginPath();
    g.moveTo(s * 0.24, s * 0.1);
    g.quadraticCurveTo(s * 0.5, s * 0.3, s * 0.42, s * 0.5);
    g.stroke();
  },
};

export const EGYPT_PANTHEON: Pantheon = {
  palette: EGYPT_PALETTE,
  figures: [ANUBIS, HORUS, RA, THOTH, BASTET, SOBEK, KHEPRI, ISIS],
};
