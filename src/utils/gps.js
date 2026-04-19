const R = 6371000; // Earth radius in metres

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
 * Returns null if either endpoint is not found.
 */
export function matchSegment(segment, latlngStream) {
  const startIdx = findClosestPoint(segment.start, latlngStream, segment.toleranceMeters);
  if (startIdx === null) return null;

  // Search for end only after start
  let bestIdx = null;
  let bestDist = Infinity;
  for (let i = startIdx + 1; i < latlngStream.length; i++) {
    const pt = toLatLng(latlngStream[i]);
    if (!pt) continue;
    const [lat, lng] = pt;
    const d = haversineDistance(segment.end.lat, segment.end.lng, lat, lng);
    if (d < bestDist && d <= segment.toleranceMeters) {
      bestDist = d;
      bestIdx = i;
    }
  }
  if (bestIdx === null) return null;
  return { startIndex: startIdx, endIndex: bestIdx };
}
