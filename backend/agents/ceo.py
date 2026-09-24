"""
CEO Agent - Project evaluation, planning, and task delegation.
Refactored to use Pydantic schemas for structured JSON output.
"""

import json
import uuid
import asyncio
from pathlib import Path
from typing import Optional
from datetime import datetime

import structlog

from agents.base import BaseAgent, AgentState
from agents.llm_provider import LLMProvider
from agents.ceo_schemas import (
    CEOOutput,
    ProposalEvaluation,
    Requirement,
    DesignTask as CEODesignTask,
    DevelopmentTask as CEODevelopmentTask,
    Risk
)
from schemas import Task, TaskResult

logger = structlog.get_logger(__name__)


class CEOAgent(BaseAgent):
    """
    CEO Agent - The primary orchestrator of the Office Agents Simulator.

    Responsibilities:
    - Evaluate project proposals from users
    - Estimate timelines and complexity
    - Break down projects into concrete tasks
    - Delegate tasks to Designer and Developer agents
    - Track overall project progress

    Uses structured JSON output with Pydantic validation for robust parsing.
    """

    def __init__(
        self,
        agent_id: str = "ceo_001",
        llm_provider: Optional[LLMProvider] = None,
        websocket_manager=None
    ):
        super().__init__(agent_id=agent_id, role="ceo", websocket_manager=websocket_manager)
        self.llm_provider = llm_provider
        self.system_prompt = self._load_system_prompt()
        self.logger = logger.bind(agent_id=agent_id, role="ceo")

        # CEO-specific state
        self.current_proposal: Optional[CEOOutput] = None
        self.delegated_tasks: list[Task] = []

    def _load_system_prompt(self) -> str:
        """Load the CEO system prompt from file."""
        prompt_path = Path(__file__).parent.parent.parent / "prompts" / "ceo_system_prompt.md"
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            self.logger.error("ceo_system_prompt_not_found", path=str(prompt_path))
            return "You are a CEO agent. Respond with valid JSON following the CEOOutput schema."

    async def process_task(self, task: Task) -> TaskResult:
        """
        Process a task assigned to the CEO.

        Args:
            task: Task object with proposal or planning request

        Returns:
            TaskResult with parsed CEOOutput or error details
        """
        self.logger.info("ceo_processing_task", task_id=task.task_id, task_type=task.task_type)

        try:
            if task.task_type == "evaluation":
                return await self._evaluate_proposal(task)
            elif task.task_type == "planning":
                return await self._create_project_plan(task)
            else:
                return TaskResult(
                    task_id=task.task_id,
                    agent_id=self.agent_id,
                    success=False,
                    output=f"Unsupported task type for CEO: {task.task_type}",
                    error=f"CEO only handles 'evaluation' and 'planning' tasks"
                )

        except Exception as e:
            self.logger.error("ceo_task_failed", task_id=task.task_id, error=str(e))

            await self._broadcast_event("CEO_ERROR", {
                "task_id": task.task_id,
                "error": str(e)
            })

            return TaskResult(
                task_id=task.task_id,
                agent_id=self.agent_id,
                success=False,
                output=f"CEO task failed: {str(e)}",
                error=str(e)
            )

    async def _evaluate_proposal(self, task: Task) -> TaskResult:
        """
        Evaluate a project proposal using LLM with structured JSON output.

        Args:
            task: Task with proposal description

        Returns:
            TaskResult with CEOOutput
        """
        self.logger.info("ceo_evaluating_proposal", proposal=task.description[:100])

        # Broadcast start event
        await self._broadcast_event("CEO_EVALUATING", {
            "task_id": task.task_id,
            "proposal": task.description[:200]
        })

        # Generate structured CEO output
        ceo_output = await self._analyze_proposal(task.description)
        self.current_proposal = ceo_output

        # Broadcast completion
        await self._broadcast_event("CEO_EVALUATION_COMPLETE", {
            "task_id": task.task_id,
            "project_title": ceo_output.project_title,
            "feasibility": ceo_output.evaluation.feasibility,
            "complexity": ceo_output.evaluation.complexity,
            "estimated_timeline": ceo_output.evaluation.estimated_timeline,
            "design_task_count": len(ceo_output.design_tasks),
            "dev_task_count": len(ceo_output.development_tasks)
        })

        # Format output for display
        formatted_output = self._format_ceo_output(ceo_output)

        # Update metrics
        self.metrics.total_tokens += getattr(ceo_output, '_token_count', 0)
        self.metrics.total_cost += getattr(ceo_output, '_cost', 0.0)

        return TaskResult(
            task_id=task.task_id,
            agent_id=self.agent_id,
            success=True,
            output=formatted_output,
            metadata={
                "project_title": ceo_output.project_title,
                "feasibility": ceo_output.evaluation.feasibility,
                "complexity": ceo_output.evaluation.complexity,
                "estimated_timeline": ceo_output.evaluation.estimated_timeline,
                "requirement_count": len(ceo_output.requirements),
                "design_task_count": len(ceo_output.design_tasks),
                "dev_task_count": len(ceo_output.development_tasks),
                "risk_count": len(ceo_output.risks),
                "raw_output": ceo_output.model_dump()
            }
        )

    async def _analyze_proposal(self, proposal_text: str) -> CEOOutput:
        """
        Analyze project proposal using LLM with structured JSON output.

        Args:
            proposal_text: User's project proposal

        Returns:
            Validated CEOOutput object

        Raises:
            ValueError: If LLM response is invalid JSON or doesn't match schema
        """
        if not self.llm_provider:
            raise ValueError("LLM provider not configured")

        self.logger.info("calling_llm_for_proposal_analysis")

        # Construct user prompt
        user_prompt = f"""Analyze this project proposal and provide a comprehensive evaluation:

Proposal: {proposal_text}

Respond with valid JSON following the CEOOutput schema. Include:
1. Project title (concise, descriptive)
2. Evaluation (feasibility, complexity, timeline, confidence)
3. Requirements (with IDs, descriptions, priorities, categories)
4. Design tasks (with task IDs, titles, descriptions, estimated hours, priorities, dependencies)
5. Development tasks (with task IDs, titles, descriptions, estimated hours, priorities, dependencies, tech stack)
6. Risks (with IDs, descriptions, severity, mitigation strategies)
7. Next steps (ordered list of immediate actions)
8. Notes (any additional clarifications)

Use these formats:
- Task IDs: "design_001", "design_002" for design tasks; "dev_001", "dev_002" for development tasks
- Requirement IDs: "req_001", "req_002", etc.
- Risk IDs: "risk_001", "risk_002", etc.

Respond ONLY with valid JSON, no additional text."""

        # Call LLM with retry logic
        response = await self.llm_provider.generate_with_retry(
            prompt=user_prompt,
            system_prompt=self.system_prompt,
            max_tokens=3000,
            temperature=0.7
        )

        response_text = response["content"]
        tokens = response["tokens"]
        cost = response["cost"]
        duration = response["duration"]

        self.logger.info(
            "llm_response_received",
            tokens=tokens,
            cost=cost,
            duration=duration
        )

        # Parse and validate JSON response
        try:
            response_json = json.loads(response_text)
            ceo_output = CEOOutput.model_validate(response_json)

            # Attach metrics for later use
            ceo_output._token_count = tokens
            ceo_output._cost = cost

            self.logger.info(
                "ceo_output_validated",
                project_title=ceo_output.project_title,
                feasibility=ceo_output.evaluation.feasibility,
                task_count=len(ceo_output.design_tasks) + len(ceo_output.development_tasks)
            )

            return ceo_output

        except json.JSONDecodeError as e:
            self.logger.error("invalid_json_response", error=str(e), response=response_text[:200])
            raise ValueError(f"LLM returned invalid JSON: {str(e)}")

        except Exception as e:
            self.logger.error("schema_validation_failed", error=str(e))
            raise ValueError(f"Response doesn't match CEOOutput schema: {str(e)}")

    async def _create_project_plan(self, task: Task) -> TaskResult:
        """
        Create a detailed project plan with task delegation.

        Args:
            task: Planning task

        Returns:
            TaskResult with task breakdown
        """
        self.logger.info("ceo_creating_plan")

        if not self.current_proposal:
            return TaskResult(
                task_id=task.task_id,
                agent_id=self.agent_id,
                success=False,
                output="No proposal available for planning. Run evaluation first.",
                error="Missing proposal data"
            )

        # Generate Task objects from CEO output
        design_tasks = self._generate_design_tasks()
        dev_tasks = self._generate_dev_tasks()

        all_tasks = design_tasks + dev_tasks
        self.delegated_tasks = all_tasks

        # Broadcast plan created
        await self._broadcast_event("CEO_PLAN_CREATED", {
            "task_id": task.task_id,
            "total_tasks": len(all_tasks),
            "design_tasks": len(design_tasks),
            "dev_tasks": len(dev_tasks),
            "tasks": [
                {
                    "task_id": t.task_id,
                    "description": t.description,
                    "task_type": t.task_type,
                    "assigned_to": t.assigned_to
                }
                for t in all_tasks
            ]
        })

        plan_summary = self._format_plan_summary(design_tasks, dev_tasks)

        return TaskResult(
            task_id=task.task_id,
            agent_id=self.agent_id,
            success=True,
            output=plan_summary,
            metadata={
                "tasks": [
                    {
                        "task_id": t.task_id,
                        "description": t.description,
                        "task_type": t.task_type
                    }
                    for t in all_tasks
                ],
                "design_count": len(design_tasks),
                "dev_count": len(dev_tasks)
            }
        )

    def _generate_design_tasks(self) -> list[Task]:
        """Generate Task objects for designer from current proposal."""
        tasks = []

        if not self.current_proposal:
            return tasks

        for ceo_task in self.current_proposal.design_tasks:
            task = Task(
                task_id=ceo_task.task_id,
                description=f"{ceo_task.title}: {ceo_task.description}",
                task_type="design",
                priority={"high": 1, "medium": 2, "low": 3}.get(ceo_task.priority, 2),
                assigned_to="designer_001",
                status="queued",
                created_at=datetime.utcnow()
            )
            tasks.append(task)

        return tasks

    def _generate_dev_tasks(self) -> list[Task]:
        """Generate Task objects for developer from current proposal."""
        tasks = []

        if not self.current_proposal:
            return tasks

        for ceo_task in self.current_proposal.development_tasks:
            task = Task(
                task_id=ceo_task.task_id,
                description=f"{ceo_task.title}: {ceo_task.description}",
                task_type="development",
                priority={"high": 1, "medium": 2, "low": 3}.get(ceo_task.priority, 2),
                assigned_to="developer_001",
                status="queued",
                created_at=datetime.utcnow()
            )
            tasks.append(task)

        return tasks

    def _format_ceo_output(self, output: CEOOutput) -> str:
        """
        Format CEOOutput into human-readable text.

        Args:
            output: Validated CEOOutput object

        Returns:
            Formatted string for display
        """
        lines = []

        # Header
        lines.append("=" * 60)
        lines.append("PROJECT EVALUATION")
        lines.append("=" * 60)
        lines.append("")

        # Project Title
        lines.append(f"Project: {output.project_title}")
        lines.append("")

        # Evaluation
        eval = output.evaluation
        lines.append(f"Feasibility: {eval.feasibility}")
        lines.append(f"Complexity: {eval.complexity}")
        lines.append(f"Timeline: {eval.estimated_timeline}")
        lines.append(f"Confidence: {eval.confidence.upper()}")
        lines.append("")

        # Requirements
        lines.append("-" * 60)
        lines.append(f"REQUIREMENTS ({len(output.requirements)})")
        lines.append("-" * 60)
        for req in output.requirements:
            lines.append(f"[{req.priority.upper()}] {req.id}: {req.description}")
            lines.append(f"  Category: {req.category}")
        lines.append("")

        # Design Tasks
        lines.append("-" * 60)
        lines.append(f"DESIGN TASKS ({len(output.design_tasks)})")
        lines.append("-" * 60)
        for task in output.design_tasks:
            lines.append(f"[{task.priority.upper()}] {task.task_id}: {task.title}")
            lines.append(f"  {task.description}")
            lines.append(f"  Estimated: {task.estimated_hours}h")
            if task.dependencies:
                lines.append(f"  Depends on: {', '.join(task.dependencies)}")
        lines.append("")

        # Development Tasks
        lines.append("-" * 60)
        lines.append(f"DEVELOPMENT TASKS ({len(output.development_tasks)})")
        lines.append("-" * 60)
        for task in output.development_tasks:
            lines.append(f"[{task.priority.upper()}] {task.task_id}: {task.title}")
            lines.append(f"  {task.description}")
            lines.append(f"  Estimated: {task.estimated_hours}h")
            if task.technical_stack:
                lines.append(f"  Stack: {', '.join(task.technical_stack)}")
            if task.dependencies:
                lines.append(f"  Depends on: {', '.join(task.dependencies)}")
        lines.append("")

        # Risks
        if output.risks:
            lines.append("-" * 60)
            lines.append(f"RISKS & DEPENDENCIES ({len(output.risks)})")
            lines.append("-" * 60)
            for risk in output.risks:
                lines.append(f"[{risk.severity.upper()}] {risk.id}: {risk.description}")
                if risk.mitigation:
                    lines.append(f"  Mitigation: {risk.mitigation}")
            lines.append("")

        # Next Steps
        lines.append("-" * 60)
        lines.append("NEXT STEPS")
        lines.append("-" * 60)
        for i, step in enumerate(output.next_steps, 1):
            lines.append(f"{i}. {step}")
        lines.append("")

        # Notes
        if output.notes:
            lines.append("-" * 60)
            lines.append("NOTES")
            lines.append("-" * 60)
            lines.append(output.notes)
            lines.append("")

        lines.append("=" * 60)

        return "\n".join(lines)

    def _format_plan_summary(self, design_tasks: list[Task], dev_tasks: list[Task]) -> str:
        """Format plan summary for display."""
        lines = []

        lines.append("=" * 60)
        lines.append("PROJECT PLAN")
        lines.append("=" * 60)
        lines.append("")

        if self.current_proposal:
            lines.append(f"Project: {self.current_proposal.project_title}")
            lines.append("")

        lines.append(f"Total Tasks: {len(design_tasks) + len(dev_tasks)}")
        lines.append(f"  Design Tasks: {len(design_tasks)}")
        lines.append(f"  Development Tasks: {len(dev_tasks)}")
        lines.append("")

        if design_tasks:
            lines.append("-" * 60)
            lines.append("DESIGN TASKS")
            lines.append("-" * 60)
            for i, task in enumerate(design_tasks, 1):
                lines.append(f"{i}. [{task.task_id}] {task.description}")
            lines.append("")

        if dev_tasks:
            lines.append("-" * 60)
            lines.append("DEVELOPMENT TASKS")
            lines.append("-" * 60)
            for i, task in enumerate(dev_tasks, 1):
                lines.append(f"{i}. [{task.task_id}] {task.description}")
            lines.append("")

        lines.append("=" * 60)
        lines.append("Ready to delegate tasks to team members")
        lines.append("=" * 60)

        return "\n".join(lines)


    async def evaluate_user_proposal(self, proposal_text: str) -> CEOOutput:
        """
        High-level method to evaluate a user's proposal.

        Args:
            proposal_text: User's project proposal

        Returns:
            CEOOutput with complete evaluation

        Raises:
            Exception: If evaluation fails
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
            return result.metadata.get("raw_output")
        else:
            raise Exception(f"Evaluation failed: {result.error}")
