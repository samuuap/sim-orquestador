/**
 * Metrics Panel Component
 *
 * Displays real-time agent performance metrics and task statistics
 */

import { Activity, Clock, Zap, DollarSign } from 'lucide-react';
import { useAppStore } from '@/store';

export function MetricsPanel() {
  const agents = useAppStore((state) => state.agents);

  // Calculate aggregate metrics
  const totalTasks = Object.values(agents).reduce((sum, agent) => sum + (agent.tasks_completed || 0), 0);
  const totalTokens = Object.values(agents).reduce((sum, agent) => sum + (agent.total_tokens_used || 0), 0);
  const totalCost = Object.values(agents).reduce((sum, agent) => sum + (agent.total_cost || 0), 0);
  const avgResponseTime =
    Object.values(agents).reduce((sum, agent) => sum + (agent.avg_response_time || 0), 0) / Object.keys(agents).length || 0;

  const activeAgents = Object.values(agents).filter(
    (agent) => agent.state === 'THINKING' || agent.state === 'WORKING'
  ).length;

  return (
    <div className="absolute top-20 right-8 w-96 max-h-[calc(100vh-7rem)] overflow-y-auto bg-slate-900/90 backdrop-blur-xl border border-slate-800/50 rounded-2xl shadow-2xl">
      <div className="p-4">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Activity size={20} className="text-blue-400" />
          System Metrics
        </h2>

        {/* Aggregate stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity size={16} className="text-green-400" />
              <span className="text-xs text-gray-400">Active Agents</span>
            </div>
            <div className="text-2xl font-bold text-white">{activeAgents}</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} className="text-blue-400" />
              <span className="text-xs text-gray-400">Tasks Done</span>
            </div>
            <div className="text-2xl font-bold text-white">{totalTasks}</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={16} className="text-yellow-400" />
              <span className="text-xs text-gray-400">Total Tokens</span>
            </div>
            <div className="text-2xl font-bold text-white">{totalTokens.toLocaleString()}</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={16} className="text-green-400" />
              <span className="text-xs text-gray-400">Total Cost</span>
            </div>
            <div className="text-2xl font-bold text-white">${totalCost.toFixed(4)}</div>
          </div>
        </div>

        {/* Average response time */}
        <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-purple-400" />
            <span className="text-xs text-gray-400">Avg Response Time</span>
          </div>
          <div className="text-2xl font-bold text-white">{avgResponseTime.toFixed(2)}s</div>
        </div>

        {/* Individual agent metrics */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Agent Details</h3>
          {Object.values(agents).map((agent) => (
            <div key={agent.agent_id} className="bg-gray-800/30 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white capitalize">{agent.role}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    agent.state === 'IDLE'
                      ? 'bg-gray-700 text-gray-300'
                      : agent.state === 'THINKING'
                      ? 'bg-amber-900/50 text-amber-300'
                      : agent.state === 'WORKING'
                      ? 'bg-green-900/50 text-green-300'
                      : agent.state === 'WAITING'
                      ? 'bg-purple-900/50 text-purple-300'
                      : agent.state === 'COMPLETED'
                      ? 'bg-green-900/50 text-green-300'
                      : 'bg-red-900/50 text-red-300'
                  }`}
                >
                  {agent.state}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
                <div>
                  <div className="text-gray-500">Tasks</div>
                  <div className="text-white font-medium">{agent.tasks_completed || 0}</div>
                </div>
                <div>
                  <div className="text-gray-500">Tokens</div>
                  <div className="text-white font-medium">{(agent.total_tokens_used || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-gray-500">Cost</div>
                  <div className="text-white font-medium">${(agent.total_cost || 0).toFixed(4)}</div>
                </div>
              </div>
              {agent.current_task && (
                <div className="mt-2 text-xs text-gray-400 truncate">
                  <span className="text-gray-500">Task:</span> {agent.current_task}
                </div>
              )}
              <div className="mt-1 text-xs text-gray-500">
                Avg: {(agent.avg_response_time || 0).toFixed(2)}s
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
