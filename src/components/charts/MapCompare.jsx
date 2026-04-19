import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

const COLORS = ['#00c87a', '#60a5fa', '#f59e0b', '#e879f9', '#fb923c', '#34d399'];

function fmtTime(s) {
  if (s == null || isNaN(s)) return '–';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const STREAM_METRICS = [
  { key: 'watts',           label: 'Watts',      fmt: v => v != null ? Math.round(v) : null,         display: v => `${v} W` },
  { key: 'heartrate',       label: 'Heart Rate', fmt: v => v != null ? Math.round(v) : null,         display: v => `${v} bpm` },
  { key: 'velocity_smooth', label: 'Speed',      fmt: v => v != null ? +(v * 3.6).toFixed(1) : null, display: v => `${v} km/h` },
  { key: 'cadence',         label: 'Cadence',    fmt: v => v != null ? Math.round(v) : null,         display: v => `${v} rpm` },
  { key: 'altitude',        label: 'Altitude',   fmt: v => v != null ? +v.toFixed(1) : null,         display: v => `${v} m` },
  { key: 'grade_smooth',    label: 'Grade',      fmt: v => v != null ? +v.toFixed(1) : null,         display: v => `${v} %` },
];

function BoundsController({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions?.length) map.fitBounds(positions, { padding: [20, 20] });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Binary-search nearest index in sorted-by-t array. */
function nearestIndex(pts, t) {
  if (!pts.length) return -1;
  let lo = 0, hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(pts[lo - 1].t - t) < Math.abs(pts[lo].t - t)) lo--;
  return lo;
}

const MAX_CHART_POINTS = 300;

export default function MapCompare({ efforts }) {
  const [metricKey, setMetricKey] = useState('watts');
  const [hoverTime, setHoverTime] = useState(null);
  const [hidden, setHidden] = useState(new Set());

  const metricDef = STREAM_METRICS.find(m => m.key === metricKey) ?? STREAM_METRICS[0];

  function toggleHidden(j) {
    setHidden(prev => {
      const next = new Set(prev);
      next.has(j) ? next.delete(j) : next.add(j);
      return next;
    });
  }

  // Build per-effort point arrays: [{t, lat, lng, val}]
  const effortData = useMemo(() => efforts.map((effort, j) => {
    const timeSlice   = effort.streamSlices?.time;
    const latlngSlice = effort.streamSlices?.latlng;
    const metSlice    = effort.streamSlices?.[metricKey];
    const color       = COLORS[j % COLORS.length];

    if (!timeSlice?.length || !latlngSlice?.length) {
      return { effort, j, color, hasData: false, positions: [], points: [] };
    }

    const startTime = timeSlice[0] ?? 0;
    const positions = latlngSlice.filter(Boolean);
    const points = [];

    for (let i = 0; i < timeSlice.length; i++) {
      const ll = latlngSlice[i];
      const t  = timeSlice[i];
      if (ll == null || t == null) continue;
      points.push({
        t:   Math.round(t - startTime),
        lat: ll[0],
        lng: ll[1],
        val: metSlice?.[i] != null ? metricDef.fmt(metSlice[i]) : null,
      });
    }

    return { effort, j, color, hasData: true, positions, points };
  }), [efforts, metricKey, metricDef]);

  // Unified time axis for chart
  const chartData = useMemo(() => {
    const visible = effortData.filter(d => d.hasData && !hidden.has(d.j));
    if (!visible.length) return [];
    const maxT = Math.max(...visible.map(d => d.points.at(-1)?.t ?? 0));
    if (!maxT) return [];
    const step  = Math.max(1, Math.round(maxT / MAX_CHART_POINTS));
    const count = Math.ceil(maxT / step) + 1;
    return Array.from({ length: count }, (_, i) => {
      const t   = i * step;
      const row = { t };
      effortData.forEach(({ j, points, hasData }) => {
        if (!hasData || hidden.has(j)) return;
        const idx  = nearestIndex(points, t);
        row[`e${j}`] = idx >= 0 ? points[idx].val : null;
      });
      return row;
    });
  }, [effortData, hidden]);

  // Map markers at hovered time
  const hoverMarkers = useMemo(() => {
    if (hoverTime == null) return [];
    return effortData
      .filter(d => d.hasData && !hidden.has(d.j) && d.points.length)
      .map(({ j, points, color }) => {
        const idx = nearestIndex(points, hoverTime);
        if (idx < 0) return null;
        const pt = points[idx];
        return { j, lat: pt.lat, lng: pt.lng, val: pt.val, color };
      })
      .filter(Boolean);
  }, [hoverTime, effortData, hidden]);

  const allPositions = useMemo(
    () => effortData.flatMap(d => d.positions),
    [effortData]
  );
  const mapCenter = allPositions.length
    ? allPositions[Math.floor(allPositions.length / 2)]
    : [47, 8];

  if (!effortData.some(d => d.hasData)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted text-sm">
        <p>No GPS data available for this view.</p>
        <p>Clear efforts and re-analyse to load GPS tracks.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Centre: map stacked above chart */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        {/* Map */}
        <div className="flex-1 min-h-0">
          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <BoundsController positions={allPositions} />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />
            {effortData
              .filter(d => d.hasData && !hidden.has(d.j))
              .map(({ j, positions, color }) => (
                <Polyline key={j} positions={positions} color={color} weight={2.5} opacity={0.75} />
              ))}
            {hoverMarkers.map(({ j, lat, lng, color }) => (
              <CircleMarker
                key={j}
                center={[lat, lng]}
                radius={7}
                pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }}
              />
            ))}
          </MapContainer>
        </div>

        {/* Chart */}
        <div className="border-t border-border shrink-0" style={{ height: 160 }}>
          <div className="flex items-center gap-2 px-3 pt-2 pb-1">
            <span className="text-muted text-xs">Metric:</span>
            <select
              value={metricKey}
              onChange={e => setMetricKey(e.target.value)}
              className="bg-bg border border-border rounded px-2 py-0.5 text-text text-xs focus:outline-none focus:border-accent"
            >
              {STREAM_METRICS.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={118}>
            <LineChart
              data={chartData}
              margin={{ top: 2, right: 12, bottom: 2, left: 4 }}
              onMouseMove={e => e?.activeLabel != null && setHoverTime(Number(e.activeLabel))}
              onMouseLeave={() => setHoverTime(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={fmtTime}
                tick={{ fill: '#6b6b80', fontSize: 10 }}
              />
              <YAxis tick={{ fill: '#6b6b80', fontSize: 10 }} width={38} />
              <Tooltip
                contentStyle={{ backgroundColor: '#13131a', border: '1px solid #1e1e2e', borderRadius: 8, fontSize: 11 }}
                labelFormatter={t => `Time: ${fmtTime(t)}`}
                formatter={(val, name) => [val != null ? metricDef.display(val) : '–', name]}
              />
              {hoverTime != null && (
                <ReferenceLine x={hoverTime} stroke="#6b6b80" strokeDasharray="3 3" strokeWidth={1} />
              )}
              {effortData.map(({ effort, j, color, hasData }) =>
                !hidden.has(j) && hasData && (
                  <Line
                    key={`${effort.activityId}-${j}`}
                    dataKey={`e${j}`}
                    name={`${effort.date} · ${effort.activityName}`}
                    stroke={color}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Right sidebar: effort toggles + live values */}
      <div className="w-44 shrink-0 border-l border-border flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-border shrink-0">
          <p className="text-muted text-xs">
            {hoverTime != null ? `At ${fmtTime(hoverTime)}` : 'Hover chart →'}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-3">
          {effortData.map(({ effort, j, color, hasData }) => {
            const isHidden  = hidden.has(j);
            const marker    = hoverMarkers.find(m => m.j === j);
            const dotColor  = !hasData ? '#3e3e4e' : isHidden ? '#6b6b80' : color;
            const textColor = !hasData ? '#3e3e4e' : isHidden ? '#6b6b80' : color;
            return (
              <div key={j}>
                <button
                  onClick={() => hasData && toggleHidden(j)}
                  className="flex items-center gap-1.5 w-full text-left"
                  style={{ cursor: hasData ? 'pointer' : 'default' }}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                  <span className="text-xs leading-tight truncate" style={{ color: textColor }}>
                    {effort.date}
                  </span>
                </button>
                <p className="pl-4 text-xs text-muted truncate leading-tight">{effort.activityName}</p>
                <p className="pl-4 text-sm font-mono text-text mt-0.5">
                  {!hasData
                    ? <span className="text-xs text-muted">↻ re-analyse</span>
                    : marker?.val != null
                      ? metricDef.display(marker.val)
                      : '–'}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
