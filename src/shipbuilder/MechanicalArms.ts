import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
} from 'three';

/**
 * Four articulated manipulator arms anchored at the platform's corner
 * pillars, reaching inward toward the ship as if actively assembling /
 * inspecting it. Replaces the placeholder `platform_arm_*` cubes baked
 * into the platform GLB.
 *
 * Geometry layout (platform-local space, matches the rest of the builder):
 *   • y = 0   → platform base plane
 *   • y = 2.0 → pillar tops (arm bases mount here)
 *   • ship centre sits around y ≈ 1.6 (world y ≈ 0, platform at y = −1.6)
 *
 * Each arm is a 3-link chain: base-yaw → shoulder-pitch → upper arm →
 * elbow-bend → forearm → wrist-spin → emissive tool tip. The rest pose
 * has the upper arm tilted inward ~75° from vertical and the forearm
 * bent another ~85° so the tool tip hovers just outside the ship
 * silhouette at roughly (r=2.3, y=1.3). A small additive-blend point
 * light at each tip reads as an active welding/beam torch.
 *
 * Motion is driven by independent sinusoids per arm — tiny amplitude
 * (±0.18 rad on shoulder, ±0.22 rad on elbow) plus a slow wrist roll,
 * all phase-offset per arm so they never move in lockstep.
 */

// Shared geometries + materials. Cached at module scope because we only
// ever instantiate 4 arms and never dispose them mid-session — the
// builder scene is torn down at Launch and a fresh one is never spawned.
const armMat = new MeshStandardMaterial({
  color: 0x3a4048,
  metalness: 0.88,
  roughness: 0.34,
});
const jointMat = new MeshStandardMaterial({
  color: 0x5a6470,
  metalness: 0.92,
  roughness: 0.22,
});
const tipMat = new MeshStandardMaterial({
  color: 0x1a2a30,
  metalness: 0.8,
  roughness: 0.3,
  emissive: 0x5fc8ff,
  emissiveIntensity: 2.6,
});

const jointGeo = new SphereGeometry(0.16, 20, 16);
const wristGeo = new SphereGeometry(0.11, 16, 12);
const upperGeo = new CylinderGeometry(0.12, 0.1, 1.4, 14);
const forearmGeo = new CylinderGeometry(0.09, 0.08, 1.1, 14);
const tipGeo = new CylinderGeometry(0.04, 0.07, 0.3, 12);

const UPPER_LEN = 1.4;
const FOREARM_LEN = 1.1;

interface ArmRig {
  base: Group;      // yaws around world Y so +Z of its frame points inward
  shoulder: Group;  // pitches the upper arm away from vertical (+X axis)
  elbow: Group;     // positioned at the top of the upper arm, pitches forearm
  wrist: Group;     // spins the tool tip around the forearm's long axis
  /** Per-arm phase offset so the four arms animate out of sync. */
  phase: number;
  /** Per-arm time-scale so their breathing rates drift. */
  speed: number;
}

/** Build one arm with the nested Group hierarchy described above. */
function makeArm(): ArmRig {
  const base = new Group();
  const shoulderJoint = new Mesh(jointGeo, jointMat);
  base.add(shoulderJoint);

  const shoulder = new Group();
  base.add(shoulder);

  // Upper arm cylinder is authored along +Y with its origin at its center,
  // so we shift it half its length to sit on the shoulder pivot.
  const upper = new Mesh(upperGeo, armMat);
  upper.position.y = UPPER_LEN / 2;
  shoulder.add(upper);

  // Elbow node sits at the top of the upper arm.
  const elbow = new Group();
  elbow.position.y = UPPER_LEN;
  shoulder.add(elbow);
  const elbowJoint = new Mesh(jointGeo, jointMat);
  elbowJoint.scale.setScalar(0.8);
  elbow.add(elbowJoint);

  // Wrist carries the forearm + tip. Rotating wrist around Y spins the
  // tool in-place around the forearm's long axis (like a drill bit).
  const wrist = new Group();
  elbow.add(wrist);
  const forearm = new Mesh(forearmGeo, armMat);
  forearm.position.y = FOREARM_LEN / 2;
  wrist.add(forearm);

  const tip = new Group();
  tip.position.y = FOREARM_LEN;
  wrist.add(tip);
  const wristJoint = new Mesh(wristGeo, jointMat);
  tip.add(wristJoint);
  const torch = new Mesh(tipGeo, tipMat);
  torch.position.y = 0.2;
  tip.add(torch);

  // Local light so the tip reads as an active torch rather than a dead
  // emissive dot. Range is short so multiple torches don't wash out the
  // scene's overall lighting.
  const torchLight = new PointLight(0x5fc8ff, 1.1, 2.8, 2);
  torchLight.position.y = 0.35;
  tip.add(torchLight);

  return { base, shoulder, elbow, wrist, phase: 0, speed: 1 };
}

export class MechanicalArms {
  /** Add this to the scene — callers position it to match the platform. */
  readonly group = new Group();

  private arms: ArmRig[] = [];

  // Rest-pose angles (radians). See module docstring for how these were chosen.
  private static readonly REST_SHOULDER = 1.309; // ~75° — upper arm inward
  private static readonly REST_ELBOW = 1.484;    // ~85° — forearm folds down

  constructor() {
    // Platform corners. The baked platform GLB places pillars at ±2.83 on
    // X and Z, topped at local y=2.0; we anchor one arm at each.
    const CORNERS: Array<[number, number]> = [
      [ 2.83,  2.83],
      [-2.83,  2.83],
      [-2.83, -2.83],
      [ 2.83, -2.83],
    ];

    CORNERS.forEach(([x, z], i) => {
      const rig = makeArm();
      rig.base.position.set(x, 2.0, z);
      // Aim local +Z from the corner toward the platform centre. Positive
      // shoulder-pitch around local +X then rotates +Y toward +Z, which
      // after the yaw is now "inward".
      rig.base.rotation.y = Math.atan2(-x, -z);
      rig.shoulder.rotation.x = MechanicalArms.REST_SHOULDER;
      rig.elbow.rotation.x = MechanicalArms.REST_ELBOW;
      rig.phase = i * (Math.PI * 0.5 + 0.37);
      rig.speed = 0.8 + i * 0.11;
      this.group.add(rig.base);
      this.arms.push(rig);
    });
  }

  /**
   * Breathe the arms. `elapsed` is seconds since scene start; `dt` is the
   * frame delta used for integrating the wrist spin.
   */
  tick(dt: number, elapsed: number): void {
    for (const a of this.arms) {
      const t = elapsed * a.speed + a.phase;
      // Small sinusoidal jitter around the rest pose — keeps the arms
      // looking purposeful without requiring real IK.
      a.shoulder.rotation.x =
        MechanicalArms.REST_SHOULDER + Math.sin(t * 0.7) * 0.18;
      a.elbow.rotation.x =
        MechanicalArms.REST_ELBOW + Math.sin(t * 0.9 + 0.6) * 0.22;
      // Drill-like wrist spin — constant rate, doesn't affect silhouette.
      a.wrist.rotation.y += dt * (0.6 + a.speed * 0.2);
      // Slow yaw drift so the base doesn't appear bolted rigid.
      a.base.rotation.y += Math.sin(t * 0.35) * dt * 0.05;
    }
  }
}
