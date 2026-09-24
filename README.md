# Office Agents Simulator

A real-time multi-agent AI system with 3D isometric visualization. You hand a project proposal to a
virtual CEO; it evaluates the proposal, breaks it into tasks, and delegates to specialized Designer
and Developer agents. Every state change streams over WebSocket to an isometric 3D office where each
agent is an animated avatar.

## Status

**Working end to end.** Verified in a browser on 2026-09-24 — see
[`docs/milestones/MILESTONE-6-COMPLETED.md`](docs/milestones/MILESTONE-6-COMPLETED.md).

| Area | State |
|------|-------|
| Backend agents + orchestration | ✅ Working |
| WebSocket streaming | ✅ Working |
| 3D frontend | ✅ Working |
| Backend tests | ✅ 21 passed, 1 skipped |
| Frontend tests | ❌ None — no test framework installed |
| Real LLM providers | ⚠️ Implemented but never called. Only `mock` has run |
| Deployment (Docker/CI) | ❌ Not started |

> Earlier revisions of this file and several now-archived status documents claimed "16/16 tests
> passing" and described the frontend as unimplemented. Both were wrong. The numbers above are
> measured.

---

## Quickstart

### Prerequisites

- **Python 3.9+** (the project runs on macOS system Python 3.9.6; no 3.10+ syntax is used)
- **Node.js 18+** (developed against 24.21.0 LTS)
- No API key needed — the default provider is `mock`

If Node is missing and you cannot use a package manager (locked-down machine, no admin), install it
into your home directory:

```bash
curl -O https://nodejs.org/dist/v24.21.0/node-v24.21.0-darwin-arm64.tar.gz
tar -xzf node-v24.21.0-darwin-arm64.tar.gz -C ~/.local
mkdir -p ~/.local/bin
ln -sf ~/.local/node-v24.21.0-darwin-arm64/bin/{node,npm,npx} ~/.local/bin/
# ensure ~/.local/bin is on your PATH
```

### First run

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # defaults to LLM_PROVIDER=mock — no key required

cd ../frontend
npm install
```

### Running

Two terminals:

```bash
# Terminal 1 — backend (port 8000 is mandatory, see Gotchas)
cd backend && source venv/bin/activate
python -m uvicorn main:app --reload --port 8000
```

```bash
# Terminal 2 — frontend
cd frontend && npm run dev
```

Then open **<http://localhost:5173>** and type a proposal into the panel at bottom-left.

Or use the bundled script, which does both in one terminal and stops both with `Ctrl+C`:

```bash
bash dev.sh        # note: no execute bit, so `./dev.sh` fails
```

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:8000>
- API docs: <http://localhost:8000/docs>

### Gotchas

These will each cost you twenty minutes if you hit them cold:

1. **The backend must run on port 8000.** `frontend/vite.config.ts` hardcodes the proxy target
   `ws://localhost:8000`. Any other port and the WebSocket silently fails to connect.
2. **Use `localhost`, not `127.0.0.1`,** for the frontend. Vite 6 binds IPv6 only;
   `http://127.0.0.1:5173` refuses the connection while `http://localhost:5173` works.
3. **`dev.sh` has no execute bit.** Use `bash dev.sh`, or `chmod +x dev.sh` once.
4. **VS Code's bundled Electron is not a substitute for Node.** It runs pure-JS tools like `tsc`
   fine, but Vite fails — macOS refuses to load rollup's native module in a differently-signed
   process.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Frontend — React + Three.js (Vite :5173)                │
│  3D isometric office · agent avatars · metrics · log     │
└──────────────────────────────────────────────────────────┘
                    ↕ WebSocket /ws/office
                      (proxied by Vite in dev)
┌──────────────────────────────────────────────────────────┐
│  Backend — FastAPI (:8000)                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │  WebSocketManager — broadcast + 30s heartbeat      │  │
│  └────────────────────────────────────────────────────┘  │
│                          ↕                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │  AgentOrchestrator — LangGraph state machine       │  │
│  │                                                     │  │
│  │  evaluate_proposal → create_plan → design_work     │  │
│  │      → development_work → finalize_results → END   │  │
│  └────────────────────────────────────────────────────┘  │
│           ↕              ↕                ↕              │
│    ┌───────────┐  ┌────────────┐  ┌──────────────┐      │
│    │ CEO Agent │  │  Designer  │  │  Developer   │      │
│    │  ceo_001  │  │designer_001│  │developer_001 │      │
│    └───────────┘  └────────────┘  └──────────────┘      │
│                          ↕                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │  UniversalLLMProvider — 8 providers incl. mock     │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Note on parallelism:** tasks run concurrently (`asyncio.gather`) *within* `design_work` and
*within* `development_work`, but the two nodes run one after the other — the graph edge is
`design_work → development_work`. Designer and Developer do **not** overlap.

