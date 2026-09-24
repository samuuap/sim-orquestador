/**
 * The autonomous behaviour layer.
 *
 * Two sources drive a character:
 *   1. Backend agent state (THINKING / COMPLETED / ERROR ...) — always wins.
 *   2. Its own boredom — what it does when the backend has nothing to say.
 *
 * Without (2) the office is three statues, because in practice the backend only ever emits
 * IDLE, THINKING and COMPLETED, and spends most of its time in IDLE.
 *
 * All mutable state lives in a ref and is updated inside useFrame. Nothing here triggers a React
 * render; the renderer reads the same ref while posing the skeleton.
 */

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Agent } from '@/types';
import {
  DESKS,
  SHARED_WAYPOINTS,
  type Activity,
  type Waypoint,
  angleDelta,
  avoidanceWaypoint,
  isBlocked,
  randomWanderPoint,
  yawToward,
} from './officeMap';
import { isSpotTaken, nearestNeighbor, register, unregister } from './agentRegistry';

export type Gesture =
  | 'none'
  | 'wave'
  | 'stretch'
  | 'scratchHead'
  | 'checkWatch'
  | 'shrug'
  | 'nod'
  | 'sip'
  | 'point';

export interface LifeState {
  activity: Activity;
  position: THREE.Vector3;
  yaw: number;
  targetYaw: number;
  /** Final destination, or null when standing still. */
  destination: THREE.Vector3 | null;
  /** One-step detour around furniture; consumed before `destination`. */
  detour: THREE.Vector3 | null;
  /** What to do once `destination` is reached. */
  arrivalActivity: Activity;
  arrivalLookAt: THREE.Vector3 | null;
  arrivalLinger: number;
  /** Advances only while walking; drives the leg and arm swing. */
  walkPhase: number;
  /** 0..1, how much of the walk pose to blend in. Smooths starts and stops. */
  walkBlend: number;
  busyUntil: number;
  gesture: Gesture;
  gestureStart: number;
  gestureDuration: number;
  /** Head look offsets, relative to body facing. */
  headYaw: number;
  headPitch: number;
  targetHeadYaw: number;
  targetHeadPitch: number;
  nextHeadShift: number;
  /** 1 = eyes open, 0 = shut. */
  eyeOpen: number;
  nextBlink: number;
  blinkUntil: number;
  /** Short text shown in a bubble above the head, or null. */
  bubble: string | null;
  bubbleUntil: number;
  /** Last backend state seen, so transitions fire once. */
  lastBackendState: string;
}

const WALK_SPEED = 1.35;
const TURN_SPEED = 7.5;
const ARRIVAL_EPSILON = 0.12;

const IDLE_GESTURES: Gesture[] = ['stretch', 'scratchHead', 'checkWatch', 'shrug', 'nod'];

const THINKING_BUBBLES = ['...', '?', 'hm'];
const TALKING_BUBBLES = ['!', 'ha', 'yes', 'ok', '?'];

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function createLifeState(home: THREE.Vector3): LifeState {
  return {
    activity: 'idle',
    position: home.clone(),
    yaw: 0,
    targetYaw: 0,
    destination: null,
    detour: null,
    arrivalActivity: 'idle',
    arrivalLookAt: null,
    arrivalLinger: 0,
    walkPhase: 0,
    walkBlend: 0,
    busyUntil: 0,
    gesture: 'none',
    gestureStart: 0,
    gestureDuration: 0,
    headYaw: 0,
    headPitch: 0,
    targetHeadYaw: 0,
    targetHeadPitch: 0,
    nextHeadShift: 0,
    eyeOpen: 1,
    nextBlink: 2,
    blinkUntil: 0,
    bubble: null,
    bubbleUntil: 0,
    lastBackendState: 'IDLE',
  };
}

function startGesture(life: LifeState, gesture: Gesture, now: number, duration: number): void {
  life.gesture = gesture;
  life.gestureStart = now;
  life.gestureDuration = duration;
}

function say(life: LifeState, text: string, now: number, duration = 2.2): void {
  life.bubble = text;
  life.bubbleUntil = now + duration;
}

/** Send the character to a waypoint. It starts walking; `arrivalActivity` begins on arrival. */
function travelTo(life: LifeState, waypoint: Waypoint, now: number): void {
  life.destination = waypoint.position.clone();
  life.detour = avoidanceWaypoint(life.position, waypoint.position);
  life.arrivalActivity = waypoint.activity;
  life.arrivalLookAt = waypoint.lookAt.clone();
  life.arrivalLinger = randomBetween(waypoint.linger[0], waypoint.linger[1]);
  life.activity = 'walking';
  life.busyUntil = now + 30; // safety cap; arrival clears this
}

