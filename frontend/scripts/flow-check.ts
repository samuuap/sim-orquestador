/**
 * Live check of the meeting choreography contract.
 *
 * Requires a running backend on port 8000. Submits a proposal and asserts that every room and
 * participant the orchestrator broadcasts actually exists on the frontend side — a room id with no
 * entry in ROOMS, or an agent id the store does not know, leaves characters standing still with no
 * error logged anywhere.
 *
 *   npm run check:flow
 */

import * as THREE from 'three';
import {
  ARRIVAL_EPSILON,
  CORNER_EPSILON,
  DESKS,
  MEETING_WALK_SPEED,
  ROOMS,
  findPath,
} from '@/behavior/officeMap';

/** Seconds for the sit blend to finish, matching SIT_LAMBDA in useAgentLife. */
const SIT_SECONDS = Math.log(1 / 0.06) / 3.4;

const DESK_OF: Record<string, keyof typeof DESKS> = {
  ceo_001: 'ceo',
  pm_001: 'project_manager',
  designer_001: 'designer',
  developer_001: 'developer',
};

/** Simulate the walk exactly as advanceMovement does, and return how long it takes. */
function walkSeconds(from: THREE.Vector3, to: THREE.Vector3): number {
  const path = findPath(from, to);
  const pos = from.clone();
  let idx = 0;
  let t = 0;
  const dt = 1 / 60;
  while (t < 180) {
    const corner = path[idx] ?? to;
    const isFinal = idx >= path.length - 1;
    const d = corner.clone().sub(pos);
    d.y = 0;
    const dist = d.length();
    if (dist < (isFinal ? ARRIVAL_EPSILON : CORNER_EPSILON)) {
      if (isFinal) return t;
      idx += 1;
      continue;
    }
    const speed = MEETING_WALK_SPEED * (isFinal ? Math.min(1, 0.35 + dist) : 1);
    pos.addScaledVector(d.divideScalar(dist), Math.min(speed * dt, dist));
    t += dt;
  }
  return Infinity;
}

/** Agent ids the store hardcodes. patchAgent silently drops anything else. */
const KNOWN = new Set(['ceo_001', 'pm_001', 'designer_001', 'developer_001']);

let fail = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`);
};

const ws = new WebSocket('ws://127.0.0.1:8000/ws/office');
const meetings: Array<{ room: string; participants: string[]; settle: number }> = [];
const working = new Set<string>();
let complete = false;

ws.addEventListener('error', () => {
  console.log('  FAIL could not connect — is the backend running on port 8000?');
  process.exit(1);
});

ws.addEventListener('open', () =>
  setTimeout(
    () =>
      ws.send(
        JSON.stringify({
          type: 'SUBMIT_PROPOSAL',
          payload: { proposal: 'Build a task management web app with auth, a REST API and a React dashboard.' },
        }),
      ),
    500,
  ),
);

ws.addEventListener('message', (event: MessageEvent) => {
  const message = JSON.parse(String(event.data));
  const payload = message.payload ?? {};
  if (message.event_type === 'MEETING_STARTED') {
    meetings.push({
      room: payload.room,
      participants: payload.participants,
      settle: payload.settle_seconds ?? 0,
    });
  }
  if (message.event_type === 'AGENT_STATE_CHANGED' && payload.new_state === 'WORKING' && message.agent_id) {
    working.add(message.agent_id);
  }
  if (message.event_type === 'ORCHESTRATION_COMPLETE') complete = true;
});

setTimeout(() => {
  ws.close();

  console.log('=== meetings broadcast ===');
  meetings.forEach((m) => console.log(`  ${m.room.padEnd(13)} ${m.participants.join(', ')}`));

  console.log('\n=== contract ===');
  check('exactly two meetings', meetings.length === 2, `${meetings.length}`);
  check(
    'first is the office, CEO and PM',
    meetings[0]?.room === 'office' && meetings[0].participants.join(',') === 'ceo_001,pm_001',
  );
  check(
    'second is the meeting room, PM plus the team',
    meetings[1]?.room === 'meeting_room' &&
      meetings[1].participants.join(',') === 'pm_001,designer_001,developer_001',
  );
  check('every room id exists in ROOMS', meetings.every((m) => Boolean(ROOMS[m.room])));
  check(
    'every meeting has enough seats',
    meetings.every((m) => ROOMS[m.room] && m.participants.length <= ROOMS[m.room].seats.length),
  );
  check('every participant is an agent the store knows', meetings.every((m) => m.participants.every((id) => KNOWN.has(id))));
  check('every role has its own desk', Object.keys(DESKS).length === 4, Object.keys(DESKS).join(','));
  check('all four agents reach WORKING', working.size === 4, [...working].join(', '));
  check('the orchestration completes', complete);

  console.log('\n=== everyone is seated before anyone speaks ===');
  // The backend cannot see the animation, so it allows a fixed window for people to walk in and
  // sit. If the floor plan grows past that window the conversation starts over empty chairs —
  // which is invisible from the backend and easy to miss on screen.
  for (const meeting of meetings) {
    const room = ROOMS[meeting.room];
    if (!room) continue;
    let worst = 0;
    let slowest = '';
    meeting.participants.forEach((id, index) => {
      const desk = DESKS[DESK_OF[id]];
      const seat = room.seats[index % room.seats.length];
      if (!desk) return;
      const seconds = walkSeconds(desk.position, seat) + SIT_SECONDS;
      if (seconds > worst) {
        worst = seconds;
        slowest = id;
      }
    });
    check(
      `${meeting.room}: settle ${meeting.settle}s covers the ${worst.toFixed(1)}s needed by ${slowest}`,
      meeting.settle >= worst,
      meeting.settle >= worst ? '' : `short by ${(worst - meeting.settle).toFixed(1)}s`,
    );

    const assigned = meeting.participants.map((_, i) => i % room.seats.length);
    check(`${meeting.room}: every attendee gets their own chair`, new Set(assigned).size === assigned.length);
  }

  console.log(fail === 0 ? '\nFLOW CHECK PASSED' : `\nFLOW CHECK FAILED (${fail})`);
  process.exit(fail === 0 ? 0 : 1);
}, 150000);
