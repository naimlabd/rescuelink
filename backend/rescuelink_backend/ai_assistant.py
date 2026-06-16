from __future__ import annotations

from dataclasses import dataclass


SEVERITY_RANK = {
    "watch": 1,
    "urgent": 2,
    "critical": 3,
    "mass-casualty": 4,
}


@dataclass(slots=True)
class VoiceSignal:
    incident_type: str | None = None
    severity_label: str | None = None


def infer_voice_signals(text: str) -> VoiceSignal:
    normalized = text.lower()
    signal = VoiceSignal()

    type_keywords = {
        "medical": ("breath", "bleeding", "heart", "chest", "unconscious", "patient", "injury", "oxygen"),
        "accident": ("accident", "crash", "collision", "vehicle", "road", "bike", "car"),
        "fire": ("fire", "smoke", "flame", "burning", "explosion"),
        "crime": ("attack", "robbery", "weapon", "gun", "knife", "fight", "security"),
        "harassment": ("harass", "stalking", "threat", "abuse"),
        "natural-disaster": ("earthquake", "flood", "storm", "building collapse", "disaster"),
    }
    for incident_type, keywords in type_keywords.items():
        if any(keyword in normalized for keyword in keywords):
            signal.incident_type = incident_type
            break

    if any(term in normalized for term in ("multiple", "many people", "crowd", "mass casualty", "several injured")):
        signal.severity_label = "mass-casualty"
    elif any(term in normalized for term in ("not breathing", "unconscious", "severe", "life", "critical", "heavy bleeding")):
        signal.severity_label = "critical"
    elif any(term in normalized for term in ("urgent", "pain", "distress", "danger", "help now", "emergency")):
        signal.severity_label = "urgent"
    elif normalized.strip():
        signal.severity_label = "watch"

    return signal


def highest_severity(*labels: str | None) -> str:
    clean_labels = [label for label in labels if label]
    if not clean_labels:
        return "urgent"
    return max(clean_labels, key=lambda label: SEVERITY_RANK.get(label, 2))


def compact_case_summary(incident: object) -> str:
    return (
        f"{getattr(incident, 'severity', 'Emergency')} {getattr(incident, 'type', 'case')} case for "
        f"{getattr(incident, 'citizen_name', 'patient')} at coordinates "
        f"{getattr(incident, 'lat', 'unknown')}, {getattr(incident, 'lon', 'unknown')}. "
        f"{getattr(incident, 'description', '')}"
    ).strip()

