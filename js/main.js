import { Game } from './game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

function resize() {
  const stage = document.getElementById('stage');
  const rect = stage.getBoundingClientRect();
  game.renderer.resize(rect.width, rect.height);
  game.onResize();
}

const ro = new ResizeObserver(() => resize());
ro.observe(document.getElementById('stage'));
window.addEventListener('orientationchange', () => setTimeout(resize, 220));
window.addEventListener('load', resize);
resize();

// Expose for debugging and for the capture harness.
window.__greenBetween = game;
