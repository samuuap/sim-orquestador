/**
 * HTML readout of the renderer diagnostics. Toggle with the backtick key.
 *
 * Lives outside the Canvas so its re-renders (once a second) never touch the 3D tree.
 */

import { useEffect, useState } from 'react';
import { BUDGET, type Diagnostics, overBudget, subscribeDiagnostics } from '@/systems/diagnostics';

export function DiagnosticsOverlay() {
  const [visible, setVisible] = useState(false);
  const [d, setD] = useState<Diagnostics | null>(null);

  useEffect(() => subscribeDiagnostics(setD), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '`' || event.key === 'º') setVisible((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!visible || !d) {
    return (
      <div className="pointer-events-none absolute bottom-2 right-3 z-50 font-mono text-[10px] text-slate-500">
        ` diagnostics
      </div>
    );
  }

  const over = overBudget(d);
  const row = (label: string, value: string, bad = false) => (
    <div className="flex justify-between gap-6">
      <span className="text-slate-400">{label}</span>
      <span className={bad ? 'text-rose-400' : 'text-slate-100'}>{value}</span>
    </div>
  );

  return (
    <div className="pointer-events-none absolute bottom-2 right-3 z-50 rounded-md border border-slate-700 bg-slate-900/90 px-3 py-2 font-mono text-[11px] shadow-lg">
      {row('fps', `${d.fps}`, d.fps < 50)}
      {row('frame', `${d.frameMs} ms`, d.frameMs > 20)}
      {row('draw calls', `${d.calls} / ${BUDGET.calls}`, over.includes('calls'))}
      {row('triangles', `${(d.triangles / 1000).toFixed(0)}k / ${BUDGET.triangles / 1000}k`, over.includes('triangles'))}
      {row('geometries', `${d.geometries} / ${BUDGET.geometries}`, over.includes('geometries'))}
      {row('textures', `${d.textures} / ${BUDGET.textures}`, over.includes('textures'))}
      {row('programs', `${d.programs}`)}
      <div className="mt-1 text-[9px] text-slate-500">` to hide</div>
    </div>
  );
}
