import { SIGNAL_TYPES } from '@mn/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.ts';
import { Card, EmptyState, ErrorState, Loading, fmtDate, signalTypeLabel } from '../components/ui.tsx';

export function Signals() {
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['signals', type, q],
    queryFn: () => api.signals({ type: type || undefined, q: q || undefined }),
  });

  return (
    <div className="stack">
      <div className="filters">
        <div className="field">
          <label>Search</label>
          <input className="search" type="search" placeholder="Signal title…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="field">
          <label>Signal type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {SIGNAL_TYPES.map((t) => <option key={t} value={t}>{signalTypeLabel(t)}</option>)}
          </select>
        </div>
        <div className="spacer" />
        <div className="field"><label>&nbsp;</label><span className="t-sub">{data?.length ?? 0} signals</span></div>
      </div>

      <Card title="Buying signals">
        {isLoading ? (
          <Loading what="signals" />
        ) : error ? (
          <ErrorState error={error} />
        ) : !data || data.length === 0 ? (
          <EmptyState>No signals match.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Signal</th><th>Type</th><th>Buyer</th><th>Strength</th><th>Observed</th></tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="t-title">{s.title}</span>
                    {s.opportunityTitle && <div className="t-sub">↳ {s.opportunityTitle}</div>}
                  </td>
                  <td><span className="pill brand">{signalTypeLabel(s.signalType)}</span></td>
                  <td>{s.entityId ? <Link to={`/buyers/${s.entityId}`}>{s.entityName}</Link> : s.entityName ?? '—'}</td>
                  <td>
                    <div className="bar" style={{ width: 80 }}><span style={{ width: `${Math.round(s.strength * 100)}%` }} /></div>
                  </td>
                  <td>{fmtDate(s.observedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
