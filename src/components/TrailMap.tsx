// src/components/TrailMap.tsx
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Waypoint } from '../api';

// Use standard Web URLs for default Leaflet markers to prevent build crashes
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Component to dynamically re-center map when selection or waypoints change
function MapRecenter({ center, zoom = 13 }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.5 });
  }, [center, map, zoom]);
  return null;
}

interface TrailMapProps {
  waypoints: Waypoint[];
  selectedWaypoint: Waypoint | null;
  onSelectWaypoint: (wp: Waypoint) => void;
}

export default function TrailMap({ waypoints, selectedWaypoint, onSelectWaypoint }: TrailMapProps) {
  // Find the first waypoint in the list with valid coordinates
  const firstValidWaypoint = waypoints.find(
    (w) => typeof w.latitude === 'number' && typeof w.longitude === 'number'
  );

  // Determine active center: selected waypoint > first valid mountain waypoint > neutral origin [0,0]
  const activeCenter: [number, number] = selectedWaypoint?.latitude && selectedWaypoint?.longitude
    ? [selectedWaypoint.latitude, selectedWaypoint.longitude]
    : firstValidWaypoint
    ? [firstValidWaypoint.latitude, firstValidWaypoint.longitude]
    : [0, 0];

  const hasCoordinates = Boolean(selectedWaypoint || firstValidWaypoint);

  return (
    <div className="relative w-full h-[450px] rounded-2xl overflow-hidden shadow-md border border-gray-200">
      <MapContainer center={activeCenter} zoom={hasCoordinates ? 13 : 2} className="w-full h-full">
        {/* OpenStreetMap Tile Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Recenter map dynamically when coordinates are available */}
        {hasCoordinates && (
          <MapRecenter center={activeCenter} zoom={13} />
        )}

        {/* Render Waypoint Pins ONLY */}
        {waypoints.map((wp) => {
          if (typeof wp.latitude !== 'number' || typeof wp.longitude !== 'number') return null;
          const isSelected = selectedWaypoint?.waypoint_id === wp.waypoint_id;

          return (
            <Marker
              key={wp.waypoint_id}
              position={[wp.latitude, wp.longitude]}
              eventHandlers={{
                click: () => onSelectWaypoint(wp),
              }}
            >
              <Popup>
                <div className="p-1">
                  <h4 className="font-bold text-sm">{wp.name}</h4>
                  {wp.elevation_m && <p className="text-xs text-gray-500">{wp.elevation_m}m altitude</p>}
                  {isSelected && <span className="text-xs text-emerald-600 font-semibold">Selected Checkpoint</span>}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}