"""CEO Agent - Project evaluation, planning, and task delegation."""
import uuid
import json
import re
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path

import structlog

from agents.base import BaseAgent, TaskResult, AgentState
from agents.llm_provider import llm_provider
from schemas import Task, Message


logger = structlog.get_logger()


class ProjectProposal(dict):
    """Structured project proposal data."""

    def __init__(
        self,
        title: str,
        description: str,
        feasibility: str,
        complexity: str,
        estimated_timeline: str,
        requirements: List[str],
        design_tasks: List[Dict[str, str]],
        development_tasks: List[Dict[str, str]],
        risks: List[str],
        next_steps: List[str]
    ):
        super().__init__(
            title=title,
            description=description,
            feasibility=feasibility,
            complexity=complexity,
            estimated_timeline=estimated_timeline,
            requirements=requirements,
            design_tasks=design_tasks,
            development_tasks=development_tasks,
            risks=risks,
            next_steps=next_steps
        )


class CEOAgent(BaseAgent):
    """
    CEO Agent - The primary orchestrator of the Office Agents Simulator.

    Responsibilities:
    - Evaluate project proposals from users
    - Estimate timelines and complexity
    - Break down projects into concrete tasks
    - Delegate tasks to Designer and Developer agents
    - Track overall project progress
    """

    def __init__(self, websocket_manager=None):
        """Initialize CEO agent."""
        super().__init__(
            agent_id="ceo_001",
            role="ceo",
            websocket_manager=websocket_manager
        )

        # Load system prompt
        prompt_path = Path(__file__).parent.parent.parent / "prompts" / "ceo_system_prompt.md"
        with open(prompt_path, "r", encoding="utf-8") as f:
            self.system_prompt = f.read()

        # CEO-specific state
        self.current_proposal: Optional[ProjectProposal] = None
        self.delegated_tasks: List[Task] = []

        self.logger.info("ceo_agent_initialized", system_prompt_length=len(self.system_prompt))

    async def process_task(self, task: Task) -> TaskResult:
        """
        Process a task assigned to the CEO.

        The CEO primarily handles 'evaluation' and 'planning' tasks.
        """
        self.logger.info("ceo_processing_task", task_type=task.task_type, description=task.description)

        try:
            if task.task_type == "evaluation":
                return await self._evaluate_proposal(task)
            elif task.task_type == "planning":
                return await self._create_project_plan(task)
            else:
                return TaskResult(
                    task_id=task.task_id,
                    success=False,
                    output="",
                    duration=0.0,
                    error=f"Unsupported task type for CEO: {task.task_type}"
                )

        except Exception as e:
            self.logger.error("ceo_task_error", task_id=task.task_id, error=str(e))
            return TaskResult(
                task_id=task.task_id,
                success=False,
                output="",
                duration=0.0,
                error=str(e)
            )

    async def _evaluate_proposal(self, task: Task) -> TaskResult:
        """
        Evaluate a project proposal from the user.

        Uses LLM to analyze feasibility, complexity, and provide structured breakdown.
        """
        self.logger.info("ceo_evaluating_proposal", proposal=task.description[:100])

        # Change state to THINKING
        await self._change_state(
            AgentState.THINKING,
            {"phase": "evaluation", "proposal": task.description[:50]}
        )

        # Broadcast evaluation start
        if self.websocket_manager:
            from schemas import WSEvent
            event = WSEvent(
                event_type="CEO_EVALUATING",
                agent_id=self.agent_id,
                timestamp=datetime.utcnow(),
                payload={
                    "proposal": task.description,
                    "status": "analyzing"
                }
            )
            await self.websocket_manager.broadcast(event)

        # Prepare prompt for LLM
        user_prompt = f"""Evaluate the following project proposal and provide a structured analysis:

**Proposal**: {task.description}

Please provide your evaluation in the standard format defined in your system prompt.
"""

        # Call LLM
        await self._change_state(AgentState.WORKING, {"phase": "llm_call"})

        try:
            response = await llm_provider.generate_with_retry(
                prompt=user_prompt,
                system_prompt=self.system_prompt,
                temperature=0.7,
                max_tokens=2000,
                timeout=60.0
            )

            evaluation_text = response["content"]

            # Update metrics
            self.metrics.total_tokens += response["tokens"]
            self.metrics.total_cost += response["cost"]

            # Parse the evaluation into structured data
            proposal = self._parse_evaluation(task.description, evaluation_text)
            self.current_proposal = proposal

            # Store in task artifacts
            artifacts = {
                "proposal": proposal,
                "raw_evaluation": evaluation_text,
                "tokens_used": response["tokens"],
                "cost": response["cost"]
            }

            # Broadcast evaluation complete
            if self.websocket_manager:
                event = WSEvent(
                    event_type="CEO_EVALUATION_COMPLETE",
                    agent_id=self.agent_id,
                    timestamp=datetime.utcnow(),
                    payload={
                        "proposal": proposal,
                        "evaluation": evaluation_text[:500]  # Truncated for event
                    }
                )
                await self.websocket_manager.broadcast(event)

            self.logger.info(
                "ceo_evaluation_complete",
                feasibility=proposal.get("feasibility"),
                complexity=proposal.get("complexity"),
                timeline=proposal.get("estimated_timeline")
            )

            return TaskResult(
                task_id=task.task_id,
                success=True,
                output=evaluation_text,
                duration=response.get("duration", 0.0),
                artifacts=artifacts
            )

        except Exception as e:
            self.logger.error("ceo_evaluation_failed", error=str(e))
            raise

    async def _create_project_plan(self, task: Task) -> TaskResult:
        """
        Create a detailed project plan with task delegation.

        Generates specific tasks for Designer and Developer agents.
        """
        self.logger.info("ceo_creating_plan")

        await self._change_state(AgentState.THINKING, {"phase": "planning"})

        if not self.current_proposal:
            return TaskResult(
                task_id=task.task_id,
                success=False,
                output="",
                duration=0.0,
                error="No proposal available for planning. Run evaluation first."
            )

        # Generate task assignments
        design_tasks = self._generate_design_tasks()
        dev_tasks = self._generate_dev_tasks()

        all_tasks = design_tasks + dev_tasks
        self.delegated_tasks = all_tasks

        # Broadcast plan created
        if self.websocket_manager:
            from schemas import WSEvent
            event = WSEvent(
                event_type="CEO_PLAN_CREATED",
                agent_id=self.agent_id,
                timestamp=datetime.utcnow(),
                payload={
                    "total_tasks": len(all_tasks),
                    "design_tasks": len(design_tasks),
                    "dev_tasks": len(dev_tasks),
                    "tasks": [t.model_dump() for t in all_tasks]
                }
            )
            await self.websocket_manager.broadcast(event)

        plan_summary = f"""
# Project Plan: {self.current_proposal.get('title', 'Unnamed Project')}

## Tasks Created
- **Design Tasks**: {len(design_tasks)}
- **Development Tasks**: {len(dev_tasks)}
- **Total Tasks**: {len(all_tasks)}

## Task List
{self._format_task_list(all_tasks)}

## Next Steps
Ready to delegate tasks to team members.
"""

        return TaskResult(
            task_id=task.task_id,
            success=True,
            output=plan_summary,
            duration=0.0,
            artifacts={
                "tasks": [t.model_dump() for t in all_tasks],
                "design_count": len(design_tasks),
                "dev_count": len(dev_tasks)
            }
        )

    def _parse_evaluation(self, original_proposal: str, evaluation_text: str) -> ProjectProposal:
        """
        Parse LLM evaluation response into structured data.

        Extracts key information using regex and text parsing.
        """
        # Extract title (first heading or use proposal start)
        title_match = re.search(r'##\s*Proposal Evaluation:\s*(.+)', evaluation_text)
        title = title_match.group(1).strip() if title_match else original_proposal[:50]

        # Extract feasibility
        feasibility_match = re.search(r'\*\*Feasibility\*\*:\s*(.+)', evaluation_text, re.IGNORECASE)
        feasibility = feasibility_match.group(1).strip() if feasibility_match else "NEEDS CLARIFICATION"

        # Extract complexity
        complexity_match = re.search(r'\*\*Complexity\*\*:\s*(.+)', evaluation_text, re.IGNORECASE)
        complexity = complexity_match.group(1).strip() if complexity_match else "MEDIUM"

        # Extract timeline
        timeline_match = re.search(r'\*\*Estimated Timeline\*\*:\s*(.+)', evaluation_text, re.IGNORECASE)
        estimated_timeline = timeline_match.group(1).strip() if timeline_match else "Unknown"

        # Extract requirements
        requirements = self._extract_list_items(evaluation_text, r'\*\*Key Requirements\*\*:')

        # Extract risks
        risks = self._extract_list_items(evaluation_text, r'\*\*Dependencies & Risks\*\*:')

        # Extract next steps
        next_steps = self._extract_list_items(evaluation_text, r'\*\*Next Steps\*\*:')

        # Extract design and dev tasks (simplified - parse from sections)
        design_tasks = self._extract_tasks_from_section(evaluation_text, "Design Phase")
        development_tasks = self._extract_tasks_from_section(evaluation_text, "Development Phase")

        return ProjectProposal(
            title=title,
            description=original_proposal,
            feasibility=feasibility,
            complexity=complexity,
            estimated_timeline=estimated_timeline,
            requirements=requirements,
            design_tasks=design_tasks,
            development_tasks=development_tasks,
            risks=risks,
            next_steps=next_steps
        )

    def _extract_list_items(self, text: str, section_header: str) -> List[str]:
        """Extract list items from a section."""
        items = []

        # Find section
        pattern = f"{section_header}(.+?)(?=\\*\\*|###|##|$)"
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)

        if match:
            section_text = match.group(1)
            # Extract list items (lines starting with - or numbers)
            item_matches = re.findall(r'^\s*[-•]\s*(.+)$', section_text, re.MULTILINE)
            items.extend([item.strip() for item in item_matches])

        return items

    def _extract_tasks_from_section(self, text: str, section_name: str) -> List[Dict[str, str]]:
        """Extract tasks from Design or Development phase sections."""
        tasks = []

        # Find section
        pattern = f"###\\s*{section_name}(.+?)(?=###|##|$)"
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)

        if match:
            section_text = match.group(1)
            # Extract numbered tasks with time estimates
            task_matches = re.findall(r'\d+\.\s*(.+?)\s*-\s*(.+?)(?:\n|$)', section_text)

            for description, estimate in task_matches:
                tasks.append({
                    "description": description.strip(),
                    "estimate": estimate.strip()
                })

        return tasks

    def _generate_design_tasks(self) -> List[Task]:
        """Generate Task objects for designer from current proposal."""
        tasks = []

        if not self.current_proposal:
            return tasks

        design_tasks_data = self.current_proposal.get("design_tasks", [])

        for idx, task_data in enumerate(design_tasks_data):
            task = Task(
                task_id=f"design_{uuid.uuid4().hex[:8]}",
                description=task_data.get("description", "Design task"),
                task_type="design",
                priority=1,
                assigned_to="designer_001",
                status="queued",
                created_at=datetime.utcnow()
            )
            tasks.append(task)

        return tasks

    def _generate_dev_tasks(self) -> List[Task]:
        """Generate Task objects for developer from current proposal."""
        tasks = []

        if not self.current_proposal:
            return tasks

        dev_tasks_data = self.current_proposal.get("development_tasks", [])

        for idx, task_data in enumerate(dev_tasks_data):
            task = Task(
                task_id=f"dev_{uuid.uuid4().hex[:8]}",
                description=task_data.get("description", "Development task"),
                task_type="development",
                priority=2,
                assigned_to="developer_001",
                status="queued",
                created_at=datetime.utcnow()
            )
            tasks.append(task)

        return tasks

    def _format_task_list(self, tasks: List[Task]) -> str:
        """Format task list for output."""
        output = []

        # Group by type
        design_tasks = [t for t in tasks if t.task_type == "design"]
        dev_tasks = [t for t in tasks if t.task_type == "development"]

        if design_tasks:
            output.append("\n### Design Tasks")
            for i, task in enumerate(design_tasks, 1):
                output.append(f"{i}. [{task.task_id}] {task.description}")

        if dev_tasks:
            output.append("\n### Development Tasks")
            for i, task in enumerate(dev_tasks, 1):
                output.append(f"{i}. [{task.task_id}] {task.description}")

        return "\n".join(output)

    async def delegate_task(self, task: Task, target_agent_id: str) -> Message:
        """
        Delegate a task to another agent.

        Creates a message to the target agent with task details.
        """
        message = Message(
            message_id=f"msg_{uuid.uuid4().hex[:8]}",
            sender=self.agent_id,
            receiver=target_agent_id,
            content=f"New task assigned: {task.description}",
            timestamp=datetime.utcnow(),
            metadata={
                "task_id": task.task_id,
                "task_type": task.task_type,
                "priority": task.priority
            }
        )

        await self.send_message(message)

        self.logger.info(
            "ceo_delegated_task",
            task_id=task.task_id,
            target_agent=target_agent_id
        )

        return message

    async def evaluate_user_proposal(self, proposal_text: str) -> ProjectProposal:
        """
        High-level method to evaluate a user's proposal.

        This is a convenience method that can be called directly.
        """
        task = Task(
            task_id=f"eval_{uuid.uuid4().hex[:8]}",
            description=proposal_text,
            task_type="evaluation",
            priority=1,
            assigned_to=self.agent_id,
            status="in_progress",
            created_at=datetime.utcnow()
        )

        result = await self.assign_task(task)

        if result.success:
            return result.artifacts.get("proposal")
        else:
            raise Exception(f"Evaluation failed: {result.error}")
