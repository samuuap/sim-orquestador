/**
 * Office Environment Component - Clean and Modern
 */

export function Office() {
  return (
    <group>
      {/* Floor - large and clean */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>

      {/* Grid pattern on floor */}
      <gridHelper
        args={[30, 30, '#334155', '#1e293b']}
        position={[0, 0.01, 0]}
      />

      {/* Central platform */}
      <mesh position={[0, 0.1, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[8, 8, 0.2, 32]} />
        <meshStandardMaterial
          color="#334155"
          roughness={0.6}
          metalness={0.3}
        />
      </mesh>

      {/* Ambient light pillars - decorative */}
      {[-6, 6].map((x, idx) => (
        <group key={idx} position={[x, 0, 8]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.2, 0.2, 3, 16]} />
            <meshStandardMaterial
              color="#475569"
              emissive="#3b82f6"
              emissiveIntensity={0.2}
              roughness={0.4}
              metalness={0.6}
            />
          </mesh>
        </group>
      ))}

      {[-6, 6].map((x, idx) => (
        <group key={`back-${idx}`} position={[x, 0, -8]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.2, 0.2, 3, 16]} />
            <meshStandardMaterial
              color="#475569"
              emissive="#a855f7"
              emissiveIntensity={0.2}
              roughness={0.4}
              metalness={0.6}
            />
          </mesh>
        </group>
      ))}

      {/* Desks for each agent */}
      {/* CEO desk - center */}
      <mesh position={[0, 0.4, 2]} castShadow>
        <boxGeometry args={[1.5, 0.1, 0.8]} />
        <meshStandardMaterial color="#475569" roughness={0.7} />
      </mesh>

      {/* Designer desk - left */}
      <mesh position={[-4, 0.4, -2]} castShadow>
        <boxGeometry args={[1.5, 0.1, 0.8]} />
        <meshStandardMaterial color="#475569" roughness={0.7} />
      </mesh>

      {/* Developer desk - right */}
      <mesh position={[4, 0.4, -2]} castShadow>
        <boxGeometry args={[1.5, 0.1, 0.8]} />
        <meshStandardMaterial color="#475569" roughness={0.7} />
      </mesh>
    </group>
  );
}
