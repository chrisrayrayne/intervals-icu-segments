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

export async function getActivity(athleteId, activityId) {
  return request(`/athlete/${athleteId}/activity/${activityId}`);
}

const STREAMS = 'time,latlng,distance,altitude,velocity_smooth,heartrate,cadence,watts,grade_smooth';

export async function getActivityStreams(athleteId, activityId) {
  return request(
    `/athlete/${athleteId}/activity/${activityId}/streams?streams=${STREAMS}`
  );
}
