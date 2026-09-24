"""Smoke test verifying WebSocket connectivity against a running backend.

Run it directly (``python test_websocket.py``) or via pytest. Under pytest it is
skipped when nothing is listening on the WebSocket port, since it needs a live
server rather than being a self-contained unit test.
"""
import asyncio
import json
import socket

import pytest
import websockets

WS_HOST = "localhost"
WS_PORT = 8000
WS_URI = f"ws://{WS_HOST}:{WS_PORT}/ws/office"


def _server_is_running() -> bool:
    """Return True if something is accepting connections on the backend port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((WS_HOST, WS_PORT)) == 0


async def test_websocket():
    """Test WebSocket connection to the Office Agents Simulator."""
    if not _server_is_running():
        pytest.skip(f"No backend listening on {WS_HOST}:{WS_PORT}; start it with `uvicorn main:app`")

    print("Connecting to WebSocket server...")

    try:
        async with websockets.connect(WS_URI) as websocket:
            # Receive welcome message
            welcome = await websocket.recv()
            welcome_data = json.loads(welcome)
            print(f"Connected! Received: {welcome_data['event_type']}")
            print(f"  Client ID: {welcome_data['payload']['client_id']}")

            # Send test message
            test_message = {
                "type": "test_proposal",
                "content": "Build a user authentication system"
            }
            await websocket.send(json.dumps(test_message))
            print(f"Sent test message: {test_message['content']}")

            # Receive acknowledgment
            response = await websocket.recv()
            response_data = json.loads(response)
            print(f"Received response: {response_data['event_type']}")

            print("\nWebSocket test completed successfully!")

    except Exception as e:
        pytest.fail(f"WebSocket smoke test failed: {e}")


if __name__ == "__main__":
    print("=" * 60)
    print("Office Agents Simulator - WebSocket Test")
    print("=" * 60)
    print("\nMake sure the backend server is running:")
    print("  cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000")
    print("\n" + "=" * 60 + "\n")

    if not _server_is_running():
        raise SystemExit(f"No backend listening on {WS_HOST}:{WS_PORT}")

    asyncio.run(test_websocket())

    print("\n" + "=" * 60)
    print("All tests passed!")
    print("=" * 60)
