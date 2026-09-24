# Office Agents Simulator — Contributor & Agent Guide

This is the working guide for anyone (human or AI) modifying this codebase. For what the project is,
how to install it, and how to run it, see [`README.md`](README.md). This file covers the parts you
need to *change* things safely: the wire contract, the conventions, and the traps.

---

## Current Status: Phase 4 — Full-Stack Integration Verified ✅

Measured by execution on 2026-09-24, not inferred from code:

- Backend agents, LangGraph orchestration, and WebSocket streaming: **working**
- 3D frontend: **working**, verified in a real browser
- Backend tests: **21 passed, 1 skipped** (22 collected)
- Frontend: typechecks clean under `strict`; builds in ~7s; no test framework
- Backend↔frontend wire contract: **verified field by field** (see below)
- Real LLM providers: **implemented, never called.** Only `mock` has ever run

**Next:** real LLM provider integration — the last unverified path. The mock always returns valid
JSON, so schema drift, truncation, enum violations, timeouts, and rate limits are all untested.

> ⚠️ Several documents in `docs/archive/` claim "16/16 tests passing", describe the frontend as
> unimplemented, or call Designer/Developer execution parallel. All three are wrong. They are kept
> only as historical record. Trust this file, `README.md`, and
> `docs/milestones/MILESTONE-6-COMPLETED.md`.

---

## Repository Structure

```
backend/
  main.py                  FastAPI app · WebSocketManager · SimulationRuntime · HTTP + WS routes
  orchestrator.py          AgentOrchestrator — the LangGraph workflow
  config.py                pydantic-settings Settings, reads backend/.env
  schemas.py               Task · TaskResult · WSEvent · AgentState
  agents/
    base.py                BaseAgent — state machine, metrics, event broadcasting
    ceo.py                 + ceo_schemas.py        → CEOOutput       (7 nested models)
    designer.py            + designer_schemas.py   → DesignOutput    (9 nested models)
    developer.py           + developer_schemas.py  → DeveloperOutput (10 nested models)
    llm_provider.py        Thin factory. Exports get_llm_provider() and aliases LLMProvider
    universal_llm_provider.py  The real implementation — 8 providers, per-provider cost calc
    mock_llm_provider.py   Canned structured responses. Loaded lazily when provider == "mock"
    message_queue.py       ⚠️ DEAD CODE — exported and tested, but never used in the runtime path
  test_*.py                7 files, 22 tests, all against the mock provider

frontend/src/
  App.tsx                  Renders OfficeScene + TopBar + ProposalPanel + one of
                           (AgentDetailsPanel | MetricsPanel) + EventLog
  components/              9 files — see README for the per-file breakdown
  hooks/useWebSocket.ts    reduceEvent(): the single place inbound events become state
  services/websocket.ts    Connection lifecycle, exponential-backoff reconnect
  store/index.ts           Zustand store. ⚠️ Agent IDs and 3D positions are hardcoded here
  types/index.ts           Agent · Task · WSEvent · BackendAgentMetrics · ConnectionInfo

prompts/                   System prompts loaded at agent init (ceo 9.5k, designer 8.9k, developer 15.5k chars)
docs/milestones/           Build history, milestones 1–6
docs/archive/              Superseded status docs — do not trust
```

---

## Development Commands

```bash
# Backend
cd backend && source venv/bin/activate
python -m uvicorn main:app --reload --port 8000    # port 8000 is mandatory
pytest -q                                          # 21 passed, 1 skipped

# Frontend
cd frontend
npm run dev            # Vite on :5173 (IPv6 only — use localhost, not 127.0.0.1)
npm run build          # tsc && vite build
npx tsc --noEmit       # typecheck alone
npm run lint           # eslint, --max-warnings 0
```

---

## WebSocket Wire Contract

**This is the most fragile part of the system.** The two sides were built independently and agree by
convention, not through a shared schema. Mismatches fail *silently* — `patchAgent` in
`store/index.ts` drops updates for unknown agent IDs without warning. Verify both sides whenever you
touch an event name, an agent ID, or a payload field.

### Envelope

Every outbound event is a `WSEvent` serialized with `model_dump(mode="json")`:

```json
{
  "event_type": "CEO_EVALUATING",
  "agent_id": "ceo_001",
  "timestamp": "2026-09-24T18:09:26.201542Z",
  "payload": { }
}
```

Note that consumers read the agent from the **envelope's** `agent_id`, not from `payload.role`.

### Agent IDs — must match exactly

| Backend (`main.py` setup) | Frontend (`store/index.ts`) | 3D position |
|---|---|---|
| `ceo_001` | `ceo_001` | `[0, 0, 0]` |
| `designer_001` | `designer_001` | `[-4, 0, -2]` |
| `developer_001` | `developer_001` | `[4, 0, -2]` |

