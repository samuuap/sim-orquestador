"""Agent communication and message queue system."""
import asyncio
from typing import Dict, List, Optional
from datetime import datetime
import uuid

import structlog
from pydantic import BaseModel

from schemas import Message


logger = structlog.get_logger()


class MessageQueue:
    """
    Message queue for inter-agent communication.

    Manages message routing and delivery between agents.
    """

    def __init__(self):
        """Initialize message queue."""
        self.queues: Dict[str, asyncio.Queue] = {}
        self.message_history: List[Message] = []
        self.logger = logger.bind(component="message_queue")
        self.logger.info("message_queue_initialized")

    def register_agent(self, agent_id: str):
        """
        Register an agent to receive messages.

        Args:
            agent_id: Unique agent identifier
        """
        if agent_id not in self.queues:
            self.queues[agent_id] = asyncio.Queue()
            self.logger.info("agent_registered", agent_id=agent_id)

    def unregister_agent(self, agent_id: str):
        """
        Unregister an agent from message queue.

        Args:
            agent_id: Unique agent identifier
        """
        if agent_id in self.queues:
            del self.queues[agent_id]
            self.logger.info("agent_unregistered", agent_id=agent_id)

    async def send_message(self, message: Message):
        """
        Send a message to a specific agent.

        Args:
            message: Message to send
        """
        self.message_history.append(message)

        self.logger.info(
            "message_queued",
            message_id=message.message_id,
            sender=message.sender,
            receiver=message.receiver
        )

        # Add to receiver's queue
        if message.receiver in self.queues:
            await self.queues[message.receiver].put(message)
        else:
            self.logger.warning(
                "receiver_not_found",
                message_id=message.message_id,
                receiver=message.receiver
            )

    async def receive_message(self, agent_id: str, timeout: Optional[float] = None) -> Optional[Message]:
        """
        Receive a message for a specific agent.

        Args:
            agent_id: Agent identifier
            timeout: Optional timeout in seconds

        Returns:
            Message or None if timeout
        """
        if agent_id not in self.queues:
            self.logger.warning("agent_not_registered", agent_id=agent_id)
            return None

        try:
            if timeout:
                message = await asyncio.wait_for(
                    self.queues[agent_id].get(),
                    timeout=timeout
                )
            else:
                message = await self.queues[agent_id].get()

            self.logger.info(
                "message_received",
                message_id=message.message_id,
                receiver=agent_id
            )

            return message

        except asyncio.TimeoutError:
            return None

    def get_pending_count(self, agent_id: str) -> int:
        """
        Get number of pending messages for an agent.

        Args:
            agent_id: Agent identifier

        Returns:
            Number of pending messages
        """
        if agent_id in self.queues:
            return self.queues[agent_id].qsize()
        return 0

    def get_message_history(
        self,
        agent_id: Optional[str] = None,
        limit: int = 100
    ) -> List[Message]:
        """
        Get message history.

        Args:
            agent_id: Optional agent ID to filter by
            limit: Maximum number of messages to return

        Returns:
            List of messages
        """
        if agent_id:
            filtered = [
                msg for msg in self.message_history
                if msg.sender == agent_id or msg.receiver == agent_id
            ]
            return filtered[-limit:]
        return self.message_history[-limit:]


# Global message queue instance
message_queue = MessageQueue()
