import { useWebSocket } from '@/hooks/useWebSocket';
import { OfficeScene } from '@/components/OfficeScene';
import { TopBar } from '@/components/TopBar';
import { ProposalPanel } from '@/components/ProposalPanel';
import { AgentDetailsPanel } from '@/components/AgentDetailsPanel';

function App() {
  // This hook automatically connects on mount and disconnects on unmount
  useWebSocket();

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Top navigation bar */}
      <TopBar />

      {/* Main 3D scene */}
      <div className="absolute inset-0 top-16">
        <OfficeScene />
      </div>

      {/* Left panel - Proposal input */}
      <ProposalPanel />

      {/* Right panel - Agent details */}
      <AgentDetailsPanel />
    </div>
  );
}

export default App;
