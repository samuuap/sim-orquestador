/**
 * React hook for WebSocket connection and event handling
 */

import { useEffect, useCallback } from 'react';
import { useAppStore } from '@/store';
import { wsService } from '@/services/websocket';
import type { WSEvent } from '@/types';

export function useWebSocket() {
  const setConnection = useAppStore((state) => state.setConnection);
  const updateAgent = useAppStore((state) => state.updateAgent);
  const addEvent = useAppStore((state) => state.addEvent);
  const agents = useAppStore((state) => state.agents);

  const handleEvent = useCallback((event: WSEvent) => {
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
        // Heartbeat received - connection is healthy
        break;
    }
  }, [agents, updateAgent]);

  useEffect(() => {
    // Connect to WebSocket
    wsService.connect();

    // Handle connection status
    const unsubConnection = wsService.onConnection((connected) => {
      setConnection(connected, null, 0);
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
  }, [setConnection, addEvent, handleEvent]);

  return {
    connect: () => wsService.connect(),
    disconnect: () => wsService.disconnect(),
    isConnected: wsService.isConnected(),
  };
}
