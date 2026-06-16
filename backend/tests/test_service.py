from __future__ import annotations

import shutil
import unittest
from pathlib import Path
from uuid import uuid4

from rescuelink_backend.notifications import NotificationLog
from rescuelink_backend.service import IncidentService
from rescuelink_backend.storage import IncidentRepository


class IncidentServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        base = Path(__file__).resolve().parent / ".tmp" / str(uuid4())
        base.mkdir(parents=True, exist_ok=True)
        self.temp_dir = base
        repository = IncidentRepository(base / "rescuelink.db")
        notifications = NotificationLog(base / "notifications")
        self.service = IncidentService(repository, notifications)

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_report_incident_creates_pending_record(self) -> None:
        payload, status = self.service.report_incident(
            {
                "patient_session_id": "session-ali",
                "citizen_name": "Ali",
                "type": "fire",
                "patient_severity_label": "critical",
                "lat": "24.86",
                "lon": "67.00",
            }
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["status"], "success")
        self.assertEqual(payload["severity"], "Critical")

        active_payload, active_status = self.service.get_active_incidents()
        self.assertEqual(active_status, 200)
        self.assertEqual(len(active_payload), 1)
        self.assertEqual(active_payload[0]["status"], "pending")
        self.assertEqual(active_payload[0]["type"], "fire")
        self.assertEqual(active_payload[0]["patient_severity_label"], "critical")
        self.assertTrue(active_payload[0]["assigned_ambulance_unit"])
        self.assertGreater(active_payload[0]["eta_minutes"], 0)

    def test_worker_response_updates_status(self) -> None:
        report_payload, _ = self.service.report_incident(
            {
                "patient_session_id": "session-sara",
                "citizen_name": "Sara",
                "type": "medical",
                "patient_severity_label": "urgent",
            }
        )
        incident_id = report_payload["incident_id"]

        response_payload, response_status = self.service.respond_to_incident(
            {
                "incident_id": incident_id,
                "response_type": "respond",
                "response_message": "Ambulance dispatched.",
                "status": "responding",
                "eta_minutes": 8,
                "worker_name": "Responder One",
            }
        )
        self.assertEqual(response_status, 200)
        self.assertEqual(response_payload["new_status"], "responding")

        status_payload, status_code = self.service.get_incident_status(incident_id)
        self.assertEqual(status_code, 200)
        self.assertEqual(status_payload["incident"]["assigned_worker"], "Responder One")
        self.assertEqual(status_payload["incident"]["worker_response"], "Ambulance dispatched.")
        self.assertEqual(status_payload["incident"]["eta_minutes"], 8)
        self.assertTrue(status_payload["incident"]["ambulance_location"])

    def test_patient_session_lookup_returns_recent_incidents_without_id(self) -> None:
        first_payload, first_status = self.service.report_incident(
            {
                "patient_session_id": "session-device-1",
                "type": "medical",
                "patient_severity_label": "urgent",
                "lat": "24.86",
                "lon": "67.02",
            }
        )
        self.assertEqual(first_status, 200)
        second_payload, second_status = self.service.report_incident(
            {
                "patient_session_id": "session-device-1",
                "type": "accident",
                "patient_severity_label": "critical",
                "lat": "24.87",
                "lon": "67.03",
            }
        )
        self.assertEqual(second_status, 200)

        session_payload, session_code = self.service.get_patient_incidents("session-device-1")
        self.assertEqual(session_code, 200)
        self.assertEqual(session_payload["status"], "success")
        self.assertEqual(len(session_payload["incidents"]), 2)
        self.assertEqual(session_payload["incidents"][0]["incident_id"], second_payload["incident_id"])
        self.assertTrue(session_payload["incidents"][0]["assigned_ambulance_unit"])
        self.assertEqual(session_payload["incidents"][0]["patient_severity_label"], "critical")

    def test_missing_incident_status_returns_not_found(self) -> None:
        payload, status = self.service.get_incident_status("INC-DOES-NOT-EXIST")
        self.assertEqual(status, 404)
        self.assertEqual(payload["status"], "error")

    def test_hospital_handoff_and_health_reflect_activity(self) -> None:
        report_payload, _ = self.service.report_incident(
            {
                "patient_session_id": "session-zara",
                "citizen_name": "Zara",
                "type": "fire",
                "patient_severity_label": "mass-casualty",
                "lat": "24.91",
                "lon": "67.13",
            }
        )
        incident_id = report_payload["incident_id"]
        self.service.respond_to_incident(
            {
                "incident_id": incident_id,
                "response_type": "respond",
                "response_message": "Fire team is en route.",
                "status": "responding",
                "eta_minutes": 6,
                "worker_name": "Responder Two",
            }
        )
        hospital_payload, hospital_code = self.service.request_hospital_support(
            {
                "incident_id": incident_id,
                "hospital_summary": "Patient has inhalation injury risk and may need immediate emergency intake.",
            }
        )
        self.assertEqual(hospital_code, 200)
        self.assertEqual(hospital_payload["hospital_status"], "requested")
        update_payload, update_code = self.service.update_hospital_status(
            {
                "incident_id": incident_id,
                "hospital_status": "preparing",
                "hospital_preparation_note": "Trauma team and emergency room are preparing now.",
            }
        )
        self.assertEqual(update_code, 200)
        self.assertEqual(update_payload["hospital_status"], "preparing")

        health_payload, health_status = self.service.get_system_health()
        self.assertEqual(health_status, 200)
        self.assertEqual(health_payload["status"], "success")
        self.assertEqual(health_payload["nodes"]["hospital-request-webhook"], "ready")
        self.assertEqual(health_payload["ambulance_units_online"], 3)
        self.assertEqual(health_payload["hospitals_online"], 4)
        self.assertGreaterEqual(health_payload["notification_counts"]["new-incidents"], 1)

        status_payload, status_code = self.service.get_incident_status(incident_id)
        self.assertEqual(status_code, 200)
        self.assertTrue(status_payload["incident"]["hospital_required"])
        self.assertEqual(status_payload["incident"]["hospital_status"], "preparing")

        notifications_payload, notifications_status = self.service.get_notification_activity()
        self.assertEqual(notifications_status, 200)
        self.assertEqual(notifications_payload["status"], "success")
        self.assertGreaterEqual(len(notifications_payload["streams"]["new-incidents"]), 1)

    def test_ai_assistants_generate_triage_dispatch_and_hospital_briefs(self) -> None:
        triage_payload, triage_status = self.service.analyze_emergency(
            {
                "transcript": "My father has chest pain and severe breathing difficulty. Please send an ambulance.",
                "type": "medical",
                "patient_severity_label": "urgent",
                "lat": "30.1575",
                "lon": "71.5249",
            }
        )
        self.assertEqual(triage_status, 200)
        self.assertEqual(triage_payload["status"], "success")
        self.assertEqual(triage_payload["recommended_type"], "medical")
        self.assertTrue(triage_payload["routing"]["ambulance_required"])
        self.assertTrue(triage_payload["recommended_ambulance"])

        report_payload, _ = self.service.report_incident(
            {
                "patient_session_id": "session-ai",
                "citizen_name": "AI Patient",
                "type": triage_payload["recommended_type"],
                "patient_severity_label": triage_payload["recommended_severity_label"],
                "description": triage_payload["description"],
                "lat": "30.1575",
                "lon": "71.5249",
            }
        )
        incident_id = report_payload["incident_id"]

        dispatcher_payload, dispatcher_status = self.service.get_dispatcher_copilot(incident_id)
        self.assertEqual(dispatcher_status, 200)
        self.assertEqual(dispatcher_payload["status"], "success")
        self.assertIn("ambulance", dispatcher_payload["patient_message"].lower())
        self.assertTrue(dispatcher_payload["hospital_summary"])

        hospital_payload, hospital_status = self.service.get_hospital_preparation_summary(incident_id)
        self.assertEqual(hospital_status, 200)
        self.assertEqual(hospital_payload["status"], "success")
        self.assertTrue(hospital_payload["likely_needs"])
        self.assertTrue(hospital_payload["preparation_note"])


if __name__ == "__main__":
    unittest.main()
