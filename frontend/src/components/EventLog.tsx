/**
 * Event Log Component
 *
 * Displays real-time stream of agent events and system messages
 */

import { useEffect, useRef } from 'react';
import { ScrollText, CheckCircle, AlertCircle, Info, Loader } from 'lucide-react';
import { useAppStore } from '@/store';
import type { WSEvent } from '@/types';

const eventIcons: Record<string, JSX.Element> = {
  PROPOSAL_RECEIVED: <Info size={16} className="text-blue-400" />,
  CEO_EVALUATING: <Loader size={16} className="text-amber-400 animate-spin" />,
  CEO_PLANNING: <Loader size={16} className="text-amber-400 animate-spin" />,
  DESIGNER_ANALYZING: <Loader size={16} className="text-purple-400 animate-spin" />,
  DESIGNER_WORKING: <Loader size={16} className="text-purple-400 animate-spin" />,
  DEVELOPER_ANALYZING: <Loader size={16} className="text-blue-400 animate-spin" />,
  DEVELOPER_WORKING: <Loader size={16} className="text-blue-400 animate-spin" />,
  TASK_COMPLETED: <CheckCircle size={16} className="text-green-400" />,
  TASK_FAILED: <AlertCircle size={16} className="text-red-400" />,
  SYSTEM_MESSAGE: <Info size={16} className="text-gray-400" />,
};

const eventColors: Record<string, string> = {
  PROPOSAL_RECEIVED: 'text-blue-400',
  CEO_EVALUATING: 'text-amber-400',
  CEO_PLANNING: 'text-amber-400',
  DESIGNER_ANALYZING: 'text-purple-400',
  DESIGNER_WORKING: 'text-purple-400',
  DEVELOPER_ANALYZING: 'text-blue-400',
  DEVELOPER_WORKING: 'text-blue-400',
  TASK_COMPLETED: 'text-green-400',
  TASK_FAILED: 'text-red-400',
  SYSTEM_MESSAGE: 'text-gray-400',
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour12: false });
}

function EventItem({ event }: { event: WSEvent }) {
  const icon = eventIcons[event.event_type] || <Info size={16} className="text-gray-400" />;
  const color = eventColors[event.event_type] || 'text-gray-400';

  return (
    <div className="flex gap-3 p-2 hover:bg-gray-800/30 rounded transition-colors">
      <div className="flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className={`text-sm font-medium ${color}`}>
            {event.event_type?.replace(/_/g, ' ') || 'UNKNOWN'}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0">
            {formatTimestamp(event.timestamp)}
          </span>
        </div>
        {event.payload?.message && (
          <p className="text-sm text-gray-300 break-words">{event.payload.message}</p>
        )}
        {event.agent_id && (
          <span className="text-xs text-gray-500">Agent: {event.agent_id}</span>
        )}
        {event.payload?.task_id && (
          <span className="text-xs text-gray-500 ml-2">Task: {event.payload.task_id}</span>
        )}
        {event.payload?.error && (
          <p className="text-sm text-red-400 mt-1 break-words">{event.payload.error}</p>
        )}
        {event.payload?.duration && (
          <span className="text-xs text-gray-500 ml-2">
            Duration: {event.payload.duration.toFixed(2)}s
          </span>
        )}
        {event.payload?.tokens && (
          <span className="text-xs text-gray-500 ml-2">
            Tokens: {event.payload.tokens.toLocaleString()}
          </span>
        )}
        {event.payload?.cost && (
          <span className="text-xs text-gray-500 ml-2">
            Cost: ${event.payload.cost.toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
}

export function EventLog() {
  const events = useAppStore((state) => state.events);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="absolute top-4 left-4 w-96 h-[calc(100vh-8rem)] bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <ScrollText size={20} className="text-blue-400" />
          Event Log
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          {events.length} event{events.length !== 1 ? 's' : ''} recorded
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No events yet. Submit a proposal to get started.
          </div>
        ) : (
          events.map((event, index) => <EventItem key={index} event={event} />)
        )}
      </div>
    </div>
  );
}
