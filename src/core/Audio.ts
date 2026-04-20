import type { EraId } from '../eras/eras.ts';

/**
 * Game-wide audio manager — music + SFX on a single shared `AudioContext`.
 *
 * ## Music model
 *
 * There are two logical "music slots" the player ever hears simultaneously:
 *  1. **Space** — the Tokyo Rifft track, plays while the ship is in free
 *     space between the ten era corridors (builder screen + galaxy map view).
 *  2. **Active era** — the Math-vs-Time era track that matches whichever
 *     corridor the ship is currently inside or closest to.
 *
 * Both slots are crossfaded by a single `outsideFactor` parameter in [0, 1]:
 * at 0 the active-era track is at full volume and the space track is silent,
 * at 1 the reverse. We ramp the gains along an equal-power curve via
 * WebAudio's `linearRampToValueAtTime` so there's no hard cut or gap when
 * the ship crosses the corridor boundary.
 *
 * All 11 MP3s (10 eras + 1 space) each live in their own `<audio>` element
 * wired through a `MediaElementAudioSourceNode` to a per-track `GainNode`
 * that feeds the music bus. Non-active era tracks sit muted but still
 * playing so the loop point is continuous — when you re-enter Egypt two
 * minutes later, the track is where it would have been if it never
 * stopped, avoiding that "music restart" feel common to web games.
 *
 * ## SFX
 *
 * Short one-shot sounds are synthesised in WebAudio (oscillators + noise
 * buffers + envelopes) rather than loaded as samples. This keeps the
 * download small, avoids licensing, and gives a consistent "sci-fi UI"
 * timbre that matches the game's aesthetic. Each call to `playPickup()`
 * etc. creates fresh nodes, plays them, and lets them garbage-collect
 * themselves once the envelope closes.
 *
 * ## Autoplay unlock
 *
 * Browsers block `AudioContext` until a user gesture. `unlock()` resumes
 * the context; we wire it to the very first click / keydown on the page
 * so the builder's background music starts when the player first
 * interacts with any control.
 */

type MusicId = EraId | 'space';

interface LoadedTrack {
  el: HTMLAudioElement;
  gain: GainNode;
  /** Whether we've called `.play()` on this element at least once. Used to
   *  defer the initial play until after the audio context unlocks. */
  started: boolean;
}

/** Absolute paths (Vite serves `public/` at the root). */
const MUSIC_URLS: Record<MusicId, string> = {
  space: '/audio/space.mp3',
  egypt: '/audio/era_egypt.mp3',
  greece: '/audio/era_greece.mp3',
  china: '/audio/era_china.mp3',
  islamic: '/audio/era_islamic.mp3',
  india: '/audio/era_india.mp3',
  renaissance: '/audio/era_renaissance.mp3',
  edo: '/audio/era_edo.mp3',
  enlightenment: '/audio/era_enlightenment.mp3',
  revolution: '/audio/era_revolution.mp3',
  codebreakers: '/audio/era_codebreakers.mp3',
};

/** Default mix levels — conservative because the music must never mask
 *  UI clicks or a crash SFX that tells the player they just lost HP. */
const MUSIC_VOLUME = 0.55;
const SFX_VOLUME = 0.6;
/** Crossfade duration when swapping the active era or when the ship
 *  transitions across the corridor boundary. Long enough to feel musical,
 *  short enough that the galaxy-map view doesn't sit in a silent pocket. */
const FADE_SECONDS = 0.6;

export class AudioManager {
  private ctx: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;

  private tracks: Partial<Record<MusicId, LoadedTrack>> = {};
  /** Currently-active era track id — the one whose gain tracks
   *  `(1 - outsideFactor)`. Null before any flow is chosen. */
  private activeEra: EraId | null = null;
  /** Last applied outside factor, so we don't re-ramp every frame when it
   *  hasn't moved. */
  private lastOutside = -1;
  /** Multiplier applied to the whole music bus so the builder can fade
   *  music in and the Game can pause everything at death if needed. */
  private musicMuteScale = 1;
  private unlocked = false;

  /**
   * Lazily construct the audio graph. Safe to call multiple times. The
   * context itself may be suspended until `unlock()` runs — the builder
   * calls this on boot so tracks start buffering immediately, and the
   * first user gesture then unsuspends playback.
   */
  init(): void {
    if (this.ctx) return;
    const AudioCtor = window.AudioContext || (window as unknown as {
      webkitAudioContext: typeof AudioContext;
    }).webkitAudioContext;
    this.ctx = new AudioCtor();
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = MUSIC_VOLUME;
    this.musicBus.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = SFX_VOLUME;
    this.sfxBus.connect(this.ctx.destination);

    // Preload every track in parallel. Using <audio> elements (vs
    // decodeAudioData buffers) keeps memory low for the 60MB combined
    // download — streams play as they arrive.
    for (const id of Object.keys(MUSIC_URLS) as MusicId[]) {
      this.loadTrack(id);
    }

    // First interaction unlocks: Safari/Chrome start the context suspended.
    const onFirstGesture = (): void => {
      this.unlock();
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    };
    window.addEventListener('pointerdown', onFirstGesture, { once: false });
    window.addEventListener('keydown', onFirstGesture, { once: false });
  }