function travelToPoint(life: LifeState, point: THREE.Vector3, now: number, linger: number): void {
  life.destination = point.clone();
  life.detour = avoidanceWaypoint(life.position, point);
  life.arrivalActivity = 'idle';
  life.arrivalLookAt = null;
  life.arrivalLinger = linger;
  life.activity = 'walking';
  life.busyUntil = now + 30;
}

export function useAgentLife(agent: Agent): React.MutableRefObject<LifeState> {
  const desk = DESKS[agent.role];
  const lifeRef = useRef<LifeState>(createLifeState(desk.position));

  // Face the desk on first mount so the opening frame is not everyone staring at the origin.
  const initialised = useRef(false);
  if (!initialised.current) {
    const life = lifeRef.current;
    life.yaw = yawToward(life.position, desk.lookAt);
    life.targetYaw = life.yaw;
    initialised.current = true;
  }

  useEffect(() => {
    const id = agent.agent_id;
    return () => unregister(id);
  }, [agent.agent_id]);

  useFrame((state, rawDelta) => {
    const life = lifeRef.current;
    const now = state.clock.getElapsedTime();
    // Clamp so a backgrounded tab does not teleport everyone on return.
    const delta = Math.min(rawDelta, 0.05);

    applyBackendState(life, agent.state, desk, now);
    if (now >= life.busyUntil && life.activity !== 'walking') {
      decideNextActivity(life, agent, desk, now);
    }

    advanceMovement(life, delta, now);
    advanceHead(life, agent, now, delta);
    advanceBlink(life, now, delta);

    if (life.bubble && now > life.bubbleUntil) life.bubble = null;
    if (life.gesture !== 'none' && now > life.gestureStart + life.gestureDuration) {
      life.gesture = 'none';
    }

    // Looked up per frame rather than cached in a ref: under StrictMode the mount/unmount/mount
    // cycle unregisters and re-creates the Presence, and a cached reference would keep writing
    // into the orphaned object while everyone else read a stale one stuck at the origin.
    const presence = register(agent.agent_id, agent.role);
    presence.position.copy(life.position);
    presence.activity = life.activity;
  });

  return lifeRef;
}

/** Backend state overrides autonomy. Only reacts on change, so it does not fight the scheduler. */
function applyBackendState(life: LifeState, backendState: string, desk: Waypoint, now: number): void {
  if (backendState === life.lastBackendState) return;
  life.lastBackendState = backendState;

  switch (backendState) {
    case 'THINKING':
    case 'WORKING':
      // Drop whatever it was doing and head to its own desk.
      travelTo(life, { ...desk, activity: backendState === 'THINKING' ? 'thinking' : 'working' }, now);
      say(life, pick(THINKING_BUBBLES), now, 2.5);
      break;

    case 'COMPLETED':
      life.activity = 'celebrating';
      life.destination = null;
      life.detour = null;
      life.busyUntil = now + 2.6;
      startGesture(life, 'wave', now, 2.4);
      say(life, 'done!', now, 2.6);
      break;

    case 'ERROR':
      life.activity = 'frustrated';
      life.destination = null;
      life.detour = null;
      life.busyUntil = now + 3;
      startGesture(life, 'shrug', now, 2.4);
      say(life, '!', now, 3);
      break;

    case 'WAITING':
      life.activity = 'idle';
      life.busyUntil = now + 2;
      break;

    default:
      // Back to IDLE: release the character to its own devices on the next tick.
      life.busyUntil = now;
      break;
  }
}

/** What to do when nothing is being asked of it. Weighted, so behaviour has a rhythm. */
function decideNextActivity(life: LifeState, agent: Agent, desk: Waypoint, now: number): void {
  // Never wander off mid-job: if the backend still has it busy, stay at the desk.
  if (agent.state === 'THINKING' || agent.state === 'WORKING') {
    life.activity = agent.state === 'THINKING' ? 'thinking' : 'working';
    life.busyUntil = now + randomBetween(3, 6);
    if (Math.random() < 0.3) say(life, pick(THINKING_BUBBLES), now, 2);
    return;
  }

  const roll = Math.random();

  if (roll < 0.26) {
    travelTo(life, desk, now);
    return;
  }

  if (roll < 0.62) {
    const options = SHARED_WAYPOINTS.filter(
      (waypoint) => !isSpotTaken(agent.agent_id, waypoint.position),
    );
    if (options.length > 0) {
      travelTo(life, pick(options), now);
      return;
    }
  }

  if (roll < 0.85) {
    const point = randomWanderPoint();
    if (!isBlocked(point)) {
      travelToPoint(life, point, now, randomBetween(3, 7));
      return;
    }
  }

  // Stay put and do something small.
  life.activity = 'idle';
  life.busyUntil = now + randomBetween(3, 8);
  startGesture(life, pick(IDLE_GESTURES), now, randomBetween(1.4, 2.2));
}

