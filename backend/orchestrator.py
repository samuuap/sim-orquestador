"""
Agent Orchestrator using LangGraph.

Coordinates workflow between CEO, Designer, and Developer agents.
Manages task dependencies, state transitions, and progress tracking.
"""

import asyncio
from typing import TypedDict, Annotated, Literal, Optional
from datetime import datetime

import structlog
from langgraph.graph import StateGraph, END

from agents.ceo import CEOAgent
from agents.designer import DesignerAgent
from agents.developer import DeveloperAgent
from schemas import Task, TaskResult, WSEvent


logger = structlog.get_logger(__name__)


class OrchestratorState(TypedDict):
    """State maintained throughout the orchestration workflow."""
    # User input
    proposal: str

    # CEO outputs
    ceo_evaluation: Optional[TaskResult]
    ceo_plan: Optional[TaskResult]
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
        websocket_manager=None
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
        """
        self.ceo = ceo_agent
        self.designer = designer_agent
        self.developer = developer_agent
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

    def _build_workflow(self) -> StateGraph:
        """
        Build LangGraph workflow for agent orchestration.

        Returns:
            Compiled StateGraph workflow
        """
        workflow = StateGraph(OrchestratorState)

        # Add nodes
        workflow.add_node("evaluate_proposal", self._ceo_evaluate_node)
        workflow.add_node("create_plan", self._ceo_plan_node)
        workflow.add_node("design_work", self._designer_work_node)
        workflow.add_node("development_work", self._developer_work_node)
        workflow.add_node("finalize_results", self._finalize_node)

        # Define edges
        workflow.set_entry_point("evaluate_proposal")

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
