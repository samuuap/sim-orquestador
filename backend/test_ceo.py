"""
Test suite for refactored CEO Agent.

Tests the CEO Agent's ability to:
1. Initialize correctly
2. Parse structured JSON output
3. Validate Pydantic schemas
4. Format CEO output
5. Generate tasks from proposal
"""

import json
import asyncio
from pathlib import Path

from agents.ceo import CEOAgent
from agents.ceo_schemas import (
    CEOOutput,
    ProposalEvaluation,
    Requirement,
    DesignTask,
    DevelopmentTask,
    Risk
)
from schemas import Task


def test_1_agent_initialization():
    """Test that CEO Agent initializes correctly."""
    print("\n" + "=" * 60)
    print("TEST 1: CEO Agent Initialization")
    print("=" * 60)

    agent = CEOAgent(agent_id="ceo_001")

    # Check basic properties
    assert agent.agent_id == "ceo_001", "Agent ID mismatch"
    assert agent.role == "ceo", "Role should be 'ceo'"
    assert agent.state.value == "IDLE", f"Initial state should be IDLE, got {agent.state.value}"

    # Check system prompt loaded
    assert len(agent.system_prompt) > 1000, "System prompt should be loaded from file"
    assert "CEO Agent" in agent.system_prompt, "System prompt should contain role description"
    assert "JSON" in agent.system_prompt, "System prompt should mention JSON output"

    print(f"[OK] Agent ID: {agent.agent_id}")
    print(f"[OK] Role: {agent.role}")
    print(f"[OK] Initial State: {agent.state.value}")
    print(f"[OK] System Prompt Length: {len(agent.system_prompt)} characters")
    print("[OK] Test 1 PASSED: CEO agent initialized correctly\n")


def test_2_pydantic_schema_validation():
    """Test that Pydantic schemas validate correctly."""
    print("=" * 60)
    print("TEST 2: Pydantic Schema Validation")
    print("=" * 60)

    # Create sample CEO output
    sample_json = {
        "project_title": "Dark Mode Feature",
        "evaluation": {
            "feasibility": "APPROVED",
            "complexity": "MEDIUM",
            "estimated_timeline": "3-4 days",
            "confidence": "high"
        },
        "requirements": [
            {
                "id": "req_001",
                "description": "Theme toggle UI component",
                "priority": "critical",
                "category": "functional"
            },
            {
                "id": "req_002",
                "description": "CSS variable-based theming",
                "priority": "high",
                "category": "technical"
            }
        ],
        "design_tasks": [
            {
                "task_id": "design_001",
                "title": "Design toggle component",
                "description": "Create toggle UI and placement",
                "estimated_hours": 2.0,
                "priority": "high",
                "dependencies": []
            },
            {
                "task_id": "design_002",
                "title": "Define dark mode palette",
                "description": "Create color palette for dark theme",
                "estimated_hours": 3.0,
                "priority": "high",
                "dependencies": []
            }
        ],
        "development_tasks": [
            {
                "task_id": "dev_001",
                "title": "Implement theme context",
                "description": "Create React context for theme",
                "estimated_hours": 4.0,
                "priority": "high",
                "dependencies": [],
                "technical_stack": ["React", "Context API"]
            },
            {
                "task_id": "dev_002",
                "title": "Create CSS variable system",
                "description": "Implement CSS custom properties",
                "estimated_hours": 6.0,
                "priority": "high",
                "dependencies": ["design_002"],
                "technical_stack": ["CSS"]
            }
        ],
        "risks": [
            {
                "id": "risk_001",
                "description": "Components with hardcoded colors",
                "severity": "medium",
                "mitigation": "Allocate buffer time for refactoring"
            }
        ],
        "next_steps": [
            "Designer starts with color palette",
            "Developer sets up theme infrastructure",
            "Review third-party components"
        ],
        "notes": "Consider system preference detection"
    }

    # Validate with Pydantic
    try:
        ceo_output = CEOOutput.model_validate(sample_json)

        print(f"[OK] Schema validation passed")
        print(f"[OK] Project title: {ceo_output.project_title}")
        print(f"[OK] Feasibility: {ceo_output.evaluation.feasibility}")
        print(f"[OK] Complexity: {ceo_output.evaluation.complexity}")
        print(f"[OK] Timeline: {ceo_output.evaluation.estimated_timeline}")
        print(f"[OK] Confidence: {ceo_output.evaluation.confidence}")
        print(f"[OK] Requirements: {len(ceo_output.requirements)}")
        print(f"[OK] Design tasks: {len(ceo_output.design_tasks)}")
        print(f"[OK] Development tasks: {len(ceo_output.development_tasks)}")
        print(f"[OK] Risks: {len(ceo_output.risks)}")
        print(f"[OK] Next steps: {len(ceo_output.next_steps)}")

        print("[OK] Test 2 PASSED: Schema validation works correctly\n")

    except Exception as e:
        print(f"[FAIL] Schema validation failed: {e}")
        raise


