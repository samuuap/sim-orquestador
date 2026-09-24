/**
 * A stylised humanoid built entirely from Three.js primitives — no external model files.
 *
 * The skeleton is a group hierarchy (hips → legs, shoulders → arms, neck → head) so limbs rotate
 * around real joints instead of sliding. Every frame this component reads the LifeState produced
 * by useAgentLife and poses that skeleton. It never calls setState.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LifeState } from '@/behavior/useAgentLife';
import { PROPORTIONS as P, type Appearance } from './appearance';

interface SimCharacterProps {
  appearance: Appearance;
  life: React.MutableRefObject<LifeState>;
}

/** Rising-then-falling envelope for one-shot gestures. */
function envelope(u: number): number {
  return Math.sin(Math.max(0, Math.min(1, u)) * Math.PI);
}

function damp(current: number, target: number, lambda: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * delta));
}

export function SimCharacter({ appearance, life }: SimCharacterProps) {
  const facing = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);

  useFrame((state, rawDelta) => {
    const l = life.current;
    const now = state.clock.getElapsedTime();
    const delta = Math.min(rawDelta, 0.05);

    if (facing.current) facing.current.rotation.y = l.yaw;

    const walk = l.walkBlend;
    const stride = Math.sin(l.walkPhase);
    const counterStride = Math.sin(l.walkPhase + Math.PI);

    // ---- base arm and leg pose -------------------------------------------------------------
    let leftArmX = 0;
    let rightArmX = 0;
    let leftArmZ = 0.08;
    let rightArmZ = -0.08;
    let bodyPitch = 0;
    let bodyRoll = 0;
    let bodyLift = 0;
    let headPitchExtra = 0;

    switch (l.activity) {
      case 'working':
        // Hands forward over the desk, with a small typing jitter.
        leftArmX = -1.15 + Math.sin(now * 9) * 0.06;
        rightArmX = -1.15 + Math.sin(now * 9 + 1.7) * 0.06;
        leftArmZ = 0.3;
        rightArmZ = -0.3;
        bodyPitch = 0.12;
        headPitchExtra = 0.22;
        break;

      case 'thinking':
        // One hand toward the chin, weight on the back foot.
        rightArmX = -2.1;
        rightArmZ = -0.5;
        leftArmX = -0.25;
        bodyPitch = 0.04;
        bodyRoll = 0.05;
        headPitchExtra = 0.1;
        break;

      case 'talking':
        leftArmX = -0.4 + Math.sin(now * 3.1) * 0.22;
        rightArmX = -0.4 + Math.sin(now * 2.7 + 1) * 0.22;
        leftArmZ = 0.3;
        rightArmZ = -0.3;
        break;

      case 'presenting':
        leftArmX = -0.15;
        rightArmX = -1.5 + Math.sin(now * 1.8) * 0.18;
        rightArmZ = -0.55;
        break;

      case 'celebrating': {
        const hop = Math.abs(Math.sin(now * 6.5));
        leftArmX = -2.6;
        rightArmX = -2.6;
        leftArmZ = 0.5;
        rightArmZ = -0.5;
        bodyLift = hop * 0.16;
        break;
      }

      case 'frustrated':
        leftArmX = -0.5;
        rightArmX = -0.5;
        leftArmZ = 0.55;
        rightArmZ = -0.55;
        bodyRoll = Math.sin(now * 7) * 0.05;
        break;

      default:
        // Relaxed sway.
        leftArmX = Math.sin(now * 1.1) * 0.06;
        rightArmX = Math.sin(now * 1.1 + 0.6) * 0.06;
        break;
    }

    // ---- walking overlay -------------------------------------------------------------------
    if (walk > 0.001) {
      leftArmX = THREE.MathUtils.lerp(leftArmX, counterStride * 0.5, walk);
      rightArmX = THREE.MathUtils.lerp(rightArmX, stride * 0.5, walk);
      leftArmZ = THREE.MathUtils.lerp(leftArmZ, 0.1, walk);
      rightArmZ = THREE.MathUtils.lerp(rightArmZ, -0.1, walk);
      bodyPitch = THREE.MathUtils.lerp(bodyPitch, 0.09, walk);
      bodyLift += Math.abs(Math.sin(l.walkPhase)) * 0.035 * walk;
    }

    // ---- one-shot gestures override the arms ------------------------------------------------
    if (l.gesture !== 'none') {
      const u = (now - l.gestureStart) / Math.max(0.001, l.gestureDuration);
      const e = envelope(u);

      switch (l.gesture) {
        case 'wave':
          rightArmX = -2.5 * e;
          rightArmZ = -0.5 - Math.sin(now * 12) * 0.35 * e;
          break;
        case 'stretch':
          leftArmX = -2.9 * e;
          rightArmX = -2.9 * e;
          leftArmZ = 0.25 * e;
          rightArmZ = -0.25 * e;
          bodyPitch -= 0.12 * e;
          break;
        case 'scratchHead':
          rightArmX = -2.5 * e;
          rightArmZ = -0.75 * e;
          headPitchExtra += 0.12 * e;
          break;
        case 'checkWatch':
          leftArmX = -1.9 * e;
          leftArmZ = 0.65 * e;
          headPitchExtra += 0.3 * e;
          break;
        case 'shrug':
          leftArmZ = 0.85 * e;
          rightArmZ = -0.85 * e;
          leftArmX = -0.35 * e;
          rightArmX = -0.35 * e;
          break;
        case 'nod':
          headPitchExtra += Math.sin(u * Math.PI * 4) * 0.22;
          break;
        case 'sip':
          rightArmX = -2.35 * e;
          rightArmZ = -0.3 * e;
          headPitchExtra -= 0.18 * e;
          break;
        case 'point':
          rightArmX = -1.6 * e;
          rightArmZ = -0.6 * e;
          break;
        default:
          break;
      }
    }

    // ---- commit the pose --------------------------------------------------------------------
    if (leftArm.current) {
      leftArm.current.rotation.x = damp(leftArm.current.rotation.x, leftArmX, 14, delta);
      leftArm.current.rotation.z = damp(leftArm.current.rotation.z, leftArmZ, 14, delta);
    }
    if (rightArm.current) {
      rightArm.current.rotation.x = damp(rightArm.current.rotation.x, rightArmX, 14, delta);
      rightArm.current.rotation.z = damp(rightArm.current.rotation.z, rightArmZ, 14, delta);
    }
    if (leftLeg.current) {
      leftLeg.current.rotation.x = damp(leftLeg.current.rotation.x, stride * 0.62 * walk, 16, delta);
    }
    if (rightLeg.current) {
      rightLeg.current.rotation.x = damp(
        rightLeg.current.rotation.x,
        counterStride * 0.62 * walk,
        16,
        delta,
      );
    }

    if (body.current) {
      body.current.position.y = damp(body.current.position.y, bodyLift, 16, delta);
      body.current.rotation.x = damp(body.current.rotation.x, bodyPitch, 10, delta);
      body.current.rotation.z = damp(
        body.current.rotation.z,
        bodyRoll + Math.sin(now * 0.7) * 0.012 * (1 - walk),
        10,
        delta,
      );
    }

    // Breathing: only legible when standing still, so fade it out while walking.
    if (torso.current) {
      const breath = Math.sin(now * 1.5) * 0.018 * (1 - walk);
      torso.current.scale.set(1 - breath * 0.5, 1 + breath, 1 - breath * 0.5);
    }

    if (head.current) {
      head.current.rotation.y = l.headYaw;
      head.current.rotation.x = l.headPitch + headPitchExtra;
    }

    const eyeScale = Math.max(0.05, l.eyeOpen);
    if (leftEye.current) leftEye.current.scale.y = eyeScale;
    if (rightEye.current) rightEye.current.scale.y = eyeScale;
  });

  const skinMaterial = <meshStandardMaterial color={appearance.skin} roughness={0.75} />;

  return (
    <group ref={facing} scale={appearance.heightScale}>
      <group ref={body}>
        {/* ---- legs ---- */}
        <group position={[-0.09, P.hipY, 0]} ref={leftLeg}>
          <mesh castShadow position={[0, -P.legLength / 2, 0]}>
            <cylinderGeometry args={[P.legRadius, P.legRadius * 0.9, P.legLength, 12]} />
            <meshStandardMaterial color={appearance.legs} roughness={0.85} />
          </mesh>
          <mesh castShadow position={[0, -P.legLength + 0.035, 0.04]}>
            <boxGeometry args={[0.13, 0.07, 0.21]} />
            <meshStandardMaterial color={appearance.shoes} roughness={0.6} />
          </mesh>
        </group>
        <group position={[0.09, P.hipY, 0]} ref={rightLeg}>
          <mesh castShadow position={[0, -P.legLength / 2, 0]}>
            <cylinderGeometry args={[P.legRadius, P.legRadius * 0.9, P.legLength, 12]} />
            <meshStandardMaterial color={appearance.legs} roughness={0.85} />
          </mesh>
          <mesh castShadow position={[0, -P.legLength + 0.035, 0.04]}>
            <boxGeometry args={[0.13, 0.07, 0.21]} />
            <meshStandardMaterial color={appearance.shoes} roughness={0.6} />
          </mesh>
        </group>

        {/* ---- torso ---- */}
        <mesh ref={torso} castShadow position={[0, P.hipY + P.torsoHeight / 2, 0]}>
          <cylinderGeometry args={[P.torsoTopRadius, P.torsoBottomRadius, P.torsoHeight, 16]} />
          <meshStandardMaterial color={appearance.shirt} roughness={0.8} />
        </mesh>
        {/* Collar / shoulder yoke, in the accent garment colour. */}
        <mesh position={[0, P.shoulderY - 0.03, 0]}>
          <cylinderGeometry args={[P.torsoTopRadius + 0.012, P.torsoTopRadius, 0.1, 16]} />
          <meshStandardMaterial color={appearance.shirtAccent} roughness={0.8} />
        </mesh>

        {appearance.accessories.includes('tie') && (
          <mesh position={[0, P.hipY + 0.42, P.torsoTopRadius - 0.01]} rotation={[0.08, 0, 0]}>
            <boxGeometry args={[0.07, 0.3, 0.02]} />
            <meshStandardMaterial color={appearance.accent} roughness={0.5} />
          </mesh>
        )}
        {appearance.accessories.includes('lanyard') && (
          <mesh position={[0, P.hipY + 0.2, P.torsoBottomRadius + 0.01]}>
            <boxGeometry args={[0.1, 0.13, 0.015]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
          </mesh>
        )}

        {/* ---- arms: pivot groups sit at the shoulder ---- */}
        <group position={[-P.shoulderX, P.shoulderY, 0]} ref={leftArm}>
          <mesh castShadow position={[0, -P.armLength / 2, 0]}>
            <cylinderGeometry args={[P.armRadius, P.armRadius * 0.92, P.armLength, 10]} />
            <meshStandardMaterial color={appearance.shirtAccent} roughness={0.8} />
          </mesh>
          <mesh position={[0, -P.armLength - 0.03, 0]}>
            <sphereGeometry args={[0.058, 12, 10]} />
            {skinMaterial}
          </mesh>
        </group>
        <group position={[P.shoulderX, P.shoulderY, 0]} ref={rightArm}>
          <mesh castShadow position={[0, -P.armLength / 2, 0]}>
            <cylinderGeometry args={[P.armRadius, P.armRadius * 0.92, P.armLength, 10]} />
            <meshStandardMaterial color={appearance.shirtAccent} roughness={0.8} />
          </mesh>
          <mesh position={[0, -P.armLength - 0.03, 0]}>
            <sphereGeometry args={[0.058, 12, 10]} />
            {skinMaterial}
          </mesh>
        </group>

        {/* ---- neck ---- */}
        <mesh position={[0, P.neckY, 0]}>
          <cylinderGeometry args={[0.058, 0.062, 0.12, 10]} />
          {skinMaterial}
        </mesh>

        {/* ---- head ---- */}
        <group position={[0, P.headY, 0]} ref={head}>
          <mesh castShadow scale={[0.96, 1.04, 0.94]}>
            <sphereGeometry args={[P.headRadius, 24, 20]} />
            {skinMaterial}
          </mesh>

          <mesh ref={leftEye} position={[-0.072, 0.025, 0.172]}>
            <sphereGeometry args={[0.027, 10, 8]} />
            <meshStandardMaterial color="#1c1917" roughness={0.3} />
          </mesh>
          <mesh ref={rightEye} position={[0.072, 0.025, 0.172]}>
            <sphereGeometry args={[0.027, 10, 8]} />
            <meshStandardMaterial color="#1c1917" roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.072, 0.176]} scale={[1, 0.45, 0.5]}>
            <sphereGeometry args={[0.032, 10, 8]} />
            <meshStandardMaterial color="#8a4a42" roughness={0.6} />
          </mesh>

          <Hair appearance={appearance} />

          {appearance.accessories.includes('glasses') && (
            <group position={[0, 0.025, 0.178]}>
              {[-0.072, 0.072].map((x) => (
                <mesh key={x} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.052, 0.008, 8, 18]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.5} />
                </mesh>
              ))}
              <mesh>
                <boxGeometry args={[0.05, 0.008, 0.008]} />
                <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.5} />
              </mesh>
            </group>
          )}

          {appearance.accessories.includes('headphones') && (
            <group>
              <mesh position={[0, 0.07, 0]} rotation={[0, 0, 0]}>
                <torusGeometry args={[0.2, 0.019, 8, 24, Math.PI]} />
                <meshStandardMaterial color="#111827" roughness={0.5} />
              </mesh>
              {[-0.196, 0.196].map((x) => (
                <mesh key={x} position={[x, 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.055, 0.055, 0.045, 14]} />
                  <meshStandardMaterial color="#111827" roughness={0.5} />
                </mesh>
              ))}
            </group>
          )}

          {appearance.accessories.includes('beret') && (
            <mesh position={[0.03, 0.165, -0.01]} rotation={[0.12, 0, -0.22]} castShadow>
              <cylinderGeometry args={[0.185, 0.155, 0.06, 20]} />
              <meshStandardMaterial color={appearance.accent} roughness={0.85} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}

/** Hair is three silhouettes rather than three models: a cap, plus style-specific volume. */
function Hair({ appearance }: { appearance: Appearance }) {
  const material = <meshStandardMaterial color={appearance.hair} roughness={0.9} />;

  if (appearance.hairStyle === 'slick') {
    return (
      <mesh position={[0, 0.012, -0.012]} scale={[1.02, 0.92, 1.04]} castShadow>
        <sphereGeometry args={[P.headRadius + 0.012, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        {material}
      </mesh>
    );
  }

  if (appearance.hairStyle === 'bun') {
    return (
      <group>
        <mesh position={[0, 0.01, -0.005]} scale={[1.03, 0.95, 1.03]} castShadow>
          <sphereGeometry args={[P.headRadius + 0.014, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
          {material}
        </mesh>
        <mesh position={[0, 0.16, -0.15]} castShadow>
          <sphereGeometry args={[0.082, 14, 12]} />
          {material}
        </mesh>
      </group>
    );
  }

  // messy: a cap with a few tufts breaking the silhouette
  return (
    <group>
      <mesh position={[0, 0.015, -0.005]} scale={[1.04, 1, 1.05]} castShadow>
        <sphereGeometry args={[P.headRadius + 0.016, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        {material}
      </mesh>
      {[
        [-0.09, 0.185, 0.03],
        [0.06, 0.2, -0.04],
        [0.11, 0.17, 0.07],
      ].map(([x, y, z]) => (
        <mesh key={`${x}-${y}`} position={[x, y, z]} scale={[1, 1.5, 1]} castShadow>
          <sphereGeometry args={[0.048, 10, 8]} />
          {material}
        </mesh>
      ))}
    </group>
  );
}
