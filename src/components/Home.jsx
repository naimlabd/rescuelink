import React, { useEffect, useState } from 'react';
import {
  Activity,
  Ambulance,
  ArrowRight,
  BedDouble,
  Building2,
  HeartPulse,
  RadioTower,
  ShieldCheck,
  Siren,
  Stethoscope,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getActiveIncidents, getSystemHealth } from '../lib/incidentApi';

const roleCards = [
  {
    title: 'Patient Reporting',
    to: '/patient',
    icon: HeartPulse,
    accent: 'from-blue-600 to-cyan-500',
    copy: 'Capture live location, incident details, responder assignment, and medical guidance in one flow.',
  },
  {
    title: '1122 Ambulance Services',
    to: '/ambulance',
    icon: Ambulance,
    accent: 'from-emerald-600 to-teal-500',
    copy: 'Dispatch vehicles, coordinate field response, and keep the public feed synchronized in real time.',
  },
  {
    title: 'Hospital Command',
    to: '/hospital',
    icon: Building2,
    accent: 'from-rose-600 to-orange-500',
    copy: 'Prepare intake teams, prioritize critical arrivals, and monitor backend emergency nodes and alerts.',
  },
];

const Home = () => {
  const [health, setHealth] = useState(null);
  const [activeIncidents, setActiveIncidents] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [healthResult, incidents] = await Promise.all([
          getSystemHealth(),
          getActiveIncidents(),
        ]);
        setHealth(healthResult);
        setActiveIncidents(incidents || []);
      } catch (error) {
        console.error('Error loading operations hub:', error);
      }
    };

    load();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-slate-900">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="border-b border-white/10 bg-[linear-gradient(135deg,#8c1d2b_0%,#0f2740_48%,#11253c_100%)] px-6 py-8 text-white">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr] lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-red-200">
                <RadioTower className="h-4 w-4" />
                Emergency Coordination Network
              </div>
              <h1 className="max-w-4xl text-4xl font-bold leading-tight">
                Dispatch, transport, and hospital readiness in one connected operations surface
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-200">
                This system is designed to coordinate live emergency intake, 1122 field response, and hospital receiving workflows across the same incident stream.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Active incidents</div>
                <div className="mt-2 text-3xl font-bold">{activeIncidents.length}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Critical cases</div>
                <div className="mt-2 text-3xl font-bold">
                  {activeIncidents.filter((incident) => incident.severity === 'Critical').length}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Backend nodes</div>
                <div className="mt-2 text-sm font-semibold text-emerald-200">
                  {health?.nodes ? `${Object.keys(health.nodes).length} ready` : 'Loading'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 bg-slate-100 p-6 lg:grid-cols-[1.3fr_0.95fr]">
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold text-slate-900">Role workspaces</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {roleCards.map((role) => {
                  const Icon = role.icon;
                  return (
                    <Link
                      key={role.title}
                      to={role.to}
                      className="group rounded-lg border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
                    >
                      <div className={`mb-4 inline-flex rounded-lg bg-gradient-to-br ${role.accent} p-3 text-white`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-base font-semibold text-slate-900">{role.title}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{role.copy}</p>
                      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                        Open workspace
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Siren className="h-5 w-5 text-red-600" />
                <h2 className="text-lg font-semibold text-slate-900">Professional features this system should keep growing into</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">One-tap patient reporting with automatic session-linked status updates</div>
                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">Nearest ambulance assignment with route-aware ETA and dispatch visibility</div>
                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">Patient media uploads with evidence-safe storage and review</div>
                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">Role-based login, audit trail, and chain-of-command escalation</div>
                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">SMS / WhatsApp / dispatch-console notifications for field teams</div>
                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">Structured triage templates for fire, trauma, stroke, and cardiac events</div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-900">Network health</h2>
              </div>
              <div className="space-y-2">
                {health?.nodes ? Object.entries(health.nodes).map(([node, status]) => (
                  <div key={node} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <span className="text-slate-700">{node}</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{status}</span>
                  </div>
                )) : (
                  <div className="text-sm text-slate-500">Loading backend health...</div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <BedDouble className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-slate-900">Operational posture</h2>
              </div>
              <div className="space-y-3 text-sm text-slate-700">
                <div className="rounded-lg bg-slate-50 px-4 py-3">Patients should be able to report from a phone in seconds with auto-location and no extra friction.</div>
                <div className="rounded-lg bg-slate-50 px-4 py-3">1122 teams need a dispatch-first view with location, severity, contact, and status controls always visible.</div>
                <div className="rounded-lg bg-slate-50 px-4 py-3">Hospitals need a receiving board that helps them prepare before the ambulance arrives, not after.</div>
                <div className="rounded-lg bg-slate-50 px-4 py-3">Critical events should trigger parallel notification streams so ambulance and hospital teams move together.</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-rose-600" />
                <h2 className="text-lg font-semibold text-slate-900">Current system snapshot</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Critical incidents</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {activeIncidents.filter((incident) => incident.severity === 'Critical').length}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Responding units</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {activeIncidents.filter((incident) => incident.status === 'responding').length}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
