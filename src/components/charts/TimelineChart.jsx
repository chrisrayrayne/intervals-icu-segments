import { useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#00c87a', '#60a5fa', '#f59e0b', '#e879f9', '#fb923c', '#34d399'];

const STREAM_METRICS = [
  { key: 'watts', label: 'Watts', unit: 'W', fmt: v => v != null ? Math.round(v) : null },
  { key: 'heartrate', label: 'Heart Rate', unit: 'bpm', fmt: v => v != null ? Math.round(v) : null },
  { key: 'velocity_smooth', label: 'Speed', unit: 'km/h', fmt: v => v != null ? +(v * 3.6).toFixed(1) : null },
  { key: 'cadence', label: 'Cadence', unit: 'rpm', fmt: v => v != null ? Math.round(v) : null },
  { key: 'altitude', label: 'Altitude', unit: 'm', fmt: v => v != null ? +v.toFixed(1) : null },
  { key: 'grade_smooth', label: 'Grade', unit: '%', fmt: v => v != null ? +v.toFixed(1) : null },
];

function formatDist(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${Math.round(m)}m`;
}

export default function TimelineChart({ efforts }) {
  const [metricKey, setMetricKey] = useState('watts');

  const metricDef = STREAM_METRICS.find(m => m.key === metricKey) ?? STREAM_METRICS[0];

  const seriesData = efforts.map((effort) => {
    const distSlice = effort.streamSlices?.distance;
    const metricSlice = effort.streamSlices?.[metricKey];
    if (!distSlice?.length || !metricSlice?.length) return [];
    const startDist = distSlice[0] ?? 0;
    return distSlice
      .map((d, i) => {
        const val = metricDef.fmt(metricSlice[i]);
        if (d == null || val == null) return null;
        return { dist: Math.round(d - startDist), val };
      })
      .filter(Boolean);
  });

  const hasData = seriesData.some(s => s.length > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted text-sm">
        <p>No {metricDef.label} data available.</p>
        <p>Clear efforts and re-analyse to load per-point stream data.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-muted text-xs">Metric:</span>
        <select
          value={metricKey}
          onChange={(e) => setMetricKey(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-text text-xs focus:outline-none focus:border-accent"
        >
          {STREAM_METRICS.map(m => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="dist"
            type="number"
            domain={['auto', 'auto']}
            tickFormatter={formatDist}
            tick={{ fill: '#6b6b80', fontSize: 11 }}
            label={{ value: 'Distance', position: 'insideBottomRight', offset: -5, fill: '#6b6b80', fontSize: 11 }}
          />
          <YAxis
            dataKey="val"
            type="number"
            unit={` ${metricDef.unit}`}
            tick={{ fill: '#6b6b80', fontSize: 11 }}
            width={60}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#13131a', border: '1px solid #1e1e2e', borderRadius: 8 }}
            labelStyle={{ color: '#e8e8f0' }}
            formatter={(val, name, props) => [
              val != null ? `${val} ${metricDef.unit}` : '–',
              name,
            ]}
            labelFormatter={(label, payload) => {
              if (payload?.length) return `Distance: ${formatDist(payload[0].payload.dist)}`;
              return '';
            }}
          />
          <Legend wrapperStyle={{ color: '#6b6b80', fontSize: 11 }} />
          {efforts.map((effort, j) => (
            seriesData[j].length > 0 && (
              <Scatter
                key={`${effort.activityId}-${j}`}
                name={`${effort.date} · ${effort.activityName}`}
                data={seriesData[j]}
                fill={COLORS[j % COLORS.length]}
                line={{ stroke: COLORS[j % COLORS.length], strokeWidth: 1.5 }}
                lineType="joint"
                shape={() => null}
              />
            )
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
