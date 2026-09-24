/**
 * Agent Avatar — the character plus the floating UI that belongs to it.
 *
 * Root group carries world position only. Facing lives inside SimCharacter, so the plumbob, the
 * name plate and the speech bubble stay readable whichever way the character turns.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Agent } from '@/types';
import { useAppStore } from '@/store';
import { useAgentLife } from '@/behavior/useAgentLife';
import { ACCENT, WORLD, createPlumbobMaterial } from '@/assets/materials';
import { SimCharacter } from './character/SimCharacter';
import { P, PLUMBOB_COLORS, appearanceFor } from './character/appearance';

/** Bubble text metrics, tuned against the default drei font at this camera distance. */
const BUBBLE_FONT = 0.1;
const BUBBLE_MAX_TEXT = 1.7;
const CHARS_PER_LINE = 34;

interface AgentAvatarProps {
  agent: Agent;
}

export function AgentAvatar({ agent }: AgentAvatarProps) {
  const selectAgent = useAppStore((state) => state.selectAgent);
  const selectedAgent = useAppStore((state) => state.selectedAgent);
  const isSelected = selectedAgent === agent.agent_id;

  const appearance = appearanceFor(agent.role);
  const accent = ACCENT[agent.role];
  const life = useAgentLife(agent);

  // One material per agent rather than per mesh; the plumbob animates its colour so it cannot
  // be shared across the three.
  const plumbobMaterial = useMemo(() => createPlumbobMaterial(), []);

  const root = useRef<THREE.Group>(null);
  const plumbob = useRef<THREE.Mesh>(null);
  const bubble = useRef<THREE.Group>(null);
  const plate = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);

  const brain = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const targetColor = useRef(new THREE.Color(PLUMBOB_COLORS.IDLE));
  const [bubbleText, setBubbleText] = useState('');
  const lastBubble = useRef<string | null>(null);

  const plumbobHeight = P.plumbobY * appearance.heightScale;

  // Bubble geometry derives from the line itself: short answers get a small box, long ones wrap.
  const bubbleLines = Math.max(1, Math.ceil(bubbleText.length / CHARS_PER_LINE));
  const bubbleHeight = 0.16 + bubbleLines * BUBBLE_FONT * 1.3;
  const bubbleWidth =
    bubbleLines > 1
      ? BUBBLE_MAX_TEXT + 0.2
      : Math.min(BUBBLE_MAX_TEXT + 0.2, 0.22 + bubbleText.length * BUBBLE_FONT * 0.56);

  // Cursor feedback. Reset on unmount too, or a hot reload mid-hover leaves the page stuck
  // showing a pointer.
  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  useFrame((state, rawDelta) => {
    const l = life.current;
    const now = state.clock.getElapsedTime();
    const delta = Math.min(rawDelta, 0.05);

    if (root.current) root.current.position.copy(l.position);

    if (plumbob.current) {
      plumbob.current.rotation.y = now * 1.4;
      plumbob.current.position.y =
        plumbobHeight - 0.44 * l.sitBlend * appearance.heightScale + Math.sin(now * 2) * 0.04;
      const excited = agent.state === 'COMPLETED' || agent.state === 'ERROR';
      plumbob.current.scale.setScalar(excited ? 1.2 + Math.sin(now * 9) * 0.09 : 1);
    }

    const hex = PLUMBOB_COLORS[agent.state as keyof typeof PLUMBOB_COLORS] ?? PLUMBOB_COLORS.IDLE;
    targetColor.current.set(hex);
    plumbobMaterial.color.lerp(targetColor.current, Math.min(1, delta * 6));
    plumbobMaterial.emissive.copy(plumbobMaterial.color);

    // Hand-rolled billboarding: no extra dependency, and cheaper than a helper component.
    if (plate.current) {
      plate.current.quaternion.copy(state.camera.quaternion);
      // Sitting lowers the whole character; a name plate left at standing height floats.
      plate.current.position.y = (2.34 - 0.44 * l.sitBlend) * appearance.heightScale;
    }
    if (bubble.current) {
      bubble.current.quaternion.copy(state.camera.quaternion);
      const next = THREE.MathUtils.lerp(bubble.current.scale.x, l.bubble ? 1 : 0, Math.min(1, delta * 14));
      bubble.current.scale.setScalar(next);
      bubble.current.visible = next > 0.02;
      // Follows the character down into the chair, and sits beside the head rather than over it.
      // Billboarded, so local X is screen-right whichever way the camera is pointing.
      const seatedDrop = 0.44 * l.sitBlend;
      bubble.current.position.set(
        0.42,
        (1.62 - seatedDrop) * appearance.heightScale + bubbleHeight / 2,
        0,
      );
    }

    if (ring.current) {
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.32 + Math.sin(now * 3) * 0.16;
    }

    // Brain badge: scales in on hover or selection, so the click affordance is discoverable.
    if (brain.current) {
      const want = hovered || isSelected ? 1 : 0;
      const next = THREE.MathUtils.lerp(brain.current.scale.x, want, Math.min(1, delta * 12));
      brain.current.scale.setScalar(next);
      brain.current.visible = next > 0.02;
      brain.current.position.y = 1.94 * appearance.heightScale + Math.sin(now * 2.4) * 0.03;
      brain.current.rotation.y = Math.sin(now * 0.9) * 0.4;
    }

    if (l.bubble !== lastBubble.current) {
      lastBubble.current = l.bubble;
      setBubbleText(l.bubble ?? '');
    }
  });

  return (
    <group ref={root}>
      <group
        onClick={(event) => {
          event.stopPropagation();
          selectAgent(agent.agent_id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <SimCharacter role={agent.role} appearance={appearance} life={life} />
      </group>

      {/* Brain badge: two hemispheres and a stem. Enough silhouette to read at this scale. */}
      <group ref={brain} position={[-0.3, 1.94 * appearance.heightScale, 0]} scale={0} visible={false}>
        {[-1, 1].map((side) => (
          <mesh key={side} material={WORLD.brain} position={[0.042 * side, 0, 0]} scale={[0.92, 1, 1.12]}>
            <sphereGeometry args={[0.058, 12, 10]} />
          </mesh>
        ))}
        <mesh material={WORLD.brain} position={[0, -0.055, 0]} scale={[1, 1.3, 1]}>
          <sphereGeometry args={[0.022, 8, 6]} />
        </mesh>
      </group>

      <mesh ref={plumbob} material={plumbobMaterial} position={[0, plumbobHeight, 0]}>
        <octahedronGeometry args={[0.085, 0]} />
      </mesh>

      {/* Speech bubble. Sized from the line so a one-word answer is not a billboard, and offset
          to the side so it never sits on top of the name plate. */}
      <group ref={bubble} scale={0} visible={false}>
        <mesh position={[bubbleWidth / 2, 0, 0]}>
          <planeGeometry args={[bubbleWidth, bubbleHeight]} />
          <meshBasicMaterial color="#f8fafc" transparent opacity={0.96} />
        </mesh>
        {/* accent spine, so you can tell who is speaking at a glance */}
        <mesh position={[0.012, 0, 0.001]}>
          <planeGeometry args={[0.024, bubbleHeight]} />
          <meshBasicMaterial color={accent} transparent opacity={0.9} />
        </mesh>
        <Text
          position={[0.1, 0, 0.01]}
          fontSize={BUBBLE_FONT}
          maxWidth={BUBBLE_MAX_TEXT}
          lineHeight={1.3}
          color="#0f172a"
          anchorX="left"
          anchorY="middle"
        >
          {bubbleText}
        </Text>
      </group>

      <group ref={plate} position={[0, 2.34 * appearance.heightScale, 0]}>
        <Text
          fontSize={0.155}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.016}
          outlineColor="#020617"
        >
          {appearance.name}
        </Text>
        <Text
          position={[0, -0.165, 0]}
          fontSize={0.092}
          color={accent}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.011}
          outlineColor="#020617"
        >
          {agent.role.toUpperCase()}
        </Text>
      </group>

      {isSelected && (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.34, 0.44, 28]} />
          <meshBasicMaterial color={accent} transparent opacity={0.45} />
        </mesh>
      )}
    </group>
  );
}
