"""FastAPI application with WebSocket support for Office Agents Simulator."""
import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

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

        # Iterate over a snapshot: handlers may mutate the connection map.
        for client_id, websocket in list(self.active_connections.items()):
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


class SimulationRuntime:
    """
    Owns the agents and the orchestrator, and serialises proposal runs.

    Only one proposal is orchestrated at a time: the agents carry per-run state
    (the CEO's current proposal and delegated tasks), so overlapping runs would
    interleave and corrupt each other.
    """

    def __init__(self, websocket_manager: WebSocketManager):
        self.websocket_manager = websocket_manager
        self.orchestrator = None
        self._run_lock = asyncio.Lock()
        self._current_task: Optional[asyncio.Task] = None

    def setup(self) -> None:
        """Build the LLM provider, agents and orchestrator."""
        # Imported here so a configuration error surfaces during startup with a
        # clear message rather than at module-import time.
        from agents.ceo import CEOAgent
        from agents.designer import DesignerAgent
        from agents.developer import DeveloperAgent
        from agents.llm_provider import get_llm_provider
        from orchestrator import AgentOrchestrator

        provider = get_llm_provider()

        ceo = CEOAgent(
            agent_id="ceo_001",
            llm_provider=provider,
            websocket_manager=self.websocket_manager
        )
        designer = DesignerAgent(
            agent_id="designer_001",
            llm_provider=provider,
            websocket_manager=self.websocket_manager
        )
        developer = DeveloperAgent(
            agent_id="developer_001",
            llm_provider=provider,
            websocket_manager=self.websocket_manager
        )

        self.agents = {agent.agent_id: agent for agent in (ceo, designer, developer)}
        self.orchestrator = AgentOrchestrator(
            ceo_agent=ceo,
            designer_agent=designer,
            developer_agent=developer,
            websocket_manager=self.websocket_manager
        )

        logger.info(
            "simulation_runtime_ready",
            provider=provider.provider,
            model=provider.model,
            agents=list(self.agents)
        )

    @property
    def is_busy(self) -> bool:
        """True while a proposal is being orchestrated."""
        return self._run_lock.locked()

    async def submit_proposal(self, proposal: str) -> bool:
        """
        Kick off orchestration for a proposal in the background.

        Returns:
            True if the run was started, False if one is already in flight.
        """
        if self.is_busy:
            await self.websocket_manager.broadcast(WSEvent(
                event_type="SYSTEM_MESSAGE",
                timestamp=datetime.utcnow(),
                payload={
                    "level": "warning",
                    "message": "The team is still working on the previous proposal."
                }
            ))
            return False

        self._current_task = asyncio.create_task(self._run(proposal))
        return True

    async def _run(self, proposal: str) -> None:
        """Run one orchestration, broadcasting failures rather than raising."""
        async with self._run_lock:
            await self.websocket_manager.broadcast(WSEvent(
                event_type="PROPOSAL_RECEIVED",
                timestamp=datetime.utcnow(),
                payload={"proposal": proposal}
            ))

            try:
                await self.orchestrator.orchestrate(proposal)
            except Exception as e:  # noqa: BLE001 - the run must never kill the server
                logger.error("orchestration_unhandled_error", error=str(e), exc_info=True)
                await self.websocket_manager.broadcast(WSEvent(
                    event_type="ORCHESTRATION_FAILED",
                    timestamp=datetime.utcnow(),
                    payload={"error": str(e)}
                ))

    def agent_statuses(self) -> list:
        """Current status of every agent."""
        return [agent.get_status() for agent in self.agents.values()]

    async def shutdown(self) -> None:
        """Cancel any in-flight orchestration."""
        if self._current_task and not self._current_task.done():
            self._current_task.cancel()
            try:
                await self._current_task
            except asyncio.CancelledError:
                pass


runtime = SimulationRuntime(ws_manager)


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

    # Build agents and orchestrator
    runtime.setup()

    # Start WebSocket heartbeat
    ws_manager.start_heartbeat()

    yield

    # Shutdown
    logger.info("application_shutdown")
    ws_manager.stop_heartbeat()
    await runtime.shutdown()


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


class ProposalRequest(BaseModel):
    """Body for submitting a project proposal over HTTP."""
    proposal: str = Field(..., min_length=1, description="The project proposal to evaluate")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return JSONResponse({
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.app_env,
        "llm_provider": settings.llm_provider,
        "websocket_connections": len(ws_manager.active_connections),
        "orchestrator_busy": runtime.is_busy
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
            "proposals": "/api/proposals",
            "agents": "/api/agents",
            "docs": "/docs"
        }
    }


@app.post("/api/proposals", status_code=202)
async def submit_proposal(request: ProposalRequest):
    """
    Submit a proposal for orchestration.

    Results are not returned here: the run is asynchronous and every step is
    streamed to WebSocket clients. Returns 409 if a run is already in flight.
    """
    started = await runtime.submit_proposal(request.proposal)

    if not started:
        raise HTTPException(
            status_code=409,
            detail="An orchestration is already running. Wait for it to finish."
        )

    return {"status": "accepted", "proposal": request.proposal}


@app.get("/api/agents")
async def get_agents():
    """Get the current status of every agent."""
    return {"agents": runtime.agent_statuses(), "orchestrator_busy": runtime.is_busy}


async def _handle_client_message(data: Dict[str, Any], client_id: str) -> None:
    """
    Route one inbound WebSocket message.

    Accepted shapes:
        {"type": "SUBMIT_PROPOSAL", "payload": {"proposal": "..."}}
        {"type": "PING"}
    """
    message_type = str(data.get("type", "")).upper()

    if message_type == "SUBMIT_PROPOSAL":
        payload = data.get("payload") or {}
        proposal = (payload.get("proposal") or "").strip()

        if not proposal:
            await ws_manager.send_personal_message(
                WSEvent(
                    event_type="SYSTEM_MESSAGE",
                    timestamp=datetime.utcnow(),
                    payload={"level": "error", "message": "Proposal text is required"}
                ).model_dump(mode="json"),
                client_id
            )
            return

        await runtime.submit_proposal(proposal)
        return

    if message_type == "PING":
        await ws_manager.send_personal_message(
            WSEvent(
                event_type="PONG",
                timestamp=datetime.utcnow(),
                payload={}
            ).model_dump(mode="json"),
            client_id
        )
        return

    logger.warning("unknown_message_type", client_id=client_id, message_type=message_type)
    await ws_manager.send_personal_message(
        WSEvent(
            event_type="SYSTEM_MESSAGE",
            timestamp=datetime.utcnow(),
            payload={
                "level": "warning",
                "message": f"Unknown message type: {message_type or '(missing)'}"
            }
        ).model_dump(mode="json"),
        client_id
    )


@app.websocket("/ws/office")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time office simulation events."""
    client_id = await ws_manager.connect(websocket)

    try:
        # Send welcome message with the current world state so a client that
        # connects mid-run renders the right thing immediately.
        welcome_event = WSEvent(
            event_type="CONNECTION_ESTABLISHED",
            timestamp=datetime.utcnow(),
            payload={
                "client_id": client_id,
                "message": "Connected to Office Agents Simulator",
                "agents": runtime.agent_statuses(),
                "orchestrator_busy": runtime.is_busy
            }
        )
        await ws_manager.send_personal_message(welcome_event.model_dump(mode="json"), client_id)

        # Listen for incoming messages
        while True:
            data = await websocket.receive_json()
            logger.info("websocket_message_received", client_id=client_id, data=data)
            await _handle_client_message(data, client_id)

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
