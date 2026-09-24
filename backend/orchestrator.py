"""
Agent Orchestrator using LangGraph.

Coordinates workflow between CEO, Designer, and Developer agents.
Manages task dependencies, state transitions, and progress tracking.
"""

import asyncio
import os
from contextlib import asynccontextmanager
from typing import TypedDict, Annotated, Literal, Optional
from datetime import datetime

import structlog
from langgraph.graph import StateGraph, END

from agents.ceo import CEOAgent
from agents.designer import DesignerAgent
from agents.developer import DeveloperAgent
from conversation import Line, briefing_script, script_seconds, standup_script
from schemas import Task, TaskResult, WSEvent


logger = structlog.get_logger(__name__)

# Minimum wall-clock duration of each meeting, in seconds. The mock provider answers in
# milliseconds, so without a floor the characters would appear and vanish in the same frame.
# How long the participants get to walk in and sit down before anyone speaks. The backend cannot
# observe the animation, so this is a fixed allowance for the journey plus sitting.
# Measured, not guessed: the longest desk-to-seat walk in the current floor plan is ~10.3s at the
# summoned pace, plus ~0.8s to sit. frontend `npm run check:flow` asserts this value still covers
# the real geometry, so moving a desk or a room cannot silently start the conversation early.
SETTLE_SECONDS = float(os.getenv("MEETING_SETTLE_SECONDS", "12.5"))
# Beat after the last line, before everyone gets up.
OUTRO_SECONDS = float(os.getenv("MEETING_OUTRO_SECONDS", "2"))


class OrchestratorState(TypedDict):
    """State maintained throughout the orchestration workflow."""
    # User input
    proposal: str

    # CEO outputs
    ceo_evaluation: Optional[TaskResult]
    ceo_plan: Optional[TaskResult]

    # Project Manager outputs
    pm_plan: Optional[TaskResult]
    pm_standup: Optional[TaskResult]

    design_tasks: list[Task]
    development_tasks: list[Task]

    # Designer outputs
    design_results: list[TaskResult]

    # Developer outputs
    dev_results: list[TaskResult]

    # Workflow state
    current_step: str
    errors: list[str]
    completed: bool


