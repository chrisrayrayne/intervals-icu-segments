import { useState } from 'react';
import {
  formatTime,
  formatDelta,
  formatDistance,
  formatSpeed,
  formatWatts,
  formatBpm,
  formatGrade,
  formatElevation,
  formatCadence,
} from '../utils/metrics';
import TimelineChart from './charts/TimelineChart';
import RadarChart from './charts/RadarChart';
import MetricBar from './charts/MetricBar';
import MapCompare from './charts/MapCompare';

const COLUMNS = [
  { key: 'date', label: 'Date', format: (v) => v, sort: (a, b) => a.date.localeCompare(b.date) },
  { key: 'activityName', label: 'Activity', format: (v) => v },
  { key: 'routeName', label: 'Route', format: (v) => v || '–' },
  { key: 'elapsedTime', label: 'Time', format: formatTime, higherIsBetter: false },
  { key: 'distance', label: 'Distance', format: formatDistance },
  { key: 'avgWatts', label: 'Avg W', format: formatWatts, higherIsBetter: true },
  { key: 'normalizedPower', label: 'NP', format: formatWatts, higherIsBetter: true },
  { key: 'maxWatts', label: 'Max W', format: formatWatts },
  { key: 'avgHeartrate', label: 'Avg HR', format: formatBpm, higherIsBetter: false },
  { key: 'maxHeartrate', label: 'Max HR', format: formatBpm },
  { key: 'avgCadence', label: 'Cadence', format: formatCadence },
  { key: 'avgSpeed', label: 'Speed', format: formatSpeed, higherIsBetter: true },
  { key: 'avgGrade', label: 'Grade', format: formatGrade },
  { key: 'elevationGain', label: 'Elev +', format: formatElevation, higherIsBetter: true },
];

const COLORS = ['#00c87a', '#60a5fa', '#f59e0b', '#e879f9', '#fb923c', '#34d399'];

export default function CompareView({ segment, efforts, onClearEfforts }) {
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState(1);
  const [view, setView] = useState('table'); // 'table' | 'timeline' | 'radar' | 'map'

  if (!segment) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Select a segment to compare efforts
      </div>
    );
  }

  if (!efforts.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        No efforts found yet. Analyse activities to find matches.
      </div>
    );
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => -d);
    else { setSortKey(key); setSortDir(1); }
  }

  const sorted = [...efforts].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    if (av < bv) return -1 * sortDir;
    if (av > bv) return 1 * sortDir;
    return 0;
  });

  // Find best/worst for numeric columns
  function getBestWorst(key, higherIsBetter) {
    const vals = efforts.map((e) => e[key]).filter((v) => v != null);
    if (!vals.length) return {};
    const best = higherIsBetter ? Math.max(...vals) : Math.min(...vals);
    const worst = higherIsBetter ? Math.min(...vals) : Math.max(...vals);
    return { best, worst };
  }

  // Time delta vs best
  const bestTime = Math.min(...efforts.map((e) => e.elapsedTime).filter((v) => v != null));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border flex-wrap gap-2">
        <div>
          <h2 className="text-text font-semibold">{segment.name}</h2>
          {segment.description && <p className="text-muted text-xs">{segment.description}</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {onClearEfforts && efforts.length > 0 && (
            <button
              onClick={() => { if (window.confirm('Clear all efforts for this segment? You can re-analyse from the activity list.')) onClearEfforts(); }}
              className="text-xs px-3 py-1.5 rounded-lg border border-danger/40 text-danger hover:bg-danger/10 transition-colors"
            >
              Clear efforts
            </button>
          )}
          {['table', 'timeline', 'radar', 'map'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                view === v
                  ? 'bg-accent/20 border-accent/50 text-accent'
                  : 'bg-surface border-border text-muted hover:text-text'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className={`flex-1 min-h-0 ${view === 'map' ? 'overflow-hidden' : 'overflow-auto p-3'}`}>
        {view === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="text-left text-muted px-2 py-2 cursor-pointer hover:text-text whitespace-nowrap"
                    >
                      {col.label}
                      {sortKey === col.key && (sortDir === 1 ? ' ↑' : ' ↓')}
                    </th>
                  ))}
                  <th className="text-left text-muted px-2 py-2">Δ Time</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((effort, i) => {
                  const delta = effort.elapsedTime != null ? effort.elapsedTime - bestTime : null;
                  return (
                    <tr
                      key={`${effort.segmentId}:${effort.activityId}`}
                      className="border-b border-border hover:bg-surface transition-colors"
                    >
                      {COLUMNS.map((col) => {
                        const val = effort[col.key];
                        let cellClass = 'text-text';
                        if (col.higherIsBetter != null && val != null) {
                          const { best, worst } = getBestWorst(col.key, col.higherIsBetter);
                          if (val === best) cellClass = 'text-accent font-semibold';
                          else if (val === worst) cellClass = 'text-danger';
                        }
                        return (
                          <td key={col.key} className={`px-2 py-2 whitespace-nowrap ${cellClass}`}>
                            {val != null ? col.format(val) : '–'}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 whitespace-nowrap text-muted">
                        {delta != null ? (delta === 0 ? '–' : formatDelta(delta)) : '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {view === 'timeline' && (
          <TimelineChart efforts={efforts} />
        )}

        {view === 'radar' && <RadarChart efforts={efforts} />}

        {view === 'map' && <MapCompare efforts={efforts} />}
      </div>
    </div>
  );
}
