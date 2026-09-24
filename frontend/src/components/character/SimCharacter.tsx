/**
 * Articulated humanoid built from primitives.
 *
 * The important change over the first version: limbs are TWO segments with real elbow and knee
 * joints, plus sphere caps at every joint so rotation never opens a gap. Single-segment limbs are
 * what made the earlier characters read as placeholders — a leg that cannot bend cannot walk.
 *
 * Hierarchy (each level is a rotation pivot):
 *   hip -> thigh -> knee -> shin -> ankle -> foot
 *   shoulder -> upperArm -> elbow -> foreArm -> wrist -> hand
 *
 * Every mesh takes a shared material from assets/materials.ts; none are declared inline.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AgentRole } from '@/types';
import type { LifeState } from '@/behavior/useAgentLife';
import { WORLD, characterMaterials } from '@/assets/materials';
import { P, type Appearance } from './appearance';
import { SEATED, actingCurve, solveArm } from './pose';

interface SimCharacterProps {
  role: AgentRole;
  appearance: Appearance;
  life: React.MutableRefObject<LifeState>;
}

interface LimbPose {
  hip: number;
  knee: number;
  ankle: number;
  shoulder: number;
  shoulderZ: number;
  elbow: number;
}

function damp(current: number, target: number, lambda: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

export function SimCharacter({ role, appearance, life }: SimCharacterProps) {
  const m = useMemo(() => characterMaterials(role), [role]);

  const facing = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);

  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const ankleL = useRef<THREE.Group>(null);
  const ankleR = useRef<THREE.Group>(null);

  const shoulderL = useRef<THREE.Group>(null);
  const shoulderR = useRef<THREE.Group>(null);
  const elbowL = useRef<THREE.Group>(null);
  const elbowR = useRef<THREE.Group>(null);

  useFrame((state, rawDelta) => {
    const l = life.current;
    const now = state.clock.getElapsedTime();
    const delta = Math.min(rawDelta, 0.05);
    const walk = l.walkBlend;

    if (facing.current) facing.current.rotation.y = l.yaw;

    // ---- gait -------------------------------------------------------------------------------
    // A leg group rotates about X; positive X swings the foot backward, so forward is negative.
    // The knee only ever bends one way (heel toward the back), which is what sells it as a knee.
    const gait = (phase: number): LimbPose => ({
      hip: -Math.sin(phase) * 0.52,
      knee: Math.max(0, Math.sin(phase + 1.2)) * 1.05,
      // Keep the sole roughly parallel to the floor through the stride.
      ankle: Math.sin(phase) * 0.26 - 0.1,
      shoulder: Math.sin(phase) * 0.42,
      shoulderZ: 0,
      // Negative: the forearm swings forward. Never fully straight — a locked elbow reads as a doll.
      elbow: -(0.3 + Math.max(0, Math.sin(phase)) * 0.32),
    });

    const walkL = gait(l.walkPhase);
    const walkR = gait(l.walkPhase + Math.PI);

    // ---- standing pose per activity ---------------------------------------------------------
    // Hand targets are relative to the shoulder: +y up, +z forward. Solved, not hand-tuned.
    let leftTarget: [number, number] = [-0.52, 0.06];
    let rightTarget: [number, number] = [-0.52, 0.06];
    let armLZ = 0.11;
    let armRZ = -0.11;
    let bodyPitch = 0;
    let bodyRoll = 0;
    let bodyLift = 0;
    let headPitchExtra = 0;
    // Idle weight shift: standing perfectly still is the tell of a rigid model.
    let hipLA = Math.sin(now * 0.45) * 0.03;
    let hipRA = -Math.sin(now * 0.45) * 0.03;
    let kneeLA = 0.06 + Math.max(0, Math.sin(now * 0.45)) * 0.1;
    let kneeRA = 0.06 + Math.max(0, -Math.sin(now * 0.45)) * 0.1;

    switch (l.activity) {
      case 'working':
        // Hands just above the desk surface, fingers busy. Desk top is at 1.02 world.
        leftTarget = [-0.3 + Math.sin(now * 9) * 0.012, 0.4];
        rightTarget = [-0.3 + Math.sin(now * 9 + 1.7) * 0.012, 0.4];
        armLZ = 0.2;
        armRZ = -0.2;
        bodyPitch = 0.1;
        headPitchExtra = 0.24;
        break;

      case 'thinking':
        // Right hand to the chin; the left arm folds across as a support.
        rightTarget = [0.15, 0.14];
        armRZ = -0.34;
        leftTarget = [-0.3, 0.16];
        armLZ = 0.3;
        bodyRoll = 0.05;
        headPitchExtra = 0.08;
        break;

      case 'talking':
        leftTarget = [-0.18 + Math.sin(now * 3.1) * 0.06, 0.34 + Math.sin(now * 3.1) * 0.05];
        rightTarget = [-0.18 + Math.sin(now * 2.7 + 1) * 0.06, 0.34 + Math.sin(now * 2.7) * 0.05];
        armLZ = 0.3;
        armRZ = -0.3;
        break;

      case 'presenting':
        rightTarget = [0.06 + Math.sin(now * 1.8) * 0.04, 0.48];
        armRZ = -0.4;
        leftTarget = [-0.44, 0.1];
        break;

      case 'celebrating': {
        const hop = Math.abs(Math.sin(now * 6.2));
        leftTarget = [0.5, 0.06];
        rightTarget = [0.5, 0.06];
        armLZ = 0.42;
        armRZ = -0.42;
        bodyLift = hop * 0.14;
        kneeLA = 0.2 + hop * 0.35;
        kneeRA = 0.2 + hop * 0.35;
        break;
      }

      case 'frustrated':
        leftTarget = [-0.3, 0.2];
        rightTarget = [-0.3, 0.2];
        armLZ = 0.62;
        armRZ = -0.62;
        bodyRoll = Math.sin(now * 6.5) * 0.045;
        break;

      case 'drinking':
        rightTarget = [0.17, 0.1];
        armRZ = -0.24;
        break;

      default:
        // Arms hang, with a slow asymmetric sway so the two sides are never in lockstep.
        leftTarget = [-0.52, 0.05 + Math.sin(now * 1.1) * 0.03];
        rightTarget = [-0.52, 0.05 + Math.sin(now * 0.93 + 0.7) * 0.03];
        break;
    }

    // ---- one-shot gestures ------------------------------------------------------------------
    if (l.gesture !== 'none') {
      const u = (now - l.gestureStart) / Math.max(0.001, l.gestureDuration);
      const e = actingCurve(u);
      // Secondary channels start and settle later than the primary arm, per follow-through.
      const lag = actingCurve(u - 0.08);
      const blend = (base: [number, number], goal: [number, number]): [number, number] => [
        base[0] + (goal[0] - base[0]) * e,
        base[1] + (goal[1] - base[1]) * e,
      ];

      switch (l.gesture) {
        case 'wave':
          rightTarget = blend(rightTarget, [0.34, 0.24]);
          armRZ = -0.42 - Math.sin(now * 11) * 0.3 * e;
          break;
        case 'stretch':
          leftTarget = blend(leftTarget, [0.52, -0.08]);
          rightTarget = blend(rightTarget, [0.52, -0.08]);
          armLZ = 0.24 * e;
          armRZ = -0.24 * e;
          bodyPitch -= 0.13 * lag;
          headPitchExtra -= 0.14 * lag;
          break;
        case 'scratchHead':
          rightTarget = blend(rightTarget, [0.28, 0.04]);
          armRZ = -0.2 - 0.3 * e;
          headPitchExtra += 0.1 * lag;
          break;
        case 'checkWatch':
          leftTarget = blend(leftTarget, [-0.06, 0.3]);
          armLZ = 0.36 * e;
          headPitchExtra += 0.3 * lag;
          break;
        case 'shrug':
          armLZ = 0.11 + 0.7 * e;
          armRZ = -0.11 - 0.7 * e;
          leftTarget = blend(leftTarget, [-0.32, 0.2]);
          rightTarget = blend(rightTarget, [-0.32, 0.2]);
          headPitchExtra += 0.06 * lag;
          break;
        case 'nod':
          headPitchExtra += Math.sin(Math.min(1, Math.max(0, u)) * Math.PI * 4) * 0.2;
          break;
        case 'sip':
          rightTarget = blend(rightTarget, [0.17, 0.1]);
          armRZ = -0.24;
          headPitchExtra -= 0.12 * lag;
          break;
        case 'point':
          rightTarget = blend(rightTarget, [0.06, 0.5]);
          armRZ = -0.34 * e;
          break;
        default:
          break;
      }
    }

    const armL = solveArm(leftTarget[0], leftTarget[1]);
    const armR = solveArm(rightTarget[0], rightTarget[1]);
    const armLX = armL.shoulder;
    const armRX = armR.shoulder;
    const elbowLA = armL.elbow;
    const elbowRA = armR.elbow;

    // ---- blend standing pose with the gait and commit ----------------------------------------
    const mix = (stand: number, stride: number) => THREE.MathUtils.lerp(stand, stride, walk);
    // Sitting overrides both the standing pose and the gait: you cannot stride from a chair.
    const sit = l.sitBlend;
    const seat = (value: number, seated: number) => THREE.MathUtils.lerp(value, seated, sit);
    // How far the hips drop. Expressed in local units because the whole character is scaled.
    const sitDrop = P.hipY - l.seatHeight / appearance.heightScale;

    const apply = (
      ref: React.MutableRefObject<THREE.Group | null>,
      x: number,
      z: number | null,
      lambda: number,
    ) => {
      if (!ref.current) return;
      ref.current.rotation.x = damp(ref.current.rotation.x, x, lambda, delta);
      if (z !== null) ref.current.rotation.z = damp(ref.current.rotation.z, z, lambda, delta);
    };

    // Legs splay very slightly apart when seated, so the two are not a mirrored pair.
    apply(hipL, seat(mix(hipLA, walkL.hip), SEATED.hip - 0.04), null, 15);
    apply(hipR, seat(mix(hipRA, walkR.hip), SEATED.hip + 0.03), null, 15);
    apply(kneeL, seat(mix(kneeLA, walkL.knee), SEATED.knee + 0.04), null, 15);
    apply(kneeR, seat(mix(kneeRA, walkR.knee), SEATED.knee - 0.03), null, 15);
    apply(ankleL, seat(mix(-0.06, walkL.ankle), SEATED.ankle), null, 15);
    apply(ankleR, seat(mix(-0.06, walkR.ankle), SEATED.ankle), null, 15);

    apply(shoulderL, mix(armLX, walkL.shoulder), mix(armLZ, 0.1), 13);
    apply(shoulderR, mix(armRX, walkR.shoulder), mix(armRZ, -0.1), 13);
    apply(elbowL, mix(elbowLA, walkL.elbow), null, 13);
    apply(elbowR, mix(elbowRA, walkR.elbow), null, 13);

    if (body.current) {
      // Pelvis rises twice per stride, once per footfall.
      const stepBob = Math.abs(Math.sin(l.walkPhase)) * 0.028 * walk;
      body.current.position.y = damp(
        body.current.position.y,
        bodyLift + stepBob - sitDrop * sit,
        16,
        delta,
      );
      // Seated, the torso settles back against the chair rather than leaning into a stride.
      body.current.rotation.x = damp(
        body.current.rotation.x,
        seat(mix(bodyPitch, 0.07), -0.07),
        10,
        delta,
      );
      body.current.rotation.z = damp(
        body.current.rotation.z,
        bodyRoll + Math.sin(now * 0.7) * 0.012 * (1 - walk),
        10,
        delta,
      );
      // Counter-rotating shoulders/hips: the single biggest cue that a walk is not a slide.
      body.current.rotation.y = damp(body.current.rotation.y, Math.sin(l.walkPhase) * 0.09 * walk, 12, delta);
    }

    if (chest.current) {
      const breath = Math.sin(now * 1.5) * 0.016 * (1 - walk);
      chest.current.scale.set(1 + breath * 0.5, 1 + breath, 1 + breath * 0.5);
    }

    if (head.current) {
      head.current.rotation.y = l.headYaw;
      head.current.rotation.x = l.headPitch + headPitchExtra;
      head.current.rotation.z = -Math.sin(l.walkPhase) * 0.03 * walk;
    }

    const eyeScale = Math.max(0.06, l.eyeOpen);
    if (leftEye.current) leftEye.current.scale.y = eyeScale;
    if (rightEye.current) rightEye.current.scale.y = eyeScale;
  });

  const build = appearance.buildScale;
  const shoulderX = P.shoulderX * build;

  /** One arm. Mirrored by `side`; -1 is the character's left. */
  const arm = (
    side: -1 | 1,
    shoulderRef: React.RefObject<THREE.Group>,
    elbowRef: React.RefObject<THREE.Group>,
  ) => (
    <group position={[shoulderX * side, P.shoulderY, 0]} ref={shoulderRef}>
      {/* deltoid cap hides the shoulder seam at any rotation */}
      <mesh material={m.fabricPrimary} scale={[1, 0.85, 1]}>
        <sphereGeometry args={[P.upperArmRadius * 1.5, 12, 8]} />
      </mesh>
      <mesh material={m.fabricPrimary} position={[0, -P.upperArm / 2, 0]} castShadow>
        <cylinderGeometry args={[P.upperArmRadius, P.upperArmRadius * 0.9, P.upperArm, 10]} />
      </mesh>
      <group position={[0, -P.upperArm, 0]} ref={elbowRef}>
        <mesh material={m.fabricPrimary}>
          <sphereGeometry args={[P.upperArmRadius * 0.98, 10, 8]} />
        </mesh>
        <mesh material={m.fabricPrimary} position={[0, -P.foreArm / 2, 0]} castShadow>
          <cylinderGeometry args={[P.foreArmRadius * 1.08, P.foreArmRadius, P.foreArm, 10]} />
        </mesh>
        {/* wrist + hand */}
        <mesh material={m.skin} position={[0, -P.foreArm - 0.045, 0]} scale={[1, 1.25, 0.72]}>
          <sphereGeometry args={[P.foreArmRadius * 1.15, 10, 8]} />
        </mesh>

        {/* Clipboard, carried in the left hand. Parented to the wrist so it travels with the arm
            through every pose instead of floating in place. */}
        {side === -1 && appearance.accessories.includes('clipboard') && (
          <group position={[0, -P.foreArm - 0.07, 0.07]} rotation={[-0.5, 0, 0.12]}>
            <mesh material={WORLD.monitorShell} castShadow>
              <boxGeometry args={[0.2, 0.28, 0.016]} />
            </mesh>
            <mesh material={WORLD.paper} position={[0, -0.01, 0.011]}>
              <planeGeometry args={[0.17, 0.23]} />
            </mesh>
            <mesh material={WORLD.metal} position={[0, 0.125, 0.014]}>
              <boxGeometry args={[0.08, 0.03, 0.012]} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );

  /** One leg, from hip to foot. */
  const leg = (
    side: -1 | 1,
    hipRef: React.RefObject<THREE.Group>,
    kneeRef: React.RefObject<THREE.Group>,
    ankleRef: React.RefObject<THREE.Group>,
  ) => (
    <group position={[P.hipX * side, P.hipY, 0]} ref={hipRef}>
      <mesh material={m.fabricSecondary} position={[0, -P.thigh / 2, 0]} castShadow>
        <cylinderGeometry args={[P.thighRadius, P.thighRadius * 0.82, P.thigh, 12]} />
      </mesh>
      <group position={[0, -P.thigh, 0]} ref={kneeRef}>
        <mesh material={m.fabricSecondary}>
          <sphereGeometry args={[P.thighRadius * 0.84, 10, 8]} />
        </mesh>
        <mesh material={m.fabricSecondary} position={[0, -P.shin / 2, 0]} castShadow>
          <cylinderGeometry args={[P.shinRadius * 1.1, P.shinRadius * 0.85, P.shin, 10]} />
        </mesh>
        <group position={[0, -P.shin, 0]} ref={ankleRef}>
          {/* foot: heel block plus a tapered toe, so the silhouette is not a brick */}
          <mesh material={m.shoe} position={[0, -0.028, 0.012]} castShadow>
            <boxGeometry args={[0.096, 0.056, 0.14]} />
          </mesh>
          <mesh material={m.shoe} position={[0, -0.034, 0.108]} scale={[1, 0.62, 1]} castShadow>
            <sphereGeometry args={[0.048, 10, 8]} />
          </mesh>
        </group>
      </group>
    </group>
  );

  return (
    <group ref={facing} scale={appearance.heightScale}>
      <group ref={body}>
        {leg(-1, hipL, kneeL, ankleL)}
        {leg(1, hipR, kneeR, ankleR)}

        {/* pelvis */}
        <mesh material={m.fabricSecondary} position={[0, P.hipY + 0.06, 0]} castShadow>
          <cylinderGeometry args={[P.pelvisRadius * build, P.pelvisRadius * 0.92 * build, 0.2, 14]} />
        </mesh>
        {/* belt: a thin darker band, the cheap way to fake a bevel between garments */}
        <mesh material={m.fabricPrimary} position={[0, P.waistY + 0.03, 0]}>
          <cylinderGeometry args={[P.chestBottomRadius * build * 1.03, P.pelvisRadius * build, 0.07, 14]} />
        </mesh>

        {/* chest */}
        <mesh
          ref={chest}
          material={m.fabricPrimary}
          position={[0, (P.waistY + P.shoulderY) / 2 + 0.03, 0]}
          castShadow
        >
          <cylinderGeometry
            args={[P.chestTopRadius * build, P.chestBottomRadius * build, P.shoulderY - P.waistY + 0.1, 16]}
          />
        </mesh>

        {appearance.accessories.includes('blazer') && (
          <>
            {/* open jacket: two offset panels, reads as a lapel from the play camera */}
            {[-1, 1].map((s) => (
              <mesh
                key={s}
                material={m.fabricSecondary}
                position={[0.062 * s, P.shoulderY - 0.17, P.chestTopRadius * build * 0.78]}
                rotation={[0, 0, 0.22 * s]}
              >
                <boxGeometry args={[0.09, 0.3, 0.035]} />
              </mesh>
            ))}
          </>
        )}
        {appearance.accessories.includes('hoodie') && (
          <mesh material={m.fabricSecondary} position={[0, P.shoulderY - 0.02, -0.1]} scale={[1.25, 0.8, 1]}>
            <sphereGeometry args={[0.145, 14, 10]} />
          </mesh>
        )}
        {appearance.accessories.includes('tie') && (
          <mesh
            material={m.accent}
            position={[0, P.shoulderY - 0.21, P.chestTopRadius * build * 0.92]}
            rotation={[0.1, 0, 0]}
          >
            <boxGeometry args={[0.055, 0.28, 0.02]} />
          </mesh>
        )}
        {appearance.accessories.includes('lanyard') && (
          <mesh material={WORLD.paper} position={[0, P.waistY + 0.16, P.chestBottomRadius * build + 0.02]}>
            <boxGeometry args={[0.085, 0.115, 0.012]} />
          </mesh>
        )}

        {arm(-1, shoulderL, elbowL)}
        {arm(1, shoulderR, elbowR)}

        {/* neck */}
        <mesh material={m.skin} position={[0, P.neckY, 0]}>
          <cylinderGeometry args={[0.052, 0.058, 0.11, 10]} />
        </mesh>

        <group position={[0, P.headY, 0]} ref={head}>
          {/* skull: slightly egg-shaped and narrowed at the jaw */}
          <mesh material={m.skin} scale={[0.94, 1.1, 0.96]} castShadow>
            <sphereGeometry args={[P.headRadius, 20, 16]} />
          </mesh>
          {/* jaw/chin mass */}
          <mesh material={m.skin} position={[0, -0.072, 0.012]} scale={[0.8, 0.62, 0.86]}>
            <sphereGeometry args={[P.headRadius, 14, 12]} />
          </mesh>
          {/* nose: tiny, but a face without one reads as a mannequin */}
          <mesh material={m.skin} position={[0, -0.012, P.headRadius * 0.92]} scale={[0.55, 0.8, 0.9]}>
            <sphereGeometry args={[0.026, 8, 8]} />
          </mesh>
          {/* ears */}
          {[-1, 1].map((s) => (
            <mesh key={s} material={m.skin} position={[P.headRadius * 0.92 * s, -0.005, 0]} scale={[0.5, 1, 0.7]}>
              <sphereGeometry args={[0.032, 8, 8]} />
            </mesh>
          ))}

          {[-1, 1].map((s) => (
            <group key={s} position={[0.046 * s, 0.016, P.headRadius * 0.83]}>
              <mesh material={WORLD.eyeWhite} scale={[1.25, 1, 0.55]}>
                <sphereGeometry args={[0.024, 10, 8]} />
              </mesh>
              <mesh ref={s === -1 ? leftEye : rightEye} material={WORLD.eye} position={[0, 0, 0.012]}>
                <sphereGeometry args={[0.0145, 8, 8]} />
              </mesh>
              {/* brow: a thin bar, the cheapest way to give a face an expression */}
              <mesh material={m.hair} position={[0, 0.042, 0.004]} rotation={[0, 0, -0.16 * s]}>
                <boxGeometry args={[0.052, 0.011, 0.012]} />
              </mesh>
            </group>
          ))}

          <mesh material={WORLD.mouth} position={[0, -0.062, P.headRadius * 0.82]} scale={[1.5, 0.38, 0.4]}>
            <sphereGeometry args={[0.024, 10, 8]} />
          </mesh>

          <Hair style={appearance.hairStyle} material={m.hair} />

          {appearance.accessories.includes('glasses') && (
            <group position={[0, 0.016, P.headRadius * 0.88]}>
              {[-0.046, 0.046].map((x) => (
                <mesh key={x} material={WORLD.lensFrame} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.036, 0.0055, 6, 14]} />
                </mesh>
              ))}
              <mesh material={WORLD.lensFrame}>
                <boxGeometry args={[0.03, 0.006, 0.006]} />
              </mesh>
            </group>
          )}

          {appearance.accessories.includes('headphones') && (
            <group>
              <mesh material={WORLD.monitorShell} position={[0, 0.05, 0]}>
                <torusGeometry args={[0.132, 0.014, 6, 18, Math.PI]} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh
                  key={s}
                  material={WORLD.monitorShell}
                  position={[0.13 * s, 0.006, 0]}
                  rotation={[0, 0, Math.PI / 2]}
                >
                  <cylinderGeometry args={[0.042, 0.042, 0.034, 12]} />
                </mesh>
              ))}
            </group>
          )}

          {appearance.accessories.includes('beret') && (
            <mesh material={m.accent} position={[0.022, 0.1, -0.012]} rotation={[0.14, 0, -0.24]} castShadow>
              <cylinderGeometry args={[0.125, 0.1, 0.042, 16]} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}

function Hair({ style, material }: { style: string; material: THREE.Material }) {
  if (style === 'slick') {
    return (
      <mesh material={material} position={[0, 0.012, -0.008]} scale={[0.99, 1.06, 1.01]} castShadow>
        <sphereGeometry args={[P.headRadius + 0.011, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.54]} />
      </mesh>
    );
  }

  if (style === 'bun') {
    return (
      <group>
        <mesh material={material} position={[0, 0.008, 0]} scale={[1, 1.08, 1.01]} castShadow>
          <sphereGeometry args={[P.headRadius + 0.013, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        </mesh>
        <mesh material={material} position={[0, 0.098, -0.108]} castShadow>
          <sphereGeometry args={[0.055, 12, 10]} />
        </mesh>
      </group>
    );
  }

  return (
    <group>
      <mesh material={material} position={[0, 0.014, -0.004]} scale={[1.01, 1.1, 1.03]} castShadow>
        <sphereGeometry args={[P.headRadius + 0.015, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.64]} />
      </mesh>
      {[
        [-0.058, 0.122, 0.022],
        [0.04, 0.132, -0.03],
        [0.072, 0.112, 0.045],
      ].map(([x, y, z]) => (
        <mesh key={`${x}-${y}`} material={material} position={[x, y, z]} scale={[1, 1.45, 1]} castShadow>
          <sphereGeometry args={[0.032, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}
