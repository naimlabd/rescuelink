from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import socketio

from .notifications import NotificationLog
from .service import IncidentService
from .storage import IncidentRepository

@dataclass(slots=True)
class AppConfig:
    host: str = "127.0.0.1"
    port: int = 8000
    data_dir: Path = Path(__file__).resolve().parent.parent / "data"

config = AppConfig()
repository = IncidentRepository(config.data_dir / "rescuelink.db")
notifications = NotificationLog(config.data_dir / "notifications")

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

class RealtimeNotificationLog(NotificationLog):
    def emit(self, stream: str, payload: dict[str, object]) -> None:
        super().emit(stream, payload)
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(sio.emit(stream, payload))
        except RuntimeError:
            pass

service = IncidentService(repository, RealtimeNotificationLog(config.data_dir / "notifications"))

app = FastAPI(title="RescueLink API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def respond(payload: Any, status: int) -> JSONResponse:
    return JSONResponse(content=payload, status_code=status)

@app.get("/webhook/incidents/active")
@app.get("/incidents/active")
def get_active_incidents():
    payload, status = service.get_active_incidents()
    return respond(payload, status)

@app.get("/webhook/incident/status")
@app.get("/incident/status")
def get_incident_status(incident_id: str = ""):
    payload, status = service.get_incident_status(incident_id)
    return respond(payload, status)

@app.get("/webhook/patient/incidents")
@app.get("/patient/incidents")
def get_patient_incidents(patient_session_id: str = ""):
    payload, status = service.get_patient_incidents(patient_session_id)
    return respond(payload, status)

@app.get("/webhook/system/health")
@app.get("/system/health")
def get_system_health():
    payload, status = service.get_system_health()
    return respond(payload, status)

@app.get("/webhook/system/notifications")
@app.get("/system/notifications")
def get_notification_activity(limit: int = 10):
    payload, status = service.get_notification_activity(limit)
    return respond(payload, status)

@app.get("/webhook/system/analytics")
@app.get("/system/analytics")
def get_analytics():
    payload, status = service.get_analytics()
    return respond(payload, status)

@app.post("/webhook/incident-report")
@app.post("/incident-report")
async def report_incident(request: Request):
    body = await request.json()
    payload, status = service.report_incident(body)
    return respond(payload, status)

@app.post("/webhook/incident/respond")
@app.post("/incident/respond")
async def respond_to_incident(request: Request):
    body = await request.json()
    payload, status = service.respond_to_incident(body)
    return respond(payload, status)

@app.post("/webhook/incident/hospital-request")
@app.post("/incident/hospital-request")
async def request_hospital_support(request: Request):
    body = await request.json()
    payload, status = service.request_hospital_support(body)
    return respond(payload, status)

@app.post("/webhook/hospital/update")
@app.post("/hospital/update")
async def update_hospital_status(request: Request):
    body = await request.json()
    payload, status = service.update_hospital_status(body)
    return respond(payload, status)

@app.post("/webhook/incident/message")
@app.post("/incident/message")
async def send_message(request: Request):
    body = await request.json()
    payload, status = service.send_message(body)
    return respond(payload, status)

@app.get("/webhook/incident/messages")
@app.get("/incident/messages")
def get_messages(incident_id: str = ""):
    payload, status = service.get_messages(incident_id)
    return respond(payload, status)

@app.post("/webhook/ai/triage")
@app.post("/ai/triage")
async def analyze_emergency(request: Request):
    body = await request.json()
    payload, status = service.analyze_emergency(body)
    return respond(payload, status)

@app.get("/webhook/ai/dispatcher-copilot")
@app.get("/ai/dispatcher-copilot")
def get_dispatcher_copilot(incident_id: str = ""):
    payload, status = service.get_dispatcher_copilot(incident_id)
    return respond(payload, status)

@app.get("/webhook/ai/hospital-summary")
@app.get("/ai/hospital-summary")
def get_hospital_preparation_summary(incident_id: str = ""):
    payload, status = service.get_hospital_preparation_summary(incident_id)
    return respond(payload, status)

# Socket.IO ASGI app wrapper
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)

def run_server(run_config: AppConfig | None = None) -> None:
    import uvicorn
    cfg = run_config or config
    print(f"RescueLink backend running at http://{cfg.host}:{cfg.port}")
    uvicorn.run("rescuelink_backend.api:socket_app", host=cfg.host, port=cfg.port, log_level="info", reload=False)