function advanceMovement(life: LifeState, delta: number, now: number): void {
  if (life.activity === 'walking' && life.destination) {
    // Safety valve: the scheduler will not re-decide while walking, so an unreachable
    // destination would freeze the character permanently. Give up and arrive in place.
    if (now > life.busyUntil) {
      arrive(life, now);
      return;
    }

    const waypoint = life.detour ?? life.destination;
    const toTarget = waypoint.clone().sub(life.position);
    toTarget.y = 0;
    const distance = toTarget.length();

    if (distance < ARRIVAL_EPSILON) {
      if (life.detour) {
        // Cleared the furniture; resume the real approach.
        life.detour = null;
      } else {
        arrive(life, now);
      }
    } else {
      toTarget.divideScalar(distance);
      // Ease into the last few centimetres so characters do not stop dead.
      const speed = WALK_SPEED * Math.min(1, 0.35 + distance);
      life.position.addScaledVector(toTarget, Math.min(speed * delta, distance));
      life.targetYaw = Math.atan2(toTarget.x, toTarget.z);
      life.walkPhase += delta * speed * 5.4;
    }
  }

  const walking = life.activity === 'walking';
  const blendTarget = walking ? 1 : 0;
  life.walkBlend += (blendTarget - life.walkBlend) * Math.min(1, delta * 9);

  const turn = angleDelta(life.yaw, life.targetYaw);
  life.yaw += turn * Math.min(1, delta * TURN_SPEED);
}

function arrive(life: LifeState, now: number): void {
  life.destination = null;
  life.detour = null;
  life.activity = life.arrivalActivity;
  life.busyUntil = now + life.arrivalLinger;

  if (life.arrivalLookAt) {
    life.targetYaw = yawToward(life.position, life.arrivalLookAt);
    life.arrivalLookAt = null;
  }

  if (life.activity === 'drinking') startGesture(life, 'sip', now, 2.4);
  if (life.activity === 'presenting') startGesture(life, 'point', now, 2.6);
  if (life.activity === 'talking') say(life, pick(TALKING_BUBBLES), now, 2.4);
}

/**
 * Head motion. Looking at whoever is nearby is the cheapest possible signal that a character is
 * aware of the world rather than playing a loop.
 */
function advanceHead(life: LifeState, agent: Agent, now: number, delta: number): void {
  const neighbor = nearestNeighbor(agent.agent_id, life.position, 3.2);

  if (neighbor && life.activity !== 'walking') {
    const desired = yawToward(life.position, neighbor.position);
    const relative = angleDelta(life.yaw, desired);
    // Only turn the head if the neighbour is roughly in front; otherwise ignore them.
    if (Math.abs(relative) < 1.5) {
      life.targetHeadYaw = relative;
      life.targetHeadPitch = 0;

      const presence = neighbor;
      const canGreet =
        now - presence.lastGreetedAt > 14 &&
        life.gesture === 'none' &&
        life.position.distanceTo(presence.position) < 2.4;

      if (canGreet) {
        presence.lastGreetedAt = now;
        presence.lastGreetedId = agent.agent_id;
        startGesture(life, 'wave', now, 1.6);
        say(life, 'hey', now, 1.8);
      }
    }
  } else if (now > life.nextHeadShift) {
    life.nextHeadShift = now + randomBetween(1.8, 5);
    life.targetHeadYaw = life.activity === 'walking' ? 0 : randomBetween(-0.55, 0.55);
    life.targetHeadPitch = life.activity === 'working' ? 0.28 : randomBetween(-0.12, 0.2);
  }

  const ease = Math.min(1, delta * 3.4);
  life.headYaw += (life.targetHeadYaw - life.headYaw) * ease;
  life.headPitch += (life.targetHeadPitch - life.headPitch) * ease;
}

function advanceBlink(life: LifeState, now: number, delta: number): void {
  if (now > life.nextBlink) {
    life.blinkUntil = now + 0.1;
    life.nextBlink = now + randomBetween(2.2, 6.5);
  }
  const target = now < life.blinkUntil ? 0.05 : 1;
  life.eyeOpen += (target - life.eyeOpen) * Math.min(1, delta * 26);
}
