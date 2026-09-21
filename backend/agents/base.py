"""Base agent architecture for Office Agents Simulator."""
from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
import uuid

import structlog
from pydantic import BaseModel, Field

from schemas import WSEvent, Task, Message


logger = structlog.get_logger()


class AgentState(str, Enum):
    """Agent state enumeration."""
    IDLE = "IDLE"
    THINKING = "THINKING"
    WORKING = "WORKING"
    WAITING = "WAITING"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"


class TaskResult(BaseModel):
    """Result of a task execution."""
    task_id: str
    success: bool
    output: str
    duration: float = Field(..., description="Execution time in seconds")
    artifacts: Dict[str, Any] = Field(default_factory=dict, description="Additional output data")
    error: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AgentMetrics(BaseModel):
    """Agent performance metrics."""
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    total_tokens: int = 0
    total_cost: float = 0.0
    average_duration: float = 0.0


class BaseAgent(ABC):
    """
    Abstract base class for all agents in the Office Agents Simulator.

    All specialized agents (CEO, Designer, Developer) inherit from this class.
    """

    def __init__(
        self,
        agent_id: Optional[str] = None,
        role: str = "agent",
        websocket_manager=None
    ):
        """
        Initialize base agent.

        Args:
            agent_id: Unique identifier for the agent
            role: Agent role (ceo, designer, developer)
            websocket_manager: Reference to WebSocket manager for broadcasting
        """
        self.agent_id = agent_id or str(uuid.uuid4())
        self.role = role
        self.state = AgentState.IDLE
        self.current_task: Optional[Task] = None
        self.websocket_manager = websocket_manager
        self.metrics = AgentMetrics()
        self.metadata: Dict[str, Any] = {}
        self.message_history: list[Message] = []

        self.logger = logger.bind(agent_id=self.agent_id, role=self.role)
        self.logger.info("agent_initialized", state=self.state.value)

    @abstractmethod
    async def process_task(self, task: Task) -> TaskResult:
        """
        Process a task assigned to this agent.

        Args:
            task: Task to process

        Returns:
            TaskResult with execution details

        This method must be implemented by all concrete agent classes.
        """
        pass

    async def _change_state(self, new_state: AgentState, metadata: Optional[Dict[str, Any]] = None):
        """
        Change agent state and broadcast the change.

        Args:
            new_state: New state to transition to
            metadata: Additional state metadata
        """
        old_state = self.state
        self.state = new_state

        self.logger.info(
            "state_changed",
            old_state=old_state.value,
            new_state=new_state.value
        )

        # Broadcast state change via WebSocket
        if self.websocket_manager:
            event = WSEvent(
                event_type=f"AGENT_STATE_CHANGED",
                agent_id=self.agent_id,
                timestamp=datetime.utcnow(),
                payload={
                    "role": self.role,
                    "old_state": old_state.value,
                    "new_state": new_state.value,
                    "current_task": self.current_task.task_id if self.current_task else None,
                    "metadata": metadata or {}
                }
            )
            await self.websocket_manager.broadcast(event)

    async def assign_task(self, task: Task) -> TaskResult:
        """
        Assign and execute a task.

        Args:
            task: Task to execute

        Returns:
            TaskResult with execution details
        """
        self.current_task = task
        self.metrics.total_tasks += 1

        self.logger.info("task_assigned", task_id=task.task_id, description=task.description)

        try:
            # Change to THINKING state
            await self._change_state(
                AgentState.THINKING,
                {"task_id": task.task_id, "task_type": task.task_type}
            )

            # Execute the task (implemented by subclass)
            start_time = datetime.utcnow()
            result = await self.process_task(task)
            duration = (datetime.utcnow() - start_time).total_seconds()
            result.duration = duration

            # Update metrics
            if result.success:
                self.metrics.completed_tasks += 1
                await self._change_state(AgentState.COMPLETED, {"task_id": task.task_id})
            else:
                self.metrics.failed_tasks += 1
                await self._change_state(AgentState.ERROR, {"task_id": task.task_id, "error": result.error})

            # Update average duration
            self.metrics.average_duration = (
                (self.metrics.average_duration * (self.metrics.total_tasks - 1) + duration)
                / self.metrics.total_tasks
            )

            # Broadcast task completion
            if self.websocket_manager:
                event = WSEvent(
                    event_type="TASK_COMPLETED" if result.success else "TASK_FAILED",
                    agent_id=self.agent_id,
                    timestamp=datetime.utcnow(),
                    payload={
                        "task_id": task.task_id,
                        "role": self.role,
                        "success": result.success,
                        "output": result.output,
                        "duration": duration,
                        "error": result.error
                    }
                )
                await self.websocket_manager.broadcast(event)

            # Return to IDLE
            self.current_task = None
            await self._change_state(AgentState.IDLE)

            return result

        except Exception as e:
            self.logger.error("task_execution_error", task_id=task.task_id, error=str(e))
            self.metrics.failed_tasks += 1

            result = TaskResult(
                task_id=task.task_id,
                success=False,
                output="",
                duration=0.0,
                error=str(e)
            )

            await self._change_state(AgentState.ERROR, {"task_id": task.task_id, "error": str(e)})
            self.current_task = None

            return result

    async def send_message(self, message: Message):
        """
        Send a message to another agent.

        Args:
            message: Message to send
        """
        self.message_history.append(message)
        self.logger.info(
            "message_sent",
            message_id=message.message_id,
            receiver=message.receiver
        )

        # Broadcast message via WebSocket
        if self.websocket_manager:
            event = WSEvent(
                event_type="AGENT_MESSAGE",
                agent_id=self.agent_id,
                timestamp=datetime.utcnow(),
                payload={
                    "message_id": message.message_id,
                    "sender": message.sender,
                    "receiver": message.receiver,
                    "content": message.content
                }
            )
            await self.websocket_manager.broadcast(event)

    async def receive_message(self, message: Message):
        """
        Receive a message from another agent.

        Args:
            message: Message received
        """
        self.message_history.append(message)
        self.logger.info(
            "message_received",
            message_id=message.message_id,
            sender=message.sender
        )

    def get_status(self) -> Dict[str, Any]:
        """
        Get current agent status.

        Returns:
            Dictionary with agent status information
        """
        return {
            "agent_id": self.agent_id,
            "role": self.role,
            "state": self.state.value,
            "current_task": self.current_task.model_dump() if self.current_task else None,
            "metrics": self.metrics.model_dump(),
            "metadata": self.metadata,
            "message_count": len(self.message_history)
        }

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} id={self.agent_id} role={self.role} state={self.state.value}>"
