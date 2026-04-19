import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#00c87a', '#60a5fa', '#f59e0b', '#e879f9', '#fb923c', '#34d399'];

function fmtTime(s) {
  if (s == null) return '–';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtDist(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

const STREAM_METRICS = [
  { key: 'watts',          label: 'Watts',      unit: 'W',    fmt: v => v != null ? Math.round(v) : null,        tickFmt: v => `${v}`,    tooltipFmt: v => `${v} W` },
  { key: 'heartrate',      label: 'Heart Rate', unit: 'bpm',  fmt: v => v != null ? Math.round(v) : null,        tickFmt: v => `${v}`,    tooltipFmt: v => `${v} bpm` },
  { key: 'velocity_smooth',label: 'Speed',      unit: 'km/h', fmt: v => v != null ? +(v * 3.6).toFixed(1) : null,tickFmt: v => `${v}`,    tooltipFmt: v => `${v} km/h` },
  { key: 'cadence',        label: 'Cadence',    unit: 'rpm',  fmt: v => v != null ? Math.round(v) : null,        tickFmt: v => `${v}`,    tooltipFmt: v => `${v} rpm` },
  { key: 'altitude',       label: 'Altitude',   unit: 'm',    fmt: v => v != null ? +v.toFixed(1) : null,        tickFmt: v => `${v}`,    tooltipFmt: v => `${v} m` },
  { key: 'grade_smooth',   label: 'Grade',      unit: '%',    fmt: v => v != null ? +v.toFixed(1) : null,        tickFmt: v => `${v}`,    tooltipFmt: v => `${v} %` },
  { key: 'time',           label: 'Time',       unit: 's',    fmt: v => v != null ? Math.round(v) : null,        tickFmt: fmtTime,        tooltipFmt: fmtTime, isTime: true },
];

/** Binary-search for the value in [{dist, val}] nearest to targetDist. */
function nearestVal(data, targetDist) {
  if (!data.length) return null;
  let lo = 0, hi = data.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (data[mid].dist < targetDist) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return data[0].val;
  const a = data[lo - 1], b = data[lo] ?? a;
  return Math.abs(b.dist - targetDist) <= Math.abs(a.dist - targetDist) ? b.val : a.val;
}

const MAX_POINTS = 300;

export default function TimelineChart({ efforts }) {
  const [metricKey, setMetricKey] = useState('watts');
  const [hidden, setHidden] = useState(new Set());

  const metricDef = STREAM_METRICS.find(m => m.key === metricKey) ?? STREAM_METRICS[0];

  function toggleHidden(idx) {
    setHidden(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  // Build per-effort (dist, val) arrays
  const seriesData = useMemo(() => efforts.map((effort) => {
    const distSlice = effort.streamSlices?.distance;
    const metricSlice = effort.streamSlices?.[metricKey];
    if (!distSlice?.length || !metricSlice?.length) return [];
    const startDist = distSlice[0] ?? 0;
    const startTime = metricDef.isTime ? (metricSlice[0] ?? 0) : 0;
    return distSlice.map((d, i) => {
      const val = metricDef.fmt(metricSlice[i]);
      if (d == null || val == null) return null;
      return { dist: Math.round(d - startDist), val: metricDef.isTime ? val - startTime : val };
    }).filter(Boolean);
  }), [efforts, metricKey, metricDef]);

  const hasData = seriesData.some(s => s.length > 0);

  // Build unified distance axis, then interpolate each effort onto it
  const chartData = useMemo(() => {
    const visible = seriesData.filter((_, j) => !hidden.has(j));
    if (!visible.some(s => s.length > 0)) return [];
    const maxDist = Math.max(...visible.filter(s => s.length).map(s => s[s.length - 1].dist));
    const step = Math.max(1, Math.round(maxDist / MAX_POINTS));
    const points = Math.ceil(maxDist / step) + 1;
    return Array.from({ length: points }, (_, i) => {
      const dist = i * step;
      const row = { dist };
      seriesData.forEach((data, j) => {
        if (!hidden.has(j)) row[`e${j}`] = data.length ? nearestVal(data, dist) : null;
      });
      return row;
    });
  }, [seriesData, hidden]);

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
      {/* Metric selector */}
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

      {/* Effort visibility toggles */}
      <div className="flex flex-wrap gap-2">
        {efforts.map((effort, j) => {
          const isHidden = hidden.has(j);
          const noData = seriesData[j].length === 0;
          const color = COLORS[j % COLORS.length];
          return (
            <button
              key={`${effort.activityId}-${j}`}
              onClick={() => !noData && toggleHidden(j)}
              title={noData ? 'No data — re-analyse this activity' : undefined}
              className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-colors"
              style={{
                borderColor: noData ? '#2e2e3e' : isHidden ? '#2e2e3e' : color,
                backgroundColor: noData || isHidden ? 'transparent' : `${color}18`,
                color: noData ? '#3e3e4e' : isHidden ? '#6b6b80' : color,
                cursor: noData ? 'default' : 'pointer',
              }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: noData ? '#3e3e4e' : isHidden ? '#6b6b80' : color }}
              />
              {effort.date} · {effort.activityName}
              {noData && <span className="ml-1 opacity-60">↻</span>}
            </button>
          );
        })}
      </div>
      {seriesData.some((s, j) => !hidden.has(j) && s.length === 0) && (
        <p className="text-xs text-muted">
          Greyed-out efforts have no stream data — clear efforts and re-analyse to include them.
        </p>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="dist"
            type="number"
            scale="linear"
            domain={['dataMin', 'dataMax']}
            tickFormatter={fmtDist}
            tick={{ fill: '#6b6b80', fontSize: 11 }}
            label={{ value: 'Distance', position: 'insideBottomRight', offset: -5, fill: '#6b6b80', fontSize: 11 }}
          />
          <YAxis
            tickFormatter={metricDef.tickFmt}
            tick={{ fill: '#6b6b80', fontSize: 11 }}
            width={metricDef.isTime ? 45 : 55}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#13131a', border: '1px solid #1e1e2e', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#6b6b80', marginBottom: 4 }}
            labelFormatter={dist => `Distance: ${fmtDist(dist)}`}
            formatter={(val, name) => [val != null ? metricDef.tooltipFmt(val) : '–', name]}
          />
          {efforts.map((effort, j) => (
            !hidden.has(j) && (
              <Line
                key={`${effort.activityId}-${j}`}
                dataKey={`e${j}`}
                name={`${effort.date} · ${effort.activityName}`}
                stroke={COLORS[j % COLORS.length]}
                strokeWidth={1.5}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            )
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
