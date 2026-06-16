import React from 'react';
import { MapPin, Navigation } from 'lucide-react';

const formatCoordinate = (value) => Number(value).toFixed(6);

function markerPosition(lat, lon, bounds) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  const xRange = bounds.maxLon - bounds.minLon || 0.01;
  const yRange = bounds.maxLat - bounds.minLat || 0.01;

  return {
    left: `${Math.min(92, Math.max(8, ((longitude - bounds.minLon) / xRange) * 84 + 8))}%`,
    top: `${Math.min(86, Math.max(14, (1 - ((latitude - bounds.minLat) / yRange)) * 72 + 14))}%`,
  };
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const radiusKm = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a = (
    Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2
  );
  return radiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const MapPreview = ({
  lat,
  lon,
  title = 'Incident location',
  detail,
  secondaryLat,
  secondaryLon,
  secondaryLabel = 'Unit',
}) => {
  const latitude = Number(lat);
  const longitude = Number(lon);
  const secondaryLatitude = Number(secondaryLat);
  const secondaryLongitude = Number(secondaryLon);
  const hasSecondary = Number.isFinite(secondaryLatitude) && Number.isFinite(secondaryLongitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return (
      <div className="glass-panel text-sm text-gray-400">
        Location is not available for this incident.
      </div>
    );
  }

  const allLatitudes = hasSecondary ? [latitude, secondaryLatitude] : [latitude];
  const allLongitudes = hasSecondary ? [longitude, secondaryLongitude] : [longitude];
  const padding = 0.01;
  const bounds = {
    minLat: Math.min(...allLatitudes) - padding,
    maxLat: Math.max(...allLatitudes) + padding,
    minLon: Math.min(...allLongitudes) - padding,
    maxLon: Math.max(...allLongitudes) + padding,
  };
  const primaryPosition = markerPosition(latitude, longitude, bounds);
  const secondaryPosition = hasSecondary ? markerPosition(secondaryLatitude, secondaryLongitude, bounds) : null;
  const distance = hasSecondary ? distanceKm(latitude, longitude, secondaryLatitude, secondaryLongitude) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-card)] shadow-lg animate-fade-in">
      <div className="flex items-center justify-between border-b border-[var(--glass-border)] bg-black/20 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <MapPin className="h-4 w-4 text-red-500" />
          {title}
        </div>
        {distance !== null ? (
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-900/30 px-3 py-1 text-xs font-semibold text-emerald-400">
            <Navigation className="h-3 w-3" />
            {distance.toFixed(1)} km direct route
          </div>
        ) : null}
      </div>

      <div className="relative h-64 w-full overflow-hidden bg-[#0f172a]">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px)] bg-[size:34px_34px]" />
        <div className="absolute left-[8%] top-[22%] h-4 w-[84%] rotate-[-8deg] rounded-full bg-slate-700/70" />
        <div className="absolute left-[15%] top-[68%] h-4 w-[76%] rotate-[7deg] rounded-full bg-slate-700/70" />
        <div className="absolute left-[45%] top-0 h-full w-4 rotate-[11deg] rounded-full bg-slate-700/50" />
        {secondaryPosition ? (
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            <line
              x1={primaryPosition.left}
              y1={primaryPosition.top}
              x2={secondaryPosition.left}
              y2={secondaryPosition.top}
              stroke="#38bdf8"
              strokeDasharray="7 7"
              strokeLinecap="round"
              strokeWidth="3"
            />
          </svg>
        ) : null}
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-full rounded-full bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-lg ring-4 ring-white/80"
          style={primaryPosition}
        >
          Patient
        </div>
        {secondaryPosition ? (
          <div
            className="absolute z-10 -translate-x-1/2 -translate-y-full rounded-full bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-lg ring-4 ring-white/80"
            style={secondaryPosition}
          >
            {secondaryLabel}
          </div>
        ) : null}
        <div className="absolute bottom-3 left-3 rounded-md bg-slate-950/85 px-3 py-2 text-xs font-semibold text-slate-200 shadow-sm">
          Offline coordinate map
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 bg-black/20 px-4 py-3 text-xs text-gray-400">
        <span>
          Coords: <span className="font-semibold text-gray-200">{formatCoordinate(latitude)}, {formatCoordinate(longitude)}</span>
        </span>
        {detail ? <span className="font-medium text-gray-300">{detail}</span> : null}
      </div>
    </div>
  );
};

export default MapPreview;
