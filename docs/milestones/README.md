# Build History

Chronological record of how the project was built. These are point-in-time documents — where one
disagrees with [`../../README.md`](../../README.md) or [`../../CLAUDE.md`](../../CLAUDE.md), those
are authoritative.

| # | Milestone | Date | What it delivered |
|---|---|---|---|
| 1 | [Backend Scaffolding](MILESTONE-1-COMPLETED.md) | Sep 2026 | FastAPI app, WebSocket manager, structlog, config, base schemas |
| 2 | [Agent Foundation](MILESTONE-2-COMPLETED.md) | Sep 2026 | `BaseAgent` state machine, LLM provider layer, message queue |
| 3 | [CEO Agent](MILESTONE-3-COMPLETED.md) | Sep 2026 | First agent — originally regex-based output parsing |
| 4 | [Designer Agent](MILESTONE-4-COMPLETED.md) | Sep 2026 | Designer agent, established the Pydantic-schema pattern |
| — | [CEO Refactoring](CEO-REFACTORING-COMPLETED.md) | Sep 2026 | Moved the CEO from regex parsing to Pydantic, matching Designer |
| 5 | [Developer Agent](MILESTONE-5-COMPLETED.md) | Sep 21, 2026 | Developer agent — largest schema (10 models) and prompt (15.5k chars) |
| 6 | [Full-Stack Integration](MILESTONE-6-COMPLETED.md) | Sep 24, 2026 | **First verified end-to-end run in a browser.** Wire contract confirmed; 6 gaps recorded; prior doc claims corrected |

Milestone 6 is the one to read if you only read one — it is the only document in this project whose
claims were all verified by execution rather than by inspection.

Note that milestones 1–5 each carry a "Next Steps" section listing options that were considered at
the time. Those lists are historical; the current roadmap lives in `README.md`.
