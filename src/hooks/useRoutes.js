import { useState, useCallback } from 'react';
import { useIntervals } from './useIntervals';

export function useRoutes() {
  const [routes, setRoutes] = useState([]);
  const { fetchRoutes } = useIntervals();

  const loadRoutes = useCallback(async () => {
    try {
      const data = await fetchRoutes();
      console.log('[Routes] raw API response:', data);
      const list = Array.isArray(data) ? data : [];
      const mapped = list
        .map((r) => {
          // intervals.icu may use id or route_id; name is usually 'name'
          const id = r.id ?? r.route_id;
          const name = r.name ?? r.route_name;
          if (!id || !name) return null;
          return { id: String(id), name };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
      console.log('[Routes] mapped:', mapped);
      setRoutes(mapped);
    } catch (e) {
      console.warn('[Routes] fetch failed:', e.message);
      setRoutes([]);
    }
  }, [fetchRoutes]);

  return { routes, loadRoutes };
}
