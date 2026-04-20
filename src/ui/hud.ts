/**
 * DOM overlay HUD. Era badge, speed/distance readout, sacred-orb counter,
 * and a checkpoint win overlay. Framework-free, single root.
 */

export class Hud {
  readonly root: HTMLDivElement;
  private eraLabel: HTMLDivElement;
  private eraSub: HTMLDivElement;
  private speedEl: HTMLDivElement;
  private distEl: HTMLDivElement;
  private orbCountEl: HTMLDivElement;
  private orbTargetEl: HTMLDivElement;
  private orbFillEl: HTMLDivElement;
  private orbIconEl: HTMLSpanElement;
  private heartsEl: HTMLDivElement;
  private heartSlots: HTMLSpanElement[] = [];
  private winEl: HTMLDivElement;
  private winVisible = false;

  constructor(parent: HTMLElement = document.body) {
    this.root = document.createElement('div');
    this.root.className = 'hud';

    // Era badge (top-left)
    const badge = document.createElement('div');
    badge.className = 'hud-badge';
    this.eraLabel = document.createElement('div');
    this.eraLabel.className = 'hud-era';
    this.eraSub = document.createElement('div');
    this.eraSub.className = 'hud-era-sub';
    badge.append(this.eraLabel, this.eraSub);

    // Readout (top-right)
    const readout = document.createElement('div');
    readout.className = 'hud-readout';
    this.speedEl = document.createElement('div');
    this.speedEl.className = 'hud-speed';
    this.distEl = document.createElement('div');
    this.distEl.className = 'hud-dist';
    this.heartsEl = document.createElement('div');
    this.heartsEl.className = 'hud-hearts';
    readout.append(this.speedEl, this.distEl, this.heartsEl);
    Hud.ensureHeartStyle();

    // Orb counter (bottom-center)
    const orb = document.createElement('div');
    orb.className = 'hud-orb';
    this.orbIconEl = document.createElement('span');
    this.orbIconEl.className = 'hud-orb-icon';
    this.orbIconEl.textContent = '\u2625'; // ☥ (ankh — key of life), default
    const orbNums = document.createElement('span');
    orbNums.className = 'hud-orb-nums';
    this.orbCountEl = document.createElement('div');
    this.orbCountEl.className = 'hud-orb-count';
    this.orbCountEl.textContent = '0';
    this.orbTargetEl = document.createElement('div');
    this.orbTargetEl.className = 'hud-orb-target';
    this.orbTargetEl.textContent = '/ 10';
    orbNums.append(this.orbCountEl, this.orbTargetEl);
    const orbBar = document.createElement('div');
    orbBar.className = 'hud-orb-bar';
    this.orbFillEl = document.createElement('div');
    this.orbFillEl.className = 'hud-orb-fill';
    orbBar.append(this.orbFillEl);
    orb.append(this.orbIconEl, orbNums, orbBar);

    // Win overlay (hidden by default)
    this.winEl = document.createElement('div');
    this.winEl.className = 'hud-win';
    this.winEl.innerHTML = `
      <div class="hud-win-kicker">CHECKPOINT</div>
      <div class="hud-win-title">ten relics recovered</div>
      <div class="hud-win-sub">the puzzle of the era awaits…</div>
    `;

    this.root.append(badge, readout, orb, this.winEl);
    parent.appendChild(this.root);
  }

  setEra(name: string, subtitle: string, accentHex: number): void {
    this.eraLabel.textContent = name;
    this.eraSub.textContent = subtitle;
    const hex = '#' + accentHex.toString(16).padStart(6, '0');
    document.documentElement.style.setProperty('--era-accent', hex);
  }

  setOrbTarget(target: number): void {
    this.orbTargetEl.textContent = `/ ${target}`;
  }

  setOrbIcon(char: string): void {
    this.orbIconEl.textContent = char;
  }

  updateHearts(halves: number, maxHalves: number): void {
    const slots = Math.ceil(maxHalves / 2);
    if (this.heartSlots.length !== slots) {
      this.heartsEl.innerHTML = '';
      this.heartSlots = [];
      for (let i = 0; i < slots; i++) {
        const span = document.createElement('span');
        span.className = 'hud-heart';
        this.heartsEl.appendChild(span);
        this.heartSlots.push(span);
      }
    }
    for (let i = 0; i < slots; i++) {
      const pairHalves = Math.max(0, Math.min(2, halves - i * 2));
      const slot = this.heartSlots[i];
      slot.classList.remove('full', 'half', 'empty');
      slot.classList.add(pairHalves === 2 ? 'full' : pairHalves === 1 ? 'half' : 'empty');
    }
    // Pulse the hearts briefly so the player notices the damage.
    this.heartsEl.classList.remove('hit');
    void this.heartsEl.offsetWidth;
    this.heartsEl.classList.add('hit');
  }

  flashAnkhLoss(): void {
    // Tint the ankh counter red for a beat so the player sees the loss.
    this.orbCountEl.classList.remove('lose');
    void this.orbCountEl.offsetWidth;
    this.orbCountEl.classList.add('lose');
  }

  private static styleInjected = false;
  private static ensureHeartStyle(): void {
    if (Hud.styleInjected) return;
    Hud.styleInjected = true;
    const s = document.createElement('style');
    s.textContent = `
      .hud-hearts{display:flex;gap:6px;margin-top:8px;justify-content:flex-end}
      .hud-heart{position:relative;display:inline-block;width:20px;height:18px;color:rgba(255,255,255,0.18);font-size:20px;line-height:1}
      .hud-heart::before,.hud-heart::after{content:'\\2665';position:absolute;left:0;top:0;font-size:20px;line-height:1}
      .hud-heart::before{color:rgba(255,255,255,0.18)}
      .hud-heart::after{color:#ff5064;text-shadow:0 0 6px #ff506488;overflow:hidden;width:0}
      .hud-heart.full::after{width:100%}
      .hud-heart.half::after{width:50%}
      .hud-hearts.hit{animation:hud-hearts-hit 0.36s ease-out}
      @keyframes hud-hearts-hit{0%{transform:scale(1)}40%{transform:scale(1.2)}100%{transform:scale(1)}}
      .hud-orb-count.lose{animation:hud-ankh-lose 0.7s ease-out}
      @keyframes hud-ankh-lose{0%{color:#ff5064;text-shadow:0 0 10px #ff506488}100%{}}
    `;
    document.head.appendChild(s);
  }

  updateOrbCount(collected: number, target: number): void {
    this.orbCountEl.textContent = String(collected);
    const pct = Math.max(0, Math.min(1, collected / target));
    this.orbFillEl.style.width = `${pct * 100}%`;
    if (collected > 0) {
      this.orbCountEl.classList.remove('pulse');
      // Re-trigger the CSS animation
      void this.orbCountEl.offsetWidth;
      this.orbCountEl.classList.add('pulse');
    }
  }

  update(_dt: number, speed: number, distance: number): void {
    this.speedEl.textContent = `${Math.round(speed)} u/s`;
    this.distEl.textContent = `${Math.round(distance)} m`;
  }

  showWin(): void {
    if (this.winVisible) return;
    this.winVisible = true;
    this.winEl.classList.add('visible');
  }

  hideWin(): void {
    this.winVisible = false;
    this.winEl.classList.remove('visible');
  }
}
