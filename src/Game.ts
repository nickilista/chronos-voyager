import {
  AmbientLight,
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  Fog,
  type Object3D,
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
import { getAudio } from './core/Audio.ts';
import { getInput } from './core/Input.ts';
import { SaveManager, SHIP_PART_UNLOCK_THRESHOLD, type SaveData } from './core/SaveManager.ts';
import type { Era, EraId } from './eras/eras.ts';
import { ERA_CONTENT } from './eras/eraContent.ts';
import { getEnvHDR, preloadAssets } from './gameplay/Assets.ts';
import { sphereVsAabb } from './gameplay/Collision.ts';
import type { Flow } from './gameplay/Flow.ts';
import { FlowManager } from './gameplay/FlowManager.ts';
import { Meteorites, type MeteoriteType } from './gameplay/Meteorites.ts';
import { Projectiles } from './gameplay/Projectiles.ts';
import type { Obstacle } from './gameplay/obstacles/types.ts';
import { DEFAULT_SHIP_STATS, Ship } from './gameplay/Ship.ts';
import { AimAssist, type AimAssistState } from './gameplay/AimAssist.ts';
import { type WeaponKind, weaponKindFor } from './gameplay/WeaponTypes.ts';
import { ExplosionPool } from './render/MeteoriteExplosion.ts';
import { Crosshair } from './ui/Crosshair.ts';
import {
  parsePortalQuery,
  PortalSystem,
  type PortalQuery,
  type ShipSnapshot,
} from './portal/PortalSystem.ts';
import { assembleShip } from './shipbuilder/ShipAssembly.ts';
import type { ShipBuilderResult } from './shipbuilder/ShipBuilder.ts';
import type { ShipConfig } from './shipbuilder/shipTypes.ts';
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
import { ImpactSparks } from './render/ImpactSparks.ts';
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
const CRASH_SHAKE_MAX = 1.2;
const CRASH_FREEZE_DURATION = 0.06;
const CRASH_FLASH_DURATION = 0.18;
/**
 * Base damage per corridor obstacle impact. Armor subtracts from this (floored
 * to CRASH_MIN_DAMAGE so heavy Golem armor doesn't make the ship immortal),
 * then the remainder is applied to shield first, then HP.
 */
const CRASH_BASE_DAMAGE = 30;
const CRASH_MIN_DAMAGE = 6;
/** HP threshold at which we reset HP and deduct an ankh (the old death sub). */
const HP_RESET_DEDUCT_ANKH = true;
/** Boost recharge fraction at which the engine reads as "usable" again.
 *  Below this, the depleted-visual latch stays on (flame choked) even
 *  though boostEnergy has started climbing off zero. Picking 30% avoids
 *  the thruster popping from "choked" to "normal" after a single frame
 *  of recharge tickle — players see a clear stump-then-resume arc. */
const BOOST_READY_THRESHOLD = 0.3;

/** Every-slot Falcon loadout — used as a fallback when the game is
 *  constructed without a builder result (dev / portal-inbound fast-path
 *  doesn't always supply one, and we need SOMETHING to base the default
 *  save on). Keys match SHIP_SLOTS. */
const FALLBACK_SHIP_CONFIG: ShipConfig = {
  hull: 'falcon',
  cockpit: 'falcon',
  wing_L: 'falcon',
  wing_R: 'falcon',
  engine_main: 'falcon',
  engine_aux: 'falcon',
  weapon_primary: 'falcon',
  weapon_secondary: 'falcon',
  shield: 'falcon',
  tail: 'falcon',
};

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
  /** Tracks free-space state across frames so we can snap the camera on
   *  the inside↔outside boundary instead of letting it lerp-chase the
   *  teleported ship position (which produced visible jerk). */
  private _wasFree = false;
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
  private freezeRemaining = 0;
  private flashEl: HTMLDivElement | null = null;
  private sparks!: ImpactSparks;
  private puzzle: Puzzle | null = null;
  private puzzleFlow: Flow | null = null;
  private pointerHandler: ((ev: PointerEvent) => void) | null = null;
  private lastHudFlow: Flow | null = null;

  // --- Ship-builder-driven health / shield / boost state ---
  private readonly builderResult: ShipBuilderResult | null;
  private hp: number;
  private maxHp: number;
  private shield: number;
  private maxShield: number;
  private shieldRechargeTimer = 0; // counts down to 0 after any damage tick
  /** Reference to the shield bubble mesh inside the assembled ship group.
   *  Toggled visible/hidden every frame based on current shield energy so
   *  the bubble fades out when the shield is depleted and returns when it
   *  recharges. Null for the fallback ship (no shield slot). */
  private shieldMesh: Object3D | null = null;
  /** Normalised 0..1 boost energy; drains while boost held, refills on release. */
  private boostEnergy = 1;
  /** Edge-detect boost key so we only fire the ignition SFX on press, not
   *  on every held frame (otherwise the boost sound would loop at 60Hz). */
  private _wasBoosting = false;
  /** Latched "engine choked" state: set when boostEnergy bottoms out,
   *  cleared only after it has recharged past BOOST_READY_THRESHOLD so the
   *  thruster doesn't pop back to normal the instant the bar starts
   *  refilling. Passed to Ship via ShipUpdateContext so the flame visibly
   *  stumps until the reservoir is usable again. */
  private _boostDepleted = false;

  // --- Auto-save timer (every 30s in frame loop) ---
  private autoSaveTimer = 0;
  private static readonly AUTO_SAVE_INTERVAL = 30;

  // --- Free-space combat: meteorite field + player projectiles ---
  private meteorites: Meteorites | null = null;
  private projectiles: Projectiles | null = null;
  private explosions: ExplosionPool | null = null;
  /** Primary-weapon render kind, resolved once at start from the ship's
   *  `primaryType` (e.g. 'laser' → 'beam'). If the loadout changes mid-
   *  game (not currently possible), we'd refresh this from the new
   *  stats. Defaults to 'bolt' pre-init. */
  private weaponKind: WeaponKind = 'bolt';
  /** HUD reticle + lock brackets. Constructed once in `start()`. */
  private crosshair: Crosshair | null = null;
  /** Soft lock-on state machine: tracks the 2s dwell timer and feeds
   *  the target position back into `fireFromShipNose()` for aim-assisted
   *  shots. Independent of projectile type — every weapon gets assist. */
  private readonly aimAssist = new AimAssist();
  private aimState: AimAssistState = {
    targetScreen: null,
    targetWorld: null,
    dwell01: 0,
    locked: false,
  };
  /** Full save blob we mutate in place when a meteorite drop awards a ship
   *  part. Persisted via SaveManager.save(); keeping a single object around
   *  means the ship-parts progression and the existing HP/shield/puzzle
   *  state live in one source of truth. */
  private save: SaveData;

  // --- Vibe Jam 2026 portal webring ---
  private readonly portalQuery: PortalQuery;
  private readonly portals: PortalSystem;
  /** Hex color (no `#`) forwarded to the jam on exit. */
  private playerColor: string;
  /** Player handle forwarded on exit — inbound from ref site or 'voyager'. */
  private playerUsername: string;

  constructor(
    canvas: HTMLCanvasElement,
    renderer: WebGLRenderer,
    builderResult: ShipBuilderResult | null = null,
    portalQuery: PortalQuery = parsePortalQuery(),
    loadedSave?: SaveData,
  ) {
    // Renderer comes from main.ts so the builder and gameplay share one GL
    // context. The canvas arg is the same element attached to the renderer —
    // we keep it for parity with the previous API.
    void canvas;
    this.renderer = renderer;
    this.builderResult = builderResult;

    // Derive HP/shield caps from the loadout (or the default fallback stats).
    const stats = builderResult?.stats ?? DEFAULT_SHIP_STATS;
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.maxShield = stats.maxShield;
    this.shield = stats.maxShield;

    // Restore persisted HP/shield/boost when resuming from a save.
    if (loadedSave) {
      this.hp = Math.max(1, Math.min(this.maxHp, loadedSave.hp));
      this.shield = Math.max(0, Math.min(this.maxShield, loadedSave.shield));
      this.boostEnergy = Math.max(0, Math.min(1, loadedSave.boostEnergy));
    }

    // Source-of-truth save blob, mutated in place when a meteorite drop
    // awards a ship part. Persisted by `saveProgress()`. When no save
    // exists yet we manufacture a default one so the rest of the game can
    // rely on `this.save` being populated (e.g. the drop-to-part hand-off).
    this.save =
      loadedSave ??
      SaveManager.defaultSave(
        builderResult?.config ?? FALLBACK_SHIP_CONFIG,
        builderResult?.stats ?? DEFAULT_SHIP_STATS,
      );

    // Apply inbound portal state (clamped): a friend arriving at half HP
    // should keep that damage so the webring feels continuous. Color &
    // username carry through so the exit URL can forward them onward.
    this.portalQuery = portalQuery;
    if (portalQuery.fromPortal && portalQuery.hp != null) {
      this.hp = Math.max(1, Math.min(this.maxHp, portalQuery.hp));
    }
    this.playerColor = normaliseColorHex(portalQuery.color) ?? '5fc8ff';
    this.playerUsername = portalQuery.username ?? 'voyager';
    this.portals = new PortalSystem(portalQuery);

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
        // Bright two-tone chime on every orb grab — matches the visual
        // spark burst and reinforces the loop without fighting the score.
        getAudio().playPickup();
      },
      onEraComplete: (flow) => this.onEraComplete(flow),
    });

    // Restore per-era puzzle progress from saved data.
    if (loadedSave) {
      for (const flow of this.flowManager.flows) {
        const saved = loadedSave.puzzleStages[flow.era.id as EraId];
        if (saved != null) flow.puzzleStage = saved;
      }
    }

    // HUD initially displays Egypt (the anchor flow).
    this.currentHudEra = this.flowManager.flows[0].era;
    this.scene.fog = new Fog(this.currentHudEra.palette.fog, 40, 220);
    this._fogInside.setHex(this.currentHudEra.palette.fog);

    this.skybox = new Skybox(this.currentHudEra);
    this.scene.add(this.skybox.mesh);

    this.celestial = new CelestialGods();
    this.scene.add(this.celestial.group);

    // Ship model is assembled asynchronously in start() once the GLB parts
    // for this loadout have loaded (they're already cached by the builder
    // prefetch). The Ship instance exists synchronously so `this.ship` is
    // usable from HUD wiring; the model is attached later before `init()`.
    this.ship = new Ship(stats);

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
    this.hud.setWeapons(stats.primaryType, stats.secondaryType);
    this.hud.updateHpShield(this.hp, this.maxHp, this.shield, this.maxShield);
    this.hud.setBoostReady(1);

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

    // If we have a builder result, assemble the modular ship before init so
    // the player sees the exact loadout they configured. The GLB parts are
    // already in the ShipAssembly cache from the builder prefetch, so this
    // resolves in one frame with no network.
    if (this.builderResult) {
      const assembly = await assembleShip(this.builderResult.config);
      // Pass the engine class + slot so Ship.init() can mount a per-class
      // propulsion flame at the nozzle. Different engine loadouts get
      // visibly different thruster colors, lengths, and pulse rhythms —
      // see Thruster.ts ENGINE_PALETTES for the per-class config.
      this.ship.useAssembledModel(
        assembly.group,
        this.builderResult.config.engine_main,
        assembly.slots.engine_main,
      );
      // Capture the shield bubble so we can fade it out when the energy
      // pool drops to zero and fade it back when it recharges.
      this.shieldMesh = assembly.slots.shield ?? null;
    }

    this.ship.init();
    this.sparks = new ImpactSparks(this.scene);
    this.celestial.init();
    this.flowManager.init(this.scene);

    // Free-space spawn: park the player OUTSIDE Egypt's corridor at a
    // radial distance that takes ≥5 seconds to cross even on the fastest
    // engine (viper's maxThrustSpeed ~85 u/s → 400 units / 85 ≈ 4.7s, so
    // radial = 500 gives boundary distance = 450 → ~5.3s at top speed,
    // ~10s on the slow golem). The ship's nose is oriented at Egypt's
    // origin so the corridor mouth reads as "ahead and down" — the
    // player's first input naturally pulls them into the tube.
    this.ship.spawn(new Vector3(0, 500, 200), new Vector3(0, 0, 0));

    // Re-seat the camera smoother at the new spawn so the first follow
    // frame doesn't visibly trail from world origin to (0, 500, 200).
    this._smoothCamPos.copy(this.ship.group.position).add(CAMERA_OFFSET);
    this.camera.position.copy(this._smoothCamPos);
    this.camera.lookAt(this.ship.group.position);

    // Apply inbound portal velocity/rotation now that the ship is real.
    this.applyInboundPortalState();

    // Mount the Vibe Jam portal(s). Visibility of the green exit torus is
    // controlled by the SHOW_EXIT_PORTAL feature flag in PortalSystem.ts —
    // inbound handling and the return portal stay active regardless.
    this.portals.init(this.scene);

    // Free-space combat — meteorites, projectiles, explosion VFX. All async
    // because the GLB models have to fetch before the pools can hand them
    // out; we do this AFTER `ship.spawn()` so the first spawn frame sees a
    // stable scene but BEFORE the frame loop so everything's ready on
    // tick one. If any init rejects we swallow the error and log — better
    // to lose combat than brick the game at launch.
    try {
      const explosions = new ExplosionPool();
      await explosions.init(this.scene);
      this.explosions = explosions;

      const meteorites = new Meteorites({
        onHitShip: (damage) => this.onMeteoriteHit(damage),
        onDestroyed: (position, scale, type) =>
          this.onMeteoriteDestroyed(position, scale, type),
        onDrop: (position, type) => this.onMeteoriteDrop(position, type),
      });
      await meteorites.init(this.scene);
      this.meteorites = meteorites;

      const projectiles = new Projectiles();
      projectiles.init(this.scene);
      this.projectiles = projectiles;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Game] combat init failed', err);
    }

    // Resolve the primary weapon's render kind from the ship's stats. A
    // Falcon with `primaryType: 'laser'` gets `weaponKind = 'beam'`; a
    // Viper with `primaryType: 'pulse'` gets `'pulse'`; everything else
    // falls through to `'bolt'`. See src/gameplay/WeaponTypes.ts.
    const stats = this.builderResult?.stats ?? DEFAULT_SHIP_STATS;
    this.weaponKind = weaponKindFor(stats.primaryType);

    // HUD crosshair + soft lock-on reticle. Mounted into document.body so
    // it sits above the GL canvas but separate from `.hud` — that way a
    // `.hud--in-puzzle` toggle can hide the gameplay HUD while leaving
    // the reticle (also hidden by the puzzle gate in the frame loop).
    this.crosshair = new Crosshair(document.body);

    // Persist the initial state so a fresh run is saved immediately.
    this.saveProgress();

    this.lastTs = performance.now();
    requestAnimationFrame(this.frame);
  }

  /**
   * Copy incoming velocity + rotation from the portal query onto the Ship.
   * Called once after `ship.init()` so we overwrite the ship's default
   * resting pose with whatever the referring site handed us.
   */
  private applyInboundPortalState(): void {
    const q = this.portalQuery;
    if (!q.fromPortal) return;
    if (q.velocity) {
      this.ship.velocity.copy(q.velocity);
    }
    if (q.rotation) {
      this.ship.group.rotation.set(q.rotation.x, q.rotation.y, q.rotation.z);
    }
  }

  /** Build the ship snapshot the PortalSystem forwards on exit. */
  private snapshotShipState = (): ShipSnapshot => ({
    position: this.ship.group.position,
    velocity: this.ship.velocity,
    rotation: new Vector3(
      this.ship.group.rotation.x,
      this.ship.group.rotation.y,
      this.ship.group.rotation.z,
    ),
    hp: this.hp,
    color: this.playerColor,
    username: this.playerUsername,
  });

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
    this.freezeRemaining = CRASH_FREEZE_DURATION;
    this.ensureFlashEl().style.opacity = '1';

    // Spark burst at obstacle world position (local->world: quat * local + origin).
    const hitWorld = this._scratchC
      .copy(hit.mesh.position)
      .applyQuaternion(flow.quaternion)
      .add(flow.origin);
    this.sparks.emit(hitWorld, 40);

    // Fling the obstacle. Positions/velocities are passed in flow-local frame
    // so the angular + linear response reads correctly regardless of tilt.
    flow.worldToLocalPoint(this.ship.group.position, this._scratchLocalShip);
    const localVel = this._scratchF
      .copy(this.ship.velocity)
      .applyQuaternion(flow.inverseQuaternion);
    flow.track.hitImpact(hit, this._scratchLocalShip, localVel);
    this.ship.stun();

    // Damage model: base - armor (floored), applied to shield first, then HP.
    const stats = this.builderResult?.stats ?? DEFAULT_SHIP_STATS;
    let dmg = Math.max(CRASH_MIN_DAMAGE, CRASH_BASE_DAMAGE - stats.armor);
    let shieldAbsorbed = false;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
      if (absorbed > 0) shieldAbsorbed = true;
    }
    if (dmg > 0) this.hp -= dmg;
    // SFX reads the outcome: if the shield took any piece of the hit, fire
    // the high-pitched zap; if damage bled through to HP, fire the heavier
    // thump too. Both can play in the same frame (partial-absorb case) —
    // that's musically correct for "shield dropped AND hull took damage".
    if (shieldAbsorbed) getAudio().playShieldHit();
    if (dmg > 0) getAudio().playCrash();
    // Any damage pauses shield regen for its full delay.
    this.shieldRechargeTimer = stats.shieldRechargeDelay;

    if (this.hp <= 0) {
      // Death: refill HP and zero the shield so the failure state keeps the
      // existing "stay playing" loop instead of a hard game-over. The cost
      // of dying is losing every collectible acquired in the current flow —
      // a clean, legible penalty that resets era progress without kicking
      // the player back to the menu.
      this.hp = this.maxHp;
      this.shield = 0;
      if (HP_RESET_DEDUCT_ANKH) {
        let lost = false;
        // Drain the whole flow's collection counter. Each call to
        // `losePickup()` ticks the count down by one and fires the HUD
        // update event; we flash the loss indicator once at the end so the
        // screen doesn't strobe N times for a multi-pickup purge.
        while (flow.collectibles.losePickup()) lost = true;
        if (lost) this.hud.flashAnkhLoss();
      }
      this.saveProgress();
    }
    this.hud.updateHpShield(this.hp, this.maxHp, this.shield, this.maxShield);
    this.hud.flashHit();
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

  /**
   * Passive regen each frame: shield recharges after `shieldRechargeDelay`
   * seconds of no-damage at `shieldRechargeRate` HP/s; hull slowly ticks
   * back if the loadout has bio-regen (mantis hull / shield).
   */
  private regenerate(dt: number): void {
    const stats = this.builderResult?.stats ?? DEFAULT_SHIP_STATS;
    if (this.shieldRechargeTimer > 0) {
      this.shieldRechargeTimer = Math.max(0, this.shieldRechargeTimer - dt);
    } else if (this.shield < this.maxShield) {
      this.shield = Math.min(
        this.maxShield,
        this.shield + stats.shieldRechargeRate * dt,
      );
    }
    if (stats.hpRegen > 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + stats.hpRegen * dt);
    }
  }

  /** Update the boost-readiness bar (cosmetic drain + refill loop). */
  private updateBoostEnergy(dt: number, boosting: boolean): void {
    const stats = this.builderResult?.stats ?? DEFAULT_SHIP_STATS;
    if (boosting) {
      const drain = 1 / Math.max(0.5, stats.boostDuration);
      this.boostEnergy = Math.max(0, this.boostEnergy - drain * dt);
    } else {
      const refill = 1 / Math.max(0.5, stats.boostCooldown);
      this.boostEnergy = Math.min(1, this.boostEnergy + refill * dt);
    }
  }

  private ensureFlashEl(): HTMLDivElement {
    if (this.flashEl) return this.flashEl;
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,rgba(255,40,40,0.7),rgba(200,0,0,0.4) 45%,rgba(0,0,0,0) 75%);opacity:0;transition:opacity 120ms ease-out;z-index:999;mix-blend-mode:screen;';
    document.body.appendChild(el);
    this.flashEl = el;
    return el;
  }

  /** Flow reached 10 ankhs — trigger checkpoint puzzle for that flow's era. */
  private onEraComplete(flow: Flow): void {
    if (this.puzzle) return; // already in a puzzle
    this.won = true;
    this.hud.showWin();
    // Bright C-E-G fanfare tells the player the corridor is cleared before
    // the puzzle overlay slides in — 1.4s later is enough breathing room
    // for the arpeggio to finish without stepping on puzzle audio.
    getAudio().playEraComplete();
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

    // Let the player bail back to the galaxy map if the checkpoint is too
    // tough or they just want to free-fly again. Abandoning does NOT
    // advance puzzleStage, so the same puzzle will be waiting when they
    // re-enter the corridor and collect 10 ankhs again.
    this.hud.showExitButton(() => this.abandonPuzzle());
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
    this.hud.hideExitButton();

    flow.puzzleStage = (flow.puzzleStage + 1) as 0 | 1 | 2;
    this.saveProgress();

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
    // Full heal on checkpoint success, so the player starts the next
    // stage at fighting strength rather than carrying forward damage.
    this.hp = this.maxHp;
    this.shield = this.maxShield;
    this.shieldRechargeTimer = 0;
    this.hud.updateHpShield(this.hp, this.maxHp, this.shield, this.maxShield);
    this.hud.updateOrbCount(0, ORB_TARGET);
    this.won = false;
    this.puzzleFlow = null;
    this._smoothCamPos.copy(this.ship.group.position).add(CAMERA_OFFSET);
    this.camera.position.copy(this._smoothCamPos);
  }

  /**
   * Bail out of the active checkpoint puzzle WITHOUT solving it. Triggered
   * by the HUD's "Return to map" button. The player is returned to the
   * free-space view near Egypt (same spawn used at game start) and the
   * flow's puzzleStage is NOT advanced — so the exact same checkpoint is
   * waiting the next time they collect 10 ankhs in that corridor.
   *
   * Collectibles are reset too, because the flow already cleared them when
   * the checkpoint fired; without the reset the player would re-enter the
   * corridor and find it empty.
   */
  private abandonPuzzle(): void {
    if (!this.puzzle || !this.puzzleFlow) return;
    const flow = this.puzzleFlow;
    this.scene.remove(this.puzzle.group);
    this.puzzle.dispose();
    this.puzzle = null;
    this.hud.hideExitButton();

    // Restore the world. puzzleStage is intentionally NOT incremented —
    // abandoning is a bail-out, not a success.
    this.ship.group.visible = true;
    this.flowManager.setAllVisible(true);
    this.skybox.mesh.visible = true;
    this.celestial.group.visible = true;
    flow.resetCollectibles();
    this.hud.updateOrbCount(0, ORB_TARGET);
    this.hud.hideWin();
    this.won = false;
    this.puzzleFlow = null;

    // Drop the player back where the game starts — free space above Egypt,
    // a few seconds' flight from the corridor entrance. Using ship.spawn()
    // sets wasFree=true so the first frame doesn't snap them back into the
    // corridor tube they were just inside.
    this.ship.spawn(new Vector3(0, 500, 200), new Vector3(0, 0, 0));
    this._smoothCamPos.copy(this.ship.group.position).add(CAMERA_OFFSET);
    this.camera.position.copy(this._smoothCamPos);
    this.camera.lookAt(this.ship.group.position);
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

  /**
   * Persist current game state to localStorage. Called automatically every
   * 30 s from the frame loop, after puzzle completion, and on death reset.
   *
   * We mutate `this.save` in place — unlockedShips / shipParts are driven
   * by the meteorite-drop handlers, so by the time we hit this write those
   * fields already reflect the latest state. Only the "live" telemetry
   * (hp/shield/boost/puzzleStages) is refreshed from runtime fields here.
   */
  saveProgress(): void {
    if (!this.builderResult) return; // nothing meaningful to save
    const puzzleStages = {} as Record<EraId, 0 | 1 | 2>;
    for (const flow of this.flowManager.flows) {
      puzzleStages[flow.era.id as EraId] = flow.puzzleStage;
    }
    this.save.shipConfig = this.builderResult.config;
    this.save.shipStats = this.builderResult.stats;
    this.save.puzzleStages = puzzleStages;
    this.save.hp = this.hp;
    this.save.shield = this.shield;
    this.save.boostEnergy = this.boostEnergy;
    SaveManager.save(this.save);
  }

  // ---------------------------------------------------------------
  //  Free-space combat callbacks (meteorite ↔ ship)
  // ---------------------------------------------------------------

  /**
   * Meteorite collided with the ship. Mirrors the corridor-crash damage
   * path: shield-first, then HP bleeds through, invuln window + stun to
   * sell the impact. No armor subtraction here (meteorites in free space
   * don't go through the CRASH_BASE_DAMAGE armor reduction — it's raw
   * touch damage from the config).
   *
   * Death penalty: meteorite kills forfeit ONE collected ship-part from
   * a random in-progress class. If the player has no parts at all,
   * death is "free" — HP just refills. Design rationale: the risk of
   * flying through the belt is concrete and proportional to what the
   * player has already earned, not a flat setback that hurts new
   * pilots as much as veterans.
   */
  private onMeteoriteHit(damage: number): void {
    if (this.invuln > 0) return;
    const absorbed = Math.min(this.shield, damage);
    this.shield -= absorbed;
    const leftover = damage - absorbed;
    if (leftover > 0) this.hp = Math.max(0, this.hp - leftover);
    if (absorbed > 0) getAudio().playShieldHit();
    if (leftover > 0) getAudio().playCrash();
    this.shieldRechargeTimer = 0;
    this.invuln = INVULN_AFTER_CRASH;
    this.ship.stun();
    this.shakeRemaining = CRASH_SHAKE_DURATION;
    this.flashRemaining = CRASH_FLASH_DURATION;
    if (this.flashEl) this.flashEl.style.opacity = '1';
    this.hud.flashHit();

    // Death check. HP is already clamped to 0 above; at zero we refill
    // and try to dock a ship-part. If none are owed, the penalty is
    // silently skipped — a fresh player doesn't get double-punished for
    // a first-fight death with no inventory to lose.
    if (this.hp <= 0) {
      this.hp = this.maxHp;
      this.shield = 0;
      const lost = SaveManager.deductPart(this.save);
      if (lost) {
        this.saveProgress();
        getAudio().playCrash();
        this.showUnlockToast(
          `Lost a piece of ${lost.cls.toUpperCase()} · ${lost.count}/${SHIP_PART_UNLOCK_THRESHOLD}`,
          'part',
        );
      }
    }
    this.hud.updateHpShield(this.hp, this.maxHp, this.shield, this.maxShield);
  }

  /**
   * Meteorite finally died (projectile or ship impact). Plays the 5-phase
   * VFX + proportional camera shake so the burst is tactile. `type` is
   * forwarded in case a future patch wants per-type drops (e.g. crystal
   * gives a brighter flash).
   */
  private onMeteoriteDestroyed(
    position: Vector3,
    scale: number,
    type: MeteoriteType,
  ): void {
    void type;
    if (this.explosions) this.explosions.play(position, scale);
    const dist = position.distanceTo(this.ship.group.position);
    const proximity = Math.max(0, 1 - dist / 120);
    if (proximity > 0.05) {
      // Blend into the existing shake timer rather than overwriting — if
      // two rocks blow up back-to-back the shake should compound briefly,
      // not reset to the less-recent impact's proximity.
      this.shakeRemaining = Math.max(
        this.shakeRemaining,
        CRASH_SHAKE_DURATION * 0.4 * proximity,
      );
    }
  }

  /**
   * Meteorite dropped a ship-part reward. Awards it to a random still-
   * locked ship class. When that class crosses the unlock threshold we
   * persist immediately and pop a toast so the player knows the hangar
   * just gained a slot.
   */
  private onMeteoriteDrop(position: Vector3, type: MeteoriteType): void {
    void position;
    void type;
    const lockedClass = SaveManager.pickRandomLockedClass(this.save);
    if (!lockedClass) return; // every ship already unlocked — nothing to award
    const result = SaveManager.awardPart(lockedClass, this.save);
    this.saveProgress();
    // Toast: "Part collected · <class> 2/10" or the unlock flourish.
    if (result.unlocked) {
      getAudio().playEraComplete();
      this.showUnlockToast(`Ship unlocked: ${lockedClass.toUpperCase()}`, 'unlock');
    } else {
      getAudio().playPickup();
      this.showUnlockToast(
        `Part collected · ${lockedClass.toUpperCase()} ${result.count}/${SHIP_PART_UNLOCK_THRESHOLD}`,
        'part',
      );
    }
  }

  /**
   * Brief HUD toast for part-drop / ship-unlock feedback. Builds a single
   * reused DOM element on first call, then just updates its text and
   * fades it in/out per call. Not worth a full HUD method — toasts are
   * the only consumer and a 20-line helper keeps Game.ts self-contained.
   */
  private unlockToastEl: HTMLDivElement | null = null;
  private unlockToastTimer: ReturnType<typeof setTimeout> | null = null;
  private showUnlockToast(message: string, kind: 'part' | 'unlock'): void {
    if (!this.unlockToastEl) {
      const el = document.createElement('div');
      el.style.cssText =
        'position:fixed;top:70px;left:50%;transform:translateX(-50%);padding:10px 22px;background:rgba(6,10,22,0.85);border:1px solid rgba(95,180,255,0.45);border-bottom:3px solid #5fc8ff;border-radius:4px;color:#e6faff;font-family:\'Rajdhani\',system-ui,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.1em;backdrop-filter:blur(10px);z-index:45;pointer-events:none;opacity:0;transition:opacity 180ms ease-out;text-align:center;';
      document.body.appendChild(el);
      this.unlockToastEl = el;
    }
    const el = this.unlockToastEl;
    el.textContent = message;
    // Unlock toasts get a warmer accent to signal the bigger moment.
    el.style.borderBottomColor = kind === 'unlock' ? '#ffd27f' : '#5fc8ff';
    el.style.opacity = '1';
    if (this.unlockToastTimer) clearTimeout(this.unlockToastTimer);
    this.unlockToastTimer = setTimeout(() => {
      if (this.unlockToastEl) this.unlockToastEl.style.opacity = '0';
    }, kind === 'unlock' ? 3400 : 1800);
  }

  /**
   * Pull the primary-weapon trigger this frame. Originates at the ship's
   * nose, along its forward axis, with optional aim-assist blending
   * toward a soft-locked meteorite. Projectiles rate-limits internally
   * per weapon kind, so calling this every frame while `input.fire` is
   * held just translates to the per-kind fire rate (beam=5/s, pulse=6.6/s,
   * bolt=11/s).
   */
  private readonly _fireOrigin = new Vector3();
  private readonly _fireForward = new Vector3();
  private readonly _fireDirection = new Vector3();
  private fireFromShipNose(): void {
    if (!this.projectiles || !this.meteorites) return;
    this._fireForward.set(0, 0, -1).applyQuaternion(this.ship.group.quaternion);
    this._fireOrigin.copy(this.ship.group.position).addScaledVector(this._fireForward, 2.0);
    // Blend fire direction toward the locked target if assist is armed;
    // otherwise ship-forward. Writes into `_fireDirection` in place so
    // we never allocate a new Vector3 inside the hot-path trigger.
    this.aimAssist.applyAssist(
      this._fireOrigin,
      this._fireForward,
      this.aimState.locked,
      this.aimState.targetWorld,
      this._fireDirection,
    );
    this.projectiles.pullTrigger(
      this._fireOrigin,
      this._fireDirection,
      this.ship.velocity,
      this.weaponKind,
      this.meteorites,
    );
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
    // Swap the era music to match. AudioManager crossfades across
    // FADE_SECONDS and respects the current outside factor so a mid-free-
    // space flyby from one corridor's influence zone to another's fades
    // tracks without spiking either one to full volume.
    getAudio().setActiveEra(flow.era.id);
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

    // Freeze-frame (hit-stop): while the timer is positive, decrement it
    // but skip all game updates. Only flash/shake/sparks and render proceed
    // so the scene hangs for ~60 ms on impact, selling the hit.
    if (this.freezeRemaining > 0) {
      this.freezeRemaining = Math.max(0, this.freezeRemaining - dt);
      // Still update flash + shake + sparks + render during freeze.
      this.sparks.update(dt);
      if (this.flashRemaining > 0) {
        this.flashRemaining = Math.max(0, this.flashRemaining - dt);
        if (this.flashRemaining === 0 && this.flashEl) {
          this.flashEl.style.opacity = '0';
        }
      }
      if (this.shakeRemaining > 0) {
        this.shakeRemaining = Math.max(0, this.shakeRemaining - dt);
        const s = this.shakeRemaining / CRASH_SHAKE_DURATION;
        const amp = CRASH_SHAKE_MAX * Math.exp(-4 * (1 - s));
        this.camera.position.x += (Math.random() * 2 - 1) * amp;
        this.camera.position.y += (Math.random() * 2 - 1) * amp;
        this.camera.rotation.z += (Math.random() * 2 - 1) * 0.02 * Math.exp(-4 * (1 - s));
      }
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
      const input = getInput();
      this.ship.update(dt, input, {
        outsideFactor: outside,
        flowAxis: activeFlow.axis,
        flowQuaternion: activeFlow.quaternion,
        flowOrigin: activeFlow.origin,
        localShipPos: this._scratchLocalShip,
        boostDepleted: this._boostDepleted,
      });
      if (this.invuln > 0) this.invuln -= dt;
      this.checkCollisions();
      // Regen + boost bookkeeping run every frame regardless of the puzzle
      // state — they drive the HUD, and pausing them would desync readouts.
      this.regenerate(dt);
      const boostingNow = input.boost && this.boostEnergy > 0;
      this.updateBoostEnergy(dt, boostingNow);
      // Depleted-state latch. Flip on at empty so the thruster chokes
      // visibly; flip off only after the bar refills past the "usable"
      // threshold so we don't pop between states on single-frame recharge
      // jitter. Reads on the ship next frame via ctx.boostDepleted.
      if (this.boostEnergy <= 0) this._boostDepleted = true;
      else if (this.boostEnergy >= BOOST_READY_THRESHOLD) this._boostDepleted = false;
      // Edge-trigger: play the rising whoosh once when boost kicks in, not
      // every frame it's held. Released-then-pressed re-arms the SFX.
      if (boostingNow && !this._wasBoosting) getAudio().playBoost();
      this._wasBoosting = boostingNow;
      // Shield bubble visible only while there is energy to spend. The
      // regen loop above brings `shield` back above 0 after the delay, at
      // which point the bubble reappears automatically.
      if (this.shieldMesh) this.shieldMesh.visible = this.shield > 0;
      this.hud.updateHpShield(this.hp, this.maxHp, this.shield, this.maxShield);
      this.hud.setBoostReady(this.boostEnergy);

      // Free-space combat tick. Meteorites only spawn when outside a
      // corridor (`freeSpaceOnly` in the config) — we gate via
      // outsideFactor rather than `activeFlow == null` because the flow
      // manager always has an "active" flow (nearest), but outsideFactor
      // > 0.7 means we're meaningfully in open space. Projectiles update
      // every frame regardless so bullets fired inside the corridor still
      // fly and despawn on range.
      if (this.meteorites) {
        const canSpawn = outside > 0.7;
        this.meteorites.update(dt, this.ship.group.position, this.ship.velocity, canSpawn);

        // Aim-assist scan runs every frame the meteorites do — it's the
        // only thing that reads the meteorite array for screen-space
        // purposes, so co-locating keeps cache hot.
        const forward = this._scratchG
          .set(0, 0, -1)
          .applyQuaternion(this.ship.group.quaternion);
        this.aimState = this.aimAssist.update(
          dt,
          this.ship.group.position,
          forward,
          this.camera,
          this.meteorites,
        );
        if (this.crosshair) {
          this.crosshair.update(
            this.aimState.targetScreen,
            this.aimState.dwell01,
            this.aimState.locked,
          );
        }
      }
      if (this.projectiles) {
        if (input.fire) this.fireFromShipNose();
        if (this.meteorites) this.projectiles.update(dt, this.meteorites);
      }
      if (this.explosions) this.explosions.update(dt);
    }

    // Vibe Jam portal tick — spins rings, twinkles particles, and if the
    // ship flies through one, builds the forwarding URL from the current
    // snapshot and hard-redirects to the jam webring (or back to the
    // referring site for the return portal).
    this.portals.update(dt, this.ship.group.position, this.snapshotShipState);

    // HUD / sky / lighting follow active flow.
    this.applyHudForActiveFlow();

    // Music crossfade: inside corridor → active-era track, free space →
    // Tokyo Rifft score. AudioManager early-outs when the factor hasn't
    // moved >1% so this is effectively free on steady-state frames.
    getAudio().setOutsideFactor(outside);

    this.skybox.setOutsideFactor(outside);
    this.skybox.setFlowOrientation(activeFlow.inverseQuaternion);
    this.celestial.setInsideFactor(1 - outside);
    this.updateFog(outside);
    // NOTE: celestial.update moved below to run AFTER the camera-follow
    // step. Calling it here meant the gods used last frame's camera
    // position (which still included last frame's random shake jitter) —
    // result: visibly shaky/stuttering figures in the sky. We now anchor
    // them to the clean, shake-free `_smoothCamPos` computed this frame.
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
    // On the inside↔outside boundary the ship teleports (see Ship.ts exit
    // snap), so chase-smoothing the camera would trail the jump for ~1/6s
    // and register as jerk. Snap instead, then resume smoothing.
    const freeNow = outside > 0.5;
    if (freeNow !== this._wasFree) {
      this._smoothCamPos.copy(target);
    } else {
      this._smoothCamPos.lerp(target, Math.min(1, dt * 6));
    }
    this._wasFree = freeNow;
    this.camera.position.copy(this._smoothCamPos);

    // Celestial pantheon update — AFTER `_smoothCamPos` is settled but
    // BEFORE the random camera shake below. The gods anchor to the
    // smooth (shake-free) position so they stay rock-steady in world
    // space; the subsequent shake perturbs the camera view, producing
    // natural parallax rather than the figures dancing with every
    // random offset.
    this.celestial.update(dt, this._smoothCamPos, activeFlow.quaternion);

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
      const amp = CRASH_SHAKE_MAX * Math.exp(-4 * (1 - s));
      this.camera.position.x += (Math.random() * 2 - 1) * amp;
      this.camera.position.y += (Math.random() * 2 - 1) * amp;
      // Rotational jitter — subtle roll wobble that decays with the shake.
      this.camera.rotation.z += (Math.random() * 2 - 1) * 0.02 * Math.exp(-4 * (1 - s));
    }
    this.camera.lookAt(lookTarget);

    this.skybox.mesh.position.copy(this.camera.position);

    // HUD speedometer + distance — distance = |axial progress through active flow|.
    const latSpeed = Math.hypot(this.ship.velocity.x, this.ship.velocity.y) + 40;
    const distance = Math.max(0, -this._scratchLocalShip.z);
    this.hud.update(dt, latSpeed, distance);

    // Periodic auto-save (every 30 s) — simple dt accumulator, no setInterval.
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= Game.AUTO_SAVE_INTERVAL) {
      this.autoSaveTimer = 0;
      this.saveProgress();
    }

    // Tick impact spark particles.
    this.sparks.update(dt);

    this.composer.render(dt);
    requestAnimationFrame(this.frame);
  };
}

/**
 * Accept the three color formats the jam spec allows (`#RRGGBB`, `RRGGBB`,
 * `0xRRGGBB`) and return a bare hex string with no prefix. Returns null
 * when the input can't be interpreted — callers fall back to the default.
 */
function normaliseColorHex(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (s.startsWith('#')) s = s.slice(1);
  else if (s.startsWith('0x') || s.startsWith('0X')) s = s.slice(2);
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(s)) return null;
  if (s.length === 3) {
    s = s
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return s.toLowerCase();
}
