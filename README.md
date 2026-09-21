# Office Agents Simulator

A real-time, interactive multi-agent AI system with 3D isometric visualization. Watch AI agents collaborate on software projects in a virtual office environment.

## Overview

**Office Agents Simulator** combines multi-agent AI orchestration with real-time 3D visualization. Users interact with a virtual CEO who evaluates project proposals, breaks them into tasks, and delegates to specialized Designer and Developer agents. All agent activities stream live to an isometric 3D office interface.

### Key Features

- 🤖 **3 Specialized AI Agents**: CEO, Designer, Developer
- 🔄 **Real-time Communication**: WebSocket-based event streaming
- 🎨 **Type-Safe Architecture**: Pydantic schemas for all agent outputs
- 📊 **Task Orchestration**: LangGraph-powered agent coordination
- 🎮 **3D Visualization**: Isometric office with agent avatars (planned)
- ✅ **Fully Tested**: 16/16 tests passing

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│              (3D Isometric Office - Planned)             │
└─────────────────────────────────────────────────────────┘
                           ↕ WebSocket
┌─────────────────────────────────────────────────────────┐
│                   FastAPI Backend                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │            WebSocket Manager                      │  │
│  │         (Real-time Event Broadcasting)            │  │
│  └──────────────────────────────────────────────────┘  │
│                           ↕                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Agent Orchestrator                   │  │
│  │            (LangGraph Workflow)                   │  │
│  └──────────────────────────────────────────────────┘  │
│                           ↕                              │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐  │
│  │ CEO Agent  │  │ Designer   │  │  Developer      │  │
│  │            │  │  Agent     │  │   Agent         │  │
│  │ Evaluates  │  │ Plans UI/  │  │  Plans code     │  │
│  │ proposals  │  │ UX design  │  │  implementation │  │
│  └────────────┘  └────────────┘  └─────────────────┘  │
│         ↕               ↕                  ↕             │
│  ┌──────────────────────────────────────────────────┐  │
│  │         LLM Provider (OpenAI/Anthropic)          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend
- **Python 3.11+**
- **FastAPI** - ASGI web framework
- **WebSockets** - Real-time bidirectional communication
- **Pydantic** - Data validation and schemas
- **LangGraph** - Agent orchestration (planned)
- **Structlog** - Structured logging
- **OpenAI / Anthropic** - LLM providers

### Frontend (Planned)
- **TypeScript**
- **React + Vite**
- **Three.js / React Three Fiber** - 3D rendering
- **Tailwind CSS** - Styling

---

## Project Structure

```
sim-orquestador/
├── backend/
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── base.py              # BaseAgent abstract class
│   │   ├── ceo.py               # CEO Agent (refactored)
│   │   ├── ceo_schemas.py       # CEO Pydantic schemas
│   │   ├── designer.py          # Designer Agent
│   │   ├── designer_schemas.py  # Designer Pydantic schemas
│   │   ├── developer.py         # Developer Agent
│   │   ├── developer_schemas.py # Developer Pydantic schemas
│   │   ├── llm_provider.py      # LLM integration layer
│   │   └── message_queue.py     # Agent messaging system
│   ├── config.py                # Application configuration
│   ├── main.py                  # FastAPI application entry
│   ├── schemas.py               # Base schemas (Task, TaskResult, etc.)
│   ├── requirements.txt         # Python dependencies
│   ├── test_agents.py           # BaseAgent tests
│   ├── test_ceo.py              # CEO Agent tests
│   ├── test_designer.py         # Designer Agent tests
│   ├── test_developer.py        # Developer Agent tests
│   └── test_websocket.py        # WebSocket tests
├── prompts/
│   ├── ceo_system_prompt.md      # CEO agent instructions
│   ├── designer_system_prompt.md # Designer agent instructions
│   └── developer_system_prompt.md# Developer agent instructions
├── frontend/                      # (To be implemented)
├── CLAUDE.md                      # Project master guide
├── MILESTONE-*.md                 # Completed milestones
└── README.md                      # This file
```

---

## Agent Capabilities

### 🎯 CEO Agent
**Role**: Project evaluation, timeline estimation, task delegation

**Inputs**: Project proposals from users