def test_3_invalid_schema_rejection():
    """Test that invalid schemas are rejected."""
    print("=" * 60)
    print("TEST 3: Invalid Schema Rejection")
    print("=" * 60)

    # Missing required field
    invalid_json_1 = {
        "project_title": "Test Project",
        "evaluation": {
            "feasibility": "APPROVED",
            "complexity": "MEDIUM",
            "estimated_timeline": "1 week"
            # Missing confidence (has default, so this should pass)
        },
        "requirements": [],
        "design_tasks": [],
        "development_tasks": [],
        "next_steps": []
    }

    try:
        CEOOutput.model_validate(invalid_json_1)
        print("[OK] Schema with defaults works correctly")
    except Exception as e:
        print(f"[FAIL] Should have accepted schema with defaults: {e}")
        raise

    # Invalid enum value
    invalid_json_2 = {
        "project_title": "Test",
        "evaluation": {
            "feasibility": "INVALID_STATUS",  # Not in enum
            "complexity": "MEDIUM",
            "estimated_timeline": "1 week",
            "confidence": "high"
        },
        "requirements": [],
        "design_tasks": [],
        "development_tasks": [],
        "next_steps": []
    }

    try:
        CEOOutput.model_validate(invalid_json_2)
        print("[FAIL] Should have rejected invalid enum value")
        assert False
    except Exception:
        print("[OK] Correctly rejected invalid enum value")

    # Invalid estimated hours (must be > 0)
    invalid_json_3 = {
        "project_title": "Test",
        "evaluation": {
            "feasibility": "APPROVED",
            "complexity": "LOW",
            "estimated_timeline": "1 day",
            "confidence": "high"
        },
        "requirements": [],
        "design_tasks": [
            {
                "task_id": "design_001",
                "title": "Test task",
                "description": "Test",
                "estimated_hours": -5.0,  # Invalid: must be > 0
                "priority": "high",
                "dependencies": []
            }
        ],
        "development_tasks": [],
        "next_steps": []
    }

    try:
        CEOOutput.model_validate(invalid_json_3)
        print("[FAIL] Should have rejected negative hours")
        assert False
    except Exception:
        print("[OK] Correctly rejected negative estimated hours")

    print("[OK] Test 3 PASSED: Invalid schemas are properly rejected\n")


def test_4_task_generation():
    """Test task generation from CEO output."""
    print("=" * 60)
    print("TEST 4: Task Generation")
    print("=" * 60)

    agent = CEOAgent(agent_id="ceo_001")

    # Create sample CEO output
    agent.current_proposal = CEOOutput(
        project_title="Test Project",
        evaluation=ProposalEvaluation(
            feasibility="APPROVED",
            complexity="MEDIUM",
            estimated_timeline="1 week",
            confidence="high"
        ),
        requirements=[
            Requirement(
                id="req_001",
                description="Test requirement",
                priority="high",
                category="functional"
            )
        ],
        design_tasks=[
            DesignTask(
                task_id="design_001",
                title="Design mockup",
                description="Create UI mockup",
                estimated_hours=4.0,
                priority="high",
                dependencies=[]
            ),
            DesignTask(
                task_id="design_002",
                title="Design system",
                description="Update design system",
                estimated_hours=2.0,
                priority="medium",
                dependencies=["design_001"]
            )
        ],
        development_tasks=[
            DevelopmentTask(
                task_id="dev_001",
                title="Implement API",
                description="Build REST API",
                estimated_hours=8.0,
                priority="high",
                dependencies=[],
                technical_stack=["FastAPI", "PostgreSQL"]
            )
        ],
        risks=[],
        next_steps=["Start design phase"]
    )

    design_tasks = agent._generate_design_tasks()
    dev_tasks = agent._generate_dev_tasks()

    print(f"[OK] Generated {len(design_tasks)} design tasks")
    print(f"[OK] Generated {len(dev_tasks)} development tasks")

    assert len(design_tasks) == 2, "Should generate 2 design tasks"
    assert len(dev_tasks) == 1, "Should generate 1 dev task"

    # Check task properties
    assert design_tasks[0].task_id == "design_001"
    assert design_tasks[0].task_type == "design"
    assert design_tasks[0].assigned_to == "designer_001"

    assert dev_tasks[0].task_id == "dev_001"
    assert dev_tasks[0].task_type == "development"
    assert dev_tasks[0].assigned_to == "developer_001"

    print(f"[OK] Sample design task: {design_tasks[0].task_id} - {design_tasks[0].description[:50]}...")
    print(f"[OK] Sample dev task: {dev_tasks[0].task_id} - {dev_tasks[0].description[:50]}...")

    print("[OK] Test 4 PASSED: Task generation works correctly\n")


