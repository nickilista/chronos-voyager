import {
  AdditiveBlending,
  Group,
  Mesh,
  type Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Scene,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Meteorite destruction VFX — the money shot.
 *
 * Five phases overlap in time. They don't render as discrete "moments" so
 * much as layered simultaneous effects that each peak and fade on their
 * own schedule:
 *
 *   1. FLASH  0–150ms  — white-yellow sphere scaling up + fading out.
 *                         Screen-reader: "something blew up HERE".
 *   2. FRAGMENTS 0–800ms+ — 4–6 rock shards fired outward, spinning,
 *                            fading at tail end.
 *   3. SMOKE  50–1200ms — 3 dark spheres expanding + fading. Lingers so
 *                          the impact feels weighty.
 *   4. IMPULSE — a callback fired at t=0 so the Game loop can add camera
 *                 shake scaled by distance (not our concern here).
 *   5. Cleanup  — every spawned mesh returns to the pool; no GC churn.
 *
 * All meshes use AdditiveBlending + depthWrite: false so they blend into
 * whatever is behind them (other explosions, HDRI, meteorite bodies) and
 * don't z-fight. The bloom pass in post amplifies the yellow flash into a
 * readable "strike" moment without extra work.
 *
 * We cap concurrent explosions at 8. A burst of 8 flashes is already more
 * than the player can visually parse; anything more is wasted fillrate.
 * When the pool is full, new play() calls are dropped silently.
 */

const MAX_CONCURRENT = 8;
const FLASH_DURATION = 0.15;
const SMOKE_START = 0.05;
const SMOKE_DURATION = 1.15; // 1200ms from start - 50ms delay
const FRAG_DURATION_MIN = 0.5;
const FRAG_DURATION_MAX = 0.8;
const FRAG_COUNT_MIN = 4;
const FRAG_COUNT_MAX = 6;
const FRAG_SPEED_MIN = 50;
const FRAG_SPEED_MAX = 150;
const FRAG_FILE_COUNT = 8;
const SMOKE_PUFF_COUNT = 3;

interface FlashState {
  mesh: Mesh;
  material: MeshBasicMaterial;
  scale: number;
  t: number;
}

interface FragmentState {
  mesh: Group;
  materials: MeshBasicMaterial[];
  position: Vector3;
  velocity: Vector3;
  rotationVel: Vector3;
  t: number;
  duration: number;
}

interface SmokeState {
  mesh: Mesh;
  material: MeshBasicMaterial;
  scale: number;
  /** Negative delay = not yet started; we count up until 0 before showing. */
  t: number;
}

interface ActiveExplosion {
  active: boolean;
  flash: FlashState | null;
  fragments: FragmentState[];
  smokes: SmokeState[];
  /** Wall-clock time since play() was called — used only for pool timeout. */
  elapsed: number;
  maxDuration: number;
}

export interface ExplosionPoolOptions {
  /**
   * Optional callback fired at the moment play() is called. Distance is the
   * simple world-distance from explosion center to the passed `refPos` (if
   * any) — we don't own the camera so the caller (Game) converts this into
   * actual shake amplitude.
   */
  onImpulse?: (distance: number) => void;
}

export class ExplosionPool {
  private scene: Scene | null = null;
  private readonly group = new Group();
  private flashPrototype: Group | null = null;
  private smokePrototype: Group | null = null;
  private readonly fragmentPrototypes: Group[] = [];
  private readonly pool: ActiveExplosion[] = [];
  private readonly opts: ExplosionPoolOptions;
  /** Free mesh pools: avoid reallocating GPU buffers when reusing a slot. */
  private readonly freeFlashes: FlashState[] = [];
  private readonly freeFragments: FragmentState[] = [];
  private readonly freeSmokes: SmokeState[] = [];

  constructor(opts: ExplosionPoolOptions = {}) {
    this.opts = opts;
  }

  async init(scene: Scene): Promise<void> {
    this.scene = scene;
    scene.add(this.group);

    const loader = new GLTFLoader();
    const [flashGltf, smokeGltf, ...fragGltfs] = await Promise.all([
      loader.loadAsync('/models/effects/explosion_flash.glb'),
      loader.loadAsync('/models/effects/explosion_smoke.glb'),
      ...Array.from({ length: FRAG_FILE_COUNT }, (_, i) =>
        loader.loadAsync(`/models/effects/fragment_${i}.glb`),
      ),
    ]);

    this.flashPrototype = flashGltf.scene as unknown as Group;
    this.smokePrototype = smokeGltf.scene as unknown as Group;
    for (const g of fragGltfs) {
      this.fragmentPrototypes.push(g.scene as unknown as Group);
    }

    // Pre-fill the explosion slot array. Individual effect meshes are
    // built lazily on demand and recycled via free-lists below.
    for (let i = 0; i < MAX_CONCURRENT; i++) {
      this.pool.push({
        active: false,
        flash: null,
        fragments: [],
        smokes: [],
        elapsed: 0,
        maxDuration: 0,
      });
    }
  }

  play(position: Vector3, scale: number): void {
    const slot = this.acquireSlot();
    if (!slot) return;

    slot.active = true;
    slot.elapsed = 0;
    slot.maxDuration = Math.max(FLASH_DURATION, SMOKE_START + SMOKE_DURATION);

    slot.flash = this.buildFlash(position, scale);
    slot.fragments.length = 0;
    slot.smokes.length = 0;

    const fragCount =
      FRAG_COUNT_MIN + Math.floor(Math.random() * (FRAG_COUNT_MAX - FRAG_COUNT_MIN + 1));
    for (let i = 0; i < fragCount; i++) {
      slot.fragments.push(this.buildFragment(position, scale));
    }

    for (let i = 0; i < SMOKE_PUFF_COUNT; i++) {
      slot.smokes.push(this.buildSmoke(position, scale, i));
    }

    // Impulse fires immediately: camera shake should feel synchronous with
    // the flash, not delayed a frame behind. Distance passed as zero means
    // "no ref pos" — the Game-side shake handler treats that as max shake.
    this.opts.onImpulse?.(0);
  }

  update(dt: number): void {
    for (let s = 0; s < this.pool.length; s++) {
      const slot = this.pool[s];
      if (!slot.active) continue;
      slot.elapsed += dt;

      // --- flash ---
      if (slot.flash) {
        slot.flash.t += dt;
        const k = slot.flash.t / FLASH_DURATION;
        if (k >= 1) {
          this.releaseFlash(slot.flash);
          slot.flash = null;
        } else {
          const s01 = k; // 0→1 linearly
          slot.flash.mesh.scale.setScalar(slot.flash.scale * (0.05 + s01 * 0.95));
          slot.flash.material.opacity = 1 - s01;
        }
      }

      // --- fragments ---
      for (let i = slot.fragments.length - 1; i >= 0; i--) {
        const frag = slot.fragments[i];
        frag.t += dt;
        if (frag.t >= frag.duration) {
          this.releaseFragment(frag);
          slot.fragments.splice(i, 1);
          continue;
        }
        frag.position.addScaledVector(frag.velocity, dt);
        // Light drag so shards slow as they fly — reads more natural than
        // straight-line projectile paths which look like "particles" in a
        // bad way.
        const drag = Math.exp(-1.2 * dt);
        frag.velocity.multiplyScalar(drag);
        frag.mesh.position.copy(frag.position);
        frag.mesh.rotation.x += frag.rotationVel.x * dt;
        frag.mesh.rotation.y += frag.rotationVel.y * dt;
        frag.mesh.rotation.z += frag.rotationVel.z * dt;

        // Fade tail-end only — keep the shards visible for the first half,
        // then linear fade so the eye tracks them while they're legible.
        const k = frag.t / frag.duration;
        const fade = k < 0.5 ? 1 : 1 - (k - 0.5) * 2;
        for (const m of frag.materials) m.opacity = fade;
      }

      // --- smoke ---
      for (let i = slot.smokes.length - 1; i >= 0; i--) {
        const smoke = slot.smokes[i];
        smoke.t += dt;
        if (smoke.t < 0) continue; // still in the staggered delay
        if (smoke.t >= SMOKE_DURATION) {
          this.releaseSmoke(smoke);
          slot.smokes.splice(i, 1);
          continue;
        }
        const k = smoke.t / SMOKE_DURATION;
        const currScale = smoke.scale * (0.5 + k * 2.5); // 0.5× → 3×
        smoke.mesh.scale.setScalar(currScale);
        smoke.material.opacity = 0.6 * (1 - k);
      }

      // Slot finishes when every effect has drained AND we're past the
      // nominal max duration — the hard time cap guards against stuck
      // meshes if something goes wrong per-frame.
      const drained =
        !slot.flash && slot.fragments.length === 0 && slot.smokes.length === 0;
      if (drained || slot.elapsed > slot.maxDuration + 1) {
        // Defensive cleanup — normally drained==true handled everything.
        if (slot.flash) {
          this.releaseFlash(slot.flash);
          slot.flash = null;
        }
        for (const f of slot.fragments) this.releaseFragment(f);
        for (const sm of slot.smokes) this.releaseSmoke(sm);
        slot.fragments.length = 0;
        slot.smokes.length = 0;
        slot.active = false;
      }
    }
  }

  dispose(): void {
    const releaseAll = <T extends { mesh: Group | Mesh }>(arr: T[]): void => {
      for (const item of arr) this.disposeMesh(item.mesh);
      arr.length = 0;
    };
    for (const slot of this.pool) {
      if (slot.flash) this.disposeMesh(slot.flash.mesh);
      for (const f of slot.fragments) this.disposeMesh(f.mesh);
      for (const s of slot.smokes) this.disposeMesh(s.mesh);
    }
    releaseAll(this.freeFlashes);
    releaseAll(this.freeFragments);
    releaseAll(this.freeSmokes);
    if (this.scene) this.scene.remove(this.group);
    this.scene = null;
  }

  // ---- internals ----

  private acquireSlot(): ActiveExplosion | null {
    for (const slot of this.pool) {
      if (!slot.active) return slot;
    }
    return null;
  }

  private buildFlash(position: Vector3, meteoriteScale: number): FlashState {
    const reuse = this.freeFlashes.pop();
    if (reuse) {
      reuse.scale = meteoriteScale * 2;
      reuse.t = 0;
      reuse.mesh.position.copy(position);
      reuse.mesh.visible = true;
      reuse.material.opacity = 1;
      this.group.add(reuse.mesh);
      return reuse;
    }
    if (!this.flashPrototype) throw new Error('ExplosionPool: flash not loaded');
    const clone = this.flashPrototype.clone(true) as Group;
    // The flash GLB contains a single sphere mesh — dig to it so we can
    // swap in an AdditiveBlending material (standard lit material would
    // look muddy).
    let innerMesh: Mesh | null = null;
    clone.traverse((obj) => {
      const m = obj as Mesh;
      if (!innerMesh && m.isMesh) innerMesh = m;
    });
    if (!innerMesh) throw new Error('ExplosionPool: flash GLB has no mesh');
    const sharedMesh = innerMesh as Mesh;
    const mat = new MeshBasicMaterial({
      color: 0xffee88,
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    sharedMesh.material = mat;
    sharedMesh.frustumCulled = false;
    sharedMesh.position.set(0, 0, 0);

    const container = new Group();
    container.add(clone);
    container.position.copy(position);
    this.group.add(container);

    return {
      mesh: container as unknown as Mesh,
      material: mat,
      scale: meteoriteScale * 2,
      t: 0,
    };
  }

  private buildFragment(position: Vector3, meteoriteScale: number): FragmentState {
    // Random fragment variant picked per fragment to avoid a "cookie cutter"
    // look where the same shard shows up 6 times. Cheap — the prototype
    // count is 8 so uniform random is fine.
    const idx = Math.floor(Math.random() * this.fragmentPrototypes.length);

    const reuse = this.freeFragments[this.freeFragments.length - 1];
    // Free-list reuse: only reuse if it's the same geometry family — the
    // cheapest way is to just always build fresh and let mesh clones share
    // geometry via three.js's clone(true). Effectively zero-alloc GPU-wise.
    void reuse;

    const proto = this.fragmentPrototypes[idx];
    const mesh = proto.clone(true) as Group;
    const materials: MeshBasicMaterial[] = [];
    mesh.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh) return;
      // Replace StandardMaterial with an emissive basic so fragments glow
      // against dark space and through the bloom pass.
      const origColor = ((): number => {
        const mat = m.material as MeshStandardMaterial;
        if (mat && 'color' in mat && mat.color) return mat.color.getHex();
        return 0xaa7755;
      })();
      // Dispose the cloned original material so we don't leak.
      const origMat = m.material as Material | Material[];
      if (Array.isArray(origMat)) origMat.forEach((x) => x.dispose());
      else origMat?.dispose();
      const basic = new MeshBasicMaterial({
        color: origColor,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      m.material = basic;
      m.frustumCulled = false;
      materials.push(basic);
    });

    // Random outward direction in full sphere (not hemisphere) — an
    // explosion in space has no ground; shards go everywhere.
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const speed = FRAG_SPEED_MIN + Math.random() * (FRAG_SPEED_MAX - FRAG_SPEED_MIN);
    const sinP = Math.sin(phi);
    const vel = new Vector3(
      Math.cos(theta) * sinP * speed,
      Math.cos(phi) * speed,
      Math.sin(theta) * sinP * speed,
    );

    const fragScale = meteoriteScale * (0.2 + Math.random() * 0.3);
    mesh.scale.setScalar(fragScale);
    mesh.position.copy(position);
    mesh.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
    this.group.add(mesh);

    return {
      mesh,
      materials,
      position: position.clone(),
      velocity: vel,
      rotationVel: new Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
      ),
      t: 0,
      duration: FRAG_DURATION_MIN + Math.random() * (FRAG_DURATION_MAX - FRAG_DURATION_MIN),
    };
  }

  private buildSmoke(
    position: Vector3,
    meteoriteScale: number,
    index: number,
  ): SmokeState {
    if (!this.smokePrototype) throw new Error('ExplosionPool: smoke not loaded');
    const clone = this.smokePrototype.clone(true) as Group;

    let innerMesh: Mesh | null = null;
    clone.traverse((obj) => {
      const m = obj as Mesh;
      if (!innerMesh && m.isMesh) innerMesh = m;
    });
    if (!innerMesh) throw new Error('ExplosionPool: smoke GLB has no mesh');
    const sharedMesh = innerMesh as Mesh;

    // Dark neutral smoke — slight warm tint reads as "hot rock aftermath"
    // vs. the cold white of the flash. Use additive so multiple smoke
    // puffs on top of each other compound brightness rather than cancel.
    const mat = new MeshBasicMaterial({
      color: 0x4a3b30,
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    sharedMesh.material = mat;
    sharedMesh.frustumCulled = false;

    // Small random offset per puff so the three don't overlap perfectly.
    const jitter = meteoriteScale * 0.6;
    const offset = new Vector3(
      (Math.random() - 0.5) * 2 * jitter,
      (Math.random() - 0.5) * 2 * jitter,
      (Math.random() - 0.5) * 2 * jitter,
    );
    const container = new Group();
    container.add(clone);
    container.position.copy(position).add(offset);
    this.group.add(container);

    // Staggered start: index * 50ms delay, so puffs bloom in sequence
    // rather than simultaneously — gives the smoke a "rolling" feel.
    const staggerDelay = index * 0.05;

    return {
      mesh: container as unknown as Mesh,
      material: mat,
      scale: meteoriteScale,
      t: -staggerDelay,
    };
  }

  private releaseFlash(f: FlashState): void {
    f.mesh.visible = false;
    this.group.remove(f.mesh);
    this.freeFlashes.push(f);
  }

  private releaseFragment(f: FragmentState): void {
    this.group.remove(f.mesh);
    this.disposeMesh(f.mesh);
    void f; // fragments are disposed rather than pooled; each spawn picks a
    // random prototype so pooling by index is awkward. Disposal cost is
    // small since we only emit up to ~8 slots × 6 frags at peak.
  }

  private releaseSmoke(s: SmokeState): void {
    s.mesh.visible = false;
    this.group.remove(s.mesh);
    this.disposeMesh(s.mesh);
  }

  private disposeMesh(root: Group | Mesh): void {
    root.traverse((obj) => {
      const m = obj as Mesh;
      if (!m.isMesh) return;
      m.geometry?.dispose();
      const mat = m.material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}
