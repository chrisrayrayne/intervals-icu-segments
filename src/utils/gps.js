const R = 6371000; // Earth radius in metres

/**
 * Check every point in latlngSlice is within toleranceMeters of at least one
 * point in referenceLatlng. Returns false as soon as a deviant point is found.
 */
export function isOnRoute(latlngSlice, referenceLatlng, toleranceMeters) {
  if (!referenceLatlng?.length) return true; // no reference — accept all
  for (const pt of latlngSlice) {
    if (!pt) continue;
    const [lat, lng] = pt;
    const onRoute = referenceLatlng.some(
      (ref) => haversineDistance(lat, lng, ref[0], ref[1]) <= toleranceMeters
    );
    if (!onRoute) return false;
  }
  return true;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find the index of the closest stream point to a given latlng within tolerance.
 * @param {{ lat: number, lng: number }} latlng
 * @param {Array<[number, number]>} stream  – array of [lat, lng] pairs
 * @param {number} toleranceMeters
 * @returns {number | null}  stream index or null if not found
 */
/**
 * Convert a raw latlng stream (flat [lat,lng,lat,lng,...] or [[lat,lng],...]) to [[lat,lng],...] pairs.
 */
/**
 * Normalise a raw latlng stream to an index-aligned array of [lat,lng]|null.
 * Nulls are PRESERVED so that indices match other per-second streams (watts, hr, etc.).
 * Callers that need display-only positions should filter nulls themselves.
 */
export function normaliseLatlng(raw) {
  if (!raw?.length) return [];
  // Pre-zipped by API: array of [lat,lng]|null — return as-is to preserve indices
  const first = raw.find(v => v != null);
  if (Array.isArray(first)) {
    return raw;
  }
  // Fallback: flat numeric array — produce index-aligned array by interleaved pairing
  const pairs = [];
  for (let i = 0; i + 1 < raw.length; i += 2) {
    pairs.push(raw[i] != null && raw[i + 1] != null ? [raw[i], raw[i + 1]] : null);
  }
  return pairs;
}

function toLatLng(p) {
  if (p == null) return null;
  if (Array.isArray(p)) return p[0] != null ? [p[0], p[1]] : null;
  return null;
}

export function findClosestPoint(latlng, stream, toleranceMeters = 25) {
  let bestIdx = null;
  let bestDist = Infinity;
  for (let i = 0; i < stream.length; i++) {
    const pt = toLatLng(stream[i]);
    if (!pt) continue;
    const [lat, lng] = pt;
    const d = haversineDistance(latlng.lat, latlng.lng, lat, lng);
    if (d < bestDist && d <= toleranceMeters) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Extract start/end indices for a segment within a latlng stream.
 *
 * Strategy: scan for every "entry" into the start zone (the moment the track
 * crosses within toleranceMeters of the start point).  For each entry, scan
 * forward for the first "entry" into the end zone.  Among all valid pairs
 * return the one with the shortest duration (fastest effort).
 *
 * This handles out-and-back routes, multiple laps, and activities that pass
 * near the start point earlier in the ride without actually doing the segment.
 */
export function matchSegment(segment, latlngStream) {
  const tol = segment.toleranceMeters;
  const n   = latlngStream.length;

  // ── 1. Find every entry into the start zone ───────────────────────────────
  //    An "entry" is the first index of a consecutive run within tolerance.
  //    We also track the best (closest) index within that run.
  const startZones = []; // [{bestIdx, exitAt}]
  let inStart = false;
  let bestStartDist = Infinity;
  let bestStartIdx  = -1;

  for (let i = 0; i < n; i++) {
    const pt = toLatLng(latlngStream[i]);
    if (!pt) continue;
    const d = haversineDistance(segment.start.lat, segment.start.lng, pt[0], pt[1]);
    if (d <= tol) {
      if (!inStart) { inStart = true; bestStartDist = Infinity; } // entering
      if (d < bestStartDist) { bestStartDist = d; bestStartIdx = i; }
    } else if (inStart) {
      // Exiting start zone — record it
      startZones.push({ bestIdx: bestStartIdx, exitAt: i });
      inStart = false;
    }
  }
  if (inStart) startZones.push({ bestIdx: bestStartIdx, exitAt: n });

  if (!startZones.length) return null;

  // ── 2. For each start zone exit, scan forward for the first end zone ──────
  const matches = [];

  for (const { bestIdx: startIdx, exitAt } of startZones) {
    let inEnd = false;
    let bestEndDist = Infinity;
    let bestEndIdx  = -1;

    for (let j = exitAt; j < n; j++) {
      const pt = toLatLng(latlngStream[j]);
      if (!pt) continue;
      const d = haversineDistance(segment.end.lat, segment.end.lng, pt[0], pt[1]);
      if (d <= tol) {
        inEnd = true;
        if (d < bestEndDist) { bestEndDist = d; bestEndIdx = j; }
      } else if (inEnd) {
        // Exited the first end zone — stop here
        break;
      }
    }

    if (bestEndIdx >= 0) {
      matches.push({ startIndex: startIdx, endIndex: bestEndIdx, duration: bestEndIdx - startIdx });
    }
  }

  if (!matches.length) return null;

  // Return the fastest (shortest duration) match
  return matches.reduce((best, m) => m.duration < best.duration ? m : best);
}
