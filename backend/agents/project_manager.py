"""
Project Manager Agent.

Sits between the CEO and the delivery team. Takes the CEO's evaluation and first-pass task
breakdown, challenges it, sequences it, assigns owners, and briefs the team.

Follows the same contract as the other agents: JSON-only LLM output validated by Pydantic, state
broadcast over WebSocket, structured logging.
"""

import json
from pathlib import Path
from typing import Optional

import structlog

from agents.base import AgentState, BaseAgent
from agents.llm_provider import LLMProvider
from agents.pm_schemas import PMOutput
from schemas import Task, TaskResult

logger = structlog.get_logger(__name__)


class ProjectManagerAgent(BaseAgent):
    """
    Project Manager that turns an executive brief into an executable plan.

    Handles two task types:
      - "pm_planning"  : refine the CEO's breakdown into owned, sequenced tasks
      - "pm_standup"   : brief the designer and developer on that plan
    """

    def __init__(
        self,
        agent_id: str = "pm_001",
        llm_provider: Optional[LLMProvider] = None,
        websocket_manager=None,
    ):
        super().__init__(agent_id=agent_id, role="project_manager", websocket_manager=websocket_manager)
        self.llm_provider = llm_provider
        self.system_prompt = self._load_system_prompt()
        self.logger = logger.bind(agent_id=agent_id, role="project_manager")
        # Populated by a planning pass so the orchestrator can dispatch the work.
        self.plan: Optional[PMOutput] = None

    def _load_system_prompt(self) -> str:
        """Load the project manager system prompt from file."""
        prompt_path = Path(__file__).parent.parent.parent / "prompts" / "pm_system_prompt.md"
        try:
            with open(prompt_path, "r", encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            self.logger.error("pm_system_prompt_not_found", path=str(prompt_path))
            return "You are a project manager. Respond with valid JSON following the PMOutput schema."

    async def process_task(self, task: Task) -> TaskResult:
        """Refine a brief into a plan, or deliver the standup for an existing plan."""
        if task.task_type == "pm_standup":
            return await self._run_standup(task)
        return await self._run_planning(task)

    # ------------------------------------------------------------------ planning

    async def _run_planning(self, task: Task) -> TaskResult:
        self.logger.info("processing_pm_planning", task_id=task.task_id)

        try:
            await self._broadcast_event("PM_REVIEWING_BRIEF", {
                "task_id": task.task_id,
                "brief": task.description[:200],
            })

            # Real work begins here, so the avatar should show working rather than thinking.
            await self._change_state(AgentState.WORKING, {"task_id": task.task_id})
            plan = await self._build_plan(task.description)
            self.plan = plan

            await self._broadcast_event("PM_PLAN_READY", {
                "task_id": task.task_id,
                "total_tasks": len(plan.tasks),
                "design_tasks": len(plan.design_tasks),
                "dev_tasks": len(plan.development_tasks),
                "phases": len(plan.phases),
                "adjustments": len(plan.brief_adjustments),
                "risks": len(plan.risks),
                "questions": plan.questions_for_ceo,
            })

            self.metrics.total_tokens += getattr(plan, "_token_count", 0)
            self.metrics.total_cost += getattr(plan, "_cost", 0.0)

            return TaskResult(
                task_id=task.task_id,
                agent_id=self.agent_id,
                success=True,
                output=self._format_plan(plan),
                metadata={
                    "total_tasks": len(plan.tasks),
                    "design_tasks": len(plan.design_tasks),
                    "development_tasks": len(plan.development_tasks),
                    "phase_count": len(plan.phases),
                    "risk_count": len(plan.risks),
                    "raw_output": plan.model_dump(),
                },
            )

        except Exception as e:
            self.logger.error("pm_planning_failed", task_id=task.task_id, error=str(e))
            await self._broadcast_event("PM_ERROR", {"task_id": task.task_id, "error": str(e)})
            return TaskResult(
                task_id=task.task_id,
                agent_id=self.agent_id,
                success=False,
                output=f"Planning failed: {str(e)}",
                error=str(e),
            )

    # ------------------------------------------------------------------ standup

    async def _run_standup(self, task: Task) -> TaskResult:
        """
        Deliver the standup brief to the team.

        No LLM call: the brief was already produced during planning. Calling the model again would
        cost tokens to restate something we already hold, and risk it contradicting the plan.
        """
        self.logger.info("processing_pm_standup", task_id=task.task_id)

        if self.plan is None:
            error = "No plan available; planning must run before the standup"
            await self._broadcast_event("PM_ERROR", {"task_id": task.task_id, "error": error})
            return TaskResult(
                task_id=task.task_id,
                agent_id=self.agent_id,
                success=False,
                output=error,
                error=error,
            )

        plan = self.plan
        await self._change_state(AgentState.WORKING, {"task_id": task.task_id})
        await self._broadcast_event("PM_BRIEFING_TEAM", {
            "task_id": task.task_id,
            "brief": plan.standup_brief,
            "design_tasks": len(plan.design_tasks),
            "dev_tasks": len(plan.development_tasks),
        })

        lines = [
            "=" * 60,
            "STANDUP BRIEF",
            "=" * 60,
            "",
            plan.standup_brief,
            "",
            f"Designer picks up {len(plan.design_tasks)} task(s):",
        ]
        lines += [f"  [{t.priority}] {t.task_id}: {t.description}" for t in plan.design_tasks]
        lines += ["", f"Developer picks up {len(plan.development_tasks)} task(s):"]
        lines += [f"  [{t.priority}] {t.task_id}: {t.description}" for t in plan.development_tasks]

        return TaskResult(
            task_id=task.task_id,
            agent_id=self.agent_id,
            success=True,
            output="\n".join(lines),
            metadata={"standup_brief": plan.standup_brief},
        )

    # ------------------------------------------------------------------ llm

    async def _build_plan(self, brief: str) -> PMOutput:
        """Turn the CEO's brief into a validated PMOutput."""
        if not self.llm_provider:
            raise ValueError("LLM provider not configured")

        user_prompt = f"""The CEO has evaluated a proposal and produced a first-pass breakdown.

{brief}

Produce your delivery plan. Challenge anything that will not survive contact with the team,
sequence the work into phases, assign every task to exactly one of designer or developer, and
write the standup brief you will give them.

Respond ONLY with valid JSON following the PMOutput schema."""

        response = await self.llm_provider.generate_with_retry(
            prompt=user_prompt,
            system_prompt=self.system_prompt,
            max_tokens=2000,
            temperature=0.6,
        )

        try:
            plan = PMOutput.model_validate(json.loads(response["content"]))
        except json.JSONDecodeError as e:
            self.logger.error("invalid_json_response", error=str(e), response=response["content"][:200])
            raise ValueError(f"LLM returned invalid JSON: {str(e)}")
        except Exception as e:
            self.logger.error("schema_validation_failed", error=str(e))
            raise ValueError(f"Response doesn't match PMOutput schema: {str(e)}")

        plan._token_count = response["tokens"]
        plan._cost = response["cost"]
        self.logger.info("pm_plan_validated", tasks=len(plan.tasks), phases=len(plan.phases))
        return plan

    # ------------------------------------------------------------------ formatting

    def _format_plan(self, plan: PMOutput) -> str:
        lines = ["=" * 60, "DELIVERY PLAN", "=" * 60, "", plan.plan_summary, ""]

        if plan.brief_adjustments:
            lines.append("ADJUSTMENTS TO THE CEO BRIEF")
            for adjustment in plan.brief_adjustments:
                lines.append(f"  [{adjustment.kind}] {adjustment.target}")
                lines.append(f"      {adjustment.reason}")
            lines.append("")

        if plan.phases:
            lines.append("PHASES")
            for phase in plan.phases:
                blocked = f" (after phase {phase.blocked_by})" if phase.blocked_by else ""
                lines.append(f"  {phase.phase_number}. {phase.name}{blocked}")
                lines.append(f"      goal: {phase.goal}")
                lines.append(f"      tasks: {', '.join(phase.task_ids) or '-'}")
            lines.append("")

        lines.append("TASKS")
        for task in sorted(plan.tasks, key=lambda t: (t.priority, t.task_id)):
            depends = f" after {', '.join(task.depends_on)}" if task.depends_on else ""
            lines.append(
                f"  [P{task.priority}] {task.task_id} -> {task.assigned_to} "
                f"({task.estimated_hours}h){depends}"
            )
            lines.append(f"      {task.description}")
        lines.append("")

        if plan.risks:
            lines.append("RISKS")
            for risk in plan.risks:
                lines.append(f"  [{risk.likelihood}/{risk.impact}] {risk.description}")
                lines.append(f"      mitigation: {risk.mitigation}")
            lines.append("")

        if plan.questions_for_ceo:
            lines.append("QUESTIONS FOR THE CEO")
            lines += [f"  - {question}" for question in plan.questions_for_ceo]
            lines.append("")

        lines.append("STANDUP BRIEF")
        lines.append(f"  {plan.standup_brief}")
        return "\n".join(lines)
