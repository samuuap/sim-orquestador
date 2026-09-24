---
name: sim-orquestador
description: Run, demo, smoke-test, or debug the Office Agents Simulator in this repo (FastAPI + LangGraph backend, React/Three.js 3D office frontend). Use when asked to start, restart, or launch the stack or show the 3D office; when the frontend connects but agents never move or metrics stay at zero; when WebSocket events don't reach the UI; when switching LLM_PROVIDER to a real provider; or when adding a new agent role. Covers the mandatory port 8000, Vite's IPv6-only bind, and the silent failure modes of the backend↔frontend event contract.
---

# Running and debugging the Office Agents Simulator

Operational runbook. The architecture, coding standards, and the full 22-event wire contract live in
`CLAUDE.md`, which is already in context — **do not restate them here.** This file is for the
procedural steps and the failure modes that are not visible from reading the code.

## When to use

- Starting, restarting, or demoing the stack
- Diagnosing "it's connected but nothing happens"
- Verifying a change end to end without opening a browser
- Switching from the mock provider to a real LLM

## Starting the stack

Two terminals. **The backend must be on port 8000** — `frontend/vite.config.ts` hardcodes
`ws://localhost:8000` as its proxy target, and any other port fails silently.

```bash
# Terminal 1
cd backend && source venv/bin/activate
python -m uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

Then open **<http://localhost:5173>**. Use `localhost`, never `127.0.0.1` — Vite 6 binds IPv6 only,
so `127.0.0.1:5173` refuses the connection while `localhost:5173` works. This also means
`curl 127.0.0.1:5173` returning nothing does **not** mean Vite is down.

`bash dev.sh` runs both in one terminal (`Ctrl+C` stops both). It has no execute bit, so `./dev.sh`
fails. It also reinstalls pip deps on every launch, which makes it slower for iteration.

### Confirm it is actually up

```bash
curl -s http://127.0.0.1:8000/health          # backend: IPv4 is fine here
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
```

`/health` reports the active provider, the live WebSocket connection count, and whether the
orchestrator is busy. **`websocket_connections` rising to 1 after you open the page is the single
best signal that the whole chain works** — it proves the browser loaded the bundle, React mounted,
and the socket completed its handshake through the Vite proxy.

## Verifying end to end without a browser

`scripts/smoke.py` connects over the WebSocket, submits a proposal, and asserts the contract the
frontend depends on: the three agent IDs, the six metrics keys, and a terminal
`ORCHESTRATION_COMPLETE`. Run it after any change to an event name, payload field, or agent ID.

```bash
cd backend && source venv/bin/activate
python ../.claude/skills/sim-orquestador/scripts/smoke.py                  # direct to :8000
python ../.claude/skills/sim-orquestador/scripts/smoke.py --via-proxy      # through Vite :5173
```

Use `--via-proxy` to test the exact path the browser takes; it requires the frontend to be running.
The script exits non-zero and prints what mismatched, so it works in a pre-commit check or CI.

## Debugging: symptom → cause

These failures are all silent. Nothing logs an error.

| Symptom | Cause |
|---|---|
| Frontend shows "connected" but agents never move and metrics stay 0 | An agent ID that is not one of `ceo_001` / `designer_001` / `developer_001`. `patchAgent` in `store/index.ts` drops updates for unknown IDs without warning |
| A specific agent stays `IDLE` while others work | That agent was constructed without `websocket_manager=` in `SimulationRuntime.setup()` (`main.py`), so it broadcasts nothing |
| Metrics render as `undefined` or `NaN` | A renamed key in `payload.metrics`. `applyMetrics` in `useWebSocket.ts` expects exactly `total_tasks`, `completed_tasks`, `failed_tasks`, `total_tokens`, `total_cost`, `average_duration` |
| Events appear in the Event Log but change no state | Expected for the *_COMPLETE and *_ERROR events — they are display-only. Only the events listed as state-driving in `CLAUDE.md` reach the reducer |
| Avatars never play the "working" bobbing animation | Not a bug you introduced. Agents only ever emit `IDLE → THINKING → COMPLETED`; `WORKING` is defined on both sides but never broadcast |
| WebSocket never connects | Backend not on port 8000, or you opened `127.0.0.1:5173` instead of `localhost:5173` |
| `npm`/`node: command not found` | Node lives at `~/.local/node-v24.21.0-darwin-arm64` with symlinks in `~/.local/bin`. There is no Homebrew on this machine. VS Code's Electron can run `tsc` via `ELECTRON_RUN_AS_NODE=1` but **cannot** run Vite (macOS blocks rollup's native module over a code-signing Team ID mismatch) |

When a proposal returns HTTP 409, the orchestrator is already running one. It processes a single
proposal at a time; wait for `ORCHESTRATION_COMPLETE`.

## Switching to a real LLM provider

Only `mock` has ever been exercised, so treat the first real run as an experiment, not a
regression test.

1. Set `LLM_PROVIDER` in `backend/.env` to one of `openai`, `anthropic`, `deepseek`, `nvidia`,
   `minimax`, `glm`, `custom_openai`, and set the matching `<PROVIDER>_API_KEY`.
2. Restart the backend. Confirm the switch took effect via `/health` → `llm_provider`.
3. Submit one short proposal and watch for `CEO_ERROR` / `DESIGNER_ERROR` / `DEVELOPER_ERROR`.

Expect failures here that the mock cannot produce, because the mock always returns clean,
schema-valid JSON:

- Prose wrapped around the JSON, or fenced code blocks
- Output truncated mid-object by a token limit — the Developer prompt is 15.5k characters and its
  schema has 10 nested models, so its responses are the longest and the most likely to be cut off
- Enum values the model invented rather than chose
- Timeouts and rate limits under the parallel `asyncio.gather` in the work nodes

Every one of these surfaces as a Pydantic `ValidationError` caught by the agent, which broadcasts a
`*_ERROR` event. Read the backend log for the raw response before assuming the schema is wrong.

## Adding an agent role

Follow the seven-step recipe in `CLAUDE.md`. The step that is always missed is passing
`websocket_manager=` when constructing the agent in `main.py`, and the step that is missed second is
registering the new agent ID and 3D position in `frontend/src/store/index.ts`. Both fail silently.

After wiring it up, run `scripts/smoke.py` and confirm the new agent ID appears in the
`CONNECTION_ESTABLISHED` payload.

## Stopping

```bash
pkill -f "uvicorn main:app"; pkill -f "node_modules/.bin/vite"
```
