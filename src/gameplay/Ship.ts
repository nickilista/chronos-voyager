import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Vector3,
} from 'three';
import type { InputState } from '../core/Input.ts';

const FORWARD_SPEED = 40; // world units / sec (Egypt baseline)
const BOOST_MULTIPLIER = 1.6;
const LATERAL_ACCEL = 60; // accel per sec²
const LATERAL_DAMP = 6; // 1/sec velocity decay
const MAX_LATERAL_VEL = 18;
const BOUNDS_X = 14;
const BOUNDS_Y = 8;

export class Ship {
  readonly group = new Group();
  readonly velocity = new Vector3();

  constructor() {
    // Hull — elongated cone pointing forward (−Z)
    const hullGeom = new ConeGeometry(0.55, 2.4, 10);
    hullGeom.rotateX(-Math.PI / 2);
    const hull = new Mesh(
      hullGeom,
      new MeshStandardMaterial({
        color: 0xdadce0,
        roughness: 0.35,
        metalness: 0.75,
        emissive: 0x1a1a22,
      }),
    );
    this.group.add(hull);

    // Wings — wide thin box
    const wings = new Mesh(
      new BoxGeometry(2.2, 0.08, 0.9),
      new MeshStandardMaterial({
        color: 0x7a7d8a,
        roughness: 0.55,
        metalness: 0.6,
      }),
    );
    wings.position.z = 0.3;
    this.group.add(wings);

    // Vertical fin
    const fin = new Mesh(
      new BoxGeometry(0.08, 0.6, 0.8),
      new MeshStandardMaterial({ color: 0x8a8d99, roughness: 0.5, metalness: 0.6 }),
    );
    fin.position.set(0, 0.35, 0.5);
    this.group.add(fin);

    // Thruster — short cylinder with strong emissive
    const thrusterGeom = new CylinderGeometry(0.3, 0.42, 0.4, 14);
    thrusterGeom.rotateX(Math.PI / 2);
    const thruster = new Mesh(
      thrusterGeom,
      new MeshStandardMaterial({
        color: 0x2a1410,
        emissive: 0xff6622,
        emissiveIntensity: 3,
        roughness: 0.4,
      }),
    );
    thruster.position.z = 1.15;
    this.group.add(thruster);

    // Thruster glow light
    const glow = new PointLight(0xff6622, 3, 8, 1.5);
    glow.position.set(0, 0, 1.4);
    this.group.add(glow);

    this.group.position.set(0, 0, 0);
  }

  update(dt: number, input: InputState): void {
    const speed = input.boost ? FORWARD_SPEED * BOOST_MULTIPLIER : FORWARD_SPEED;

    // Lateral motion w/ accel + damping (feels smoother than direct pos set)
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

    // Clamp to tunnel bounds, zero velocity on hit
    if (Math.abs(this.group.position.x) > BOUNDS_X) {
      this.group.position.x = Math.sign(this.group.position.x) * BOUNDS_X;
      this.velocity.x = 0;
    }
    if (Math.abs(this.group.position.y) > BOUNDS_Y) {
      this.group.position.y = Math.sign(this.group.position.y) * BOUNDS_Y;
      this.velocity.y = 0;
    }

    // Bank roll on lateral movement — banking gives juicy feel
    const targetRoll = -this.velocity.x * 0.04;
    this.group.rotation.z += (targetRoll - this.group.rotation.z) * Math.min(1, dt * 8);
    // Pitch based on vertical movement
    const targetPitch = -this.velocity.y * 0.03;
    this.group.rotation.x += (targetPitch - this.group.rotation.x) * Math.min(1, dt * 8);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
