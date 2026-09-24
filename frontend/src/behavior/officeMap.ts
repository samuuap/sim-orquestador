/**
 * Office navigation: named destinations, an occupancy grid, and A* pathfinding.
 *
 * The first version used a single sidestep to dodge the nearest obstacle. That was adequate with
 * four obstacles on an open floor; with a furnished room it failed on 48 of 80 test routes, so
 * characters walked through desks. This replaces it with a real (small) path search.
 *
 * Coordinates must stay in sync with components/Office.tsx.
 */

import * as THREE from 'three';
import type { AgentRole } from '@/types';

export type Activity =
  | 'idle'
  | 'walking'
  | 'working'
  | 'thinking'
  | 'talking'
  | 'drinking'
  | 'presenting'
  | 'celebrating'
  | 'frustrated';

export interface Waypoint {
  id: string;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  activity: Activity;
  linger: [number, number];
  owner?: AgentRole;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const DESKS: Record<AgentRole, Waypoint> = {
  ceo: {
    id: 'desk-ceo',
    position: v(-3, 0, 3.05),
    lookAt: v(-3, 1.15, 2),
    activity: 'working',
    linger: [7, 15],
    owner: 'ceo',
  },
  project_manager: {
    id: 'desk-pm',
    position: v(3, 0, 3.05),
    lookAt: v(3, 1.15, 2),
    activity: 'working',
    linger: [7, 15],
    owner: 'project_manager',
  },
  designer: {
    id: 'desk-designer',
    position: v(-6.5, 0, -0.45),
    lookAt: v(-6.5, 1.15, -1.5),
    activity: 'working',
    linger: [7, 15],
    owner: 'designer',
  },
  developer: {
    id: 'desk-developer',
    position: v(6.5, 0, -0.45),
    lookAt: v(6.5, 1.15, -1.5),
    activity: 'working',
    linger: [7, 15],
    owner: 'developer',
  },
};

/**
 * Enclosed rooms the orchestrator can summon agents into.
 *
 * `seats` are ordered: index 0 is the head of the table, so the agent the backend lists first —
 * the CEO in the briefing, the PM at the standup — ends up leading the room rather than taking a
 * side chair. Participants take seats by their index in the MEETING_STARTED payload, which also
 * guarantees two agents never claim the same chair.
 */
export interface Room {
  id: string;
  label: string;
  /** Where attention points: everyone seated turns to face this. */
  focus: THREE.Vector3;
  /** Height of the chair seat surface. The renderer lowers the hips onto it. */
  seatHeight: number;
  seats: THREE.Vector3[];
}

export const ROOMS: Record<string, Room> = {
  /** The CEO's office: two chairs, for a one-to-one. */
  office: {
    id: 'office',
    label: 'Office',
    focus: v(7, 0.9, -7.6),
    /** Chair height, so the renderer can drop the hips onto the seat rather than guess. */
    seatHeight: 0.51,
    seats: [v(7, 0, -8.5), v(7, 0, -6.7)],
  },
  /** The big meeting room: a long table the whole team fits around. */
  meeting_room: {
    id: 'meeting_room',
    label: 'Meeting room',
    focus: v(-6.5, 0.9, -6.7),
    seatHeight: 0.51,
    seats: [
      v(-8.25, 0, -6.7), // head of the table
      v(-7.3, 0, -5.65),
      v(-5.7, 0, -5.65),
      v(-7.3, 0, -7.75),
      v(-5.7, 0, -7.75),
      v(-4.75, 0, -6.7),
    ],
  },
};

export const SHARED_WAYPOINTS: Waypoint[] = [
  { id: 'cooler', position: v(8.8, 0, 2.6), lookAt: v(9.6, 0.9, 3.1), activity: 'drinking', linger: [4, 7] },
  { id: 'lounge-a', position: v(-1.3, 0, 5.2), lookAt: v(0, 1, 5.2), activity: 'talking', linger: [6, 12] },
  { id: 'lounge-b', position: v(1.3, 0, 5.2), lookAt: v(0, 1, 5.2), activity: 'talking', linger: [6, 12] },
  { id: 'window', position: v(-8.6, 0, 3.6), lookAt: v(-10.5, 1.6, 3.6), activity: 'idle', linger: [6, 11] },
  { id: 'shelf', position: v(8.7, 0, 6.6), lookAt: v(9.6, 1.2, 6.6), activity: 'idle', linger: [4, 8] },
  { id: 'plant-corner', position: v(-8.4, 0, 6.8), lookAt: v(-9.6, 0.8, 7.6), activity: 'idle', linger: [4, 8] },
];

/** Walkable bounds. Smaller than the room so nobody walks into a wall. */
const AREA = { minX: -9.6, maxX: 9.6, minZ: -8.9, maxZ: 8.9 };

/**
 * Furniture as axis-aligned boxes. Boxes rather than circles because desks are 1.8 x 0.95 —
 * a circle either leaves the ends exposed or swallows the standing spot in front.
 */
interface Box {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
}

const FURNITURE: Box[] = [
  // --- open-plan desks and their rolled-aside stools ---
  { cx: -3, cz: 2, hx: 0.95, hz: 0.52 }, // ceo desk
  { cx: 3, cz: 2, hx: 0.95, hz: 0.52 }, // pm desk
  { cx: -6.5, cz: -1.5, hx: 0.95, hz: 0.52 }, // designer desk
  { cx: 6.5, cz: -1.5, hx: 0.95, hz: 0.52 }, // developer desk
  { cx: -2.18, cz: 3.28, hx: 0.34, hz: 0.34 },
  { cx: 3.82, cz: 3.28, hx: 0.34, hz: 0.34 },
  { cx: -5.68, cz: -0.22, hx: 0.34, hz: 0.34 },
  { cx: 7.32, cz: -0.22, hx: 0.34, hz: 0.34 },

  // --- meeting room: glass walls with a doorway on the east side ---
  { cx: -7.65, cz: -4.6, hx: 1.85, hz: 0.07 }, // south wall, stops short of the door
  { cx: -3.4, cz: -6.72, hx: 0.07, hz: 2.13 }, // east wall
  { cx: -6.5, cz: -6.7, hx: 1.3, hz: 0.55 }, // long table

  // --- office (despacho): glass walls with a doorway on the east side ---
  { cx: 6.0, cz: -5.6, hx: 1.6, hz: 0.07 }, // south wall
  { cx: 4.4, cz: -7.22, hx: 0.07, hz: 1.63 }, // west wall
  { cx: 7.0, cz: -7.6, hx: 0.6, hz: 0.4 }, // meeting table

  // --- open-plan props ---
  { cx: 0, cz: 5.2, hx: 0.7, hz: 0.7 }, // lounge table
  { cx: 9.6, cz: 3.1, hx: 0.24, hz: 0.24 }, // cooler
  { cx: 9.6, cz: 6.6, hx: 0.2, hz: 0.8 }, // shelving
  { cx: -9.6, cz: 7.6, hx: 0.3, hz: 0.3 }, // plant
  { cx: 9.6, cz: -2.6, hx: 0.28, hz: 0.28 }, // plant
];

const CELL = 0.28;

/**
 * Obstacles are grown by more than the body radius, because a walking character does not follow
 * the polyline exactly: it switches to the next corner CORNER_EPSILON early so turns curve instead
 * of pivoting. That shortcut costs clearance, so the inflation has to cover
 * body radius + half a cell + the corner cut.
 */
const AGENT_RADIUS = 0.46;

/** Unhurried pace, for wandering and going back to a desk. */
export const WALK_SPEED = 1.35;
/**
 * Pace when summoned to a meeting. People do not stroll to a meeting they were just called into,
 * and at the unhurried pace the longest desk-to-seat walk takes over seventeen seconds — long
 * enough that the conversation would start while half the room was still crossing the floor.
 */
export const MEETING_WALK_SPEED = 2.3;

/** How close counts as reaching the final destination. */
export const ARRIVAL_EPSILON = 0.12;

/**
 * How early a character turns toward the next corner. Exported so the navigation test walks routes
 * exactly the way the behaviour layer does — the two drifting apart is what hid a real clearance
 * bug behind a passing test.
 */
export const CORNER_EPSILON = 0.18;

const COLS = Math.ceil((AREA.maxX - AREA.minX) / CELL);
const ROWS = Math.ceil((AREA.maxZ - AREA.minZ) / CELL);

/** 1 = blocked. Built once on first use. */
let grid: Uint8Array | null = null;

function buildGrid(): Uint8Array {
  const cells = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const x = AREA.minX + (c + 0.5) * CELL;
      const z = AREA.minZ + (r + 0.5) * CELL;
      // Blocked if the obstacle overlaps the cell's SQUARE, not merely its centre. Testing the
      // centre alone loses up to half a cell diagonal of margin, which let smoothed paths graze
      // furniture at ~0.12 clearance instead of the intended 0.3.
      const pad = AGENT_RADIUS + CELL * 0.5;
      const blocked = FURNITURE.some(
        (b) => Math.abs(x - b.cx) <= b.hx + pad && Math.abs(z - b.cz) <= b.hz + pad,
      );
      if (blocked) cells[r * COLS + c] = 1;
    }
  }
  return cells;
}

