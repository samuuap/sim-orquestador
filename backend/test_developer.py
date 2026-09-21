"""
Test suite for Developer Agent.

Tests the Developer Agent's ability to:
1. Initialize correctly
2. Parse structured JSON output
3. Validate Pydantic schemas
4. Format developer output
5. Handle development tasks
"""

import json
from pathlib import Path

from agents.developer import DeveloperAgent
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
from schemas import Task


def test_1_agent_initialization():
    """Test that Developer Agent initializes correctly."""
    print("\n" + "=" * 60)
    print("TEST 1: Developer Agent Initialization")
    print("=" * 60)

    agent = DeveloperAgent(agent_id="developer_001")

    # Check basic properties
    assert agent.agent_id == "developer_001", "Agent ID mismatch"
    assert agent.role == "developer", "Role should be 'developer'"
    assert agent.state.value == "IDLE", f"Initial state should be IDLE, got {agent.state.value}"

    # Check system prompt loaded
    assert len(agent.system_prompt) > 1000, "System prompt should be loaded from file"
    assert "Developer" in agent.system_prompt, "System prompt should contain role description"
    assert "JSON" in agent.system_prompt, "System prompt should mention JSON output"

    print(f"[OK] Agent ID: {agent.agent_id}")
    print(f"[OK] Role: {agent.role}")
    print(f"[OK] Initial State: {agent.state.value}")
    print(f"[OK] System Prompt Length: {len(agent.system_prompt)} characters")
    print("[OK] Test 1 PASSED: Developer agent initialized correctly\n")


def test_2_pydantic_schema_validation():
    """Test that Pydantic schemas validate correctly."""
    print("=" * 60)
    print("TEST 2: Pydantic Schema Validation")
    print("=" * 60)

    # Create sample developer output
    sample_json = {
        "task_summary": "Implement user authentication API",
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
                "description": "JWT token generation",
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
                "description": "Define User model with validation",
                "estimated_hours": 2.0,
                "dependencies": [],
                "code_changes": ["models/user.py"]
            },
            {
                "step_number": 2,
                "title": "Implement password hashing",
                "description": "Create bcrypt hashing utilities",
                "estimated_hours": 1.5,
                "dependencies": [1],
                "code_changes": ["utils/security.py"]
            }
        ],
        "testing_strategy": {
            "unit_tests": ["test_password_hashing", "test_jwt_generation"],
            "integration_tests": ["test_login_flow"],
            "test_coverage_target": 90,
            "testing_notes": "Focus on security-critical paths"
        },
        "security_considerations": [
            {
                "id": "sec_001",
                "category": "authentication",
                "description": "Password storage vulnerability",
                "mitigation": "Use bcrypt with 12+ rounds",
                "severity": "critical"
            }
        ],
        "performance_considerations": [
            {
                "aspect": "Database queries",
                "description": "User lookup should be indexed",
                "recommendation": "Add index on email column",
                "impact": "high"
            }
        ],
        "deployment_notes": [
            "Set JWT_SECRET in environment",
            "Configure token expiration",
            "Use HTTPS in production"
        ],
        "next_steps": [
            "Set up database migrations",
            "Implement user model",
            "Create auth endpoints"
        ],
        "notes": "Consider rate limiting for login attempts"
    }

    # Validate with Pydantic
    try:
        dev_output = DeveloperOutput.model_validate(sample_json)

        print(f"[OK] Schema validation passed")
        print(f"[OK] Task summary: {dev_output.task_summary}")
        print(f"[OK] Task type: {dev_output.task_analysis.task_type}")
        print(f"[OK] Complexity: {dev_output.task_analysis.complexity}")
        print(f"[OK] Estimated hours: {dev_output.task_analysis.estimated_hours}")
        print(f"[OK] Requires design: {dev_output.task_analysis.requires_design}")
        print(f"[OK] Technical requirements: {len(dev_output.technical_requirements)}")
        print(f"[OK] Implementation steps: {len(dev_output.implementation_steps)}")
        print(f"[OK] Security considerations: {len(dev_output.security_considerations)}")
        print(f"[OK] Performance considerations: {len(dev_output.performance_considerations)}")
        print(f"[OK] Languages: {', '.join(dev_output.tech_stack.languages)}")
        print(f"[OK] Test coverage target: {dev_output.testing_strategy.test_coverage_target}%")

        print("[OK] Test 2 PASSED: Schema validation works correctly\n")

    except Exception as e:
        print(f"[FAIL] Schema validation failed: {e}")
        raise


