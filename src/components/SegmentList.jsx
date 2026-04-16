import { exportData, importData } from '../utils/storage';

export default function SegmentList({
  segments,
  efforts,
  selectedSegmentId,
  onSelect,
  onDelete,
  onImport,
  onNewSegment,
}) {
  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importData(file);
      onImport(data);
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
    e.target.value = '';
  }

  function effortCount(segmentId) {
    return efforts.filter((e) => e.segmentId === segmentId).length;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <h2 className="text-text font-semibold text-sm uppercase tracking-wider">Segments</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {segments.length === 0 && (
          <p className="text-muted text-sm p-3">No segments yet. Select an activity to define one.</p>
        )}
        {segments.map((seg) => (
          <div
            key={seg.id}
            onClick={() => onSelect(seg.id)}
            className={`px-3 py-2.5 border-b border-border cursor-pointer hover:bg-surface transition-colors flex items-center justify-between gap-2 ${
              selectedSegmentId === seg.id ? 'bg-accent/10 border-l-2 border-l-accent' : ''
            }`}
          >
            <div className="min-w-0">
              <p className="text-text text-sm font-medium truncate">{seg.name}</p>
              {seg.description && (
                <p className="text-muted text-xs truncate">{seg.description}</p>
              )}
              <p className="text-muted text-xs mt-0.5">
                {effortCount(seg.id)} effort{effortCount(seg.id) !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(seg.id); }}
              className="text-muted hover:text-danger transition-colors text-xs shrink-0"
              title="Delete segment"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border flex flex-col gap-2">
        <button
          onClick={onNewSegment}
          className="w-full text-sm bg-accent hover:bg-accent-dim text-bg font-semibold rounded-lg px-3 py-2 transition-colors"
        >
          + New Segment
        </button>
        <div className="flex gap-2">
          <label className="flex-1 text-center text-sm bg-surface hover:bg-border border border-border text-text rounded-lg px-3 py-2 cursor-pointer transition-colors">
            Import
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
          <button
            onClick={() => exportData(segments, efforts)}
            className="flex-1 text-sm bg-surface hover:bg-border border border-border text-text rounded-lg px-3 py-2 transition-colors"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
