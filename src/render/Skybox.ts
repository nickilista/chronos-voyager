import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry } from 'three';
import type { Era } from '../eras/eras.ts';

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uPrimary;
  uniform vec3 uBg;
  uniform vec3 uAccent;
  uniform float uDensity;
  uniform float uStarBrightness;
  varying vec3 vDir;

  // hash-based 3D value noise
  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yxz + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash(i);
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float n = noise(p);
    n += 0.5 * noise(p * 2.03);
    n += 0.25 * noise(p * 4.07);
    return n / 1.75;
  }

  void main() {
    vec3 dir = normalize(vDir);
    // slow evolution of nebulae with time
    float n = fbm(dir * 3.0 + vec3(uTime * 0.015, 0.0, uTime * 0.008));
    float density = smoothstep(0.4, 0.85, n * uDensity * 1.6);

    // two-color ramp from bg → primary → accent highlights
    vec3 col = mix(uBg, uPrimary, density);
    col = mix(col, uAccent, smoothstep(0.78, 1.0, density) * 0.7);

    // stars — sparse + bright. hash over direction so they "stick" to sky.
    vec3 starHash = dir * 450.0;
    float sh = hash(floor(starHash));
    float star = step(0.9965, sh) * uStarBrightness;
    // twinkle
    star *= 0.6 + 0.4 * sin(uTime * 3.0 + sh * 30.0);
    col += vec3(star);

    // subtle radial vignette toward horizon for depth
    float depth = 1.0 - 0.15 * pow(abs(dir.y), 2.0);
    col *= depth;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Skybox {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  constructor(era: Era) {
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uPrimary: { value: new Color(era.palette.primary) },
        uBg: { value: new Color(era.palette.bg) },
        uAccent: { value: new Color(era.palette.accent) },
        uDensity: { value: era.skybox.density },
        uStarBrightness: { value: era.skybox.starBrightness },
      },
    });
    this.mesh = new Mesh(new SphereGeometry(500, 32, 16), this.material);
    this.mesh.frustumCulled = false;
  }

  update(dt: number): void {
    this.material.uniforms.uTime.value += dt;
  }

  /** Swap all uniforms to a new era — call during transitions. */
  setEra(era: Era): void {
    const u = this.material.uniforms;
    (u.uPrimary.value as Color).setHex(era.palette.primary);
    (u.uBg.value as Color).setHex(era.palette.bg);
    (u.uAccent.value as Color).setHex(era.palette.accent);
    u.uDensity.value = era.skybox.density;
    u.uStarBrightness.value = era.skybox.starBrightness;
  }
}
