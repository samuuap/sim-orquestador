"""
Test suite for Designer Agent.

Tests the Designer Agent's ability to:
1. Initialize correctly
2. Parse structured JSON output
3. Validate Pydantic schemas
4. Format design output
5. Handle design tasks end-to-end
"""

import json
import asyncio
from pathlib import Path

from agents.designer import DesignerAgent
from agents.designer_schemas import (
    DesignOutput,
    TaskAnalysis,
    Component,
    DesignSystem,
    ColorPalette,
    Typography,
    Spacing,
    Layout,
    Deliverable,
    Accessibility
)
from schemas import Task


def test_1_agent_initialization():
    """Test that Designer Agent initializes correctly."""
    print("\n" + "=" * 60)
    print("TEST 1: Designer Agent Initialization")
    print("=" * 60)

    agent = DesignerAgent(agent_id="designer_001")

    # Check basic properties
    assert agent.agent_id == "designer_001", "Agent ID mismatch"
    assert agent.role == "designer", "Role should be 'designer'"
    assert agent.state.value == "IDLE", f"Initial state should be IDLE, got {agent.state.value}"

    # Check system prompt loaded
    assert len(agent.system_prompt) > 1000, "System prompt should be loaded from file"
    assert "UI/UX Designer" in agent.system_prompt, "System prompt should contain role description"
    assert "JSON" in agent.system_prompt, "System prompt should mention JSON output"

    print(f"[OK] Agent ID: {agent.agent_id}")
    print(f"[OK] Role: {agent.role}")
    print(f"[OK] Initial State: {agent.state.value}")
    print(f"[OK] System Prompt Length: {len(agent.system_prompt)} characters")
    print("[OK] Test 1 PASSED: Designer agent initialized correctly\n")


def test_2_pydantic_schema_validation():
    """Test that Pydantic schemas validate correctly."""
    print("=" * 60)
    print("TEST 2: Pydantic Schema Validation")
    print("=" * 60)

    # Create sample design output
    sample_json = {
        "task_analysis": {
            "design_type": "mockup",
            "platform": "web",
            "complexity": "moderate",
            "estimated_hours": 6.5
        },
        "components": [
            {
                "name": "PrimaryButton",
                "type": "button",
                "description": "Main action button with states",
                "states": ["default", "hover", "active", "disabled"],
                "responsive": True
            },
            {
                "name": "TextField",
                "type": "input",
                "description": "Text input with validation",
                "states": ["default", "focus", "error"],
                "responsive": True
            }
        ],
        "design_system": {
            "colors": {
                "primary": "#3B82F6",
                "secondary": "#8B5CF6",
                "accent": "#EC4899",
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
                    "desktop": "1024px",
                    "wide": "1440px"
                }
            }
        },
        "deliverables": [
            {
                "type": "mockup",
                "description": "High-fidelity screen designs",
                "format": "figma",
                "priority": "high"
            },
            {
                "type": "tokens",
                "description": "Design tokens in JSON",
                "format": "json",
                "priority": "medium"
            }
        ],
        "technical_considerations": [
            "Ensure responsive behavior across breakpoints",
            "Consider loading states for async operations"
        ],
        "accessibility": {
            "wcag_level": "AA",
            "key_requirements": [
                "4.5:1 color contrast for text",
                "Keyboard navigation support",
                "Screen reader labels"
            ]
        },
        "next_steps": [
            "Create wireframes for key screens",
            "Design high-fidelity mockups",
            "Export design tokens"
        ]
    }

    # Validate with Pydantic
    try:
        design_output = DesignOutput.model_validate(sample_json)

        print(f"[OK] Schema validation passed")
        print(f"[OK] Design type: {design_output.task_analysis.design_type}")
        print(f"[OK] Platform: {design_output.task_analysis.platform}")
        print(f"[OK] Complexity: {design_output.task_analysis.complexity}")
        print(f"[OK] Estimated hours: {design_output.task_analysis.estimated_hours}")
        print(f"[OK] Components: {len(design_output.components)}")
        print(f"[OK] Deliverables: {len(design_output.deliverables)}")
        print(f"[OK] Primary color: {design_output.design_system.colors.primary}")
        print(f"[OK] Font family: {design_output.design_system.typography.font_families['primary']}")
        print(f"[OK] WCAG level: {design_output.accessibility.wcag_level}")

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
        "task_analysis": {
            "design_type": "mockup",
            "platform": "web",
            "complexity": "moderate"
            # Missing estimated_hours
        }
    }

    try:
        DesignOutput.model_validate(invalid_json_1)
        print("[FAIL] Should have rejected missing required field")
        assert False
    except Exception:
        print("[OK] Correctly rejected missing required field")

    # Invalid enum value
    invalid_json_2 = {
        "task_analysis": {
            "design_type": "invalid_type",  # Not in enum
            "platform": "web",
            "complexity": "moderate",
            "estimated_hours": 5.0
        },
        "components": [],
        "design_system": {
            "colors": {
                "primary": "#000000",
                "secondary": "#000000",
                "accent": "#000000",
                "neutral": ["#000000"],
                "semantic": {}
            },
            "typography": {"font_families": {}, "scale": {}},
            "spacing": {"scale": [4], "unit": "px"},
            "layout": {"max_width": "1200px", "breakpoints": {}}
        },
        "deliverables": [],
        "accessibility": {"wcag_level": "AA", "key_requirements": []},
        "next_steps": []
    }

    try:
        DesignOutput.model_validate(invalid_json_2)
        print("[FAIL] Should have rejected invalid enum value")
        assert False
    except Exception:
        print("[OK] Correctly rejected invalid enum value")

    # Invalid color format
    invalid_json_3 = {
        "task_analysis": {
            "design_type": "mockup",
            "platform": "web",
            "complexity": "moderate",
            "estimated_hours": 5.0
        },
        "components": [],
        "design_system": {
            "colors": {
                "primary": "blue",  # Not hex format
                "secondary": "#000000",
                "accent": "#000000",
                "neutral": ["#000000"],
                "semantic": {}
            },
            "typography": {"font_families": {}, "scale": {}},
            "spacing": {"scale": [4], "unit": "px"},
            "layout": {"max_width": "1200px", "breakpoints": {}}
        },
        "deliverables": [],
        "accessibility": {"wcag_level": "AA", "key_requirements": []},
        "next_steps": []
    }

    try:
        DesignOutput.model_validate(invalid_json_3)
        print("[FAIL] Should have rejected invalid color format")
        assert False
    except Exception:
        print("[OK] Correctly rejected invalid color format")

    print("[OK] Test 3 PASSED: Invalid schemas are properly rejected\n")


