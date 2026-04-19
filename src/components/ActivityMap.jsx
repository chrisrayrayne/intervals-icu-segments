import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import { useIntervals } from '../hooks/useIntervals';
import { normaliseLatlng } from '../utils/gps';
import { format } from 'date-fns';

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions?.length) map.fitBounds(positions, { padding: [20, 20] });
  }, [map, positions]);
  return null;
}

export default function ActivityMap({ activity }) {
  const [positions, setPositions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { fetchStreams } = useIntervals();

  useEffect(() => {
    if (!activity) return;
    setLoading(true);
    setError('');
    setPositions(null);
    fetchStreams(activity.id)
      .then((streams) => {
        const latlng = normaliseLatlng(streams?.latlng ?? []).filter(Boolean);
        if (!latlng.length) setError('No GPS data for this activity');
        else setPositions(latlng);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activity) return null;

  const date = activity.start_date_local
    ? format(new Date(activity.start_date_local), 'dd.MM.yyyy')
    : '';

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between">
        <div>
          <h3 className="text-text text-sm font-semibold">{activity.name}</h3>
          <p className="text-muted text-xs">{date}{activity.type ? ` · ${activity.type}` : ''}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {loading && (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            Loading GPS track…
          </div>
        )}
        {!loading && (error || !positions) && (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            {error || 'No GPS data'}
          </div>
        )}
        {!loading && positions && (
          <MapContainer
            center={positions[Math.floor(positions.length / 2)]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <FitBounds positions={positions} />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />
            <Polyline positions={positions} color="#00c87a" weight={3} opacity={0.8} />
          </MapContainer>
        )}
      </div>
    </div>
  );
}
