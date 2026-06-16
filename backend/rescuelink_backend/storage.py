from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from typing import Any
from .models import Incident

import dataclasses

@dataclasses.dataclass(slots=True)
class Message:
    id: str
    incident_id: str
    sender_role: str
    sender_name: str
    content: str
    timestamp: str


class IncidentRepository:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS incidents (
                    incident_id TEXT PRIMARY KEY,
                    patient_session_id TEXT,
                    citizen_name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    type TEXT NOT NULL,
                    patient_severity_label TEXT,
                    lat TEXT,
                    lon TEXT,
                    phone TEXT,
                    media_urls TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    priority_score INTEGER NOT NULL,
                    estimated_response_time TEXT NOT NULL,
                    immediate_actions TEXT NOT NULL,
                    call_emergency INTEGER NOT NULL,
                    ai_confidence REAL NOT NULL,
                    status TEXT NOT NULL,
                    assigned_team TEXT NOT NULL,
                    assigned_ambulance_unit TEXT,
                    assigned_ambulance_phone TEXT,
                    assigned_ambulance_base TEXT,
                    assigned_ambulance_distance_km REAL,
                    police_required INTEGER NOT NULL DEFAULT 0,
                    police_status TEXT NOT NULL DEFAULT 'not-required',
                    assigned_police_unit TEXT,
                    fire_required INTEGER NOT NULL DEFAULT 0,
                    fire_status TEXT NOT NULL DEFAULT 'not-required',
                    assigned_fire_unit TEXT,
                    hospital_required INTEGER NOT NULL DEFAULT 0,
                    hospital_status TEXT NOT NULL DEFAULT 'not-required',
                    hospital_name TEXT,
                    hospital_summary TEXT,
                    hospital_preparation_note TEXT,
                    hospital_requested_at TEXT,
                    hospital_updated_at TEXT,
                    assigned_worker TEXT,
                    worker_response TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    reported_at TEXT NOT NULL,
                    acknowledged_at TEXT,
                    responded_at TEXT,
                    resolved_at TEXT,
                    eta_minutes INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(incidents)").fetchall()}
            expected_columns = {
                "patient_session_id": "ALTER TABLE incidents ADD COLUMN patient_session_id TEXT",
                "assigned_ambulance_unit": "ALTER TABLE incidents ADD COLUMN assigned_ambulance_unit TEXT",
                "assigned_ambulance_phone": "ALTER TABLE incidents ADD COLUMN assigned_ambulance_phone TEXT",
                "assigned_ambulance_base": "ALTER TABLE incidents ADD COLUMN assigned_ambulance_base TEXT",
                "assigned_ambulance_distance_km": "ALTER TABLE incidents ADD COLUMN assigned_ambulance_distance_km REAL",
                "police_required": "ALTER TABLE incidents ADD COLUMN police_required INTEGER NOT NULL DEFAULT 0",
                "police_status": "ALTER TABLE incidents ADD COLUMN police_status TEXT NOT NULL DEFAULT 'not-required'",
                "assigned_police_unit": "ALTER TABLE incidents ADD COLUMN assigned_police_unit TEXT",
                "fire_required": "ALTER TABLE incidents ADD COLUMN fire_required INTEGER NOT NULL DEFAULT 0",
                "fire_status": "ALTER TABLE incidents ADD COLUMN fire_status TEXT NOT NULL DEFAULT 'not-required'",
                "assigned_fire_unit": "ALTER TABLE incidents ADD COLUMN assigned_fire_unit TEXT",
                "patient_severity_label": "ALTER TABLE incidents ADD COLUMN patient_severity_label TEXT",
                "hospital_required": "ALTER TABLE incidents ADD COLUMN hospital_required INTEGER NOT NULL DEFAULT 0",
                "hospital_status": "ALTER TABLE incidents ADD COLUMN hospital_status TEXT NOT NULL DEFAULT 'not-required'",
                "hospital_name": "ALTER TABLE incidents ADD COLUMN hospital_name TEXT",
                "hospital_summary": "ALTER TABLE incidents ADD COLUMN hospital_summary TEXT",
                "hospital_preparation_note": "ALTER TABLE incidents ADD COLUMN hospital_preparation_note TEXT",
                "hospital_requested_at": "ALTER TABLE incidents ADD COLUMN hospital_requested_at TEXT",
                "hospital_updated_at": "ALTER TABLE incidents ADD COLUMN hospital_updated_at TEXT",
            }
            for column_name, statement in expected_columns.items():
                if column_name not in columns:
                    connection.execute(statement)

            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    incident_id TEXT NOT NULL,
                    sender_role TEXT NOT NULL,
                    sender_name TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TEXT NOT NULL
                )
                """
            )

    def save_message(self, message: Message) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO messages (id, incident_id, sender_role, sender_name, content, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (message.id, message.incident_id, message.sender_role, message.sender_name, message.content, message.timestamp)
            )

    def get_messages_for_incident(self, incident_id: str) -> list[Message]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM messages
                WHERE incident_id = ?
                ORDER BY timestamp ASC
                """,
                (incident_id,)
            ).fetchall()
        return [
            Message(
                id=row["id"],
                incident_id=row["incident_id"],
                sender_role=row["sender_role"],
                sender_name=row["sender_name"],
                content=row["content"],
                timestamp=row["timestamp"]
            ) for row in rows
        ]

    def save_incident(self, incident: Incident) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO incidents (
                    incident_id, patient_session_id, citizen_name, description, type, patient_severity_label, lat, lon, phone, media_urls,
                    severity, priority_score, estimated_response_time, immediate_actions,
                    call_emergency, ai_confidence, status, assigned_team, assigned_ambulance_unit,
                    assigned_ambulance_phone, assigned_ambulance_base, assigned_ambulance_distance_km,
                    police_required, police_status, assigned_police_unit,
                    fire_required, fire_status, assigned_fire_unit, hospital_required,
                    hospital_status, hospital_name, hospital_summary, hospital_preparation_note, hospital_requested_at,
                    hospital_updated_at, assigned_worker,
                    worker_response, created_at, updated_at, reported_at, acknowledged_at,
                    responded_at, resolved_at, eta_minutes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    incident.incident_id,
                    incident.patient_session_id,
                    incident.citizen_name,
                    incident.description,
                    incident.type,
                    incident.patient_severity_label,
                    incident.lat,
                    incident.lon,
                    incident.phone,
                    json.dumps(incident.media_urls),
                    incident.severity,
                    incident.priority_score,
                    incident.estimated_response_time,
                    json.dumps(incident.immediate_actions),
                    int(incident.call_emergency),
                    incident.ai_confidence,
                    incident.status,
                    incident.assigned_team,
                    incident.assigned_ambulance_unit,
                    incident.assigned_ambulance_phone,
                    incident.assigned_ambulance_base,
                    incident.assigned_ambulance_distance_km,
                    int(incident.police_required),
                    incident.police_status,
                    incident.assigned_police_unit,
                    int(incident.fire_required),
                    incident.fire_status,
                    incident.assigned_fire_unit,
                    int(incident.hospital_required),
                    incident.hospital_status,
                    incident.hospital_name,
                    incident.hospital_summary,
                    incident.hospital_preparation_note,
                    incident.hospital_requested_at,
                    incident.hospital_updated_at,
                    incident.assigned_worker,
                    incident.worker_response,
                    incident.created_at,
                    incident.updated_at,
                    incident.reported_at,
                    incident.acknowledged_at,
                    incident.responded_at,
                    incident.resolved_at,
                    incident.eta_minutes,
                ),
            )

    def get_incident(self, incident_id: str) -> Incident | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM incidents WHERE incident_id = ?",
                (incident_id,),
            ).fetchone()
        return self._row_to_incident(row) if row else None

    def get_active_incidents(self) -> list[Incident]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM incidents
                WHERE lower(status) IN ('pending', 'acknowledged', 'responding')
                ORDER BY priority_score DESC, created_at DESC
                """
            ).fetchall()
        return [self._row_to_incident(row) for row in rows]

    def get_incidents_for_patient_session(self, patient_session_id: str) -> list[Incident]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT * FROM incidents
                WHERE patient_session_id = ?
                ORDER BY created_at DESC
                """,
                (patient_session_id,),
            ).fetchall()
        return [self._row_to_incident(row) for row in rows]

    def get_incident_count(self) -> int:
        with self._connect() as connection:
            row = connection.execute("SELECT COUNT(*) AS total FROM incidents").fetchone()
        return int(row["total"]) if row else 0

    def _row_to_incident(self, row: sqlite3.Row) -> Incident:
        return Incident(
            incident_id=row["incident_id"],
            patient_session_id=row["patient_session_id"],
            citizen_name=row["citizen_name"],
            description=row["description"],
            type=row["type"],
            patient_severity_label=row["patient_severity_label"],
            lat=row["lat"],
            lon=row["lon"],
            phone=row["phone"],
            media_urls=json.loads(row["media_urls"] or "[]"),
            severity=row["severity"],
            priority_score=row["priority_score"],
            estimated_response_time=row["estimated_response_time"],
            immediate_actions=json.loads(row["immediate_actions"] or "[]"),
            call_emergency=bool(row["call_emergency"]),
            ai_confidence=row["ai_confidence"],
            status=row["status"],
            assigned_team=row["assigned_team"],
            assigned_ambulance_unit=row["assigned_ambulance_unit"],
            assigned_ambulance_phone=row["assigned_ambulance_phone"],
            assigned_ambulance_base=row["assigned_ambulance_base"],
            assigned_ambulance_distance_km=row["assigned_ambulance_distance_km"],
            police_required=bool(row["police_required"]),
            police_status=row["police_status"],
            assigned_police_unit=row["assigned_police_unit"],
            fire_required=bool(row["fire_required"]),
            fire_status=row["fire_status"],
            assigned_fire_unit=row["assigned_fire_unit"],
            hospital_required=bool(row["hospital_required"]),
            hospital_status=row["hospital_status"],
            hospital_name=row["hospital_name"],
            hospital_summary=row["hospital_summary"],
            hospital_preparation_note=row["hospital_preparation_note"],
            hospital_requested_at=row["hospital_requested_at"],
            hospital_updated_at=row["hospital_updated_at"],
            assigned_worker=row["assigned_worker"],
            worker_response=row["worker_response"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            reported_at=row["reported_at"],
            acknowledged_at=row["acknowledged_at"],
            responded_at=row["responded_at"],
            resolved_at=row["resolved_at"],
            eta_minutes=row["eta_minutes"],
        )
