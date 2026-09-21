# Office Agents Simulator - Project Complete 🎉

## Overview

A real-time, interactive 3D isometric office simulation powered by multi-agent AI. Users submit project proposals to a virtual CEO who coordinates Designer and Developer agents to plan and execute tasks, all visualized in a beautiful 3D office environment.

## Architecture

### Backend (Python + FastAPI)
- **FastAPI** server with WebSocket support
- **Three AI Agents**: CEO, Designer, Developer
- **LangGraph** orchestrator for multi-agent workflows
- **Universal LLM Provider** supporting 8+ AI providers
- **Mock LLM Provider** for cost-free testing
- **Pydantic schemas** for type-safe LLM outputs
- **Structlog** for structured logging

### Frontend (React + Three.js)
- **React 18** with TypeScript
- **Three.js + React Three Fiber** for 3D rendering
- **Zustand** for state management
- **WebSocket** real-time communication
- **Tailwind CSS** for UI styling
- **Isometric camera** view of office

## Key Features

### 🤖 Multi-Agent System
- **CEO Agent**: Evaluates proposals, creates project plans, delegates tasks
- **Designer Agent**: Creates UI/UX designs, wireframes, style guides
- **Developer Agent**: Analyzes technical requirements, implementation plans

### 🎨 3D Visualization
- **Agent Avatars**: Animated 3D characters with state-based behaviors
  - IDLE: Static position
  - THINKING: Slow rotation
  - WORKING: Bobbing animation
  - COMPLETED: Quick spin
  - ERROR: Shake effect
- **Office Environment**: Desks, walls, lighting, decorations
- **Real-time Updates**: WebSocket events drive animations

### 📊 Live Metrics
- Active agents count
- Tasks completed
- Token usage tracking
- Cost tracking per agent
- Average response times

### 📝 Event Log
- Real-time stream of all agent activities
- Timestamped events
- Filterable by agent or event type

### 🔌 WebSocket Events
```
PROPOSAL_RECEIVED
CEO_EVALUATING / CEO_PLANNING
DESIGNER_ANALYZING / DESIGNER_WORKING
DEVELOPER_ANALYZING / DEVELOPER_WORKING
TASK_COMPLETED / TASK_FAILED
SYSTEM_MESSAGE
```

## Project Structure

```
sim-orquestador/
├── backend/
│   ├── agents/
│   │   ├── base.py                    # Base agent class
│   │   ├── ceo.py                     # CEO agent
│   │   ├── ceo_schemas.py             # CEO Pydantic schemas
│   │   ├── designer.py                # Designer agent
│   │   ├── designer_schemas.py        # Designer schemas
│   │   ├── developer.py               # Developer agent
│   │   ├── developer_schemas.py       # Developer schemas
│   │   ├── mock_llm_provider.py       # Mock LLM for testing
│   │   └── universal_llm_provider.py  # Universal LLM provider
│   ├── main.py                        # FastAPI + WebSocket server
│   ├── orchestrator.py                # LangGraph workflow
│   ├── config.py                      # Configuration
│   ├── schemas.py                     # Shared schemas
│   ├── test_*.py                      # Unit tests (16 total)
│   └── requirements.txt               # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AgentAvatar.tsx        # 3D agent representation
│   │   │   ├── Office.tsx             # 3D office environment
│   │   │   ├── OfficeScene.tsx        # Main 3D canvas
│   │   │   ├── ProposalInput.tsx      # User input form
│   │   │   ├── MetricsPanel.tsx       # Live metrics display
│   │   │   └── EventLog.tsx           # Event stream
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts        # WebSocket hook
│   │   ├── services/
│   │   │   └── websocket.ts           # WebSocket service
│   │   ├── store/
│   │   │   └── index.ts               # Zustand store
│   │   ├── types/
│   │   │   └── index.ts               # TypeScript types
│   │   ├── App.tsx                    # Root component
│   │   ├── main.tsx                   # Entry point
│   │   └── index.css                  # Global styles
│   ├── index.html                     # HTML template
│   ├── package.json                   # Dependencies
│   ├── vite.config.ts                 # Vite config
│   ├── tsconfig.json                  # TypeScript config
│   └── tailwind.config.js             # Tailwind config
├── prompts/
│   ├── ceo_system_prompt.md           # CEO instructions
│   ├── designer_system_prompt.md      # Designer instructions
│   └── developer_system_prompt.md     # Developer instructions
├── dev.sh / dev.bat                   # Development scripts
├── CLAUDE.md                          # Project guide
└── README.md                          # Project documentation
```

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn

