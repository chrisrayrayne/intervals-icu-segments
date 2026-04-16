export default function RouteFilter({ routes, value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-bg border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
    >
      <option value="">All Routes</option>
      {routes.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}
