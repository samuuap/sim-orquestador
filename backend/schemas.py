"""Pydantic schemas for WebSocket events and agent communication."""
from datetime import datetime
from typing import Any, Optional, Literal
from pydantic import BaseModel, Field


class WSEvent(BaseModel):
    """Base WebSocket event schema."""
    event_type: str = Field(..., description="Type of event (e.g., CEO_EVALUATING, TASK_COMPLETED)")
    agent_id: Optional[str] = Field(None, description="ID of the agent emitting the event")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")
    payload: dict[str, Any] = Field(default_factory=dict, description="Event-specific data")

    class Config:
        json_schema_extra = {
            "example": {
                "event_type": "CEO_EVALUATING",
                "agent_id": "ceo_001",
                "timestamp": "2024-01-15T10:30:00Z",
                "payload": {"proposal": "Build user authentication"}
            }
        }


class AgentStatus(BaseModel):
    """Agent status information."""
    agent_id: str
    role: Literal["ceo", "designer", "developer"]
    state: Literal["IDLE", "THINKING", "WORKING", "WAITING", "COMPLETED"]
    current_task: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Task(BaseModel):
    """Task model for agent assignments."""
    task_id: str
    description: str
    task_type: Literal[
        "design", "development", "evaluation", "planning", "pm_planning", "pm_standup"
    ]
    priority: int = Field(default=1, ge=1, le=5, description="Priority level (1=highest, 5=lowest)")
    assigned_to: Optional[str] = None
    status: Literal["queued", "in_progress", "completed", "failed"] = "queued"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class Message(BaseModel):
    """Inter-agent or user-agent message."""
    message_id: str
    sender: str
    receiver: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TaskResult(BaseModel):
    """Result of a completed task."""
    task_id: str
    agent_id: str
    success: bool
    output: str = Field(description="Task output or result description")
    error: Optional[str] = Field(None, description="Error message if task failed")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional result metadata")
    duration: float = Field(default=0.0, description="Task execution time in seconds")
    completed_at: datetime = Field(default_factory=datetime.utcnow)


class ConnectionInfo(BaseModel):
    """WebSocket connection information."""
    client_id: str
    connected_at: datetime
    last_heartbeat: datetime
