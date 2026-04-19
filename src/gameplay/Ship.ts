import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import type { InputState } from '../core/Input.ts';

const FORWARD_SPEED = 40;
const BOOST_MULTIPLIER = 1.6;
const LATERAL_ACCEL = 60;
const LATERAL_DAMP = 6;
const MAX_LATERAL_VEL = 18;
const BOUNDS_X = 14;
const BOUNDS_Y = 8;

/**
 * Premium spaceship: multi-segment hull, glass cockpit w/ interior dashboard,
 * swept delta wings w/ winglet lights, twin engine nacelles, emissive seam
 * lines. Exposes `pilotSlot: Group` so era-specific avatars can be attached.
 */
export class Ship {
  readonly group = new Group();
  readonly velocity = new Vector3();
  /** Anchor where an era-specific pilot avatar is attached. Replace children to swap. */
  readonly pilotSlot = new Group();

  private readonly eraEmissives: MeshStandardMaterial[] = [];
  private readonly eraBasics: MeshBasicMaterial[] = [];
  private readonly placeholderPilot: Object3D;
  private readonly thrusterMat: MeshStandardMaterial;
  private readonly thrusterLights: PointLight[] = [];

  constructor(eraAccentHex = 0xffd27f) {
    const hullColor = 0xd8dce5;
    const hullDark = 0x4a5060;

    // === Main fuselage: stretched capsule + nose cone for sleek silhouette ===
    const bodyMat = new MeshStandardMaterial({
      color: hullColor,
      roughness: 0.3,
      metalness: 0.85,
    });
    const body = new Mesh(new CapsuleGeometry(0.55, 1.8, 10, 18), bodyMat);
    body.rotation.x = Math.PI / 2;
    this.group.add(body);

    const nose = new Mesh(new ConeGeometry(0.55, 1.0, 18), bodyMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -1.85;
    this.group.add(nose);

    // Lower hull belly — wider, darker, gives a sense of mass
    const bellyMat = new MeshStandardMaterial({
      color: hullDark,
      roughness: 0.5,
      metalness: 0.7,
    });
    const belly = new Mesh(new CapsuleGeometry(0.45, 1.6, 6, 12), bellyMat);
    belly.rotation.x = Math.PI / 2;
    belly.position.set(0, -0.35, 0.1);
    belly.scale.set(1.4, 0.55, 1);
    this.group.add(belly);

    // === Glass cockpit canopy (half-sphere clipped) ===
    const canopyGlass = new MeshPhysicalMaterial({
      color: 0x88aadd,
      roughness: 0.02,
      metalness: 0,
      transmission: 0.85,
      thickness: 0.25,
      ior: 1.45,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      side: DoubleSide,
    });
    const canopy = new Mesh(
      new SphereGeometry(0.5, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      canopyGlass,
    );
    canopy.position.set(0, 0.35, -0.55);
    canopy.scale.set(1.2, 0.8, 1.6);
    this.group.add(canopy);

    // Cockpit interior base (where pilot sits)
    const cockpitFloor = new Mesh(
      new BoxGeometry(0.9, 0.08, 1.4),
      new MeshStandardMaterial({ color: 0x1a1d26, roughness: 0.8, metalness: 0.2 }),
    );
    cockpitFloor.position.set(0, 0.12, -0.5);
    this.group.add(cockpitFloor);

    // Dashboard panel in front of pilot — era-tinted emissive
    const dashboardMat = new MeshStandardMaterial({
      color: 0x050709,
      emissive: new Color(eraAccentHex),
      emissiveIntensity: 0.9,
      roughness: 0.5,
      metalness: 0.4,
    });
    this.eraEmissives.push(dashboardMat);
    const dashboard = new Mesh(new BoxGeometry(0.7, 0.15, 0.25), dashboardMat);
    dashboard.position.set(0, 0.22, -1.0);
    dashboard.rotation.x = -0.35;
    this.group.add(dashboard);

    // Small screen readouts — 3 bright emissive rectangles
    for (let i = 0; i < 3; i++) {
      const screenMat = new MeshBasicMaterial({ color: new Color(eraAccentHex) });
      this.eraBasics.push(screenMat);
      const screen = new Mesh(new BoxGeometry(0.14, 0.06, 0.01), screenMat);
      screen.position.set((i - 1) * 0.2, 0.28, -0.93);
      screen.rotation.x = -0.35;
      this.group.add(screen);
    }

    // Pilot seat — simple back panel
    const seat = new Mesh(
      new BoxGeometry(0.35, 0.6, 0.08),
      new MeshStandardMaterial({ color: 0x221a28, roughness: 0.9, metalness: 0.1 }),
    );
    seat.position.set(0, 0.35, -0.2);
    seat.rotation.x = 0.2;
    this.group.add(seat);

    // === Pilot slot — empty Group where era-specific avatar can be attached ===
    this.pilotSlot.position.set(0, 0.35, -0.45);
    this.group.add(this.pilotSlot);

    // Placeholder pilot — cloaked figure, era-tinted
    this.placeholderPilot = buildPlaceholderPilot(eraAccentHex);
    this.pilotSlot.add(this.placeholderPilot);

    // Interior cockpit light so pilot is readable through the glass
    const cockpitLight = new PointLight(eraAccentHex, 1.4, 2.5, 2);
    cockpitLight.position.set(0, 0.5, -0.5);
    this.group.add(cockpitLight);

    // === Delta swept wings ===
    const wingMat = new MeshStandardMaterial({
      color: 0x6a7080,
      roughness: 0.45,
      metalness: 0.75,
    });
    const wingShape = new Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(1.8, -0.4);
    wingShape.lineTo(1.55, -0.7);
    wingShape.lineTo(0, -0.5);
    wingShape.lineTo(0, 0);
    const wingGeom = new ExtrudeGeometry(wingShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelSize: 0.02,
      bevelThickness: 0.02,
      bevelSegments: 2,
      steps: 1,
    });
    wingGeom.translate(0, 0, -0.03);

    const wingR = new Mesh(wingGeom, wingMat);
    wingR.position.set(0.35, -0.08, 0.2);
    this.group.add(wingR);

    const wingL = new Mesh(wingGeom, wingMat);
    wingL.position.set(-0.35, -0.08, 0.2);
    wingL.scale.x = -1;
    this.group.add(wingL);

    // Winglet lights (blinking accents at wing tips)
    for (const side of [-1, 1]) {
      const tipMat = new MeshBasicMaterial({ color: new Color(eraAccentHex) });
      this.eraBasics.push(tipMat);
      const tip = new Mesh(new SphereGeometry(0.07, 10, 8), tipMat);
      tip.position.set(side * 2.15, -0.08, -0.2);
      this.group.add(tip);

      const tipLight = new PointLight(eraAccentHex, 0.8, 3, 2);
      tipLight.position.copy(tip.position);
      this.group.add(tipLight);
    }

    // Dorsal fin
    const fin = new Mesh(
      new BoxGeometry(0.08, 0.55, 0.7),
      new MeshStandardMaterial({ color: hullColor, roughness: 0.4, metalness: 0.8 }),
    );
    fin.position.set(0, 0.4, 0.65);
    this.group.add(fin);

    // === Twin engine nacelles ===
    const nacelleMat = new MeshStandardMaterial({
      color: 0x2d3240,
      roughness: 0.35,
      metalness: 0.9,
    });
    const thrusterRingMat = new MeshStandardMaterial({
      color: 0x0c0e13,
      roughness: 0.6,
      metalness: 0.2,
    });
    this.thrusterMat = new MeshStandardMaterial({
      color: 0x2a0f06,
      emissive: 0xff6622,
      emissiveIntensity: 3,
      roughness: 0.45,
    });

    for (const side of [-1, 1]) {
      const nacelle = new Mesh(
        new CylinderGeometry(0.25, 0.28, 1.0, 14),
        nacelleMat,
      );
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(side * 0.75, -0.15, 0.55);
      this.group.add(nacelle);

      const ring = new Mesh(new TorusGeometry(0.3, 0.04, 8, 18), thrusterRingMat);
      ring.position.set(side * 0.75, -0.15, 1.05);
      this.group.add(ring);

      const thruster = new Mesh(
        new CylinderGeometry(0.22, 0.3, 0.25, 14),
        this.thrusterMat,
      );
      thruster.rotation.x = Math.PI / 2;
      thruster.position.set(side * 0.75, -0.15, 1.15);
      this.group.add(thruster);

      const glow = new PointLight(0xff6622, 2, 5, 1.5);
      glow.position.set(side * 0.75, -0.15, 1.35);
      this.group.add(glow);
      this.thrusterLights.push(glow);
    }

    // === Emissive seam / greeble lines along fuselage (era-tinted) ===
    const seamMat = new MeshBasicMaterial({ color: new Color(eraAccentHex) });
    this.eraBasics.push(seamMat);
    for (let i = 0; i < 2; i++) {
      const seam = new Mesh(new BoxGeometry(0.02, 0.02, 2.4), seamMat);
      seam.position.set((i === 0 ? 1 : -1) * 0.45, 0.0, -0.1);
      this.group.add(seam);
    }
    // Top spine seam
    const spine = new Mesh(new BoxGeometry(0.025, 0.025, 2.2), seamMat);
    spine.position.set(0, 0.58, 0.0);
    this.group.add(spine);
  }

  setEraAccent(accentHex: number): void {
    const c = new Color(accentHex);
    for (const m of this.eraEmissives) m.emissive.copy(c);
    for (const m of this.eraBasics) m.color.copy(c);
    // Update placeholder pilot tint
    this.placeholderPilot.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        const mat = mesh.material as MeshStandardMaterial;
        if (mat.userData.isPilotTinted) mat.emissive.copy(c);
      }
    });
  }

  /** Replace placeholder with an era-specific avatar mesh. */
  setPilotAvatar(avatar: Object3D): void {
    while (this.pilotSlot.children.length > 0) {
      this.pilotSlot.remove(this.pilotSlot.children[0]);
    }
    this.pilotSlot.add(avatar);
  }

  update(dt: number, input: InputState): void {
    const speed = input.boost ? FORWARD_SPEED * BOOST_MULTIPLIER : FORWARD_SPEED;

    // Thruster intensity pulses with boost
    const targetEmissive = input.boost ? 5 : 3;
    this.thrusterMat.emissiveIntensity +=
      (targetEmissive - this.thrusterMat.emissiveIntensity) * Math.min(1, dt * 8);
    for (const l of this.thrusterLights) {
      const targetInt = input.boost ? 3.5 : 2;
      l.intensity += (targetInt - l.intensity) * Math.min(1, dt * 8);
    }

    this.velocity.x += input.x * LATERAL_ACCEL * dt;
    this.velocity.y += input.y * LATERAL_ACCEL * dt;
    const damp = Math.exp(-LATERAL_DAMP * dt);
    this.velocity.x *= input.x === 0 ? damp : 1;
    this.velocity.y *= input.y === 0 ? damp : 1;
    this.velocity.x = clamp(this.velocity.x, -MAX_LATERAL_VEL, MAX_LATERAL_VEL);
    this.velocity.y = clamp(this.velocity.y, -MAX_LATERAL_VEL, MAX_LATERAL_VEL);

    this.group.position.x += this.velocity.x * dt;
    this.group.position.y += this.velocity.y * dt;
    this.group.position.z -= speed * dt;

    if (Math.abs(this.group.position.x) > BOUNDS_X) {
      this.group.position.x = Math.sign(this.group.position.x) * BOUNDS_X;
      this.velocity.x = 0;
    }
    if (Math.abs(this.group.position.y) > BOUNDS_Y) {
      this.group.position.y = Math.sign(this.group.position.y) * BOUNDS_Y;
      this.velocity.y = 0;
    }

    const targetRoll = -this.velocity.x * 0.04;
    this.group.rotation.z += (targetRoll - this.group.rotation.z) * Math.min(1, dt * 8);
    const targetPitch = -this.velocity.y * 0.03;
    this.group.rotation.x += (targetPitch - this.group.rotation.x) * Math.min(1, dt * 8);
  }
}

function buildPlaceholderPilot(tintHex: number): Object3D {
  const g = new Group();
  const skinMat = new MeshStandardMaterial({
    color: 0x2a2430,
    roughness: 0.85,
    metalness: 0.05,
    emissive: new Color(tintHex),
    emissiveIntensity: 0.25,
  });
  skinMat.userData.isPilotTinted = true;

  const suitMat = new MeshStandardMaterial({
    color: 0x151821,
    roughness: 0.7,
    metalness: 0.3,
  });

  const torso = new Mesh(new CapsuleGeometry(0.14, 0.28, 6, 10), suitMat);
  torso.position.set(0, 0.2, 0);
  g.add(torso);

  const head = new Mesh(new SphereGeometry(0.11, 14, 12), skinMat);
  head.position.set(0, 0.5, -0.02);
  g.add(head);

  // Small hood/helmet cap tinted with era accent
  const capMat = new MeshStandardMaterial({
    color: 0x0a0d14,
    roughness: 0.6,
    metalness: 0.4,
    emissive: new Color(tintHex),
    emissiveIntensity: 0.6,
  });
  capMat.userData.isPilotTinted = true;
  const cap = new Mesh(new SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  cap.position.set(0, 0.55, -0.02);
  g.add(cap);

  return g;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