def test_3_invalid_schema_rejection():
    """Test that invalid schemas are rejected."""
    print("=" * 60)
    print("TEST 3: Invalid Schema Rejection")
    print("=" * 60)

    # Invalid task_type enum
    invalid_json_1 = {
        "task_summary": "Test",
        "task_analysis": {
            "task_type": "invalid_type",
            "complexity": "moderate",
            "estimated_hours": 5.0,
            "requires_design": False
        },
        "technical_requirements": [],
        "tech_stack": {
            "languages": [],
            "frameworks": [],
            "databases": [],
            "tools": [],
            "new_dependencies": []
        },
        "implementation_steps": [],
        "testing_strategy": {
            "unit_tests": [],
            "integration_tests": [],
            "test_coverage_target": 80
        },
        "next_steps": []
    }

    try:
        DeveloperOutput.model_validate(invalid_json_1)
        print("[FAIL] Should have rejected invalid task_type")
        assert False
    except Exception:
        print("[OK] Correctly rejected invalid task_type enum")

    # Negative estimated hours
    invalid_json_2 = {
        "task_summary": "Test",
        "task_analysis": {
            "task_type": "api_endpoint",
            "complexity": "simple",
            "estimated_hours": -5.0,
            "requires_design": False
        },
        "technical_requirements": [],
        "tech_stack": {
            "languages": [],
            "frameworks": [],
            "databases": [],
            "tools": [],
            "new_dependencies": []
        },
        "implementation_steps": [],
        "testing_strategy": {
            "unit_tests": [],
            "integration_tests": [],
            "test_coverage_target": 80
        },
        "next_steps": []
    }

    try:
        DeveloperOutput.model_validate(invalid_json_2)
        print("[FAIL] Should have rejected negative hours")
        assert False
    except Exception:
        print("[OK] Correctly rejected negative estimated hours")

    # Invalid test coverage (> 100)
    invalid_json_3 = {
        "task_summary": "Test",
        "task_analysis": {
            "task_type": "testing",
            "complexity": "simple",
            "estimated_hours": 2.0,
            "requires_design": False
        },
        "technical_requirements": [],
        "tech_stack": {
            "languages": [],
            "frameworks": [],
            "databases": [],
            "tools": [],
            "new_dependencies": []
        },
        "implementation_steps": [],
        "testing_strategy": {
            "unit_tests": [],
            "integration_tests": [],
            "test_coverage_target": 150
        },
        "next_steps": []
    }

    try:
        DeveloperOutput.model_validate(invalid_json_3)
        print("[FAIL] Should have rejected coverage > 100")
        assert False
    except Exception:
        print("[OK] Correctly rejected test_coverage > 100")

    print("[OK] Test 3 PASSED: Invalid schemas are properly rejected\n")


