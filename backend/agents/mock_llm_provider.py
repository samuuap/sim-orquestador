"""
Mock LLM Provider for testing without real API calls.

Simulates realistic LLM responses for all agent types.
"""

from typing import Dict, Any, Optional
import json
from datetime import datetime


class MockLLMProvider:
    """
    Mock LLM provider that returns realistic structured responses.

    Use this for testing without making real API calls.
    """

    def __init__(self):
        """Initialize mock provider."""
        self.provider = "mock"
        self.model = "mock-gpt-4"
        self.call_count = 0

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """
        Generate a mock completion.

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            temperature: Sampling temperature (ignored in mock)
            max_tokens: Maximum tokens (ignored in mock)
            timeout: Request timeout (ignored in mock)

        Returns:
            Dictionary with 'content', 'tokens', 'cost', 'duration'
        """
        self.call_count += 1

        # Detect which agent is calling based on system prompt.
        # Project Manager is checked first: its prompt mentions designers and developers, so a
        # later branch would swallow it.
        if system_prompt and "Project Manager" in system_prompt:
            content = self._mock_pm_response(prompt)
        elif system_prompt and "CEO Agent" in system_prompt:
            content = self._mock_ceo_response(prompt)
        elif system_prompt and "Designer" in system_prompt:
            content = self._mock_designer_response(prompt)
        elif system_prompt and "Developer" in system_prompt:
            content = self._mock_developer_response(prompt)
        else:
            content = self._mock_generic_response(prompt)

        return {
            "content": content,
            "tokens": len(content.split()) * 2,  # Rough estimate
            "cost": 0.0,  # Mock has no cost
            "duration": 0.1  # Simulate 100ms response time
        }

    async def generate_with_retry(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_retries: int = 3,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate with retry (just calls generate in mock).

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            max_retries: Maximum retries (ignored in mock)
            **kwargs: Additional arguments

        Returns:
            Dictionary with 'content', 'tokens', 'cost', 'duration'
        """
        return await self.generate(prompt, system_prompt, **kwargs)

    def _mock_ceo_response(self, prompt: str) -> str:
        """Generate mock CEO agent response."""
        return json.dumps({
            "project_title": "Task Management Application",
            "evaluation": {
                "feasibility": "APPROVED",
                "complexity": "MEDIUM",
                "estimated_timeline": "2-3 weeks",
                "confidence": "high"
            },
            "requirements": [
                {
                    "id": "req_001",
                    "description": "Users can create, edit, and delete tasks",
                    "priority": "critical",
                    "category": "functional"
                },
                {
                    "id": "req_002",
                    "description": "Tasks have title, description, and due date",
                    "priority": "high",
                    "category": "functional"
                },
                {
                    "id": "req_003",
                    "description": "Tasks can be marked as complete",
                    "priority": "high",
                    "category": "functional"
                },
                {
                    "id": "req_004",
                    "description": "Clean user interface",
                    "priority": "medium",
                    "category": "design"
                },
                {
                    "id": "req_005",
                    "description": "Backend API with database",
                    "priority": "critical",
                    "category": "technical"
                }
            ],
            "design_tasks": [
                {
                    "task_id": "design_001",
                    "title": "Design task list view",
                    "description": "Create UI mockup for main task list with filtering and sorting",
                    "estimated_hours": 4.0,
                    "priority": "high",
                    "dependencies": []
                },
                {
                    "task_id": "design_002",
                    "title": "Design task creation form",
                    "description": "Design form for creating and editing tasks with validation",
                    "estimated_hours": 3.0,
                    "priority": "high",
                    "dependencies": []
                }
            ],
            "development_tasks": [
                {
                    "task_id": "dev_001",
                    "title": "Implement task CRUD API",
                    "description": "Build REST API endpoints for task operations",
                    "estimated_hours": 8.0,
                    "priority": "high",
                    "dependencies": [],
                    "technical_stack": ["FastAPI", "PostgreSQL", "SQLAlchemy"]
                },
                {
                    "task_id": "dev_002",
                    "title": "Implement frontend task list",
                    "description": "Build React components for task list view",
                    "estimated_hours": 6.0,
                    "priority": "high",
                    "dependencies": ["design_001"],
                    "technical_stack": ["React", "TypeScript", "Tailwind CSS"]
                }
            ],
            "risks": [
                {
                    "id": "risk_001",
                    "description": "Database performance with large task lists",
                    "severity": "medium",
                    "mitigation": "Implement pagination and indexing"
                }
            ],
            "next_steps": [
                "Set up project repository",
                "Create database schema",
                "Begin design mockups",
                "Set up development environment"
            ],
            "notes": "Consider adding task categories and priority levels in future iterations"
        }, indent=2)

    def _mock_designer_response(self, prompt: str) -> str:
        """Generate mock Designer agent response."""
        return json.dumps({
            "task_analysis": {
                "design_type": "mockup",
                "platform": "web",
                "complexity": "moderate",
                "estimated_hours": 6.0
            },
            "components": [
                {
                    "name": "TaskCard",
                    "type": "card",
                    "description": "Individual task display with title, description, due date",
                    "states": ["default", "hover", "completed", "overdue"],
                    "responsive": True
                },
                {
                    "name": "TaskList",
                    "type": "container",
                    "description": "Scrollable container for task cards with sorting",
                    "states": ["default", "loading", "empty"],
                    "responsive": True
                },
                {
                    "name": "AddTaskButton",
                    "type": "button",
                    "description": "Primary action button to create new task",
                    "states": ["default", "hover", "active", "disabled"],
                    "responsive": True
                }
            ],
            "design_system": {
                "colors": {
                    "primary": "#3B82F6",
                    "secondary": "#8B5CF6",
                    "accent": "#10B981",
                    "neutral": ["#F9FAFB", "#E5E7EB", "#6B7280", "#1F2937"],
                    "semantic": {
                        "success": "#10B981",
                        "error": "#EF4444",
                        "warning": "#F59E0B",
                        "info": "#3B82F6"
                    }
                },
                "typography": {
                    "font_families": {
                        "primary": "Inter",
                        "secondary": "Inter",
                        "monospace": "JetBrains Mono"
                    },
                    "scale": {
                        "h1": "32px / 1.2 / 700",
                        "h2": "24px / 1.3 / 600",
                        "body": "16px / 1.5 / 400",
                        "small": "14px / 1.5 / 400"
                    }
                },
                "spacing": {
                    "scale": [4, 8, 16, 24, 32, 48],
                    "unit": "px"
                },
                "layout": {
                    "max_width": "1200px",
                    "breakpoints": {
                        "mobile": "320px",
                        "tablet": "768px",
                        "desktop": "1024px"
                    }
                }
            },
            "deliverables": [
                {
                    "type": "mockup",
                    "description": "Task list view with filtering",
                    "format": "figma",
                    "priority": "high"
                },
                {
                    "type": "mockup",
                    "description": "Task creation form",
                    "format": "figma",
                    "priority": "high"
                },
                {
                    "type": "tokens",
                    "description": "Design tokens JSON",
                    "format": "json",
                    "priority": "medium"
                }
            ],
            "technical_considerations": [
                "Ensure responsive design for mobile devices",
                "Consider dark mode support",
                "Optimize for touch interactions"
            ],
            "accessibility": {
                "wcag_level": "AA",
                "key_requirements": [
                    "4.5:1 color contrast for text",
                    "Keyboard navigation support",
                    "Screen reader labels",
                    "Focus indicators"
                ]
            },
            "next_steps": [
                "Create wireframes for all views",
                "Design high-fidelity mockups",
                "Export design tokens",
                "Prepare component specifications"
            ]
        }, indent=2)

    def _mock_developer_response(self, prompt: str) -> str:
        """Generate mock Developer agent response."""
        return json.dumps({
            "task_summary": "Implement REST API for task management with CRUD operations",
            "task_analysis": {
                "task_type": "api_endpoint",
                "complexity": "moderate",
                "estimated_hours": 12.0,
                "requires_design": False
            },
            "technical_requirements": [
                {
                    "id": "tech_001",
                    "description": "RESTful API design following best practices",
                    "priority": "critical",
                    "category": "architecture"
                },
                {
                    "id": "tech_002",
                    "description": "Input validation for all endpoints",
                    "priority": "critical",
                    "category": "security"
                },
                {
                    "id": "tech_003",
                    "description": "Database migrations for task schema",
                    "priority": "high",
                    "category": "architecture"
                }
            ],
            "tech_stack": {
                "languages": ["Python 3.11+"],
                "frameworks": ["FastAPI", "Pydantic", "SQLAlchemy"],
                "databases": ["PostgreSQL"],
                "tools": ["Alembic", "pytest", "Docker"],
                "new_dependencies": ["fastapi", "sqlalchemy", "psycopg2-binary", "alembic"]
            },
            "implementation_steps": [
                {
                    "step_number": 1,
                    "title": "Create Task model",
                    "description": "Define SQLAlchemy Task model with fields: id, title, description, due_date, completed, created_at, updated_at",
                    "estimated_hours": 2.0,
                    "dependencies": [],
                    "code_changes": ["models/task.py"]
                },
                {
                    "step_number": 2,
                    "title": "Create Pydantic schemas",
                    "description": "Define TaskCreate, TaskUpdate, TaskResponse schemas for validation",
                    "estimated_hours": 1.5,
                    "dependencies": [1],
                    "code_changes": ["schemas/task.py"]
                },
                {
                    "step_number": 3,
                    "title": "Implement GET /tasks endpoint",
                    "description": "List all tasks with optional filtering and pagination",
                    "estimated_hours": 2.0,
                    "dependencies": [1, 2],
                    "code_changes": ["routes/tasks.py"]
                },
                {
                    "step_number": 4,
                    "title": "Implement POST /tasks endpoint",
                    "description": "Create new task with validation",
                    "estimated_hours": 2.0,
                    "dependencies": [2, 3],
                    "code_changes": ["routes/tasks.py"]
                },
                {
                    "step_number": 5,
                    "title": "Implement PUT /tasks/{id} endpoint",
                    "description": "Update existing task",
                    "estimated_hours": 1.5,
                    "dependencies": [4],
                    "code_changes": ["routes/tasks.py"]
                },
                {
                    "step_number": 6,
                    "title": "Implement DELETE /tasks/{id} endpoint",
                    "description": "Delete task by ID",
                    "estimated_hours": 1.0,
                    "dependencies": [5],
                    "code_changes": ["routes/tasks.py"]
                },
                {
                    "step_number": 7,
                    "title": "Write unit tests",
                    "description": "Test all CRUD operations and edge cases",
                    "estimated_hours": 2.0,
                    "dependencies": [6],
                    "code_changes": ["tests/test_tasks.py"]
                }
            ],
            "testing_strategy": {
                "unit_tests": [
                    "test_create_task",
                    "test_get_tasks",
                    "test_update_task",
                    "test_delete_task",
                    "test_task_validation"
                ],
                "integration_tests": [
                    "test_full_crud_flow",
                    "test_task_filtering",
                    "test_pagination"
                ],
                "test_coverage_target": 90,
                "testing_notes": "Focus on validation edge cases and error handling"
            },
            "security_considerations": [
                {
                    "id": "sec_001",
                    "category": "data_validation",
                    "description": "SQL injection via task fields",
                    "mitigation": "Use SQLAlchemy ORM with parameterized queries",
                    "severity": "critical"
                },
                {
                    "id": "sec_002",
                    "category": "api_security",
                    "description": "Unauthorized task access",
                    "mitigation": "Implement authentication and authorization (future)",
                    "severity": "high"
                }
            ],
            "performance_considerations": [
                {
                    "aspect": "Database queries",
                    "description": "Inefficient task listing with large datasets",
                    "recommendation": "Implement pagination and add indexes on frequently queried fields",
                    "impact": "high"
                },
                {
                    "aspect": "API response time",
                    "description": "Response serialization overhead",
                    "recommendation": "Use Pydantic response models efficiently",
                    "impact": "low"
                }
            ],
            "deployment_notes": [
                "Set DATABASE_URL environment variable",
                "Run Alembic migrations: alembic upgrade head",
                "Configure CORS for frontend domain",
                "Set up connection pooling for production"
            ],
            "next_steps": [
                "Set up database and run migrations",
                "Implement Task model and schemas",
                "Create API endpoints one by one",
                "Write comprehensive tests",
                "Update API documentation"
            ],
            "notes": "Consider adding user authentication in next iteration"
        }, indent=2)

    def _mock_pm_response(self, prompt: str) -> str:
        """
        Project Manager planning output.

        Mirrors the shape a real model would return: it splits one of the CEO's tasks, flags a
        dependency the CEO missed, and assigns every task to exactly one owner.
        """
        return json.dumps({
            "plan_summary": (
                "Design leads, development follows. The task list survives mostly intact, but the "
                "CRUD API is split so the schema lands before the endpoints, and the frontend list "
                "is blocked on the design mockup rather than running alongside it."
            ),
            "brief_adjustments": [
                {
                    "kind": "split",
                    "target": "Implement task CRUD API",
                    "reason": "Schema and endpoints have different risk profiles and different "
                              "people are blocked on each; one estimate would hide both.",
                },
                {
                    "kind": "reorder",
                    "target": "Implement frontend task list",
                    "reason": "It was scheduled in parallel with the mockup it depends on.",
                },
            ],
            "phases": [
                {
                    "phase_number": 1,
                    "name": "Shape and schema",
                    "goal": "The data model is agreed and the main screen is drawn.",
                    "task_ids": ["design_001", "dev_001"],
                    "blocked_by": [],
                },
                {
                    "phase_number": 2,
                    "name": "Build",
                    "goal": "Users can create and see their tasks end to end.",
                    "task_ids": ["design_002", "dev_002", "dev_003"],
                    "blocked_by": [1],
                },
            ],
            "tasks": [
                {
                    "task_id": "design_001",
                    "description": "Design the task list view: filtering, sorting and empty state",
                    "assigned_to": "designer",
                    "priority": 1,
                    "estimated_hours": 6.0,
                    "depends_on": [],
                },
                {
                    "task_id": "dev_001",
                    "description": "Define and migrate the task database schema",
                    "assigned_to": "developer",
                    "priority": 1,
                    "estimated_hours": 4.0,
                    "depends_on": [],
                },
                {
                    "task_id": "design_002",
                    "description": "Design the task creation and edit form, including validation states",
                    "assigned_to": "designer",
                    "priority": 2,
                    "estimated_hours": 5.0,
                    "depends_on": ["design_001"],
                },
                {
                    "task_id": "dev_002",
                    "description": "Build the REST endpoints for task CRUD on top of the schema",
                    "assigned_to": "developer",
                    "priority": 2,
                    "estimated_hours": 8.0,
                    "depends_on": ["dev_001"],
                },
                {
                    "task_id": "dev_003",
                    "description": "Build the React task list against the agreed mockup",
                    "assigned_to": "developer",
                    "priority": 3,
                    "estimated_hours": 7.0,
                    "depends_on": ["design_001", "dev_002"],
                },
            ],
            "risks": [
                {
                    "description": "Auth is assumed but no provider has been chosen",
                    "likelihood": "high",
                    "impact": "high",
                    "mitigation": "Pin the provider in phase 1 before the endpoints are written.",
                },
                {
                    "description": "Filtering requirements are described but not specified",
                    "likelihood": "medium",
                    "impact": "low",
                    "mitigation": "Ship status filtering only; treat the rest as a follow-up.",
                },
            ],
            "questions_for_ceo": [
                "Is a third-party auth provider acceptable, or does this need to be self-hosted?",
            ],
            "standup_brief": (
                "Two phases. Ash, you own the list view first, then the form - the form depends on "
                "the list layout being settled. Kai, schema before endpoints, and hold the React "
                "list until Ash's mockup lands. Auth provider is unresolved and it blocks the API, "
                "so flag it if you hit it."
            ),
            "notes": "Generated by the mock provider.",
        })

    def _mock_generic_response(self, prompt: str) -> str:
        """Generate generic mock response."""
        return json.dumps({
            "response": "This is a mock response",
            "prompt_received": prompt[:100] + "...",
            "mock": True
        }, indent=2)


# Global mock LLM provider instance
mock_llm_provider = MockLLMProvider()
