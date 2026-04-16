/**
 * Simple horizontal bar showing a normalised value (0–100).
 */
export default function MetricBar({ label, value, max, color = '#00c87a', format }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted w-28 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-border rounded h-2">
        <div
          className="h-2 rounded transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-text w-16 text-right shrink-0">{format ? format(value) : value}</span>
    </div>
  );
}
