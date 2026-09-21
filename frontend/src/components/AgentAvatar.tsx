/**
 * Agent Avatar Component
 *
 * 3D representation of an agent with state-based animations
 */

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Agent } from '@/types';
import { useAppStore } from '@/store';

interface AgentAvatarProps {
  agent: Agent;
}

export function AgentAvatar({ agent }: AgentAvatarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const selectedAgent = useAppStore((state) => state.selectedAgent);

  const isSelected = selectedAgent === agent.agent_id;

  // Agent colors by role
  const colorMap = {
    ceo: '#ef4444', // Red
    designer: '#8b5cf6', // Purple
    developer: '#3b82f6', // Blue
  };

  // State colors
  const stateColorMap = {
    IDLE: '#6b7280', // Gray
    THINKING: '#f59e0b', // Amber
    WORKING: '#10b981', // Green
    WAITING: '#8b5cf6', // Purple
    COMPLETED: '#22c55e', // Green
    ERROR: '#ef4444', // Red
  };

  const baseColor = colorMap[agent.role];
  const stateColor = stateColorMap[agent.state];

  // Animation based on state
  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.getElapsedTime();

    switch (agent.state) {
      case 'THINKING':
        // Slow rotation
        meshRef.current.rotation.y = Math.sin(time * 2) * 0.3;
        break;

      case 'WORKING':
        // Bobbing up and down
        meshRef.current.position.y = agent.position[1] + Math.sin(time * 3) * 0.1 + 0.5;
        break;

      case 'COMPLETED':
        // Quick spin
        meshRef.current.rotation.y += 0.1;
        break;

      case 'ERROR':
        // Shake
        meshRef.current.position.x = agent.position[0] + Math.sin(time * 10) * 0.05;
        break;

      default:
        // Reset to base position
        meshRef.current.position.set(...agent.position);
        meshRef.current.position.y += 0.5;
        meshRef.current.rotation.y = agent.rotation;
    }
  });

  return (
    <group position={agent.position}>
      {/* Agent body - capsule shape */}
      <mesh
        ref={meshRef}
        position={[0, 0.5, 0]}
        castShadow
        onClick={() => selectAgent(agent.agent_id)}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <capsuleGeometry args={[0.3, 0.6, 16, 32]} />
        <meshStandardMaterial
          color={hovered || isSelected ? stateColor : baseColor}
          emissive={stateColor}
          emissiveIntensity={hovered || isSelected ? 0.5 : 0.2}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.6, 0.7, 32]} />
          <meshBasicMaterial color={baseColor} transparent opacity={0.5} />
        </mesh>
      )}

      {/* State indicator above head */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={stateColor} />
      </mesh>

      {/* Agent label */}
      <Text
        position={[0, 2, 0]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {agent.role.toUpperCase()}
      </Text>

      {/* State label */}
      <Text
        position={[0, 1.7, 0]}
        fontSize={0.15}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.01}
        outlineColor="#000000"
      >
        {agent.state}
      </Text>

      {/* Current task label (if any) */}
      {agent.current_task && (
        <Text
          position={[0, -0.3, 0]}
          fontSize={0.12}
          color="#d1d5db"
          anchorX="center"
          anchorY="middle"
          maxWidth={2}
          textAlign="center"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {agent.current_task}
        </Text>
      )}

      {/* Shadow plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[0.5, 32]} />
        <shadowMaterial opacity={0.3} />
      </mesh>
    </group>
  );
}
