import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { mergeSegments, mergeEfforts } from '../utils/storage';

const SEGMENTS_KEY = 'segments_v1';
const EFFORTS_KEY = 'efforts_v1';

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useSegments() {
  const [segments, setSegments] = useState(() => load(SEGMENTS_KEY, []));
  const [efforts, setEfforts] = useState(() => load(EFFORTS_KEY, []));

  const addSegment = useCallback((segmentData) => {
    const segment = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      toleranceMeters: 25,
      ...segmentData,
    };
    setSegments((prev) => {
      const next = [...prev, segment];
      save(SEGMENTS_KEY, next);
      return next;
    });
    return segment;
  }, []);

  const removeSegment = useCallback((id) => {
    setSegments((prev) => {
      const next = prev.filter((s) => s.id !== id);
      save(SEGMENTS_KEY, next);
      return next;
    });
    setEfforts((prev) => {
      const next = prev.filter((e) => e.segmentId !== id);
      save(EFFORTS_KEY, next);
      return next;
    });
  }, []);

  const addEffort = useCallback((effort) => {
    setEfforts((prev) => {
      // Deduplicate by segmentId + activityId
      const key = `${effort.segmentId}:${effort.activityId}`;
      const filtered = prev.filter(
        (e) => `${e.segmentId}:${e.activityId}` !== key
      );
      const next = [...filtered, effort];
      save(EFFORTS_KEY, next);
      return next;
    });
  }, []);

  const addEfforts = useCallback((newEfforts) => {
    setEfforts((prev) => {
      // Replace any existing effort with the same segmentId+activityId
      const newKeys = new Set(newEfforts.map((e) => `${e.segmentId}:${e.activityId}`));
      const kept = prev.filter((e) => !newKeys.has(`${e.segmentId}:${e.activityId}`));
      const next = [...kept, ...newEfforts];
      save(EFFORTS_KEY, next);
      return next;
    });
  }, []);

  const clearEffortsForSegment = useCallback((segmentId) => {
    setEfforts((prev) => {
      const next = prev.filter((e) => e.segmentId !== segmentId);
      save(EFFORTS_KEY, next);
      return next;
    });
  }, []);

  const getEffortsForSegment = useCallback(
    (segmentId) => efforts.filter((e) => e.segmentId === segmentId),
    [efforts]
  );

  const importData = useCallback((data) => {
    setSegments((prev) => {
      const next = mergeSegments(prev, data.segments || []);
      save(SEGMENTS_KEY, next);
      return next;
    });
    setEfforts((prev) => {
      const next = mergeEfforts(prev, data.efforts || []);
      save(EFFORTS_KEY, next);
      return next;
    });
  }, []);

  return {
    segments,
    efforts,
    addSegment,
    removeSegment,
    addEffort,
    addEfforts,
    clearEffortsForSegment,
    getEffortsForSegment,
    importData,
  };
}
