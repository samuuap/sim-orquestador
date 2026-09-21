# Office Agents Simulator - Backend

FastAPI-based backend for the Office Agents Simulator, providing real-time WebSocket communication and multi-agent orchestration.

## Setup

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv
```

### 2. Activate Virtual Environment

**Windows:**
```bash
venv\Scripts\activate
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment

Copy `.env.example` to `.env` and configure your LLM provider:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
- For OpenAI: Set `OPENAI_API_KEY`
- For Anthropic: Set `ANTHROPIC_API_KEY`

### 5. Run Development Server

```bash
uvicorn main:app --reload --port 8000
```

Or use the Python entry point:

```bash
python main.py
```

## API Endpoints

- **GET** `/` - API information
- **GET** `/health` - Health check
- **GET** `/docs` - Interactive API documentation (Swagger UI)
- **GET** `/api/connections` - Active WebSocket connections
- **WebSocket** `/ws/office` - Real-time office simulation events

## WebSocket Events

### Connection Events

```json
{
  "event_type": "CONNECTION_ESTABLISHED",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {
    "client_id": "uuid",
    "message": "Connected to Office Agents Simulator"
  }
}
```

### Heartbeat

```json
{
  "event_type": "HEARTBEAT",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {
    "message": "ping"
  }
}
```

## Testing WebSocket Connection

Use `wscat` or any WebSocket client:

```bash
npm install -g wscat
wscat -c ws://localhost:8000/ws/office
```

Or use Python:

```python
import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://localhost:8000/ws/office"
    async with websockets.connect(uri) as websocket:
        # Receive welcome message
        message = await websocket.recv()
        print(f"Received: {message}")
        
        # Send test message
        await websocket.send(json.dumps({
            "type": "test",
            "message": "Hello from client"
        }))
        
        # Receive response
        response = await websocket.recv()
        print(f"Response: {response}")

asyncio.run(test_ws())
```

## Project Structure

```
backend/
├── main.py              # FastAPI application & WebSocket manager
├── config.py            # Settings and configuration
├── schemas.py           # Pydantic models for events and data
├── requirements.txt     # Python dependencies
├── .env.example         # Environment template
├── .gitignore          # Git ignore rules
├── agents/             # Agent implementations (to be added)
│   └── __init__.py
└── tests/              # Test suite (to be added)
```

## Next Steps

- [ ] Implement base agent classes (Milestone 2)
- [ ] Create CEO agent (Milestone 3)
- [ ] Add Designer and Developer agents (Milestone 4)
- [ ] Integrate LangGraph orchestration (Milestone 5)
