/**
 * Format elapsed seconds as m:ss or h:mm:ss
 */
export function formatTime(seconds) {
  if (seconds == null) return '–';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDelta(seconds) {
  if (seconds == null) return '';
  const sign = seconds >= 0 ? '+' : '–';
  return `${sign}${formatTime(Math.abs(seconds))}`;
}

export function formatSpeed(mps) {
  if (mps == null) return '–';
  return `${(mps * 3.6).toFixed(1)} km/h`;
}

export function formatDistance(meters) {
  if (meters == null) return '–';
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
}

export function formatWatts(w) {
  if (w == null) return '–';
  return `${Math.round(w)} W`;
}

export function formatBpm(bpm) {
  if (bpm == null) return '–';
  return `${Math.round(bpm)} bpm`;
}

export function formatGrade(g) {
  if (g == null) return '–';
  return `${g.toFixed(1)} %`;
}

export function formatElevation(m) {
  if (m == null) return '–';
  return `${Math.round(m)} m`;
}

export function formatCadence(c) {
  if (c == null) return '–';
  return `${Math.round(c)} rpm`;
}

/**
 * Average of an array slice (ignores nulls/undefined).
 */
function avg(arr, start, end) {
  if (!arr) return null;
  const slice = arr.slice(start, end + 1).filter((v) => v != null);
  if (!slice.length) return null;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function max(arr, start, end) {
  if (!arr) return null;
  const slice = arr.slice(start, end + 1).filter((v) => v != null);
  if (!slice.length) return null;
  return Math.max(...slice);
}

/**
 * Calculate Normalized Power from a watts array slice (30s rolling avg, 4th power).
 */
function normalizedPower(wattsArr, start, end) {
  if (!wattsArr) return null;
  const slice = wattsArr.slice(start, end + 1).filter((v) => v != null);
  if (slice.length < 30) return avg(wattsArr, start, end);

  const rolling = [];
  for (let i = 29; i < slice.length; i++) {
    const window = slice.slice(i - 29, i + 1);
    rolling.push(window.reduce((a, b) => a + b, 0) / 30);
  }
  const fourth = rolling.reduce((a, b) => a + b ** 4, 0) / rolling.length;
  return Math.round(fourth ** 0.25);
}

/**
 * Extract effort metrics from streams for a given index range.
 */
export function extractEffortMetrics(streams, startIndex, endIndex) {
  // Synthesize time if the API omitted it (streams are 1 sample/sec starting at 0)
  const streamLen = (streams.distance ?? streams.watts ?? streams.heartrate ?? streams.velocity_smooth ?? []).length;
  const timeArr = streams.time?.length ? streams.time : (streamLen ? Array.from({ length: streamLen }, (_, i) => i) : null);
  const distArr = streams.distance;
  const altArr = streams.altitude;
  const velArr = streams.velocity_smooth;
  const hrArr = streams.heartrate;
  const cadArr = streams.cadence;
  const wattsArr = streams.watts;
  const gradeArr = streams.grade_smooth;

  const elapsedTime = timeArr
    ? timeArr[endIndex] - timeArr[startIndex]
    : null;

  const distance = distArr
    ? distArr[endIndex] - distArr[startIndex]
    : null;

  // Elevation gain
  let elevationGain = null;
  if (altArr) {
    let gain = 0;
    for (let i = startIndex + 1; i <= endIndex; i++) {
      const diff = altArr[i] - altArr[i - 1];
      if (diff > 0) gain += diff;
    }
    elevationGain = Math.round(gain);
  }

  // Per-point stream slices for segment chart overlay
  const streamSlices = {};
  const SLICE_KEYS = ['time', 'latlng', 'watts', 'heartrate', 'velocity_smooth', 'cadence', 'altitude', 'grade_smooth', 'distance'];
  for (const key of SLICE_KEYS) {
    if (streams[key]) streamSlices[key] = streams[key].slice(startIndex, endIndex + 1);
  }

  return {
    elapsedTime,
    distance: distance != null ? Math.round(distance) : null,
    avgWatts: avg(wattsArr, startIndex, endIndex) != null ? Math.round(avg(wattsArr, startIndex, endIndex)) : null,
    maxWatts: max(wattsArr, startIndex, endIndex),
    avgHeartrate: avg(hrArr, startIndex, endIndex) != null ? Math.round(avg(hrArr, startIndex, endIndex)) : null,
    maxHeartrate: max(hrArr, startIndex, endIndex),
    avgCadence: avg(cadArr, startIndex, endIndex) != null ? Math.round(avg(cadArr, startIndex, endIndex)) : null,
    avgSpeed: velArr ? avg(velArr, startIndex, endIndex) : null,
    avgGrade: gradeArr ? Number((avg(gradeArr, startIndex, endIndex) ?? 0).toFixed(1)) : null,
    elevationGain,
    normalizedPower: normalizedPower(wattsArr, startIndex, endIndex),
    streamSlices,
  };
}
