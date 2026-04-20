import './style.css';
import { Game } from './Game.ts';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('#game canvas not found');

const game = new Game(canvas);
(window as unknown as { __game: Game }).__game = game;
await game.start();