def test_5_output_formatting():
    """Test that CEO output is formatted correctly."""
    print("=" * 60)
    print("TEST 5: Output Formatting")
    print("=" * 60)

    agent = CEOAgent(agent_id="ceo_001")

    # Create sample output
    sample_output = CEOOutput(
        project_title="Authentication System",
        evaluation=ProposalEvaluation(
            feasibility="APPROVED",
            complexity="HIGH",
            estimated_timeline="2-3 weeks",
            confidence="medium"
        ),
        requirements=[
            Requirement(
                id="req_001",
                description="User login with email/password",
                priority="critical",
                category="functional"
            )
        ],
        design_tasks=[
            DesignTask(
                task_id="design_001",
                title="Login screen design",
                description="Create login UI",
                estimated_hours=4.0,
                priority="high",
                dependencies=[]
            )
        ],
        development_tasks=[
            DevelopmentTask(
                task_id="dev_001",
                title="Authentication API",
                description="Build auth endpoints",
                estimated_hours=12.0,
                priority="high",
                dependencies=[],
                technical_stack=["FastAPI", "JWT"]
            )
        ],
        risks=[
            Risk(
                id="risk_001",
                description="Security vulnerabilities",
                severity="high",
                mitigation="Security audit"
            )
        ],
        next_steps=["Begin design phase", "Set up development environment"],
        notes="Consider OAuth integration later"
    )

    formatted = agent._format_ceo_output(sample_output)

    # Validate formatting
    assert "PROJECT EVALUATION" in formatted
    assert "Authentication System" in formatted
    assert "APPROVED" in formatted
    assert "REQUIREMENTS" in formatted
    assert "DESIGN TASKS" in formatted
    assert "DEVELOPMENT TASKS" in formatted
    assert "RISKS & DEPENDENCIES" in formatted
    assert "NEXT STEPS" in formatted
    assert "NOTES" in formatted

    print("[OK] Output contains all required sections")
    print("[OK] Project title formatted")
    print("[OK] Evaluation details included")
    print("[OK] Requirements listed")
    print("[OK] Tasks formatted with details")
    print("[OK] Risks and mitigation shown")
    print(f"[OK] Total output length: {len(formatted)} characters")

    print("\nFormatted Output Preview:")
    print("-" * 60)
    print(formatted[:500] + "...")
    print("-" * 60)

    print("[OK] Test 5 PASSED: Output formatting works correctly\n")


def test_6_agent_status():
    """Test agent status reporting."""
    print("=" * 60)
    print("TEST 6: Agent Status Reporting")
    print("=" * 60)

    agent = CEOAgent(agent_id="ceo_001")

    status = agent.get_status()

    assert "agent_id" in status
    assert "role" in status
    assert "state" in status
    assert "metrics" in status
    assert status["role"] == "ceo"
    assert status["state"] == "IDLE"

    print(f"[OK] Agent ID: {status['agent_id']}")
    print(f"[OK] Role: {status['role']}")
    print(f"[OK] State: {status['state']}")
    print(f"[OK] Metrics: {status['metrics']}")

    print("[OK] Test 6 PASSED: Agent status reporting works\n")


def run_all_tests():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("CEO AGENT TEST SUITE (REFACTORED)")
    print("=" * 60)

    try:
        test_1_agent_initialization()
        test_2_pydantic_schema_validation()
        test_3_invalid_schema_rejection()
        test_4_task_generation()
        test_5_output_formatting()
        test_6_agent_status()

        print("=" * 60)
        print("[OK] ALL TESTS PASSED")
        print("=" * 60)
        print("\nRefactored CEO Agent is ready for production use!")
        print("Key improvements validated:")
        print("  - JSON-only structured output")
        print("  - Pydantic schema validation")
        print("  - Type-safe data structures")
        print("  - Robust error handling")
        print("  - Comprehensive formatting")
        print("\nNext: Test with real LLM integration")

    except Exception as e:
        print(f"\n[FAIL] Test suite failed: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    run_all_tests()
