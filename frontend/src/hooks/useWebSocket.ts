/**
 * React hook for WebSocket connection and event handling
 */

import { useCallback, useEffect } from 'react';
import { useAppStore } from '@/store';
import { wsService } from '@/services/websocket';
import type { AgentState, BackendAgentMetrics, WSEvent } from '@/types';

/** Label shown under an agent while it works on a given event. */
const TASK_LABELS: Record<string, string> = {
  CEO_EVALUATING: 'Evaluating proposal',
  CEO_PLAN_CREATED: 'Plan created',
  PM_REVIEWING_BRIEF: 'Reviewing the brief',
  PM_PLAN_READY: 'Delivery plan ready',
  PM_BRIEFING_TEAM: 'Briefing the team',
  DESIGNER_ANALYZING: 'Design work',
  DEVELOPER_ANALYZING: 'Development work',
};

function applyMetrics(agentId: string, metrics?: BackendAgentMetrics) {
  if (!metrics) return;

  useAppStore.getState().patchAgent(agentId, {
    tasks_completed: metrics.completed_tasks,
    total_tokens_used: metrics.total_tokens,
    total_cost: metrics.total_cost,
    avg_response_time: metrics.average_duration,
  });
}

/**
 * Apply one backend event to the store.
 *
 * Agent state comes exclusively from AGENT_STATE_CHANGED, which the backend
 * emits for every transition. The role-specific events only supply the
 * human-readable task label, so the two never fight over the same field.
 */
function reduceEvent(event: WSEvent) {
  const { event_type, agent_id, payload } = event;
  const store = useAppStore.getState();

  switch (event_type) {
    case 'CONNECTION_ESTABLISHED': {
      // Seed from the server snapshot so a client joining mid-run is accurate.
      const agents = (payload?.agents ?? []) as Array<{
        agent_id: string;
        state: AgentState;
        current_task?: { description?: string } | null;
        metrics?: BackendAgentMetrics;
      }>;

      agents.forEach((agent) => {
        store.patchAgent(agent.agent_id, {
          state: agent.state,
          current_task: agent.current_task?.description,
        });
        applyMetrics(agent.agent_id, agent.metrics);
      });

      store.setProcessing(Boolean(payload?.orchestrator_busy));
      return;
    }

    case 'AGENT_STATE_CHANGED': {
      if (!agent_id) return;
      const nextState = payload?.new_state as AgentState | undefined;
      if (!nextState) return;

      store.patchAgent(agent_id, {
        state: nextState,
        // Leaving a busy state clears the label; entering one keeps whatever
        // the role-specific event set.
        ...(nextState === 'IDLE' || nextState === 'COMPLETED'
          ? { current_task: undefined }
          : {}),
      });
      return;
    }

    case 'TASK_COMPLETED':
    case 'TASK_FAILED': {
      if (!agent_id) return;
      applyMetrics(agent_id, payload?.metrics as BackendAgentMetrics | undefined);
      return;
    }

    case 'PROPOSAL_RECEIVED': {
      store.setProposal(String(payload?.proposal ?? ''));
      store.setProcessing(true);
      return;
    }

    case 'MEETING_STARTED': {
      // Drives the 3D choreography: participants abandon their desks and walk to this room.
      const participants = (payload?.participants as string[] | undefined) ?? [];
      const room = (payload?.room as string | undefined) ?? '';
      if (room && participants.length > 0) {
        store.setMeeting({
          room,
          participants,
          topic: (payload?.topic as string | undefined) ?? '',
        });
        participants.forEach((id) => store.patchAgent(id, { current_task: `In the ${room.replace('_', ' ')}` }));
      }
      return;
    }

    case 'MEETING_DIALOGUE': {
      // The backend owns turn-taking: it plays one line at a time, sourced from the real plan.
      const speaker = payload?.speaker as string | undefined;
      const text = payload?.text as string | undefined;
      if (speaker && text) {
        store.setDialogue(speaker, text, (payload?.seconds as number | undefined) ?? 3);
      }
      return;
    }

    case 'MEETING_ENDED': {
      store.setMeeting(null);
      return;
    }

    case 'ORCHESTRATION_STARTED': {
      store.setProcessing(true);
      return;
    }

    case 'ORCHESTRATION_COMPLETE':
    case 'ORCHESTRATION_FAILED': {
      store.setProcessing(false);
      // Clear any meeting: an orchestration that ends while agents are gathered would otherwise
      // leave them seated indefinitely.
      store.setMeeting(null);
      return;
    }

    case 'HEARTBEAT':
    case 'PONG':
      return;

    default: {
      // Role-specific progress events: set the task label only.
      if (!agent_id) return;

      const label = TASK_LABELS[event_type];
      if (label) {
        store.patchAgent(agent_id, {
          current_task: (payload?.description as string | undefined) ?? label,
        });
      }
    }
  }
}

export function useWebSocket() {
  const setConnection = useAppStore((state) => state.setConnection);
  const addEvent = useAppStore((state) => state.addEvent);

  useEffect(() => {
    wsService.connect();

    const unsubConnection = wsService.onConnection((connected) => {
      setConnection(connected, undefined, 0);
    });

    const unsubEvent = wsService.onEvent((event: WSEvent) => {
      addEvent(event);
      reduceEvent(event);
    });

    return () => {
      unsubConnection();
      unsubEvent();
      wsService.disconnect();
    };
    // Store actions from Zustand are stable, so this runs once per mount.
    // Anything that depended on live agent data would otherwise tear the
    // socket down and reconnect on every state change.
  }, [setConnection, addEvent]);

  const submitProposal = useCallback((proposal: string) => {
    return wsService.submitProposal(proposal);
  }, []);

  return {
    submitProposal,
    connect: () => wsService.connect(),
    disconnect: () => wsService.disconnect(),
  };
}
