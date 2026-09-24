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
import type { ActiveDialogue, ActiveMeeting, Agent } from '@/types';
import {
  DESKS,
  ROOMS,
  SHARED_WAYPOINTS,
  type Activity,
  type Waypoint,
  ARRIVAL_EPSILON,
  CORNER_EPSILON,
  MEETING_WALK_SPEED,
  WALK_SPEED,
  angleDelta,
  findPath,
  randomWanderPoint,
  yawToward,
} from './officeMap';
import {
  currentSpeaker,
  isSpotTaken,
  nearestNeighbor,
  register,
  releaseFloor,
  setFloor,
  unregister,
} from './agentRegistry';
import { useAppStore } from '@/store';

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
  /** Corners from A*, walked in order. Empty when not travelling. */
  path: THREE.Vector3[];
  pathIndex: number;
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
  /** True while the backend has this agent gathered in a room. Overrides everything else. */
  inMeeting: boolean;
  /** Identity of the meeting currently applied, so the transition fires once. */
  meetingKey: string | null;
  /** Id of the last dialogue line already spoken, so each line is delivered once. */
  lastDialogueId: number;
  /** Metres per second for the current journey. */
  walkSpeed: number;
  /** Target: true once seated at a meeting chair. */
  seated: boolean;
  /** Whether arriving at the current destination means sitting down. */
  sitOnArrival: boolean;
  /** 0 = standing, 1 = fully seated. Animated, so sitting and rising take time. */
  sitBlend: number;
  /** Height of the chair currently being used, so the hips land on the seat. */
  seatHeight: number;
  /** Set when a meeting ends: walk to the desk, but only once back on both feet. */
  pendingDesk: boolean;
}

/** Meetings last until the backend says otherwise, so the seat linger is effectively unbounded. */
const MEETING_LINGER = 3600;

/** How long rising from a chair takes before walking is allowed. */
const STAND_UP_SECONDS = 1.1;
/** Rate the sit blend moves at; sitting is slightly slower than standing up. */
const SIT_LAMBDA = 3.4;
const STAND_LAMBDA = 4.6;


const TURN_SPEED = 7.5;


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
    path: [],
    pathIndex: 0,
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
    inMeeting: false,
    meetingKey: null,
    lastDialogueId: 0,
    walkSpeed: WALK_SPEED,
    seated: false,
    sitOnArrival: false,
    sitBlend: 0,
    seatHeight: 0.51,
    pendingDesk: false,
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

/** Route the character to a point. A* runs here, once per decision — never inside the frame loop. */
function startTravel(
  life: LifeState,
  destination: THREE.Vector3,
  now: number,
  arrivalActivity: Activity,
  arrivalLookAt: THREE.Vector3 | null,
  linger: number,
  speed: number = WALK_SPEED,
): void {
  life.destination = destination.clone();
  life.path = findPath(life.position, destination);
  life.pathIndex = 0;
  life.arrivalActivity = arrivalActivity;
  life.arrivalLookAt = arrivalLookAt ? arrivalLookAt.clone() : null;
  life.arrivalLinger = linger;
  life.walkSpeed = speed;
  life.activity = 'walking';
  // Generous cap proportional to the route; the safety valve in advanceMovement uses it.
  life.busyUntil = now + 8 + (life.position.distanceTo(destination) / speed) * 3;
}

function travelTo(life: LifeState, waypoint: Waypoint, now: number): void {
  startTravel(
    life,
    waypoint.position,
    now,
    waypoint.activity,
    waypoint.lookAt,
    randomBetween(waypoint.linger[0], waypoint.linger[1]),
  );
}

