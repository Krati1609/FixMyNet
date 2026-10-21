export default function NetworkCheckCard({ check }) {
  if (!check) return null;
  const colors = { healthy: '#16a34a', degraded: '#d97706', down: '#dc2626' };
  const accent = colors[check.overall] || '#6b7280';

  return (
    <div style={{ border: `1px solid ${accent}`, borderRadius: 12, padding: 14, marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>Live network check</strong>
        <span style={{ color: accent, fontWeight: 600, textTransform: 'uppercase', fontSize: 12 }}>
          {check.overall}
          {check.average_latency_ms != null && ` · ${check.average_latency_ms} ms`}
        </span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {check.checks.map((c) => (
          <li key={c.name} style={{ display: 'flex', gap: 8, padding: '3px 0', fontSize: 14 }}>
            <span style={{ color: c.ok ? '#16a34a' : '#dc2626' }}>{c.ok ? '✓' : '✗'}</span>
            <span style={{ flex: 1 }}>{c.name}</span>
            <span style={{ opacity: 0.7 }}>{c.ms != null ? `${c.ms} ms` : c.detail}</span>
          </li>
        ))}
      </ul>
      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>{check.scope_note}</div>
    </div>
  );
}