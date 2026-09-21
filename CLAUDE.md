Office Agents Simulator - Master Claude Configuration (CLAUDE.MD)

Welcome to the Office Agents Simulator repository. This document serves as the absolute master guide for Claude Code, contributors, and automated tooling working on this codebase.

## Current Status: Phase 3 - Frontend Complete ✅

✅ **Completed**: 
- All 3 agents implemented with Pydantic schemas (16/16 tests passing)
- Mock LLM provider for testing
- Universal LLM provider (8+ providers supported)
- LangGraph orchestrator with parallel task processing
- Full 3D frontend with React + Three.js + WebSockets

📋 **Next**: Integration testing and deployment

---

1. Project Overview & Vision

Concept: A real-time, interactive 3D isometric pixel-art office simulation (resembling The Sims meets multi-agent AI).

Core Loop: The human user interacts directly with the virtual CEO. The CEO evaluates project proposals, estimates timelines, breaks down tasks, and delegates them to design and development sub-agents. All agent states, messages, and task progress are streamed in real-time to a graphical web-based 3D isometric interface.

Architecture Stack:

Backend: Python 3.11+, FastAPI, WebSockets, LangGraph (Agent Orchestration), Pydantic for strict data validation.

Frontend: TypeScript, Three.js / React Three Fiber, Tailwind CSS for HUD/overlays (PLANNED).

Communication Layer: Bi-directional WebSockets (/ws/office) broadcasting JSON event payloads.

2. Repository Structure

/
├── CLAUDE.MD                 # This master guide file
├── backend/
│   ├── main.py               # FastAPI entry point & WebSocket manager
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── base.py           # Base agent class and configuration
│   │   ├── ceo.py            # CEO agent definition & system prompt
│   │   ├── designer.py       # UI/UX designer agent definition
│   │   └── developer.py      # Software developer agent definition
│   ├── orchestrator.py       # LangGraph / CrewAI workflow graph
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/       # HUD, chat panels, task trackers
│   │   ├── engine/           # 3D isometric pixel art scene (Three.js/R3F)
│   │   ├── hooks/            # WebSocket and state management hooks
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
└── prompts/
    └── ceo_system_prompt.md  # Detailed system prompt for the CEO agent


3. Development Commands & Workflow

Backend (Python / FastAPI)

Setup Environment:

cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt


Run Development Server:

uvicorn main:app --reload --port 8000


Frontend (TypeScript / React)

Setup Environment:

cd frontend
npm install


Run Development Server:

npm run dev


4. Coding Standards & Conventions

Python (Backend)

Type Hinting: Mandatory on all function signatures and class attributes. Use strict pydantic models for API payloads and agent state schemas.

Async First: Leverage async/await for all LLM calls, database/memory operations, and WebSocket message broadcasting.

Error Handling: Gracefully catch LLM timeouts, API rate limits, and WebSocket disconnections with proper logging (structlog).

TypeScript / Frontend

Components: Functional components with React hooks. Keep the 3D rendering loop decoupled from UI state management.

State Management: Use lightweight stores (Zustand) to sync WebSocket events with the 3D world state (e.g., character animations, thought bubbles, progress bars).

5. Key Architecture Patterns for Agents

The Orchestrator Pattern: The CEO agent acts as the primary graph node. User prompts hit the CEO first; the CEO evaluates constraints and routes tasks through LangGraph edges to specialized workers (Designer, Developer).

State Broadcasting: Every state change (e.g., CEO_ESTIMATING, DEV_CODING_API, TASK_COMPLETED) must publish a structured JSON payload over WebSockets so the 3D client can update avatar animations and speech bubbles instantly.