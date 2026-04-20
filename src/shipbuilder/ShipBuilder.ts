import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  PointLight,
  Scene,
  SpotLight,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { getAudio } from '../core/Audio.ts';
import { assembleShip, prefetchConfig } from './ShipAssembly.ts';
import {
  computeDerivedStats,
  presetConfig,
} from './StatsCalculator.ts';
import { loadShipRegistry } from './ShipRegistry.ts';
import {
  SHIP_CLASSES,
  SHIP_SLOTS,
  type ShipClass,
  type ShipConfig,
  type ShipDerivedStats,
  type ShipsConfigJson,
  type ShipSlot,
} from './shipTypes.ts';
import { MechanicalArms } from './MechanicalArms.ts';
import { makeStarField } from './StarField.ts';
import { ShipBuilderUI } from './ShipBuilderUI.ts';

/**
 * Homepage scene: customisation platform, 3D ship preview, orbit controls,
 * stats overlay, preset row, and Launch button. Reuses the game's main
 * WebGLRenderer so there's only one GL context and no flicker when we
 * hand off to gameplay.
 *
 * Lifecycle:
 *   1. `start(canvas)` — boot overlay immediately (DOM) and a minimal 3D
 *      scene so the platform appears while GLBs finish loading.
 *   2. Prefetch ships-config.json + default config's 10 GLBs.
 *   3. Render the assembled ship; respond to UI changes (slot dropdowns,
 *      preset clicks) by re-assembling and recomputing stats.
 *   4. `await launchPromise` — resolves when the player hits "Launch Mission",
 *      handing the chosen `ShipConfig` and derived stats back to `main.ts`.
 */

const DEFAULT_PRESET: ShipClass = 'falcon';
const PLATFORM_URL = '/models/ships/platform/customization_platform.glb';

export interface ShipBuilderResult {
  config: ShipConfig;
  stats: ShipDerivedStats;
}

export class ShipBuilder {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly composer: EffectComposer;

  private config: ShipConfig = presetConfig(DEFAULT_PRESET);
  private registry!: ShipsConfigJson;
  private platform: Group | null = null;
  private mechArms: MechanicalArms | null = null;
  private shipGroup: Group | null = null;

  private ui!: ShipBuilderUI;
  private stars: ReturnType<typeof makeStarField>;

  // Orbit camera state — azimuth (around Y), elevation (from horizon), zoom.
  private azimuth = Math.PI * 0.25;
  private elevation = Math.PI * 0.18;
  private targetZoom = 7.5;
  private zoom = 7.5;
  private rotationVelocity = 0.25; // auto-spin when idle
  private lastInteractionTs = 0;

  private running = false;
  private lastTs = 0;
  private resolveLaunch!: (r: ShipBuilderResult) => void;
  readonly launchPromise: Promise<ShipBuilderResult>;

  private pointerState = {
    dragging: false,
    lastX: 0,
    lastY: 0,
  };

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private onPointerDown = (ev: PointerEvent): void => {
    // Only rotate when dragging the canvas itself (not the UI overlay).
    if ((ev.target as HTMLElement).tagName !== 'CANVAS') return;
    this.pointerState.dragging = true;
    this.pointerState.lastX = ev.clientX;
    this.pointerState.lastY = ev.clientY;
    this.lastInteractionTs = performance.now();
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
  };

  private onPointerMove = (ev: PointerEvent): void => {
    if (!this.pointerState.dragging) return;
    const dx = ev.clientX - this.pointerState.lastX;
    const dy = ev.clientY - this.pointerState.lastY;
    this.pointerState.lastX = ev.clientX;
    this.pointerState.lastY = ev.clientY;
    this.azimuth -= dx * 0.006;
    this.elevation = Math.max(
      -Math.PI * 0.45,
      Math.min(Math.PI * 0.45, this.elevation - dy * 0.005),
    );
    this.lastInteractionTs = performance.now();
  };

  private onPointerUp = (): void => {
    this.pointerState.dragging = false;
  };

  private onWheel = (ev: WheelEvent): void => {
    if ((ev.target as HTMLElement).tagName !== 'CANVAS') return;
    ev.preventDefault();
    this.targetZoom = Math.max(
      4.5,
      Math.min(14, this.targetZoom + ev.deltaY * 0.008),
    );
    this.lastInteractionTs = performance.now();
  };

  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer;
    this.camera = new PerspectiveCamera(
      38,
      window.innerWidth / window.innerHeight,
      0.05,
      2000,
    );

    // Deep-space backdrop — nearly black with a faint blue cast.
    this.scene.background = new Color(0x020308);

