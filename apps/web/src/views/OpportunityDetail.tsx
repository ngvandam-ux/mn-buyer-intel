import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
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

export function OpportunityDetail() {
  const { id = '' } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['opportunity', id], queryFn: () => api.opportunity(id) });

  if (isLoading) return <Loading what="opportunity" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const { opportunity: o, entity, office, signals, categories, evidence } = data;

  return (
    <div className="stack">
      <Link to="/opportunities" className="back">← All opportunities</Link>

      <Card>
        <div className="card-body">
          <div className="row-between">
            <div>
              <h2>{o.title}</h2>
              <div className="inline" style={{ marginTop: 6 }}>
                <StatusPill status={o.status} />
                {o.solicitationType && <span className="pill soft">{o.solicitationType}</span>}
                {o.externalId && <span className="t-sub">Event ID {o.externalId}</span>}
              </div>
            </div>
            {o.url && <a className="btn primary" href={o.url} target="_blank" rel="noreferrer">Open at source ↗</a>}
          </div>

          {o.description && <p style={{ marginTop: 14, color: 'var(--ink-soft)' }}>{o.description}</p>}

          <div className="grid cols-4" style={{ marginTop: 16 }}>
            <Stat label="Posted" value={fmtDate(o.postedDate)} />
            <Stat label="Due" value={fmtDate(o.dueDate)} />
            <Stat label="Confidence" value={`${Math.round(o.confidence * 100)}%`} />
            <Stat label="Business unit" value={<span style={{ fontSize: 15 }}>{o.businessUnit ?? '—'}</span>} />
          </div>

          <div style={{ marginTop: 16 }} className="inline">
            <span className="section-title" style={{ margin: 0 }}>Categories</span>
            <Chips items={categories.map((c) => c.key)} kind="category" />
          </div>

          {entity && (
            <div style={{ marginTop: 12 }} className="inline">
              <span className="section-title" style={{ margin: 0 }}>Buyer</span>
              <Link to={`/buyers/${entity.id}`} className="pill brand">{entity.name}</Link>
              <span className="t-sub">{entityTypeLabel(entity.entityType)}{office ? ` · ${office.name}` : ''}</span>
            </div>
          )}
        </div>
      </Card>

      {signals.length > 0 && (
        <Card title="Signals on this opportunity / buyer">
          <div className="card-body stack">
            {signals.map((s) => (
              <div key={s.id} className="row-between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="t-title">{s.title}</div>
                  {s.detail && <div className="t-sub">{s.detail}</div>}
                </div>
                <span className="pill brand">{signalTypeLabel(s.signalType)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Evidence chain" right={<span className="t-sub">why this record exists</span>}>
        <div className="card-body">
          {evidence.length === 0 ? <EmptyState>No evidence captured.</EmptyState> : <EvidenceChain evidence={evidence} />}
        </div>
      </Card>
    </div>
  );
}
