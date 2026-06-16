const AUTH_STORAGE_KEY = 'rescuelink_auth_session';
const PATIENT_SESSION_KEY = 'rescuelink_patient_session_id';

export const roleConfig = {
  patient: {
    title: 'Patient Access',
    subtitle: 'Report emergencies and follow live response updates.',
    accent: 'cyan',
  },
  ambulance: {
    title: '1122 Ambulance Services',
    subtitle: 'Dispatch units, manage cases, and update field status.',
    accent: 'emerald',
  },
  hospital: {
    title: 'Hospital Coordination',
    subtitle: 'Receive inbound cases and prepare medical intake teams.',
    accent: 'rose',
  },
  police: {
    title: 'Police Department',
    subtitle: 'Manage security, harassment, and accident response.',
    accent: 'blue',
  },
  fire: {
    title: 'Fire Brigade',
    subtitle: 'Manage fire and disaster control operations.',
    accent: 'orange',
  },
  admin: {
    title: 'City Command Center',
    subtitle: 'View overall analytics, live heatmaps, and system health.',
    accent: 'violet',
  },
};

const demoCredentials = {
  ambulance: {
    username: 'dispatcher',
    password: 'rescue1122',
    displayName: 'Lead Dispatcher',
  },
  hospital: {
    username: 'coordinator',
    password: 'carebridge',
    displayName: 'Hospital Coordinator',
  },
  police: {
    username: 'officer',
    password: 'police15',
    displayName: 'Police Dispatcher',
  },
  fire: {
    username: 'firechief',
    password: 'fire16',
    displayName: 'Fire Brigade Commander',
  },
  admin: {
    username: 'mayor',
    password: 'multan123',
    displayName: 'City Command Mayor',
  },
};

export function getAuthSession() {
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function saveAuthSession(session) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

function normalizePatientName(name) {
  return (name || '').trim().replace(/\s+/g, ' ');
}

function normalizePhone(phone) {
  return (phone || '').replace(/[^\d+]/g, '').trim();
}

function phoneDigitCount(phone) {
  return (phone.match(/\d/g) || []).length;
}

function stablePatientSessionId(name, phone) {
  const identity = `${name.toLowerCase()}|${phone}`;
  let hash = 5381;

  for (let index = 0; index < identity.length; index += 1) {
    hash = ((hash << 5) + hash) ^ identity.charCodeAt(index);
  }

  return `patient-${(hash >>> 0).toString(36)}`;
}

export function loginPatient(profile) {
  const displayName = normalizePatientName(profile.displayName);
  const phone = normalizePhone(profile.phone);

  if (!displayName) {
    throw new Error('Patient name is required');
  }

  if (!phone || phoneDigitCount(phone) < 7) {
    throw new Error('A valid phone number is required');
  }

  const patientSessionId = stablePatientSessionId(displayName, phone);
  window.localStorage.setItem(PATIENT_SESSION_KEY, patientSessionId);

  const session = {
    role: 'patient',
    displayName,
    phone,
    patientSessionId,
    signedInAt: new Date().toISOString(),
  };
  saveAuthSession(session);
  return session;
}

export function loginStaff(role, credentials) {
  const expected = demoCredentials[role];
  if (!expected) {
    throw new Error('Unknown role');
  }

  const username = credentials.username?.trim().toLowerCase();
  const password = credentials.password ?? '';
  if (username !== expected.username || password !== expected.password) {
    throw new Error('Invalid credentials');
  }

  const session = {
    role,
    displayName: expected.displayName,
    username: expected.username,
    signedInAt: new Date().toISOString(),
  };
  saveAuthSession(session);
  return session;
}
