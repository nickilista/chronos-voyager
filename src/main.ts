import './style.css';
import {
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

const canvas = document.getElementById('game') as HTMLCanvasElement;

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight, false);

const scene = new Scene();

const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

const cube = new Mesh(
  new BoxGeometry(1.4, 1.4, 1.4),
  new MeshStandardMaterial({
    color: 0xc9a84c,
    roughness: 0.4,
    metalness: 0.3,
    emissive: 0x3a1a00,
  }),
);
scene.add(cube);

scene.add(new AmbientLight(0xffffff, 0.35));
const key = new DirectionalLight(0xffe4a8, 1.2);
key.position.set(3, 4, 5);
scene.add(key);

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
function loop(now: number): void {
  const dt = (now - last) / 1000;
  last = now;

  cube.rotation.x += dt * 0.6;
  cube.rotation.y += dt * 0.9;

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
