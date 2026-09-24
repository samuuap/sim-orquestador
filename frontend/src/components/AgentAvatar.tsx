/**
 * Agent Avatar — a character plus everything that floats around it.
 *
 * Composition:
 *   root group   position, driven by the behaviour layer
 *   ├ SimCharacter   the body; owns its own facing rotation
 *   ├ plumbob        the diamond overhead; the primary state read
 *   ├ bubble         short utterances, billboarded
 *   ├ name plate     billboarded
 *   └ selection ring flat on the floor
 *
 * The plumbob, bubble and name plate deliberately sit outside the character's facing group so they
 * stay readable no matter which way it turns.
 */

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Agent } from '@/types';
import { useAppStore } from '@/store';
import { useAgentLife } from '@/behavior/useAgentLife';
import { SimCharacter } from './character/SimCharacter';
import { PLUMBOB_COLORS, PROPORTIONS as P, appearanceFor } from './character/appearance';

interface AgentAvatarProps {
  agent: Agent;
}

const FALLBACK_PLUMBOB = '#22c55e';

export function AgentAvatar({ agent }: AgentAvatarProps) {
  const selectAgent = useAppStore((state) => state.selectAgent);
  const selectedAgent = useAppStore((state) => state.selectedAgent);
  const isSelected = selectedAgent === agent.agent_id;

  const appearance = appearanceFor(agent.role);
  const life = useAgentLife(agent);

  const root = useRef<THREE.Group>(null);
  const plumbob = useRef<THREE.Mesh>(null);
  const plumbobMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const bubble = useRef<THREE.Group>(null);
  const plate = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);

  const targetColor = useRef(new THREE.Color(FALLBACK_PLUMBOB));

  // The bubble text lives in React state because it must re-render <Text>. useFrame writes it only
  // when it actually changes, which is a handful of times a minute - not once a frame.
  const [bubbleText, setBubbleText] = useState('');
  const lastBubble = useRef<string | null>(null);

  useFrame((state, rawDelta) => {
    const l = life.current;
    const now = state.clock.getElapsedTime();
    const delta = Math.min(rawDelta, 0.05);

    if (root.current) root.current.position.copy(l.position);

    // Plumbob: spins continuously, bobs gently, and eases toward the state colour.
    if (plumbob.current) {
      plumbob.current.rotation.y = now * 1.5;
      plumbob.current.position.y = P.plumbobY * appearance.heightScale + Math.sin(now * 2) * 0.045;
      const excited = agent.state === 'COMPLETED' || agent.state === 'ERROR';
      const scale = excited ? 1.22 + Math.sin(now * 9) * 0.1 : 1;
      plumbob.current.scale.setScalar(scale);
    }
    if (plumbobMaterial.current) {
      const hex = PLUMBOB_COLORS[agent.state as keyof typeof PLUMBOB_COLORS] ?? FALLBACK_PLUMBOB;
      targetColor.current.set(hex);
      plumbobMaterial.current.color.lerp(targetColor.current, Math.min(1, delta * 6));
      plumbobMaterial.current.emissive.copy(plumbobMaterial.current.color);
    }

    // Hand-rolled billboarding: cheaper than a helper and has no extra dependency.
    if (plate.current) plate.current.quaternion.copy(state.camera.quaternion);
    if (bubble.current) {
      bubble.current.quaternion.copy(state.camera.quaternion);
      const wanted = l.bubble !== null;
      const target = wanted ? 1 : 0;
      const next = THREE.MathUtils.lerp(bubble.current.scale.x, target, Math.min(1, delta * 14));
      bubble.current.scale.setScalar(next);
      bubble.current.visible = next > 0.02;
    }

    if (ring.current) {
      const material = ring.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.35 + Math.sin(now * 3) * 0.18;
    }

    if (l.bubble !== lastBubble.current) {
      lastBubble.current = l.bubble;
      setBubbleText(l.bubble ?? '');
    }
  });

  return (
    <group ref={root}>
      <group onClick={() => selectAgent(agent.agent_id)}>
        <SimCharacter appearance={appearance} life={life} />
      </group>

      {/* Plumbob — the Sims tell. Doubles as the agent-state indicator. */}
      <mesh ref={plumbob} position={[0, P.plumbobY * appearance.heightScale, 0]} scale={1}>
        <octahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial
          ref={plumbobMaterial}
          color={FALLBACK_PLUMBOB}
          emissive={FALLBACK_PLUMBOB}
          emissiveIntensity={0.9}
          roughness={0.25}
          metalness={0.1}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Speech bubble. Scales in and out; hidden at zero scale. */}
      <group ref={bubble} position={[0.34, 1.78 * appearance.heightScale, 0]} scale={0} visible={false}>
        <mesh>
          <circleGeometry args={[0.17, 24]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.94} />
        </mesh>
        <Text position={[0, 0, 0.01]} fontSize={0.13} color="#0f172a" anchorX="center" anchorY="middle">
          {bubbleText}
        </Text>
      </group>

      {/* Name plate */}
      <group ref={plate} position={[0, 2.26 * appearance.heightScale, 0]}>
        <Text
          fontSize={0.17}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.018}
          outlineColor="#020617"
        >
          {appearance.name}
        </Text>
        <Text
          position={[0, -0.18, 0]}
          fontSize={0.1}
          color={appearance.accent}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor="#020617"
        >
          {agent.role.toUpperCase()}
        </Text>
      </group>

      {isSelected && (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.36, 0.46, 32]} />
          <meshBasicMaterial color={appearance.accent} transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