function cells(): Uint8Array {
  if (!grid) grid = buildGrid();
  return grid;
}

const toCol = (x: number) => Math.floor((x - AREA.minX) / CELL);
const toRow = (z: number) => Math.floor((z - AREA.minZ) / CELL);
const toX = (c: number) => AREA.minX + (c + 0.5) * CELL;
const toZ = (r: number) => AREA.minZ + (r + 0.5) * CELL;

function inBounds(c: number, r: number): boolean {
  return c >= 0 && c < COLS && r >= 0 && r < ROWS;
}

function blockedCell(c: number, r: number): boolean {
  if (!inBounds(c, r)) return true;
  return cells()[r * COLS + c] === 1;
}

/**
 * Conservative: true when the point's grid cell is blocked. The cell is classified by its centre,
 * so a point can report blocked while sitting just outside the real furniture. That bias is
 * deliberate for planning; use furnitureClearance for an exact measurement.
 */
export function isBlocked(point: THREE.Vector3): boolean {
  return blockedCell(toCol(point.x), toRow(point.z));
}

/**
 * Exact distance from a point to the nearest piece of furniture, ignoring the planning inflation.
 * Negative inside a box. Used by the navigation tests to measure real clearance rather than
 * grid-cell occupancy.
 */
export function furnitureClearance(point: THREE.Vector3): number {
  let best = Infinity;
  for (const b of FURNITURE) {
    const dx = Math.abs(point.x - b.cx) - b.hx;
    const dz = Math.abs(point.z - b.cz) - b.hz;
    const outside = Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
    const distance = dx <= 0 && dz <= 0 ? Math.max(dx, dz) : outside;
    if (distance < best) best = distance;
  }
  return best;
}

