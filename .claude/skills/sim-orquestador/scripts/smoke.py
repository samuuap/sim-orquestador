#!/usr/bin/env python3
"""End-to-end smoke test for the Office Agents Simulator.

Submits a proposal over the WebSocket and asserts the contract the frontend depends on:
the three agent IDs, the six metrics keys, and a terminal ORCHESTRATION_COMPLETE.

Run from backend/ with the venv active (it needs the `websockets` package):

    python ../.claude/skills/sim-orquestador/scripts/smoke.py
    python ../.claude/skills/sim-orquestador/scripts/smoke.py --via-proxy

Exits 0 if the contract holds, 1 otherwise. Targets 3.9+ (no 3.10 syntax).
"""

import argparse
import asyncio
import json
import sys
import time
from collections import Counter
from typing import Any, Dict, List, Optional, Set

import websockets

# What the frontend hardcodes. store/index.ts silently drops unknown agent IDs.
EXPECTED_AGENT_IDS = {"ceo_001", "designer_001", "developer_001"}

# What applyMetrics() in useWebSocket.ts reads off payload.metrics.
EXPECTED_METRICS_KEYS = {
    "total_tasks",
    "completed_tasks",
    "failed_tasks",
    "total_tokens",
    "total_cost",
    "average_duration",
}

PROPOSAL = (
    "Build a task management web app with user authentication, "
    "a REST API and a React dashboard."
)


class Capture:
    def __init__(self) -> None:
        self.types: Counter = Counter()
        self.envelope_ids: Set[str] = set()
        self.states: Set[str] = set()
        self.connection_ids: List[str] = []
        self.metrics_keys: Optional[Set[str]] = None
        self.errors: List[str] = []
        self.complete = False

    def feed(self, msg: Dict[str, Any]) -> None:
        et = msg.get("event_type") or "<missing event_type>"
        payload = msg.get("payload") or {}
        self.types[et] += 1

        agent_id = msg.get("agent_id")
        if agent_id:
            self.envelope_ids.add(agent_id)

        if et == "CONNECTION_ESTABLISHED":
            self.connection_ids = [a.get("agent_id") for a in payload.get("agents", [])]
        elif et == "AGENT_STATE_CHANGED":
            if payload.get("new_state"):
                self.states.add(payload["new_state"])
        elif et in ("TASK_COMPLETED", "TASK_FAILED"):
            metrics = payload.get("metrics")
            if isinstance(metrics, dict) and self.metrics_keys is None:
                self.metrics_keys = set(metrics.keys())
        elif et == "ORCHESTRATION_COMPLETE":
            self.complete = True
            self.errors.extend(payload.get("errors") or [])
        elif et in ("ORCHESTRATION_FAILED", "CEO_ERROR", "DESIGNER_ERROR", "DEVELOPER_ERROR"):
            self.errors.append("{0}: {1}".format(et, payload.get("error", "?")))


async def run(url: str, timeout: float, verbose: bool) -> Capture:
    cap = Capture()
    async with websockets.connect(url) as ws:

        async def reader() -> None:
            while True:
                msg = json.loads(await ws.recv())
                cap.feed(msg)
                if verbose:
                    et = msg.get("event_type")
                    body = json.dumps(msg.get("payload") or {})[:110]
                    print("  <- {0:34} {1}".format(et, body))

        task = asyncio.ensure_future(reader())
        await asyncio.sleep(1.0)

        print("-> SUBMIT_PROPOSAL")
        await ws.send(json.dumps({"type": "SUBMIT_PROPOSAL", "payload": {"proposal": PROPOSAL}}))

        deadline = time.time() + timeout
        while time.time() < deadline and not cap.complete:
            await asyncio.sleep(0.25)

        task.cancel()
    return cap


def report(cap: Capture) -> bool:
    ok = True

    def check(label: str, passed: bool, detail: str = "") -> None:
        nonlocal ok
        print("  {0} {1}{2}".format("PASS" if passed else "FAIL", label, detail))
        if not passed:
            ok = False

    print("\n=== contract ===")

    got_conn = set(cap.connection_ids)
    check(
        "agent IDs in CONNECTION_ESTABLISHED",
        got_conn == EXPECTED_AGENT_IDS,
        "" if got_conn == EXPECTED_AGENT_IDS else "  expected {0}, got {1}".format(
            sorted(EXPECTED_AGENT_IDS), sorted(got_conn)
        ),
    )

    unknown = cap.envelope_ids - EXPECTED_AGENT_IDS
    check(
        "no unknown agent_id in envelopes",
        not unknown,
        "" if not unknown else "  frontend will silently drop: {0}".format(sorted(unknown)),
    )

    if cap.metrics_keys is None:
        check("metrics keys on TASK_COMPLETED", False, "  no TASK_COMPLETED carried metrics")
    else:
        missing = EXPECTED_METRICS_KEYS - cap.metrics_keys
        check(
            "metrics keys on TASK_COMPLETED",
            not missing,
            "" if not missing else "  missing {0}".format(sorted(missing)),
        )

    check("reached ORCHESTRATION_COMPLETE", cap.complete)
    check(
        "no agent or orchestration errors",
        not cap.errors,
        "" if not cap.errors else "  {0}".format(cap.errors[:3]),
    )

    print("\n=== observed ===")
    print("  agent states: {0}".format(sorted(cap.states)))
    if "WORKING" not in cap.states:
        print("  note: WORKING never emitted - avatar 'working' animation stays dead (known gap)")
    print("  {0} events across {1} types:".format(sum(cap.types.values()), len(cap.types)))
    for name, count in sorted(cap.types.items()):
        print("    {0:3}x {1}".format(count, name))

    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--via-proxy",
        action="store_true",
        help="connect through the Vite dev proxy on :5173 instead of the backend on :8000",
    )
    parser.add_argument("--url", help="explicit WebSocket URL, overrides --via-proxy")
    parser.add_argument("--timeout", type=float, default=90.0, help="seconds to wait (default 90)")
    parser.add_argument("-v", "--verbose", action="store_true", help="print every event")
    args = parser.parse_args()

    if args.url:
        url = args.url
    elif args.via_proxy:
        url = "ws://localhost:5173/ws/office"
    else:
        url = "ws://127.0.0.1:8000/ws/office"

    print("connecting to {0}".format(url))
    try:
        cap = asyncio.run(run(url, args.timeout, args.verbose))
    except OSError as exc:
        print("\nFAIL  could not connect: {0}".format(exc))
        if args.via_proxy:
            print("      is the frontend running? (cd frontend && npm run dev)")
        else:
            print("      is the backend running on port 8000?")
        return 1

    passed = report(cap)
    print("\n{0}".format("SMOKE TEST PASSED" if passed else "SMOKE TEST FAILED"))
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
