import { useState } from 'react';
import { getAthlete } from '../api/intervals';

export default function Auth({ onAuth }) {
  const [athleteId, setAthleteId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      sessionStorage.setItem('athleteId', athleteId.trim());
      sessionStorage.setItem('apiKey', apiKey.trim());
      const athlete = await getAthlete(athleteId.trim());
      onAuth({ athleteId: athleteId.trim(), name: athlete.name || athlete.id });
    } catch (err) {
      sessionStorage.removeItem('athleteId');
      sessionStorage.removeItem('apiKey');
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-text mb-2">Segment Comparator</h1>
        <p className="text-muted text-sm mb-8">Connect to your intervals.icu account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">Athlete ID</label>
            <input
              type="text"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              placeholder="i12345"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text placeholder-muted focus:outline-none focus:border-accent"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Your intervals.icu API key"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text placeholder-muted focus:outline-none focus:border-accent"
              required
            />
            <p className="text-muted text-xs mt-1">
              Found at intervals.icu → Settings → API Key
            </p>
          </div>

          {error && (
            <p className="text-danger text-sm bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 text-bg font-semibold rounded-lg px-4 py-2 transition-colors"
          >
            {loading ? 'Connecting…' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
}
