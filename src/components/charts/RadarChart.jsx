import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const METRICS = [
  { key: 'avgWatts', label: 'Avg W', higherBetter: true },
  { key: 'normalizedPower', label: 'NP', higherBetter: true },
  { key: 'avgHeartrate', label: 'Avg HR', higherBetter: false },
  { key: 'avgSpeed', label: 'Speed', higherBetter: true },
  { key: 'avgCadence', label: 'Cadence', higherBetter: true },
  { key: 'elevationGain', label: 'Elev', higherBetter: true },
];

const COLORS = ['#00c87a', '#60a5fa', '#f59e0b', '#e879f9', '#fb923c', '#34d399'];

function normalise(efforts) {
  const mins = {};
  const maxs = {};
  METRICS.forEach(({ key }) => {
    const vals = efforts.map((e) => e[key]).filter((v) => v != null);
    if (!vals.length) return;
    mins[key] = Math.min(...vals);
    maxs[key] = Math.max(...vals);
  });

  return efforts.map((e) => {
    const point = { name: e.activityName };
    METRICS.forEach(({ key, higherBetter }) => {
      const val = e[key];
      if (val == null || maxs[key] == null) { point[key] = 0; return; }
      const range = maxs[key] - mins[key];
      let norm = range === 0 ? 100 : ((val - mins[key]) / range) * 100;
      if (!higherBetter) norm = 100 - norm;
      point[key] = Math.round(norm);
    });
    return point;
  });
}

export default function RadarChart({ efforts }) {
  const data = METRICS.map(({ key, label }) => ({ metric: label, ...Object.fromEntries(efforts.slice(0, 6).map((e, i) => [i, 0])) }));
  // Build per-metric rows
  const normed = normalise(efforts.slice(0, 6));
  const chartData = METRICS.map(({ key, label }) => {
    const row = { metric: label };
    normed.forEach((e, i) => { row[`e${i}`] = e[key]; });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RechartsRadarChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#1e1e2e" />
        <PolarAngleAxis dataKey="metric" tick={{ fill: '#6b6b80', fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#6b6b80', fontSize: 9 }} />
        {efforts.slice(0, 6).map((e, i) => (
          <Radar
            key={e.activityId}
            name={e.activityName}
            dataKey={`e${i}`}
            stroke={COLORS[i]}
            fill={COLORS[i]}
            fillOpacity={0.15}
          />
        ))}
        <Legend
          formatter={(value) => value}
          wrapperStyle={{ color: '#6b6b80', fontSize: 11 }}
        />
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}
