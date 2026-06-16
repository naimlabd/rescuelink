const API_CONFIG = {
  REPORT_INCIDENT: '/webhook/incident-report',
  GET_ACTIVE_INCIDENTS: '/webhook/incidents/active',
  WORKER_RESPONSE: '/webhook/incident/respond',
  HOSPITAL_REQUEST: '/webhook/incident/hospital-request',
  HOSPITAL_UPDATE: '/webhook/hospital/update',
  CHECK_STATUS: '/webhook/incident/status',
  GET_PATIENT_INCIDENTS: '/webhook/patient/incidents',
  AI_TRIAGE: '/webhook/ai/triage',
  AI_DISPATCHER_COPILOT: '/webhook/ai/dispatcher-copilot',
  AI_HOSPITAL_SUMMARY: '/webhook/ai/hospital-summary',
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '';
const localBackendUrl = 'http://127.0.0.1:8000';

export function buildApiUrl(path) {
  if (!apiBaseUrl) {
    return path;
  }

  return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
}

export async function requestJson(url, options) {
  const maxAttempts = options?.method === 'POST' ? 1 : 3;
  const fallbackUrl = apiBaseUrl || url.startsWith('http')
    ? null
    : `${localBackendUrl}${url}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return response.json();
    } catch (error) {
      if (attempt === maxAttempts) {
        if (fallbackUrl) {
          const fallbackResponse = await fetch(fallbackUrl, options);
          if (!fallbackResponse.ok) {
            throw new Error(`Request failed with status ${fallbackResponse.status}`);
          }
          return fallbackResponse.json();
        }
        throw error;
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 350 * attempt);
      });
    }
  }
}

export async function reportIncident(payload) {
  return requestJson(buildApiUrl(API_CONFIG.REPORT_INCIDENT), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getActiveIncidents() {
  const data = await requestJson(buildApiUrl(API_CONFIG.GET_ACTIVE_INCIDENTS));
  return Array.isArray(data) ? data : [];
}

export async function submitWorkerResponse(payload) {
  return requestJson(buildApiUrl(API_CONFIG.WORKER_RESPONSE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function requestHospitalSupport(payload) {
  return requestJson(buildApiUrl(API_CONFIG.HOSPITAL_REQUEST), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateHospitalStatus(payload) {
  return requestJson(buildApiUrl(API_CONFIG.HOSPITAL_UPDATE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function checkIncidentStatus(incidentId) {
  return requestJson(`${buildApiUrl(API_CONFIG.CHECK_STATUS)}?incident_id=${encodeURIComponent(incidentId)}`);
}

export async function getPatientIncidents(patientSessionId) {
  return requestJson(
    `${buildApiUrl(API_CONFIG.GET_PATIENT_INCIDENTS)}?patient_session_id=${encodeURIComponent(patientSessionId)}`,
  );
}

export async function analyzeEmergency(payload) {
  return requestJson(buildApiUrl(API_CONFIG.AI_TRIAGE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getDispatcherCopilot(incidentId) {
  return requestJson(`${buildApiUrl(API_CONFIG.AI_DISPATCHER_COPILOT)}?incident_id=${encodeURIComponent(incidentId)}`);
}

export async function getHospitalPreparationSummary(incidentId) {
  return requestJson(`${buildApiUrl(API_CONFIG.AI_HOSPITAL_SUMMARY)}?incident_id=${encodeURIComponent(incidentId)}`);
}
