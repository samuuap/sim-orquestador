"""
Test suite for Agent Orchestrator.

Tests the LangGraph-based workflow orchestration.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from orchestrator import AgentOrchestrator
from agents.ceo import CEOAgent
from agents.designer import DesignerAgent
from agents.developer import DeveloperAgent
from agents.mock_llm_provider import mock_llm_provider


async def test_orchestrator():
    """Test complete orchestration workflow."""

    print("\n" + "=" * 70)
    print("ORCHESTRATOR TEST - LANGGRAPH WORKFLOW")
    print("=" * 70)
    print("\nInitializing agents and orchestrator...")

    # Initialize agents
    ceo = CEOAgent(agent_id="ceo_001", llm_provider=mock_llm_provider)
    designer = DesignerAgent(agent_id="designer_001", llm_provider=mock_llm_provider)
    developer = DeveloperAgent(agent_id="developer_001", llm_provider=mock_llm_provider)

    # Initialize orchestrator
    orchestrator = AgentOrchestrator(
        ceo_agent=ceo,
        designer_agent=designer,
        developer_agent=developer
    )

    print("[OK] CEO Agent initialized")
    print("[OK] Designer Agent initialized")
    print("[OK] Developer Agent initialized")
    print("[OK] Orchestrator initialized")

    # Test proposal
    proposal = """
    Build a user authentication system with the following features:
    - User registration with email and password
    - Login and logout functionality
    - Password reset via email
    - JWT token-based authentication
    - Role-based access control (admin, user)
    - Session management
    """

    print("\n" + "=" * 70)
    print("RUNNING ORCHESTRATION")
    print("=" * 70)
    print(f"\nProposal:\n{proposal}\n")
    print("Starting orchestration workflow...")
    print("This will execute: CEO Evaluate -> CEO Plan -> Designer Work -> Developer Work")
    print()

    # Run orchestration
    final_state = await orchestrator.orchestrate(proposal)

    # Print summary
    print("\n" + "=" * 70)
    print("ORCHESTRATION RESULTS")
    print("=" * 70)
    print()
    print(orchestrator.get_summary(final_state))

    # Detailed results
    print("\n" + "=" * 70)
    print("DETAILED RESULTS")
    print("=" * 70)

    # CEO Evaluation
    if final_state["ceo_evaluation"]:
        print("\n--- CEO EVALUATION ---")
        eval = final_state["ceo_evaluation"]
        print(f"Success: {eval.success}")
        if eval.success and eval.metadata:
            print(f"Project: {eval.metadata.get('project_title', 'N/A')}")
            print(f"Feasibility: {eval.metadata.get('feasibility', 'N/A')}")
            print(f"Complexity: {eval.metadata.get('complexity', 'N/A')}")
            print(f"Timeline: {eval.metadata.get('estimated_timeline', 'N/A')}")
            print(f"Requirements: {eval.metadata.get('requirement_count', 0)}")
            print(f"Design Tasks: {eval.metadata.get('design_task_count', 0)}")
            print(f"Dev Tasks: {eval.metadata.get('dev_task_count', 0)}")

    # CEO Plan
    if final_state["ceo_plan"]:
        print("\n--- CEO PLAN ---")
        plan = final_state["ceo_plan"]
        print(f"Success: {plan.success}")
        if plan.success and plan.metadata:
            print(f"Total Tasks: {plan.metadata.get('design_count', 0) + plan.metadata.get('dev_count', 0)}")

    # Design Results
    if final_state["design_results"]:
        print(f"\n--- DESIGN RESULTS ({len(final_state['design_results'])}) ---")
        for i, result in enumerate(final_state["design_results"], 1):
            print(f"\nDesign Task {i}:")
            print(f"  Success: {result.success}")
            if result.success and result.metadata:
                print(f"  Design Type: {result.metadata.get('design_type', 'N/A')}")
                print(f"  Platform: {result.metadata.get('platform', 'N/A')}")
                print(f"  Components: {result.metadata.get('component_count', 0)}")
                print(f"  Estimated Hours: {result.metadata.get('estimated_hours', 0)}")

    # Development Results
    if final_state["dev_results"]:
        print(f"\n--- DEVELOPMENT RESULTS ({len(final_state['dev_results'])}) ---")
        for i, result in enumerate(final_state["dev_results"], 1):
            print(f"\nDev Task {i}:")
            print(f"  Success: {result.success}")
            if result.success and result.metadata:
                print(f"  Task Type: {result.metadata.get('task_type', 'N/A')}")
                print(f"  Complexity: {result.metadata.get('complexity', 'N/A')}")
                print(f"  Implementation Steps: {result.metadata.get('implementation_steps', 0)}")
                print(f"  Security Items: {result.metadata.get('security_items', 0)}")

    # Metrics
    print("\n" + "=" * 70)
    print("AGENT METRICS")
    print("=" * 70)
    print(f"\nCEO Agent:")
    print(f"  Tasks Completed: {ceo.metrics.completed_tasks}")
    print(f"  Total Tokens: {ceo.metrics.total_tokens}")
    print(f"  Total Cost: ${ceo.metrics.total_cost:.4f}")

    print(f"\nDesigner Agent:")
    print(f"  Tasks Completed: {designer.metrics.completed_tasks}")
    print(f"  Total Tokens: {designer.metrics.total_tokens}")
    print(f"  Total Cost: ${designer.metrics.total_cost:.4f}")

    print(f"\nDeveloper Agent:")
    print(f"  Tasks Completed: {developer.metrics.completed_tasks}")
    print(f"  Total Tokens: {developer.metrics.total_tokens}")
    print(f"  Total Cost: ${developer.metrics.total_cost:.4f}")

    total_tokens = ceo.metrics.total_tokens + designer.metrics.total_tokens + developer.metrics.total_tokens
    total_cost = ceo.metrics.total_cost + designer.metrics.total_cost + developer.metrics.total_cost

    print(f"\nTotal:")
    print(f"  Total Tokens: {total_tokens}")
    print(f"  Total Cost: ${total_cost:.4f}")

    # Final status
    print("\n" + "=" * 70)
    if final_state["completed"] and not final_state["errors"]:
        print("[OK] ORCHESTRATION COMPLETED SUCCESSFULLY")
    elif final_state["completed"] and final_state["errors"]:
        print("[WARN] ORCHESTRATION COMPLETED WITH ERRORS")
    else:
        print("[FAIL] ORCHESTRATION FAILED")
    print("=" * 70)

    return final_state


async def main():
    """Main entry point."""
    print("\n" + "=" * 70)
    print("AGENT ORCHESTRATOR TEST SUITE")
    print("Using LangGraph for workflow coordination")
    print("=" * 70)

    try:
        await test_orchestrator()
        print("\n[OK] Test completed successfully\n")
    except Exception as e:
        print(f"\n[FAIL] Test failed: {e}\n")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
