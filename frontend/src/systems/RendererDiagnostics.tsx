/**
 * Samples renderer.info from inside the Canvas and publishes once a second.
 * Renders nothing.
 */

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { publishDiagnostics } from './diagnostics';

export function RendererDiagnostics() {
  const gl = useThree((state) => state.gl);
  const frames = useRef(0);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    frames.current += 1;
    elapsed.current += delta;
    if (elapsed.current < 1) return;

    const fps = frames.current / elapsed.current;
    publishDiagnostics({
      fps: Math.round(fps),
      frameMs: Math.round((elapsed.current / frames.current) * 1000 * 10) / 10,
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      programs: gl.info.programs?.length ?? 0,
    });

    frames.current = 0;
    elapsed.current = 0;
  });

  return null;
}
