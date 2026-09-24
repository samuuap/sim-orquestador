/**
 * Zustand store for application state management
 */

import { create } from 'zustand';
import type {
  ActiveMeeting, Agent, Task, WSEvent, AppState } from '@/types';

interface AppStore extends AppState {
  // Actions
  setConnection: (connected: boolean, error?: string, reconnectAttempts?: number) => void;
  updateAgent: (agent: Agent) => void;
  patchAgent: (agentId: string, updates: Partial<Agent>) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  addEvent: (event: WSEvent) => void;
  setProposal: (proposal: string) => void;
  setProcessing: (isProcessing: boolean) => void;
  setMeeting: (meeting: ActiveMeeting | null) => void;
  setDialogue: (speaker: string, text: string, seconds: number) => void;
  clearDialogue: () => void;
  selectAgent: (agentId?: string) => void;
  toggleMetrics: () => void;
  toggleEventLog: () => void;
  clearEvents: () => void;
  reset: () => void;
}

const initialState: AppState = {
  connectionInfo: {
    connected: false,
    error: null,
    reconnectAttempts: 0
  },
  agents: {
    ceo_001: {
      agent_id: 'ceo_001',
      role: 'ceo',
      state: 'IDLE',
      position: [-3, 0, 2],
      rotation: 0,
      tasks_completed: 0,
      total_tokens_used: 0,
      total_cost: 0,
      avg_response_time: 0,
    },
    pm_001: {
      agent_id: 'pm_001',
      role: 'project_manager',
      state: 'IDLE',
      position: [3, 0, 2],
      rotation: 0,
      tasks_completed: 0,
      total_tokens_used: 0,
      total_cost: 0,
      avg_response_time: 0,
    },
    designer_001: {
      agent_id: 'designer_001',
      role: 'designer',
      state: 'IDLE',
      position: [-6.5, 0, -1.5],
      rotation: Math.PI / 4,
      tasks_completed: 0,
      total_tokens_used: 0,
      total_cost: 0,
      avg_response_time: 0,
    },
    developer_001: {
      agent_id: 'developer_001',
      role: 'developer',
      state: 'IDLE',
      position: [6.5, 0, -1.5],
      rotation: -Math.PI / 4,
      tasks_completed: 0,
      total_tokens_used: 0,
      total_cost: 0,
      avg_response_time: 0,
    },
  },
  tasks: [],
  events: [],
  currentProposal: '',
  isProcessing: false,
  activeMeeting: null,
  activeDialogue: null,
  selectedAgent: undefined,
  // Right-hand column shows AgentDetailsPanel by default and swaps to the
  // full MetricsPanel when toggled, so the two never overlap.
  showMetrics: false,
  showEventLog: true,
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setConnection: (connected, error, reconnectAttempts = 0) =>
    set((state) => ({
      connectionInfo: {
        ...state.connectionInfo,
        connected,
        error: error || null,
        reconnectAttempts,
      },
    })),

  updateAgent: (agent) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agent.agent_id]: agent,
      },
    })),

  // Merge updates into an existing agent, leaving 3D placement (position,
  // rotation) and any untouched metrics alone. Unknown agents are ignored so a
  // stray event cannot create a half-built avatar.
  patchAgent: (agentId, updates) =>
    set((state) => {
      const current = state.agents[agentId];
      if (!current) return state;

      return {
        agents: {
          ...state.agents,
          [agentId]: { ...current, ...updates },
        },
      };
    }),

  addTask: (task) =>
    set((state) => ({
      tasks: [...state.tasks, task],
    })),

  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.task_id === taskId ? { ...task, ...updates } : task
      ),
    })),

  addEvent: (event) =>
    set((state) => ({
      events: [...state.events, event].slice(-100), // Keep last 100 events
    })),

  setProposal: (proposal) =>
    set({ currentProposal: proposal }),

  setMeeting: (meeting) =>
    // Leaving a meeting also clears whatever was being said in it.
    set(meeting ? { activeMeeting: meeting } : { activeMeeting: null, activeDialogue: null }),

  setDialogue: (speaker, text, seconds) =>
    set((state) => ({
      activeDialogue: {
        speaker,
        text,
        seconds,
        id: (state.activeDialogue?.id ?? 0) + 1,
      },
    })),

  clearDialogue: () => set({ activeDialogue: null }),

  setProcessing: (isProcessing) =>
    set({ isProcessing }),

  selectAgent: (agentId) =>
    set({ selectedAgent: agentId }),

  toggleMetrics: () =>
    set((state) => ({ showMetrics: !state.showMetrics })),

  toggleEventLog: () =>
    set((state) => ({ showEventLog: !state.showEventLog })),

  clearEvents: () =>
    set({ events: [] }),

  reset: () =>
    set(initialState),
}));
