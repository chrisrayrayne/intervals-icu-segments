import { useState, useEffect, useCallback } from 'react';
import { format, subMonths, formatISO } from 'date-fns';
import { useIntervals } from '../hooks/useIntervals';
import { useRoutes } from '../hooks/useRoutes';
import RouteFilter from './RouteFilter';
import { matchSegment, normaliseLatlng } from '../utils/gps';
import { extractEffortMetrics } from '../utils/metrics';

const ACTIVITY_TYPES = ['', 'Ride', 'Run', 'Swim', 'Walk', 'Hike', 'VirtualRide'];

// Default window: last 6 months. "Load more" extends by 6 months each time.
function windowStart(numWindows) {
  return formatISO(subMonths(new Date(), 6 * numWindows), { representation: 'date' });
}

export default function ActivityList({ segments, onEffortsFound, onSelectActivity, selectedActivityId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pending filter inputs (not yet applied)
  const [pendingRoute, setPendingRoute] = useState('');
  const [pendingType, setPendingType] = useState('');
  const [pendingDateFrom, setPendingDateFrom] = useState('');
  const [pendingDateTo, setPendingDateTo] = useState('');
  const [nameSearch, setNameSearch] = useState('');

  // Applied filters (trigger API reload when changed)
  const [routeFilter, setRouteFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Type filter is client-side only (API doesn't support it)
  const [typeFilter, setTypeFilter] = useState('');

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
  }, [fetchActivities, routeFilter, dateFrom, dateTo]);

  // Initial load + routes
  useEffect(() => {
    loadRoutes().catch(() => {});
    load(1, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload when applied API filters change
  useEffect(() => {
    setWindows(1);
    load(1, false);
  }, [routeFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilters() {
    setRouteFilter(pendingRoute);
    setDateFrom(pendingDateFrom);
    setDateTo(pendingDateTo);
    setTypeFilter(pendingType); // client-side, no reload needed
  }

  function loadMore() {
    const next = windows + 1;
    setWindows(next);
    load(next, true);
  }

  const filtered = activities.filter((a) => {
    if (typeFilter && a.type !== typeFilter) return false;
    if (nameSearch && !a.name?.toLowerCase().includes(nameSearch.toLowerCase())) return false;
    return true;
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
      {/* Filter bar — row 1: dropdowns + name search */}
      <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1">
        <RouteFilter routes={routes} value={pendingRoute} onChange={setPendingRoute} />
        <select
          value={pendingType}
          onChange={(e) => setPendingType(e.target.value)}
          className="bg-bg border border-border rounded-lg px-2 py-1.5 text-text text-sm focus:outline-none focus:border-accent"
        >
          {ACTIVITY_TYPES.map((t) => (
            <option key={t} value={t}>{t || 'All Types'}</option>
          ))}
        </select>
        <input
          type="text"
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          placeholder="Search name…"
          className="flex-1 min-w-0 bg-bg border border-border rounded-lg px-2 py-1.5 text-text text-sm placeholder-muted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Filter bar — row 2: date range + Filter button */}
      <div className="flex flex-wrap items-center gap-2 px-3 pb-3 border-b border-border">
        <span className="text-muted text-xs whitespace-nowrap">From</span>
        <input
          type="date"
          value={pendingDateFrom}
          onChange={(e) => setPendingDateFrom(e.target.value)}
          className="bg-bg border border-border rounded-lg px-2 py-1.5 text-text text-sm focus:outline-none focus:border-accent"
        />
        <span className="text-muted text-xs whitespace-nowrap">To</span>
        <input
          type="date"
          value={pendingDateTo}
          onChange={(e) => setPendingDateTo(e.target.value)}
          className="bg-bg border border-border rounded-lg px-2 py-1.5 text-text text-sm focus:outline-none focus:border-accent"
        />
        <button
          onClick={applyFilters}
          disabled={loading}
          className="bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded-lg px-3 py-1.5 text-sm disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          Filter
        </button>
      </div>

      {/* Bulk analyse */}
      {segments.length > 0 && (
        <div className="px-3 py-2 border-b border-border">
          <button
            onClick={analyseAll}
            disabled={analysing || loading}
            className="text-sm bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded-lg px-3 py-1.5 disabled:opacity-50 transition-colors"
          >
            {analysing ? 'Analysing…' : `Analyse ${Math.min(filtered.length, 50)} activities`}
          </button>
        </div>
      )}

      {/* Activity list */}
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
        {!loading && filtered.length === 0 && activities.length > 0 && (
          <p className="text-muted text-sm p-3">No activities match the current filters.</p>
        )}
        {activities.length > 0 && (
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
            {activity.type && (
              <span className="text-xs text-muted">{activity.type}</span>
            )}
            {activity.route_name && (
              <span className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded">
                {activity.route_name}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
