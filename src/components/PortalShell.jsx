import React from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const rolePalette = {
  patient: {
    hero: 'from-cyan-900/40 via-sky-800/40 to-slate-950/80',
    badge: 'text-cyan-400',
  },
  ambulance: {
    hero: 'from-emerald-900/40 via-teal-800/40 to-slate-950/80',
    badge: 'text-emerald-400',
  },
  hospital: {
    hero: 'from-rose-900/40 via-red-800/40 to-slate-950/80',
    badge: 'text-rose-400',
  },
};

const PortalShell = ({
  role = 'patient',
  eyebrow,
  title,
  subtitle,
  session,
  onSignOut,
  actions,
  children,
}) => {
  const palette = rolePalette[role] || rolePalette.patient;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-white animate-fade-in">
      <div className="overflow-hidden rounded-[32px] glass-panel p-0 border border-[var(--glass-border)] shadow-2xl shadow-blue-900/10">
        <div className={`border-b border-[var(--glass-border)] bg-gradient-to-br ${palette.hero} px-6 py-8 backdrop-blur-xl`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <div className={`mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] ${palette.badge}`}>
                <ShieldCheck className="h-4 w-4" />
                {eyebrow}
              </div>
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white">{title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{subtitle}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <Link to="/" className="rounded-xl border border-[var(--glass-border)] bg-white/5 hover:bg-white/10 transition px-4 py-2 text-sm font-medium text-white backdrop-blur">
                Dashboard Home
              </Link>
              {actions}
              <div className="rounded-xl border border-[var(--glass-border)] bg-white/5 px-4 py-2 text-sm backdrop-blur flex flex-col justify-center">
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Signed in as</div>
                <div className="font-bold text-white">{session?.displayName || 'Operator'}</div>
              </div>
              <button
                onClick={onSignOut}
                className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition px-4 py-2 text-sm font-medium text-red-400 backdrop-blur"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 bg-black/20">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PortalShell;
