import { useState, useCallback } from 'react';
import { formatISO, subMonths } from 'date-fns';
import { useIntervals } from './useIntervals';

/**
 * Extracts unique routes (id + name) from a list of activities.
 */
function extractRoutes(activities) {
  const map = new Map();
  for (const act of activities) {
    if (act.route_id && act.route_name && !map.has(act.route_id)) {
      map.set(act.route_id, { id: act.route_id, name: act.route_name });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function useRoutes() {
  const [routes, setRoutes] = useState([]);
  const { fetchActivities } = useIntervals();

  const loadRoutes = useCallback(async () => {
    // Load the last 12 months to get a representative set of routes
    const oldest = formatISO(subMonths(new Date(), 12), { representation: 'date' });
    const newest = formatISO(new Date(), { representation: 'date' });
    const activities = await fetchActivities({ oldest, newest });
    setRoutes(extractRoutes(activities));
    return activities;
  }, [fetchActivities]);

  return { routes, loadRoutes };
}
