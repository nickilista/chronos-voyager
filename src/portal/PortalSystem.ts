import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  Points,
  PointsMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three';

/**
 * Vibe Jam 2026 portal webring integration.
 *
 * Two pieces:
 *   • Inbound handling: `parsePortalQuery()` reads the jam's URLSearchParams
 *     vocabulary (portal, ref, username, color, speed, hp, speed_x/y/z,
 *     rotation_x/y/z, avatar_url, team). When `portal=true`, the boot path
 *     in main.ts skips the ship builder and hands the parsed state to Game
 *     so the incoming player drops straight into the corridor with their
 *     incoming color / velocity / hp.
 *
 *   • Outbound handling: `PortalSystem` places a green torus ("VIBE JAM
 *     PORTAL") somewhere in world space. When the ship flies through it
 *     (distance < 15u), we build a forwarding URL with the ship's current
 *     state (speed vector, color, hp, rotation) and redirect to
 *     `https://vibejam.cc/portal/2026?portal=true&…`. If the player arrived
 *     from another game, we also place a red return portal at the origin
 *     pointing back at `?ref=<their ref>`.
 *
 * Geometry matches the official gist sample (TorusGeometry(15, 2, 16, 100)
 * + CircleGeometry(13, 32) inner disc + 1000 Points particles + sprite
 * label). Colors: green = exit (to the jam), red = return (to the referring
 * site).
 *
 * Feature flag:
 *   `SHOW_EXIT_PORTAL = false` hides the visible green exit torus so the
 *   webring link stays private until launch day. Flip to `true` to go live.
 *   The inbound `?portal=true` path and the widget script stay active
 *   regardless — those are mandatory for jam compliance and don't reveal
 *   the outbound link to anyone.
 */
export const SHOW_EXIT_PORTAL = true;

/** Official jam destination for the exit portal. */
const JAM_EXIT_URL = 'https://vibejam.cc/portal/2026';

/** How close the ship has to get to a portal center to trigger its action. */
const PORTAL_COLLISION_DISTANCE = 15;

/** Ambient spin applied to both portals each frame (radians/s). */
const PORTAL_SPIN_RATE = 0.08;

export interface PortalQuery {
  /** True iff the URL contains `?portal=true`. */
  fromPortal: boolean;
  /** Referring site URL (used to build the return portal's href). */
  ref: string | null;
  /** Player handle supplied by the referring site (if any). */
  username: string | null;
  /** Hex color like "#5fc8ff" — used to recolor ship trail / nav accents. */
  color: string | null;
  /** Speed magnitude in arbitrary units (the referring site's convention). */
  speed: number | null;
  /** Incoming HP (capped to the loadout's maxHp before apply). */
  hp: number | null;
  /** Avatar URL — unused in-game but forwarded on exit. */
  avatarUrl: string | null;
  /** Team name — unused in-game but forwarded on exit. */
  team: string | null;
  /** Incoming velocity vector, component-wise (world space). */
  velocity: Vector3 | null;
  /** Incoming orientation as Euler angles (radians). */
  rotation: Vector3 | null;
}

/** Parse the current window URL into a PortalQuery. Always safe to call. */
export function parsePortalQuery(): PortalQuery {
  if (typeof window === 'undefined') return emptyQuery();
  const params = new URLSearchParams(window.location.search);
  const fromPortal = params.get('portal') === 'true';
  const v = readVec3(params, 'speed_x', 'speed_y', 'speed_z');
  const r = readVec3(params, 'rotation_x', 'rotation_y', 'rotation_z');
  return {
    fromPortal,
    ref: params.get('ref'),
    username: params.get('username'),
    color: params.get('color'),
    speed: readFloat(params, 'speed'),
    hp: readFloat(params, 'hp'),
    avatarUrl: params.get('avatar_url'),
    team: params.get('team'),
    velocity: v,
    rotation: r,
  };
}

function emptyQuery(): PortalQuery {
  return {
    fromPortal: false,
    ref: null,
    username: null,
    color: null,
    speed: null,
    hp: null,
    avatarUrl: null,
    team: null,
    velocity: null,
    rotation: null,
  };
}

