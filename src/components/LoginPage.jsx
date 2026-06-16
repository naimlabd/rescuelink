import React, { useState } from 'react';
import { Ambulance, ArrowRight, Building2, HeartPulse, LockKeyhole, UserRound, ShieldAlert, Flame, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { loginPatient, loginStaff, roleConfig } from '../lib/auth';

const roleCards = [
  {
    role: 'patient',
    title: 'Patient',
    description: 'Fast emergency reporting with one-tap actions and live status.',
    icon: HeartPulse,
    accent: 'from-cyan-500 to-blue-600',
  },
  {
    role: 'ambulance',
    title: 'Ambulance',
    description: 'Dispatch operations, unit assignment, and field updates.',
    icon: Ambulance,
    accent: 'from-emerald-500 to-teal-600',
  },
  {
    role: 'hospital',
    title: 'Hospital',
    description: 'Receiving board, case prioritization, and intake preparation.',
    icon: Building2,
    accent: 'from-rose-500 to-red-600',
  },
  {
    role: 'police',
    title: 'Police',
    description: 'Manage security, harassment, and accident response.',
    icon: ShieldAlert,
    accent: 'from-blue-600 to-indigo-800',
  },
  {
    role: 'fire',
    title: 'Fire Brigade',
    description: 'Manage fire and disaster control operations.',
    icon: Flame,
    accent: 'from-orange-600 to-red-800',
  },
  {
    role: 'admin',
    title: 'Command Center',
    description: 'City-wide analytics, heatmaps, and system overview.',
    icon: Activity,
    accent: 'from-violet-600 to-fuchsia-800',
  },
];

const staffHints = {
  ambulance: 'Demo login: dispatcher / rescue1122',
  hospital: 'Demo login: coordinator / carebridge',
  police: 'Demo login: officer / police15',
  fire: 'Demo login: firechief / fire16',
  admin: 'Demo login: mayor / multan123',
};

const LoginPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState('patient');
  const [patientForm, setPatientForm] = useState({ displayName: '', phone: '' });
  const [staffForm, setStaffForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    setError('');
    try {
      let session;
      if (selectedRole === 'patient') {
        session = loginPatient(patientForm);
      } else {
        session = loginStaff(selectedRole, staffForm);
      }
      onLogin(session);
      navigate(`/${session.role}`, { replace: true });
    } catch (submitError) {
      setError(submitError.message || 'Unable to sign in');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-7xl animate-fade-in">
        <div className="overflow-hidden rounded-[32px] glass-panel p-0 border border-[var(--glass-border)] shadow-2xl">
          <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
            <div className="bg-gradient-to-br from-blue-900/40 via-sky-800/40 to-slate-900/80 p-10 text-white lg:border-r border-[var(--glass-border)] backdrop-blur-xl">
              <div className="inline-flex rounded-full border border-[var(--glass-border)] bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                RescueLink Access
              </div>
              <h1 className="mt-8 max-w-xl text-5xl font-extrabold leading-tight tracking-tight text-white">
                One emergency platform, three focused workspaces
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
                Sign in to continue as a patient, ambulance dispatcher, hospital coordinator, police officer, or fire chief. Each workspace is tailored to the decisions that role needs to make under pressure.
              </p>

              <div className="mt-10 grid gap-5">
                {roleCards.map((card) => {
                  const Icon = card.icon;
                  const isActive = selectedRole === card.role;
                  return (
                    <button
                      key={card.role}
                      onClick={() => { setSelectedRole(card.role); setError(''); }}
                      className={`rounded-3xl border p-6 text-left transition-all duration-300 ${
                        isActive
                          ? 'border-[var(--glass-border)] bg-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)] scale-[1.02]'
                          : 'border-[var(--glass-border)] bg-white/5 hover:border-white/20 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-5">
                        <div className={`rounded-2xl bg-gradient-to-br ${card.accent} p-4 text-white shadow-lg`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="text-xl font-bold text-white">{card.title}</div>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{card.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-950/60 p-10 backdrop-blur-2xl flex flex-col justify-center">
              <div className="mx-auto w-full max-w-md">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {roleConfig[selectedRole].title}
                </div>
                <h2 className="mt-3 text-4xl font-extrabold text-white">Sign in to continue</h2>
                <p className="mt-4 text-sm leading-6 text-slate-400">{roleConfig[selectedRole].subtitle}</p>
                {selectedRole === 'patient' && (
                  <div className="mt-5 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-4 text-sm leading-6 text-cyan-100">
                    Use the same name and phone number whenever you return. RescueLink will restore your emergency history and live response updates automatically.
                  </div>
                )}

                <form onSubmit={submit} className="mt-10 space-y-6">
                  {selectedRole === 'patient' ? (
                    <>
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-300">Patient or caller name</span>
                        <div className="flex items-center rounded-2xl border border-[var(--glass-border)] bg-slate-900/50 px-4 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400 transition-all">
                          <UserRound className="h-5 w-5 text-slate-400" />
                          <input
                            type="text"
                            required
                            value={patientForm.displayName}
                            onChange={(e) => setPatientForm((curr) => ({ ...curr, displayName: e.target.value }))}
                            placeholder="Enter your name"
                            className="w-full rounded-2xl border-0 bg-transparent px-4 py-4 text-white outline-none placeholder:text-slate-500"
                          />
                        </div>
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-300">Phone number</span>
                        <div className="flex items-center rounded-2xl border border-[var(--glass-border)] bg-slate-900/50 px-4 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400 transition-all">
                          <UserRound className="h-5 w-5 text-slate-400" />
                          <input
                            type="tel"
                            required
                            value={patientForm.phone}
                            onChange={(e) => setPatientForm((curr) => ({ ...curr, phone: e.target.value }))}
                            placeholder="Required contact number"
                            className="w-full rounded-2xl border-0 bg-transparent px-4 py-4 text-white outline-none placeholder:text-slate-500"
                          />
                        </div>
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-300">Username</span>
                        <div className="flex items-center rounded-2xl border border-[var(--glass-border)] bg-slate-900/50 px-4 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all">
                          <UserRound className="h-5 w-5 text-slate-400" />
                          <input
                            type="text"
                            value={staffForm.username}
                            onChange={(e) => setStaffForm((curr) => ({ ...curr, username: e.target.value }))}
                            placeholder="Enter username"
                            className="w-full rounded-2xl border-0 bg-transparent px-4 py-4 text-white outline-none placeholder:text-slate-500"
                          />
                        </div>
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-300">Password</span>
                        <div className="flex items-center rounded-2xl border border-[var(--glass-border)] bg-slate-900/50 px-4 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all">
                          <LockKeyhole className="h-5 w-5 text-slate-400" />
                          <input
                            type="password"
                            value={staffForm.password}
                            onChange={(e) => setStaffForm((curr) => ({ ...curr, password: e.target.value }))}
                            placeholder="Enter password"
                            className="w-full rounded-2xl border-0 bg-transparent px-4 py-4 text-white outline-none placeholder:text-slate-500"
                          />
                        </div>
                      </label>
                      <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-sm text-blue-300">
                        {staffHints[selectedRole]}
                      </div>
                    </>
                  )}

                  {error && (
                    <div className="rounded-2xl border border-red-500/50 bg-red-500/20 px-5 py-4 text-sm text-red-200">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-6 py-5 text-base font-bold text-white transition hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                  >
                    Continue to workspace
                    <ArrowRight className="ml-3 h-5 w-5" />
                  </button>
                </form>

                <div className="mt-8 text-center text-xs leading-6 text-slate-500">
                  After sign-in you will be taken to /{selectedRole} with the dashboard matched to your selected role.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
