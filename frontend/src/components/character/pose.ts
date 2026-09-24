/**
 * Arm kinematics and gesture timing.
 *
 * Extracted from the character component so it can be exercised headlessly — the first version of
 * these poses shipped with the elbow sign inverted (hands ended up behind the body while drinking),
 * and nothing could catch that without being able to run the maths outside React.
 */

import { P } from './appearance';

/**
 * Two-link IK for one arm, in the sagittal plane.
 *
 * Poses are declared as WHERE THE HAND GOES rather than as joint angles. The first version used
 * hand-tuned angles with the elbow sign inverted, which put the hand behind the body while
 * "drinking" or "thinking" — a human elbow only bends forward. Solving it removes the whole class
 * of bug and keeps poses correct if the proportions change.
 *
 * Target is relative to the shoulder: +y up, +z forward. Returned elbow is always negative.
 */
export function solveArm(dy: number, dz: number): { shoulder: number; elbow: number } {
  const L1 = P.upperArm;
  const L2 = P.foreArm;
  const d = Math.min(Math.hypot(dy, dz), L1 + L2 - 0.005);
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const alpha = Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)));
  const delta = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
  return { shoulder: Math.atan2(-dz, -dy) + delta, elbow: -(Math.PI - alpha) };
}

/**
 * Gesture timing: anticipation -> action -> hold -> settle.
 *
 * A plain sine envelope moves every channel with identical symmetric easing, which is the classic
 * recipe for motion that reads as mechanical. This dips against the movement first, snaps into the
 * pose, HOLDS so the pose is legible, then settles.
 */
export function actingCurve(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 0;
  if (u < 0.14) return -0.22 * Math.sin((u / 0.14) * Math.PI); // anticipation, against the action
  if (u < 0.34) {
    const t = (u - 0.14) / 0.2;
    const back = 1.7;
    return 1 + (back + 1) * Math.pow(t - 1, 3) + back * Math.pow(t - 1, 2); // easeOutBack
  }
  if (u < 0.72) return 1; // hold: the pose is readable only if it stops here
  const t = (u - 0.72) / 0.28;
  return 1 - (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
}


/**
 * Seated joint angles.
 *
 * A hip group hangs along -Y and positive rotation swings it backward, so -PI/2 puts the thigh
 * horizontal and forward. +PI/2 at the knee then drops the shin straight down, which leaves the
 * accumulated ankle angle at zero and the sole flat on the floor.
 */
export const SEATED = { hip: -Math.PI / 2, knee: Math.PI / 2, ankle: 0 } as const;