### Metrics keys — must match exactly

`TASK_COMPLETED` / `TASK_FAILED` carry `payload.metrics`, consumed by `applyMetrics()` in
`useWebSocket.ts`:

| Backend key | Mapped to `Agent` field |
|---|---|
| `completed_tasks` | `tasks_completed` |
| `total_tokens` | `total_tokens_used` |
| `total_cost` | `total_cost` |
| `average_duration` | `avg_response_time` |
| `total_tasks` | *read and discarded* |
| `failed_tasks` | *read and discarded* |

### Client → server

Only two messages exist. `type` is uppercased server-side, so case is not significant.

```json
{"type": "SUBMIT_PROPOSAL", "payload": {"proposal": "<string>"}}
{"type": "PING"}
```

An empty proposal, or any unrecognized `type`, returns a `SYSTEM_MESSAGE` to that client only.

### Server → client — all 22 event types

**Drives frontend state** (handled in `reduceEvent`):

| `event_type` | Payload fields | Effect on frontend |
|---|---|---|
| `CONNECTION_ESTABLISHED` | `client_id`, `message`, `agents[]`, `orchestrator_busy` | Seeds all agents + metrics. Sent to that client only |
| `AGENT_STATE_CHANGED` | `role`, `old_state`, `new_state`, `current_task`, `metadata` | Sets agent state; clears `current_task` on `IDLE`/`COMPLETED` |
| `TASK_COMPLETED` | `task_id`, `role`, `success`, `output`, `duration`, `error`, `metrics{}` | Applies metrics |
| `TASK_FAILED` | same as above | Applies metrics |
| `PROPOSAL_RECEIVED` | `proposal` | Stores proposal, `isProcessing = true` |
| `ORCHESTRATION_STARTED` | `proposal` | `isProcessing = true` |
| `ORCHESTRATION_COMPLETE` | `completed`, `design_tasks`, `development_tasks`, `design_results`, `dev_results`, `errors[]`, `summary` | `isProcessing = false` |
| `ORCHESTRATION_FAILED` | `error`, `errors[]` | `isProcessing = false` |
| `CEO_EVALUATING` | `task_id`, `proposal` (truncated to 200 chars) | Sets `current_task` label |
| `CEO_PLAN_CREATED` | `task_id`, `total_tasks`, `design_tasks`, `dev_tasks`, `tasks[]` | Sets label. ⚠️ `tasks[]` is **discarded** |
| `DESIGNER_ANALYZING` | `task_id`, `description` | Sets `current_task` label |
| `DEVELOPER_ANALYZING` | `task_id`, `description` | Sets `current_task` label |
| `HEARTBEAT` | `message: "ping"` | No-op. Every 30s |
| `PONG` | `{}` | No-op. Sent to that client only |

**Logged but no state change** — these appear in `EventLog` and nowhere else:

`CEO_EVALUATION_COMPLETE` (`project_title`, `feasibility`, `complexity`, `estimated_timeline`,
`design_task_count`, `dev_task_count`) · `CEO_ERROR` · `DESIGNER_ANALYSIS_COMPLETE` (`design_type`,
`component_count`, `estimated_hours`) · `DESIGNER_ERROR` · `DEVELOPER_ANALYSIS_COMPLETE`
(`task_type`, `complexity`, `estimated_hours`, `implementation_steps`) · `DEVELOPER_ERROR` ·
`SYSTEM_MESSAGE` (`level`, `message`) · `AGENT_MESSAGE` (`message_id`, `sender`, `receiver`,
`content`)

### Agent states

`schemas.py` and `types/index.ts` both define six: `IDLE`, `THINKING`, `WORKING`, `WAITING`,
`COMPLETED`, `ERROR`.

**Only `IDLE`, `THINKING`, and `COMPLETED` are ever emitted.** `WORKING` is never broadcast, so
`AgentAvatar`'s bobbing animation is dead code in practice. Fixing this means calling
`_change_state(AgentState.WORKING)` in the agents' `process_task()` between the LLM call setup and
completion.

### Known contract mismatches

- `EventLog.tsx` maps icons and colors for `CEO_PLANNING`, `DESIGNER_WORKING`, and
  `DEVELOPER_WORKING`. The backend emits none of them.
- `WSEvent.event_type` is typed `string`, not the `WSEventType` union that sits right beside it in
  `types/index.ts`. TypeScript therefore gives you **no** exhaustiveness checking on the reducer
  switch. Consider tightening this if you add events.

---

## Orchestration

`AgentOrchestrator` in `orchestrator.py`. State is `OrchestratorState` (a `TypedDict`): `proposal`,
`ceo_evaluation`, `ceo_plan`, `design_tasks`, `development_tasks`, `design_results`, `dev_results`,
`current_step`, `errors`, `completed`.

