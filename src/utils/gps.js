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
export function findClosestPoint(latlng, stream, toleranceMeters = 25) {
  let bestIdx = null;
  let bestDist = Infinity;
  for (let i = 0; i < stream.length; i++) {
    const [lat, lng] = stream[i];
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
    const [lat, lng] = latlngStream[i];
    const d = haversineDistance(segment.end.lat, segment.end.lng, lat, lng);
    if (d < bestDist && d <= segment.toleranceMeters) {
      bestDist = d;
      bestIdx = i;
    }
  }
  if (bestIdx === null) return null;
  return { startIndex: startIdx, endIndex: bestIdx };
}
