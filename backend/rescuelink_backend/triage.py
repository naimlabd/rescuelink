from __future__ import annotations

from .models import TriageResult


TYPE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "medical": ("medical", "injury", "injured", "bleeding", "heart", "unconscious", "ambulance"),
    "fire": ("fire", "smoke", "burning", "flames", "explosion"),
    "crime": ("crime", "robbery", "theft", "attack", "assault", "violence", "gun", "knife"),
    "harassment": ("harassment", "stalking", "threat", "abuse"),
    "accident": ("accident", "crash", "collision", "vehicle", "road"),
    "natural-disaster": ("earthquake", "flood", "storm", "landslide", "cyclone"),
    "rescue": ("trapped", "missing", "rescue", "collapsed"),
}

CRITICAL_KEYWORDS = (
    "not breathing",
    "life threatening",
    "critical",
    "major fire",
    "collapsed",
    "unconscious",
    "severe bleeding",
)

HIGH_KEYWORDS = (
    "injured",
    "attack",
    "assault",
    "smoke",
    "crash",
    "emergency",
)

def generate_dynamic_instructions(description: str, incident_type: str) -> list[str]:
    desc = description.lower()
    actions = []
    
    # Specific medical conditions
    if "bleed" in desc or "blood" in desc:
        actions.extend(["Apply firm, direct pressure to the bleeding wound using a clean cloth.", "Elevate the injured area above the heart if possible.", "Do not remove the cloth if it soaks through; add more layers."])
    if "burn" in desc:
        actions.extend(["Cool the burn under cool (not cold) running water for 10-20 minutes.", "Do not apply ice, butter, or ointments.", "Cover loosely with cling film or a clean plastic bag."])
    if "breath" in desc or "chok" in desc:
        actions.extend(["If choking, perform abdominal thrusts (Heimlich maneuver).", "If unconscious and not breathing, begin CPR immediately (push hard and fast in the center of the chest).", "Clear any obvious obstructions from the airway."])
    if "heart" in desc or "chest pain" in desc:
        actions.extend(["Have the patient sit down, rest, and try to keep calm.", "Loosen any tight clothing.", "If they have prescribed chest pain medication, help them take it."])
    if "unconscious" in desc or "faint" in desc:
        actions.extend(["Check for breathing. If breathing, place them in the recovery position.", "Do not give them anything to eat or drink.", "If not breathing, begin CPR."])
    
    # Fire specifics
    if incident_type == "fire" or "fire" in desc or "smoke" in desc:
        actions.extend(["Crawl low under smoke to escape.", "Check doors for heat before opening them.", "Once outside, stay outside. Do not go back for belongings."])
    
    # Crime/Security specifics
    if incident_type in {"crime", "harassment"} or "gun" in desc or "knife" in desc or "attack" in desc:
        actions.extend(["Run, Hide, Fight: Escape if possible, hide if you cannot, fight as a last resort.", "Barricade doors and silence your phone.", "Do not confront the attacker."])
        
    # Accident specifics
    if incident_type == "accident" or "crash" in desc:
        actions.extend(["Turn off the vehicle engine if safe to do so.", "Turn on hazard lights to warn other drivers.", "Do not move seriously injured people unless there is an immediate danger (like fire)."])
        
    # Disaster specifics
    if incident_type == "natural-disaster" or "earthquake" in desc:
        actions.extend(["Drop, Cover, and Hold On.", "Stay away from windows and heavy furniture.", "If outdoors, move to an open area away from buildings and power lines."])
        
    # Fallback/General
    if not actions:
        if incident_type == "medical":
            actions = ["Move to a safe area if possible", "Keep the patient still", "Call emergency services if symptoms worsen"]
        elif incident_type == "fire":
            actions = ["Evacuate the area immediately", "Stay low if there is smoke", "Call fire services"]
        elif incident_type == "crime":
            actions = ["Move to a safe location", "Avoid confronting the suspect", "Contact police immediately"]
        elif incident_type == "harassment":
            actions = ["Move toward a public or secure area", "Contact police or trusted help", "Preserve any evidence"]
        elif incident_type == "accident":
            actions = ["Check for injuries", "Move away from traffic if safe", "Call emergency responders"]
        elif incident_type == "natural-disaster":
            actions = ["Move to a safer location", "Stay away from unstable structures", "Follow local emergency guidance"]
        elif incident_type == "rescue":
            actions = ["Keep communication open if possible", "Do not enter unsafe structures", "Wait for trained responders"]
        else:
            actions = ["Stay safe", "Keep your phone nearby", "Wait for assistance"]
            
    # Deduplicate and limit to top 4 most relevant
    seen = set()
    unique_actions = []
    for action in actions:
        if action not in seen:
            seen.add(action)
            unique_actions.append(action)
    return unique_actions[:4]

TEAM_BY_TYPE = {
    "medical": "medical",
    "fire": "fire",
    "crime": "police",
    "harassment": "police",
    "accident": "rescue",
    "natural-disaster": "general",
    "rescue": "rescue",
    "general": "general",
}


def infer_incident_type(description: str, provided_type: str | None) -> str:
    normalized_description = description.lower()
    if provided_type and provided_type.strip() and provided_type.lower() != "general":
      return provided_type.lower()

    for incident_type, keywords in TYPE_KEYWORDS.items():
        if any(keyword in normalized_description for keyword in keywords):
            return incident_type
    return "general"


def infer_severity(description: str, incident_type: str) -> str:
    normalized_description = description.lower()
    if any(keyword in normalized_description for keyword in CRITICAL_KEYWORDS):
        return "Critical"
    if incident_type in {"fire", "medical", "crime", "rescue"} or any(keyword in normalized_description for keyword in HIGH_KEYWORDS):
        return "High"
    if incident_type in {"accident", "natural-disaster", "harassment"}:
        return "Medium"
    return "Medium"


def severity_to_priority(severity: str, incident_type: str) -> int:
    base = {"Low": 2, "Medium": 5, "High": 7, "Critical": 9}[severity]
    if incident_type in {"medical", "fire", "crime", "rescue"}:
        return min(9, base + 1)
    return base


def severity_to_eta(severity: str) -> str:
    return {
        "Low": "30-60 minutes",
        "Medium": "15-30 minutes",
        "High": "5-15 minutes",
        "Critical": "Immediate dispatch",
    }[severity]


def should_call_emergency(severity: str, incident_type: str) -> bool:
    return severity in {"High", "Critical"} or incident_type in {"medical", "fire", "crime"}


def triage_incident(description: str, provided_type: str | None) -> TriageResult:
    incident_type = infer_incident_type(description, provided_type)
    severity = infer_severity(description, incident_type)
    return TriageResult(
        type=incident_type,
        severity=severity,
        description=description.strip(),
        priority_score=severity_to_priority(severity, incident_type),
        estimated_response_time=severity_to_eta(severity),
        immediate_actions=generate_dynamic_instructions(description, incident_type),
        call_emergency=should_call_emergency(severity, incident_type),
        confidence=0.74,
    )


def team_for_incident(incident_type: str) -> str:
    return TEAM_BY_TYPE.get(incident_type, "general")

