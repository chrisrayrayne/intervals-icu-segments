import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { formatTime } from '../../utils/metrics';

const SECONDARY_METRICS = [
  { key: 'avgWatts', label: 'Avg Watts' },
  { key: 'normalizedPower', label: 'NP' },
  { key: 'avgHeartrate', label: 'Avg HR' },
  { key: 'avgSpeed', label: 'Avg Speed (km/h)', transform: (v) => +(v * 3.6).toFixed(1) },
  { key: 'elevationGain', label: 'Elevation Gain' },
];

export default function TimelineChart({ efforts, goalSeconds }) {
  const [secondMetric, setSecondMetric] = useState('avgWatts');

  const smDef = SECONDARY_METRICS.find((m) => m.key === secondMetric);

  const data = [...efforts]
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .map((e) => {
      const smVal = smDef?.transform ? smDef.transform(e[secondMetric]) : e[secondMetric];
      return {
        date: e.date,
        time: e.elapsedTime,
        [secondMetric]: smVal ?? null,
        label: e.activityName,
      };
    });

  const smLabel = smDef?.label ?? '';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-muted text-xs">Second axis:</span>
        <select
          value={secondMetric}
          onChange={(e) => setSecondMetric(e.target.value)}
          className="bg-bg border border-border rounded px-2 py-1 text-text text-xs focus:outline-none focus:border-accent"
        >
          {SECONDARY_METRICS.map((m) => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis dataKey="date" tick={{ fill: '#6b6b80', fontSize: 11 }} />
          <YAxis
            yAxisId="time"
            tickFormatter={formatTime}
            tick={{ fill: '#6b6b80', fontSize: 11 }}
            reversed
          />
          <YAxis
            yAxisId="metric"
            orientation="right"
            tick={{ fill: '#6b6b80', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#13131a', border: '1px solid #1e1e2e', borderRadius: 8 }}
            labelStyle={{ color: '#e8e8f0' }}
            formatter={(val, name) =>
              name === 'time' ? [formatTime(val), 'Time'] : [val, smLabel]
            }
          />
          <Legend wrapperStyle={{ color: '#6b6b80', fontSize: 12 }} />
          {goalSeconds != null && (
            <ReferenceLine
              yAxisId="time"
              y={goalSeconds}
              stroke="#ffd166"
              strokeDasharray="4 4"
              label={{ value: 'Goal', fill: '#ffd166', fontSize: 11 }}
            />
          )}
          <Line
            yAxisId="time"
            type="monotone"
            dataKey="time"
            stroke="#00c87a"
            dot={{ fill: '#00c87a', r: 3 }}
            name="Time"
          />
          <Line
            yAxisId="metric"
            type="monotone"
            dataKey={secondMetric}
            stroke="#60a5fa"
            dot={{ fill: '#60a5fa', r: 3 }}
            name={smLabel}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
