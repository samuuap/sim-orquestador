/**
 * Office Environment Component
 *
 * 3D office space with floor, walls, desks, and decorative elements
 */

import { useMemo } from 'react';
import * as THREE from 'three';

export function Office() {
  // Floor grid pattern
  const floorTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, 256, 256);

    // Grid lines
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;

    for (let i = 0; i <= 8; i++) {
      const pos = (i * 256) / 8;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, 256);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(256, pos);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);

    return texture;
  }, []);

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial map={floorTexture} />
      </mesh>

      {/* CEO Desk (center) */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[1.5, 0.8, 1]} />
          <meshStandardMaterial color="#7c2d12" metalness={0.2} roughness={0.8} />
        </mesh>
        {/* Desk items */}
        <mesh position={[0.3, 0.85, 0.2]} castShadow>
          <boxGeometry args={[0.15, 0.1, 0.1]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
      </group>

      {/* Designer Desk (left side) */}
      <group position={[-4, 0, -2]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[1.2, 0.8, 0.8]} />
          <meshStandardMaterial color="#581c87" metalness={0.2} roughness={0.8} />
        </mesh>
        {/* Computer monitor */}
        <mesh position={[0, 0.9, -0.2]} castShadow>
          <boxGeometry args={[0.6, 0.4, 0.05]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[0, 0.9, -0.2]}>
          <boxGeometry args={[0.55, 0.35, 0.02]} />
          <meshBasicMaterial color="#8b5cf6" />
        </mesh>
      </group>

      {/* Developer Desk (right side) */}
      <group position={[4, 0, -2]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[1.2, 0.8, 0.8]} />
          <meshStandardMaterial color="#1e3a8a" metalness={0.2} roughness={0.8} />
        </mesh>
        {/* Computer monitor */}
        <mesh position={[0, 0.9, -0.2]} castShadow>
          <boxGeometry args={[0.6, 0.4, 0.05]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[0, 0.9, -0.2]}>
          <boxGeometry args={[0.55, 0.35, 0.02]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
        {/* Keyboard */}
        <mesh position={[0, 0.82, 0.2]} castShadow>
          <boxGeometry args={[0.4, 0.02, 0.15]} />
          <meshStandardMaterial color="#374151" />
        </mesh>
      </group>

      {/* Back wall */}
      <mesh position={[0, 2, -6]} castShadow receiveShadow>
        <boxGeometry args={[20, 4, 0.2]} />
        <meshStandardMaterial color="#374151" />
      </mesh>

      {/* Side walls */}
      <mesh position={[-10, 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 4, 12]} />
        <meshStandardMaterial color="#374151" />
      </mesh>

      <mesh position={[10, 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.2, 4, 12]} />
        <meshStandardMaterial color="#374151" />
      </mesh>

      {/* Ceiling lights */}
      <mesh position={[-3, 3.8, -2]}>
        <boxGeometry args={[1, 0.1, 1]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
      <pointLight position={[-3, 3.5, -2]} intensity={0.5} distance={8} color="#fbbf24" />

      <mesh position={[3, 3.8, -2]}>
        <boxGeometry args={[1, 0.1, 1]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
      <pointLight position={[3, 3.5, -2]} intensity={0.5} distance={8} color="#fbbf24" />

      <mesh position={[0, 3.8, 2]}>
        <boxGeometry args={[1, 0.1, 1]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
      <pointLight position={[0, 3.5, 2]} intensity={0.5} distance={8} color="#fbbf24" />

      {/* Decorative plants */}
      <group position={[-8, 0, -4]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.25, 0.6, 16]} />
          <meshStandardMaterial color="#92400e" />
        </mesh>
        <mesh position={[0, 0.8, 0]} castShadow>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#15803d" />
        </mesh>
      </group>

      <group position={[8, 0, -4]}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.25, 0.6, 16]} />
          <meshStandardMaterial color="#92400e" />
        </mesh>
        <mesh position={[0, 0.8, 0]} castShadow>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#15803d" />
        </mesh>
      </group>

      {/* Water cooler */}
      <group position={[6, 0, 4]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 1, 16]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
        <mesh position={[0, 1.2, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.25, 0.4, 16]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.6} />
        </mesh>
      </group>

      {/* Meeting table (front area) */}
      <group position={[0, 0, 4]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[1, 1, 0.1, 32]} />
          <meshStandardMaterial color="#44403c" metalness={0.3} roughness={0.7} />
        </mesh>
        {/* Chairs around table */}
        {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle, i) => (
          <group key={i} rotation={[0, angle, 0]} position={[Math.sin(angle) * 1.3, 0, Math.cos(angle) * 1.3]}>
            <mesh position={[0, 0.25, 0]} castShadow>
              <boxGeometry args={[0.4, 0.5, 0.4]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
            <mesh position={[0, 0.6, -0.15]} castShadow>
              <boxGeometry args={[0.4, 0.4, 0.1]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
          </group>
        ))}
      </group>

      {/* Whiteboard on back wall */}
      <mesh position={[0, 2.5, -5.9]}>
        <planeGeometry args={[3, 1.5]} />
        <meshStandardMaterial color="#f9fafb" />
      </mesh>
      <mesh position={[0, 2.5, -5.89]}>
        <planeGeometry args={[2.9, 1.4]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}