function travelToPoint(life: LifeState, point: THREE.Vector3, now: number, linger: number): void {
  startTravel(life, point, now, 'idle', null, linger);
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

  // Meetings change twice per orchestration, so a store subscription is cheap. Mirrored into a
  // ref because useFrame must not close over a changing value.
  const meeting = useAppStore((state) => state.activeMeeting);
  const meetingRef = useRef(meeting);
  meetingRef.current = meeting;

  // Who says what is decided by the orchestrator, from the real plan. The client only performs
  // it — inventing chatter here would put words in an agent's mouth that no work backs up.
  const dialogue = useAppStore((state) => state.activeDialogue);
  const dialogueRef = useRef(dialogue);
  dialogueRef.current = dialogue;

  useFrame((state, rawDelta) => {
    const life = lifeRef.current;
    const now = state.clock.getElapsedTime();
    // Clamp so a backgrounded tab does not teleport everyone on return.
    const delta = Math.min(rawDelta, 0.05);

    applyMeeting(life, agent, desk, meetingRef.current, now);
    // A summons outranks the agent's own task state: an agent called into a room does not walk
    // back to its desk because the backend happened to mark it WORKING.
    if (!life.inMeeting) applyBackendState(life, agent.state, desk, now);
    if (!life.inMeeting && now >= life.busyUntil && life.activity !== 'walking') {
      decideNextActivity(life, agent, desk, now);
    }
    applyDialogue(life, agent, dialogueRef.current, now);

    // Sitting and rising are animated, so nothing else may move the character mid-transition.
    const sitTarget = life.seated ? 1 : 0;
    const lambda = life.seated ? SIT_LAMBDA : STAND_LAMBDA;
    life.sitBlend += (sitTarget - life.sitBlend) * (1 - Math.exp(-lambda * delta));

    if (life.pendingDesk && !life.inMeeting && now >= life.busyUntil && life.sitBlend < 0.06) {
      life.pendingDesk = false;
      travelTo(life, desk, now);
    }

    if (life.sitBlend < 0.06) advanceMovement(life, delta, now);
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

/**
 * Deliver the line the orchestrator is currently playing.
 *
 * Only the named speaker performs it; everyone else sees the floor move and turns to look. The
 * line's own duration sets both how long the bubble stays and how long the floor is held, so the
 * animation stays in step with the backend's playback without either side polling the other.
 */
function applyDialogue(
  life: LifeState,
  agent: Agent,
  dialogue: ActiveDialogue | null,
  now: number,
): void {
  if (!dialogue || dialogue.id === life.lastDialogueId) return;
  life.lastDialogueId = dialogue.id;

  if (dialogue.speaker !== agent.agent_id) return;

  // Hold the bubble slightly longer than the line, so it does not vanish on the last syllable.
  say(life, dialogue.text, now, dialogue.seconds + 0.4);
  setFloor(agent.agent_id, now, dialogue.seconds);

  // Gesture only on the longer lines: waving through a two-word answer looks manic.
  if (dialogue.seconds > 2.6 && life.gesture === 'none') {
    startGesture(life, pick(['point', 'nod', 'shrug'] as const), now, Math.min(2.2, dialogue.seconds));
  }
}

/**
 * Apply a summons to a room.
 *
 * Participants take the seat matching their index in the payload, so the agent the backend lists
 * first — the CEO in the briefing, the PM at the standup — takes the head of the table, and two
 * agents can never claim the same chair.
 *
 * When the meeting ends they walk to their own desk rather than back to whatever they were doing,
 * which is what "and then they go to work" means on screen.
 */
function applyMeeting(
  life: LifeState,
  agent: Agent,
  desk: Waypoint,
  meeting: ActiveMeeting | null,
  now: number,
): void {
  const mine = meeting && meeting.participants.includes(agent.agent_id) ? meeting : null;
  const key = mine ? `${mine.room}:${mine.participants.join(',')}` : null;
  if (key === life.meetingKey) return;

  life.meetingKey = key;

  if (!mine) {
    life.inMeeting = false;
    life.sitOnArrival = false;
    releaseFloor();
    if (life.seated) {
      // Stand up first. Walking out of a chair while still seated reads as sliding.
      life.seated = false;
      life.pendingDesk = true;
      life.activity = 'idle';
      life.destination = null;
      life.path = [];
      life.busyUntil = now + STAND_UP_SECONDS;
      startGesture(life, 'stretch', now, 1.2);
    } else {
      travelTo(life, desk, now);
    }
    return;
  }

  const room = ROOMS[mine.room];
  if (!room) {
    // Unknown room id: better to keep working than to walk into a wall.
    life.inMeeting = false;
    return;
  }

  const index = mine.participants.indexOf(agent.agent_id);
  const seat = room.seats[index % room.seats.length];

  life.inMeeting = true;
  life.seatHeight = room.seatHeight;
  life.sitOnArrival = true;
  // Stand up before walking. The office meeting ends and the standup begins within the same
  // frame, so without this the PM would glide from one room to the next still sitting down.
  // Movement is gated on sitBlend, so the walk simply waits for them to get up.
  life.seated = false;
  life.pendingDesk = false;
  startTravel(life, seat, now, 'talking', room.focus, MEETING_LINGER, MEETING_WALK_SPEED);

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
      life.path = [];
      life.busyUntil = now + 2.6;
      startGesture(life, 'wave', now, 2.4);
      say(life, 'done!', now, 2.6);
      break;

    case 'ERROR':
      life.activity = 'frustrated';
      life.destination = null;
      life.path = [];
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
    travelToPoint(life, randomWanderPoint(), now, randomBetween(3, 7));
    return;
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

    const corner = life.path[life.pathIndex] ?? life.destination;
    const toTarget = corner.clone().sub(life.position);
    toTarget.y = 0;
    const distance = toTarget.length();
    const isFinal = life.pathIndex >= life.path.length - 1;

    // Intermediate corners are cut early so turns round off instead of pivoting on the spot.
    const threshold = isFinal ? ARRIVAL_EPSILON : CORNER_EPSILON;

    if (distance < threshold) {
      if (isFinal) {
        arrive(life, now);
      } else {
        life.pathIndex += 1;
      }
    } else {
      toTarget.divideScalar(distance);
      // Only ease down on the final approach, not at every corner.
      const speed = life.walkSpeed * (isFinal ? Math.min(1, 0.35 + distance) : 1);
      life.position.addScaledVector(toTarget, Math.min(speed * delta, distance));
      life.targetYaw = Math.atan2(toTarget.x, toTarget.z);
      life.walkPhase += delta * speed * 5.0;
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
  life.path = [];
  life.pathIndex = 0;
  life.activity = life.arrivalActivity;
  life.busyUntil = now + life.arrivalLinger;

  if (life.arrivalLookAt) {
    life.targetYaw = yawToward(life.position, life.arrivalLookAt);
    life.arrivalLookAt = null;
  }

  if (life.sitOnArrival) {
    life.seated = true;
    life.sitOnArrival = false;
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
  // In a meeting, attention follows the speaker rather than whoever happens to be closest.
  if (life.inMeeting) {
    const speaker = currentSpeaker(now);
    const target =
      speaker && speaker !== agent.agent_id
        ? nearestNeighbor(agent.agent_id, life.position, 12, speaker)
        : null;

    if (target) {
      const relative = angleDelta(life.yaw, yawToward(life.position, target.position));
      life.targetHeadYaw = Math.max(-1.1, Math.min(1.1, relative));
      life.targetHeadPitch = 0;
      // An occasional nod is the cheapest possible "I am listening".
      if (life.gesture === 'none' && Math.random() < 0.004) {
        startGesture(life, 'nod', now, 1.2);
      }
    } else if (now > life.nextHeadShift) {
      life.nextHeadShift = now + randomBetween(2, 4);
      life.targetHeadYaw = randomBetween(-0.3, 0.3);
      life.targetHeadPitch = randomBetween(-0.08, 0.12);
    }

    const easeMeeting = Math.min(1, delta * 3.4);
    life.headYaw += (life.targetHeadYaw - life.headYaw) * easeMeeting;
    life.headPitch += (life.targetHeadPitch - life.headPitch) * easeMeeting;
    return;
  }

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
