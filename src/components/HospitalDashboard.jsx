import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { BedDouble, Brain, Building2, Clock3, HeartPulse, RefreshCw, ShieldPlus, Sparkles, Stethoscope, Volume2, VolumeX } from 'lucide-react';
import { io } from 'socket.io-client';
import { getActiveIncidents, getHospitalPreparationSummary, updateHospitalStatus } from '../lib/incidentApi';
import { playAlert } from '../lib/audio';
import MapPreview from './MapPreview';
import PortalShell from './PortalShell';

const HospitalDashboard = ({ session, onSignOut }) => {
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [preparationNote, setPreparationNote] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [aiPrep, setAiPrep] = useState(null);
  const [loadingAiPrep, setLoadingAiPrep] = useState(false);
  const prevQueueCount = useRef(0);

  const fetchIncidents = useCallback(async (isSocketEvent = false) => {
    try {
      const active = await getActiveIncidents();
      const nextIncidents = active || [];
      
      const newQueueCount = nextIncidents.filter(i => i.hospital_required).length;
      if (isSocketEvent && alertsEnabled && newQueueCount > prevQueueCount.current) {
        playAlert();
      }
      prevQueueCount.current = newQueueCount;

      setIncidents(nextIncidents);
      setSelectedIncident((current) => {
        if (!current?.incident_id) return current;
        return nextIncidents.find((incident) => incident.incident_id === current.incident_id) || current;
      });
    } catch (error) {
      console.error('Error fetching hospital queue:', error);
    }
  }, [alertsEnabled]);

  useEffect(() => {
    fetchIncidents();
    
    // WebSockets for Real-time
    const socket = io('http://127.0.0.1:8000', { transports: ['polling'] });
    socket.on('incident-dashboard-updates', () => fetchIncidents(true));

    return () => socket.disconnect();
  }, [fetchIncidents]);

  const hospitalQueue = useMemo(
    () => incidents.filter((incident) => incident.hospital_required).sort((left, right) => right.priority_score - left.priority_score),
    [incidents],
  );

  const stats = useMemo(() => ({
    requested: hospitalQueue.filter((incident) => incident.hospital_status === 'requested').length,
    preparing: hospitalQueue.filter((incident) => incident.hospital_status === 'preparing').length,
    ready: hospitalQueue.filter((incident) => incident.hospital_status === 'ready').length,
  }), [hospitalQueue]);

  const updateStatus = async (hospitalStatus) => {
    if (!selectedIncident) return;
    try {
      await updateHospitalStatus({
        incident_id: selectedIncident.incident_id,
        hospital_status: hospitalStatus,
        hospital_preparation_note: preparationNote.trim(),
      });
      setActionNotice(`Hospital handoff marked ${hospitalStatus}.`);
      await fetchIncidents();
    } catch (error) {
      console.error('Error updating hospital status:', error);
      window.alert('Unable to update the hospital status right now.');
    }
  };

  const generateHospitalPrep = async () => {
    if (!selectedIncident) return;

    setLoadingAiPrep(true);
    try {
      const result = await getHospitalPreparationSummary(selectedIncident.incident_id);
      setAiPrep(result);
      setPreparationNote(result.preparation_note || preparationNote);
      setActionNotice('AI hospital preparation summary generated.');
    } catch (error) {
      console.error('Error loading hospital AI summary:', error);
      window.alert('Unable to generate the AI hospital summary right now.');
    } finally {
      setLoadingAiPrep(false);
    }
  };

  return (
    <PortalShell
      role="hospital"
      eyebrow="Hospital Coordination"
      title="Prepare hospital intake before arrival"
      subtitle="Ambulance-confirmed hospitalization cases appear here so staff can prepare treatment and receiving space."
      session={session}
      onSignOut={onSignOut}
      actions={
        <>
          <button
            onClick={() => {
              if (!alertsEnabled) playAlert(); // Test sound
              setAlertsEnabled(!alertsEnabled);
            }}
            className={`inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium backdrop-blur transition ${
              alertsEnabled ? 'border-rose-500/50 bg-rose-500/20 text-rose-300' : 'border-[var(--glass-border)] bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {alertsEnabled ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}
            {alertsEnabled ? 'Alerts On' : 'Alerts Off'}
          </button>
          <button
            onClick={() => fetchIncidents()}
            className="inline-flex items-center rounded-xl border border-[var(--glass-border)] bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20 transition"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: 'Requests', count: hospitalQueue.length, icon: HeartPulse, color: 'text-rose-400' },
              { label: 'Requested', count: stats.requested, icon: Clock3, color: 'text-amber-400', pulse: stats.requested > 0 },
              { label: 'Preparing', count: stats.preparing, icon: ShieldPlus, color: 'text-blue-400' },
              { label: 'Ready', count: stats.ready, icon: BedDouble, color: 'text-emerald-400' }
            ].map(stat => (
              <div key={stat.label} className={`glass-panel p-5 text-center flex flex-col items-center ${stat.pulse ? 'pulse-emergency' : ''}`}>
                <stat.icon className={`h-6 w-6 ${stat.color} mb-2`} />
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{stat.label}</div>
                <div className="mt-2 text-3xl font-bold text-white">{stat.count}</div>
              </div>
            ))}
          </div>

          <div className="glass-panel p-5">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Hospital queue</div>
              <h2 className="mt-1 text-2xl font-bold text-white">Incoming handoffs</h2>
            </div>
            {hospitalQueue.length > 0 ? (
              <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-1">
                {hospitalQueue.map((incident) => (
                  <button
                    key={incident.incident_id}
                    onClick={() => {
                      setSelectedIncident(incident);
                      setPreparationNote(incident.hospital_preparation_note || '');
                      setAiPrep(null);
                      setActionNotice('');
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedIncident?.incident_id === incident.incident_id
                        ? 'border-rose-400 bg-rose-900/30'
                        : 'border-[var(--glass-border)] bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          incident.severity === 'Critical' ? 'bg-red-500/20 text-red-400' :
                          incident.severity === 'High' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {incident.severity}
                        </span>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                          {incident.hospital_status}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">#{incident.incident_id.slice(-6)}</span>
                    </div>
                    <div className="mt-3 text-base font-semibold text-white">{incident.hospital_name || 'Receiving hospital'}</div>
                    <div className="mt-1 text-sm text-slate-400">{incident.hospital_summary || incident.description}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-white/5 p-8 text-center text-sm text-slate-400">
                No ambulance handoffs are currently waiting.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-rose-400" />
              <h2 className="text-xl font-semibold text-white">Receiving brief</h2>
            </div>

            {selectedIncident ? (
              <div className="space-y-5 animate-fade-in">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { title: 'Patient', val1: selectedIncident.citizen_name || 'Unknown', val2: selectedIncident.phone || 'No phone provided' },
                    { title: 'Ambulance', val1: selectedIncident.assigned_ambulance_unit, val2: selectedIncident.assigned_ambulance_base },
                    { title: 'ETA', val1: `${selectedIncident.eta_minutes || 0} minutes`, val2: 'Estimated arrival' },
                    { title: 'Current Handoff', val1: selectedIncident.hospital_status, val2: 'Status' }
                  ].map(stat => (
                    <div key={stat.title} className="rounded-2xl bg-white/5 border border-[var(--glass-border)] p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-400">{stat.title}</div>
                      <div className="mt-2 text-sm font-semibold text-white">{stat.val1}</div>
                      <div className="mt-1 text-sm text-slate-400">{stat.val2}</div>
                    </div>
                  ))}
                </div>

                <MapPreview lat={selectedIncident.lat} lon={selectedIncident.lon} secondaryLat={selectedIncident.ambulance_location?.lat} secondaryLon={selectedIncident.ambulance_location?.lon} title="Patient destination" detail={selectedIncident.ambulance_location ? `Ambulance ${selectedIncident.ambulance_location.label}` : undefined} />

                <div className="rounded-2xl bg-white/5 border border-[var(--glass-border)] p-4 text-sm text-slate-300">
                  {selectedIncident.hospital_summary || selectedIncident.description}
                </div>

                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-cyan-300" />
                      <div>
                        <div className="text-sm font-semibold text-white">AI Hospital Preparation Summary</div>
                        <div className="text-xs text-cyan-100/80">Generate likely needs, receiving priority, and a ready-to-use preparation note.</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={generateHospitalPrep}
                      disabled={loadingAiPrep}
                      className="inline-flex items-center rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
                    >
                      {loadingAiPrep ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Generate prep
                    </button>
                  </div>
                  {aiPrep && (
                    <div className="mt-4 space-y-3 text-sm text-cyan-50">
                      <div className="rounded-xl bg-slate-950/40 p-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Receiving priority</div>
                        <p className="mt-2">{aiPrep.receiving_priority}</p>
                      </div>
                      <div className="rounded-xl bg-slate-950/40 p-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Likely needs</div>
                        <p className="mt-2">{(aiPrep.likely_needs || []).join(', ')}</p>
                      </div>
                    </div>
                  )}
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">Preparation note</span>
                  <textarea
                    value={preparationNote}
                    onChange={(e) => setPreparationNote(e.target.value)}
                    placeholder="Example: Bed cleared, oxygen ready."
                    rows={3}
                    className="w-full rounded-2xl border border-[var(--glass-border)] bg-slate-900/50 px-4 py-3 text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={() => updateStatus('preparing')} className="rounded-2xl bg-blue-600/80 px-5 py-4 text-sm font-semibold text-white transition hover:bg-blue-600">
                    Mark preparing
                  </button>
                  <button onClick={() => updateStatus('ready')} className="rounded-2xl bg-emerald-600/80 px-5 py-4 text-sm font-semibold text-white transition hover:bg-emerald-600 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                    Mark ready for arrival
                  </button>
                </div>
                {actionNotice && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-400">
                    {actionNotice}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-white/5 p-8 text-center text-sm text-slate-400">
                Select a hospital handoff to open its receiving brief.
              </div>
            )}
          </div>
        </div>
      </div>
    </PortalShell>
  );
};

export default HospitalDashboard;
