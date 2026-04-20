import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
} from 'three';

/**
 * Tiny shader-driven star field for the ship-builder background. Points are
 * scattered on a large sphere around the camera, sized by an attribute and
 * twinkled in the fragment shader. Additive blending + bloom gives them a
 * soft, filmic feel without any post-processing texture work.
 */

const VERT = /* glsl */ `
  attribute float aSize;
  varying float vSize;
  void main() {
    vSize = aSize;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (360.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  varying float vSize;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float fall = smoothstep(0.5, 0.0, d);
    float twinkle = 0.7 + 0.3 * sin(uTime * 2.0 + vSize * 11.0);
    vec3 col = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.95, 0.85), step(0.5, fract(vSize * 0.37)));
    gl_FragColor = vec4(col * fall * twinkle, fall);
  }
`;

export function makeStarField(count = 1800, radius = 600): Points {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Uniform on a sphere.
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * (0.8 + Math.random() * 0.2);
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = 0.8 + Math.random() * 2.2;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));

  const mat = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const points = new Points(geo, mat);
  points.frustumCulled = false;
  (points as unknown as { tick: (dt: number) => void }).tick = (dt: number) => {
    mat.uniforms.uTime.value += dt;
  };
  return points;
}
