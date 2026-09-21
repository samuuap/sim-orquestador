"""
Pydantic schemas for Designer Agent structured outputs.
These models define the exact JSON structure expected from the LLM.
"""

from typing import Literal, Optional
from pydantic import BaseModel, Field


class TaskAnalysis(BaseModel):
    """Analysis of the design task requirements."""
    design_type: Literal["wireframe", "mockup", "prototype", "component_library", "design_system"]
    platform: Literal["web", "mobile", "desktop", "cross_platform"]
    complexity: Literal["simple", "moderate", "complex"]
    estimated_hours: float = Field(gt=0, description="Estimated hours to complete the design")


class Component(BaseModel):
    """UI component specification."""
    name: str = Field(description="Component name in PascalCase")
    type: str = Field(description="Component type (button, input, card, etc.)")
    description: str = Field(description="Brief description of the component's purpose")
    states: list[str] = Field(default_factory=list, description="Component states (default, hover, active, etc.)")
    responsive: bool = Field(default=True, description="Whether component adapts to screen sizes")


class ColorPalette(BaseModel):
    """Color system definition."""
    primary: str = Field(pattern=r'^#[0-9A-Fa-f]{6}$', description="Primary brand color")
    secondary: str = Field(pattern=r'^#[0-9A-Fa-f]{6}$', description="Secondary brand color")
    accent: str = Field(pattern=r'^#[0-9A-Fa-f]{6}$', description="Accent color for highlights")
    neutral: list[str] = Field(description="Neutral color scale for text and backgrounds")
    semantic: dict[str, str] = Field(
        description="Semantic colors (success, error, warning, info)",
        default_factory=lambda: {
            "success": "#10B981",
            "error": "#EF4444",
            "warning": "#F59E0B",
            "info": "#3B82F6"
        }
    )


class Typography(BaseModel):
    """Typography system definition."""
    font_families: dict[str, str] = Field(
        description="Font family definitions (primary, secondary, monospace)"
    )
    scale: dict[str, str] = Field(
        description="Type scale with format 'size / line-height / weight'"
    )


class Spacing(BaseModel):
    """Spacing system definition."""
    scale: list[int] = Field(description="Spacing scale in ascending order")
    unit: str = Field(default="px", description="Unit of measurement")


class Layout(BaseModel):
    """Layout system definition."""
    max_width: str = Field(description="Maximum content width")
    breakpoints: dict[str, str] = Field(
        description="Responsive breakpoints (mobile, tablet, desktop, wide)"
    )


class DesignSystem(BaseModel):
    """Complete design system specification."""
    colors: ColorPalette
    typography: Typography
    spacing: Spacing
    layout: Layout


class Deliverable(BaseModel):
    """Design deliverable specification."""
    type: Literal["wireframe", "mockup", "prototype", "specs", "tokens"]
    description: str = Field(description="What this deliverable contains")
    format: str = Field(description="File format (figma, sketch, svg, json, css)")
    priority: Literal["high", "medium", "low"] = Field(default="medium")


class Accessibility(BaseModel):
    """Accessibility requirements and compliance."""
    wcag_level: Literal["A", "AA", "AAA"] = Field(default="AA")
    key_requirements: list[str] = Field(
        description="Key accessibility requirements to implement"
    )


class DesignOutput(BaseModel):
    """
    Complete structured output from Designer Agent.
    This is the root schema that the LLM must follow.
    """
    task_analysis: TaskAnalysis
    components: list[Component] = Field(
        description="List of UI components to be designed"
    )
    design_system: DesignSystem
    deliverables: list[Deliverable] = Field(
        description="List of design artifacts to be produced"
    )
    technical_considerations: list[str] = Field(
        default_factory=list,
        description="Technical constraints and implementation notes"
    )
    accessibility: Accessibility
    next_steps: list[str] = Field(
        description="Ordered list of next actions to take"
    )

    class Config:
        """Pydantic configuration."""
        json_schema_extra = {
            "example": {
                "task_analysis": {
                    "design_type": "mockup",
                    "platform": "web",
                    "complexity": "moderate",
                    "estimated_hours": 6.0
                },
                "components": [
                    {
                        "name": "PrimaryButton",
                        "type": "button",
                        "description": "Primary action button with loading state",
                        "states": ["default", "hover", "active", "disabled", "loading"],
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
                            "body": "16px / 1.5 / 400"
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
                        "description": "High-fidelity screen designs",
                        "format": "figma",
                        "priority": "high"
                    }
                ],
                "technical_considerations": [
                    "Ensure responsive behavior across breakpoints"
                ],
                "accessibility": {
                    "wcag_level": "AA",
                    "key_requirements": [
                        "4.5:1 color contrast for text",
                        "Keyboard navigation support"
                    ]
                },
                "next_steps": [
                    "Create wireframes",
                    "Design high-fidelity mockups"
                ]
            }
        }