class AgentOrchestrator:
    """
    Orchestrates multi-agent workflow using LangGraph.

    Workflow:
    1. User submits proposal
    2. CEO evaluates proposal
    3. CEO creates project plan with tasks
    4. Designer processes design tasks (parallel)
    5. Developer processes dev tasks (parallel, after design if needed)
    6. Return complete results
    """

    def __init__(
        self,
        ceo_agent: CEOAgent,
        designer_agent: DesignerAgent,
        developer_agent: DeveloperAgent,
        websocket_manager=None,
        pm_agent=None,
    ):
        """
        Initialize orchestrator with agents.

        Args:
            ceo_agent: CEO Agent instance
            designer_agent: Designer Agent instance
            developer_agent: Developer Agent instance
            websocket_manager: Optional WebSocket manager used to broadcast
                workflow-level events. Individual agents broadcast their own
                state changes; this covers the run as a whole.
            pm_agent: Optional Project Manager. When present the workflow routes
                through two meetings - a CEO/PM briefing and a team standup - and
                the PM owns the final task breakdown. When absent the original
                three-agent flow runs unchanged, which keeps existing tests valid.
        """
        self.ceo = ceo_agent
        self.designer = designer_agent
        self.developer = developer_agent
        self.pm = pm_agent
        self.websocket_manager = websocket_manager
        self.logger = logger.bind(component="orchestrator")

        # Build workflow graph
        self.workflow = self._build_workflow()

    async def _broadcast(self, event_type: str, payload: dict) -> None:
        """Broadcast a workflow-level event if a WebSocket manager is attached."""
        if not self.websocket_manager:
            return

        await self.websocket_manager.broadcast(
            WSEvent(
                event_type=event_type,
                agent_id=None,
                timestamp=datetime.utcnow(),
                payload=payload
            )
        )

    @asynccontextmanager
    async def _meeting(self, room: str, participants: list[str], topic: str):
        """
        Run a block of work as a visible meeting.

        Broadcasts MEETING_STARTED, runs the body, and broadcasts MEETING_ENDED afterwards. The
        body is expected to do the work and then play a conversation with `_play`, which is what
        gives the meeting its length. Nothing is padded: a meeting lasts exactly as long as the
        walking-in allowance plus the dialogue it actually has.
        """
        started = asyncio.get_event_loop().time()
        await self._broadcast("MEETING_STARTED", {
            "room": room,
            "participants": participants,
            "topic": topic,
            # Published so the client, which owns the floor plan, can verify the allowance is
            # still long enough for everyone to walk in and sit down.
            "settle_seconds": SETTLE_SECONDS,
        })
        self.logger.info("meeting_started", room=room, participants=participants)

        try:
            yield
        finally:
            await asyncio.sleep(OUTRO_SECONDS)
            await self._broadcast("MEETING_ENDED", {"room": room, "participants": participants})
            self.logger.info(
                "meeting_ended",
                room=room,
                total_seconds=round(asyncio.get_event_loop().time() - started, 2),
            )

    async def _play(self, lines: list[Line]) -> None:
        """
        Speak a scripted conversation, one line at a time.

        Each line is broadcast as it starts and held for its own duration, so the client can show
        it as speech and give that agent the floor. Playback is sequential by design: two agents
        talking at once reads as noise rather than a meeting.
        """
        for index, line in enumerate(lines):
            await self._broadcast("MEETING_DIALOGUE", {
                "speaker": line.speaker,
                "text": line.text,
                "seconds": line.seconds,
                "index": index,
                "total": len(lines),
            })
            await asyncio.sleep(line.seconds)

    def _build_workflow(self) -> StateGraph:
        """
        Build LangGraph workflow for agent orchestration.

        Returns:
            Compiled StateGraph workflow
        """
        workflow = StateGraph(OrchestratorState)

        # Add nodes
        workflow.add_node("evaluate_proposal", self._ceo_evaluate_node)
        workflow.add_node("design_work", self._designer_work_node)
        workflow.add_node("development_work", self._developer_work_node)
        workflow.add_node("finalize_results", self._finalize_node)

        if self.pm:
            # CEO planning happens inside the briefing rather than as its own node, so the
            # conversation on screen covers real work. Registering create_plan as well would
            # leave it unreachable and LangGraph rejects the graph.
            workflow.add_node("ceo_pm_briefing", self._ceo_pm_briefing_node)
            workflow.add_node("team_standup", self._team_standup_node)
        else:
            workflow.add_node("create_plan", self._ceo_plan_node)

        # Define edges
        workflow.set_entry_point("evaluate_proposal")

        if self.pm:
            # CEO evaluates alone, then briefs the PM in the office; the PM refines the plan
            # there and afterwards gathers the team in the meeting room.
            workflow.add_edge("evaluate_proposal", "ceo_pm_briefing")
            workflow.add_edge("ceo_pm_briefing", "team_standup")
            workflow.add_edge("team_standup", "design_work")
        else:
            workflow.add_edge("evaluate_proposal", "create_plan")
            workflow.add_edge("create_plan", "design_work")
        workflow.add_edge("design_work", "development_work")
        workflow.add_edge("development_work", "finalize_results")
        workflow.add_edge("finalize_results", END)

        return workflow.compile()

    async def _ceo_evaluate_node(self, state: OrchestratorState) -> OrchestratorState:
        """
        CEO evaluates the proposal.

        Args:
            state: Current orchestrator state

        Returns:
            Updated state with CEO evaluation
        """
        self.logger.info("ceo_evaluate_node_started", proposal=state["proposal"][:100])

        try:
            # Create evaluation task
            eval_task = Task(
                task_id=f"eval_{datetime.utcnow().timestamp()}",
                description=state["proposal"],
                task_type="evaluation",
                priority=1,
                assigned_to=self.ceo.agent_id,
                status="in_progress",
                created_at=datetime.utcnow()
            )

            # Execute evaluation
            result = await self.ceo.assign_task(eval_task)

            state["ceo_evaluation"] = result
            state["current_step"] = "ceo_evaluate"

            if not result.success:
                state["errors"].append(f"CEO evaluation failed: {result.error}")

            self.logger.info("ceo_evaluate_node_completed", success=result.success)

        except Exception as e:
            self.logger.error("ceo_evaluate_node_error", error=str(e))
            state["errors"].append(f"CEO evaluation error: {str(e)}")

        return state

    async def _ceo_plan_node(self, state: OrchestratorState) -> OrchestratorState:
        """
        CEO creates project plan with tasks.

        Args:
            state: Current orchestrator state

        Returns:
            Updated state with project plan and tasks
        """
        self.logger.info("ceo_plan_node_started")

        try:
            # Create planning task
            plan_task = Task(
                task_id=f"plan_{datetime.utcnow().timestamp()}",
                description="Create project plan",
                task_type="planning",
                priority=1,
                assigned_to=self.ceo.agent_id,
                status="in_progress",
                created_at=datetime.utcnow()
            )

            # Execute planning
            result = await self.ceo.assign_task(plan_task)

            state["ceo_plan"] = result
            state["current_step"] = "ceo_plan"

            if result.success:
                # Extract tasks from CEO
                state["design_tasks"] = [
                    t for t in self.ceo.delegated_tasks if t.task_type == "design"
                ]
                state["development_tasks"] = [
                    t for t in self.ceo.delegated_tasks if t.task_type == "development"
                ]

                self.logger.info(
                    "ceo_plan_node_completed",
                    design_tasks=len(state["design_tasks"]),
                    dev_tasks=len(state["development_tasks"])
                )
            else:
                state["errors"].append(f"CEO planning failed: {result.error}")

        except Exception as e:
            self.logger.error("ceo_plan_node_error", error=str(e))
            state["errors"].append(f"CEO planning error: {str(e)}")

        return state

    async def _ceo_pm_briefing_node(self, state: OrchestratorState) -> OrchestratorState:
        """
        The CEO briefs the Project Manager, in the office.

        Both the CEO's task breakdown and the PM's refinement of it happen inside the meeting, so
        the conversation on screen corresponds to real work rather than a pause.
        """
        self.logger.info("ceo_pm_briefing_started")

        async with self._meeting(
            room="office",
            participants=[self.ceo.agent_id, self.pm.agent_id],
            topic="Handing over the evaluation and agreeing the delivery plan",
        ):
            # Everyone needs to walk in and sit down before anyone talks.
            await asyncio.sleep(SETTLE_SECONDS)
            state = await self._ceo_plan_node(state)

            ceo_plan = state.get("ceo_plan")
            if not ceo_plan or not ceo_plan.success:
                state["errors"].append("Cannot brief the PM: the CEO plan is missing")
                return state

            pm_task = Task(
                task_id=f"pm_plan_{datetime.utcnow().timestamp()}",
                description=ceo_plan.output,
                task_type="pm_planning",
                priority=1,
                assigned_to=self.pm.agent_id,
                status="in_progress",
                created_at=datetime.utcnow(),
            )
            result = await self.pm.assign_task(pm_task)
            state["pm_plan"] = result
            state["current_step"] = "ceo_pm_briefing"

            if result.success and self.pm.plan:
                # The PM owns the final breakdown; the CEO's list was the first pass.
                state["design_tasks"] = [
                    self._to_task(t) for t in self.pm.plan.design_tasks
                ]
                state["development_tasks"] = [
                    self._to_task(t) for t in self.pm.plan.development_tasks
                ]
                self.logger.info(
                    "ceo_pm_briefing_completed",
                    design_tasks=len(state["design_tasks"]),
                    dev_tasks=len(state["development_tasks"]),
                )
            else:
                state["errors"].append(f"PM planning failed: {result.error}")

            # The decisions have been made; now they are said out loud, sourced from the
            # actual evaluation and plan rather than from filler.
            lines = briefing_script(
                state["proposal"],
                getattr(self.ceo, "current_proposal", None),
                self.pm.plan,
            )
            self.logger.info("briefing_dialogue", lines=len(lines), seconds=round(script_seconds(lines), 1))
            await self._play(lines)

        return state

    async def _team_standup_node(self, state: OrchestratorState) -> OrchestratorState:
        """The PM gathers the designer and developer and briefs them on the plan."""
        self.logger.info("team_standup_started")

        async with self._meeting(
            room="meeting_room",
            participants=[self.pm.agent_id, self.designer.agent_id, self.developer.agent_id],
            topic="Standup: task assignment and sequencing",
        ):
            await asyncio.sleep(SETTLE_SECONDS)
            standup_task = Task(
                task_id=f"pm_standup_{datetime.utcnow().timestamp()}",
                description="Brief the team on the delivery plan",
                task_type="pm_standup",
                priority=1,
                assigned_to=self.pm.agent_id,
                status="in_progress",
                created_at=datetime.utcnow(),
            )
            result = await self.pm.assign_task(standup_task)
            state["pm_standup"] = result
            state["current_step"] = "team_standup"

            if not result.success:
                state["errors"].append(f"Standup failed: {result.error}")

            lines = standup_script(self.pm.plan)
            self.logger.info("standup_dialogue", lines=len(lines), seconds=round(script_seconds(lines), 1))
            await self._play(lines)

        return state

    @staticmethod
    def _to_task(planned) -> Task:
        """Convert a PlannedTask from the PM's schema into an executable Task."""
        return Task(
            task_id=planned.task_id,
            description=planned.description,
            task_type="design" if planned.assigned_to == "designer" else "development",
            priority=planned.priority,
            assigned_to=planned.assigned_to,
            status="queued",
            created_at=datetime.utcnow(),
        )

    async def _designer_work_node(self, state: OrchestratorState) -> OrchestratorState:
        """
        Designer processes design tasks in parallel.

        Args:
            state: Current orchestrator state

        Returns:
            Updated state with design results
        """
        self.logger.info("designer_work_node_started", task_count=len(state["design_tasks"]))

        state["current_step"] = "designer_work"
        state["design_results"] = []

        if not state["design_tasks"]:
            self.logger.info("designer_work_node_skipped", reason="no_design_tasks")
            return state

        try:
            # Process design tasks in parallel
            tasks = [
                self.designer.assign_task(task)
                for task in state["design_tasks"]
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    error_msg = f"Design task {i+1} failed: {str(result)}"
                    self.logger.error("designer_task_error", task_index=i, error=str(result))
                    state["errors"].append(error_msg)
                else:
                    state["design_results"].append(result)

            self.logger.info(
                "designer_work_node_completed",
                successful=len(state["design_results"]),
                failed=len(results) - len(state["design_results"])
            )

        except Exception as e:
            self.logger.error("designer_work_node_error", error=str(e))
            state["errors"].append(f"Designer work error: {str(e)}")

        return state

    async def _developer_work_node(self, state: OrchestratorState) -> OrchestratorState:
        """
        Developer processes development tasks in parallel.

        Args:
            state: Current orchestrator state

        Returns:
            Updated state with development results
        """
        self.logger.info("developer_work_node_started", task_count=len(state["development_tasks"]))

        state["current_step"] = "developer_work"
        state["dev_results"] = []

        if not state["development_tasks"]:
            self.logger.info("developer_work_node_skipped", reason="no_dev_tasks")
            return state

        try:
            # Process dev tasks in parallel
            tasks = [
                self.developer.assign_task(task)
                for task in state["development_tasks"]
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    error_msg = f"Dev task {i+1} failed: {str(result)}"
                    self.logger.error("developer_task_error", task_index=i, error=str(result))
                    state["errors"].append(error_msg)
                else:
                    state["dev_results"].append(result)

            self.logger.info(
                "developer_work_node_completed",
                successful=len(state["dev_results"]),
                failed=len(results) - len(state["dev_results"])
            )

        except Exception as e:
            self.logger.error("developer_work_node_error", error=str(e))
            state["errors"].append(f"Developer work error: {str(e)}")

        return state

    async def _finalize_node(self, state: OrchestratorState) -> OrchestratorState:
        """
        Finalize workflow and prepare results.

        Args:
            state: Current orchestrator state

        Returns:
            Updated state marked as completed
        """
        self.logger.info("finalize_node_started")

        state["current_step"] = "finalize"
        state["completed"] = True

        total_tasks = len(state["design_tasks"]) + len(state["development_tasks"])
        successful_tasks = len(state["design_results"]) + len(state["dev_results"])

        self.logger.info(
            "finalize_node_completed",
            total_tasks=total_tasks,
            successful_tasks=successful_tasks,
            errors=len(state["errors"])
        )

        return state

    async def orchestrate(self, proposal: str) -> OrchestratorState:
        """
        Orchestrate complete workflow from proposal to results.

        Args:
            proposal: User's project proposal

        Returns:
            Final orchestrator state with all results
        """
        self.logger.info("orchestration_started", proposal=proposal[:100])

        await self._broadcast("ORCHESTRATION_STARTED", {"proposal": proposal})

        # Clear state left over from a previous run so tasks are not re-delegated
        self.ceo.current_proposal = None
        self.ceo.delegated_tasks = []

        # Initialize state
        initial_state: OrchestratorState = {
            "proposal": proposal,
            "ceo_evaluation": None,
            "ceo_plan": None,
            "pm_plan": None,
            "pm_standup": None,
            "design_tasks": [],
            "development_tasks": [],
            "design_results": [],
            "dev_results": [],
            "current_step": "init",
            "errors": [],
            "completed": False
        }

        try:
            # Execute workflow
            final_state = await self.workflow.ainvoke(initial_state)

            self.logger.info(
                "orchestration_completed",
                success=final_state["completed"],
                errors=len(final_state["errors"])
            )

            await self._broadcast("ORCHESTRATION_COMPLETE", {
                "completed": final_state["completed"],
                "design_tasks": len(final_state["design_tasks"]),
                "development_tasks": len(final_state["development_tasks"]),
                "design_results": len(final_state["design_results"]),
                "dev_results": len(final_state["dev_results"]),
                "errors": final_state["errors"],
                "summary": self.get_summary(final_state)
            })

            return final_state

        except Exception as e:
            self.logger.error("orchestration_error", error=str(e))
            initial_state["errors"].append(f"Orchestration error: {str(e)}")

            await self._broadcast("ORCHESTRATION_FAILED", {
                "error": str(e),
                "errors": initial_state["errors"]
            })

            return initial_state

    def get_summary(self, state: OrchestratorState) -> str:
        """
        Generate human-readable summary of orchestration results.

        Args:
            state: Final orchestrator state

        Returns:
            Formatted summary string
        """
        lines = []

        lines.append("=" * 70)
        lines.append("ORCHESTRATION SUMMARY")
        lines.append("=" * 70)
        lines.append("")

        # Proposal
        lines.append(f"Proposal: {state['proposal'][:100]}...")
        lines.append("")

        # CEO Evaluation
        if state["ceo_evaluation"]:
            eval = state["ceo_evaluation"]
            lines.append("CEO Evaluation:")
            lines.append(f"  Status: {'[OK] Success' if eval.success else '[FAIL] Failed'}")
            if eval.metadata:
                lines.append(f"  Feasibility: {eval.metadata.get('feasibility', 'N/A')}")
                lines.append(f"  Complexity: {eval.metadata.get('complexity', 'N/A')}")
                lines.append(f"  Timeline: {eval.metadata.get('estimated_timeline', 'N/A')}")
        lines.append("")

        # Tasks
        lines.append(f"Tasks Generated:")
        lines.append(f"  Design Tasks: {len(state['design_tasks'])}")
        lines.append(f"  Development Tasks: {len(state['development_tasks'])}")
        lines.append("")

        # Results
        lines.append(f"Tasks Completed:")
        lines.append(f"  Design: {len(state['design_results'])}/{len(state['design_tasks'])}")
        lines.append(f"  Development: {len(state['dev_results'])}/{len(state['development_tasks'])}")
        lines.append("")

        # Errors
        if state["errors"]:
            lines.append(f"Errors ({len(state['errors'])}):")
            for error in state["errors"]:
                lines.append(f"  - {error}")
        else:
            lines.append("No errors encountered")

        lines.append("")
        lines.append("=" * 70)

        return "\n".join(lines)
