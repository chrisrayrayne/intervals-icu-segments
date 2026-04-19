import { useState, useEffect, useCallback } from 'react';
import { format, subYears, subMonths, formatISO } from 'date-fns';
import { useIntervals } from '../hooks/useIntervals';
import { useRoutes } from '../hooks/useRoutes';
import RouteFilter from './RouteFilter';
import { matchSegment, normaliseLatlng } from '../utils/gps';
import { extractEffortMetrics } from '../utils/metrics';

const ACTIVITY_TYPES = ['', 'Ride', 'Run', 'Swim', 'Walk', 'Hike', 'VirtualRide'];

// Default window: last 6 months. "Load more" extends by 6 months each time.
function windowStart(yearsBack) {
  return formatISO(subMonths(new Date(), 6 * yearsBack), { representation: 'date' });
}

export default function ActivityList({ segments, onEffortsFound, onSelectActivity, selectedActivityId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // How many 6-month windows we've loaded (1 = last 6 months, 2 = last 12 months, …)
  const [windows, setWindows] = useState(1);
  const [analysing, setAnalysing] = useState(false);

  const { fetchActivities, fetchStreams } = useIntervals();
  const { routes, loadRoutes } = useRoutes();

  const load = useCallback(async (numWindows = 1, append = false) => {
    setLoading(true);
    setError('');
    try {
      const today = formatISO(new Date(), { representation: 'date' });
      const params = {
        oldest: dateFrom || windowStart(numWindows),
        newest: dateTo || today,
      };
      if (routeFilter) params.route_id = routeFilter;
      if (typeFilter) params.type = typeFilter;
      const data = await fetchActivities(params);
      if (append) {
        setActivities((prev) => {
          const ids = new Set(prev.map((a) => a.id));
          return [...prev, ...data.filter((a) => !ids.has(a.id))];
        });
      } else {
        setActivities(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchActivities, routeFilter, typeFilter, dateFrom, dateTo]);

  // Initial load + route list
  useEffect(() => {
    loadRoutes().catch(() => {});
    load(1, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when filters change
  useEffect(() => {
    setWindows(1);
    load(1, false);
  }, [routeFilter, typeFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  function loadMore() {
    const next = windows + 1;
    setWindows(next);
    load(next, true);
  }

  const filtered = activities.filter((a) => {
    if (!nameSearch) return true;
    return a.name?.toLowerCase().includes(nameSearch.toLowerCase());
  });

  async function analyseAll() {
    if (!segments.length) return;
    setAnalysing(true);
    const newEfforts = [];
    for (const activity of filtered.slice(0, 50)) {
      try {
        const streams = await fetchStreams(activity.id);
        const latlngStream = normaliseLatlng(streams?.latlng);
        if (!latlngStream.length) continue;
        for (const seg of segments) {
          const match = matchSegment(seg, latlngStream);
          if (!match) continue;
          const metrics = extractEffortMetrics(streams, match.startIndex, match.endIndex);
          newEfforts.push({
            segmentId: seg.id,
            activityId: activity.id,
            activityName: activity.name,
            routeName: activity.route_name || '',
            date: activity.start_date_local?.slice(0, 10) || '',
            startIndex: match.startIndex,
            endIndex: match.endIndex,
            ...metrics,
          });
        }
      } catch {
        // skip failed activities
      }
    }
    onEffortsFound(newEfforts);
    setAnalysing(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 p-3 border-b border-border">
        <RouteFilter routes={routes} value={routeFilter} onChange={setRouteFilter} />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-bg border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
        >
          {ACTIVITY_TYPES.map((t) => (
            <option key={t} value={t}>{t || 'All Types'}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="bg-bg border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="bg-bg border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
        />
        <input
          type="text"
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          placeholder="Search name…"
          className="flex-1 min-w-32 bg-bg border border-border rounded-lg px-3 py-2 text-text text-sm placeholder-muted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Bulk analyse */}
      {segments.length > 0 && (
        <div className="p-3 border-b border-border">
          <button
            onClick={analyseAll}
            disabled={analysing || loading}
            className="text-sm bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors"
          >
            {analysing ? 'Analysing…' : `Analyse ${Math.min(filtered.length, 50)} activities`}
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {error && <p className="text-danger text-sm p-3">{error}</p>}
        {loading && !activities.length && (
          <p className="text-muted text-sm p-3">Loading…</p>
        )}
        {filtered.map((activity) => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            selected={selectedActivityId === activity.id}
            onClick={() => onSelectActivity(activity)}
          />
        ))}
        {filtered.length > 0 && (
          <div className="p-3">
            <button
              onClick={loadMore}
              disabled={loading}
              className="text-sm text-muted hover:text-text disabled:opacity-50"
            >
              {loading ? 'Loading…' : `Load more (back to ${windowStart(windows + 1)})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ activity, selected, onClick }) {
  const date = activity.start_date_local
    ? format(new Date(activity.start_date_local), 'dd.MM.yyyy')
    : '';

  return (
    <div
      onClick={onClick}
      className={`px-3 py-2.5 border-b border-border cursor-pointer hover:bg-surface transition-colors ${
        selected ? 'bg-accent/10 border-l-2 border-l-accent' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-text text-sm font-medium truncate">{activity.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-muted text-xs">{date}</span>
            {activity.route_name && (
              <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded">
                {activity.route_name}
              </span>
            )}
          </div>
        </div>
        <div className="text-muted text-xs shrink-0">{activity.type}</div>
      </div>
    </div>
  );
}