function readFloat(p: URLSearchParams, key: string): number | null {
  const raw = p.get(key);
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function readVec3(
  p: URLSearchParams,
  kx: string,
  ky: string,
  kz: string,
): Vector3 | null {
  const x = readFloat(p, kx);
  const y = readFloat(p, ky);
  const z = readFloat(p, kz);
  if (x == null && y == null && z == null) return null;
  return new Vector3(x ?? 0, y ?? 0, z ?? 0);
}

/**
 * Snapshot of the ship's state sampled each frame, used to build the exit
 * URL on collision. `Game` supplies this via a getter so the PortalSystem
 * doesn't need a reference to the Ship.
 */
export interface ShipSnapshot {
  position: Vector3;
  velocity: Vector3;
  /** Euler rotation (XYZ) in radians. */
  rotation: Vector3;
  /** Current HP (will be forwarded, clamped to [0, 9999]). */
  hp: number;
  /** Hex color (without the `#`) for the ship's accent. */
  color: string;
  /** Player handle — defaults to "voyager" if unknown. */
  username: string;
}

/**
 * Manages the visible exit portal (green, gated behind SHOW_EXIT_PORTAL)
 * and the optional return portal (red, only when the player came from
 * another site via ?portal=true&ref=…).
 */
export class PortalSystem {
  private readonly inbound: PortalQuery;
  private readonly showExit: boolean;
  private exitPortal: Group | null = null;
  private returnPortal: Group | null = null;
  private exitParticles: Points | null = null;
  private returnParticles: Points | null = null;
  private triggered = false;

  /**
   * @param inbound  Parsed URL query (use `parsePortalQuery()` at boot).
   * @param showExit Feature flag: `true` to reveal the green exit portal,
   *                 `false` to keep the webring link private. The inbound
   *                 path and return portal are unaffected.
   */
  constructor(inbound: PortalQuery, showExit: boolean = SHOW_EXIT_PORTAL) {
    this.inbound = inbound;
    this.showExit = showExit;
  }

  /** Mount the portal(s) into the scene. Call once after Game.start(). */
  init(scene: Scene): void {
    if (this.showExit) {
      const exit = buildPortalGroup({
        color: 0x00ff00,
        label: 'VIBE JAM PORTAL',
        // Slightly off to the side of the starting corridor so the player
        // notices it while flying through Egypt but doesn't collide on spawn.
        position: new Vector3(48, 6, -120),
      });
      this.exitPortal = exit.group;
      this.exitParticles = exit.particles;
      scene.add(exit.group);
    }

    if (this.inbound.fromPortal && this.inbound.ref) {
      // Return portal placed near the spawn so the inbound player can
      // bounce back to their origin if they wish.
      const ret = buildPortalGroup({
        color: 0xff0000,
        label: 'RETURN',
        position: new Vector3(-30, 4, -20),
      });
      this.returnPortal = ret.group;
      this.returnParticles = ret.particles;
      scene.add(ret.group);
    }
  }

  /**
   * Per-frame tick. Rotates portals, twinkles their particle clouds, and
   * tests distance against the ship. On collision, builds the forwarding
   * URL from `getShipState()` and hard-redirects.
   */
  update(
    dt: number,
    shipPos: Vector3,
    getShipState: () => ShipSnapshot,
  ): void {
    if (this.triggered) return;

    if (this.exitPortal) {
      this.exitPortal.rotation.z += dt * PORTAL_SPIN_RATE;
      jiggleParticles(this.exitParticles);
      const d = shipPos.distanceTo(this.exitPortal.position);
      if (d < PORTAL_COLLISION_DISTANCE) {
        this.triggered = true;
        window.location.href = this.buildExitURL(getShipState());
        return;
      }
    }

    if (this.returnPortal) {
      this.returnPortal.rotation.z -= dt * PORTAL_SPIN_RATE;
      jiggleParticles(this.returnParticles);
      const d = shipPos.distanceTo(this.returnPortal.position);
      if (d < PORTAL_COLLISION_DISTANCE) {
        this.triggered = true;
        window.location.href = this.buildReturnURL(getShipState());
        return;
      }
    }
  }

  /**
   * Build the jam redirect URL per the 2026 spec: forward every standard
   * field the referring player might want to preserve across the hop.
   */
  buildExitURL(snap: ShipSnapshot): string {
    const u = new URL(JAM_EXIT_URL);
    u.searchParams.set('portal', 'true');
    u.searchParams.set('ref', currentHostname());
    u.searchParams.set('username', snap.username || 'voyager');
    u.searchParams.set('color', normalizeColorParam(snap.color));
    u.searchParams.set('speed', snap.velocity.length().toFixed(2));
    u.searchParams.set('speed_x', snap.velocity.x.toFixed(3));
    u.searchParams.set('speed_y', snap.velocity.y.toFixed(3));
    u.searchParams.set('speed_z', snap.velocity.z.toFixed(3));
    u.searchParams.set('rotation_x', snap.rotation.x.toFixed(3));
    u.searchParams.set('rotation_y', snap.rotation.y.toFixed(3));
    u.searchParams.set('rotation_z', snap.rotation.z.toFixed(3));
    u.searchParams.set('hp', Math.max(0, Math.min(9999, snap.hp)).toFixed(0));
    return u.toString();
  }

  /**
   * Build the return URL — points back at the referring site with the
   * `portal=true` handshake so the other game knows to skip its own
   * loading flow.
   */
  buildReturnURL(snap: ShipSnapshot): string {
    const ref = this.inbound.ref;
    if (!ref) return '/';
    let u: URL;
    try {
      u = new URL(ref);
    } catch {
      // Ref wasn't a full URL — treat it as a hostname.
      u = new URL(`https://${ref}`);
    }
    u.searchParams.set('portal', 'true');
    u.searchParams.set('ref', currentHostname());
    u.searchParams.set('username', snap.username || 'voyager');
    u.searchParams.set('color', normalizeColorParam(snap.color));
    u.searchParams.set('speed_x', snap.velocity.x.toFixed(3));
    u.searchParams.set('speed_y', snap.velocity.y.toFixed(3));
    u.searchParams.set('speed_z', snap.velocity.z.toFixed(3));
    u.searchParams.set('rotation_x', snap.rotation.x.toFixed(3));
    u.searchParams.set('rotation_y', snap.rotation.y.toFixed(3));
    u.searchParams.set('rotation_z', snap.rotation.z.toFixed(3));
    u.searchParams.set('hp', Math.max(0, Math.min(9999, snap.hp)).toFixed(0));
    return u.toString();
  }

  /** Inbound query accessor for game-side state application (color/vel/hp). */
  get query(): PortalQuery {
    return this.inbound;
  }
}

function currentHostname(): string {
  if (typeof window === 'undefined') return 'chronos-voyager';
  return window.location.hostname || 'chronos-voyager';
}

function normalizeColorParam(raw: string): string {
  // Always emit without the `#` so we don't waste a URL-encoding byte.
  const s = (raw || '').trim();
  if (s.startsWith('#')) return s.slice(1);
  return s || '5fc8ff';
}

/**
 * Build a single portal group matching the jam sample: torus + disc + a
 * 1000-point particle cloud around the rim + billboard label. Returned as
 * a group so we can rotate it as one unit.
 */
function buildPortalGroup(opts: {
  color: number;
  label: string;
  position: Vector3;
}): { group: Group; particles: Points } {
  const g = new Group();
  g.position.copy(opts.position);

  const torusGeo = new TorusGeometry(15, 2, 16, 100);
  const torusMat = new MeshPhongMaterial({
    color: opts.color,
    emissive: opts.color,
    transparent: true,
    opacity: 0.85,
  });
  const torus = new Mesh(torusGeo, torusMat);
  g.add(torus);

  const discGeo = new CircleGeometry(13, 32);
  const discMat = new MeshBasicMaterial({
    color: opts.color,
    transparent: true,
    opacity: 0.45,
    side: 2, // DoubleSide
  });
  const disc = new Mesh(discGeo, discMat);
  g.add(disc);

  // 1000-point twinkle cloud hugging the torus ring. Points are stored on a
  // BufferGeometry so we can mutate positions cheaply each frame.
  const count = 1000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 15 + (Math.random() - 0.5) * 3;
    positions[i * 3 + 0] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.sin(a) * r;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 3;
  }
  const pGeo = new BufferGeometry();
  pGeo.setAttribute('position', new BufferAttribute(positions, 3));
  const pMat = new PointsMaterial({
    color: opts.color,
    size: 0.3,
    transparent: true,
    opacity: 0.9,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const particles = new Points(pGeo, pMat);
  g.add(particles);

  // Billboard label above the ring — canvas sprite so we don't have to pull
  // a font loader in for this one-off piece of text.
  const sprite = makeLabelSprite(opts.label, opts.color);
  sprite.position.set(0, 20, 0);
  g.add(sprite);

  return { group: g, particles };
}

function makeLabelSprite(text: string, colorHex: number): Sprite {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const color = new Color(colorHex);
    ctx.fillStyle = `rgb(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)})`;
    ctx.fillText(text, c.width / 2, c.height / 2);
  }
  const tex = new CanvasTexture(c);
  const mat = new SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  const sp = new Sprite(mat);
  sp.scale.set(16, 4, 1);
  return sp;
}

/**
 * Nudge the particle cloud's z-positions every frame so the ring looks
 * alive. Matches the sample gist's "animate particles" loop in spirit.
 */
function jiggleParticles(points: Points | null): void {
  if (!points) return;
  const attr = points.geometry.getAttribute('position') as BufferAttribute;
  const arr = attr.array as Float32Array;
  for (let i = 0; i < arr.length; i += 3) {
    // Only wiggle z — x/y are the ring and shouldn't drift.
    arr[i + 2] += (Math.random() - 0.5) * 0.08;
    if (arr[i + 2] > 2) arr[i + 2] = 2;
    if (arr[i + 2] < -2) arr[i + 2] = -2;
  }
  attr.needsUpdate = true;
}
