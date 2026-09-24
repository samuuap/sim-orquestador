/**
 * Agent Details Panel Component
 */

import { User, Brain, ClipboardList, Palette, Code, Activity, Zap } from 'lucide-react';
import { useAppStore } from '@/store';
import type { Agent } from '@/types';

const agentIcons = {
  ceo: Brain,
  project_manager: ClipboardList,
  designer: Palette,
  developer: Code,
};

const agentColors = {
  ceo: 'from-red-500 to-orange-500',
  project_manager: 'from-teal-500 to-emerald-500',
  designer: 'from-purple-500 to-pink-500',
  developer: 'from-blue-500 to-cyan-500',
};

const stateColors = {
  IDLE: 'text-slate-400',
  THINKING: 'text-amber-400',
  WORKING: 'text-emerald-400',
  WAITING: 'text-purple-400',
  COMPLETED: 'text-green-400',
  ERROR: 'text-red-400',
};

function AgentCard({ agent, isSelected, onSelect }: {
  agent: Agent;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const Icon = agentIcons[agent.role];
  const gradient = agentColors[agent.role];
  const stateColor = stateColors[agent.state];
  const isActive = agent.state !== 'IDLE';

  const borderClass = isSelected
    ? 'border-blue-500/70 ring-1 ring-blue-500/40'
    : isActive
    ? 'border-slate-600'
    : 'border-slate-700/50';

  return (
    <div
      onClick={onSelect}
      className={`relative bg-slate-800/50 backdrop-blur-sm border ${borderClass} rounded-xl p-4 transition-all hover:border-slate-600 cursor-pointer`}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      )}

      {/* Agent icon */}
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3`}>
        <Icon className="w-6 h-6 text-white" />
      </div>

      {/* Agent info */}
      <div className="mb-3">
        <h3 className="text-white font-semibold capitalize">{agent.role}</h3>
        <p className="text-slate-400 text-xs mt-0.5">ID: {agent.agent_id}</p>
      </div>

      {/* State */}
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3 h-3 text-slate-500" />
        <span className={`text-xs font-medium ${stateColor}`}>
          {agent.state}
        </span>
      </div>

      {/* Live counters */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-700/50">
        <div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wide">Tasks</div>
          <div className="text-slate-200 text-xs font-medium">{agent.tasks_completed ?? 0}</div>
        </div>
        <div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wide">Tokens</div>
          <div className="text-slate-200 text-xs font-medium">
            {(agent.total_tokens_used ?? 0).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-slate-500 text-[10px] uppercase tracking-wide">Cost</div>
          <div className="text-slate-200 text-xs font-medium">
            ${(agent.total_cost ?? 0).toFixed(4)}
          </div>
        </div>
      </div>

      {/* Current task */}
      {agent.current_task && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <div className="flex items-start gap-2">
            <Zap className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-slate-300 text-xs line-clamp-2">
              {agent.current_task}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentDetailsPanel() {
  const agents = useAppStore((state) => state.agents);
  const selectedAgent = useAppStore((state) => state.selectedAgent);
  const selectAgent = useAppStore((state) => state.selectAgent);
  const events = useAppStore((state) => state.events);

  const agentList = Object.values(agents);
  const recentEvents = events.slice(-5); // Last 5 events

  return (
    <div className="absolute top-24 right-8 w-96 max-h-[calc(100vh-8rem)] bg-slate-900/90 backdrop-blur-xl border border-slate-800/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-purple-400" />
          <h2 className="text-white font-semibold">Active Agents</h2>
        </div>
        <p className="text-slate-400 text-xs mt-1">
          {agentList.length} agents in the office
        </p>
      </div>

      {/* Agents list */}
      <div className="p-4 space-y-3 overflow-y-auto flex-1">
        {agentList.map((agent) => (
          <AgentCard
            key={agent.agent_id}
            agent={agent}
            isSelected={selectedAgent === agent.agent_id}
            onSelect={() =>
              selectAgent(selectedAgent === agent.agent_id ? undefined : agent.agent_id)
            }
          />
        ))}
      </div>

      {/* Recent events */}
      <div className="border-t border-slate-800/50 px-4 py-3">
        <h3 className="text-slate-400 text-xs font-semibold mb-2">Recent Activity</h3>
        <div className="space-y-1">
          {recentEvents.length === 0 ? (
            <p className="text-slate-500 text-xs">No recent activity</p>
          ) : (
            recentEvents.map((event, idx) => (
              <div key={idx} className="text-xs text-slate-400 truncate">
                • {event.event_type?.replace(/_/g, ' ') || 'Event'}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
