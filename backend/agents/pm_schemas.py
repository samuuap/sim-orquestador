"""
Pydantic schemas for Project Manager output.

Same contract as the other agents: the LLM returns JSON only, Pydantic validates it, and a
malformed or schema-violating response fails loudly instead of half-populating an object.
"""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

Assignee = Literal["designer", "developer"]
Level = Literal["low", "medium", "high"]


class BriefAdjustment(BaseModel):
    """A change the PM is making to the CEO's first-pass breakdown."""

    kind: Literal["split", "merge", "reorder", "add", "remove", "reassign"]
    target: str = Field(min_length=1)
    reason: str = Field(min_length=1)


class PlannedTask(BaseModel):
    """One unit of work with exactly one owner."""

    task_id: str = Field(min_length=1)
    description: str = Field(min_length=1)
    assigned_to: Assignee
    priority: int = Field(ge=1, le=5)
    estimated_hours: float = Field(gt=0)
    depends_on: List[str] = Field(default_factory=list)


class Phase(BaseModel):
    """A group of tasks that completes a milestone."""

    phase_number: int = Field(ge=1)
    name: str = Field(min_length=1)
    goal: str = Field(min_length=1)
    task_ids: List[str] = Field(default_factory=list)
    blocked_by: List[int] = Field(default_factory=list)


class Risk(BaseModel):
    description: str = Field(min_length=1)
    likelihood: Level
    impact: Level
    mitigation: str = Field(min_length=1)


class PMOutput(BaseModel):
    """Root schema for a Project Manager planning pass."""

    plan_summary: str = Field(min_length=1)
    brief_adjustments: List[BriefAdjustment] = Field(default_factory=list)
    phases: List[Phase] = Field(default_factory=list)
    tasks: List[PlannedTask] = Field(min_length=1)
    risks: List[Risk] = Field(default_factory=list)
    questions_for_ceo: List[str] = Field(default_factory=list)
    standup_brief: str = Field(min_length=1)
    notes: Optional[str] = None

    @field_validator("tasks")
    @classmethod
    def task_ids_unique(cls, tasks: List[PlannedTask]) -> List[PlannedTask]:
        ids = [task.task_id for task in tasks]
        duplicates = {task_id for task_id in ids if ids.count(task_id) > 1}
        if duplicates:
            raise ValueError(f"Duplicate task_id values: {sorted(duplicates)}")
        return tasks

    @model_validator(mode="after")
    def references_resolve(self) -> "PMOutput":
        """
        A plan that references tasks it does not contain cannot be executed, and the orchestrator
        would silently drop the work. Catch it at the schema boundary instead.
        """
        known = {task.task_id for task in self.tasks}

        for task in self.tasks:
            missing = [dep for dep in task.depends_on if dep not in known]
            if missing:
                raise ValueError(f"Task {task.task_id} depends on unknown tasks: {missing}")
            if task.task_id in task.depends_on:
                raise ValueError(f"Task {task.task_id} depends on itself")

        for phase in self.phases:
            missing = [task_id for task_id in phase.task_ids if task_id not in known]
            if missing:
                raise ValueError(f"Phase {phase.phase_number} references unknown tasks: {missing}")

        return self

    @property
    def design_tasks(self) -> List[PlannedTask]:
        return [task for task in self.tasks if task.assigned_to == "designer"]

    @property
    def development_tasks(self) -> List[PlannedTask]:
        return [task for task in self.tasks if task.assigned_to == "developer"]
