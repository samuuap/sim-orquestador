"""Simple test script to verify WebSocket connectivity."""
import asyncio
import json
import websockets


async def test_websocket():
    """Test WebSocket connection to the Office Agents Simulator."""
    uri = "ws://localhost:8000/ws/office"

    print("Connecting to WebSocket server...")

    try:
        async with websockets.connect(uri) as websocket:
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
        print(f"Error: {e}")
        return False

    return True


if __name__ == "__main__":
    print("=" * 60)
    print("Office Agents Simulator - WebSocket Test")
    print("=" * 60)
    print("\nMake sure the backend server is running:")
    print("  cd backend && source venv/Scripts/activate && python main.py")
    print("\n" + "=" * 60 + "\n")

    success = asyncio.run(test_websocket())

    if success:
        print("\n" + "=" * 60)
        print("All tests passed!")
        print("=" * 60)
