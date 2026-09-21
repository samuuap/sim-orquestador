"""Test script for CEO Agent."""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from agents.ceo import CEOAgent
from schemas import Task
from datetime import datetime


async def test_ceo_agent():
    """Test CEO agent initialization and basic functionality."""

    print("=" * 60)
    print("CEO Agent Test Suite")
    print("=" * 60)

    # Test 1: Agent initialization
    print("\n[TEST 1] CEO Agent Initialization")
    print("-" * 60)

    ceo = CEOAgent(websocket_manager=None)

    print(f"[OK] Agent ID: {ceo.agent_id}")
    print(f"[OK] Role: {ceo.role}")
    print(f"[OK] Initial State: {ceo.state.value}")
    print(f"[OK] System Prompt Loaded: {len(ceo.system_prompt)} characters")

    assert ceo.agent_id == "ceo_001", "CEO ID should be ceo_001"
    assert ceo.role == "ceo", "Role should be ceo"
    assert ceo.system_prompt, "System prompt should be loaded"

    print("[OK] Test 1 PASSED: CEO agent initialized correctly")

    # Test 2: Proposal parsing
    print("\n[TEST 2] Proposal Parsing Logic")
    print("-" * 60)

    sample_evaluation = """
## Proposal Evaluation: Dark Mode Feature

**Feasibility**: APPROVED

**Complexity**: MEDIUM

**Estimated Timeline**: 3-4 days

**Key Requirements**:
- Theme toggle UI component
- CSS variable-based theming
- User preference persistence

**Task Breakdown**:

### Design Phase (1 day)
1. Design toggle component - 2 hours
2. Define color palette - 3 hours

### Development Phase (2 days)
1. Implement theme context - 4 hours
2. Create CSS variables - 6 hours

**Dependencies & Risks**:
- Hardcoded colors may exist
- Third-party components compatibility

**Next Steps**:
- Start with design phase
- Prepare development environment
"""

    proposal = ceo._parse_evaluation("Add dark mode to the app", sample_evaluation)

    print(f"[OK] Title: {proposal.get('title')}")
    print(f"[OK] Feasibility: {proposal.get('feasibility')}")
    print(f"[OK] Complexity: {proposal.get('complexity')}")
    print(f"[OK] Timeline: {proposal.get('estimated_timeline')}")
    print(f"[OK] Requirements: {len(proposal.get('requirements', []))} items")
    print(f"[OK] Design Tasks: {len(proposal.get('design_tasks', []))} tasks")
    print(f"[OK] Dev Tasks: {len(proposal.get('development_tasks', []))} tasks")
    print(f"[OK] Risks: {len(proposal.get('risks', []))} items")

    assert proposal.get('feasibility') == "APPROVED", "Should parse feasibility"
    assert proposal.get('complexity') == "MEDIUM", "Should parse complexity"
    assert len(proposal.get('requirements', [])) == 3, "Should extract 3 requirements"
    assert len(proposal.get('design_tasks', [])) == 2, "Should extract 2 design tasks"
    assert len(proposal.get('development_tasks', [])) == 2, "Should extract 2 dev tasks"

    print("[OK] Test 2 PASSED: Proposal parsing works correctly")

    # Test 3: Task generation
    print("\n[TEST 3] Task Generation")
    print("-" * 60)

    ceo.current_proposal = proposal

    design_tasks = ceo._generate_design_tasks()
    dev_tasks = ceo._generate_dev_tasks()

    print(f"[OK] Generated {len(design_tasks)} design tasks")
    print(f"[OK] Generated {len(dev_tasks)} development tasks")

    if design_tasks:
        print(f"[OK] Sample Design Task: {design_tasks[0].description}")
        print(f"  - Task ID: {design_tasks[0].task_id}")
        print(f"  - Assigned to: {design_tasks[0].assigned_to}")
        print(f"  - Type: {design_tasks[0].task_type}")

    if dev_tasks:
        print(f"[OK] Sample Dev Task: {dev_tasks[0].description}")
        print(f"  - Task ID: {dev_tasks[0].task_id}")
        print(f"  - Assigned to: {dev_tasks[0].assigned_to}")
        print(f"  - Type: {dev_tasks[0].task_type}")

    assert len(design_tasks) == 2, "Should generate 2 design tasks"
    assert len(dev_tasks) == 2, "Should generate 2 dev tasks"
    assert all(t.task_type == "design" for t in design_tasks), "Design tasks should have correct type"
    assert all(t.task_type == "development" for t in dev_tasks), "Dev tasks should have correct type"

    print("[OK] Test 3 PASSED: Task generation works correctly")

    # Test 4: Task formatting
    print("\n[TEST 4] Task List Formatting")
    print("-" * 60)

    all_tasks = design_tasks + dev_tasks
    formatted = ceo._format_task_list(all_tasks)

    print("Task List Output:")
    print(formatted)

    assert "Design Tasks" in formatted, "Should include design section"
    assert "Development Tasks" in formatted, "Should include development section"

    print("[OK] Test 4 PASSED: Task formatting works correctly")

    # Test 5: Agent status
    print("\n[TEST 5] Agent Status")
    print("-" * 60)

    status = ceo.get_status()

    print(f"[OK] Agent ID: {status['agent_id']}")
    print(f"[OK] Role: {status['role']}")
    print(f"[OK] State: {status['state']}")
    print(f"[OK] Metrics:")
    print(f"  - Total tasks: {status['metrics']['total_tasks']}")
    print(f"  - Completed: {status['metrics']['completed_tasks']}")
    print(f"  - Failed: {status['metrics']['failed_tasks']}")

    assert status['agent_id'] == "ceo_001", "Status should show correct ID"
    assert status['role'] == "ceo", "Status should show correct role"

    print("[OK] Test 5 PASSED: Agent status reporting works")

    # Summary
    print("\n" + "=" * 60)
    print("[OK] ALL TESTS PASSED")
    print("=" * 60)
    print("\nCEO Agent is ready for integration!")
    print("\nNote: Full evaluation test requires LLM API key.")
    print("Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env to test live evaluation.")


if __name__ == "__main__":
    asyncio.run(test_ceo_agent())
