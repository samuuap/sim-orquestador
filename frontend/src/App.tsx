import { useWebSocket } from '@/hooks/useWebSocket';
import { useAppStore } from '@/store';
import { OfficeScene } from '@/components/OfficeScene';
import { DiagnosticsOverlay } from '@/components/DiagnosticsOverlay';
import { SystemPromptPanel } from '@/components/SystemPromptPanel';
import { TopBar } from '@/components/TopBar';
import { ProposalPanel } from '@/components/ProposalPanel';
import { AgentDetailsPanel } from '@/components/AgentDetailsPanel';
import { MetricsPanel } from '@/components/MetricsPanel';
import { EventLog } from '@/components/EventLog';

function App() {
  // This hook automatically connects on mount and disconnects on unmount
  useWebSocket();

  const showMetrics = useAppStore((state) => state.showMetrics);
  const showEventLog = useAppStore((state) => state.showEventLog);
  const selectedAgent = useAppStore((state) => state.selectedAgent);

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Top navigation bar */}
      <TopBar />

      {/* Main 3D scene */}
      <div className="absolute inset-0 top-16">
        <OfficeScene />
        <DiagnosticsOverlay />
      </div>

      {/* Left column - event stream above the proposal form */}
      {showEventLog && <EventLog />}
      <ProposalPanel />

      {/* Right column. Clicking a character swaps the stats for that agent's system prompt,
          rather than stacking a second panel on top of it. */}
      {selectedAgent ? (
        <SystemPromptPanel />
      ) : showMetrics ? (
        <MetricsPanel />
      ) : (
        <AgentDetailsPanel />
      )}
    </div>
  );
}

export default App;