### Quick Start (Windows)
```bash
# Run both servers
dev.bat
```

### Quick Start (Linux/Mac)
```bash
# Run both servers
chmod +x dev.sh
./dev.sh
```

### Manual Setup

#### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
cp .env.example .env  # Configure your API keys
uvicorn main:app --reload --port 8000
```

#### Frontend
```bash
cd frontend
npm install
cp .env.example .env  # Optional: customize WebSocket URL
npm run dev
```

### Access the Application
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Configuration

### Backend Environment Variables
```env
# LLM Provider
LLM_PROVIDER=mock  # or openai, anthropic, deepseek, nvidia, minimax, glm, custom

# API Keys (only needed for real LLM providers)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=...
NVIDIA_API_KEY=...
MINIMAX_API_KEY=...
GLM_API_KEY=...

# Models
OPENAI_MODEL=gpt-4
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Logging
LOG_LEVEL=INFO
```

### Frontend Environment Variables
```env
VITE_WS_URL=ws://localhost:8000/ws/office
```

## Testing

### Unit Tests (Backend)
```bash
cd backend
pytest -v

# Results:
# - 6 CEO agent tests ✓
# - 5 Designer agent tests ✓
# - 5 Developer agent tests ✓
# - Integration tests ✓
# - Orchestrator tests ✓
# Total: 16/16 passing
```

### Test with Mock LLM
```bash
# Set in .env
LLM_PROVIDER=mock

# No API keys needed!
# Generates realistic structured responses instantly
```

## Supported LLM Providers

1. **Mock** - Free, instant, for testing
2. **OpenAI** - GPT-4, GPT-3.5-turbo
3. **Anthropic** - Claude 3.5 Sonnet, Claude 3 Opus
4. **DeepSeek** - DeepSeek Chat, DeepSeek Coder
5. **NVIDIA** - Nemotron, Llama models
6. **MiniMax** - MiniMax-Text
7. **GLM** - ChatGLM models
8. **Custom** - Any OpenAI-compatible API

## Key Technologies

### Backend
- FastAPI 0.104+
- LangGraph 0.0.20+
- Pydantic 2.5+
- structlog 23.2+
- httpx 0.25+
- uvicorn 0.24+

### Frontend
- React 18.2+
- TypeScript 5.2+
- Three.js 0.160+
- @react-three/fiber 8.15+
- @react-three/drei 9.92+
- Zustand 4.4+
- Tailwind CSS 3.4+
- Vite 5.0+

## Development Notes

### Agent Communication Flow
```
User → CEO Agent
        ↓
    Evaluation
        ↓
    Task Planning
        ↓
   ┌────┴────┐
   ↓         ↓
Designer  Developer
   ↓         ↓
   └────┬────┘
        ↓
   Results Aggregation
        ↓
   WebSocket Broadcast
        ↓
   Frontend Update
```

### State Management
- **Backend**: LangGraph manages agent workflow state
- **Frontend**: Zustand syncs WebSocket events to React state
- **3D Scene**: React Three Fiber updates based on agent states

### Performance
- Parallel agent execution via LangGraph
- Efficient WebSocket broadcasting
- Optimized 3D rendering with R3F
- Token usage tracking and cost monitoring

## Future Enhancements

- [ ] Persistent task history database
- [ ] Multi-user support with rooms
- [ ] Agent memory and context retention
- [ ] More agent roles (QA, DevOps, PM)
- [ ] Export project plans and designs
- [ ] Voice interaction with agents
- [ ] Advanced 3D office customization
- [ ] Agent personality customization

## License

MIT License - See LICENSE file for details

## Contributors

Built with Claude Code (Anthropic) and love for multi-agent AI systems.

---

**Status**: ✅ All core features implemented and tested
**Version**: 0.1.0
**Last Updated**: 2024
