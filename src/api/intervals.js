const BASE_URL = '/api/v1';

function getHeaders() {
  const athleteId = sessionStorage.getItem('athleteId');
  const apiKey = sessionStorage.getItem('apiKey');
  if (!athleteId || !apiKey) throw new Error('Not authenticated');
  const encoded = btoa(`API_KEY:${apiKey}`);
  return {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/json',
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...options.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export async function getAthlete(athleteId) {
  return request(`/athlete/${athleteId}`);
}

export async function getActivities(athleteId, params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/athlete/${athleteId}/activities${qs ? `?${qs}` : ''}`);
}

export async function getRoutes(athleteId) {
  return request(`/athlete/${athleteId}/routes`);
}

export async function getActivity(athleteId, activityId) {
  const raw = await request(`/athlete/${athleteId}/activities/${activityId}`);
  // API returns either a single object or a single-element array
  return Array.isArray(raw) ? raw[0] : raw;
}

const STREAMS = 'time,latlng,distance,altitude,velocity_smooth,heartrate,cadence,watts,grade_smooth';

export async function getActivityStreams(athleteId, activityId) {
  // Check activity detail first: if no latlng in stream_types, skip the fetch
  const detail = await getActivity(athleteId, activityId);
  const streamTypes = detail?.stream_types ?? [];

  if (!streamTypes.includes('latlng')) {
    return null; // no GPS data for this activity
  }

  // Correct endpoint: /api/v1/activity/{id}/streams — no athlete prefix, param is "types"
  // Don't pre-filter by stream_types: computed streams like grade_smooth may not be listed there
  const url = `${BASE_URL}/activity/${activityId}/streams?types=${STREAMS}`;
  const res = await fetch(url, { headers: getHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  const data = await res.json();
  // Response is [{type, data, data2?}, ...] — convert to {latlng: [...], time: [...], ...}
  // latlng stream has data (lat, ~47 for Switzerland) + data2 (lng, ~8 for Switzerland)
  if (Array.isArray(data)) {
    return Object.fromEntries(data.map((s) => {
      if (s.type === 'latlng' && Array.isArray(s.data2)) {
        // Zip lat (data) + lng (data2) → [[lat,lng], null, ...]
        const zipped = s.data.map((lat, i) => {
          const lng = s.data2[i];
          return (lat != null && lng != null) ? [lat, lng] : null;
        });
        return [s.type, zipped];
      }
      return [s.type, s.data];
    }));
  }
  return data;
}