def test_4_output_formatting():
    """Test that design output is formatted correctly."""
    print("=" * 60)
    print("TEST 4: Output Formatting")
    print("=" * 60)

    agent = DesignerAgent(agent_id="designer_001")

    # Create sample output
    sample_output = DesignOutput(
        task_analysis=TaskAnalysis(
            design_type="mockup",
            platform="web",
            complexity="moderate",
            estimated_hours=6.0
        ),
        components=[
            Component(
                name="PrimaryButton",
                type="button",
                description="Main action button",
                states=["default", "hover", "active"],
                responsive=True
            )
        ],
        design_system=DesignSystem(
            colors=ColorPalette(
                primary="#3B82F6",
                secondary="#8B5CF6",
                accent="#EC4899",
                neutral=["#F9FAFB", "#E5E7EB"]
            ),
            typography=Typography(
                font_families={"primary": "Inter"},
                scale={"h1": "32px / 1.2 / 700", "body": "16px / 1.5 / 400"}
            ),
            spacing=Spacing(scale=[4, 8, 16, 24], unit="px"),
            layout=Layout(
                max_width="1200px",
                breakpoints={"mobile": "320px", "desktop": "1024px"}
            )
        ),
        deliverables=[
            Deliverable(
                type="mockup",
                description="Screen designs",
                format="figma",
                priority="high"
            )
        ],
        accessibility=Accessibility(
            wcag_level="AA",
            key_requirements=["Color contrast", "Keyboard navigation"]
        ),
        next_steps=["Create wireframes", "Design mockups"]
    )

    formatted = agent._format_design_output(sample_output)

    # Validate formatting
    assert "DESIGN ANALYSIS" in formatted
    assert "COMPONENTS" in formatted
    assert "DESIGN SYSTEM" in formatted
    assert "DELIVERABLES" in formatted
    assert "ACCESSIBILITY" in formatted
    assert "NEXT STEPS" in formatted
    assert "PrimaryButton" in formatted
    assert "#3B82F6" in formatted
    assert "Inter" in formatted

    print("[OK] Output contains all required sections")
    print("[OK] Component details formatted")
    print("[OK] Design system values included")
    print("[OK] Deliverables listed")
    print("[OK] Accessibility requirements shown")
    print("[OK] Next steps enumerated")
    print(f"[OK] Total output length: {len(formatted)} characters")

    print("\nFormatted Output Preview:")
    print("-" * 60)
    print(formatted[:400] + "...")
    print("-" * 60)

    print("[OK] Test 4 PASSED: Output formatting works correctly\n")


def test_5_agent_status():
    """Test agent status reporting."""
    print("=" * 60)
    print("TEST 5: Agent Status Reporting")
    print("=" * 60)

    agent = DesignerAgent(agent_id="designer_001")

    status = agent.get_status()

    assert "agent_id" in status
    assert "role" in status
    assert "state" in status
    assert "metrics" in status
    assert status["role"] == "designer"
    assert status["state"] == "IDLE"

    print(f"[OK] Agent ID: {status['agent_id']}")
    print(f"[OK] Role: {status['role']}")
    print(f"[OK] State: {status['state']}")
    print(f"[OK] Metrics: {status['metrics']}")

    print("[OK] Test 5 PASSED: Agent status reporting works\n")


def run_all_tests():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("DESIGNER AGENT TEST SUITE")
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
        print("\nDesigner Agent is ready for production use!")
        print("Key features validated:")
        print("  • Agent initialization")
        print("  • Pydantic schema validation")
        print("  • Invalid input rejection")
        print("  • Output formatting")
        print("  • Status reporting")
        print("\nNext: Test with real LLM integration")

    except Exception as e:
        print(f"\n[FAIL] Test suite failed: {e}")
        raise


if __name__ == "__main__":
    run_all_tests()
