import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import SegmentList from './components/SegmentList';
import ActivityList from './components/ActivityList';
import MapPicker from './components/MapPicker';
import CompareView from './components/CompareView';
import { useSegments } from './hooks/useSegments';
import { useIntervals } from './hooks/useIntervals';
import { matchSegment } from './utils/gps';
import { extractEffortMetrics } from './utils/metrics';

export default function App() {
  const [auth, setAuth] = useState(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [definingSegment, setDefiningSegment] = useState(false);
  const [rightPanel, setRightPanel] = useState('activities'); // 'activities' | 'compare' | 'map'

  const {
    segments,
    efforts,
    addSegment,
    removeSegment,
    addEfforts,
    getEffortsForSegment,
    importData,
  } = useSegments();

  const { fetchStreams } = useIntervals();

  // Restore auth from sessionStorage on mount
  useEffect(() => {
    const id = sessionStorage.getItem('athleteId');
    if (id) setAuth({ athleteId: id, name: id });
  }, []);

  function handleAuth(data) {
    setAuth(data);
  }

  function handleLogout() {
    sessionStorage.removeItem('athleteId');
    sessionStorage.removeItem('apiKey');
    setAuth(null);
  }

  function handleSelectSegment(id) {
    setSelectedSegmentId(id);
    setRightPanel('compare');
    setDefiningSegment(false);
  }

  function handleNewSegment() {
    if (!selectedActivity) {
      alert('Select an activity first to define a segment on its route.');
      return;
    }
    setDefiningSegment(true);
    setRightPanel('map');
  }

  function handleSelectActivity(activity) {
    setSelectedActivity(activity);
    if (definingSegment) setRightPanel('map');
  }

  async function handleSegmentCreated(segmentData) {
    const segment = addSegment(segmentData);

    // Immediately try to match the creating activity
    try {
      const streams = await fetchStreams(selectedActivity.id);
      const latlng = streams.latlng;
      if (latlng) {
        const match = matchSegment(segment, latlng);
        if (match) {
          const metrics = extractEffortMetrics(streams, match.startIndex, match.endIndex);
          addEfforts([{
            segmentId: segment.id,
            activityId: selectedActivity.id,
            activityName: selectedActivity.name,
            routeName: selectedActivity.route_name || '',
            date: selectedActivity.start_date_local?.slice(0, 10) || '',
            startIndex: match.startIndex,
            endIndex: match.endIndex,
            ...metrics,
          }]);
        }
      }
    } catch {
      // non-fatal
    }

    setDefiningSegment(false);
    setSelectedSegmentId(segment.id);
    setRightPanel('compare');
  }

  function handleEffortsFound(newEfforts) {
    addEfforts(newEfforts);
  }

  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) || null;
  const segmentEfforts = selectedSegmentId ? getEffortsForSegment(selectedSegmentId) : [];

  if (!auth) {
    return <Auth onAuth={handleAuth} />;
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col" style={{ height: '100vh' }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h1 className="font-bold text-accent tracking-tight">Segment Comparator</h1>
        <div className="flex items-center gap-3">
          <span className="text-muted text-sm">Athlete: {auth.name}</span>
          <button
            onClick={handleLogout}
            className="text-xs text-muted hover:text-text transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: segment list */}
        <aside className="w-52 shrink-0 border-r border-border flex flex-col overflow-hidden">
          <SegmentList
            segments={segments}
            efforts={efforts}
            selectedSegmentId={selectedSegmentId}
            onSelect={handleSelectSegment}
            onDelete={removeSegment}
            onImport={importData}
            onNewSegment={handleNewSegment}
          />
        </aside>

        {/* Middle: activity list */}
        <div className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <h2 className="text-text font-semibold text-sm uppercase tracking-wider">Activities</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <ActivityList
              segments={segments}
              onEffortsFound={handleEffortsFound}
              onSelectActivity={handleSelectActivity}
              selectedActivityId={selectedActivity?.id}
            />
          </div>
        </div>

        {/* Right: map picker or compare view */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {rightPanel === 'map' && selectedActivity && (
            <MapPicker
              activity={selectedActivity}
              onSegmentCreated={handleSegmentCreated}
              onCancel={() => {
                setDefiningSegment(false);
                setRightPanel(selectedSegmentId ? 'compare' : 'activities');
              }}
            />
          )}
          {rightPanel === 'compare' && (
            <CompareView segment={selectedSegment} efforts={segmentEfforts} />
          )}
          {rightPanel === 'activities' && (
            <div className="flex items-center justify-center h-full text-muted text-sm">
              Select a segment or define a new one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
