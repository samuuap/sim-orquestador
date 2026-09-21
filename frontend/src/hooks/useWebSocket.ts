/**
 * React hook for WebSocket connection and event handling
 */

import { useEffect } from 'react';
import { useAppStore } from '@/store';
import { wsService } from '@/services/websocket';
import type { WSEvent, Agent } from '@/types';

export function useWebSocket() {
  const {
    setConnection,
    updateAgent,
    addEvent,
    agents,
  } = useAppStore();

  useEffect(() => {
    // Connect to WebSocket
    wsService.connect();

    // Handle connection status
    const unsubConnection = wsService.onConnection((connected) => {
      setConnection({
        connected,
        connected_at: connected ? new Date().toISOString() : undefined,
        last_heartbeat: connected ? new Date().toISOString() : undefined,
      });
    });

    // Handle events
    const unsubEvent = wsService.onEvent((event: WSEvent) => {
      // Add to event log
      addEvent(event);

      // Handle specific event types
      handleEvent(event);
    });

    // Cleanup
    return () => {
      unsubConnection();
      unsubEvent();
      wsService.disconnect();
    };
  }, []);

  const handleEvent = (event: WSEvent) => {
    const { event_type, agent_id, payload } = event;

    if (!agent_id) return;

    const agent = agents[agent_id];
    if (!agent) return;

    // Update agent state based on event type
    switch (event_type) {
      case 'CEO_EVALUATING':
        updateAgent({ ...agent, state: 'THINKING', current_task: 'Evaluating proposal' });
        break;

      case 'CEO_EVALUATION_COMPLETE':
        updateAgent({ ...agent, state: 'COMPLETED', current_task: undefined });
        setTimeout(() => updateAgent({ ...agent, state: 'IDLE' }), 2000);
        break;

      case 'CEO_PLAN_CREATED':
        updateAgent({ ...agent, state: 'COMPLETED', current_task: undefined });
        setTimeout(() => updateAgent({ ...agent, state: 'IDLE' }), 2000);
        break;

      case 'CEO_ERROR':
        updateAgent({ ...agent, state: 'ERROR', current_task: undefined });
        setTimeout(() => updateAgent({ ...agent, state: 'IDLE' }), 3000);
        break;

      case 'DESIGNER_ANALYZING':
        updateAgent({ ...agent, state: 'WORKING', current_task: payload.description || 'Design work' });
        break;

      case 'DESIGNER_ANALYSIS_COMPLETE':
        updateAgent({ ...agent, state: 'COMPLETED', current_task: undefined });
        setTimeout(() => updateAgent({ ...agent, state: 'IDLE' }), 2000);
        break;

      case 'DESIGNER_ERROR':
        updateAgent({ ...agent, state: 'ERROR', current_task: undefined });
        setTimeout(() => updateAgent({ ...agent, state: 'IDLE' }), 3000);
        break;

      case 'DEVELOPER_ANALYZING':
        updateAgent({ ...agent, state: 'WORKING', current_task: payload.description || 'Development work' });
        break;

      case 'DEVELOPER_ANALYSIS_COMPLETE':
        updateAgent({ ...agent, state: 'COMPLETED', current_task: undefined });
        setTimeout(() => updateAgent({ ...agent, state: 'IDLE' }), 2000);
        break;

      case 'DEVELOPER_ERROR':
        updateAgent({ ...agent, state: 'ERROR', current_task: undefined });
        setTimeout(() => updateAgent({ ...agent, state: 'IDLE' }), 3000);
        break;

      case 'HEARTBEAT':
        // Update last heartbeat
        setConnection({
          connected: true,
          last_heartbeat: new Date().toISOString(),
        });
        break;
    }
  };

  return {
    isConnected: wsService.isConnected(),
  };
}
