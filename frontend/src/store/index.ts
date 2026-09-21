/**
 * Zustand store for application state management
 */

import { create } from 'zustand';
import type { Agent, Task, WSEvent, ConnectionInfo, AppState } from '@/types';

interface AppStore extends AppState {
  // Actions
  setConnection: (connection: ConnectionInfo) => void;
  updateAgent: (agent: Agent) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  addEvent: (event: WSEvent) => void;
  setProposal: (proposal: string) => void;
  selectAgent: (agentId?: string) => void;
  toggleMetrics: () => void;
  toggleEventLog: () => void;
  clearEvents: () => void;
  reset: () => void;
}

const initialState: AppState = {
  connection: { connected: false },
  agents: {
    ceo_001: {
      agent_id: 'ceo_001',
      role: 'ceo',
      state: 'IDLE',
      position: [0, 0, 0],
      rotation: 0,
    },
    designer_001: {
      agent_id: 'designer_001',
      role: 'designer',
      state: 'IDLE',
      position: [-4, 0, -2],
      rotation: Math.PI / 4,
    },
    developer_001: {
      agent_id: 'developer_001',
      role: 'developer',
      state: 'IDLE',
      position: [4, 0, -2],
      rotation: -Math.PI / 4,
    },
  },
  tasks: [],
  events: [],
  currentProposal: '',
  selectedAgent: undefined,
  showMetrics: true,
  showEventLog: true,
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setConnection: (connection) =>
    set({ connection }),

  updateAgent: (agent) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agent.agent_id]: agent,
      },
    })),

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
