import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.ts';
import { Card, EmptyState, ErrorState, Loading } from '../components/ui.tsx';

export function Contacts() {
  const [q, setQ] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['contacts', q], queryFn: () => api.contacts({ q: q || undefined }) });

  return (
    <div className="stack">
      <div className="filters">
        <div className="field">
          <label>Search</label>
          <input className="search" type="search" placeholder="Name…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="spacer" />
        <div className="field"><label>&nbsp;</label><span className="t-sub">{data?.length ?? 0} contacts</span></div>
      </div>

      <Card title="Procurement contacts">
        {isLoading ? (
          <Loading what="contacts" />
        ) : error ? (
          <ErrorState error={error} />
        ) : !data || data.length === 0 ? (
          <EmptyState>No contacts found.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Title</th><th>Email</th><th>Phone</th><th>Buyer / Office</th></tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td><span className="t-title">{c.name}</span></td>
                  <td>{c.title ?? '—'}</td>
                  <td>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '—'}</td>
                  <td>{c.phone ?? '—'}</td>
                  <td>
                    {c.entityId ? <Link to={`/buyers/${c.entityId}`}>{c.entityName}</Link> : c.entityName ?? '—'}
                    {c.officeName && <div className="t-sub">{c.officeName}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
