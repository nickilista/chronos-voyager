/**
 * Lightweight GPU particle burst for crash impacts. Uses a single
 * BufferGeometry with pre-allocated position, velocity, life, and color
 * attributes — no per-particle Object3D. Additive blending gives hot
 * white-to-orange sparks that glow naturally through the bloom pass.
 *
 * Usage:
 *   const sparks = new ImpactSparks(scene);
 *   sparks.emit(worldPos, 40);   // call from onCrash
 *   sparks.update(dt);           // call every frame
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  type Scene,
  ShaderMaterial,
  Vector3,
} from 'three';

const MAX_PARTICLES = 200; // pool ceiling across overlapping bursts

const VERT = /* glsl */ `
  attribute float aLife;
  attribute float aMaxLife;
  attribute float aSize;
  varying float vT; // normalised age 0..1
  void main() {
    vT = 1.0 - clamp(aLife / aMaxLife, 0.0, 1.0);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    // Size shrinks as the particle ages.
    gl_PointSize = aSize * (1.0 - vT * 0.6) * (300.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const FRAG = /* glsl */ `
  varying float vT;
  void main() {
    // Soft circle falloff.
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float alpha = (1.0 - d * d) * (1.0 - vT * vT);
    // White → orange → dim red over lifetime.
    vec3 col = mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.45, 0.1), vT);
    col = mix(col, vec3(0.6, 0.1, 0.02), smoothstep(0.5, 1.0, vT));
    gl_FragColor = vec4(col * (1.4 - vT * 0.8), alpha);
  }
`;

export class ImpactSparks {
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly lifes: Float32Array;
  private readonly maxLifes: Float32Array;
  private readonly sizes: Float32Array;
  private readonly posAttr: BufferAttribute;
  private readonly lifeAttr: BufferAttribute;
  private readonly maxLifeAttr: BufferAttribute;
  private readonly sizeAttr: BufferAttribute;
  private readonly geo: BufferGeometry;
  readonly points: Points;
  private alive = 0;

  constructor(scene: Scene) {
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.velocities = new Float32Array(MAX_PARTICLES * 3);
    this.lifes = new Float32Array(MAX_PARTICLES);
    this.maxLifes = new Float32Array(MAX_PARTICLES);
    this.sizes = new Float32Array(MAX_PARTICLES);

    this.geo = new BufferGeometry();
    this.posAttr = new BufferAttribute(this.positions, 3);
    this.lifeAttr = new BufferAttribute(this.lifes, 1);
    this.maxLifeAttr = new BufferAttribute(this.maxLifes, 1);
    this.sizeAttr = new BufferAttribute(this.sizes, 1);

    this.geo.setAttribute('position', this.posAttr);
    this.geo.setAttribute('aLife', this.lifeAttr);
    this.geo.setAttribute('aMaxLife', this.maxLifeAttr);
    this.geo.setAttribute('aSize', this.sizeAttr);

    const mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    this.points = new Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /**
   * Spawn `count` sparks at `origin` (world space). Velocities radiate
   * outward in a roughly hemispherical burst biased upward (+Y).
   */
  emit(origin: Vector3, count: number): void {
    const n = Math.min(count, MAX_PARTICLES - this.alive);
    for (let i = 0; i < n; i++) {
      const idx = this.alive + i;
      const i3 = idx * 3;

      this.positions[i3] = origin.x;
      this.positions[i3 + 1] = origin.y;
      this.positions[i3 + 2] = origin.z;

      // Random direction, biased upward.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.65; // hemisphere bias
      const speed = 8 + Math.random() * 22;
      const sinP = Math.sin(phi);
      this.velocities[i3] = Math.cos(theta) * sinP * speed;
      this.velocities[i3 + 1] = Math.cos(phi) * speed + 4; // upward bias
      this.velocities[i3 + 2] = Math.sin(theta) * sinP * speed;

      const life = 0.3 + Math.random() * 0.3;
      this.lifes[idx] = life;
      this.maxLifes[idx] = life;
      this.sizes[idx] = 1.5 + Math.random() * 2.5;
    }
    this.alive += n;
    this.geo.setDrawRange(0, this.alive);
  }

  /** Tick every frame. Advances positions, decrements life, compacts dead. */
  update(dt: number): void {
    let write = 0;
    for (let i = 0; i < this.alive; i++) {
      this.lifes[i] -= dt;
      if (this.lifes[i] <= 0) continue; // dead — skip

      const i3 = i * 3;
      // Gravity + drag.
      this.velocities[i3 + 1] -= 18 * dt; // gravity
      const drag = 1 - 2.5 * dt;
      this.velocities[i3] *= drag;
      this.velocities[i3 + 1] *= drag;
      this.velocities[i3 + 2] *= drag;

      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;

      // Compact: copy to write position if different.
      if (write !== i) {
        const w3 = write * 3;
        this.positions[w3] = this.positions[i3];
        this.positions[w3 + 1] = this.positions[i3 + 1];
        this.positions[w3 + 2] = this.positions[i3 + 2];
        this.velocities[w3] = this.velocities[i3];
        this.velocities[w3 + 1] = this.velocities[i3 + 1];
        this.velocities[w3 + 2] = this.velocities[i3 + 2];
        this.lifes[write] = this.lifes[i];
        this.maxLifes[write] = this.maxLifes[i];
        this.sizes[write] = this.sizes[i];
      }
      write++;
    }
    this.alive = write;
    this.geo.setDrawRange(0, this.alive);
    this.posAttr.needsUpdate = true;
    this.lifeAttr.needsUpdate = true;
    this.maxLifeAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }
}
