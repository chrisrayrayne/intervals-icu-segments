const EXPORT_VERSION = '1.0';

export function exportData(segments, efforts) {
  const data = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    segments,
    efforts,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `segments-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.version || !Array.isArray(data.segments)) {
          throw new Error('Invalid file format');
        }
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Merge imported segments into existing ones.
 * Keeps existing entries; adds new ones by ID.
 */
export function mergeSegments(existing, imported) {
  const ids = new Set(existing.map((s) => s.id));
  const added = imported.filter((s) => !ids.has(s.id));
  return [...existing, ...added];
}

/**
 * Merge imported efforts into existing ones.
 * Deduplicates by segmentId + activityId.
 */
export function mergeEfforts(existing, imported) {
  const keys = new Set(existing.map((e) => `${e.segmentId}:${e.activityId}`));
  const added = imported.filter((e) => !keys.has(`${e.segmentId}:${e.activityId}`));
  return [...existing, ...added];
}
