import { ENTITY_TYPES } from '@mn/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.ts';
import { MnMap } from '../components/MnMap.tsx';
import { Card, EmptyState, ErrorState, Loading, entityTypeLabel } from '../components/ui.tsx';

export function Entities() {
  const navigate = useNavigate();
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');

  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const { data, isLoading, error } = useQuery({
    queryKey: ['entities', type, category, q],
    queryFn: () => api.entities({ type: type || undefined, category: category || undefined, q: q || undefined }),
  });

  return (
    <div className="stack">
      <Card title="Minnesota buyer map">
        <div className="card-body">
          <MnMap entities={data ?? []} />
        </div>
      </Card>

      <div className="filters">
        <div className="field">
          <label>Search</label>
          <input className="search" type="search" placeholder="Buyer name…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="field">
          <label>Entity type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{entityTypeLabel(t)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Category interest</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="spacer" />
        <div className="field">
          <label>&nbsp;</label>
          <span className="t-sub">{data?.length ?? 0} buyers</span>
        </div>
      </div>

      <Card title="Entity Explorer">
        {isLoading ? (
          <Loading what="buyers" />
        ) : error ? (
          <ErrorState error={error} />
        ) : !data || data.length === 0 ? (
          <EmptyState>No buyers match these filters.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Buyer</th>
                <th>Type</th>
                <th className="num">Opportunities</th>
                <th className="num">Signals</th>
                <th className="num">Contacts</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="row" onClick={() => navigate(`/buyers/${e.id}`)}>
                  <td>
                    <span className="t-title">{e.name}</span>
                    <div className="t-sub">{e.jurisdiction}{e.county ? ` · ${e.county} County` : ''}</div>
                  </td>
                  <td><span className="pill soft">{entityTypeLabel(e.entityType)}</span></td>
                  <td className="num">{e.opportunityCount}</td>
                  <td className="num">{e.signalCount}</td>
                  <td className="num">{e.contactCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
