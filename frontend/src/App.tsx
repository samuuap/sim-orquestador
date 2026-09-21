/**
 * App Component
 *
 * Main application component that orchestrates the 3D office scene and UI overlays
 */

import { useEffect } from 'react';
import { OfficeScene } from '@/components/OfficeScene';
import { ProposalInput } from '@/components/ProposalInput';
import { MetricsPanel } from '@/components/MetricsPanel';
import { EventLog } from '@/components/EventLog';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAppStore } from '@/store';

function App() {
  const { connect, disconnect } = useWebSocket();
  const connectionInfo = useAppStore((state) => state.connectionInfo);

  useEffect(() => {
    // Connect to WebSocket on mount
    connect();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return (
    <div className="w-screen h-screen bg-gray-950 overflow-hidden">
      {/* 3D Office Scene */}
      <OfficeScene />

      {/* UI Overlays */}
      <EventLog />
      <MetricsPanel />
      <ProposalInput />

      {/* Connection Status Banner */}
      {!connectionInfo.connected && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/90 backdrop-blur-sm border border-red-700 rounded-lg px-4 py-2 shadow-xl">
          <p className="text-red-200 text-sm font-medium">
            {connectionInfo.error || 'Disconnected from server'}
          </p>
          {connectionInfo.reconnectAttempts > 0 && (
            <p className="text-red-300 text-xs mt-1">
              Reconnecting... (attempt {connectionInfo.reconnectAttempts})
            </p>
          )}
        </div>
      )}

      {/* Loading State */}
      {connectionInfo.connected && Object.keys(useAppStore.getState().agents).length === 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg px-8 py-6 shadow-xl">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            <p className="text-white font-medium">Initializing Office...</p>
            <p className="text-gray-400 text-sm">Loading agents and workspace</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