---

## Technology Stack

**Backend** — Python 3.9+ · FastAPI 0.109 · uvicorn 0.27 · websockets 12.0 · Pydantic 2.5 ·
LangGraph 0.0.20 · LangChain 0.1.0 · structlog 24.1 · httpx 0.26 · openai 1.10 · anthropic 0.8.1 ·
pytest 7.4 + pytest-asyncio 0.23

**Frontend** — TypeScript 5.6 · React 18.3 · Vite 6 · Three.js 0.170 · @react-three/fiber 8.17 ·
@react-three/drei 9.11 · Zustand 5.0 · Tailwind CSS 3.4 · lucide-react

> `langgraph==0.0.20` and `langchain==0.1.0` are pinned several major versions behind current. They
> work, but expect API drift if you upgrade.

---

## Project Structure

```
sim-orquestador/
├── backend/
│   ├── agents/
│   │   ├── base.py                    # BaseAgent: state machine, metrics, broadcasting
│   │   ├── ceo.py / ceo_schemas.py
│   │   ├── designer.py / designer_schemas.py
│   │   ├── developer.py / developer_schemas.py
│   │   ├── llm_provider.py            # thin factory: get_llm_provider()
│   │   ├── universal_llm_provider.py  # the real implementation, 8 providers
│   │   ├── mock_llm_provider.py       # canned structured responses, zero cost
│   │   └── message_queue.py           # ⚠️ dead code — used only by tests
│   ├── main.py                        # FastAPI app, WebSocketManager, SimulationRuntime
│   ├── orchestrator.py                # LangGraph workflow
│   ├── config.py                      # pydantic-settings, reads .env
│   ├── schemas.py                     # Task, TaskResult, WSEvent, AgentState
│   ├── test_*.py                      # 7 files, 22 tests
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── OfficeScene.tsx        # R3F canvas, isometric camera, lighting
│       │   ├── Office.tsx             # desks, walls, plants, whiteboard
│       │   ├── AgentAvatar.tsx        # capsule avatar + state animations
│       │   ├── TopBar.tsx             # agent count, clock, panel toggles
│       │   ├── ProposalPanel.tsx      # proposal input (active)
│       │   ├── ProposalInput.tsx      # ⚠️ orphaned — superseded by ProposalPanel
│       │   ├── AgentDetailsPanel.tsx  # per-agent cards
│       │   ├── MetricsPanel.tsx       # aggregate tokens/cost/timing
│       │   └── EventLog.tsx           # live event stream
│       ├── hooks/useWebSocket.ts      # event → store reducer
│       ├── services/websocket.ts      # connection + exponential backoff
│       ├── store/index.ts             # Zustand; agent IDs hardcoded here
│       └── types/index.ts
├── prompts/                           # system prompts: ceo, designer, developer
├── docs/
│   ├── milestones/                    # historical build record, milestones 1–6
│   └── archive/                       # superseded status docs
├── dev.sh / dev.bat
├── CLAUDE.md                          # contributor + agent guide, wire contract
└── README.md
```

---

## The Agents

### 🎯 CEO — `ceo_001`

Evaluates proposals and delegates. Outputs `CEOOutput` (7 nested Pydantic models): feasibility
(`APPROVED` / `NEEDS_CLARIFICATION` / `NOT_FEASIBLE`), complexity (`LOW`…`VERY_HIGH`), timeline
estimate, prioritized requirements, risk analysis with mitigations, and two task lists — design
tasks and development tasks — that drive the rest of the graph.

### 🎨 Designer — `designer_001`

Plans UI/UX for each design task. Outputs `DesignOutput` (9 nested models): design type
(wireframe / mockup / prototype / component_library), target platform, component specs with states
and responsiveness, a design system (colors, typography, spacing, layout), prioritized deliverables,
and WCAG accessibility requirements.

### 💻 Developer — `developer_001`

Plans implementation for each development task. Outputs `DeveloperOutput` (10 nested models, the
largest schema): task type across 8 categories, tech stack broken into languages / frameworks /
databases / tools / new dependencies, sequential implementation steps with inter-step dependencies
and touched file paths, testing strategy with a coverage target, security considerations across 8
categories with severity and mitigation, and performance recommendations rated by impact.

All three enforce JSON-only output and validate it through Pydantic, so a malformed or
schema-violating LLM response fails loudly instead of being silently misparsed.

---

## API

