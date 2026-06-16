import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AlertCircle, Ambulance, Brain, Clock, FileText, Hospital, RefreshCw, Send, Sparkles, User, Volume2, VolumeX } from 'lucide-react';
import { io } from 'socket.io-client';
import { getActiveIncidents, getDispatcherCopilot, requestHospitalSupport, submitWorkerResponse } from '../lib/incidentApi';
import { playAlert } from '../lib/audio';
import MapPreview from './MapPreview';
import PortalShell from './PortalShell';
import LiveChat from './LiveChat';

const severityStyles = {
  Critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  High: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const statusStyles = {
  pending: 'bg-red-500/20 text-red-400',
  acknowledged: 'bg-blue-500/20 text-blue-400',
  responding: 'bg-emerald-500/20 text-emerald-400',
  resolved: 'bg-slate-500/20 text-slate-400',
};

const WorkerDashboard = ({ session, onSignOut }) => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [socket, setSocket] = useState(null);
  const prevIncidentCount = useRef(0);
  
  const [responseForm, setResponseForm] = useState({
    response_type: 'acknowledge',
    response_message: '',
    status: 'acknowledged',
    eta_minutes: '6',
    worker_id: 'AMB-WORKER001',
    worker_name: session?.displayName || 'Emergency Responder',
  });
  const [hospitalSummary, setHospitalSummary] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [sendingHospitalRequest, setSendingHospitalRequest] = useState(false);
  const [copilot, setCopilot] = useState(null);
  const [loadingCopilot, setLoadingCopilot] = useState(false);

  const fetchActiveIncidents = useCallback(async (isSocketEvent = false) => {
    try {
      const data = await getActiveIncidents();
      const nextIncidents = data || [];
      
      if (isSocketEvent && alertsEnabled && nextIncidents.length > prevIncidentCount.current) {
        playAlert();
      }
      prevIncidentCount.current = nextIncidents.length;
      
      setIncidents(nextIncidents);
      setSelectedIncident((current) => {
        if (!current?.incident_id) return current;
        return nextIncidents.find((incident) => incident.incident_id === current.incident_id) || current;
      });
    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setLoading(false);
    }
  }, [alertsEnabled]);

  useEffect(() => {
    fetchActiveIncidents();
    
    const newSocket = io('http://127.0.0.1:8000', { transports: ['polling'] });
    setSocket(newSocket);
    newSocket.on('new-incidents', () => fetchActiveIncidents(true));
    newSocket.on('incident-dashboard-updates', () => fetchActiveIncidents(true));

    return () => newSocket.disconnect();
  }, [fetchActiveIncidents]);

  const counts = useMemo(() => ({
    total: incidents.length,
    critical: incidents.filter((incident) => incident.severity === 'Critical').length,
    pending: incidents.filter((incident) => incident.status === 'pending').length,
    responding: incidents.filter((incident) => incident.status === 'responding').length,
  }), [incidents]);

  const submitResponse = async () => {
    if (!selectedIncident || !responseForm.response_message.trim()) {
      window.alert('Please select a case and enter a response message.');
      return;
    }

    try {
      await submitWorkerResponse({
        ...responseForm,
        incident_id: selectedIncident.incident_id,
      });
      setActionNotice('Ambulance update sent to the patient dashboard.');
      setResponseForm((current) => ({ ...current, response_message: '' }));
      await fetchActiveIncidents();
    } catch (error) {
      console.error('Error submitting response:', error);
      window.alert('Unable to send the ambulance update right now.');
    }
  };

  const sendHospitalRequest = async () => {
    if (!selectedIncident) return;

    setSendingHospitalRequest(true);
    try {
      const response = await requestHospitalSupport({
        incident_id: selectedIncident.incident_id,
        hospital_summary: hospitalSummary.trim() || 'Patient requires hospital-ready treatment on arrival.',
        response_message: 'Hospital has been notified to prepare for patient arrival.',
      });
      setActionNotice(`Hospital notified: ${response.hospital_name || 'receiving hospital'} is preparing this case.`);
      await fetchActiveIncidents();
    } catch (error) {
      console.error('Error sending hospital request:', error);
      window.alert('Unable to send the hospital request right now.');
    } finally {
      setSendingHospitalRequest(false);
    }
  };

  const generateCopilotPlan = async () => {
    if (!selectedIncident) return;

    setLoadingCopilot(true);
    try {
      const result = await getDispatcherCopilot(selectedIncident.incident_id);
      setCopilot(result);
      setHospitalSummary(result.hospital_summary || hospitalSummary);
      setActionNotice('AI dispatcher copilot prepared a response plan.');
    } catch (error) {
      console.error('Error loading dispatcher copilot:', error);
      window.alert('Unable to generate the AI dispatcher plan right now.');
    } finally {
      setLoadingCopilot(false);
    }
  };

  return (
    <PortalShell
      role="ambulance"
      eyebrow="1122 Ambulance Services"
      title="Ambulance dispatch and field response"
      subtitle="Serious incidents are shown first. Free units can review the full queue and trigger hospital transfers directly."
      session={session}
      onSignOut={onSignOut}
      actions={
        <>
          <button
            onClick={() => {
              if (!alertsEnabled) playAlert(); // Play test sound when turning on
              setAlertsEnabled(!alertsEnabled);
            }}
            className={`inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium backdrop-blur transition ${
              alertsEnabled ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300' : 'border-[var(--glass-border)] bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {alertsEnabled ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}
            {alertsEnabled ? 'Alerts On' : 'Alerts Off'}
          </button>
          <button
            onClick={() => fetchActiveIncidents()}
            className="inline-flex items-center rounded-xl border border-[var(--glass-border)] bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20 transition"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: 'Active', count: counts.total },
              { label: 'Critical', count: counts.critical, pulse: counts.critical > 0 },
              { label: 'Pending', count: counts.pending },
              { label: 'Responding', count: counts.responding }
            ].map((stat) => (
              <div key={stat.label} className={`glass-panel p-5 text-center ${stat.pulse ? 'pulse-emergency' : ''}`}>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{stat.label}</div>
                <div className="mt-2 text-3xl font-bold text-white">{stat.count}</div>
              </div>
            ))}
          </div>

          <div className="glass-panel p-5">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Case queue</div>
              <h2 className="mt-1 text-2xl font-bold text-white">Active ambulance cases</h2>
            </div>
            {loading ? (
              <div className="rounded-2xl bg-white/5 p-8 text-center text-sm text-slate-400">Loading dispatch queue...</div>
            ) : incidents.length > 0 ? (
              <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-1">
                {incidents.map((incident) => (
                  <button
                    key={incident.incident_id}
                    onClick={() => {
                      setSelectedIncident(incident);
                      setHospitalSummary(incident.hospital_summary || '');
                      setCopilot(null);
                      setActionNotice('');
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedIncident?.incident_id === incident.incident_id
                        ? 'border-emerald-400 bg-emerald-900/30'
                        : 'border-[var(--glass-border)] bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityStyles[incident.severity] || severityStyles.Low}`}>
                          {incident.severity}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[incident.status] || statusStyles.pending}`}>
                          {incident.status}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">#{incident.incident_id.slice(-6)}</span>
                    </div>
                    <div className="mt-3 text-lg font-semibold capitalize text-white">{incident.type}</div>
                    <div className="mt-1 text-sm text-slate-300">{incident.description}</div>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5 text-emerald-400" />{incident.citizen_name || 'Anonymous'}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-emerald-400" />ETA {incident.eta_minutes || 0} min</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-white/5 p-8 text-center">
                <AlertCircle className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <div className="text-sm text-slate-400">No active ambulance cases at the moment.</div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-5">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Case workspace</div>
              <h2 className="mt-1 text-2xl font-bold text-white">Selected emergency</h2>
            </div>

            {selectedIncident ? (
              <div className="space-y-5 animate-fade-in">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { title: 'Patient', val1: selectedIncident.citizen_name || 'Unknown', val2: selectedIncident.phone || 'No phone provided' },
                    { title: 'Seriousness', val1: selectedIncident.patient_severity_label || selectedIncident.severity, val2: `Priority score ${selectedIncident.priority_score}/9` },
                    { title: 'Assigned Ambulance', val1: selectedIncident.assigned_ambulance_unit, val2: selectedIncident.assigned_ambulance_base },
                    { title: 'Hospital Status', val1: selectedIncident.hospital_status || 'not-required', val2: selectedIncident.hospital_name || 'No hospital notified yet' }
                  ].map(stat => (
                    <div key={stat.title} className="rounded-2xl bg-white/5 border border-[var(--glass-border)] p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{stat.title}</div>
                      <div className="mt-2 text-sm font-semibold text-white">{stat.val1}</div>
                      <div className="mt-1 text-sm text-slate-400">{stat.val2}</div>
                    </div>
                  ))}
                </div>

                <MapPreview lat={selectedIncident.lat} lon={selectedIncident.lon} secondaryLat={selectedIncident.ambulance_location?.lat} secondaryLon={selectedIncident.ambulance_location?.lon} title="Live Tracking" detail={selectedIncident.ambulance_location ? `Ambulance ${selectedIncident.ambulance_location.label}` : ''} />

                <div className="rounded-2xl bg-white/5 border border-[var(--glass-border)] p-4 text-sm text-slate-300">
                  {selectedIncident.description}
                </div>

                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-cyan-300" />
                      <div>
                        <div className="text-sm font-semibold text-white">AI Dispatcher Copilot</div>
                        <div className="text-xs text-cyan-100/80">Summarizes this case, drafts the patient update, and prepares hospital handoff text.</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={generateCopilotPlan}
                      disabled={loadingCopilot}
                      className="inline-flex items-center rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                    >
                      {loadingCopilot ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Generate plan
                    </button>
                  </div>
                  {copilot && (
                    <div className="mt-4 space-y-3 text-sm text-cyan-50">
                      <p>{copilot.case_summary}</p>
                      <div className="rounded-xl bg-slate-950/40 p-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Suggested patient message</div>
                        <p className="mt-2">{copilot.patient_message}</p>
                        <button
                          type="button"
                          onClick={() => setResponseForm((current) => ({ ...current, response_message: copilot.patient_message }))}
                          className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                        >
                          Use patient message
                        </button>
                      </div>
                      <div className="rounded-xl bg-slate-950/40 p-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Suggested hospital</div>
                        <p className="mt-2">{copilot.recommended_hospital?.name} · {copilot.recommended_hospital?.distance_km} km</p>
                        <button
                          type="button"
                          onClick={() => setHospitalSummary(copilot.hospital_summary || '')}
                          className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                        >
                          Use hospital brief
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-300">Ambulance status</span>
                    <select
                      value={responseForm.response_type}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setResponseForm((curr) => ({
                          ...curr, response_type: nextType,
                          status: nextType === 'acknowledge' ? 'acknowledged' : nextType === 'resolve' ? 'resolved' : 'responding',
                        }));
                      }}
                      className="w-full rounded-2xl border border-[var(--glass-border)] bg-slate-900/50 px-4 py-3 text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="acknowledge">Unit assigned</option>
                      <option value="respond">En route</option>
                      <option value="update">Patient assessed</option>
                      <option value="resolve">Case completed</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-300">ETA (minutes)</span>
                    <input
                      type="number"
                      value={responseForm.eta_minutes}
                      onChange={(e) => setResponseForm((curr) => ({ ...curr, eta_minutes: e.target.value }))}
                      className="w-full rounded-2xl border border-[var(--glass-border)] bg-slate-900/50 px-4 py-3 text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">Message for patient</span>
                  <textarea
                    value={responseForm.response_message}
                    onChange={(e) => setResponseForm((curr) => ({ ...curr, response_message: e.target.value }))}
                    placeholder="Example: Ambulance is on the way and will reach you in 6 minutes."
                    rows={3}
                    className="w-full rounded-2xl border border-[var(--glass-border)] bg-slate-900/50 px-4 py-3 text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </label>

                <button
                  onClick={submitResponse}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send ambulance update
                </button>
                {actionNotice && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-400">
                    {actionNotice}
                  </div>
                )}
                
                <div className="mt-6">
                  <LiveChat incidentId={selectedIncident.incident_id} session={session} socket={socket} />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/5 p-10 text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <div className="text-sm text-slate-400">Select a case from the queue to manage it.</div>
              </div>
            )}
          </div>

          {selectedIncident && (
            <div className="glass-panel p-5 animate-fade-in">
              <div className="mb-4 flex items-center gap-2">
                <Hospital className="h-5 w-5 text-rose-500" />
                <h2 className="text-xl font-semibold text-white">Hospital handoff</h2>
              </div>
              <p className="text-sm text-slate-400">
                Use this when the patient needs hospital-ready treatment.
              </p>
              <textarea
                value={hospitalSummary}
                onChange={(e) => setHospitalSummary(e.target.value)}
                placeholder="Example: Patient needs oxygen support, trauma intake..."
                rows={3}
                className="mt-4 w-full rounded-2xl border border-[var(--glass-border)] bg-slate-900/50 px-4 py-3 text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
              <button
                onClick={sendHospitalRequest}
                disabled={sendingHospitalRequest}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-rose-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-rose-500 hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]"
              >
                <Ambulance className="mr-2 h-4 w-4" />
                {sendingHospitalRequest ? 'Notifying hospital...' : selectedIncident.hospital_required ? 'Hospital notified' : 'Notify hospital to prepare'}
              </button>
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  );
};

export default WorkerDashboard;
