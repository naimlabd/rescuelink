import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Ambulance, Brain, Flame, HeartPulse, LocateFixed, Mic, RefreshCw, ShieldAlert, Siren, Sparkles, TrafficCone, Waves } from 'lucide-react';
import { io } from 'socket.io-client';
import { analyzeEmergency, getPatientIncidents, reportIncident } from '../lib/incidentApi';
import MapPreview from './MapPreview';
import PortalShell from './PortalShell';
import LiveChat from './LiveChat';

const PATIENT_SESSION_KEY = 'rescuelink_patient_session_id';
const DEFAULT_DISPATCH_LOCATION = {
  lat: 30.1575,
  lon: 71.5249,
  accuracy: null,
  source: 'Dispatch GPS fallback',
  locked: false,
};

const emergencyTypes = [
  { type: 'medical', label: 'Medical', icon: HeartPulse, accent: 'from-rose-500 to-red-600' },
  { type: 'accident', label: 'Accident', icon: TrafficCone, accent: 'from-amber-500 to-orange-500' },
  { type: 'fire', label: 'Fire', icon: Flame, accent: 'from-orange-500 to-red-600' },
  { type: 'crime', label: 'Security', icon: ShieldAlert, accent: 'from-slate-700 to-slate-900' },
  { type: 'natural-disaster', label: 'Disaster', icon: Waves, accent: 'from-blue-500 to-cyan-600' },
  { type: 'harassment', label: 'Harassment', icon: Siren, accent: 'from-violet-500 to-indigo-600' },
];

const seriousnessLevels = [
  { value: 'watch', title: 'Needs help soon', description: 'Patient is conscious, needs support quickly.' },
  { value: 'urgent', title: 'Urgent emergency', description: 'Patient is in distress, assistance needed now.' },
  { value: 'critical', title: 'Life-threatening', description: 'Breathing, bleeding, or extreme danger involved.' },
  { value: 'mass-casualty', title: 'Multiple victims', description: 'Multiple injured or extremely dangerous scene.' },
];

const statusStyles = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  acknowledged: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  responding: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  resolved: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  'not-required': 'bg-white/5 text-slate-500 border-white/10',
};

