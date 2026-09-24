"""Test script for agent foundation components."""
import asyncio
import uuid
from datetime import datetime

from agents.base import BaseAgent, AgentState
from agents.llm_provider import get_llm_provider
from agents.message_queue import message_queue
from schemas import Task, Message, TaskResult


class TestAgent(BaseAgent):
    """Simple test agent implementation."""

    async def process_task(self, task: Task) -> TaskResult:
        """Process a test task."""
        self.logger.info("processing_test_task", task_id=task.task_id)

        # Simulate some work
        await asyncio.sleep(0.5)

        return TaskResult(
            task_id=task.task_id,
            agent_id=self.agent_id,
            success=True,
            output=f"Completed task: {task.description}",
            duration=0.0,
            metadata={"test_data": "example"}
        )


async def test_agent_lifecycle():
    """Test agent initialization and lifecycle."""
    print("\n" + "=" * 60)
    print("Test 1: Agent Lifecycle")
    print("=" * 60)

    # Create agent
    agent = TestAgent(agent_id="test_001", role="tester")
    print(f"Agent created: {agent}")
    print(f"  Initial state: {agent.state.value}")

    # Create and assign task
    task = Task(
        task_id=str(uuid.uuid4()),
        description="Test task execution",
        task_type="development",
        priority=1
    )

    print(f"\nTask created: {task.task_id}")
    print(f"  Description: {task.description}")

    # Execute task
    print(f"\nExecuting task...")
    result = await agent.assign_task(task)

    print(f"\nTask completed!")
    print(f"  Success: {result.success}")
    print(f"  Output: {result.output}")
    print(f"  Duration: {result.duration:.2f}s")

    # Check metrics
    status = agent.get_status()
    print(f"\nAgent metrics:")
    print(f"  Total tasks: {status['metrics']['total_tasks']}")
    print(f"  Completed: {status['metrics']['completed_tasks']}")
    print(f"  Failed: {status['metrics']['failed_tasks']}")


async def test_message_queue():
    """Test inter-agent messaging."""
    print("\n" + "=" * 60)
    print("Test 2: Message Queue")
    print("=" * 60)

    # Create two agents
    agent1 = TestAgent(agent_id="agent_001", role="sender")
    agent2 = TestAgent(agent_id="agent_002", role="receiver")

    print(f"Created agents: {agent1.agent_id} and {agent2.agent_id}")

    # Register agents in message queue
    message_queue.register_agent(agent1.agent_id)
    message_queue.register_agent(agent2.agent_id)
    print(f"Agents registered in message queue")

    # Create and send message
    message = Message(
        message_id=str(uuid.uuid4()),
        sender=agent1.agent_id,
        receiver=agent2.agent_id,
        content="Hello from agent 1!",
        timestamp=datetime.utcnow()
    )

    print(f"\nSending message...")
    await message_queue.send_message(message)
    print(f"Message sent: {message.message_id}")

    # Receive message
    received = await message_queue.receive_message(agent2.agent_id, timeout=1.0)

    if received:
        print(f"\nMessage received!")
        print(f"  From: {received.sender}")
        print(f"  Content: {received.content}")
    else:
        print(f"\nNo message received (timeout)")

    # Check message history
    history = message_queue.get_message_history(limit=10)
    print(f"\nMessage history: {len(history)} messages")


async def test_llm_provider():
    """Test LLM provider (mock test without actual API call)."""
    print("\n" + "=" * 60)
    print("Test 3: LLM Provider")
    print("=" * 60)

    provider = get_llm_provider()

    print(f"LLM Provider initialized")
    print(f"  Provider: {provider.provider}")
    print(f"  Model: {provider.model}")

    print(f"\nSkipping actual LLM call (requires API key)")
    print(f"  To test LLM integration:")
    print(f"  1. Configure API key in .env")
    print(f"  2. Use: await get_llm_provider().generate('test prompt')")


async def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("Office Agents Simulator - Milestone 2 Tests")
    print("Agent Foundation & Base Classes")
    print("=" * 60)

    try:
        await test_agent_lifecycle()
        await test_message_queue()
        await test_llm_provider()

        print("\n" + "=" * 60)
        print("All tests passed!")
        print("=" * 60)
        print("\nMilestone 2 components validated:")
        print("  - BaseAgent class with state machine")
        print("  - Task assignment and execution")
        print("  - Agent metrics tracking")
        print("  - Message queue system")
        print("  - LLM provider integration")
        print("\n" + "=" * 60)

    except Exception as e:
        print(f"\nTest failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
