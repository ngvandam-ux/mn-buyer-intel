import { ENTITY_TYPES, OPPORTUNITY_STATUSES } from '@mn/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.ts';
import { useFocus } from '../focus.ts';
import {
  Card,
  Chips,
  EmptyState,
  ErrorState,
  Loading,
  StatusPill,
  entityTypeLabel,
  fmtDate,
  relativeDue,
} from '../components/ui.tsx';

export function Opportunities() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [entityType, setEntityType] = useState('');
  const [q, setQ] = useState('');

  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const sources = useQuery({ queryKey: ['sources'], queryFn: api.sources });
  const [source, setSource] = useState('');

  const [focus] = useFocus();
  const { data, isLoading, error } = useQuery({
    queryKey: ['opportunities', status, category, entityType, source, q, focus],
    queryFn: () =>
      api.opportunities({
        status: status || undefined,
        category: category || undefined,
        entityType: entityType || undefined,
        source: source || undefined,
        q: q || undefined,
        lens: focus,
      }),
  });

  return (
    <div className="stack">
      <div className="filters">
        <div className="field">
          <label>Search</label>
          <input className="search" type="search" placeholder="Solicitation title…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {OPPORTUNITY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All</option>
            {(categories.data ?? []).filter((c) => c.count > 0).map((c) => <option key={c.key} value={c.key}>{c.label} ({c.count})</option>)}
          </select>
        </div>
        <div className="field">
          <label>Buyer type</label>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">All</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{entityTypeLabel(t)}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Source</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            {(sources.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.sourceName}</option>)}
          </select>
        </div>
      </div>

      <Card title="Opportunities" right={<span className="t-sub">{data?.length ?? 0} results</span>}>
        {isLoading ? (
          <Loading what="opportunities" />
        ) : error ? (
          <ErrorState error={error} />
        ) : !data || data.length === 0 ? (
          <EmptyState>No opportunities match these filters.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Solicitation</th>
                <th>Buyer</th>
                <th>Status</th>
                <th>Categories</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id} className="row" onClick={() => navigate(`/opportunities/${o.id}`)}>
                  <td>
                    <span className="t-title">{o.title}</span>
                    {o.solicitationType && <div className="t-sub">{o.solicitationType}</div>}
                  </td>
                  <td>
                    {o.entityName ?? '—'}
                    {o.entityType && <div className="t-sub">{entityTypeLabel(o.entityType)}</div>}
                  </td>
                  <td><StatusPill status={o.status} /></td>
                  <td><Chips items={o.categoryKeys} kind="category" /></td>
                  <td>{fmtDate(o.dueDate)} <span className="t-sub">{relativeDue(o.dueDate)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
