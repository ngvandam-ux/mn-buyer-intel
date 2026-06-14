import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.ts';
import {
  Card,
  Chips,
  EmptyState,
  ErrorState,
  EvidenceChain,
  Loading,
  Stat,
  StatusPill,
  entityTypeLabel,
  fmtDate,
  signalTypeLabel,
} from '../components/ui.tsx';

export function EntityDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['entity', id], queryFn: () => api.entity(id) });

  if (isLoading) return <Loading what="buyer" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const { entity, offices, contacts, opportunities, signals, evidence } = data;

  return (
    <div className="stack">
      <Link to="/buyers" className="back">← All buyers</Link>

      <Card>
        <div className="card-body row-between">
          <div>
            <h2>{entity.name}</h2>
            <div className="inline" style={{ marginTop: 6 }}>
              <span className="pill soft">{entityTypeLabel(entity.entityType)}</span>
              <span className="t-sub">{entity.jurisdiction}{entity.county ? ` · ${entity.county} County` : ''}{entity.city ? ` · ${entity.city}` : ''}</span>
              {entity.website && <a href={entity.website} target="_blank" rel="noreferrer">website ↗</a>}
            </div>
          </div>
          <div className="inline">
            <Stat label="Opportunities" value={opportunities.length} />
            <Stat label="Signals" value={signals.length} />
            <Stat label="Contacts" value={contacts.length} />
          </div>
        </div>
      </Card>

      <Card title={`Opportunities (${opportunities.length})`}>
        {opportunities.length === 0 ? (
          <EmptyState>No opportunities linked to this buyer.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Solicitation</th><th>Status</th><th>Categories</th><th>Due</th></tr>
            </thead>
            <tbody>
              {opportunities.map((o) => (
                <tr key={o.id} className="row" onClick={() => navigate(`/opportunities/${o.id}`)}>
                  <td><span className="t-title">{o.title}</span></td>
                  <td><StatusPill status={o.status} /></td>
                  <td><Chips items={o.categoryKeys} kind="category" /></td>
                  <td>{fmtDate(o.dueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid cols-2">
        <Card title={`Signals (${signals.length})`}>
          <div className="card-body stack">
            {signals.length === 0 ? (
              <EmptyState>No signals.</EmptyState>
            ) : (
              signals.map((s) => (
                <div key={s.id} className="row-between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div className="t-title">{s.title}</div>
                    {s.detail && <div className="t-sub">{s.detail}</div>}
                  </div>
                  <span className="pill brand">{signalTypeLabel(s.signalType)}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card title={`Contacts (${contacts.length})`}>
          <div className="card-body stack">
            {contacts.length === 0 ? (
              <EmptyState>No named contacts.</EmptyState>
            ) : (
              contacts.map((c) => (
                <div key={c.id}>
                  <div className="t-title">{c.name}{c.title ? <span className="t-sub"> · {c.title}</span> : null}</div>
                  <div className="t-sub">
                    {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                    {c.phone && <> · {c.phone}</>}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {offices.length > 0 && (
        <Card title={`Procurement offices (${offices.length})`}>
          <div className="card-body chips">
            {offices.map((o) => (
              <span key={o.id} className="chip">{o.name}</span>
            ))}
          </div>
        </Card>
      )}

      <Card title="Source references" right={<span className="t-sub">{evidence.length} captured snippets</span>}>
        <div className="card-body">
          <EvidenceChain evidence={evidence.slice(0, 25)} />
        </div>
      </Card>
    </div>
  );
}
