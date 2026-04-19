import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useIntervals } from '../hooks/useIntervals';
import { findClosestPoint, normaliseLatlng } from '../utils/gps';

// Fix Leaflet default icon paths (Vite asset handling)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function ClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions?.length) {
      map.fitBounds(positions, { padding: [20, 20] });
    } else {
      map.invalidateSize();
    }
  }, [map, positions]);
  return null;
}

export default function MapPicker({ activity, onSegmentCreated, onCancel }) {
  const [latlngStream, setLatlngStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState('start'); // 'start' | 'end' | 'name'
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tolerance, setTolerance] = useState(25);
  const { fetchStreams } = useIntervals();

  useEffect(() => {
    if (!activity) return;
    setLoading(true);
    fetchStreams(activity.id)
      .then((streams) => {
        if (!streams || !streams.latlng?.length) {
          setError('No GPS data for this activity');
        } else {
          const aligned = normaliseLatlng(streams.latlng);
          const nonNull = aligned.filter(p => p != null);
          if (nonNull.length === 0) {
            setError('No GPS data for this activity');
          } else {
            setLatlngStream(aligned); // full index-aligned array
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activity, fetchStreams]);

  function handleMapClick(latlng) {
    if (!latlngStream) return;
    const idx = findClosestPoint(latlng, latlngStream, tolerance);
    if (idx === null) return;
    const [lat, lng] = latlngStream[idx];
    if (step === 'start') {
      setStartPoint({ lat, lng });
      setStep('end');
    } else if (step === 'end') {
      setEndPoint({ lat, lng });
      setStep('name');
    }
  }

  function handleSave() {
    if (!name.trim() || !startPoint || !endPoint) return;
    onSegmentCreated({
      name: name.trim(),
      description: description.trim(),
      start: startPoint,
      end: endPoint,
      toleranceMeters: tolerance,
      createdFrom: activity.id,
    });
  }

  function reset() {
    setStep('start');
    setStartPoint(null);
    setEndPoint(null);
    setName('');
    setDescription('');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted">
        Loading GPS track…
      </div>
    );
  }

  if (error || !latlngStream || !latlngStream.some(p => p != null)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-danger text-sm">{error || 'No GPS data'}</p>
        <button onClick={onCancel} className="text-sm text-muted hover:text-text">Back</button>
      </div>
    );
  }

  const positions = latlngStream.filter(p => p != null);
  const center = positions[Math.floor(positions.length / 2)];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12, gap: 8 }}>
      <div className="flex items-center justify-between">
        <h3 className="text-text font-semibold">Define Segment</h3>
        <button onClick={onCancel} className="text-muted hover:text-text text-sm">Cancel</button>
      </div>

      <div className="text-sm text-muted">
        {step === 'start' && 'Click the start point on the route'}
        {step === 'end' && 'Click the end point on the route'}
        {step === 'name' && 'Name your segment'}
      </div>

      <div style={{ flex: 1, minHeight: 200, border: '1px solid #1e1e2e', borderRadius: 8 }}>
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <FitBounds positions={positions} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          <Polyline positions={positions} color="#00c87a" weight={3} opacity={0.8} />
          {startPoint && <Marker position={[startPoint.lat, startPoint.lng]} icon={startIcon} />}
          {endPoint && <Marker position={[endPoint.lat, endPoint.lng]} icon={endIcon} />}
          {step !== 'name' && <ClickHandler onMapClick={handleMapClick} />}
        </MapContainer>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-muted text-xs">Tolerance (m):</label>
        <input
          type="number"
          value={tolerance}
          onChange={(e) => setTolerance(Number(e.target.value))}
          min={5}
          max={200}
          className="w-20 bg-bg border border-border rounded px-2 py-1 text-text text-xs focus:outline-none focus:border-accent"
        />
        {(startPoint || endPoint) && (
          <button onClick={reset} className="text-xs text-muted hover:text-text ml-2">
            Reset points
          </button>
        )}
      </div>

      {step === 'name' && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Segment name"
            autoFocus
            className="bg-bg border border-border rounded-lg px-3 py-2 text-text placeholder-muted focus:outline-none focus:border-accent text-sm"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="bg-bg border border-border rounded-lg px-3 py-2 text-text placeholder-muted focus:outline-none focus:border-accent text-sm"
          />
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
          >
            Save Segment
          </button>
        </div>
      )}
    </div>
  );
}