  /** Resume the context (no-op if already running). Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (this.unlocked) return;
    this.unlocked = true;
    // Start the space track at zero gain immediately so we can ramp it in.
    // The active era will start when `setActiveEra` is first called.
    const space = this.tracks.space;
    if (space && !space.started) {
      space.el.play().catch(() => {
        /* ignore — some browsers reject play() even after resume */
      });
      space.started = true;
    }
  }

  private loadTrack(id: MusicId): void {
    if (!this.ctx || !this.musicBus) return;
    const el = new Audio(MUSIC_URLS[id]);
    el.loop = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el.volume = 1; // volume handled by GainNode; HTMLAudio volume stays 1
    const source = this.ctx.createMediaElementSource(el);
    const gain = this.ctx.createGain();
    gain.gain.value = 0; // silent until ramped up
    source.connect(gain);
    gain.connect(this.musicBus);
    this.tracks[id] = { el, gain, started: false };
  }

  /**
   * Set the era whose track matches the ship's current corridor. Called
   * whenever the `FlowManager.activeFlow` index changes. Crossfades out
   * the previous era (if any) and crossfades in the new one, respecting
   * the current `outsideFactor` so both sides of the crossfade respect
   * the inside/outside balance at the moment of the switch.
   */
  setActiveEra(eraId: EraId): void {
    if (!this.ctx || this.activeEra === eraId) return;
    const now = this.ctx.currentTime;

    // Fade out the outgoing era.
    if (this.activeEra) {
      const prev = this.tracks[this.activeEra];
      if (prev) this.rampTo(prev.gain, 0, now);
    }

    this.activeEra = eraId;
    const next = this.tracks[eraId];
    if (!next) return;
    if (!next.started) {
      next.el.play().catch(() => {});
      next.started = true;
    }
    // Target gain for the incoming era depends on where the ship currently
    // sits on the outside axis — if we're switching active flows while
    // sailing through free space, the new era should fade in to the same
    // low volume the old one was at, not to full.
    const inside = Math.max(0, 1 - Math.max(0, this.lastOutside));
    this.rampTo(next.gain, inside, now);
  }

  /**
   * Push a new `outsideFactor` in [0, 1]. 0 = ship inside a corridor,
   * 1 = ship in free space between flows. The space track fades up toward
   * full as the factor approaches 1, and the active-era track fades down.
   * Called every frame by Game; cheap because we early-out when the
   * factor hasn't meaningfully moved.
   */
  setOutsideFactor(f: number): void {
    if (!this.ctx) return;
    const clamped = Math.max(0, Math.min(1, f));
    if (Math.abs(clamped - this.lastOutside) < 0.01) return;
    this.lastOutside = clamped;
    const now = this.ctx.currentTime;

    const space = this.tracks.space;
    if (space) this.rampTo(space.gain, clamped, now);

    if (this.activeEra) {
      const active = this.tracks[this.activeEra];
      if (active) this.rampTo(active.gain, 1 - clamped, now);
    }
  }

  /**
   * Convenience for the menu/builder: force full space music, zero era.
   * Called by ShipBuilder on mount so the player hears the Tokyo Rifft
   * track while configuring the ship.
   */
  playBuilderMusic(): void {
    if (!this.ctx) this.init();
    this.unlock();
    this.lastOutside = 1;
    const now = this.ctx?.currentTime ?? 0;
    const space = this.tracks.space;
    if (space) this.rampTo(space.gain, 1, now);
    if (this.activeEra) {
      const active = this.tracks[this.activeEra];
      if (active) this.rampTo(active.gain, 0, now);
    }
  }

  /** Duck all music by a given factor (0 = silence, 1 = full). Used so a
   *  crash SFX or puzzle dialog can poke through without fighting the
   *  score. Called sparingly. */
  setMusicMute(scale: number): void {
    if (!this.ctx || !this.musicBus) return;
    this.musicMuteScale = Math.max(0, Math.min(1, scale));
    this.musicBus.gain.setTargetAtTime(
      MUSIC_VOLUME * this.musicMuteScale,
      this.ctx.currentTime,
      0.08,
    );
  }

  private rampTo(gain: GainNode, target: number, now: number): void {
    // Cancel pending ramps so a rapid flip doesn't queue conflicting
    // automation points. `cancelScheduledValues` at `now` leaves any
    // ramp currently in flight intact; `setValueAtTime(currentValue)`
    // pins the start point so the linear ramp doesn't kink.
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(target, now + FADE_SECONDS);
  }

  /* ============================== SFX ================================== */

  /**
   * Ankh / collectible pickup: a two-tone rising chime. Bright enough to
   * read over thrust and ambient, short enough not to stack into a wall
   * of noise when the player grabs orbs in quick succession.
   */
  playPickup(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.7, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    env.connect(this.sfxBus);
    for (const [freq, offset] of [[880, 0], [1320, 0.08]] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + offset);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + offset + 0.18);
      osc.connect(env);
      osc.start(now + offset);
      osc.stop(now + 0.4);
    }
  }

  /**
   * Crash / full-HP damage: a low thud + short noise burst. Signals the
   * player took hull damage (vs shield-only hits which use the zap below).
   */
  playCrash(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    // Sub thump.
    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(140, now);
    thump.frequency.exponentialRampToValueAtTime(50, now + 0.25);
    const thumpEnv = ctx.createGain();
    thumpEnv.gain.setValueAtTime(0, now);
    thumpEnv.gain.linearRampToValueAtTime(0.9, now + 0.01);
    thumpEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    thump.connect(thumpEnv).connect(this.sfxBus);
    thump.start(now);
    thump.stop(now + 0.45);

    // Noise burst.
    const noise = this.makeNoiseBuffer(0.3);
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noise;
    const noiseEnv = ctx.createGain();
    noiseEnv.gain.setValueAtTime(0, now);
    noiseEnv.gain.linearRampToValueAtTime(0.55, now + 0.005);
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    const hp = ctx.createBiquadFilter();
    hp.type = 'lowpass';
    hp.frequency.value = 1800;
    noiseSrc.connect(hp).connect(noiseEnv).connect(this.sfxBus);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.3);
  }

  /**
   * Shield hit — short sharp zap indicating the shield absorbed a hit.
   * Higher-pitched, shorter tail than the crash so the two read as
   * different events in quick succession.
   */
  playShieldHit(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.18);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.45, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 3;
    osc.connect(bp).connect(env).connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Boost ignition: ascending swoosh with a noise layer — fires once when
   * the player activates the boost key, not every frame they hold it.
   */
  playBoost(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.3);
    const oscEnv = ctx.createGain();
    oscEnv.gain.setValueAtTime(0, now);
    oscEnv.gain.linearRampToValueAtTime(0.5, now + 0.04);
    oscEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(oscEnv).connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.4);

    const noise = this.makeNoiseBuffer(0.35);
    const ns = ctx.createBufferSource();
    ns.buffer = noise;
    const nEnv = ctx.createGain();
    nEnv.gain.setValueAtTime(0, now);
    nEnv.gain.linearRampToValueAtTime(0.3, now + 0.05);
    nEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 600;
    ns.connect(hp).connect(nEnv).connect(this.sfxBus);
    ns.start(now);
    ns.stop(now + 0.4);
  }

  /**
   * UI blip — builder dropdowns, preset buttons, launch. Soft and brief so
   * it doesn't fatigue during rapid loadout tweaking.
   */
  playUiClick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.22, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(env).connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /**
   * Era-complete fanfare — played when the player collects the tenth orb
   * in a corridor and triggers the checkpoint puzzle. A short three-note
   * rise so the handoff to the puzzle feels earned, not abrupt.
   */
  playEraComplete(): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5 E5 G5 — bright major
    notes.forEach((freq, i) => {
      const t = now + i * 0.14;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.5, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(env).connect(this.sfxBus!);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  /**
   * Build a short buffer of white noise for percussive SFX. Cached per
   * duration — in practice `playCrash` / `playBoost` use a handful of
   * standard lengths, so we keep the buffer pool tiny.
   */
  private _noiseCache: Map<number, AudioBuffer> = new Map();
  private makeNoiseBuffer(seconds: number): AudioBuffer {
    const key = Math.round(seconds * 100);
    const cached = this._noiseCache.get(key);
    if (cached) return cached;
    const ctx = this.ctx!;
    const len = Math.ceil(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseCache.set(key, buf);
    return buf;
  }
}

/** Module-level singleton — one audio graph per game session. */
let _instance: AudioManager | null = null;
export function getAudio(): AudioManager {
  if (!_instance) {
    _instance = new AudioManager();
    _instance.init();
  }
  return _instance;
}
