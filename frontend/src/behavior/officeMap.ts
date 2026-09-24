/**
 * Named places in the office, and the geometry helpers agents use to move between them.
 *
 * Coordinates must stay in sync with components/Office.tsx. The floor platform is a cylinder of
 * radius 8 centred on the origin, so every reachable point is kept inside PLATFORM_SAFE_RADIUS.
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
  /** Where the character stands (feet on the floor). */
  position: THREE.Vector3;
  /** What it turns to face on arrival. */
  lookAt: THREE.Vector3;
  /** What it does once it gets there. */
  activity: Activity;
  /** Seconds to linger, picked uniformly from this range. */
  linger: [number, number];
  /** If set, only this role may use the waypoint. */
  owner?: AgentRole;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Desks sit at y=0.4 in Office.tsx; agents stand just in front of them, never inside them. */
export const DESKS: Record<AgentRole, Waypoint> = {
  ceo: {
    id: 'desk-ceo',
    position: v(0, 0, 2.95),
    lookAt: v(0, 0.6, 2),
    activity: 'working',
    linger: [6, 14],
    owner: 'ceo',
  },
  designer: {
    id: 'desk-designer',
    position: v(-4, 0, -1.05),
    lookAt: v(-4, 0.6, -2),
    activity: 'working',
    linger: [6, 14],
    owner: 'designer',
  },
  developer: {
    id: 'desk-developer',
    position: v(4, 0, -1.05),
    lookAt: v(4, 0.6, -2),
    activity: 'working',
    linger: [6, 14],
    owner: 'developer',
  },
};

/** Shared destinations any agent may wander to. */
export const SHARED_WAYPOINTS: Waypoint[] = [
  {
    id: 'cooler',
    position: v(6.1, 0, 3.1),
    lookAt: v(6.8, 0.8, 3.6),
    activity: 'drinking',
    linger: [4, 7],
  },
  {
    id: 'whiteboard',
    position: v(0, 0, -5.6),
    lookAt: v(0, 1.4, -6.6),
    activity: 'presenting',
    linger: [5, 10],
  },
  {
    id: 'lounge-a',
    position: v(-2.1, 0, -3.4),
    lookAt: v(0, 1, -3.4),
    activity: 'talking',
    linger: [6, 12],
  },
  {
    id: 'lounge-b',
    position: v(2.1, 0, -3.4),
    lookAt: v(0, 1, -3.4),
    activity: 'talking',
    linger: [6, 12],
  },
  {
    id: 'window',
    position: v(-6.2, 0, 3.4),
    lookAt: v(-7.5, 1.2, 4.4),
    activity: 'idle',
    linger: [5, 9],
  },
];

const PLATFORM_SAFE_RADIUS = 6.4;

/** Obstacles agents route around: the three desks plus the cooler. */
const OBSTACLES: Array<{ center: THREE.Vector3; radius: number }> = [
  { center: v(0, 0, 2), radius: 1.15 },
  { center: v(-4, 0, -2), radius: 1.15 },
  { center: v(4, 0, -2), radius: 1.15 },
  { center: v(6.8, 0, 3.6), radius: 0.7 },
];

export function isBlocked(point: THREE.Vector3): boolean {
  if (point.length() > PLATFORM_SAFE_RADIUS) return true;
  return OBSTACLES.some((o) => point.distanceTo(o.center) < o.radius);
}

/** A free-floor point for aimless wandering. Falls back to the centre if sampling keeps failing. */
export function randomWanderPoint(): THREE.Vector3 {
  for (let i = 0; i < 24; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.8 + Math.random() * (PLATFORM_SAFE_RADIUS - 2);
    const point = v(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    if (!isBlocked(point)) return point;
  }
  return v(0, 0, 0);
}

/**
 * One intermediate step that dodges the nearest obstacle, or null if the straight line is clear.
 * Not a real pathfinder — with four convex obstacles on an open floor, a single sidestep is
 * enough to stop agents walking through desks, and it costs nothing per frame.
 */
export function avoidanceWaypoint(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 | null {
  const direction = to.clone().sub(from);
  const distance = direction.length();
  if (distance < 0.001) return null;
  direction.divideScalar(distance);

  for (const obstacle of OBSTACLES) {
    const toObstacle = obstacle.center.clone().sub(from);
    const along = toObstacle.dot(direction);
    if (along <= 0 || along >= distance) continue;

    const closest = from.clone().addScaledVector(direction, along);
    const clearance = closest.distanceTo(obstacle.center);
    if (clearance >= obstacle.radius) continue;

    // Step sideways past the obstacle, on whichever side we are already drifting toward.
    const side = new THREE.Vector3(-direction.z, 0, direction.x);
    if (side.dot(closest.clone().sub(obstacle.center)) < 0) side.negate();

    const detour = obstacle.center.clone().addScaledVector(side, obstacle.radius + 0.75);
    detour.y = 0;
    if (!isBlocked(detour)) return detour;
  }
  return null;
}

/** Yaw that makes a character at `from` face `to`. Characters model-face +Z. */
export function yawToward(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** Shortest signed angular difference, so turns never take the long way round. */
export function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
