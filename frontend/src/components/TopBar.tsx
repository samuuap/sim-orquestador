/**
 * Top Navigation Bar Component
 */

import { Wifi, WifiOff, Clock, ScrollText, BarChart3, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { useEffect, useState } from 'react';

export function TopBar() {
  const connectionInfo = useAppStore((state) => state.connectionInfo);
  const agents = useAppStore((state) => state.agents);
  const isProcessing = useAppStore((state) => state.isProcessing);
  const showMetrics = useAppStore((state) => state.showMetrics);
  const showEventLog = useAppStore((state) => state.showEventLog);
  const toggleMetrics = useAppStore((state) => state.toggleMetrics);
  const toggleEventLog = useAppStore((state) => state.toggleEventLog);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeAgents = Object.values(agents).filter(
    (a) => a.state !== 'IDLE'
  ).length;

  return (
    <div className="absolute top-0 left-0 right-0 h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 z-50">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left section - Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">OS</span>
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm">Office Simulator</h1>
            <p className="text-slate-400 text-xs">Multi-Agent System</p>
          </div>
        </div>

        {/* Center section - Stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            {isProcessing ? (
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            ) : (
              <div
                className={`w-2 h-2 rounded-full ${
                  activeAgents > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
            )}
            <span className="text-slate-300 text-sm">
              {isProcessing ? 'Orchestrating...' : `${activeAgents} agents active`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300 text-sm font-mono">
              {currentTime.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          </div>
        </div>

        {/* Right section - Panel toggles and connection status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleEventLog}
              title="Toggle event log"
              className={`p-2 rounded-lg transition-colors ${
                showEventLog
                  ? 'bg-slate-800 text-blue-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <ScrollText className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleMetrics}
              title="Toggle detailed metrics"
              className={`p-2 rounded-lg transition-colors ${
                showMetrics
                  ? 'bg-slate-800 text-purple-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
          {connectionInfo?.connected ? (
            <>
              <Wifi className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 text-sm font-medium">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm font-medium">Disconnected</span>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
