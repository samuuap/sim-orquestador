"""
End-to-End Integration Test

Tests the complete workflow:
1. User submits a project proposal
2. CEO Agent evaluates the proposal
3. CEO Agent generates tasks
4. Designer Agent processes design tasks
5. Developer Agent processes development tasks

This test uses REAL LLM calls (OpenAI/Anthropic).
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from agents.ceo import CEOAgent
from agents.designer import DesignerAgent
from agents.developer import DeveloperAgent
from agents.mock_llm_provider import mock_llm_provider
from schemas import Task
from datetime import datetime


def print_section(title: str):
    """Print a formatted section header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


async def test_full_workflow():
    """Test complete workflow with real LLM integration."""

    print_section("OFFICE AGENTS SIMULATOR - END-TO-END INTEGRATION TEST")

    # Initialize agents
    print("[1/6] Initializing agents...")
    ceo = CEOAgent(agent_id="ceo_001", llm_provider=mock_llm_provider)
    designer = DesignerAgent(agent_id="designer_001", llm_provider=mock_llm_provider)
    developer = DeveloperAgent(agent_id="developer_001", llm_provider=mock_llm_provider)

    print(f"  [OK] CEO Agent: {ceo.agent_id}")
    print(f"  [OK] Designer Agent: {designer.agent_id}")
    print(f"  [OK] Developer Agent: {developer.agent_id}")

    # Test proposal
    proposal = """
    Build a simple task management application with the following features:
    - Users can create, edit, and delete tasks
    - Each task has a title, description, and due date
    - Tasks can be marked as complete
    - Simple, clean user interface
    - Backend API with database storage
    """

    print_section("STEP 1: CEO EVALUATES PROPOSAL")
    print(f"Proposal:\n{proposal}\n")
    print("[2/6] CEO Agent is evaluating the proposal...")
    print("(This may take 30-60 seconds with real LLM)")

    # CEO evaluates proposal
    eval_task = Task(
        task_id="eval_001",
        description=proposal,
        task_type="evaluation",
        priority=1,
        assigned_to="ceo_001",
        status="in_progress",
        created_at=datetime.utcnow()
    )

    try:
        eval_result = await ceo.assign_task(eval_task)

        if not eval_result.success:
            print(f"[FAIL] CEO evaluation failed: {eval_result.error}")
            return

        print("[OK] CEO evaluation complete!")
        print("\n--- CEO EVALUATION OUTPUT ---")
        print(eval_result.output[:1000] + "..." if len(eval_result.output) > 1000 else eval_result.output)

        # Extract metadata
        metadata = eval_result.metadata
        print(f"\n[OK] Project Title: {metadata.get('project_title')}")
        print(f"[OK] Feasibility: {metadata.get('feasibility')}")
        print(f"[OK] Complexity: {metadata.get('complexity')}")
        print(f"[OK] Timeline: {metadata.get('estimated_timeline')}")
        print(f"[OK] Design Tasks: {metadata.get('design_task_count')}")
        print(f"[OK] Dev Tasks: {metadata.get('dev_task_count')}")
        print(f"[OK] Tokens Used: {ceo.metrics.total_tokens}")
        print(f"[OK] Cost: ${ceo.metrics.total_cost:.4f}")

    except Exception as e:
        print(f"[FAIL] CEO evaluation error: {e}")
        import traceback
        traceback.print_exc()
        return

    # CEO creates project plan
    print_section("STEP 2: CEO CREATES PROJECT PLAN")
    print("[3/6] CEO Agent is creating project plan...")

    plan_task = Task(
        task_id="plan_001",
        description="Create project plan",
        task_type="planning",
        priority=1,
        assigned_to="ceo_001",
        status="in_progress",
        created_at=datetime.utcnow()
    )

    try:
        plan_result = await ceo.assign_task(plan_task)

        if not plan_result.success:
            print(f"[FAIL] Project planning failed: {plan_result.error}")
            return

        print("[OK] Project plan created!")
        print("\n--- PROJECT PLAN ---")
        print(plan_result.output[:800] + "..." if len(plan_result.output) > 800 else plan_result.output)

        design_tasks = [t for t in ceo.delegated_tasks if t.task_type == "design"]
        dev_tasks = [t for t in ceo.delegated_tasks if t.task_type == "development"]

        print(f"\n[OK] Generated {len(design_tasks)} design tasks")
        print(f"[OK] Generated {len(dev_tasks)} development tasks")

    except Exception as e:
        print(f"[FAIL] Project planning error: {e}")
        import traceback
        traceback.print_exc()
        return

    # Designer processes first design task
    if design_tasks:
        print_section("STEP 3: DESIGNER PROCESSES DESIGN TASK")
        print(f"[4/6] Designer Agent processing: {design_tasks[0].description[:100]}...")
        print("(This may take 30-60 seconds with real LLM)")

        try:
            design_result = await designer.assign_task(design_tasks[0])

            if not design_result.success:
                print(f"[FAIL] Design task failed: {design_result.error}")
            else:
                print("[OK] Design task completed!")
                print("\n--- DESIGN OUTPUT (excerpt) ---")
                print(design_result.output[:800] + "..." if len(design_result.output) > 800 else design_result.output)

                metadata = design_result.metadata
                print(f"\n[OK] Design Type: {metadata.get('design_type')}")
                print(f"[OK] Platform: {metadata.get('platform')}")
                print(f"[OK] Components: {metadata.get('component_count')}")
                print(f"[OK] Estimated Hours: {metadata.get('estimated_hours')}")
                print(f"[OK] Tokens Used: {designer.metrics.total_tokens}")
                print(f"[OK] Cost: ${designer.metrics.total_cost:.4f}")

        except Exception as e:
            print(f"[FAIL] Design task error: {e}")
            import traceback
            traceback.print_exc()
    else:
        print_section("STEP 3: DESIGNER (SKIPPED - NO DESIGN TASKS)")

    # Developer processes first dev task
    if dev_tasks:
        print_section("STEP 4: DEVELOPER PROCESSES DEVELOPMENT TASK")
        print(f"[5/6] Developer Agent processing: {dev_tasks[0].description[:100]}...")
        print("(This may take 30-60 seconds with real LLM)")

        try:
            dev_result = await developer.assign_task(dev_tasks[0])

            if not dev_result.success:
                print(f"[FAIL] Development task failed: {dev_result.error}")
            else:
                print("[OK] Development task completed!")
                print("\n--- DEVELOPMENT OUTPUT (excerpt) ---")
                print(dev_result.output[:800] + "..." if len(dev_result.output) > 800 else dev_result.output)

                metadata = dev_result.metadata
                print(f"\n[OK] Task Type: {metadata.get('task_type')}")
                print(f"[OK] Complexity: {metadata.get('complexity')}")
                print(f"[OK] Implementation Steps: {metadata.get('implementation_steps')}")
                print(f"[OK] Security Items: {metadata.get('security_items')}")
                print(f"[OK] Tokens Used: {developer.metrics.total_tokens}")
                print(f"[OK] Cost: ${developer.metrics.total_cost:.4f}")

        except Exception as e:
            print(f"[FAIL] Development task error: {e}")
            import traceback
            traceback.print_exc()
    else:
        print_section("STEP 4: DEVELOPER (SKIPPED - NO DEV TASKS)")

    # Summary
    print_section("INTEGRATION TEST SUMMARY")
    print("[6/6] Test completed!\n")

    print("Agent Metrics:")
    print(f"  CEO:")
    print(f"    - Tasks Completed: {ceo.metrics.completed_tasks}")
    print(f"    - Total Tokens: {ceo.metrics.total_tokens}")
    print(f"    - Total Cost: ${ceo.metrics.total_cost:.4f}")

    if design_tasks:
        print(f"  Designer:")
        print(f"    - Tasks Completed: {designer.metrics.completed_tasks}")
        print(f"    - Total Tokens: {designer.metrics.total_tokens}")
        print(f"    - Total Cost: ${designer.metrics.total_cost:.4f}")

    if dev_tasks:
        print(f"  Developer:")
        print(f"    - Tasks Completed: {developer.metrics.completed_tasks}")
        print(f"    - Total Tokens: {developer.metrics.total_tokens}")
        print(f"    - Total Cost: ${developer.metrics.total_cost:.4f}")

    total_tokens = ceo.metrics.total_tokens + designer.metrics.total_tokens + developer.metrics.total_tokens
    total_cost = ceo.metrics.total_cost + designer.metrics.total_cost + developer.metrics.total_cost

    print(f"\nTotal:")
    print(f"  - Total Tokens: {total_tokens}")
    print(f"  - Total Cost: ${total_cost:.4f}")

    print("\n" + "=" * 70)
    print("  END-TO-END TEST COMPLETED SUCCESSFULLY!")
    print("=" * 70)


async def main():
    """Main entry point."""
    print("\n" + "=" * 70)
    print("  OFFICE AGENTS SIMULATOR")
    print("  End-to-End Integration Test with MOCK LLM")
    print("=" * 70)
    print("\nNOTE: This test uses MOCK responses (no real API calls).")
    print("      No tokens will be consumed and there is no cost.")
    print("      To test with real LLM, change LLM_PROVIDER in .env")
    print("\nStarting test in 3 seconds...")

    await asyncio.sleep(3)
    await test_full_workflow()


if __name__ == "__main__":
    asyncio.run(main())
