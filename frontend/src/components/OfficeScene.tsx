/**
 * 3D Office Scene Component
 *
 * Renders the isometric office environment with agent avatars
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid } from '@react-three/drei';
import { AgentAvatar } from './AgentAvatar';
import { Office } from './Office';
import { useAppStore } from '@/store';

export function OfficeScene() {
  const agents = useAppStore((state) => Object.values(state.agents));

  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        {/* Camera - Isometric view */}
        <PerspectiveCamera
          makeDefault
          position={[10, 10, 10]}
          fov={50}
        />

        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight
          position={[-5, 5, -5]}
          intensity={0.3}
        />

        {/* Office environment */}
        <Office />

        {/* Grid */}
        <Grid
          args={[20, 20]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#6b7280"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#374151"
          fadeDistance={30}
          fadeStrength={1}
          position={[0, 0.01, 0]}
        />

        {/* Agent avatars */}
        {agents.map((agent) => (
          <AgentAvatar
            key={agent.agent_id}
            agent={agent}
          />
        ))}

        {/* Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2.2}
        />
      </Canvas>
    </div>
  );
}
