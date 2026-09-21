"""
Pydantic schemas for Developer Agent structured outputs.
These models define the exact JSON structure expected from the LLM.
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field


class TaskAnalysis(BaseModel):
    """Analysis of the development task requirements."""
    task_type: Literal[
        "api_endpoint",
        "database_schema",
        "frontend_component",
        "backend_service",
        "integration",
        "testing",
        "deployment",
        "refactoring"
    ]
    complexity: Literal["simple", "moderate", "complex", "very_complex"]
    estimated_hours: float = Field(gt=0, description="Estimated hours to complete")
    requires_design: bool = Field(
        default=False,
        description="Whether this task requires design input first"
    )


class TechnicalRequirement(BaseModel):
    """Technical requirement or specification."""
    id: str = Field(description="Unique requirement ID (e.g., 'tech_001')")
    description: str = Field(description="Technical requirement description")
    priority: Literal["critical", "high", "medium", "low"] = Field(default="medium")
    category: Literal[
        "architecture",
        "security",
        "performance",
        "scalability",
        "testing",
        "deployment"
    ] = Field(default="architecture")


class Implementation(BaseModel):
    """Implementation step or subtask."""
    step_number: int = Field(ge=1, description="Sequential step number")
    title: str = Field(description="Short step title")
    description: str = Field(description="Detailed implementation description")
    estimated_hours: float = Field(gt=0, description="Time estimate for this step")
    dependencies: list[int] = Field(
        default_factory=list,
        description="List of step numbers this depends on"
    )
    code_changes: list[str] = Field(
        default_factory=list,
        description="Files or modules that will be modified"
    )


class TechStack(BaseModel):
    """Technology stack and dependencies."""
    languages: list[str] = Field(
        default_factory=list,
        description="Programming languages used"
    )
    frameworks: list[str] = Field(
        default_factory=list,
        description="Frameworks and libraries"
    )
    databases: list[str] = Field(
        default_factory=list,
        description="Database systems"
    )
    tools: list[str] = Field(
        default_factory=list,
        description="Development tools and services"
    )
    new_dependencies: list[str] = Field(
        default_factory=list,
        description="New packages/libraries to install"
    )


class TestingStrategy(BaseModel):
    """Testing approach for the implementation."""
    unit_tests: list[str] = Field(
        default_factory=list,
        description="Unit tests to write"
    )
    integration_tests: list[str] = Field(
        default_factory=list,
        description="Integration tests to write"
    )
    test_coverage_target: int = Field(
        default=80,
        ge=0,
        le=100,
        description="Target test coverage percentage"
    )
    testing_notes: Optional[str] = Field(
        None,
        description="Additional testing considerations"
    )


class SecurityConsideration(BaseModel):
    """Security consideration or requirement."""
    id: str = Field(description="Security item ID (e.g., 'sec_001')")
    category: Literal[
        "authentication",
        "authorization",
        "data_validation",
        "encryption",
        "sql_injection",
        "xss",
        "csrf",
        "api_security"
    ]
    description: str = Field(description="Security concern description")
    mitigation: str = Field(description="How to address this security concern")
    severity: Literal["critical", "high", "medium", "low"] = Field(default="medium")


class PerformanceConsideration(BaseModel):
    """Performance optimization or consideration."""
    aspect: str = Field(description="Performance aspect (e.g., 'database queries', 'caching')")
    description: str = Field(description="Performance consideration description")
    recommendation: str = Field(description="Optimization recommendation")
    impact: Literal["high", "medium", "low"] = Field(
        default="medium",
        description="Performance impact level"
    )


class DeveloperOutput(BaseModel):
    """
    Complete structured output from Developer Agent.
    This is the root schema that the LLM must follow.
    """
    task_summary: str = Field(description="Brief summary of what will be implemented")

    task_analysis: TaskAnalysis

    technical_requirements: list[TechnicalRequirement] = Field(
        description="List of technical requirements"
    )

    tech_stack: TechStack

    implementation_steps: list[Implementation] = Field(
        description="Ordered steps to implement the task"
    )

    testing_strategy: TestingStrategy

    security_considerations: list[SecurityConsideration] = Field(
        default_factory=list,
        description="Security concerns to address"
    )

    performance_considerations: list[PerformanceConsideration] = Field(
        default_factory=list,
        description="Performance optimizations to consider"
    )

    deployment_notes: list[str] = Field(
        default_factory=list,
        description="Deployment and configuration notes"
    )

    next_steps: list[str] = Field(
        description="Ordered list of immediate next actions"
    )

    notes: Optional[str] = Field(
        None,
        description="Additional notes or considerations"
    )

    class Config:
        """Pydantic configuration."""
        json_schema_extra = {
            "example": {
                "task_summary": "Implement user authentication API with JWT tokens",
                "task_analysis": {
                    "task_type": "api_endpoint",
                    "complexity": "moderate",
                    "estimated_hours": 12.0,
                    "requires_design": True
                },
                "technical_requirements": [
                    {
                        "id": "tech_001",
                        "description": "Secure password hashing with bcrypt",
                        "priority": "critical",
                        "category": "security"
                    },
                    {
                        "id": "tech_002",
                        "description": "JWT token generation and validation",
                        "priority": "critical",
                        "category": "security"
                    }
                ],
                "tech_stack": {
                    "languages": ["Python"],
                    "frameworks": ["FastAPI", "Pydantic"],
                    "databases": ["PostgreSQL"],
                    "tools": ["Docker", "pytest"],
                    "new_dependencies": ["python-jose", "passlib", "bcrypt"]
                },
                "implementation_steps": [
                    {
                        "step_number": 1,
                        "title": "Create user model",
                        "description": "Define User Pydantic model with validation",
                        "estimated_hours": 2.0,
                        "dependencies": [],
                        "code_changes": ["models/user.py"]
                    },
                    {
                        "step_number": 2,
                        "title": "Implement password hashing",
                        "description": "Create utility functions for bcrypt hashing",
                        "estimated_hours": 1.5,
                        "dependencies": [1],
                        "code_changes": ["utils/security.py"]
                    }
                ],
                "testing_strategy": {
                    "unit_tests": [
                        "test_password_hashing",
                        "test_jwt_generation",
                        "test_user_validation"
                    ],
                    "integration_tests": [
                        "test_login_flow",
                        "test_protected_endpoints"
                    ],
                    "test_coverage_target": 90,
                    "testing_notes": "Focus on security-critical paths"
                },
                "security_considerations": [
                    {
                        "id": "sec_001",
                        "category": "authentication",
                        "description": "Password storage vulnerability",
                        "mitigation": "Use bcrypt with salt rounds >= 12",
                        "severity": "critical"
                    }
                ],
                "performance_considerations": [
                    {
                        "aspect": "Database queries",
                        "description": "User lookup by email should be indexed",
                        "recommendation": "Add database index on email column",
                        "impact": "high"
                    }
                ],
                "deployment_notes": [
                    "Set JWT_SECRET in environment variables",
                    "Configure token expiration time",
                    "Ensure HTTPS in production"
                ],
                "next_steps": [
                    "Set up database migrations",
                    "Implement user model and schemas",
                    "Create authentication endpoints",
                    "Write unit tests"
                ],
                "notes": "Consider rate limiting for login attempts"
            }
        }