**Outputs** (JSON):
- Feasibility assessment (APPROVED/NEEDS_CLARIFICATION/NOT_FEASIBLE)
- Complexity rating (LOW/MEDIUM/HIGH/VERY_HIGH)
- Timeline estimates
- Requirements list (prioritized and categorized)
- Design tasks (for Designer Agent)
- Development tasks (for Developer Agent)
- Risk analysis with mitigation strategies
- Next steps

**Schema**: `CEOOutput` with 7 nested Pydantic models

---

### 🎨 Designer Agent
**Role**: UI/UX design planning and component specification

**Inputs**: Design tasks from CEO

**Outputs** (JSON):
- Design type (wireframe/mockup/prototype/component_library)
- Platform (web/mobile/desktop/cross_platform)
- Component specifications (with states and responsiveness)
- Design system (colors, typography, spacing, layout)
- Deliverables (prioritized by high/medium/low)
- Accessibility requirements (WCAG compliance)
- Technical considerations
- Next steps

**Schema**: `DesignOutput` with 9 nested Pydantic models

---

### 💻 Developer Agent
**Role**: Technical implementation planning and architecture

**Inputs**: Development tasks from CEO

**Outputs** (JSON):
- Task type (api_endpoint/database_schema/frontend_component/backend_service/integration/testing/deployment/refactoring)
- Complexity assessment
- Technical requirements (prioritized and categorized)
- Technology stack (languages, frameworks, databases, tools, dependencies)
- Implementation steps (sequential with dependencies)
- Testing strategy (unit tests, integration tests, coverage targets)
- Security considerations (8 categories with mitigations)
- Performance optimizations
- Deployment notes
- Next steps

**Schema**: `DeveloperOutput` with 10 nested Pydantic models

---

## Getting Started

### Prerequisites

- Python 3.11 or higher
- Virtual environment tool (venv)
- OpenAI API key or Anthropic API key

### Installation

1. **Clone the repository** (or navigate to project directory)
   ```bash
   cd sim-orquestador
   ```

2. **Set up Python virtual environment**
   ```bash
   cd backend
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your API keys:
   ```env
   # LLM Provider (openai or anthropic)
   LLM_PROVIDER=openai
   
   # API Keys
   OPENAI_API_KEY=your_openai_key_here
   ANTHROPIC_API_KEY=your_anthropic_key_here
   
   # Application
   APP_ENV=development
   LOG_LEVEL=INFO
   
   # WebSocket
   WS_HEARTBEAT_INTERVAL=30
   WS_MAX_CONNECTIONS=100
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   python main.py
   ```
   
   Server will start on `http://localhost:8000`

2. **Access API documentation**
   
   Open in browser: `http://localhost:8000/docs`

3. **Test WebSocket connection**
   ```bash
   python test_websocket.py
   ```

### Running Tests

```bash
# Test BaseAgent foundation
python test_agents.py

# Test CEO Agent
python test_ceo.py

# Test Designer Agent
python test_designer.py

# Test Developer Agent
python test_developer.py

# Test WebSocket connectivity
python test_websocket.py
```

**All tests should pass:** 16/16 ✅

---

## API Endpoints

### HTTP Endpoints

- `GET /` - Service information
- `GET /health` - Health check with connection count
- `GET /docs` - Swagger UI documentation
- `GET /api/connections` - Active WebSocket connections

### WebSocket

- `ws://localhost:8000/ws/office` - Real-time event streaming

#### WebSocket Events

**Connection Events:**
- `CONNECTION_ESTABLISHED` - Client connected successfully
- `HEARTBEAT` - Keep-alive ping every 30 seconds

**CEO Events:**
- `CEO_EVALUATING` - Started evaluating proposal
- `CEO_EVALUATION_COMPLETE` - Evaluation finished
- `CEO_PLAN_CREATED` - Project plan created
- `CEO_ERROR` - Error occurred

**Designer Events:**
- `DESIGNER_ANALYZING` - Started design analysis
- `DESIGNER_ANALYSIS_COMPLETE` - Analysis finished
- `DESIGNER_ERROR` - Error occurred

**Developer Events:**
- `DEVELOPER_ANALYZING` - Started implementation analysis
- `DEVELOPER_ANALYSIS_COMPLETE` - Analysis finished
- `DEVELOPER_ERROR` - Error occurred

---

## Development Milestones