/** Nearest walkable cell to a point, searched outward. Destinations sit beside furniture. */
function nearestFree(c: number, r: number): [number, number] | null {
  if (!blockedCell(c, r)) return [c, r];
  for (let ring = 1; ring <= 10; ring += 1) {
    for (let dc = -ring; dc <= ring; dc += 1) {
      for (let dr = -ring; dr <= ring; dr += 1) {
        if (Math.abs(dc) !== ring && Math.abs(dr) !== ring) continue;
        if (!blockedCell(c + dc, r + dr)) return [c + dc, r + dr];
      }
    }
  }
  return null;
}

/** True if a straight line between two world points stays clear. Used to smooth the raw path. */
function lineClear(ax: number, az: number, bx: number, bz: number): boolean {
  // Sampled finer than a cell so the line cannot hop diagonally over a blocked one.
  const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.25));
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    if (blockedCell(toCol(ax + (bx - ax) * t), toRow(az + (bz - az) * t))) return false;
  }
  return true;
}

const NEIGHBORS: Array<[number, number, number]> = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * A* over the occupancy grid, then string-pulled so the result is a handful of corners rather
 * than a staircase of cells. Runs once per destination choice, never per frame.
 */
export function findPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
  const start = nearestFree(toCol(from.x), toRow(from.z));
  const goal = nearestFree(toCol(to.x), toRow(to.z));
  if (!start || !goal) return [to.clone()];

  const [sc, sr] = start;
  const [gc, gr] = goal;
  if (sc === gc && sr === gr) return [to.clone()];

  const size = COLS * ROWS;
  const gScore = new Float32Array(size).fill(Infinity);
  const cameFrom = new Int32Array(size).fill(-1);
  const closed = new Uint8Array(size);

  const h = (c: number, r: number) => Math.hypot(c - gc, r - gr);
  const startIdx = sr * COLS + sc;
  const goalIdx = gr * COLS + gc;
  gScore[startIdx] = 0;

  // Small binary heap; the grid is ~4k cells so this never grows large.
  const heap: Array<[number, number]> = [[h(sc, sr), startIdx]];
  const push = (item: [number, number]) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] <= heap[i][0]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };
  const pop = (): [number, number] | undefined => {
    if (heap.length === 0) return undefined;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r2 = l + 1;
        let smallest = i;
        if (l < heap.length && heap[l][0] < heap[smallest][0]) smallest = l;
        if (r2 < heap.length && heap[r2][0] < heap[smallest][0]) smallest = r2;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
        i = smallest;
      }
    }
    return top;
  };

  let found = false;
  for (;;) {
    const node = pop();
    if (!node) break;
    const idx = node[1];
    if (closed[idx]) continue;
    closed[idx] = 1;
    if (idx === goalIdx) {
      found = true;
      break;
    }

    const c = idx % COLS;
    const r = (idx - c) / COLS;

    for (const [dc, dr, cost] of NEIGHBORS) {
      const nc = c + dc;
      const nr = r + dr;
      if (blockedCell(nc, nr)) continue;
      // No cutting diagonally between two blocked orthogonal neighbours.
      if (dc !== 0 && dr !== 0 && (blockedCell(c + dc, r) || blockedCell(c, r + dr))) continue;

      const nIdx = nr * COLS + nc;
      if (closed[nIdx]) continue;
      const tentative = gScore[idx] + cost;
      if (tentative < gScore[nIdx]) {
        gScore[nIdx] = tentative;
        cameFrom[nIdx] = idx;
        push([tentative + h(nc, nr), nIdx]);
      }
    }
  }

  if (!found) return [to.clone()];

  const raw: Array<[number, number]> = [];
  for (let idx = goalIdx; idx !== -1; idx = cameFrom[idx]) {
    const c = idx % COLS;
    raw.push([c, (idx - c) / COLS]);
    if (idx === startIdx) break;
  }
  raw.reverse();

  // String pull: drop a corner unless the line past it is obstructed.
  const smoothed: THREE.Vector3[] = [];
  let anchorX = from.x;
  let anchorZ = from.z;
  for (let i = 1; i < raw.length; i += 1) {
    const [c, r] = raw[i];
    if (!lineClear(anchorX, anchorZ, toX(c), toZ(r))) {
      const [pc, pr] = raw[i - 1];
      smoothed.push(v(toX(pc), 0, toZ(pr)));
      anchorX = toX(pc);
      anchorZ = toZ(pr);
    }
  }

  // Always keep the final grid corner. The destination itself may legitimately sit in a blocked
  // cell — desk spots do, by design — so it can never be validated by lineClear. Anchoring on the
  // last free cell keeps that unvalidated hop under one cell instead of spanning the whole room.
  const [lc, lr] = raw[raw.length - 1];
  const lastX = toX(lc);
  const lastZ = toZ(lr);
  const tail = smoothed[smoothed.length - 1];
  if (!tail || Math.hypot(tail.x - lastX, tail.z - lastZ) > 0.01) {
    smoothed.push(v(lastX, 0, lastZ));
  }

  smoothed.push(to.clone());
  return smoothed;
}

export function randomWanderPoint(): THREE.Vector3 {
  for (let i = 0; i < 40; i += 1) {
    const point = v(
      AREA.minX + 1 + Math.random() * (AREA.maxX - AREA.minX - 2),
      0,
      AREA.minZ + 1 + Math.random() * (AREA.maxZ - AREA.minZ - 2),
    );
    if (!isBlocked(point)) return point;
  }
  return v(0, 0, 5.5);
}

/** Characters model-face +Z. */
export function yawToward(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
