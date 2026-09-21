"""FastAPI application with WebSocket support for Office Agents Simulator."""
import asyncio
import logging
import uuid
from datetime import datetime
from typing import Dict, Optional
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from schemas import WSEvent, ConnectionInfo


# Configure structured logging
# Convert string log level to logging constant
log_level = getattr(logging, settings.log_level.upper(), logging.INFO)

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(log_level),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


class WebSocketManager:
    """Manages WebSocket connections and broadcasting."""

    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_info: Dict[str, ConnectionInfo] = {}
        self._heartbeat_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket) -> str:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        client_id = str(uuid.uuid4())
        self.active_connections[client_id] = websocket
        self.connection_info[client_id] = ConnectionInfo(
            client_id=client_id,
            connected_at=datetime.utcnow(),
            last_heartbeat=datetime.utcnow()
        )
        logger.info("websocket_connected", client_id=client_id, total_connections=len(self.active_connections))
        return client_id

    def disconnect(self, client_id: str):
        """Remove a WebSocket connection."""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.connection_info:
            del self.connection_info[client_id]
        logger.info("websocket_disconnected", client_id=client_id, total_connections=len(self.active_connections))

    async def send_personal_message(self, message: dict, client_id: str):
        """Send a message to a specific client."""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error("send_message_failed", client_id=client_id, error=str(e))
                self.disconnect(client_id)

    async def broadcast(self, event: WSEvent):
        """Broadcast an event to all connected clients."""
        event_dict = event.model_dump(mode="json")
        disconnected_clients = []

        for client_id, websocket in self.active_connections.items():
            try:
                await websocket.send_json(event_dict)
                logger.debug("broadcast_sent", client_id=client_id, event_type=event.event_type)
            except Exception as e:
                logger.error("broadcast_failed", client_id=client_id, error=str(e))
                disconnected_clients.append(client_id)

        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)

    async def heartbeat_loop(self):
        """Send periodic heartbeat to maintain connections."""
        while True:
            await asyncio.sleep(settings.ws_heartbeat_interval)
            heartbeat_event = WSEvent(
                event_type="HEARTBEAT",
                timestamp=datetime.utcnow(),
                payload={"message": "ping"}
            )
            await self.broadcast(heartbeat_event)
            logger.debug("heartbeat_sent", connections=len(self.active_connections))

    def start_heartbeat(self):
        """Start the heartbeat background task."""
        if self._heartbeat_task is None or self._heartbeat_task.done():
            self._heartbeat_task = asyncio.create_task(self.heartbeat_loop())
            logger.info("heartbeat_started", interval=settings.ws_heartbeat_interval)

    def stop_heartbeat(self):
        """Stop the heartbeat background task."""
        if self._heartbeat_task and not self._heartbeat_task.done():
            self._heartbeat_task.cancel()
            logger.info("heartbeat_stopped")


# Global WebSocket manager instance
ws_manager = WebSocketManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("application_startup", env=settings.app_env)

    # Validate LLM configuration
    try:
        settings.validate_llm_config()
        logger.info("llm_config_validated", provider=settings.llm_provider)
    except ValueError as e:
        logger.error("llm_config_invalid", error=str(e))
        raise

    # Start WebSocket heartbeat
    ws_manager.start_heartbeat()

    yield

    # Shutdown
    logger.info("application_shutdown")
    ws_manager.stop_heartbeat()


# Initialize FastAPI application
app = FastAPI(
    title="Office Agents Simulator API",
    description="Backend API for real-time multi-agent office simulation",
    version="0.1.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return JSONResponse({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.app_env,
        "websocket_connections": len(ws_manager.active_connections)
    })


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "service": "Office Agents Simulator",
        "version": "0.1.0",
        "endpoints": {
            "health": "/health",
            "websocket": "/ws/office",
            "docs": "/docs"
        }
    }


@app.websocket("/ws/office")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time office simulation events."""
    client_id = await ws_manager.connect(websocket)

    try:
        # Send welcome message
        welcome_event = WSEvent(
            event_type="CONNECTION_ESTABLISHED",
            timestamp=datetime.utcnow(),
            payload={
                "client_id": client_id,
                "message": "Connected to Office Agents Simulator"
            }
        )
        await ws_manager.send_personal_message(welcome_event.model_dump(mode="json"), client_id)

        # Listen for incoming messages
        while True:
            data = await websocket.receive_json()
            logger.info("websocket_message_received", client_id=client_id, data=data)

            # Echo back for now (will be replaced with agent processing)
            response_event = WSEvent(
                event_type="MESSAGE_ACK",
                timestamp=datetime.utcnow(),
                payload={"received": data, "status": "acknowledged"}
            )
            await ws_manager.send_personal_message(response_event.model_dump(mode="json"), client_id)

    except WebSocketDisconnect:
        ws_manager.disconnect(client_id)
        logger.info("websocket_client_disconnected", client_id=client_id)
    except Exception as e:
        logger.error("websocket_error", client_id=client_id, error=str(e))
        ws_manager.disconnect(client_id)


@app.get("/api/connections")
async def get_connections():
    """Get active WebSocket connection information."""
    return {
        "active_connections": len(ws_manager.active_connections),
        "connections": [
            info.model_dump(mode="json")
            for info in ws_manager.connection_info.values()
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level=settings.log_level.lower()
    )