### HTTP

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Service metadata and endpoint list |
| `GET` | `/health` | Status, active provider, WS connection count, orchestrator busy flag |
| `GET` | `/api/agents` | All agent statuses and metrics |
| `GET` | `/api/connections` | Active WebSocket connections |
| `POST` | `/api/proposals` | Submit a proposal over HTTP — `202`, or `409` if already busy |
| `GET` | `/docs` | Swagger UI |

### WebSocket — `ws://localhost:8000/ws/office`

**Client → server** (only two messages exist):

```json
{"type": "SUBMIT_PROPOSAL", "payload": {"proposal": "Build a task management app…"}}
{"type": "PING"}
```

**Server → client** — every event uses the same envelope:

```json
{
  "event_type": "CEO_EVALUATING",
  "agent_id": "ceo_001",
  "timestamp": "2026-09-24T18:09:26.201542Z",
  "payload": { }
}
```

The full list of 22 event types, their payload fields, and the exact agent IDs and metrics keys the
frontend depends on are documented in [`CLAUDE.md`](CLAUDE.md#websocket-wire-contract). **Read that
before changing either side** — the contract is matched by convention, not enforced by a shared
schema, and mismatches fail silently.

---

## Configuration

`backend/.env` (copy from `.env.example`; it is gitignored):

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | `mock`, `openai`, `anthropic`, `deepseek`, `nvidia`, `minimax`, `glm`, `custom_openai` | `mock` |
| `<PROVIDER>_API_KEY` | Key for the selected provider. Not needed for `mock` | — |
| `<PROVIDER>_MODEL` | Model name for the selected provider | per provider |
| `CUSTOM_BASE_URL` | Endpoint for any OpenAI-compatible API | — |
| `APP_ENV` | `development` or `production` | `development` |
| `LOG_LEVEL` | `DEBUG` / `INFO` / `WARNING` / `ERROR` | `INFO` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173,http://localhost:3000` |
| `WS_HEARTBEAT_INTERVAL` | Heartbeat interval in seconds | `30` |
| `WS_MAX_CONNECTIONS` | Connection cap | `100` |

`frontend/.env` (optional): `VITE_WS_URL` overrides the WebSocket URL. Left unset, the frontend
derives it from the page host and relies on Vite's dev proxy.

---

## Testing

```bash
cd backend && source venv/bin/activate
pytest -q                 # 21 passed, 1 skipped
pytest -v test_ceo.py     # one file
```

| File | Tests | Covers |
|------|-------|--------|
| `test_ceo.py` | 6 | CEO init, schema validation, invalid-schema rejection, formatting, status |
| `test_designer.py` | 5 | Same shape for Designer |
| `test_developer.py` | 5 | Same shape for Developer |
| `test_agents.py` | 3 | BaseAgent state machine, message queue |
| `test_integration.py` | 1 | Cross-agent flow |
| `test_orchestrator.py` | 1 | LangGraph workflow |
| `test_websocket.py` | 1 | WebSocket connectivity |

All run against the mock provider, so they are free and instant. The frontend has **no** test
framework installed.

---

## Known Gaps

Found during Milestone 6 verification and not yet fixed:

1. **Agents never emit `WORKING`.** Observed transitions are only `IDLE → THINKING → COMPLETED`, so
   `AgentAvatar`'s bobbing animation never fires and the office looks static.
2. **`tasks[]` is never populated.** `CEO_PLAN_CREATED` carries the full task array and the store
   discards it; `addTask` / `updateTask` are implemented but never called.
3. **Designer and Developer run sequentially**, not in parallel.
4. **Real LLM providers are untested.** Seven providers, zero live calls.
5. **Dead code.** `ProposalInput.tsx`, `message_queue.py`, and the types `AgentMetrics`,
   `HealthResponse`, `ConnectionsResponse`.
6. **Dead event names** in `EventLog.tsx`: `CEO_PLANNING`, `DESIGNER_WORKING`, `DEVELOPER_WORKING`
   are mapped to icons but never emitted.
7. **Single 1.2 MB JS bundle** (346 kB gzipped), dominated by Three.js. No code splitting.

## Roadmap

- [ ] Real LLM provider integration — the highest-risk unverified path
- [ ] Emit `WORKING`; populate the task board from `CEO_PLAN_CREATED`
- [ ] Fan out `create_plan` to both work nodes for true parallelism
- [ ] Frontend test setup (Vitest + Testing Library)
- [ ] Task persistence (database), agent memory across proposals
- [ ] More roles: QA, DevOps, PM
- [ ] Dockerfile, CI, deployment

---

## License

No license file is present. This project is for educational and demonstration purposes.

## Acknowledgments

Built with Claude Code. Inspired by The Sims and multi-agent AI systems.
