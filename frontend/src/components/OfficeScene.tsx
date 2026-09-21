/**
 * 3D Office Scene Component - Clean Modern Style
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { AgentAvatar } from './AgentAvatar';
import { Office } from './Office';
import { useAppStore } from '@/store';

export function OfficeScene() {
  const agents = useAppStore((state) => state.agents);
  const agentList = Object.values(agents);

  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: false,
        }}
        dpr={[1, 2]}
      >
        {/* Camera - Isometric-style view */}
        <PerspectiveCamera
          makeDefault
          position={[12, 12, 12]}
          fov={50}
        />

        {/* Lighting setup - clean and bright */}
        <ambientLight intensity={0.6} />

        <directionalLight
          position={[10, 15, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={50}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
        />

        <directionalLight
          position={[-5, 8, -5]}
          intensity={0.4}
          color="#a855f7"
        />

        <pointLight
          position={[0, 5, 0]}
          intensity={0.3}
          color="#3b82f6"
        />

        {/* Environment for subtle reflections */}
        <Environment preset="city" />

        {/* Office environment */}
        <Office />

        {/* Agent avatars */}
        {agentList.map((agent) => (
          <AgentAvatar
            key={agent.agent_id}
            agent={agent}
          />
        ))}

        {/* Camera controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={8}
          maxDistance={25}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
