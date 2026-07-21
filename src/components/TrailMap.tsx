// src/components/TrailMap.tsx
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchORSRoute, type TrailCheckpoint } from '../api';

function createNumberIcon(number: number, isSelected: boolean) {
  return L.divIcon({
    className: 'custom-checkpoint-marker',
    html: `
      <div style="
        background-color: ${isSelected ? '#16a34a' : '#1e293b'};
        color: white;
        border: 2px solid white;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 12px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        transform: ${isSelected ? 'scale(1.25)' : 'scale(1.0)'};
        transition: all 0.2s ease-in-out;
      ">
        ${number}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 13, { duration: 1.2 });
  }, [center, map]);
  return null;
}

interface TrailMapProps {
  checkpoints: TrailCheckpoint[];
  selectedCheckpoint: TrailCheckpoint | null;
  onSelectCheckpoint: (cp: TrailCheckpoint) => void;
}

export default function TrailMap({
  checkpoints,
  selectedCheckpoint,
  onSelectCheckpoint,
}: TrailMapProps) {
  const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const defaultCenter: [number, number] = selectedCheckpoint
    ? [Number(selectedCheckpoint.latitude), Number(selectedCheckpoint.longitude)]
    : checkpoints.length > 0
      ? [Number(checkpoints[0].latitude), Number(checkpoints[0].longitude)]
      : [16.2947, 120.6358];

  useEffect(() => {
    let activeCheckpoints = checkpoints;

    if (selectedCheckpoint) {
      activeCheckpoints = checkpoints.filter(
        (cp) => cp.sequence_order <= selectedCheckpoint.sequence_order
      );
    }

    if (activeCheckpoints.length < 2) {
      setRoutePolyline([]);
      return;
    }

    setLoadingRoute(true);
    fetchORSRoute(activeCheckpoints)
      .then(setRoutePolyline)
      .finally(() => setLoadingRoute(false));
  }, [checkpoints, selectedCheckpoint]);

  return (
    <div className="relative w-full h-[450px] rounded-2xl overflow-hidden shadow-md border border-gray-200">
      {loadingRoute && (
        <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm text-xs font-semibold text-gray-700 flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Mapping route path…
        </div>
      )}

      <MapContainer center={defaultCenter} zoom={13} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapRecenter center={defaultCenter} />

        {routePolyline.length > 0 && (
          <Polyline
            positions={routePolyline}
            pathOptions={{ color: '#dc2626', weight: 4, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
          />
        )}

        {checkpoints.map((cp) => {
          const isSelected = selectedCheckpoint?.checkpoint_id === cp.checkpoint_id;
          const pos: [number, number] = [Number(cp.latitude), Number(cp.longitude)];

          return (
            <Marker
              key={cp.checkpoint_id}
              position={pos}
              icon={createNumberIcon(cp.sequence_order, isSelected)}
              eventHandlers={{
                click: () => onSelectCheckpoint(cp),
              }}
            >
              <Popup>
                <div className="p-1">
                  <span className="text-[10px] font-bold text-gray-400 block uppercase">
                    Checkpoint #{cp.sequence_order}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">{cp.name}</h4>
                  {cp.description && <p className="text-xs text-gray-600 mt-1">{cp.description}</p>}
                  <div className="mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50 p-1.5 rounded border border-emerald-200 inline-block">
                    Elev: {cp.elevation_m ? `${cp.elevation_m}m` : 'N/A'} • Dist: {cp.distance_from_start_km} km
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}