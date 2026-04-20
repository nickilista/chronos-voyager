/**
 * Cinematic intro / story screen.
 * Pure DOM overlay — no Three.js needed.
 * Resolves when the player clicks or presses any key.
 */

const GOLD = '#ffd27f';
const FONT = "'Rajdhani', 'Segoe UI', system-ui, sans-serif";

const STORY_LINES = [
  'Deep in space, <em>10 wormholes</em> have opened,',
  'each one leading to a historical era that shaped mathematics.',
  '',
  'Hidden within the checkpoints are games,',
  'some ancient and long forgotten',
  '<span class="intro-hl">(Tutankhamun\'s Senet, Archimedes\' Stomachion…)</span>,',
  'others reimagined.',
  '',
  'This is not just another space adventure —',
  'it is a journey through history.',
];

const TEASER = 'Customize your ship, search for parts in meteorites';

export function showIntro(): Promise<void> {
  return new Promise((resolve) => {
    /* ── root overlay ─────────────────────────────── */
    const root = document.createElement('div');
    root.id = 'intro-screen';
    root.innerHTML = `
<style>
  #intro-screen {
    position: fixed; inset: 0; z-index: 50;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: ${FONT};
    color: rgba(255,255,255,0.88);
    overflow: hidden;
    /* starfield gradient */
    background:
      radial-gradient(1.2px 1.2px at 12% 28%, rgba(255,255,255,0.7) 0%, transparent 100%),
      radial-gradient(1px 1px at 73% 14%, rgba(255,255,255,0.5) 0%, transparent 100%),
      radial-gradient(1.5px 1.5px at 45% 72%, rgba(255,210,127,0.6) 0%, transparent 100%),
      radial-gradient(1px 1px at 88% 56%, rgba(255,255,255,0.45) 0%, transparent 100%),
      radial-gradient(0.8px 0.8px at 22% 85%, rgba(255,255,255,0.5) 0%, transparent 100%),
      radial-gradient(1.2px 1.2px at 65% 42%, rgba(255,255,255,0.35) 0%, transparent 100%),
      radial-gradient(1px 1px at 35% 15%, rgba(255,210,127,0.4) 0%, transparent 100%),
      radial-gradient(0.9px 0.9px at 90% 82%, rgba(255,255,255,0.4) 0%, transparent 100%),
      radial-gradient(1.3px 1.3px at 8% 62%, rgba(255,255,255,0.3) 0%, transparent 100%),
      radial-gradient(1px 1px at 52% 93%, rgba(255,255,255,0.35) 0%, transparent 100%),
      radial-gradient(1.1px 1.1px at 78% 35%, rgba(255,210,127,0.3) 0%, transparent 100%),
      radial-gradient(0.7px 0.7px at 40% 48%, rgba(255,255,255,0.3) 0%, transparent 100%),
      radial-gradient(ellipse at 50% 50%, #08061a 0%, #000 100%);
    opacity: 0;
    transition: opacity 0.6s ease-out;
  }
  #intro-screen.visible { opacity: 1; }
  #intro-screen.fadeout {
    opacity: 0;
    transition: opacity 0.5s ease-in;
  }

  /* title */
  .intro-title {
    font-size: clamp(28px, 5.5vw, 58px);
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${GOLD};
    text-shadow: 0 0 32px rgba(255,210,127,0.45), 0 0 80px rgba(255,210,127,0.15);
    margin-bottom: 8px;
    opacity: 0;
    transform: translateY(12px) scale(0.97);
    transition: opacity 0.8s ease-out, transform 0.8s ease-out;
  }
  .intro-title.show {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .intro-subtitle {
    font-size: clamp(11px, 1.6vw, 15px);
    letter-spacing: 0.45em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    margin-bottom: clamp(28px, 4vh, 52px);
    opacity: 0;
    transition: opacity 0.7s ease-out 0.3s;
  }
  .intro-subtitle.show { opacity: 1; }

  /* story block */
  .intro-story {
    max-width: min(88vw, 560px);
    text-align: center;
    line-height: 1.75;
    font-size: clamp(14px, 2vw, 18px);
    font-weight: 400;
    letter-spacing: 0.02em;
  }
  .intro-story .line {
    display: block;
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.5s ease-out, transform 0.5s ease-out;
  }
  .intro-story .line.show {
    opacity: 1;
    transform: translateY(0);
  }
  .intro-story .line.spacer { height: 12px; }

  .intro-hl {
    color: ${GOLD};
    font-style: italic;
  }
  .intro-story em {
    color: ${GOLD};
    font-style: normal;
    font-weight: 600;
  }

  /* teaser */
  .intro-teaser {
    margin-top: clamp(18px, 3vh, 36px);
    font-size: clamp(12px, 1.5vw, 14px);
    letter-spacing: 0.12em;
    color: rgba(255,210,127,0.5);
    font-style: italic;
    opacity: 0;
    transition: opacity 0.6s ease-out;
  }
  .intro-teaser.show { opacity: 1; }

  /* continue prompt */
  .intro-continue {
    position: absolute;
    bottom: clamp(24px, 5vh, 48px);
    font-size: clamp(11px, 1.4vw, 13px);
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.4);
    opacity: 0;
    transition: opacity 0.5s ease-out;
    animation: intro-pulse 2.2s ease-in-out infinite;
  }
  .intro-continue.show { opacity: 1; }

  @keyframes intro-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.85; }
  }

  /* divider */
  .intro-divider {
    width: 60px; height: 1px;
    background: linear-gradient(90deg, transparent, ${GOLD}, transparent);
    margin: clamp(16px, 2.5vh, 28px) auto;
    opacity: 0;
    transition: opacity 0.6s ease-out;
  }
  .intro-divider.show { opacity: 0.5; }
</style>

<div class="intro-title">Chronos Voyager</div>
<div class="intro-subtitle">a journey through time</div>
<div class="intro-story" id="intro-story"></div>
<div class="intro-divider" id="intro-divider"></div>
<div class="intro-teaser" id="intro-teaser">${TEASER}</div>
<div class="intro-continue" id="intro-continue">Tap to continue</div>
`;
    document.body.appendChild(root);

    /* ── build story lines ────────────────────────── */
    const storyEl = root.querySelector('#intro-story')!;
    const lineEls: HTMLElement[] = [];
    for (const text of STORY_LINES) {
      const span = document.createElement('span');
      span.className = text === '' ? 'line spacer' : 'line';
      if (text !== '') span.innerHTML = text;
      storyEl.appendChild(span);
      lineEls.push(span);
    }

    /* ── sequenced reveal ─────────────────────────── */
    let dismissed = false;
    const timers: number[] = [];

    const schedule = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    // fade-in root
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.add('visible'));
    });

    // title + subtitle
    schedule(() => root.querySelector('.intro-title')!.classList.add('show'), 200);
    schedule(() => root.querySelector('.intro-subtitle')!.classList.add('show'), 600);

    // story lines — stagger 180ms each, starting at 1200ms
    const LINE_DELAY = 180;
    const LINE_START = 1200;
    lineEls.forEach((el, i) => {
      schedule(() => el.classList.add('show'), LINE_START + i * LINE_DELAY);
    });

    // divider, teaser, continue prompt
    const afterLines = LINE_START + lineEls.length * LINE_DELAY + 300;
    schedule(() => root.querySelector('#intro-divider')!.classList.add('show'), afterLines);
    schedule(() => root.querySelector('#intro-teaser')!.classList.add('show'), afterLines + 250);
    schedule(() => root.querySelector('#intro-continue')!.classList.add('show'), afterLines + 500);

    /* ── dismiss ──────────────────────────────────── */
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      timers.forEach(clearTimeout);
      root.removeEventListener('click', dismiss);
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('touchstart', dismiss);

      root.classList.add('fadeout');
      root.addEventListener('transitionend', () => {
        root.remove();
        resolve();
      }, { once: true });
      // safety fallback if transitionend doesn't fire
      window.setTimeout(() => {
        if (root.parentNode) root.remove();
        resolve();
      }, 700);
    };

    root.addEventListener('click', dismiss);
    document.addEventListener('keydown', dismiss);
    document.addEventListener('touchstart', dismiss);
  });
}
