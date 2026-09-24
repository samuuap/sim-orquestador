/**
 * Office Environment.
 *
 * Coordinates here are the contract for behavior/officeMap.ts — if a desk, the cooler or the
 * whiteboard moves, move its waypoint too or characters will walk to the wrong place.
 *
 * Desk surfaces sit at y=0.75 so a ~1.6-unit-tall character reaches them plausibly. The previous
 * 0.45 height left everyone typing on air.
 */

const DESK_SURFACE_Y = 0.75;

interface DeskProps {
  position: [number, number, number];
  accent: string;
  /** Which way the monitor faces: the occupant stands on the opposite side. */
  facing: 1 | -1;
}

function Desk({ position, accent, facing }: DeskProps) {
  const [x, , z] = position;
  return (
    <group position={[x, 0, z]}>
      {/* surface */}
      <mesh position={[0, DESK_SURFACE_Y, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.07, 0.95]} />
        <meshStandardMaterial color="#4a5568" roughness={0.7} />
      </mesh>
      {/* legs */}
      {[
        [-0.75, -0.38],
        [0.75, -0.38],
        [-0.75, 0.38],
        [0.75, 0.38],
      ].map(([lx, lz]) => (
        <mesh key={`${lx}-${lz}`} position={[lx, DESK_SURFACE_Y / 2, lz]} castShadow>
          <boxGeometry args={[0.07, DESK_SURFACE_Y, 0.07]} />
          <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
      {/* monitor, angled toward whoever stands at the desk */}
      <group position={[0, DESK_SURFACE_Y + 0.05, -0.2 * facing]}>
        <mesh position={[0, 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.15, 0.03, 12]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.05, 0.25, 0.05]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.46, 0]} rotation={[facing * 0.16, facing > 0 ? 0 : Math.PI, 0]} castShadow>
          <boxGeometry args={[0.82, 0.48, 0.04]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.3} />
        </mesh>
        {/* glowing screen face */}
        <mesh position={[0, 0.46, 0.035 * facing]} rotation={[facing * 0.16, facing > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[0.74, 0.4]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} />
        </mesh>
      </group>
      {/* keyboard */}
      <mesh position={[0, DESK_SURFACE_Y + 0.05, 0.26 * facing]} castShadow>
        <boxGeometry args={[0.52, 0.025, 0.18]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>
    </group>
  );
}

export function Office() {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.2} />
      </mesh>
      <gridHelper args={[30, 30, '#334155', '#1e293b']} position={[0, -0.015, 0]} />

      {/* Central platform. Characters stay inside radius 6.4 (see officeMap). */}
      <mesh position={[0, -0.05, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[8, 8, 0.1, 48]} />
        <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Rug marking the social spot the lounge waypoints point at */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, -3.4]} receiveShadow>
        <circleGeometry args={[2.1, 32]} />
        <meshStandardMaterial color="#3f3a5a" roughness={0.95} />
      </mesh>

      {/* Decorative light pillars */}
      {[
        { x: -6, z: 8, color: '#3b82f6' },
        { x: 6, z: 8, color: '#3b82f6' },
        { x: -6, z: -8, color: '#a855f7' },
        { x: 6, z: -8, color: '#a855f7' },
      ].map(({ x, z, color }) => (
        <mesh key={`${x}-${z}`} position={[x, 1.5, z]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 3, 16]} />
          <meshStandardMaterial
            color="#475569"
            emissive={color}
            emissiveIntensity={0.2}
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>
      ))}

      {/* Desks. Occupants stand on the +z side of the CEO desk and the +z side of the others. */}
      <Desk position={[0, 0, 2]} accent="#f97316" facing={1} />
      <Desk position={[-4, 0, -2]} accent="#a855f7" facing={1} />
      <Desk position={[4, 0, -2]} accent="#3b82f6" facing={1} />

      {/* Water cooler — the 'drinking' waypoint */}
      <group position={[6.8, 0, 3.6]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.36, 0.9, 0.36]} />
          <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.2, 0.5, 16]} />
          <meshStandardMaterial color="#60a5fa" roughness={0.15} metalness={0.1} transparent opacity={0.72} />
        </mesh>
      </group>

      {/* Whiteboard — the 'presenting' waypoint */}
      <group position={[0, 0, -6.7]}>
        <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.4, 1.9, 0.09]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.45} />
        </mesh>
        <mesh position={[0, 1.5, 0.05]}>
          <planeGeometry args={[3.2, 1.7]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x * 2.9, 0.75, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 1.5, 10]} />
            <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.4} />
          </mesh>
        ))}
      </group>

      {/* Plant by the window waypoint */}
      <group position={[-7.5, 0, 4.4]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.26, 0.2, 0.5, 14]} />
          <meshStandardMaterial color="#7c4a3a" roughness={0.85} />
        </mesh>
        {[
          [0, 0.85, 0, 1.0],
          [0.17, 0.72, 0.1, 0.72],
          [-0.15, 0.75, -0.11, 0.66],
        ].map(([x, y, z, s]) => (
          <mesh key={`${x}-${y}`} position={[x, y, z]} scale={[s, s * 1.35, s]} castShadow>
            <sphereGeometry args={[0.3, 12, 10]} />
            <meshStandardMaterial color="#16a34a" roughness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
