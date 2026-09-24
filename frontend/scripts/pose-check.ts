/**
 * Anatomy and timing regression check for the character rig.
 *
 * Exists because the first rig shipped with the elbow rotation inverted: hands ended up BEHIND the
 * body in idle, thinking and drinking poses. That is invisible in a typecheck and easy to miss on
 * screen from an isometric camera, so it is asserted here instead.
 *
 *   npm run check:pose
 */

import { P } from '@/components/character/appearance';
import { SEATED, actingCurve, solveArm } from '@/components/character/pose';
import { currentSpeaker, releaseFloor, tryTakeFloor } from '@/behavior/agentRegistry';

let fail = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) fail += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`);
};

/** Forward kinematics, mirroring the group hierarchy in SimCharacter. */
function hand(shoulder: number, elbow: number) {
  const t = shoulder + elbow;
  return {
    y: -P.upperArm * Math.cos(shoulder) - P.foreArm * Math.cos(t),
    z: -P.upperArm * Math.sin(shoulder) - P.foreArm * Math.sin(t),
  };
}

// Every pose the character can hold, as hand targets relative to the shoulder.
const POSES: Array<[string, number, number]> = [
  ['idle', -0.52, 0.06],
  ['working', -0.3, 0.4],
  ['thinking (chin)', 0.15, 0.14],
  ['drinking (mouth)', 0.17, 0.1],
  ['talking', -0.18, 0.34],
  ['presenting', 0.06, 0.48],
  ['celebrating', 0.5, 0.06],
  ['frustrated', -0.3, 0.2],
  ['wave', 0.34, 0.24],
  ['stretch', 0.52, -0.08],
  ['scratchHead', 0.28, 0.04],
  ['checkWatch', -0.06, 0.3],
  ['point', 0.06, 0.5],
];

console.log('=== IK reaches each declared hand target ===');
for (const [name, dy, dz] of POSES) {
  const { shoulder, elbow } = solveArm(dy, dz);
  const h = hand(shoulder, elbow);
  const err = Math.hypot(h.y - dy, h.z - dz);
  check(`${name} err=${err.toFixed(4)}`, err < 0.01);
}

console.log('\n=== elbow always bends forward (the inverted-arm bug) ===');
for (const [name, dy, dz] of POSES) {
  const { elbow } = solveArm(dy, dz);
  check(`${name} elbow=${elbow.toFixed(2)}`, elbow <= 0.001, elbow > 0 ? '-> bends BACKWARD' : '');
}

console.log('\n=== no pose is outside the arm’s reach ===');
const reach = P.upperArm + P.foreArm;
for (const [name, dy, dz] of POSES) {
  const d = Math.hypot(dy, dz);
  check(`${name} d=${d.toFixed(2)} / reach ${reach.toFixed(2)}`, d <= reach);
}

console.log('\n=== hands can reach the desk surface ===');
// Desk top is 1.02 world; the shoulder sits at P.shoulderY. Typing target is 0.08 above the top.
const deskReachDy = 1.02 + 0.08 - P.shoulderY;
check(
  `desk at 1.02 reachable (need dy=${deskReachDy.toFixed(2)}, dz=0.40)`,
  Math.hypot(deskReachDy, 0.4) <= reach,
  `dist ${Math.hypot(deskReachDy, 0.4).toFixed(2)}`,
);

console.log('\n=== acting curve: anticipation, hold, settle ===');
const sample = (u: number) => actingCurve(u);
check('starts at rest', Math.abs(sample(0)) < 1e-6);
check('anticipates against the action', sample(0.07) < -0.05, `value ${sample(0.07).toFixed(3)}`);
check('holds at full pose', Math.abs(sample(0.5) - 1) < 1e-6, `value ${sample(0.5).toFixed(3)}`);
check('still holding late', Math.abs(sample(0.7) - 1) < 1e-6);
check('settles back to rest', Math.abs(sample(1)) < 1e-6);
check('overshoots on the way in', Math.max(sample(0.3), sample(0.32), sample(0.33)) > 1.0);

console.log('\n=== seated pose lands on the chair, feet on the floor ===');
{
  // Mirrors the hierarchy in SimCharacter: hips drop by sitDrop, then thigh -> knee -> shin ->
  // ankle -> foot. All in local units; heightScale cancels out for the floor check below.
  const SEAT_HEIGHT = 0.51;
  const heightScale = 1.0;
  const sitDrop = P.hipY - SEAT_HEIGHT / heightScale;

  const hipY = P.hipY - sitDrop;
  check(`hips land on the seat (${hipY.toFixed(3)} vs ${SEAT_HEIGHT})`, Math.abs(hipY - SEAT_HEIGHT) < 0.005);

  // thigh end (knee), from the hip
  const kneeY = hipY - P.thigh * Math.cos(SEATED.hip);
  const kneeZ = -P.thigh * Math.sin(SEATED.hip);
  check(`thigh is horizontal (knee at y=${kneeY.toFixed(3)})`, Math.abs(kneeY - hipY) < 0.01);
  check(`knees point forward (z=${kneeZ.toFixed(2)})`, kneeZ > 0.3);

  // shin end (ankle), accumulated angle
  const shinAngle = SEATED.hip + SEATED.knee;
  const ankleY = kneeY - P.shin * Math.cos(shinAngle);
  const ankleZ = kneeZ - P.shin * Math.sin(shinAngle);
  check(`shins hang vertically (ankle at z=${ankleZ.toFixed(2)}, knee z=${kneeZ.toFixed(2)})`,
    Math.abs(ankleZ - kneeZ) < 0.01);

  // the sole: foot mesh sits 0.028 below the ankle, half-height 0.028
  const soleY = ankleY - 0.028 - 0.028;
  check(`soles rest on the floor (y=${soleY.toFixed(3)})`, soleY > -0.03 && soleY < 0.08);
  check(`sole is flat (accumulated angle ${(shinAngle + SEATED.ankle).toFixed(3)})`,
    Math.abs(shinAngle + SEATED.ankle) < 0.01);

  // knees must not end up above the hips, which reads as crouching rather than sitting
  check('knees are not above the hips', kneeY <= hipY + 0.02);
}

console.log('\n=== meeting floor: one speaker at a time ===');
{
  releaseFloor();
  check('the floor starts free', currentSpeaker(0) === null);
  check('first asker gets it', tryTakeFloor('a', 0, 3));
  check('a second asker is refused while it is held', !tryTakeFloor('b', 1, 3));
  check('the holder is reported as speaker', currentSpeaker(1) === 'a');
  check('the floor frees when the turn expires', currentSpeaker(3.1) === null);
  check('the next asker gets it after expiry', tryTakeFloor('b', 3.1, 3));
  check('the new holder is the speaker', currentSpeaker(3.2) === 'b');
  check('the holder may extend their own turn', tryTakeFloor('b', 3.5, 3));

  // Three agents contending over a simulated meeting: nobody should ever overlap.
  releaseFloor();
  const speakers = ['ceo_001', 'designer_001', 'developer_001'];
  const turns: string[] = [];
  let overlaps = 0;
  for (let t = 0; t < 120; t += 0.1) {
    const held = currentSpeaker(t);
    for (const id of speakers) {
      if (Math.random() < 0.08 && tryTakeFloor(id, t, 3)) {
        if (held !== null && held !== id) overlaps += 1;
        if (turns[turns.length - 1] !== id) turns.push(id);
      }
    }
  }
  check('no speaker ever interrupts another', overlaps === 0, `${overlaps} overlaps`);
  check('the turn rotates between agents', new Set(turns).size === 3, `speakers: ${new Set(turns).size}`);
  releaseFloor();
}

console.log(fail === 0 ? '\nPOSE CHECKS PASSED' : `\nPOSE CHECKS FAILED (${fail})`);
process.exit(fail === 0 ? 0 : 1);
