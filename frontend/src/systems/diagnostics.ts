/**
 * Renderer diagnostics channel.
 *
 * The scoring rule is that no graphics pass counts without measured numbers, and the previous
 * optimisation attempt had none — it was guesswork. This publishes live renderer.info once a
 * second to an HTML overlay and to window.__THREE_GAME_DIAGNOSTICS__ for external inspection.
 *
 * Deliberately not in the Zustand store: it updates on a timer and must never re-render the scene.
 */

export interface Diagnostics {
  fps: number;
  frameMs: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
}

/** Desktop budget from the technical-art render budget table. */
export const BUDGET = {
  calls: 300,
  triangles: 750_000,
  geometries: 300,
  textures: 60,
} as const;

const EMPTY: Diagnostics = {
  fps: 0,
  frameMs: 0,
  calls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  programs: 0,
};

let current: Diagnostics = EMPTY;
const listeners = new Set<(d: Diagnostics) => void>();

export function publishDiagnostics(next: Diagnostics): void {
  current = next;
  listeners.forEach((listener) => listener(next));
  (window as unknown as Record<string, unknown>).__THREE_GAME_DIAGNOSTICS__ = next;
}

export function subscribeDiagnostics(listener: (d: Diagnostics) => void): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function overBudget(d: Diagnostics): string[] {
  const over: string[] = [];
  if (d.calls > BUDGET.calls) over.push('calls');
  if (d.triangles > BUDGET.triangles) over.push('triangles');
  if (d.geometries > BUDGET.geometries) over.push('geometries');
  if (d.textures > BUDGET.textures) over.push('textures');
  return over;
}
