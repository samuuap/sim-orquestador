"""
Designer Agent Implementation.

This agent handles UI/UX design tasks with structured JSON output.
Uses Pydantic schemas for type-safe parsing of LLM responses.
"""

import json
import asyncio
from pathlib import Path
from typing import Optional

import structlog

from agents.base import BaseAgent, AgentState
from agents.llm_provider import LLMProvider
from agents.designer_schemas import DesignOutput
from schemas import Task, TaskResult

logger = structlog.get_logger(__name__)


class DesignerAgent(BaseAgent):
    """
    UI/UX Designer Agent that processes design tasks.

    Responsibilities:
    - Analyze design requirements
    - Define component specifications
    - Create design systems (colors, typography, spacing)
    - Plan deliverables (wireframes, mockups, prototypes)
    - Ensure accessibility compliance

    Uses structured JSON output with Pydantic validation for robust parsing.
    """

    def __init__(
        self,
        agent_id: str = "designer_001",
        llm_provider: Optional[LLMProvider] = None,
        websocket_manager=None
    ):
        super().__init__(agent_id=agent_id, role="designer", websocket_manager=websocket_manager)
        self.llm_provider = llm_provider
        self.system_prompt = self._load_system_prompt()
        self.logger = logger.bind(agent_id=agent_id, role="designer")

    def _load_system_prompt(self) -> str:
        """Load the designer system prompt from file."""
        prompt_path = Path(__file__).parent.parent.parent / "prompts" / "designer_system_prompt.md"
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            self.logger.error("designer_system_prompt_not_found", path=str(prompt_path))
            return "You are a UI/UX designer. Respond with valid JSON following the DesignOutput schema."

    async def process_task(self, task: Task) -> TaskResult:
        """
        Process a design task and return structured results.

        Args:
            task: Task object with design requirements

        Returns:
            TaskResult with parsed DesignOutput or error details
        """
        self.logger.info("processing_design_task", task_id=task.task_id, description=task.description)

        try:
            # Broadcast start event
            await self._broadcast_event("DESIGNER_ANALYZING", {
                "task_id": task.task_id,
                "description": task.description
            })

            # Real work starts here. Without this the agent never leaves THINKING,
            # so the desk "working" animation in the 3D client never plays.
            await self._change_state(AgentState.WORKING, {"task_id": task.task_id})

            # Generate structured design output
            design_output = await self._analyze_design_task(task.description)

            # Broadcast completion
            await self._broadcast_event("DESIGNER_ANALYSIS_COMPLETE", {
                "task_id": task.task_id,
                "design_type": design_output.task_analysis.design_type,
                "component_count": len(design_output.components),
                "estimated_hours": design_output.task_analysis.estimated_hours
            })

            # Format output for display
            formatted_output = self._format_design_output(design_output)

            # Update metrics
            self.metrics.total_tokens += getattr(design_output, '_token_count', 0)
            self.metrics.total_cost += getattr(design_output, '_cost', 0.0)

            return TaskResult(
                task_id=task.task_id,
                agent_id=self.agent_id,
                success=True,
                output=formatted_output,
                metadata={
                    "design_type": design_output.task_analysis.design_type,
                    "platform": design_output.task_analysis.platform,
                    "complexity": design_output.task_analysis.complexity,
                    "estimated_hours": design_output.task_analysis.estimated_hours,
                    "component_count": len(design_output.components),
                    "deliverable_count": len(design_output.deliverables),
                    "raw_output": design_output.model_dump()
                }
            )

        except Exception as e:
            self.logger.error("design_task_failed", task_id=task.task_id, error=str(e))

            await self._broadcast_event("DESIGNER_ERROR", {
                "task_id": task.task_id,
                "error": str(e)
            })

            return TaskResult(
                task_id=task.task_id,
                agent_id=self.agent_id,
                success=False,
                output=f"Design task failed: {str(e)}",
                error=str(e)
            )

    async def _analyze_design_task(self, task_description: str) -> DesignOutput:
        """
        Analyze design task using LLM with structured JSON output.

        Args:
            task_description: Description of the design task

        Returns:
            Validated DesignOutput object

        Raises:
            ValueError: If LLM response is invalid JSON or doesn't match schema
        """
        if not self.llm_provider:
            raise ValueError("LLM provider not configured")

        self.logger.info("calling_llm_for_design_analysis")

        # Construct user prompt
        user_prompt = f"""Analyze this design task and provide a structured design plan:

Task: {task_description}

Respond with valid JSON following the DesignOutput schema. Include:
1. Task analysis (type, platform, complexity, estimated hours)
2. Component list (all UI components needed)
3. Design system (colors, typography, spacing, layout)
4. Deliverables (what will be produced)
5. Technical considerations
6. Accessibility requirements
7. Next steps

Respond ONLY with valid JSON, no additional text."""

        # Call LLM with retry logic
        response = await self.llm_provider.generate_with_retry(
            prompt=user_prompt,
            system_prompt=self.system_prompt,
            max_tokens=2000,
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
            design_output = DesignOutput.model_validate(response_json)

            # Attach metrics for later use
            design_output._token_count = tokens
            design_output._cost = cost

            self.logger.info(
                "design_output_validated",
                design_type=design_output.task_analysis.design_type,
                component_count=len(design_output.components)
            )

            return design_output

        except json.JSONDecodeError as e:
            self.logger.error("invalid_json_response", error=str(e), response=response_text[:200])
            raise ValueError(f"LLM returned invalid JSON: {str(e)}")

        except Exception as e:
            self.logger.error("schema_validation_failed", error=str(e))
            raise ValueError(f"Response doesn't match DesignOutput schema: {str(e)}")

    def _format_design_output(self, output: DesignOutput) -> str:
        """
        Format DesignOutput into human-readable text.

        Args:
            output: Validated DesignOutput object

        Returns:
            Formatted string for display
        """
        lines = []

        # Header
        lines.append("=" * 60)
        lines.append("DESIGN ANALYSIS")
        lines.append("=" * 60)
        lines.append("")

        # Task Analysis
        ta = output.task_analysis
        lines.append(f"Design Type: {ta.design_type.upper()}")
        lines.append(f"Platform: {ta.platform}")
        lines.append(f"Complexity: {ta.complexity.upper()}")
        lines.append(f"Estimated Hours: {ta.estimated_hours}")
        lines.append("")

        # Components
        lines.append("-" * 60)
        lines.append(f"COMPONENTS ({len(output.components)})")
        lines.append("-" * 60)
        for comp in output.components:
            lines.append(f"• {comp.name} ({comp.type})")
            lines.append(f"  {comp.description}")
            lines.append(f"  States: {', '.join(comp.states)}")
            lines.append(f"  Responsive: {'Yes' if comp.responsive else 'No'}")
            lines.append("")

        # Design System
        lines.append("-" * 60)
        lines.append("DESIGN SYSTEM")
        lines.append("-" * 60)

        # Colors
        colors = output.design_system.colors
        lines.append("Colors:")
        lines.append(f"  Primary: {colors.primary}")
        lines.append(f"  Secondary: {colors.secondary}")
        lines.append(f"  Accent: {colors.accent}")
        lines.append(f"  Neutral: {', '.join(colors.neutral[:3])}...")
        lines.append("")

        # Typography
        typo = output.design_system.typography
        lines.append("Typography:")
        for name, family in typo.font_families.items():
            lines.append(f"  {name.capitalize()}: {family}")
        lines.append("")

        # Spacing
        spacing = output.design_system.spacing
        lines.append(f"Spacing Scale: {', '.join(map(str, spacing.scale))}{spacing.unit}")
        lines.append("")

        # Deliverables
        lines.append("-" * 60)
        lines.append(f"DELIVERABLES ({len(output.deliverables)})")
        lines.append("-" * 60)
        for deliv in output.deliverables:
            lines.append(f"• [{deliv.priority.upper()}] {deliv.type.upper()}")
            lines.append(f"  {deliv.description}")
            lines.append(f"  Format: {deliv.format}")
            lines.append("")

        # Accessibility
        lines.append("-" * 60)
        lines.append(f"ACCESSIBILITY (WCAG {output.accessibility.wcag_level})")
        lines.append("-" * 60)
        for req in output.accessibility.key_requirements:
            lines.append(f"• {req}")
        lines.append("")

        # Technical Considerations
        if output.technical_considerations:
            lines.append("-" * 60)
            lines.append("TECHNICAL CONSIDERATIONS")
            lines.append("-" * 60)
            for consideration in output.technical_considerations:
                lines.append(f"• {consideration}")
            lines.append("")

        # Next Steps
        lines.append("-" * 60)
        lines.append("NEXT STEPS")
        lines.append("-" * 60)
        for i, step in enumerate(output.next_steps, 1):
            lines.append(f"{i}. {step}")
        lines.append("")

        lines.append("=" * 60)

        return "\n".join(lines)