    // Stars far out.
    this.stars = makeStarField(2200, 600);
    this.scene.add(this.stars);

    // Lighting: ambient blue fill + overhead spotlight on the ship, plus two
    // rim accents to keep the silhouette legible against the dark bg.
    const ambient = new AmbientLight(0x4455aa, 0.35);
    this.scene.add(ambient);
    const spot = new SpotLight(0xffffff, 2.4, 40, Math.PI * 0.22, 0.5, 1.2);
    spot.position.set(0, 12, 4);
    spot.target.position.set(0, 0, 0);
    this.scene.add(spot, spot.target);
    const rimA = new DirectionalLight(0x5fa8ff, 0.7);
    rimA.position.set(-5, 2, 4);
    this.scene.add(rimA);
    const rimB = new DirectionalLight(0xff9a5a, 0.45);
    rimB.position.set(5, 1.5, -3);
    this.scene.add(rimB);
    // Underglow so the platform reads as emitting light.
    const under = new PointLight(0x5fa8ff, 1.8, 8, 2);
    under.position.set(0, -0.2, 0);
    this.scene.add(under);

    // Post-processing stack mirrors gameplay's so the handoff is seamless.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new BloomEffect({
      intensity: 1.4,
      luminanceThreshold: 0.6,
      luminanceSmoothing: 0.2,
      mipmapBlur: true,
      radius: 0.55,
    });
    const vignette = new VignetteEffect({ darkness: 0.55, offset: 0.3 });
    const smaa = new SMAAEffect();
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    this.composer.addPass(new EffectPass(this.camera, bloom));
    this.composer.addPass(new EffectPass(this.camera, vignette, tone, smaa));

    this.launchPromise = new Promise<ShipBuilderResult>((resolve) => {
      this.resolveLaunch = resolve;
    });
  }

  async start(): Promise<void> {
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('wheel', this.onWheel, {
      passive: false,
    });
    this.onResize();

    // Prime the audio manager so all 11 tracks start buffering while the
    // builder scene comes up. `playBuilderMusic` sets the mix to 100% space
    // track; the first user gesture (clicking any slot / preset / pointer
    // drag on the canvas) unsuspends the AudioContext and the Tokyo Rifft
    // score starts underscoring the customisation screen.
    getAudio().playBuilderMusic();

    // Kick the loop immediately so the background is visible while the GLBs
    // stream in behind a small loading indicator.
    this.running = true;
    this.lastTs = performance.now();
    requestAnimationFrame(this.frame);

    // Load registry + platform + default ship in parallel.
    const [registry, platform] = await Promise.all([
      loadShipRegistry(),
      this.loadPlatform(),
    ]);
    this.registry = registry;
    this.platform = platform;
    this.scene.add(platform);

    // Mechanical arms live in a sibling group so they don't inherit the
    // platform's idle Y-spin — the arms should look like they're busy
    // assembling the ship, not orbiting around it.
    this.mechArms = new MechanicalArms();
    this.mechArms.group.position.y = platform.position.y;
    this.scene.add(this.mechArms.group);

    // Default config renders while we wait for UI interactions.
    await this.applyConfig(this.config);

    // Background-prefetch all 100 parts so slot changes feel instant. We
    // don't await this — the user can already interact with the default
    // build. We throttle with a microtask-friendly sequential loop so we
    // don't thrash the browser's fetch queue.
    this.backgroundPrefetchAll();

    // Build the UI overlay now that we have the registry.
    this.ui = new ShipBuilderUI({
      registry: this.registry,
      initialConfig: this.config,
      onConfigChange: (next) => this.onConfigChange(next),
      onLaunch: () => this.onLaunch(),
    });
    this.ui.mount(document.body);
    this.updateStats();
  }

  private async loadPlatform(): Promise<Group> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(PLATFORM_URL);
    const g = gltf.scene as unknown as Group;
    g.position.y = -1.6;
    g.scale.setScalar(1.0);

    // The baked GLB includes a few placeholder props we want to replace:
    //   • `platform_beam`: a 4u-tall luminous pole at the origin that
    //     spears right through the ship silhouette.
    //   • `platform_arm_*` + `platform_joint_*`: crude 1u cube "arms"
    //     and 0.12u sphere "joints" at the cardinal edges. We swap these
    //     for proper articulated MechanicalArms attached to the corner
    //     pillars (see MechanicalArms.ts).
    // Pillars, grid rings and particle decorations are kept — they read
    // as a legit hangar deck.
    const HIDE_PREFIXES = ['platform_beam', 'platform_arm_', 'platform_joint_'];
    g.traverse((obj) => {
      if (HIDE_PREFIXES.some((p) => obj.name.startsWith(p))) {
        obj.visible = false;
      }
    });
    return g;
  }

  private async applyConfig(cfg: ShipConfig): Promise<void> {
    const assembly = await assembleShip(cfg);
    // Show the shield bubble in the preview — the player picks a shield
    // part so they should actually see what it looks like wrapping the
    // hull. `makeShieldEthereal` already fades the material to 22% opacity
    // with additive blending in ShipAssembly.ts, so the bubble reads as a
    // soft energy field rather than an opaque shell blocking the silhouette.
    // Hot-swap: remove previous ship group only after the new one is ready
    // so the preview never flickers to empty.
    if (this.shipGroup) this.scene.remove(this.shipGroup);
    this.shipGroup = assembly.group;
    this.scene.add(this.shipGroup);
  }

  private onConfigChange(next: ShipConfig): void {
    this.config = next;
    // Soft UI blip on every slot / preset change so the player gets tactile
    // feedback from the loadout panel. The synth is brief (<120ms) so rapid
    // dropdown scrolling reads as a gentle tick rather than a wall of beeps.
    getAudio().playUiClick();
    // Fire-and-forget: the new GLBs may still be loading the first time;
    // assembleShip awaits cache promises so swapping is ordered.
    void this.applyConfig(next).then(() => this.updateStats());
    this.updateStats();
  }

  private updateStats(): void {
    if (!this.registry || !this.ui) return;
    const stats = computeDerivedStats(this.config, this.registry);
    this.ui.setStats(stats);
  }

  private onLaunch(): void {
    if (!this.registry) return;
    // "Engines igniting" cue for the handoff to gameplay — the boost SFX is
    // the closest thing we have to a launch whoosh, and its rising pitch
    // pairs with the visual jump from builder to corridor.
    getAudio().playBoost();
    const stats = computeDerivedStats(this.config, this.registry);
    const result: ShipBuilderResult = { config: { ...this.config }, stats };
    this.teardown();
    this.resolveLaunch(result);
  }

  /** Background-prefetch every unique class/slot combo, lowest priority. */
  private async backgroundPrefetchAll(): Promise<void> {
    // Chunk through 10 classes, one class per tick, so we don't spike
    // network congestion at startup.
    for (const cls of SHIP_CLASSES) {
      await new Promise((r) => setTimeout(r, 80));
      await prefetchConfig(presetConfig(cls)).catch(() => undefined);
    }
  }

  private teardown(): void {
    this.running = false;
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('wheel', this.onWheel);
    this.ui?.unmount();
    // Dispose composer passes to free GL resources.
    this.composer.dispose();
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min((now - this.lastTs) / 1000, 0.1);
    this.lastTs = now;

    // Auto-rotate the ship if the user hasn't interacted recently.
    const idle = now - this.lastInteractionTs > 1500;
    if (idle && !this.pointerState.dragging) {
      this.azimuth += this.rotationVelocity * dt;
    }

    // Smooth zoom.
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 6);

    const cx = Math.sin(this.azimuth) * Math.cos(this.elevation) * this.zoom;
    const cy = Math.sin(this.elevation) * this.zoom + 1.2;
    const cz = Math.cos(this.azimuth) * Math.cos(this.elevation) * this.zoom;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(0, 0.2, 0);

    // Gentle platform rotation — base plate + whatever internal animation
    // the GLB has is up to the model.
    if (this.platform) {
      this.platform.rotation.y += dt * 0.12;
    }

    // Mechanical arms breathe at their own rate and stay earth-anchored so
    // they read as a hangar's service rig, not part of the spinning dais.
    if (this.mechArms) {
      this.mechArms.tick(dt, now * 0.001);
    }

    // Ship hovers with a subtle float + breath on pitch so it feels alive.
    if (this.shipGroup) {
      const t = now * 0.001;
      this.shipGroup.position.y = Math.sin(t * 0.9) * 0.08;
      this.shipGroup.rotation.z = Math.sin(t * 0.6) * 0.03;
    }

    // Stars twinkle.
    (this.stars as unknown as { tick: (dt: number) => void }).tick(dt);

    this.composer.render(dt);
    requestAnimationFrame(this.frame);
  };
}

/**
 * Re-export for any module that wants to iterate slot names while building
 * their own selectors without re-importing the constant.
 */
export { SHIP_SLOTS, SHIP_CLASSES };
export type { ShipClass, ShipConfig, ShipSlot, ShipDerivedStats };
