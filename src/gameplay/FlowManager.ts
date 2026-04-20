import { Scene, Vector3 } from 'three';
import { ERAS, getEra, type EraId } from '../eras/eras.ts';
import { Flow, type FlowEvents } from './Flow.ts';
import { CORRIDOR_RADIUS } from './Track.ts';

/**
 * Manages all 10 era corridors in 3D space.
 *
 * Picks one active flow per frame (the one whose axis the ship is currently
 * nearest) and exposes the aggregate outside / boundary factors used by the
 * camera / skybox / ship.
 */

/** Minimum centre-to-centre distance between any two flows. */
const MIN_CENTER_DIST = 675;

/**
 * Minimum distance between the two flows' infinite axis-lines. The tubes are
 * rendered effectively infinite (long cylinders with soft end-taper), so we
 * need this clearance to hold along the *entire* line, not just a finite
 * segment. Treating the lines as infinite guarantees no pair ever crosses.
 */
const MIN_LINE_CLEARANCE = 2 * CORRIDOR_RADIUS + 60;

/** Egypt always anchors at origin; the 9 others scatter around this cluster. */
const SCATTER_CENTER = new Vector3(0, 0, -375);
const SCATTER_RADIUS_MIN = 450;
const SCATTER_RADIUS_MAX = 1500;

const FLOW_ERA_ORDER: EraId[] = [
  'egypt',
  'greece',
  'china',
  'islamic',
  'india',
  'renaissance',
  'edo',
  'enlightenment',
  'revolution',
  'codebreakers',
];

interface Placement {
  origin: Vector3;
  axis: Vector3;
}

/** Deterministic LCG so the layout is stable across reloads. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function randomUnitVector(rng: () => number): Vector3 {
  // Uniform on the sphere via z-slice + angle.
  const z = 2 * rng() - 1;
  const phi = rng() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return new Vector3(r * Math.cos(phi), r * Math.sin(phi), z);
}

function randomOrigin(rng: () => number): Vector3 {
  const dir = randomUnitVector(rng);
  const radius = SCATTER_RADIUS_MIN + rng() * (SCATTER_RADIUS_MAX - SCATTER_RADIUS_MIN);
  return dir.multiplyScalar(radius).add(SCATTER_CENTER);
}

/**
 * Closest distance between two infinite 3D lines, each through `origin_i`
 * with unit direction `axis_i`. For skew lines this is the classic
 * `|(oB - oA) · (aA × aB)| / |aA × aB|`; for parallel lines it collapses to
 * the perpendicular component of `oB - oA`.
 *
 * We use the infinite-line formulation (not segment-segment) because the
 * tubes are rendered effectively infinite — any intersection along their
 * extended length would read as a visual crossing in the outside map.
 */
function lineLineDistance(
  oA: Vector3,
  aA: Vector3,
  oB: Vector3,
  aB: Vector3,
): number {
  const diff = new Vector3().subVectors(oB, oA);
  const cross = new Vector3().crossVectors(aA, aB);
  const mag = cross.length();
  if (mag < 1e-4) {
    // Near-parallel — fall back to the perpendicular distance of diff to aA.
    const along = diff.dot(aA);
    return Math.sqrt(Math.max(0, diff.lengthSq() - along * along));
  }
  return Math.abs(diff.dot(cross)) / mag;
}

/**
 * Build 10 non-intersecting 3D placements. Egypt is anchored at origin along
 * world -Z so the existing Egypt spawn / camera framing stays canonical; the
 * other 9 are scattered with random tilts and rejection-sampled so no pair of
 * cylinders intersect and none sit closer than MIN_CENTER_DIST centre-to-centre.
 */
function generateLayout(): Placement[] {
  const rng = makeRng(0xc4afe7); // stable seed
  const placements: Placement[] = [
    { origin: new Vector3(0, 0, 0), axis: new Vector3(0, 0, -1) },
  ];

  for (let i = 1; i < FLOW_ERA_ORDER.length; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 4000; attempt++) {
      const origin = randomOrigin(rng);
      const axis = randomUnitVector(rng);
      let ok = true;
      for (const prior of placements) {
        if (origin.distanceTo(prior.origin) < MIN_CENTER_DIST) {
          ok = false;
          break;
        }
        const d = lineLineDistance(prior.origin, prior.axis, origin, axis);
        if (d < MIN_LINE_CLEARANCE) {
          ok = false;
          break;
        }
      }
      if (ok) {
        placements.push({ origin, axis });
        placed = true;
        break;
      }
    }
    if (!placed) {
      throw new Error(
        `FlowManager: could not place flow ${i} (${FLOW_ERA_ORDER[i]}) after 4000 attempts`,
      );
    }
  }
  return placements;
}

export class FlowManager {
  readonly flows: Flow[];
  activeFlow: Flow;
  outsideFactor = 0;
  boundaryProximity = 0;
  /** Min radial to any flow — useful for HUD proximity cues / debug. */
  nearestRadial = 0;

  private readonly _metrics: Array<{ radial: number; axial: number }>;

  constructor(events: FlowEvents) {
    const placements = generateLayout();
    this.flows = placements.map((p, i) => {
      const era = getEra(FLOW_ERA_ORDER[i]);
      return new Flow(era, p.origin, p.axis, events);
    });
    this.activeFlow = this.flows[0];
    this._metrics = this.flows.map(() => ({ radial: 0, axial: 0 }));
    // Sanity: all 10 eras accounted for.
    if (this.flows.length !== ERAS.length) {
      throw new Error(
        `FlowManager expected ${ERAS.length} flows, got ${this.flows.length}`,
      );
    }
  }

  init(scene: Scene): void {
    for (const flow of this.flows) {
      flow.init();
      scene.add(flow.group);
    }
  }

  update(dt: number, shipWorld: Vector3, shipVelWorld: Vector3): void {
    let minRadial = Infinity;
    let nearestIndex = 0;
    for (let i = 0; i < this.flows.length; i++) {
      const m = this.flows[i].metricsFor(shipWorld);
      this._metrics[i].radial = m.radial;
      this._metrics[i].axial = m.axial;
      if (m.radial < minRadial) {
        minRadial = m.radial;
        nearestIndex = i;
      }
    }
    this.activeFlow = this.flows[nearestIndex];
    this.nearestRadial = minRadial;
    this.outsideFactor = Math.min(
      1,
      Math.max(0, (minRadial - CORRIDOR_RADIUS) / 4),
    );
    this.boundaryProximity = Math.max(
      0,
      1 - Math.abs(minRadial - CORRIDOR_RADIUS) / 10,
    );

    // Isolate corridor interiors from the outside map: while the ship is inside
    // any flow, the other 9 flows' content (obstacles, gods, aura, haze) is
    // hidden so the player only experiences that era's world. In free space
    // (outsideFactor ≈ 1) all 10 flows show as visible tubes to navigate.
    const shipInFreeSpace = this.outsideFactor > 0.01;

    for (let i = 0; i < this.flows.length; i++) {
      const isActive = i === nearestIndex;
      const flowOutside = isActive ? this.outsideFactor : 1;
      const flowBoundary = isActive ? this.boundaryProximity : 0;
      this.flows[i].setVisible(isActive || shipInFreeSpace);
      this.flows[i].update(
        dt,
        shipWorld,
        shipVelWorld,
        flowOutside,
        flowBoundary,
      );
    }
  }

  setAllVisible(visible: boolean): void {
    for (const flow of this.flows) flow.setVisible(visible);
  }

  resetAllCollectibles(): void {
    for (const flow of this.flows) flow.resetCollectibles();
  }
}
