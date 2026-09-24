/**
 * Scene root: renderer configuration, lighting rig, camera.
 *
 * Changes from the first version, all aimed at the frame budget:
 *  - Environment preset="city" removed. It downloaded an HDRI and ran a PMREM convolution for
 *    reflections that a matte office does not show. A hemisphere fill reads the same here.
 *  - One shadow-casting light instead of shadows on everything, 1024 map instead of 2048, with the
 *    shadow camera pulled tight around the play area so the resolution goes where it is seen.
 *  - DPR capped at 1.5. On a Retina panel the previous cap of 2 meant rendering 4x the pixels.
 *  - ACES tone mapping and a deliberate exposure, so the palette resolves instead of clipping.
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { AgentAvatar } from './AgentAvatar';
import { Office } from './Office';
import { RendererDiagnostics } from '@/systems/RendererDiagnostics';
import { useAppStore } from '@/store';

export function OfficeScene() {
  const agents = useAppStore((state) => state.agents);
  const agentList = Object.values(agents);

  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl, scene }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          scene.background = new THREE.Color('#0b1220');
          // Fog adds depth against the skyline; it is not standing in for missing geometry.
          scene.fog = new THREE.Fog('#0b1220', 26, 54);
        }}
      >
        <PerspectiveCamera makeDefault position={[13, 11, 13]} fov={42} />

        {/* Fill: sky/ground hemisphere keeps shadowed sides legible without a second shadow map. */}
        <hemisphereLight args={['#c7d8ff', '#2a2f3d', 0.85]} />

        {/* Key: the only shadow caster in the scene. */}
        <directionalLight
          position={[9, 13, 6]}
          intensity={2.1}
          color="#fff4e0"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0006}
          shadow-normalBias={0.02}
          shadow-camera-near={1}
          shadow-camera-far={38}
          shadow-camera-left={-11}
          shadow-camera-right={11}
          shadow-camera-top={11}
          shadow-camera-bottom={-11}
        />

        {/* Rim from behind the window wall: separates characters from the background. */}
        <directionalLight position={[-12, 6, -8]} intensity={0.7} color="#7aa2ff" />

        {/* Practical: warm bounce off the desk cluster, no shadow. */}
        <pointLight position={[0, 2.6, 1]} intensity={12} distance={11} decay={2} color="#ffd9a0" />

        <Office />

        {agentList.map((agent) => (
          <AgentAvatar key={agent.agent_id} agent={agent} />
        ))}

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={6}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2.15}
          target={[0, 0.9, -0.5]}
        />

        <RendererDiagnostics />
      </Canvas>
    </div>
  );
}
