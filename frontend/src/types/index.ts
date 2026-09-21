/**
 * TypeScript types for Office Agents Simulator frontend
 */

export type AgentRole = 'ceo' | 'designer' | 'developer';

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
  client_id?: string;
  connected_at?: string;
  last_heartbeat?: string;
}

// WebSocket event types
export type WSEventType =
  | 'CONNECTION_ESTABLISHED'
  | 'HEARTBEAT'
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

// Store state
export interface AppState {
  // Connection
  connection: ConnectionInfo;

  // Agents
  agents: Record<string, Agent>;

  // Tasks
  tasks: Task[];

  // Events log
  events: WSEvent[];

  // Current proposal
  currentProposal: string;

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
