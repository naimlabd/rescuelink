from __future__ import annotations

import math
import random
import string
from datetime import datetime, timezone

from .models import Incident, WorkerResponse, utc_now_iso
from .notifications import NotificationLog
from .storage import IncidentRepository
from .triage import team_for_incident, triage_incident
from .ai_assistant import compact_case_summary, highest_severity, infer_voice_signals


def generate_incident_id() -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"INC-{int(__import__('time').time() * 1000)}-{suffix}"


class IncidentService:
    def __init__(self, repository: IncidentRepository, notifications: NotificationLog) -> None:
        self.repository = repository
        self.notifications = notifications
        self.notification_streams = (
            "new-incidents",
            "critical-alerts",
            "incident-dashboard-updates",
            "citizen-notifications",
            "new-message",
        )
        self.ambulance_units = (
            {
                "unit_id": "AMB-1122-MUX-01",
                "base": "Rescue 1122 Multan HQ",
                "phone": "+92-61-111-1122-01",
                "lat": 30.1874,
                "lon": 71.4646,
            },
            {
                "unit_id": "AMB-1122-MUX-02",
                "base": "Rescue Station Northern Bypass",
                "phone": "+92-61-111-1122-02",
                "lat": 30.2291,
                "lon": 71.4880,
            },
            {
                "unit_id": "AMB-1122-MUX-03",
                "base": "Rescue Station Vehari Road",
                "phone": "+92-61-111-1122-03",
                "lat": 30.1558,
                "lon": 71.4938,
            },
        )
        self.police_units = (
            {
                "unit_id": "POL-MUX-01",
                "base": "Multan Police Lines",
                "phone": "+92-61-9200000",
                "lat": 30.2033,
                "lon": 71.4703,
            },
            {
                "unit_id": "POL-MUX-02",
                "base": "CPO Office Multan",
                "phone": "+92-61-9200001",
                "lat": 30.1981,
                "lon": 71.4735,
            },
        )
        self.fire_units = (
            {
                "unit_id": "FIR-MUX-01",
                "base": "Central Fire Station Multan",
                "phone": "+92-61-9200002",
                "lat": 30.1906,
                "lon": 71.4658,
            },
            {
                "unit_id": "FIR-MUX-02",
                "base": "Fire Brigade Qasim Bela",
                "phone": "+92-61-9200003",
                "lat": 30.1654,
                "lon": 71.4285,
            },
        )
        self.hospitals = (
            {
                "name": "Nishtar Hospital Multan",
                "specialty": "Trauma, surgery and critical care",
                "lat": 30.2037,
                "lon": 71.4429,
            },
            {
                "name": "Multan Institute of Cardiology",
                "specialty": "Cardiac emergencies",
                "lat": 30.1983,
                "lon": 71.4452,
            },
            {
                "name": "Chaudhry Pervaiz Elahi Institute of Cardiology",
                "specialty": "Specialized cardiology",
                "lat": 30.1990,
                "lon": 71.4470,
            },
            {
                "name": "Children's Hospital Multan",
                "specialty": "Pediatric emergencies",
                "lat": 30.1764,
                "lon": 71.4589,
            },
        )

    def report_incident(self, payload: dict[str, object]) -> tuple[dict[str, object], int]:
        reported_type = self._coerce_optional_str(payload.get("type")) or "medical"
        patient_severity_label = self._coerce_optional_str(payload.get("patient_severity_label")) or "urgent"
        patient_session_id = self._coerce_optional_str(payload.get("patient_session_id"))
        description = self._build_description(
            reported_type,
            patient_severity_label,
            self._coerce_optional_str(payload.get("description")),
        )
        lat = self._coerce_optional_str(payload.get("lat"))
        lon = self._coerce_optional_str(payload.get("lon"))
        if not description:
            return {"status": "error", "message": "Invalid input: Missing required fields"}, 400

        triage = triage_incident(description, reported_type)
        severity_override = self._severity_override(patient_severity_label)
        priority_bonus = self._priority_bonus(patient_severity_label)
        timestamp = utc_now_iso()
        
        # Determine Agency Needs Based on Type
        incident_type = triage.type.lower()
        needs_ambulance = incident_type in {"medical", "accident", "fire", "disaster", "natural-disaster"}
        needs_police = incident_type in {"accident", "security", "crime", "disaster", "natural-disaster", "harassment"}
        needs_fire = incident_type in {"fire", "disaster", "natural-disaster"}
        
        ambulance_assignment = self._assign_nearest(lat, lon, self.ambulance_units) if needs_ambulance else None
        police_assignment = self._assign_nearest(lat, lon, self.police_units) if needs_police else None
        fire_assignment = self._assign_nearest(lat, lon, self.fire_units) if needs_fire else None
        
        severity = severity_override or triage.severity
        priority_score = min(9, triage.priority_score + priority_bonus)
        estimated_response_time = self._build_estimated_response_time(severity, ambulance_assignment or police_assignment or fire_assignment)
        
        # Auto-assign hospital for critical medical/accident incidents
        auto_hospital_required = False
        auto_hospital_status = "not-required"
        auto_hospital_name = None
        auto_hospital_requested_at = None
        
        if severity == "Critical" and incident_type in {"medical", "accident", "disaster", "natural-disaster"}:
            auto_hospital_required = True
            auto_hospital_status = "requested"
            # We can use the assignment helper but need to adapt it or write a simple loop here
            # Since self._select_hospital_for_incident expects an Incident, let's create a temp object or just calculate it
            lat_value = self._coerce_float(lat) or 30.1575
            lon_value = self._coerce_float(lon) or 71.5249
            best = self.hospitals[0]
            best_dist = None
            for hosp in self.hospitals:
                d = self._distance_km(lat_value, lon_value, hosp["lat"], hosp["lon"])
                if best_dist is None or d < best_dist:
                    best = hosp
                    best_dist = d
            auto_hospital_name = best["name"]
            auto_hospital_requested_at = timestamp

        
        incident = Incident(
            incident_id=generate_incident_id(),
            patient_session_id=patient_session_id,
            citizen_name=str(payload.get("citizen_name") or "Anonymous"),
            description=description,
            type=triage.type,
            patient_severity_label=patient_severity_label,
            lat=lat,
            lon=lon,
            phone=self._coerce_optional_str(payload.get("phone")),
            media_urls=self._coerce_media_urls(payload.get("media_urls")),
            severity=severity,
            priority_score=priority_score,
            estimated_response_time=estimated_response_time,
            immediate_actions=triage.immediate_actions,
            call_emergency=True,
            ai_confidence=triage.confidence,
            status="pending",
            assigned_team=team_for_incident(triage.type),
            assigned_ambulance_unit=ambulance_assignment["unit_id"] if ambulance_assignment else None,
            assigned_ambulance_phone=ambulance_assignment["phone"] if ambulance_assignment else None,
            assigned_ambulance_base=ambulance_assignment["base"] if ambulance_assignment else None,
            assigned_ambulance_distance_km=ambulance_assignment["distance_km"] if ambulance_assignment else None,
            police_required=needs_police,
            police_status="pending" if needs_police else "not-required",
            assigned_police_unit=police_assignment["unit_id"] if police_assignment else None,
            fire_required=needs_fire,
            fire_status="pending" if needs_fire else "not-required",
            assigned_fire_unit=fire_assignment["unit_id"] if fire_assignment else None,
            hospital_required=auto_hospital_required,
            hospital_status=auto_hospital_status,
            hospital_name=auto_hospital_name,
            hospital_summary=description if auto_hospital_required else None,
            hospital_preparation_note=None,
            hospital_requested_at=auto_hospital_requested_at,
            hospital_updated_at=auto_hospital_requested_at,
            assigned_worker=None,
            worker_response=None,
            created_at=timestamp,
            updated_at=timestamp,
            reported_at=timestamp,
            acknowledged_at=None,
            responded_at=None,
            resolved_at=None,
            eta_minutes=self._estimate_eta_minutes(ambulance_assignment or police_assignment or fire_assignment),
        )
        self.repository.save_incident(incident)
        self.notifications.emit(
            "new-incidents",
            {
                "incident_id": incident.incident_id,
                "type": incident.type,
                "severity": incident.severity,
                "description": incident.description,
            },
        )
        if incident.severity == "Critical":
            self.notifications.emit(
                "critical-alerts",
                {
                    "incident_id": incident.incident_id,
                    "type": incident.type,
                    "description": incident.description,
                },
            )
        return {
            "status": "success",
            "message": "Incident reported successfully",
            "incident_id": incident.incident_id,
            "severity": incident.severity,
            "assigned_team": incident.assigned_team,
            "estimated_response_time": incident.estimated_response_time,
            "call_emergency": incident.call_emergency,
            "assigned_ambulance_unit": incident.assigned_ambulance_unit,
            "assigned_police_unit": incident.assigned_police_unit,
            "assigned_fire_unit": incident.assigned_fire_unit,
            "eta_minutes": incident.eta_minutes,
        }, 200

    def get_active_incidents(self) -> tuple[list[dict[str, object]], int]:
        incidents = self.repository.get_active_incidents()
        return [self._serialize_incident(incident) for incident in incidents], 200

    def analyze_emergency(self, payload: dict[str, object]) -> tuple[dict[str, object], int]:
        transcript = self._coerce_optional_str(payload.get("transcript")) or ""
        selected_type = self._coerce_optional_str(payload.get("type"))
        selected_severity = self._coerce_optional_str(payload.get("patient_severity_label"))
        voice_signal = infer_voice_signals(transcript)

        incident_type = voice_signal.incident_type or selected_type or "medical"
        severity_label = highest_severity(selected_severity, voice_signal.severity_label)
        description = self._build_description(incident_type, severity_label, transcript)
        triage = triage_incident(description, incident_type)
        severity = self._severity_override(severity_label) or triage.severity
        priority_score = min(9, triage.priority_score + self._priority_bonus(severity_label))

        needs_ambulance = incident_type in {"medical", "accident", "fire", "disaster", "natural-disaster"}
        needs_police = incident_type in {"accident", "security", "crime", "disaster", "natural-disaster", "harassment"}
        needs_fire = incident_type in {"fire", "disaster", "natural-disaster"}
        ambulance = self._assign_nearest(
            self._coerce_optional_str(payload.get("lat")),
            self._coerce_optional_str(payload.get("lon")),
            self.ambulance_units,
        ) if needs_ambulance else None
        hospital = self._select_hospital_for_location(payload.get("lat"), payload.get("lon"))

        return {
            "status": "success",
            "source": "local-ai-triage",
            "recommended_type": incident_type,
            "recommended_severity_label": severity_label,
            "severity": severity,
            "priority_score": priority_score,
            "description": description,
            "immediate_actions": triage.immediate_actions,
            "routing": {
                "ambulance_required": needs_ambulance,
                "police_required": needs_police,
                "fire_required": needs_fire,
                "hospital_recommended": severity == "Critical" and incident_type in {"medical", "accident", "natural-disaster"},
            },
            "recommended_ambulance": ambulance,
            "recommended_hospital": hospital,
            "confidence": 0.82 if transcript else 0.72,
        }, 200

    def get_dispatcher_copilot(self, incident_id: str) -> tuple[dict[str, object], int]:
        incident = self.repository.get_incident(incident_id)
        if not incident:
            return {"status": "error", "message": "Incident not found"}, 404

        hospital = self._select_hospital_for_incident(incident)
        eta = max(3, incident.eta_minutes or self._estimate_eta_minutes({"distance_km": incident.assigned_ambulance_distance_km or 0}))
        patient_message = (
            f"Ambulance {incident.assigned_ambulance_unit or 'unit'} is on the way and should arrive in about "
            f"{eta} minutes. Stay in a safe place and keep your phone nearby."
        )
        if incident.severity == "Critical":
            patient_message = (
                f"Priority ambulance {incident.assigned_ambulance_unit or 'unit'} is arriving in about {eta} minutes. "
                "Keep the patient still, follow the safety instructions shown, and stay reachable."
            )

        hospital_summary = self._build_hospital_summary(incident)
        return {
            "status": "success",
            "source": "local-ai-dispatcher-copilot",
            "case_summary": compact_case_summary(incident),
            "patient_message": patient_message,
            "hospital_summary": hospital_summary,
            "recommended_hospital": hospital,
            "recommended_next_actions": [
                "Confirm unit is en route and ETA is accurate.",
                "Keep patient informed with one clear message.",
                "Notify hospital if airway, bleeding, trauma, cardiac, or critical risk is present.",
            ],
        }, 200

    def get_hospital_preparation_summary(self, incident_id: str) -> tuple[dict[str, object], int]:
        incident = self.repository.get_incident(incident_id)
        if not incident:
            return {"status": "error", "message": "Incident not found"}, 404

        return {
            "status": "success",
            "source": "local-ai-hospital-prep",
            "receiving_priority": "Immediate" if incident.severity == "Critical" else "High" if incident.severity == "High" else "Standard",
            "preparation_note": self._build_hospital_summary(incident),
            "likely_needs": self._likely_hospital_needs(incident),
            "handoff_summary": compact_case_summary(incident),
        }, 200

    def send_message(self, payload: dict[str, object]) -> tuple[dict[str, object], int]:
        from .storage import Message
        import uuid, dataclasses
        msg = Message(
            id=str(uuid.uuid4()),
            incident_id=str(payload.get("incident_id")),
            sender_role=str(payload.get("sender_role") or "unknown"),
            sender_name=str(payload.get("sender_name") or "Anonymous"),
            content=str(payload.get("content")),
            timestamp=utc_now_iso()
        )
        self.repository.save_message(msg)
        msg_dict = dataclasses.asdict(msg)
        self.notifications.emit("new-message", msg_dict)
        return {"status": "success", "message": msg_dict}, 200

    def get_messages(self, incident_id: str) -> tuple[dict[str, object], int]:
        import dataclasses
        messages = self.repository.get_messages_for_incident(incident_id)
        return {"status": "success", "messages": [dataclasses.asdict(m) for m in messages]}, 200

    def get_patient_incidents(self, patient_session_id: str) -> tuple[dict[str, object], int]:
        session_key = patient_session_id.strip()
        if not session_key:
            return {"status": "error", "message": "Missing patient session"}, 400

        incidents = self.repository.get_incidents_for_patient_session(session_key)
        return {
            "status": "success",
            "patient_session_id": session_key,
            "incidents": [self._serialize_incident(incident) for incident in incidents],
        }, 200

    def respond_to_incident(self, payload: dict[str, object]) -> tuple[dict[str, object], int]:
        worker_response = WorkerResponse(
            incident_id=str(payload.get("incident_id") or ""),
            response_type=str(payload.get("response_type") or "acknowledge"),
            response_message=str(payload.get("response_message") or "").strip(),
            status=str(payload.get("status") or "acknowledged"),
            eta_minutes=self._coerce_int(payload.get("eta_minutes")),
            worker_id=str(payload.get("worker_id") or "WORKER001"),
            worker_name=str(payload.get("worker_name") or "Emergency Responder"),
        )
        incident = self.repository.get_incident(worker_response.incident_id)
        if not incident:
            return {"status": "error", "message": "Incident not found"}, 404

        now = utc_now_iso()
        
        # Identify the role of the worker updating to set specific agency statuses
        # Assuming worker_id indicates role, e.g. POL-..., FIR-..., AMB-...
        agency_prefix = worker_response.worker_id.split('-')[0]
        if agency_prefix == "POL":
            incident.police_status = worker_response.status
        elif agency_prefix == "FIR":
            incident.fire_status = worker_response.status
        else:
            # Default to overall / ambulance status
            incident.status = worker_response.status
        
        incident.assigned_worker = worker_response.worker_name
        incident.worker_response = worker_response.response_message
        incident.updated_at = now
        incident.eta_minutes = worker_response.eta_minutes or incident.eta_minutes
        
        if worker_response.response_type == "acknowledge":
            incident.acknowledged_at = now
        if worker_response.response_type in {"respond", "hospitalize"}:
            incident.responded_at = now
        if worker_response.status == "resolved":
            incident.resolved_at = now

        self.repository.save_incident(incident)
        self._emit_incident_updates(incident, worker_response.response_message)
        return {
            "status": "success",
            "message": "Response recorded successfully",
            "incident_id": incident.incident_id,
            "new_status": incident.status,
            "worker": worker_response.worker_name,
            "eta_minutes": incident.eta_minutes,
        }, 200

    def request_hospital_support(self, payload: dict[str, object]) -> tuple[dict[str, object], int]:
        incident_id = str(payload.get("incident_id") or "")
        incident = self.repository.get_incident(incident_id)
        if not incident:
            return {"status": "error", "message": "Incident not found"}, 404

        chosen_hospital = self._select_hospital_for_incident(incident)
        now = utc_now_iso()
        incident.hospital_required = True
        incident.hospital_status = "requested"
        incident.hospital_name = str(payload.get("hospital_name") or chosen_hospital["name"])
        incident.hospital_summary = self._coerce_optional_str(payload.get("hospital_summary")) or incident.description
        incident.hospital_preparation_note = None
        incident.hospital_requested_at = now
        incident.hospital_updated_at = now
        if incident.status == "pending":
            incident.status = "responding"
            incident.responded_at = incident.responded_at or now
        incident.updated_at = now
        incident.worker_response = self._coerce_optional_str(payload.get("response_message")) or incident.worker_response
        self.repository.save_incident(incident)

        summary_message = f"Hospital requested: {incident.hospital_name}"
        self._emit_incident_updates(incident, summary_message)
        return {
            "status": "success",
            "incident_id": incident.incident_id,
            "hospital_status": incident.hospital_status,
            "hospital_name": incident.hospital_name,
        }, 200

    def update_hospital_status(self, payload: dict[str, object]) -> tuple[dict[str, object], int]:
        incident_id = str(payload.get("incident_id") or "")
        incident = self.repository.get_incident(incident_id)
        if not incident:
            return {"status": "error", "message": "Incident not found"}, 404

        now = utc_now_iso()
        incident.hospital_required = True
        incident.hospital_status = str(payload.get("hospital_status") or "preparing")
        incident.hospital_preparation_note = self._coerce_optional_str(payload.get("hospital_preparation_note"))
        incident.hospital_updated_at = now
        incident.updated_at = now
        self.repository.save_incident(incident)
        return {
            "status": "success",
            "incident_id": incident.incident_id,
            "hospital_status": incident.hospital_status,
        }, 200

    def get_incident_status(self, incident_id: str) -> tuple[dict[str, object], int]:
        incident = self.repository.get_incident(incident_id)
        if not incident:
            return {"status": "error", "message": "Incident not found"}, 404
        return {
            "status": "success",
            "incident": self._serialize_incident(incident),
        }, 200

    def get_system_health(self) -> tuple[dict[str, object], int]:
        node_status = {
            "incident-report-webhook": "ready",
            "triage-engine": "ready",
            "incident-store": "ready",
            "active-incidents-webhook": "ready",
            "worker-response-webhook": "ready",
            "citizen-status-webhook": "ready",
            "notification-log": "ready",
            "hospital-request-webhook": "ready",
            "ai-triage-assistant": "ready",
            "ai-dispatcher-copilot": "ready",
            "ai-hospital-prep-summary": "ready",
        }
        notification_counts = {
            stream: self.notifications.count(stream)
            for stream in self.notification_streams
        }
        return {
            "status": "success",
            "nodes": node_status,
            "notification_counts": notification_counts,
            "active_incidents": len(self.repository.get_active_incidents()),
            "total_incidents": self.repository.get_incident_count(),
            "ambulance_units_online": len(self.ambulance_units),
            "hospitals_online": len(self.hospitals),
        }, 200

    def get_notification_activity(self, limit: int = 10) -> tuple[dict[str, object], int]:
        streams = {
            stream: self.notifications.tail(stream, limit)
            for stream in self.notification_streams
        }
        return {
            "status": "success",
            "streams": streams,
        }, 200

    def get_analytics(self) -> tuple[dict[str, object], int]:
        incidents = self.repository.get_active_incidents()
        # plus let's get resolved ones too to have a real view? 
        # But get_active_incidents only returns active. We need a new repo method or just use all.
        with self.repository._connect() as connection:
            rows = connection.execute("SELECT type, severity, status, created_at, resolved_at FROM incidents").fetchall()
        
        type_counts = {}
        severity_counts = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
        total_time = 0
        resolved_count = 0
        status_counts = {"pending": 0, "acknowledged": 0, "responding": 0, "resolved": 0}

        for r in rows:
            t = r["type"]
            s = r["severity"]
            st = r["status"]
            
            type_counts[t] = type_counts.get(t, 0) + 1
            if s in severity_counts:
                severity_counts[s] += 1
            status_counts[st] = status_counts.get(st, 0) + 1
            
            if st == "resolved" and r["resolved_at"]:
                minutes = self._minutes_since(r["created_at"])
                # Wait, this is resolved_at - created_at, but we don't have that explicitly, 
                # let's just use a fake avg or parse it
                import datetime
                try:
                    c_time = datetime.datetime.fromisoformat(r["created_at"])
                    r_time = datetime.datetime.fromisoformat(r["resolved_at"])
                    total_time += (r_time - c_time).total_seconds() / 60.0
                    resolved_count += 1
                except: pass

        avg_resolution_time = round(total_time / resolved_count) if resolved_count > 0 else 0

        # We also need lat/lon for active incidents for heatmap
        active_coords = [{"lat": float(i.lat), "lon": float(i.lon), "intensity": i.priority_score} for i in incidents if i.lat and i.lon]

        return {
            "status": "success",
            "total_incidents": len(rows),
            "type_counts": type_counts,
            "severity_counts": severity_counts,
            "status_counts": status_counts,
            "avg_resolution_time_minutes": avg_resolution_time,
            "heatmap_data": active_coords
        }, 200

    def _serialize_incident(self, incident: Incident) -> dict[str, object]:
        ambulance_assignment = self._assignment_for_incident(incident, self.ambulance_units, incident.assigned_ambulance_unit)
        ambulance_location = self._build_unit_location(incident, ambulance_assignment, incident.status)
        police_assignment = self._assignment_for_incident(incident, self.police_units, incident.assigned_police_unit)
        police_location = self._build_unit_location(incident, police_assignment, incident.police_status)
        fire_assignment = self._assignment_for_incident(incident, self.fire_units, incident.assigned_fire_unit)
        fire_location = self._build_unit_location(incident, fire_assignment, incident.fire_status)
        
        return {
            "incident_id": incident.incident_id,
            "patient_session_id": incident.patient_session_id,
            "type": incident.type,
            "severity": incident.severity,
            "patient_severity_label": incident.patient_severity_label,
            "status": incident.status,
            "description": incident.description,
            "assigned_worker": incident.assigned_worker,
            "worker_response": incident.worker_response,
            "eta_minutes": max(0, incident.eta_minutes),
            "created_at": incident.created_at,
            "acknowledged_at": incident.acknowledged_at,
            "responded_at": incident.responded_at,
            "resolved_at": incident.resolved_at,
            "assigned_team": incident.assigned_team,
            "assigned_ambulance_unit": incident.assigned_ambulance_unit,
            "assigned_ambulance_phone": incident.assigned_ambulance_phone,
            "assigned_ambulance_base": incident.assigned_ambulance_base,
            "assigned_ambulance_distance_km": incident.assigned_ambulance_distance_km,
            "police_required": incident.police_required,
            "police_status": incident.police_status,
            "assigned_police_unit": incident.assigned_police_unit,
            "fire_required": incident.fire_required,
            "fire_status": incident.fire_status,
            "assigned_fire_unit": incident.assigned_fire_unit,
            "estimated_response_time": incident.estimated_response_time,
            "immediate_actions": incident.immediate_actions,
            "call_emergency": incident.call_emergency,
            "lat": incident.lat,
            "lon": incident.lon,
            "citizen_name": incident.citizen_name,
            "phone": incident.phone,
            "priority_score": incident.priority_score,
            "hospital_required": incident.hospital_required,
            "hospital_status": incident.hospital_status,
            "hospital_name": incident.hospital_name,
            "hospital_summary": incident.hospital_summary,
            "hospital_preparation_note": incident.hospital_preparation_note,
            "hospital_requested_at": incident.hospital_requested_at,
            "hospital_updated_at": incident.hospital_updated_at,
            "ambulance_location": ambulance_location,
            "police_location": police_location,
            "fire_location": fire_location,
        }

    def _emit_incident_updates(self, incident: Incident, message: str | None) -> None:
        payload = {
            "incident_id": incident.incident_id,
            "status": incident.status,
            "police_status": incident.police_status,
            "fire_status": incident.fire_status,
            "worker_name": incident.assigned_worker,
            "response_message": message or incident.worker_response,
            "eta_minutes": incident.eta_minutes,
            "assigned_ambulance_unit": incident.assigned_ambulance_unit,
            "hospital_status": incident.hospital_status,
        }
        self.notifications.emit("incident-dashboard-updates", payload)
        self.notifications.emit("citizen-notifications", payload)

    def _build_description(self, incident_type: str, severity_label: str, description: str | None) -> str:
        if description and description.strip():
            return description.strip()
        severity_copy = {
            "watch": "Caller reports a low-clarity situation and needs precautionary support.",
            "urgent": "Caller reports an urgent emergency and needs assistance.",
            "critical": "Caller reports a life-threatening emergency requiring immediate dispatch.",
            "mass-casualty": "Caller reports multiple victims or a major incident requiring priority response.",
        }
        return f"{incident_type.replace('-', ' ').title()} emergency. {severity_copy.get(severity_label, severity_copy['urgent'])}"

    @staticmethod
    def _severity_override(severity_label: str) -> str | None:
        mapping = {
            "watch": "Medium",
            "urgent": "High",
            "critical": "Critical",
            "mass-casualty": "Critical",
        }
        return mapping.get(severity_label)

    @staticmethod
    def _priority_bonus(severity_label: str) -> int:
        mapping = {
            "watch": 0,
            "urgent": 1,
            "critical": 2,
            "mass-casualty": 3,
        }
        return mapping.get(severity_label, 1)

    def _assign_nearest(self, lat: str | None, lon: str | None, units: list[dict[str, object]]) -> dict[str, object] | None:
        lat_value = self._coerce_float(lat)
        lon_value = self._coerce_float(lon)
        if lat_value is None or lon_value is None:
            lat_value = 30.1575 # Multan default
            lon_value = 71.5249

        nearest_unit = None
        nearest_distance = None
        for unit in units:
            distance = self._distance_km(lat_value, lon_value, unit["lat"], unit["lon"])
            if nearest_distance is None or distance < nearest_distance:
                nearest_distance = distance
                nearest_unit = unit

        if nearest_unit is None or nearest_distance is None:
            return None

        return {**nearest_unit, "distance_km": round(nearest_distance, 2)}

    def _select_hospital_for_incident(self, incident: Incident) -> dict[str, object]:
        return self._select_hospital_for_location(incident.lat, incident.lon)

    def _select_hospital_for_location(self, lat: object, lon: object) -> dict[str, object]:
        lat_value = self._coerce_float(lat) or 30.1575
        lon_value = self._coerce_float(lon) or 71.5249
        best = self.hospitals[0]
        best_distance = None
        for hospital in self.hospitals:
            distance = self._distance_km(lat_value, lon_value, hospital["lat"], hospital["lon"])
            if best_distance is None or distance < best_distance:
                best = hospital
                best_distance = distance
        return {**best, "distance_km": round(best_distance or 0, 2)}

    def _build_hospital_summary(self, incident: Incident) -> str:
        needs = ", ".join(self._likely_hospital_needs(incident))
        return (
            f"{incident.severity} {incident.type} handoff for {incident.citizen_name or 'patient'}. "
            f"Prepare for: {needs}. Case detail: {incident.description}"
        )

    @staticmethod
    def _likely_hospital_needs(incident: Incident) -> list[str]:
        text = f"{incident.type} {incident.description}".lower()
        needs = []
        if any(term in text for term in ("breath", "oxygen", "chok", "unconscious")):
            needs.append("oxygen and airway support")
        if any(term in text for term in ("bleed", "blood", "trauma", "accident", "crash")):
            needs.append("trauma bay and bleeding control")
        if any(term in text for term in ("heart", "chest", "cardiac")):
            needs.append("cardiac monitor and ECG readiness")
        if any(term in text for term in ("burn", "fire", "smoke")):
            needs.append("burn care and smoke inhalation assessment")
        if incident.severity == "Critical":
            needs.append("senior clinician review on arrival")
        return needs or ["vital signs, triage nurse, and emergency assessment"]

    def _assignment_for_incident(self, incident: Incident, units: list[dict], assigned_unit_id: str | None) -> dict[str, object] | None:
        if assigned_unit_id:
            assigned_unit = next((unit for unit in units if unit["unit_id"] == assigned_unit_id), None)
            if assigned_unit:
                return {
                    **assigned_unit,
                    "distance_km": round(self._distance_km(
                        self._coerce_float(incident.lat) or assigned_unit["lat"],
                        self._coerce_float(incident.lon) or assigned_unit["lon"],
                        assigned_unit["lat"],
                        assigned_unit["lon"],
                    ), 2),
                }
        return None

    def _build_unit_location(self, incident: Incident, assignment: dict[str, object] | None, status: str) -> dict[str, object] | None:
        if not assignment:
            return None

        start_lat = float(assignment["lat"])
        start_lon = float(assignment["lon"])
        end_lat = self._coerce_float(incident.lat) or start_lat
        end_lon = self._coerce_float(incident.lon) or start_lon

        progress = 0.0
        if status == "responding" and incident.responded_at:
            elapsed_minutes = self._minutes_since(incident.responded_at)
            initial_eta = max(1, incident.eta_minutes or self._estimate_eta_minutes({"distance_km": assignment.get("distance_km", 0)}))
            progress = min(1.0, elapsed_minutes / initial_eta)
        elif status == "acknowledged":
            progress = 0.18
        elif status == "pending":
            progress = 0.05
        elif status == "resolved":
            progress = 1.0

        current_lat = start_lat + ((end_lat - start_lat) * progress)
        current_lon = start_lon + ((end_lon - start_lon) * progress)
        return {
            "lat": round(current_lat, 6),
            "lon": round(current_lon, 6),
            "progress": round(progress, 2),
            "label": "Arrived" if progress >= 1.0 else "En route",
        }

    def _build_estimated_response_time(self, severity: str, assignment: dict[str, object] | None) -> str:
        eta = self._estimate_eta_minutes(assignment)
        if severity == "Critical":
            return f"{max(3, eta)} minutes"
        if severity == "High":
            return f"{max(4, eta)} minutes"
        return f"{max(6, eta)} minutes"

    @staticmethod
    def _estimate_eta_minutes(assignment: dict[str, object] | None) -> int:
        if not assignment:
            return 6
        distance = float(assignment.get("distance_km") or 0)
        return max(4, min(22, int(round((distance / 0.75) + 3))))

    @staticmethod
    def _minutes_since(timestamp: str) -> float:
        try:
            moment = datetime.fromisoformat(timestamp)
        except ValueError:
            return 0.0
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)
        return max(0.0, (datetime.now(timezone.utc) - moment).total_seconds() / 60.0)

    @staticmethod
    def _coerce_optional_str(value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @staticmethod
    def _coerce_int(value: object) -> int:
        if value in (None, ""):
            return 0
        try:
            return int(value)
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _coerce_float(value: object) -> float | None:
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _coerce_media_urls(value: object) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return [str(item) for item in value]
        return [str(value)]

    @staticmethod
    def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        radius_km = 6371.0
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        a = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return radius_km * c
