"""
Pydantic schemas for CEO Agent structured outputs.
These models define the exact JSON structure expected from the LLM.
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field


class ProposalEvaluation(BaseModel):
    """Evaluation of a project proposal."""
    feasibility: Literal["APPROVED", "NEEDS_CLARIFICATION", "NOT_FEASIBLE"]
    complexity: Literal["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]
    estimated_timeline: str = Field(
        description="Human-readable timeline estimate (e.g., '2-3 weeks', '1 month')"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        default="medium",
        description="Confidence level in the evaluation"
    )


class Requirement(BaseModel):
    """Single project requirement."""
    id: str = Field(description="Unique requirement identifier (e.g., 'req_001')")
    description: str = Field(description="Clear description of the requirement")
    priority: Literal["critical", "high", "medium", "low"] = Field(default="medium")
    category: Literal["functional", "technical", "design", "quality"] = Field(
        default="functional"
    )


class DesignTask(BaseModel):
    """Design task for the Designer Agent."""
    task_id: str = Field(description="Unique task ID (format: design_xxxxx)")
    title: str = Field(description="Short task title")
    description: str = Field(description="Detailed task description")
    estimated_hours: float = Field(gt=0, description="Estimated hours to complete")
    priority: Literal["high", "medium", "low"] = Field(default="medium")
    dependencies: list[str] = Field(
        default_factory=list,
        description="List of task IDs this task depends on"
    )


class DevelopmentTask(BaseModel):
    """Development task for the Developer Agent."""
    task_id: str = Field(description="Unique task ID (format: dev_xxxxx)")
    title: str = Field(description="Short task title")
    description: str = Field(description="Detailed task description")
    estimated_hours: float = Field(gt=0, description="Estimated hours to complete")
    priority: Literal["high", "medium", "low"] = Field(default="medium")
    dependencies: list[str] = Field(
        default_factory=list,
        description="List of task IDs this task depends on"
    )
    technical_stack: list[str] = Field(
        default_factory=list,
        description="Technologies/frameworks needed"
    )


class Risk(BaseModel):
    """Project risk or dependency."""
    id: str = Field(description="Unique risk identifier")
    description: str = Field(description="Risk or dependency description")
    severity: Literal["critical", "high", "medium", "low"] = Field(default="medium")
    mitigation: Optional[str] = Field(
        None,
        description="Suggested mitigation strategy"
    )


class CEOOutput(BaseModel):
    """
    Complete structured output from CEO Agent.
    This is the root schema that the LLM must follow.
    """
    project_title: str = Field(description="Concise project title")

    evaluation: ProposalEvaluation

    requirements: list[Requirement] = Field(
        description="List of project requirements"
    )

    design_tasks: list[DesignTask] = Field(
        description="Tasks to be assigned to Designer Agent"
    )

    development_tasks: list[DevelopmentTask] = Field(
        description="Tasks to be assigned to Developer Agent"
    )

    risks: list[Risk] = Field(
        default_factory=list,
        description="Project risks and dependencies"
    )

    next_steps: list[str] = Field(
        description="Ordered list of immediate next actions"
    )

    notes: Optional[str] = Field(
        None,
        description="Additional notes or clarifications"
    )

    class Config:
        """Pydantic configuration."""
        json_schema_extra = {
            "example": {
                "project_title": "User Authentication System",
                "evaluation": {
                    "feasibility": "APPROVED",
                    "complexity": "MEDIUM",
                    "estimated_timeline": "2-3 weeks",
                    "confidence": "high"
                },
                "requirements": [
                    {
                        "id": "req_001",
                        "description": "Secure login with email/password",
                        "priority": "critical",
                        "category": "functional"
                    },
                    {
                        "id": "req_002",
                        "description": "Password reset functionality",
                        "priority": "high",
                        "category": "functional"
                    }
                ],
                "design_tasks": [
                    {
                        "task_id": "design_001",
                        "title": "Design login screen",
                        "description": "Create login UI with email/password fields",
                        "estimated_hours": 4.0,
                        "priority": "high",
                        "dependencies": []
                    }
                ],
                "development_tasks": [
                    {
                        "task_id": "dev_001",
                        "title": "Implement authentication API",
                        "description": "Build REST API for login/logout",
                        "estimated_hours": 8.0,
                        "priority": "high",
                        "dependencies": [],
                        "technical_stack": ["FastAPI", "JWT", "PostgreSQL"]
                    }
                ],
                "risks": [
                    {
                        "id": "risk_001",
                        "description": "Security vulnerabilities in auth flow",
                        "severity": "high",
                        "mitigation": "Use established libraries, security audit"
                    }
                ],
                "next_steps": [
                    "Assign design tasks to Designer Agent",
                    "Set up development environment",
                    "Begin login screen design"
                ],
                "notes": "Consider OAuth integration for future enhancement"
            }
        }
