import {
  AmbientLight,
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  Fog,
  NoToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { getInput } from './core/Input.ts';
import type { Era } from './eras/eras.ts';
import { ERA_CONTENT } from './eras/eraContent.ts';
import { getEnvHDR, preloadAssets } from './gameplay/Assets.ts';
import { sphereVsAabb } from './gameplay/Collision.ts';
import type { Flow } from './gameplay/Flow.ts';
import { FlowManager } from './gameplay/FlowManager.ts';
import type { Obstacle } from './gameplay/obstacles/types.ts';
import { Ship } from './gameplay/Ship.ts';
import { AstragaloiPuzzle } from './puzzles/Astragaloi.ts';
import { BooleanGatesPuzzle } from './puzzles/BooleanGates.ts';
import { CardanoDicePuzzle } from './puzzles/CardanoDice.ts';
import { ChineseRingsPuzzle } from './puzzles/ChineseRings.ts';
import { CryptarithmeticPuzzle } from './puzzles/Cryptarithmetic.ts';
import { FourColorPuzzle } from './puzzles/FourColor.ts';
import { FrequencyAnalysisPuzzle } from './puzzles/FrequencyAnalysis.ts';
import { GirihPuzzle } from './puzzles/Girih.ts';
import { KolamPuzzle } from './puzzles/Kolam.ts';
import { KonigsbergPuzzle } from './puzzles/Konigsberg.ts';
import { LatinSquarePuzzle } from './puzzles/LatinSquare.ts';
import { LorenzPuzzle } from './puzzles/Lorenz.ts';
import { LoShuPuzzle } from './puzzles/LoShu.ts';
import { MokshaPatamPuzzle } from './puzzles/MokshaPatam.ts';
import { PharaohGridPuzzle } from './puzzles/PharaohGrid.ts';
import { PlayfairPuzzle } from './puzzles/Playfair.ts';
import type { Puzzle } from './puzzles/PuzzleBase.ts';
import { SenetPuzzle } from './puzzles/Senet.ts';
import { SorobanPuzzle } from './puzzles/Soroban.ts';
import { SugorokuPuzzle } from './puzzles/Sugoroku.ts';
import { StomachionPuzzle } from './puzzles/Stomachion.ts';
import { CelestialGods } from './render/CelestialGods.ts';
import { Skybox } from './render/Skybox.ts';
import { Hud } from './ui/hud.ts';

// Raised + slightly pulled back — more top-down framing of the ship and track.
const CAMERA_OFFSET = new Vector3(0, 3.2, 6.0);
// Camera drifts opposite the ship's local x-velocity to reveal the fuselage.
const CAMERA_DRIFT_GAIN = 0.11;
const CAMERA_DRIFT_MAX = 1.8;
const SHIP_COLLIDER_RADIUS = 1.35;
const INVULN_AFTER_CRASH = 1.0;
const ORB_TARGET = 10;
const CRASH_SHAKE_DURATION = 0.55;
const CRASH_SHAKE_MAX = 0.9;
const CRASH_FLASH_DURATION = 0.18;
const IMPACTS_PER_ANKH = 2;
const MAX_HALVES = IMPACTS_PER_ANKH * 2;

export class Game {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly ship: Ship;
  readonly skybox: Skybox;
  readonly celestial: CelestialGods;
  readonly flowManager: FlowManager;
  readonly hud: Hud;
  readonly composer: EffectComposer;

  private currentHudEra: Era;
  private ambient: AmbientLight;
  private key: DirectionalLight;
  private rim: DirectionalLight;
  private lastTs = performance.now();
  private _smoothCamPos = new Vector3();
  private readonly _scratchA = new Vector3();
  private readonly _scratchB = new Vector3();
  private readonly _scratchC = new Vector3();
  private readonly _scratchD = new Vector3();
  private readonly _scratchE = new Vector3();
  private readonly _scratchF = new Vector3();
  private readonly _scratchLocalShip = new Vector3();
  private readonly _scratchG = new Vector3();
  private invuln = 0;
  private won = false;
  private shakeRemaining = 0;
  private flashRemaining = 0;
  private flashEl: HTMLDivElement | null = null;
  private puzzle: Puzzle | null = null;
  private puzzleFlow: Flow | null = null;
  private pointerHandler: ((ev: PointerEvent) => void) | null = null;
  private impactsSinceAnkh = 0;
  private lastHudFlow: Flow | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.camera = new PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      40000,
    );

    this.flowManager = new FlowManager({
      onAnkhPickup: (flow, collected, target) => {
        if (flow === this.flowManager.activeFlow) {
          this.hud.updateOrbCount(collected, target);
        }
      },
      onEraComplete: (flow) => this.onEraComplete(flow),
    });

    // HUD initially displays Egypt (the anchor flow).
    this.currentHudEra = this.flowManager.flows[0].era;
    this.scene.fog = new Fog(this.currentHudEra.palette.fog, 40, 220);
    this._fogInside.setHex(this.currentHudEra.palette.fog);

    this.skybox = new Skybox(this.currentHudEra);
    this.scene.add(this.skybox.mesh);

    this.celestial = new CelestialGods();
    this.scene.add(this.celestial.group);

    this.ship = new Ship();

    this.ambient = new AmbientLight(0xffffff, 0.3);
    this.scene.add(this.ambient);

    this.key = new DirectionalLight(this.currentHudEra.palette.accent, 1.35);
    this.key.position.set(5, 8, 3);
    this.scene.add(this.key);

    this.rim = new DirectionalLight(0x88bbff, 0.95);
    this.rim.position.set(-3, 5, 10);
    this.scene.add(this.rim);

    this.scene.add(this.ship.group);

    this.hud = new Hud();
    this.hud.setEra(
      this.currentHudEra.name,
      this.currentHudEra.subtitle,
      this.currentHudEra.palette.accent,
    );
    this.hud.setOrbTarget(ORB_TARGET);
    this.hud.setOrbIcon(ERA_CONTENT[this.currentHudEra.id].collectible.icon);
    this.hud.updateHearts(this.heartHalves(), MAX_HALVES);

    // Post-processing stack.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const bloom = new BloomEffect({
      intensity: 0.7,
      luminanceThreshold: 0.85,
      luminanceSmoothing: 0.15,
      mipmapBlur: true,
      radius: 0.4,
    });
    const chroma = new ChromaticAberrationEffect({
      offset: new Vector2(0.0006, 0.0006),
    });
    const vignette = new VignetteEffect({ darkness: 0.42, offset: 0.35 });
    const smaa = new SMAAEffect();
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

    this.composer.addPass(new EffectPass(this.camera, bloom));
    this.composer.addPass(new EffectPass(this.camera, chroma));
    this.composer.addPass(new EffectPass(this.camera, vignette, tone, smaa));

    this._smoothCamPos.copy(this.ship.group.position).add(CAMERA_OFFSET);
    this.camera.position.copy(this._smoothCamPos);
    this.camera.lookAt(this.ship.group.position);

    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    this.pointerHandler = (ev: PointerEvent) => {
      if (!this.puzzle) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ndc = new Vector2(
        ((ev.clientX - rect.left) / rect.width) * 2 - 1,
        -((ev.clientY - rect.top) / rect.height) * 2 + 1,
      );
      this.puzzle.onPointerDown(ndc, this.camera);
    };
    this.renderer.domElement.addEventListener('pointerdown', this.pointerHandler);
  }

  async start(): Promise<void> {
    await preloadAssets();
    const hdr = getEnvHDR();
    hdr.mapping = EquirectangularReflectionMapping;
    const pmrem = new PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const envMap = pmrem.fromEquirectangular(hdr).texture;
    this.scene.environment = envMap;
    this.scene.environmentIntensity = 0.55;
    hdr.dispose();
    pmrem.dispose();
    this.ship.init();
    this.celestial.init();
    this.flowManager.init(this.scene);
    this.lastTs = performance.now();
    requestAnimationFrame(this.frame);
  }

  private handleResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private onCrash(hit: Obstacle, flow: Flow): void {
    this.invuln = INVULN_AFTER_CRASH;
    this.shakeRemaining = CRASH_SHAKE_DURATION;
    this.flashRemaining = CRASH_FLASH_DURATION;
    this.ensureFlashEl().style.opacity = '1';

    // Fling the obstacle. Positions/velocities are passed in flow-local frame
    // so the angular + linear response reads correctly regardless of tilt.
    flow.worldToLocalPoint(this.ship.group.position, this._scratchLocalShip);
    const localVel = this._scratchF
      .copy(this.ship.velocity)
      .applyQuaternion(flow.inverseQuaternion);
    flow.track.hitImpact(hit, this._scratchLocalShip, localVel);
    this.ship.stun();

    this.impactsSinceAnkh++;
    if (this.impactsSinceAnkh >= IMPACTS_PER_ANKH) {
      this.impactsSinceAnkh = 0;
      if (flow.collectibles.losePickup()) {
        this.hud.flashAnkhLoss();
      }
    }
    this.hud.updateHearts(this.heartHalves(), MAX_HALVES);
  }

  private readonly _fogInside = new Color();
  private readonly _fogOutside = new Color(0x040618);
  private readonly _fogWork = new Color();

  private updateFog(outside: number): void {
    const fog = this.scene.fog as Fog | null;
    if (!fog) return;
    this._fogWork.copy(this._fogInside).lerp(this._fogOutside, outside);
    fog.color.copy(this._fogWork);
    // Inside a corridor: tight fog (220) so the era feels enclosed. In free
    // space: fog reaches far so the 10 flow tubes read as distant landmarks.
    fog.far = 220 + outside * 30000;
  }

  private heartHalves(): number {
    return Math.max(0, (IMPACTS_PER_ANKH - this.impactsSinceAnkh) * 2);
  }

  private ensureFlashEl(): HTMLDivElement {
    if (this.flashEl) return this.flashEl;
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,rgba(255,200,120,0.85),rgba(255,80,30,0.6) 45%,rgba(0,0,0,0) 75%);opacity:0;transition:opacity 120ms ease-out;z-index:999;mix-blend-mode:screen;';
    document.body.appendChild(el);
    this.flashEl = el;
    return el;
  }

  /** Flow reached 10 ankhs — trigger checkpoint puzzle for that flow's era. */
  private onEraComplete(flow: Flow): void {
    if (this.puzzle) return; // already in a puzzle
    this.won = true;
    this.hud.showWin();
    this.puzzleFlow = flow;
    setTimeout(() => this.startPuzzle(), 1400);
  }

  private startPuzzle(): void {
    if (!this.puzzleFlow) return;
    const flow = this.puzzleFlow;
    this.hud.hideWin();
    this.ship.group.visible = false;
    this.flowManager.setAllVisible(false);
    this.skybox.mesh.visible = false;
    this.celestial.group.visible = false;

    // Dispatch per era — each era owns its own two-puzzle checkpoint
    // sequence. Eras without their own content yet fall back to the
    // Egyptian pair so the flow can still be cleared.
    const p = this.buildPuzzleForEra(flow.era.id, flow.puzzleStage);
    this.puzzle = p;
    p.init();
    this.scene.add(p.group);
  }

  private buildPuzzleForEra(eraId: string, stage: 0 | 1 | 2): Puzzle {
    if (eraId === 'greece') {
      return stage === 0 ? this.buildStomachion() : this.buildAstragaloi();
    }
    if (eraId === 'china') {
      return stage === 0 ? this.buildLoShu() : this.buildChineseRings();
    }
    if (eraId === 'islamic') {
      return stage === 0 ? this.buildFrequency() : this.buildGirih();
    }
    if (eraId === 'india') {
      return stage === 0 ? this.buildMoksha() : this.buildKolam();
    }
    if (eraId === 'renaissance') {
      return stage === 0 ? this.buildCryptarithmetic() : this.buildCardano();
    }
    if (eraId === 'edo') {
      return stage === 0 ? this.buildSoroban() : this.buildSugoroku();
    }
    if (eraId === 'enlightenment') {
      return stage === 0 ? this.buildLatinSquare() : this.buildKonigsberg();
    }
    if (eraId === 'revolution') {
      return stage === 0 ? this.buildBooleanGates() : this.buildFourColor();
    }
    if (eraId === 'codebreakers') {
      return stage === 0 ? this.buildPlayfair() : this.buildLorenz();
    }
    // egypt + any era without authored puzzles yet.
    return stage === 0 ? this.buildSenet() : this.buildPharaoh();
  }

  private buildSenet(): Puzzle {
    const p = new SenetPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildPharaoh(): Puzzle {
    const p = new PharaohGridPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildStomachion(): Puzzle {
    const p = new StomachionPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildAstragaloi(): Puzzle {
    const p = new AstragaloiPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildLoShu(): Puzzle {
    const p = new LoShuPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildChineseRings(): Puzzle {
    const p = new ChineseRingsPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildFrequency(): Puzzle {
    const p = new FrequencyAnalysisPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildGirih(): Puzzle {
    const p = new GirihPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildMoksha(): Puzzle {
    const p = new MokshaPatamPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildKolam(): Puzzle {
    const p = new KolamPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildCryptarithmetic(): Puzzle {
    const p = new CryptarithmeticPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildCardano(): Puzzle {
    const p = new CardanoDicePuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildSoroban(): Puzzle {
    const p = new SorobanPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildSugoroku(): Puzzle {
    const p = new SugorokuPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildLatinSquare(): Puzzle {
    const p = new LatinSquarePuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildKonigsberg(): Puzzle {
    const p = new KonigsbergPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildBooleanGates(): Puzzle {
    const p = new BooleanGatesPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildFourColor(): Puzzle {
    const p = new FourColorPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildPlayfair(): Puzzle {
    const p = new PlayfairPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private buildLorenz(): Puzzle {
    const p = new LorenzPuzzle();
    p.onSolved = () => this.endPuzzle();
    return p;
  }

  private endPuzzle(): void {
    if (!this.puzzle || !this.puzzleFlow) return;
    const flow = this.puzzleFlow;
    this.scene.remove(this.puzzle.group);
    this.puzzle.dispose();
    this.puzzle = null;

    flow.puzzleStage = (flow.puzzleStage + 1) as 0 | 1 | 2;

    if (flow.puzzleStage >= 2) {
      this.showEraComplete(flow);
      this.puzzleFlow = null;
      return;
    }

    this.ship.group.visible = true;
    this.flowManager.setAllVisible(true);
    this.skybox.mesh.visible = true;
    this.celestial.group.visible = true;
    flow.resetCollectibles();
    this.impactsSinceAnkh = 0;
    this.hud.updateHearts(this.heartHalves(), MAX_HALVES);
    this.hud.updateOrbCount(0, ORB_TARGET);
    this.won = false;
    this.puzzleFlow = null;
    this._smoothCamPos.copy(this.ship.group.position).add(CAMERA_OFFSET);
    this.camera.position.copy(this._smoothCamPos);
  }

  private showEraComplete(flow: Flow): void {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(40,20,4,0.65),rgba(0,0,0,0.9));z-index:30;pointer-events:none;font-family:system-ui,sans-serif;';
    el.innerHTML = `
      <div style="text-align:center;padding:40px 60px;border:1px solid rgba(255,210,127,0.3);background:rgba(10,6,2,0.8);backdrop-filter:blur(10px);border-radius:8px;">
        <div style="color:var(--era-accent);font-size:12px;letter-spacing:0.25em;opacity:0.7">ERA COMPLETE</div>
        <div style="color:#fff;font-size:28px;font-weight:600;margin-top:12px;letter-spacing:0.04em">${flow.era.name} preserved</div>
        <div style="color:rgba(255,255,255,0.55);font-size:13px;margin-top:10px">mathematics remembered</div>
      </div>
    `;
    document.body.appendChild(el);
  }

  private checkCollisions(): void {
    if (this.invuln > 0) return;
    const flow = this.flowManager.activeFlow;
    // Only test against the active flow's obstacles. Other flows' pylons are
    // far enough away (≥ MIN_SEGMENT_CLEARANCE) that their local-frame AABBs
    // can never contain the ship — checking them would waste cycles.
    flow.worldToLocalPoint(this.ship.group.position, this._scratchLocalShip);
    for (const ob of flow.track.all) {
      const dz = this._scratchLocalShip.z - ob.mesh.position.z;
      if (dz < -3 || dz > 3) continue;
      if (
        sphereVsAabb(
          this._scratchLocalShip,
          SHIP_COLLIDER_RADIUS,
          ob.mesh.position,
          ob.halfSize,
        )
      ) {
        this.onCrash(ob, flow);
        return;
      }
    }
  }

  private applyHudForActiveFlow(): void {
    const flow = this.flowManager.activeFlow;
    if (flow === this.lastHudFlow) return;
    this.lastHudFlow = flow;
    this.currentHudEra = flow.era;
    this.hud.setEra(
      flow.era.name,
      flow.era.subtitle,
      flow.era.palette.accent,
    );
    this.hud.updateOrbCount(flow.collectibles.collected, ORB_TARGET);
    this.hud.setOrbIcon(ERA_CONTENT[flow.era.id].collectible.icon);
    this.skybox.setEra(flow.era);
    this._fogInside.setHex(flow.era.palette.fog);
    this.key.color.setHex(flow.era.palette.accent);
    this.celestial.setEra(flow.era.id);
  }

  private frame = (now: number): void => {
    const dt = Math.min((now - this.lastTs) / 1000, 0.05);
    this.lastTs = now;

    if (this.puzzle) {
      this.puzzle.update(dt, this.camera);
      this.composer.render(dt);
      requestAnimationFrame(this.frame);
      return;
    }

    // Find nearest flow + compute outside factor BEFORE ship.update so the
    // ship knows which axis to align with this frame.
    this.flowManager.update(dt, this.ship.group.position, this.ship.velocity);
    const activeFlow = this.flowManager.activeFlow;
    const outside = this.flowManager.outsideFactor;

    // Ship local position in the active flow's frame (used for exit ease).
    activeFlow.worldToLocalPoint(this.ship.group.position, this._scratchLocalShip);

    if (!this.won) {
      this.ship.update(dt, getInput(), {
        outsideFactor: outside,
        flowAxis: activeFlow.axis,
        flowQuaternion: activeFlow.quaternion,
        flowOrigin: activeFlow.origin,
        localShipPos: this._scratchLocalShip,
      });
      if (this.invuln > 0) this.invuln -= dt;
      this.checkCollisions();
    }

    // HUD / sky / lighting follow active flow.
    this.applyHudForActiveFlow();

    this.skybox.setOutsideFactor(outside);
    this.skybox.setFlowOrientation(activeFlow.inverseQuaternion);
    this.celestial.setInsideFactor(1 - outside);
    this.updateFog(outside);
    this.celestial.update(dt, this.camera.position, activeFlow.quaternion);
    // Skybox scroll loosely follows travel so the stars animate. Use the
    // ship's signed axial progress through the active flow for the sign.
    this.skybox.update(dt, -this._scratchLocalShip.z * 0.004);

    if (this.flashRemaining > 0) {
      this.flashRemaining = Math.max(0, this.flashRemaining - dt);
      if (this.flashRemaining === 0 && this.flashEl) {
        this.flashEl.style.opacity = '0';
      }
    }

    // Camera follow. Inside = offset expressed in flow-local frame (so the
    // camera sits "behind + above" the ship along the flow axis, even if the
    // flow is tilted). Outside = offset rigidly attached to the ship so it
    // follows full loops.
    const localLatVelX = this._scratchG
      .copy(this.ship.velocity)
      .applyQuaternion(activeFlow.inverseQuaternion).x;
    const drift = Math.max(
      -CAMERA_DRIFT_MAX,
      Math.min(CAMERA_DRIFT_MAX, -localLatVelX * CAMERA_DRIFT_GAIN),
    );

    // Inside offset: CAMERA_OFFSET in flow-local frame (with drift on X),
    // then rotated to world. Matches Egypt exactly when flowQuat = identity.
    const flowFrameOffset = this._scratchA.set(
      CAMERA_OFFSET.x + drift,
      CAMERA_OFFSET.y,
      CAMERA_OFFSET.z,
    );
    flowFrameOffset.applyQuaternion(activeFlow.quaternion);

    const shipFrameOffset = this._scratchB
      .copy(CAMERA_OFFSET)
      .applyQuaternion(this.ship.group.quaternion);

    const camOffset = flowFrameOffset.lerp(shipFrameOffset, outside);
    const target = this._scratchC.copy(this.ship.group.position).add(camOffset);
    this._smoothCamPos.lerp(target, Math.min(1, dt * 6));
    this.camera.position.copy(this._smoothCamPos);

    const shipUp = this._scratchD
      .set(0, 1, 0)
      .applyQuaternion(this.ship.group.quaternion);
    // Inside "world up" is actually flow-local up rotated to world, so a
    // tilted flow still has the horizon framed correctly.
    const flowUp = this._scratchE.set(0, 1, 0).applyQuaternion(activeFlow.quaternion);
    this.camera.up.copy(flowUp.lerp(shipUp, outside)).normalize();

    // Look target.
    const forwardLocal = this._scratchF
      .set(0, 0, -1)
      .applyQuaternion(this.ship.group.quaternion);
    const lookOutside = forwardLocal.multiplyScalar(6).add(this.ship.group.position);
    // lookInside computed in flow-local then rotated into world.
    const lookInsideLocal = this._scratchA.set(-drift * 0.4, -0.6, -6);
    lookInsideLocal.applyQuaternion(activeFlow.quaternion);
    const lookInside = lookInsideLocal.add(this.ship.group.position);
    const lookTarget = lookInside.lerp(lookOutside, outside);

    if (this.shakeRemaining > 0) {
      this.shakeRemaining = Math.max(0, this.shakeRemaining - dt);
      const s = this.shakeRemaining / CRASH_SHAKE_DURATION;
      const amp = CRASH_SHAKE_MAX * s * s;
      this.camera.position.x += (Math.random() * 2 - 1) * amp;
      this.camera.position.y += (Math.random() * 2 - 1) * amp;
    }
    this.camera.lookAt(lookTarget);

    this.skybox.mesh.position.copy(this.camera.position);

    // HUD speedometer + distance — distance = |axial progress through active flow|.
    const latSpeed = Math.hypot(this.ship.velocity.x, this.ship.velocity.y) + 40;
    const distance = Math.max(0, -this._scratchLocalShip.z);
    this.hud.update(dt, latSpeed, distance);

    this.composer.render(dt);
    requestAnimationFrame(this.frame);
  };
}
