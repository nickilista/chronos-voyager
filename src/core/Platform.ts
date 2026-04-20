/** Lightweight platform-detection flags, evaluated once at module load. */

export const IS_MOBILE =
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);

export const IS_TOUCH =
  'ontouchstart' in window || navigator.maxTouchPoints > 0;
