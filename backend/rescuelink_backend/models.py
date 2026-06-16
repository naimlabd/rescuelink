from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(slots=True)
class Incident:
    incident_id: str
    patient_session_id: str | None
    citizen_name: str
    description: str
    type: str
    patient_severity_label: str | None
    lat: str | None
    lon: str | None
    phone: str | None
    media_urls: list[str]
    severity: str
    priority_score: int
    estimated_response_time: str
    immediate_actions: list[str]
    call_emergency: bool
    ai_confidence: float
    status: str
    assigned_team: str
    assigned_ambulance_unit: str | None
    assigned_ambulance_phone: str | None
    assigned_ambulance_base: str | None
    assigned_ambulance_distance_km: float | None
    police_required: bool
    police_status: str
    assigned_police_unit: str | None
    fire_required: bool
    fire_status: str
    assigned_fire_unit: str | None
    hospital_required: bool
    hospital_status: str
    hospital_name: str | None
    hospital_summary: str | None
    hospital_preparation_note: str | None
    hospital_requested_at: str | None
    hospital_updated_at: str | None
    assigned_worker: str | None
    worker_response: str | None
    created_at: str
    updated_at: str
    reported_at: str
    acknowledged_at: str | None
    responded_at: str | None
    resolved_at: str | None
    eta_minutes: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class TriageResult:
    type: str
    severity: str
    description: str
    priority_score: int
    estimated_response_time: str
    immediate_actions: list[str]
    call_emergency: bool
    confidence: float


@dataclass(slots=True)
class WorkerResponse:
    incident_id: str
    response_type: str
    response_message: str
    status: str
    eta_minutes: int
    worker_id: str
    worker_name: str
