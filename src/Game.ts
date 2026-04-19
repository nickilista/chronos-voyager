import {
  AmbientLight,
  DirectionalLight,
  Fog,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { getInput } from './core/Input.ts';
import { getEra, type Era } from './eras/eras.ts';
import { Ship } from './gameplay/Ship.ts';
import { Skybox } from './render/Skybox.ts';

const CAMERA_OFFSET = new Vector3(0, 2.2, 7.5);

export class Game {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly ship = new Ship();
  readonly skybox: Skybox;

  private currentEra: Era;
  private ambient: AmbientLight;
  private key: DirectionalLight;
  private lastTs = performance.now();
  private _smoothCamPos = new Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

    this.camera = new PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );

    this.currentEra = getEra('egypt');
    this.scene.fog = new Fog(this.currentEra.palette.fog, 40, 220);

    this.skybox = new Skybox(this.currentEra);
    this.scene.add(this.skybox.mesh);

    this.ambient = new AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambient);

    this.key = new DirectionalLight(this.currentEra.palette.accent, 1.1);
    this.key.position.set(5, 8, 3);
    this.scene.add(this.key);

    this.scene.add(this.ship.group);

    // Seed camera position so first frame isn't a lerp from origin.
    this._smoothCamPos.copy(this.ship.group.position).add(CAMERA_OFFSET);
    this.camera.position.copy(this._smoothCamPos);
    this.camera.lookAt(this.ship.group.position);

    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  }

  start(): void {
    this.lastTs = performance.now();
    requestAnimationFrame(this.frame);
  }

  private handleResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private frame = (now: number): void => {
    const dt = Math.min((now - this.lastTs) / 1000, 0.05); // clamp frame dt
    this.lastTs = now;

    // Update systems
    this.ship.update(dt, getInput());
    this.skybox.update(dt);

    // Camera follow ship (third-person trailing)
    const target = this.ship.group.position.clone().add(CAMERA_OFFSET);
    this._smoothCamPos.lerp(target, Math.min(1, dt * 6));
    this.camera.position.copy(this._smoothCamPos);
    // Look slightly ahead of the ship (forward along -Z)
    const lookTarget = this.ship.group.position.clone();
    lookTarget.z -= 6;
    this.camera.lookAt(lookTarget);

    // Keep skybox centered on the camera so it always feels infinite.
    this.skybox.mesh.position.copy(this.camera.position);

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.frame);
  };
}