- ✅ **Milestone 1**: Backend Scaffolding & Core Infrastructure (30 min)
- ✅ **Milestone 2**: Agent Foundation & Base Classes (45 min)
- ✅ **Milestone 3**: CEO Agent Implementation (1 hour)
- ✅ **Milestone 4**: Designer Agent Implementation (1.5 hours)
- ✅ **Milestone 5**: Developer Agent Implementation (1.5 hours)
- ✅ **CEO Refactoring**: Applied Pydantic pattern to CEO (1 hour)
- 🔄 **Next**: Full Integration Testing
- 📋 **Planned**: LangGraph Orchestrator
- 📋 **Planned**: 3D Frontend Visualization

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | LLM provider (openai or anthropic) | openai |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `APP_ENV` | Environment (development or production) | development |
| `LOG_LEVEL` | Logging level (DEBUG, INFO, WARNING, ERROR) | INFO |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | http://localhost:5173,http://localhost:3000 |
| `WS_HEARTBEAT_INTERVAL` | WebSocket heartbeat interval (seconds) | 30 |
| `WS_MAX_CONNECTIONS` | Maximum WebSocket connections | 100 |

---

## Design Patterns

### Pydantic Schema Validation

All agents use **structured JSON output** with Pydantic validation:

```python
# LLM responds with JSON
response_json = json.loads(llm_response)

# Automatic validation
output = AgentOutput.model_validate(response_json)

# Type-safe access
print(output.evaluation.feasibility)  # Guaranteed to exist
print(output.tasks[0].estimated_hours)  # Type-checked
```

**Benefits:**
- ✅ Robust parsing (no fragile regex)
- ✅ Type safety throughout
- ✅ Automatic validation
- ✅ Clear error messages
- ✅ IDE autocomplete support

### Agent State Machine

All agents inherit from `BaseAgent` with state machine:

```python
IDLE → THINKING → WORKING → COMPLETED → IDLE
                    ↓
                  ERROR
```

States broadcast via WebSocket for real-time UI updates.

---

## Testing Strategy

### Test Coverage

- **Unit Tests**: Each agent's core functionality
- **Schema Validation Tests**: Pydantic model validation
- **Integration Tests**: WebSocket connectivity
- **Error Handling Tests**: Invalid inputs and edge cases

### Running Specific Tests

```bash
# CEO Agent only
python test_ceo.py

# Designer Agent only
python test_designer.py

# Developer Agent only
python test_developer.py
```

---

## Troubleshooting

### Common Issues

**Issue**: `ModuleNotFoundError`  
**Solution**: Make sure virtual environment is activated and dependencies are installed
```bash
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

**Issue**: `LLM provider not configured`  
**Solution**: Check `.env` file has valid API keys
```bash
cat .env  # Check API keys are set
```

**Issue**: `WebSocket connection failed`  
**Solution**: Ensure backend server is running on port 8000
```bash
python main.py  # Start server
```

**Issue**: Tests failing with encoding errors  
**Solution**: Ensure UTF-8 encoding (Windows-specific)
```bash
# Tests use ASCII-compatible output
python test_ceo.py  # Should work on all platforms
```

---

## Roadmap

### Phase 1: Core Agents ✅ (COMPLETED)
- [x] Backend scaffolding
- [x] Agent foundation
- [x] CEO Agent
- [x] Designer Agent
- [x] Developer Agent
- [x] Pydantic refactoring

### Phase 2: Integration 🔄 (IN PROGRESS)
- [ ] End-to-end testing with real LLMs
- [ ] LangGraph orchestrator
- [ ] Multi-agent workflows
- [ ] Task dependency management

### Phase 3: Frontend 📋 (PLANNED)
- [ ] React + Three.js setup
- [ ] 3D isometric office
- [ ] Agent avatars and animations
- [ ] Real-time event visualization
- [ ] Interactive task board

### Phase 4: Enhancement 📋 (PLANNED)
- [ ] Agent memory and context
- [ ] Task persistence (database)
- [ ] User authentication
- [ ] Multi-project support
- [ ] Analytics dashboard

---

## Contributing

This is a personal project. If you'd like to contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure all tests pass
5. Submit a pull request

---

## License

This project is for educational and demonstration purposes.

---

## Acknowledgments

- Built with Claude Code (Anthropic)
- Inspired by The Sims and multi-agent AI systems
- Uses OpenAI and Anthropic LLM APIs

---

## Contact

For questions or feedback, please open an issue in the repository.

---

**Current Status**: ✅ 3 Agents Implemented | 🔄 Integration Testing Next | 📋 Frontend Planned
