import { useCallback } from 'react';
import * as api from '../api/intervals';

// In-memory cache for the session
const cache = new Map();

function cacheGet(key) {
  if (cache.has(key)) return cache.get(key);
  const stored = sessionStorage.getItem(key);
  if (stored) {
    const parsed = JSON.parse(stored);
    cache.set(key, parsed);
    return parsed;
  }
  return null;
}

function cacheSet(key, value) {
  cache.set(key, value);
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // QuotaExceeded – in-memory only
  }
}

export function useIntervals() {
  const athleteId = sessionStorage.getItem('athleteId');

  const fetchActivities = useCallback(
    async (params = {}) => {
      const key = `activities_${JSON.stringify(params)}`;
      const cached = cacheGet(key);
      if (cached) return cached;
      const data = await api.getActivities(athleteId, params);
      cacheSet(key, data);
      return data;
    },
    [athleteId]
  );

  const fetchStreams = useCallback(
    async (activityId) => {
      const key = `streams_${activityId}`;
      const cached = cacheGet(key);
      // Only use cache if it has real latlng data AND a time stream (time was added later; stale cache won't have it)
      if (cached !== null && cached?.latlng?.length > 0 && cached?.time?.length > 0) return cached;
      const data = await api.getActivityStreams(athleteId, activityId);
      if (data?.latlng?.length > 0) cacheSet(key, data); // only cache usable results
      return data;
    },
    [athleteId]
  );

  const fetchActivity = useCallback(
    async (activityId) => {
      const key = `activity_${activityId}`;
      const cached = cacheGet(key);
      if (cached) return cached;
      const data = await api.getActivity(athleteId, activityId);
      cacheSet(key, data);
      return data;
    },
    [athleteId]
  );

  const fetchRoutes = useCallback(
    async () => {
      const key = `routes_${athleteId}`;
      const cached = cacheGet(key);
      if (cached) return cached;
      const data = await api.getRoutes(athleteId);
      cacheSet(key, data);
      return data;
    },
    [athleteId]
  );

  const clearStreamCache = useCallback(() => {
    // Remove all stream entries from both the in-memory cache and sessionStorage
    for (const key of [...cache.keys()]) {
      if (key.startsWith('streams_')) cache.delete(key);
    }
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('streams_')) sessionStorage.removeItem(key);
    }
  }, []);

  return { fetchActivities, fetchStreams, fetchActivity, fetchRoutes, clearStreamCache };
}
