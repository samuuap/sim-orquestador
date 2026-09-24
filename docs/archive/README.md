# Archived Status Documents — Do Not Trust

These six files are kept for historical interest only. They were written as progress snapshots
during development and **each contains claims that are now known to be false.** They were moved out
of the repository root on 2026-09-24 because having six overlapping "project complete" documents
that contradicted each other and the code was a standing source of confusion.

**For current, verified information use [`../../README.md`](../../README.md),
[`../../CLAUDE.md`](../../CLAUDE.md), and
[`../milestones/MILESTONE-6-COMPLETED.md`](../milestones/MILESTONE-6-COMPLETED.md).**

## Known false claims in these files

| Claim | Reality |
|---|---|
| "16/16 tests passing" (in all six) | 22 tests collected: **21 passed, 1 skipped**. The count omitted `test_agents`, `test_integration`, `test_websocket`, `test_orchestrator` |
| "Parallel Designer + Developer execution" | Sequential. The LangGraph edge is `design_work → development_work`; concurrency exists only *within* each node |
| "Python 3.11+" required | Runs on Python 3.9.6; no 3.10+ syntax is used |
| "6 frontend components" | 9 exist. `AgentDetailsPanel.tsx`, `ProposalPanel.tsx`, and `TopBar.tsx` were undocumented |
| "MIT License — see LICENSE file" (`PROJECT-COMPLETE.md`) | No LICENSE file exists |
| "Production ready" / "All core features implemented and tested" | The frontend had never been built or executed when this was written. First verified run was Milestone 6 |
| `QUICK-START.md` paths under `C:\Users\samuel\Documents\` | Wrong machine and OS |

## Contents

- **`PROJECT-COMPLETE.md`** — full feature and structure summary. Superseded by `README.md`
- **`FINAL-CHECKLIST.md`** — itemized implementation checklist. Its own inventory contradicts its
  "16/16" total
- **`EXECUTIVE-SUMMARY.md`** — the most optimistic of the set; declares the project deployment-ready
- **`FRONTEND-COMPLETE.md`** — frontend component summary, written before the frontend ever ran
- **`QUICK-START.md`** — setup walkthrough with hardcoded Windows paths. Superseded by the
  Quickstart section of `README.md`
- **`READY-FOR-COMMIT.md`** — a staging plan for a commit that has since been made (`541f0f2`).
  Fully obsolete

## Why keep them

They record how the project was described at each stage, which is useful context for why the code
looks the way it does. They also stand as a reminder: every one of these documents was written
without running the thing it described.