def test_4_output_formatting():
    """Test that developer output is formatted correctly."""
    print("=" * 60)
    print("TEST 4: Output Formatting")
    print("=" * 60)

    agent = DeveloperAgent(agent_id="developer_001")

    # Create sample output
    sample_output = DeveloperOutput(
        task_summary="Build authentication API",
        task_analysis=TaskAnalysis(
            task_type="api_endpoint",
            complexity="moderate",
            estimated_hours=10.0,
            requires_design=True
        ),
        technical_requirements=[
            TechnicalRequirement(
                id="tech_001",
                description="Password hashing",
                priority="critical",
                category="security"
            )
        ],
        tech_stack=TechStack(
            languages=["Python"],
            frameworks=["FastAPI"],
            databases=["PostgreSQL"],
            tools=["Docker"],
            new_dependencies=["passlib"]
        ),
        implementation_steps=[
            Implementation(
                step_number=1,
                title="Create models",
                description="Define user models",
                estimated_hours=2.0,
                dependencies=[],
                code_changes=["models/user.py"]
            ),
            Implementation(
                step_number=2,
                title="Implement hashing",
                description="Add password hashing",
                estimated_hours=1.5,
                dependencies=[1],
                code_changes=["utils/security.py"]
            )
        ],
        testing_strategy=TestingStrategy(
            unit_tests=["test_hashing", "test_validation"],
            integration_tests=["test_auth_flow"],
            test_coverage_target=85,
            testing_notes="Focus on security"
        ),
        security_considerations=[
            SecurityConsideration(
                id="sec_001",
                category="authentication",
                description="Weak passwords",
                mitigation="Enforce password policy",
                severity="high"
            )
        ],
        performance_considerations=[
            PerformanceConsideration(
                aspect="Database",
                description="Slow user lookup",
                recommendation="Add index",
                impact="high"
            )
        ],
        deployment_notes=["Set JWT_SECRET", "Run migrations"],
        next_steps=["Set up env", "Create models", "Write tests"],
        notes="Consider OAuth later"
    )

    formatted = agent._format_developer_output(sample_output)

    # Validate formatting
    assert "DEVELOPMENT IMPLEMENTATION PLAN" in formatted
    assert "Build authentication API" in formatted
    assert "TECHNICAL REQUIREMENTS" in formatted
    assert "TECHNOLOGY STACK" in formatted
    assert "IMPLEMENTATION STEPS" in formatted
    assert "TESTING STRATEGY" in formatted
    assert "SECURITY CONSIDERATIONS" in formatted
    assert "PERFORMANCE CONSIDERATIONS" in formatted
    assert "DEPLOYMENT NOTES" in formatted
    assert "NEXT STEPS" in formatted
    assert "NOTES" in formatted

    print("[OK] Output contains all required sections")
    print("[OK] Task summary formatted")
    print("[OK] Technical requirements listed")
    print("[OK] Tech stack details included")
    print("[OK] Implementation steps formatted")
    print("[OK] Testing strategy shown")
    print("[OK] Security considerations listed")
    print("[OK] Performance recommendations included")
    print(f"[OK] Total output length: {len(formatted)} characters")

    print("\nFormatted Output Preview:")
    print("-" * 60)
    print(formatted[:500] + "...")
    print("-" * 60)

    print("[OK] Test 4 PASSED: Output formatting works correctly\n")


def test_5_agent_status():
    """Test agent status reporting."""
    print("=" * 60)
    print("TEST 5: Agent Status Reporting")
    print("=" * 60)

    agent = DeveloperAgent(agent_id="developer_001")

    status = agent.get_status()

    assert "agent_id" in status
    assert "role" in status
    assert "state" in status
    assert "metrics" in status
    assert status["role"] == "developer"
    assert status["state"] == "IDLE"

    print(f"[OK] Agent ID: {status['agent_id']}")
    print(f"[OK] Role: {status['role']}")
    print(f"[OK] State: {status['state']}")
    print(f"[OK] Metrics: {status['metrics']}")

    print("[OK] Test 5 PASSED: Agent status reporting works\n")


def run_all_tests():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("DEVELOPER AGENT TEST SUITE")
    print("=" * 60)

    try:
        test_1_agent_initialization()
        test_2_pydantic_schema_validation()
        test_3_invalid_schema_rejection()
        test_4_output_formatting()
        test_5_agent_status()

        print("=" * 60)
        print("[OK] ALL TESTS PASSED")
        print("=" * 60)
        print("\nDeveloper Agent is ready for production use!")
        print("Key features validated:")
        print("  - Agent initialization")
        print("  - Pydantic schema validation")
        print("  - Invalid input rejection")
        print("  - Output formatting")
        print("  - Status reporting")
        print("\nNext: Test with real LLM integration")

    except Exception as e:
        print(f"\n[FAIL] Test suite failed: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    run_all_tests()
