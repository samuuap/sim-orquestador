/**
 * A module-level registry of where every character currently is.
 *
 * Deliberately outside the Zustand store: this is written every frame by every character, and
 * putting per-frame data in React state would re-render the whole scene 60 times a second. Nothing
 * renders from this — it exists so characters can perceive each other and react.
 */

import * as THREE from 'three';
import type { AgentRole } from '@/types';
import type { Activity } from './officeMap';

export interface Presence {
  agentId: string;
  role: AgentRole;
  position: THREE.Vector3;
  activity: Activity;
  /** Clock time when this agent last greeted someone, so they do not wave on a loop. */
  lastGreetedAt: number;
  /** Who it greeted, so a pair exchanges one greeting rather than two unrelated ones. */
  lastGreetedId: string | null;
}

const registry = new Map<string, Presence>();

export function register(agentId: string, role: AgentRole): Presence {
  let presence = registry.get(agentId);
  if (!presence) {
    presence = {
      agentId,
      role,
      position: new THREE.Vector3(),
      activity: 'idle',
      lastGreetedAt: -Infinity,
      lastGreetedId: null,
    };
    registry.set(agentId, presence);
  }
  return presence;
}

export function unregister(agentId: string): void {
  registry.delete(agentId);
}

/** Nearest other character within `radius`, or null. Used for glances and greetings. */
export function nearestNeighbor(agentId: string, from: THREE.Vector3, radius: number): Presence | null {
  let best: Presence | null = null;
  let bestDistance = radius;

  registry.forEach((presence) => {
    if (presence.agentId === agentId) return;
    const distance = presence.position.distanceTo(from);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = presence;
    }
  });

  return best;
}

/** True if any other character already claimed this spot, so two agents never overlap. */
export function isSpotTaken(agentId: string, spot: THREE.Vector3, radius = 1.1): boolean {
  let taken = false;
  registry.forEach((presence) => {
    if (presence.agentId === agentId) return;
    if (presence.position.distanceTo(spot) < radius) taken = true;
  });
  return taken;
}
