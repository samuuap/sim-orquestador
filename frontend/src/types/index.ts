/**
 * TypeScript types for Office Agents Simulator frontend
 */

export type AgentRole = 'ceo' | 'project_manager' | 'designer' | 'developer';

export type AgentState = 'IDLE' | 'THINKING' | 'WORKING' | 'WAITING' | 'COMPLETED' | 'ERROR';

export type TaskType = 'design' | 'development' | 'evaluation' | 'planning';

export type TaskStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

export interface Agent {
  agent_id: string;
  role: AgentRole;
  state: AgentState;
  current_task?: string;
  position: [number, number, number]; // 3D position
  rotation: number; // Y-axis rotation
  tasks_completed?: number;
  total_tokens_used?: number;
  total_cost?: number;
  avg_response_time?: number;
}

export interface Task {
  task_id: string;
  description: string;
  task_type: TaskType;
  priority: number;
  assigned_to?: string;
  status: TaskStatus;
  created_at: string;
  completed_at?: string;
}

export interface WSEvent {
  event_type: string;
  agent_id?: string;
  timestamp: string;
  // Event payloads are free-form JSON whose shape depends on event_type;
  // consumers narrow the fields they need.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
}

export interface AgentMetrics {
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  total_tokens: number;
  total_cost: number;
  average_duration: number;
}

export interface ConnectionInfo {
  connected: boolean;
  error?: string | null;
  reconnectAttempts?: number;
  client_id?: string;
  connected_at?: string;
  last_heartbeat?: string;
}

// WebSocket event types
export type WSEventType =
  | 'CONNECTION_ESTABLISHED'
  | 'HEARTBEAT'
  | 'PONG'
  | 'SYSTEM_MESSAGE'
  | 'AGENT_STATE_CHANGED'
  | 'AGENT_MESSAGE'
  | 'PROPOSAL_RECEIVED'
  | 'ORCHESTRATION_STARTED'
  | 'ORCHESTRATION_COMPLETE'
  | 'ORCHESTRATION_FAILED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'CEO_EVALUATING'
  | 'CEO_EVALUATION_COMPLETE'
  | 'CEO_PLAN_CREATED'
  | 'CEO_ERROR'
  | 'DESIGNER_ANALYZING'
  | 'DESIGNER_ANALYSIS_COMPLETE'
  | 'DESIGNER_ERROR'
  | 'DEVELOPER_ANALYZING'
  | 'DEVELOPER_ANALYSIS_COMPLETE'
  | 'DEVELOPER_ERROR';

/** Cumulative per-agent counters sent by the backend on TASK_COMPLETED. */
export interface BackendAgentMetrics {
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  total_tokens: number;
  total_cost: number;
  average_duration: number;
}

// Store state
export interface ActiveMeeting {
  /** Room id, matching ROOMS in behavior/officeMap. */
  room: string;
  /** Agent ids attending, in the order the backend listed them. */
  participants: string[];
  topic: string;
}

/** One spoken line, pushed by the orchestrator while a meeting is running. */
export interface ActiveDialogue {
  speaker: string;
  text: string;
  seconds: number;
  /** Monotonic counter so a repeated line still registers as new. */
  id: number;
}

export interface AppState {
  // Connection
  connectionInfo: ConnectionInfo;

  // Agents
  agents: Record<string, Agent>;

  // Tasks
  tasks: Task[];

  // Events log
  events: WSEvent[];

  // Current proposal
  currentProposal: string;

  // True while the backend is orchestrating a proposal
  isProcessing: boolean;

  // Set while the backend has agents gathered in a room. Drives the meeting choreography:
  // participants abandon whatever they were doing and walk to their seat.
  activeMeeting: ActiveMeeting | null;

  // The line currently being spoken in that meeting, if any.
  activeDialogue: ActiveDialogue | null;

  // UI state
  selectedAgent?: string;
  showMetrics: boolean;
  showEventLog: boolean;
}

// API Response types
export interface HealthResponse {
  status: string;
  timestamp: string;
  active_connections: number;
}

export interface ConnectionsResponse {
  active_connections: number;
  clients: Array<{
    client_id: string;
    connected_at: string;
    last_heartbeat: string;
  }>;
}
