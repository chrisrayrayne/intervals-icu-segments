import { useState, useCallback } from 'react';
import { useIntervals } from './useIntervals';

export function useRoutes() {
  const [routes, setRoutes] = useState([]);
  const { fetchRoutes } = useIntervals();

  const loadRoutes = useCallback(async () => {
    try {
      const data = await fetchRoutes();
      // intervals.icu returns an array of route objects with id and name
      const list = Array.isArray(data) ? data : [];
      const mapped = list
        .filter((r) => r.id && r.name)
        .map((r) => ({ id: String(r.id), name: r.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setRoutes(mapped);
    } catch {
      // Routes are optional; silently ignore errors
      setRoutes([]);
    }
  }, [fetchRoutes]);

  return { routes, loadRoutes };
}