```
evaluate_proposal → create_plan → design_work → development_work → finalize_results → END
```

- `evaluate_proposal` / `create_plan` — CEO with `task_type` `"evaluation"` then `"planning"`;
  populates the two task lists from `ceo.delegated_tasks`
- `design_work` / `development_work` — `asyncio.gather` over that node's tasks
- `finalize_results` — sets `completed`, logs a summary

**Parallelism, precisely:** concurrent *within* each work node, sequential *between* them. All
design tasks finish before any development task starts. To make the two overlap, fan out from
`create_plan` to both work nodes instead of chaining them.

There is no conditional branching and no retry edge. An agent failure is recorded in
`state["errors"]` and the graph continues.

---

## Coding Standards

### Python

- **Type hints are mandatory** on every function signature and class attribute. Pydantic models for
  all API payloads and agent output schemas.
- **Async first** — `async`/`await` for LLM calls, WebSocket broadcasting, and anything I/O bound.
- **Target Python 3.9.** The venv is 3.9.6. Do not introduce `match`, `X | Y` runtime unions, or
  other 3.10+ syntax. `list[str]` / `dict[str, Any]` annotations are fine (PEP 585, 3.9+).
- **Structured logging via structlog** — `logger.info("event_name", key=value)`, never f-strings.
  Log an event name plus fields so output stays greppable as JSON.
- **Catch LLM timeouts, rate limits, and WebSocket disconnects explicitly.** Broadcast a
  `*_ERROR` event rather than letting the exception escape.

### TypeScript / React

- Functional components with hooks. **Keep the R3F render loop decoupled from UI state** — read
  store values in the component, mutate refs inside `useFrame`, never `setState` per frame.
- **All inbound-event handling belongs in `reduceEvent` in `useWebSocket.ts`.** Components should
  read the store, not subscribe to the socket.
- `strict`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` are all on.
  Keep `npx tsc --noEmit` clean.
- Path alias `@/*` → `./src/*`.

### Adding a new agent

1. `prompts/<role>_system_prompt.md` — enforce JSON-only output, include the full schema and a
   worked example
2. `agents/<role>_schemas.py` — a root Pydantic model plus nested models
3. `agents/<role>.py` — subclass `BaseAgent`, implement `process_task()`, broadcast
   `<ROLE>_ANALYZING` / `<ROLE>_ANALYSIS_COMPLETE` / `<ROLE>_ERROR`
4. `test_<role>.py` — init, valid schema, invalid-schema rejection, output formatting, status
5. Wire into `main.py` `SimulationRuntime.setup()` **passing `websocket_manager=`** or the agent
   will broadcast nothing
6. Add a node and edges in `orchestrator.py`
7. **Update the frontend**: agent ID and 3D position in `store/index.ts`, event handling in
   `useWebSocket.ts`, icons in `EventLog.tsx`, and this contract section

---

## Architecture Notes

**Orchestrator pattern.** The CEO is the entry node. User proposals hit the CEO first; it evaluates,
plans, and produces typed task lists that the graph routes to the worker agents. Workers never talk
to each other — `message_queue.py` was built for peer-to-peer messaging and never wired up.

**State broadcasting.** Every state change publishes a structured JSON payload over WebSocket so the
3D client can update avatars and labels immediately. `BaseAgent` guards every broadcast with
`if self.websocket_manager:` — that is a test affordance (tests pass `None`), not a no-op in
production.

**Provider indirection.** Agents depend on `LLMProvider` from `llm_provider.py`, which is an alias
for `UniversalLLMProvider`. Provider choice is a single `LLM_PROVIDER` env var; `mock` is loaded
lazily so no API key is needed for tests or local demos.

**Why Pydantic everywhere.** The CEO agent originally parsed LLM output with regex and was
refactored (see `docs/milestones/CEO-REFACTORING-COMPLETED.md`). Validation now fails loudly on
malformed output instead of silently producing half-populated objects. Preserve this property.

---

## Gotchas

1. **Backend must run on port 8000** — `frontend/vite.config.ts` hardcodes the `ws://localhost:8000`
   proxy target.
2. **Vite binds IPv6 only.** `http://127.0.0.1:5173` fails; use `localhost`.
3. **`dev.sh` has no execute bit** — `bash dev.sh`.
4. **A new agent that broadcasts nothing** almost always means `websocket_manager=` was omitted at
   construction.
5. **A frontend that shows a connection but never updates** almost always means an agent ID that
   isn't one of the three hardcoded in `store/index.ts`.
6. **VS Code's Electron is not Node.** `ELECTRON_RUN_AS_NODE=1 ".../Code" script.js` runs `tsc`, but
   Vite fails on rollup's native module (macOS code-signing Team ID mismatch).
