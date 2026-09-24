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

/**
 * Nearest other character within `radius`, or null. Used for glances and greetings.
 * Pass `only` to look up one specific agent instead, which is how listeners find the speaker.
 */
export function nearestNeighbor(
  agentId: string,
  from: THREE.Vector3,
  radius: number,
  only?: string,
): Presence | null {
  let best: Presence | null = null;
  let bestDistance = radius;

  registry.forEach((presence) => {
    if (presence.agentId === agentId) return;
    if (only && presence.agentId !== only) return;
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

/**
 * Who currently has the floor in a meeting.
 *
 * Without this everyone talks over each other and the room reads as noise rather than a
 * conversation. One speaker at a time, for a few seconds, and the rest turn to look at them.
 *
 * Module-level for the same reason as the registry: it is read every frame by every character.
 */
let floor: { speaker: string | null; until: number } = { speaker: null, until: 0 };

/** Claim the floor if it is free. Returns false if someone else is mid-sentence. */
export function tryTakeFloor(agentId: string, now: number, seconds: number): boolean {
  if (floor.speaker !== null && floor.speaker !== agentId && now < floor.until) return false;
  floor = { speaker: agentId, until: now + seconds };
  return true;
}

/** The current speaker, or null when nobody holds the floor. */
export function currentSpeaker(now: number): string | null {
  if (floor.speaker === null || now >= floor.until) return null;
  return floor.speaker;
}

/** Hand the floor to a specific agent. Used when the backend dictates who is speaking. */
export function setFloor(agentId: string, now: number, seconds: number): void {
  floor = { speaker: agentId, until: now + seconds };
}

export function releaseFloor(): void {
  floor = { speaker: null, until: 0 };
}