function getPatientSessionId(preferredSessionId) {
  if (preferredSessionId) {
    window.localStorage.setItem(PATIENT_SESSION_KEY, preferredSessionId);
    return preferredSessionId;
  }

  const existing = window.localStorage.getItem(PATIENT_SESSION_KEY);
  if (existing) return existing;

  const created = `patient-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(PATIENT_SESSION_KEY, created);
  return created;
}

const CitizenDashboard = ({ session, onSignOut }) => {
  const [patientSessionId, setPatientSessionId] = useState('');
  const [selectedType, setSelectedType] = useState('medical');
  const [selectedSeverity, setSelectedSeverity] = useState('urgent');
  const [sending, setSending] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [patientIncidents, setPatientIncidents] = useState([]);
  const [liveLocation, setLiveLocation] = useState(DEFAULT_DISPATCH_LOCATION);
  const [voiceText, setVoiceText] = useState('');
  const [aiTriage, setAiTriage] = useState(null);
  const [analyzingVoice, setAnalyzingVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');

  const latestIncident = patientIncidents[0] || null;
  const activeIncidents = useMemo(() => patientIncidents.filter((incident) => incident.status !== 'resolved' && incident.police_status !== 'resolved' && incident.fire_status !== 'resolved'), [patientIncidents]);
  
  // Keep socket in state so we can pass it to LiveChat
  const [socket, setSocket] = useState(null);

  const refreshPatientFeed = useCallback(async (sessionId) => {
    if (!sessionId) return;
    try {
      const feed = await getPatientIncidents(sessionId);
      setPatientIncidents(feed.incidents || []);
    } catch (error) {
      console.error('Error loading patient feed:', error);
    } finally {
      setLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    const sessionId = getPatientSessionId(session?.patientSessionId);
    setPatientSessionId(sessionId);
    refreshPatientFeed(sessionId);

    // WebSockets
    const newSocket = io('http://127.0.0.1:8000', { transports: ['polling'] });
    setSocket(newSocket);
    newSocket.on('citizen-notifications', () => refreshPatientFeed(sessionId));

    return () => newSocket.disconnect();
  }, [refreshPatientFeed, session?.patientSessionId]);

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLiveLocation({
          lat: Number(position.coords.latitude.toFixed(6)),
          lon: Number(position.coords.longitude.toFixed(6)),
          accuracy: Math.round(position.coords.accuracy || 0),
          source: 'Device GPS lock',
          locked: true,
        });
      },
      () => {
        setLiveLocation((current) => ({
          ...current,
          source: current.locked ? current.source : 'Dispatch GPS fallback',
        }));
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 8000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const submitEmergency = async () => {
    setSending(true);
    try {
      await reportIncident({
        patient_session_id: patientSessionId,
        citizen_name: session?.displayName || 'Patient',
        phone: session?.phone || '',
        type: selectedType,
        patient_severity_label: selectedSeverity,
        description: aiTriage?.description,
        lat: liveLocation.lat,
        lon: liveLocation.lon,
      });
      await refreshPatientFeed(patientSessionId);
    } catch (error) {
      console.error('Error reporting emergency:', error);
      window.alert('Unable to send the emergency alert right now. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const startVoiceReport = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceNotice('Voice capture is not supported in this browser. You can type the spoken report below and analyze it.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setListening(true);
    setVoiceNotice('Listening. Speak the emergency clearly.');

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setVoiceText((current) => `${current ? `${current} ` : ''}${transcript}`.trim());
      setVoiceNotice('Voice report captured. Review it, then run AI triage.');
    };
    recognition.onerror = () => {
      setVoiceNotice('Voice capture stopped. You can type the report manually if needed.');
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognition.start();
  };

  const analyzeVoiceReport = async () => {
    if (!voiceText.trim()) {
      window.alert('Please speak or type the emergency report first.');
      return;
    }

    setAnalyzingVoice(true);
    try {
      const result = await analyzeEmergency({
        transcript: voiceText,
        type: selectedType,
        patient_severity_label: selectedSeverity,
        lat: liveLocation.lat,
        lon: liveLocation.lon,
      });
      setAiTriage(result);
      setSelectedType(result.recommended_type || selectedType);
      setSelectedSeverity(result.recommended_severity_label || selectedSeverity);
      setVoiceNotice('AI triage applied to your emergency request. You can still change manual selections before sending.');
    } catch (error) {
      console.error('Error analyzing voice report:', error);
      window.alert('Unable to analyze the voice report right now. You can still send the manual request.');
    } finally {
      setAnalyzingVoice(false);
    }
  };

  const getActiveTracker = () => {
    if (!latestIncident) return null;
    if (latestIncident.ambulance_location) return { ...latestIncident.ambulance_location, type: 'Ambulance' };
    if (latestIncident.police_location) return { ...latestIncident.police_location, type: 'Police' };
    if (latestIncident.fire_location) return { ...latestIncident.fire_location, type: 'Fire Brigade' };
    return null;
  };

  const activeTracker = getActiveTracker();

  return (
    <PortalShell
      role="patient"
      eyebrow="Multan Emergency Access"
      title="Report an emergency in a few taps"
      subtitle="Choose the emergency type, mark how serious it is, and the multi-agency dispatch system routes the case instantly."
      session={session}
      onSignOut={onSignOut}
      actions={
        <button
          onClick={() => refreshPatientFeed(patientSessionId)}
          className="inline-flex items-center rounded-xl border border-[var(--glass-border)] bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20 transition"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <div className="glass-panel p-5">
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Step 1</div>
              <h2 className="mt-1 text-2xl font-bold text-white">Choose the emergency type</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {emergencyTypes.map((item) => {
                const Icon = item.icon;
                const selected = selectedType === item.type;
                return (
                  <button
                    key={item.type}
                    data-testid={`emergency-type-${item.type}`}
                    onClick={() => setSelectedType(item.type)}
                    className={`rounded-[24px] border p-4 text-left transition ${
                      selected ? 'border-cyan-400 bg-cyan-900/30 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'border-[var(--glass-border)] bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className={`inline-flex rounded-2xl bg-gradient-to-br ${item.accent} p-3 text-white shadow-lg`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="mt-4 text-lg font-semibold text-white">{item.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass-panel p-5">
            <div className="mb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Step 2</div>
              <h2 className="mt-1 text-2xl font-bold text-white">How serious is the situation?</h2>
            </div>
            <div className="space-y-3">
              {seriousnessLevels.map((level) => (
                <button
                  key={level.value}
                  data-testid={`severity-${level.value}`}
                  onClick={() => setSelectedSeverity(level.value)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedSeverity === level.value ? 'border-rose-400 bg-rose-900/30 shadow-[0_0_15px_rgba(244,63,94,0.2)]' : 'border-[var(--glass-border)] bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="text-base font-semibold text-white">{level.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{level.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <Brain className="h-5 w-5 text-cyan-400" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Optional AI voice report</div>
                <h2 className="mt-1 text-2xl font-bold text-white">Speak or type what happened</h2>
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-400">
              Manual buttons stay available. This option helps patients who can speak faster than they can select details.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={startVoiceReport}
                className={`inline-flex items-center justify-center rounded-2xl border px-5 py-4 text-sm font-semibold transition ${
                  listening ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-[var(--glass-border)] bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Mic className="mr-2 h-4 w-4" />
                {listening ? 'Listening...' : 'Start voice report'}
              </button>
              <button
                type="button"
                onClick={analyzeVoiceReport}
                disabled={analyzingVoice}
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {analyzingVoice ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Analyze with AI
              </button>
            </div>
            <textarea
              value={voiceText}
              onChange={(event) => setVoiceText(event.target.value)}
              placeholder="Example: My father is having chest pain and breathing difficulty near Bosan Road."
              rows={3}
              className="mt-4 w-full rounded-2xl border border-[var(--glass-border)] bg-slate-900/50 px-4 py-3 text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            />
            {voiceNotice && (
              <div className="mt-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                {voiceNotice}
              </div>
            )}
            {aiTriage && (
              <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-50">
                <div className="font-semibold text-white">AI recommendation applied</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <span>Type: {aiTriage.recommended_type}</span>
                  <span>Severity: {aiTriage.severity}</span>
                  <span>Priority: {aiTriage.priority_score}/9</span>
                </div>
                <p className="mt-3 text-cyan-100">{aiTriage.description}</p>
              </div>
            )}
          </div>

          <div className="glass-panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <LocateFixed className="h-5 w-5 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Live incident location</h2>
            </div>
            <MapPreview
              lat={liveLocation.lat}
              lon={liveLocation.lon}
              title="Patient location"
              detail={liveLocation.locked ? `GPS accuracy ${liveLocation.accuracy || 'unknown'}m` : 'Automatic dispatch fallback'}
            />
            <button
              data-testid="send-emergency-request"
              onClick={submitEmergency}
              disabled={sending}
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-rose-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-rose-500 hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] disabled:opacity-50"
            >
              {sending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Siren className="mr-2 h-4 w-4" />}
              Send emergency request
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Live response</div>
                <h2 className="mt-1 text-2xl font-bold text-white">Multi-Agency Status</h2>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-slate-300">
                {activeIncidents.length} active
              </div>
            </div>

            {loadingFeed ? (
              <div className="rounded-2xl bg-white/5 p-8 text-center text-sm text-slate-400">Loading your emergency status...</div>
            ) : latestIncident ? (
              <div className="space-y-4 animate-fade-in">
                <div className="rounded-[24px] bg-[linear-gradient(135deg,#1e3a8a_0%,#0f172a_100%)] p-5 text-white border border-[var(--glass-border)] shadow-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Current case</div>
                      <div className="mt-2 text-2xl font-bold capitalize">{latestIncident.type}</div>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {latestIncident.assigned_ambulance_unit || latestIncident.status !== 'not-required' ? (
                      <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                        <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-300">
                          <Ambulance className="h-4 w-4 text-emerald-400" /> Ambulance
                        </div>
                        <div className={`mt-2 rounded-full border px-2 py-1 text-center text-[10px] font-semibold ${statusStyles[latestIncident.status] || statusStyles.pending}`}>
                          {latestIncident.status}
                        </div>
                      </div>
                    ) : null}

                    {latestIncident.police_required ? (
                      <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                        <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-300">
                          <ShieldAlert className="h-4 w-4 text-blue-400" /> Police
                        </div>
                        <div className={`mt-2 rounded-full border px-2 py-1 text-center text-[10px] font-semibold ${statusStyles[latestIncident.police_status] || statusStyles.pending}`}>
                          {latestIncident.police_status}
                        </div>
                      </div>
                    ) : null}

                    {latestIncident.fire_required ? (
                      <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                        <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-300">
                          <Flame className="h-4 w-4 text-orange-400" /> Fire Dept
                        </div>
                        <div className={`mt-2 rounded-full border px-2 py-1 text-center text-[10px] font-semibold ${statusStyles[latestIncident.fire_status] || statusStyles.pending}`}>
                          {latestIncident.fire_status}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {latestIncident.worker_response && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200">
                      <span className="font-semibold text-emerald-300">Latest message: </span>
                      {latestIncident.worker_response}
                    </div>
                  )}
                </div>

                {activeTracker && (
                  <MapPreview
                    lat={latestIncident.lat}
                    lon={latestIncident.lon}
                    secondaryLat={activeTracker.lat}
                    secondaryLon={activeTracker.lon}
                    title="Live Tracking"
                    detail={`${activeTracker.type} ${activeTracker.label || 'tracking'}`}
                  />
                )}

                <div className="mt-6">
                  <LiveChat incidentId={latestIncident.incident_id} session={session} socket={socket} />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/5 p-8 text-center">
                <AlertCircle className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <div className="text-lg font-semibold text-white">No emergency request yet</div>
                <p className="mt-2 text-sm text-slate-400">Choose the emergency type and seriousness, then send the request.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalShell>
  );
};

export default CitizenDashboard;
