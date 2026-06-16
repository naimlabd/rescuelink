import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AlertCircle, Clock, FileText, RefreshCw, Send, ShieldAlert, User, Volume2, VolumeX } from 'lucide-react';
import { io } from 'socket.io-client';
import { getActiveIncidents, submitWorkerResponse } from '../lib/incidentApi';
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
  pending: 'bg-amber-500/20 text-amber-400',
  acknowledged: 'bg-blue-500/20 text-blue-400',
  responding: 'bg-emerald-500/20 text-emerald-400',
  resolved: 'bg-slate-500/20 text-slate-400',
};

const PoliceDashboard = ({ session, onSignOut }) => {
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
    worker_id: 'POL-WORKER001',
    worker_name: session?.displayName || 'Police Officer',
  });
  const [actionNotice, setActionNotice] = useState('');

  const fetchActiveIncidents = useCallback(async (isSocketEvent = false) => {
    try {
      const data = await getActiveIncidents();
      const allIncidents = data || [];
      const policeIncidents = allIncidents.filter(i => i.police_required);
      
      if (isSocketEvent && alertsEnabled && policeIncidents.length > prevIncidentCount.current) {
        playAlert();
      }
      prevIncidentCount.current = policeIncidents.length;
      
      setIncidents(policeIncidents);
      setSelectedIncident((current) => {
        if (!current?.incident_id) return current;
        return policeIncidents.find((incident) => incident.incident_id === current.incident_id) || current;
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
    pending: incidents.filter((incident) => incident.police_status === 'pending').length,
    responding: incidents.filter((incident) => incident.police_status === 'responding').length,
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
      setActionNotice('Police status update sent.');
      setResponseForm((current) => ({ ...current, response_message: '' }));
      await fetchActiveIncidents();
    } catch (error) {
      console.error('Error submitting response:', error);
      window.alert('Unable to send the police update right now.');
    }
  };

  return (
    <PortalShell
      role="police"
      eyebrow="Multan Police"
      title="Security & Law Enforcement"
      subtitle="Security and accident incidents requiring police response appear here."
      session={session}
      onSignOut={onSignOut}
      actions={
        <>
          <button
            onClick={() => {
              if (!alertsEnabled) playAlert();
              setAlertsEnabled(!alertsEnabled);
            }}
            className={`inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium backdrop-blur transition ${
              alertsEnabled ? 'border-blue-500/50 bg-blue-500/20 text-blue-300' : 'border-[var(--glass-border)] bg-white/10 text-white hover:bg-white/20'
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
              <h2 className="mt-1 text-2xl font-bold text-white">Active police cases</h2>
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
                      setActionNotice('');
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedIncident?.incident_id === incident.incident_id
                        ? 'border-blue-400 bg-blue-900/30'
                        : 'border-[var(--glass-border)] bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityStyles[incident.severity] || severityStyles.Low}`}>
                          {incident.severity}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[incident.police_status] || statusStyles.pending}`}>
                          {incident.police_status}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">#{incident.incident_id.slice(-6)}</span>
                    </div>
                    <div className="mt-3 text-lg font-semibold capitalize text-white">{incident.type}</div>
                    <div className="mt-1 text-sm text-slate-300">{incident.description}</div>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5 text-blue-400" />{incident.citizen_name || 'Anonymous'}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-blue-400" />ETA {incident.eta_minutes || 0} min</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-white/5 p-8 text-center">
                <AlertCircle className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <div className="text-sm text-slate-400">No active police cases at the moment.</div>
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
                    { title: 'Reporter', val1: selectedIncident.citizen_name || 'Unknown', val2: selectedIncident.phone || 'No phone provided' },
                    { title: 'Seriousness', val1: selectedIncident.patient_severity_label || selectedIncident.severity, val2: `Priority score ${selectedIncident.priority_score}/9` },
                    { title: 'Assigned Unit', val1: selectedIncident.assigned_police_unit, val2: 'Police Dispatch' },
                    { title: 'Other Agencies', val1: selectedIncident.assigned_ambulance_unit ? 'Ambulance dispatched' : 'None', val2: '' }
                  ].map(stat => (
                    <div key={stat.title} className="rounded-2xl bg-white/5 border border-[var(--glass-border)] p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{stat.title}</div>
                      <div className="mt-2 text-sm font-semibold text-white">{stat.val1}</div>
                      <div className="mt-1 text-sm text-slate-400">{stat.val2}</div>
                    </div>
                  ))}
                </div>

                <MapPreview lat={selectedIncident.lat} lon={selectedIncident.lon} secondaryLat={selectedIncident.police_location?.lat} secondaryLon={selectedIncident.police_location?.lon} title="Incident Location" detail={selectedIncident.police_location ? `Unit ${selectedIncident.police_location.label}` : ''} />

                <div className="rounded-2xl bg-white/5 border border-[var(--glass-border)] p-4 text-sm text-slate-300">
                  {selectedIncident.description}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-300">Police status</span>
                    <select
                      value={responseForm.response_type}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setResponseForm((curr) => ({
                          ...curr, response_type: nextType,
                          status: nextType === 'acknowledge' ? 'acknowledged' : nextType === 'resolve' ? 'resolved' : 'responding',
                        }));
                      }}
                      className="w-full rounded-2xl border border-[var(--glass-border)] bg-slate-900/50 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="acknowledge">Unit assigned</option>
                      <option value="respond">En route</option>
                      <option value="update">Scene secured</option>
                      <option value="resolve">Case completed</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-300">ETA (minutes)</span>
                    <input
                      type="number"
                      value={responseForm.eta_minutes}
                      onChange={(e) => setResponseForm((curr) => ({ ...curr, eta_minutes: e.target.value }))}
                      className="w-full rounded-2xl border border-[var(--glass-border)] bg-slate-900/50 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">Message for reporter</span>
                  <textarea
                    value={responseForm.response_message}
                    onChange={(e) => setResponseForm((curr) => ({ ...curr, response_message: e.target.value }))}
                    placeholder="Example: Police unit is on the way."
                    rows={3}
                    className="w-full rounded-2xl border border-[var(--glass-border)] bg-slate-900/50 px-4 py-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </label>

                <button
                  onClick={submitResponse}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send police update
                </button>
                {actionNotice && (
                  <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-400">
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
        </div>
      </div>
    </PortalShell>
  );
};

export default PoliceDashboard;
