/**
 * Agent Avatar Component - Simplified and Modern
 */

import { useRef } from 'react';
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
  const selectAgent = useAppStore((state) => state.selectAgent);
  const selectedAgent = useAppStore((state) => state.selectedAgent);

  const isSelected = selectedAgent === agent.agent_id;

  // Agent colors by role - more vibrant
  const colorMap = {
    ceo: '#f97316', // Orange
    designer: '#a855f7', // Purple
    developer: '#3b82f6', // Blue
  };

  // State-based emissive intensity
  const getEmissiveIntensity = () => {
    switch (agent.state) {
      case 'THINKING':
      case 'WORKING':
        return 0.6;
      case 'COMPLETED':
        return 0.8;
      case 'ERROR':
        return 1.0;
      default:
        return 0.2;
    }
  };

  const baseColor = colorMap[agent.role];

  // Subtle animation based on state
  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.getElapsedTime();

    switch (agent.state) {
      case 'THINKING':
        // Gentle float
        meshRef.current.position.y = agent.position[1] + Math.sin(time * 2) * 0.1 + 1;
        meshRef.current.rotation.y += 0.01;
        break;

      case 'WORKING':
        // Faster bobbing
        meshRef.current.position.y = agent.position[1] + Math.sin(time * 4) * 0.15 + 1;
        break;

      case 'COMPLETED':
        // Quick spin
        meshRef.current.rotation.y += 0.05;
        break;

      case 'ERROR':
        // Slight shake
        meshRef.current.position.x = agent.position[0] + Math.sin(time * 15) * 0.05;
        break;

      default:
        // Reset to base position with gentle idle float
        meshRef.current.position.x = agent.position[0];
        meshRef.current.position.y = agent.position[1] + Math.sin(time * 0.5) * 0.05 + 1;
        meshRef.current.position.z = agent.position[2];
        meshRef.current.rotation.y = agent.rotation;
    }
  });

  return (
    <group position={agent.position}>
      {/* Main avatar body - smooth rounded cylinder */}
      <mesh
        ref={meshRef}
        position={[0, 1, 0]}
        castShadow
        onClick={() => selectAgent(agent.agent_id)}
      >
        <cylinderGeometry args={[0.3, 0.3, 1.2, 32]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={getEmissiveIntensity()}
          metalness={0.4}
          roughness={0.5}
        />
      </mesh>

      {/* Selection indicator - ring at base */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color={baseColor} transparent opacity={0.6} />
        </mesh>
      )}

      {/* Role label floating above */}
      <Text
        position={[0, 2.2, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {agent.role.toUpperCase()}
      </Text>

      {/* Subtle shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[0.4, 32]} />
        <shadowMaterial opacity={0.4} />
      </mesh>
    </group>
  );
}
