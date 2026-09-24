"""
Developer Agent Implementation.

This agent handles software development tasks with structured JSON output.
Uses Pydantic schemas for type-safe parsing of LLM responses.
"""

import json
import asyncio
from pathlib import Path
from typing import Optional

import structlog

from agents.base import BaseAgent, AgentState
from agents.llm_provider import LLMProvider
from agents.developer_schemas import (
    DeveloperOutput,
    TaskAnalysis,
    TechnicalRequirement,
    Implementation,
    TechStack,
    TestingStrategy,
    SecurityConsideration,
    PerformanceConsideration
)
from schemas import Task, TaskResult

logger = structlog.get_logger(__name__)


class DeveloperAgent(BaseAgent):
    """
    Software Developer Agent that processes development tasks.

    Responsibilities:
    - Analyze development requirements
    - Plan technical implementations
    - Define technology stack and dependencies
    - Break down work into implementation steps
    - Plan security and performance considerations
    - Define testing strategy

    Uses structured JSON output with Pydantic validation for robust parsing.
    """

    def __init__(
        self,
        agent_id: str = "developer_001",
        llm_provider: Optional[LLMProvider] = None,
        websocket_manager=None
    ):
        super().__init__(agent_id=agent_id, role="developer", websocket_manager=websocket_manager)
        self.llm_provider = llm_provider
        self.system_prompt = self._load_system_prompt()
        self.logger = logger.bind(agent_id=agent_id, role="developer")

    def _load_system_prompt(self) -> str:
        """Load the developer system prompt from file."""
        prompt_path = Path(__file__).parent.parent.parent / "prompts" / "developer_system_prompt.md"
        try:
            with open(prompt_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            self.logger.error("developer_system_prompt_not_found", path=str(prompt_path))
            return "You are a developer agent. Respond with valid JSON following the DeveloperOutput schema."

    async def process_task(self, task: Task) -> TaskResult:
        """
        Process a development task and return structured results.

        Args:
            task: Task object with development requirements

        Returns:
            TaskResult with parsed DeveloperOutput or error details
        """
        self.logger.info("processing_development_task", task_id=task.task_id, description=task.description)

        try:
            # Broadcast start event
            await self._broadcast_event("DEVELOPER_ANALYZING", {
                "task_id": task.task_id,
                "description": task.description
            })

            # Real work starts here. Without this the agent never leaves THINKING,
            # so the desk "working" animation in the 3D client never plays.
            await self._change_state(AgentState.WORKING, {"task_id": task.task_id})

            # Generate structured development output
            dev_output = await self._analyze_development_task(task.description)

            # Broadcast completion
            await self._broadcast_event("DEVELOPER_ANALYSIS_COMPLETE", {
                "task_id": task.task_id,
                "task_type": dev_output.task_analysis.task_type,
                "complexity": dev_output.task_analysis.complexity,
                "estimated_hours": dev_output.task_analysis.estimated_hours,
                "implementation_steps": len(dev_output.implementation_steps)
            })

            # Format output for display
            formatted_output = self._format_developer_output(dev_output)

            # Update metrics
            self.metrics.total_tokens += getattr(dev_output, '_token_count', 0)
            self.metrics.total_cost += getattr(dev_output, '_cost', 0.0)

            return TaskResult(
                task_id=task.task_id,
                agent_id=self.agent_id,
                success=True,
                output=formatted_output,
                metadata={
                    "task_type": dev_output.task_analysis.task_type,
                    "complexity": dev_output.task_analysis.complexity,
                    "estimated_hours": dev_output.task_analysis.estimated_hours,
                    "implementation_steps": len(dev_output.implementation_steps),
                    "tech_requirements": len(dev_output.technical_requirements),
                    "security_items": len(dev_output.security_considerations),
                    "raw_output": dev_output.model_dump()
                }
            )

        except Exception as e:
            self.logger.error("development_task_failed", task_id=task.task_id, error=str(e))

            await self._broadcast_event("DEVELOPER_ERROR", {
                "task_id": task.task_id,
                "error": str(e)
            })

            return TaskResult(
                task_id=task.task_id,
                agent_id=self.agent_id,
                success=False,
                output=f"Development task failed: {str(e)}",
                error=str(e)
            )

    async def _analyze_development_task(self, task_description: str) -> DeveloperOutput:
        """
        Analyze development task using LLM with structured JSON output.

        Args:
            task_description: Description of the development task

        Returns:
            Validated DeveloperOutput object

        Raises:
            ValueError: If LLM response is invalid JSON or doesn't match schema
        """
        if not self.llm_provider:
            raise ValueError("LLM provider not configured")

        self.logger.info("calling_llm_for_development_analysis")

        # Construct user prompt
        user_prompt = f"""Analyze this development task and provide a comprehensive implementation plan:

Task: {task_description}

Respond with valid JSON following the DeveloperOutput schema. Include:
1. Task summary and analysis (type, complexity, estimated hours, requires design)
2. Technical requirements (with IDs, priorities, categories)
3. Technology stack (languages, frameworks, databases, tools, new dependencies)
4. Implementation steps (sequential, with time estimates, dependencies, code changes)
5. Testing strategy (unit tests, integration tests, coverage target)
6. Security considerations (with categories, mitigations, severity)
7. Performance considerations (optimizations and recommendations)
8. Deployment notes (environment config, setup steps)
9. Next steps (ordered immediate actions)
10. Additional notes

Use these formats:
- Technical requirement IDs: "tech_001", "tech_002", etc.
- Security consideration IDs: "sec_001", "sec_002", etc.
- Step numbers: 1, 2, 3, etc. (sequential)
- Dependencies: array of step numbers

Be specific and actionable. Provide production-ready implementation guidance.

Respond ONLY with valid JSON, no additional text."""

        # Call LLM with retry logic
        response = await self.llm_provider.generate_with_retry(
            prompt=user_prompt,
            system_prompt=self.system_prompt,
            max_tokens=4000,
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
            dev_output = DeveloperOutput.model_validate(response_json)

            # Attach metrics for later use
            dev_output._token_count = tokens
            dev_output._cost = cost

            self.logger.info(
                "developer_output_validated",
                task_type=dev_output.task_analysis.task_type,
                complexity=dev_output.task_analysis.complexity,
                steps=len(dev_output.implementation_steps)
            )

            return dev_output

        except json.JSONDecodeError as e:
            self.logger.error("invalid_json_response", error=str(e), response=response_text[:200])
            raise ValueError(f"LLM returned invalid JSON: {str(e)}")

        except Exception as e:
            self.logger.error("schema_validation_failed", error=str(e))
            raise ValueError(f"Response doesn't match DeveloperOutput schema: {str(e)}")

    def _format_developer_output(self, output: DeveloperOutput) -> str:
        """
        Format DeveloperOutput into human-readable text.

        Args:
            output: Validated DeveloperOutput object

        Returns:
            Formatted string for display
        """
        lines = []

        # Header
        lines.append("=" * 70)
        lines.append("DEVELOPMENT IMPLEMENTATION PLAN")
        lines.append("=" * 70)
        lines.append("")

        # Task Summary
        lines.append(f"Summary: {output.task_summary}")
        lines.append("")

        # Task Analysis
        ta = output.task_analysis
        lines.append(f"Task Type: {ta.task_type.upper()}")
        lines.append(f"Complexity: {ta.complexity.upper()}")
        lines.append(f"Estimated Hours: {ta.estimated_hours}")
        lines.append(f"Requires Design: {'Yes' if ta.requires_design else 'No'}")
        lines.append("")

        # Technical Requirements
        lines.append("-" * 70)
        lines.append(f"TECHNICAL REQUIREMENTS ({len(output.technical_requirements)})")
        lines.append("-" * 70)
        for req in output.technical_requirements:
            lines.append(f"[{req.priority.upper()}] {req.id}: {req.description}")
            lines.append(f"  Category: {req.category}")
        lines.append("")

        # Tech Stack
        lines.append("-" * 70)
        lines.append("TECHNOLOGY STACK")
        lines.append("-" * 70)
        stack = output.tech_stack
        if stack.languages:
            lines.append(f"Languages: {', '.join(stack.languages)}")
        if stack.frameworks:
            lines.append(f"Frameworks: {', '.join(stack.frameworks)}")
        if stack.databases:
            lines.append(f"Databases: {', '.join(stack.databases)}")
        if stack.tools:
            lines.append(f"Tools: {', '.join(stack.tools)}")
        if stack.new_dependencies:
            lines.append(f"New Dependencies: {', '.join(stack.new_dependencies)}")
        lines.append("")

        # Implementation Steps
        lines.append("-" * 70)
        lines.append(f"IMPLEMENTATION STEPS ({len(output.implementation_steps)})")
        lines.append("-" * 70)
        for step in output.implementation_steps:
            lines.append(f"Step {step.step_number}: {step.title} ({step.estimated_hours}h)")
            lines.append(f"  {step.description}")
            if step.dependencies:
                lines.append(f"  Depends on: Steps {', '.join(map(str, step.dependencies))}")
            if step.code_changes:
                lines.append(f"  Files: {', '.join(step.code_changes[:3])}" +
                           ("..." if len(step.code_changes) > 3 else ""))
        lines.append("")

        # Testing Strategy
        lines.append("-" * 70)
        lines.append("TESTING STRATEGY")
        lines.append("-" * 70)
        testing = output.testing_strategy
        lines.append(f"Target Coverage: {testing.test_coverage_target}%")
        if testing.unit_tests:
            lines.append(f"Unit Tests: {len(testing.unit_tests)} tests")
            for test in testing.unit_tests[:3]:
                lines.append(f"  - {test}")
            if len(testing.unit_tests) > 3:
                lines.append(f"  ... and {len(testing.unit_tests) - 3} more")
        if testing.integration_tests:
            lines.append(f"Integration Tests: {len(testing.integration_tests)} tests")
            for test in testing.integration_tests[:3]:
                lines.append(f"  - {test}")
            if len(testing.integration_tests) > 3:
                lines.append(f"  ... and {len(testing.integration_tests) - 3} more")
        if testing.testing_notes:
            lines.append(f"Notes: {testing.testing_notes}")
        lines.append("")

        # Security Considerations
        if output.security_considerations:
            lines.append("-" * 70)
            lines.append(f"SECURITY CONSIDERATIONS ({len(output.security_considerations)})")
            lines.append("-" * 70)
            for sec in output.security_considerations:
                lines.append(f"[{sec.severity.upper()}] {sec.id} - {sec.category.upper()}")
                lines.append(f"  Issue: {sec.description}")
                lines.append(f"  Mitigation: {sec.mitigation}")
            lines.append("")

        # Performance Considerations
        if output.performance_considerations:
            lines.append("-" * 70)
            lines.append(f"PERFORMANCE CONSIDERATIONS ({len(output.performance_considerations)})")
            lines.append("-" * 70)
            for perf in output.performance_considerations:
                lines.append(f"[{perf.impact.upper()}] {perf.aspect}")
                lines.append(f"  {perf.description}")
                lines.append(f"  Recommendation: {perf.recommendation}")
            lines.append("")

        # Deployment Notes
        if output.deployment_notes:
            lines.append("-" * 70)
            lines.append("DEPLOYMENT NOTES")
            lines.append("-" * 70)
            for note in output.deployment_notes:
                lines.append(f"- {note}")
            lines.append("")

        # Next Steps
        lines.append("-" * 70)
        lines.append("NEXT STEPS")
        lines.append("-" * 70)
        for i, step in enumerate(output.next_steps, 1):
            lines.append(f"{i}. {step}")
        lines.append("")

        # Notes
        if output.notes:
            lines.append("-" * 70)
            lines.append("NOTES")
            lines.append("-" * 70)
            lines.append(output.notes)
            lines.append("")

        lines.append("=" * 70)

        return "\n".join(lines)

