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
  TrendPill,
  categoryLabel,
  entityTypeLabel,
  fmtDate,
  fmtMoney,
  signalTypeLabel,
} from '../components/ui.tsx';

export function EntityDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['entity', id], queryFn: () => api.entity(id) });

  if (isLoading) return <Loading what="buyer" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const { entity, offices, contacts, opportunities, signals, budgetLines, reachOut, similar, evidence } = data;
  const roClass = reachOut.window === 'now' ? 'tier-high' : reachOut.window === 'soon' ? 'status-upcoming' : 'soft';

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
            <div className="inline" style={{ marginTop: 10 }}>
              <span className={`pill ${roClass}`}>⏱ {reachOut.window === 'now' ? 'Reach out now' : reachOut.window === 'soon' ? 'Reach out soon' : 'Monitor'}</span>
              <span className="t-sub">{reachOut.label}</span>
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

        <Card title={`Decision-makers & contacts (${contacts.length})`} right={<span className="t-sub">who to call</span>}>
          <div className="card-body stack">
            {contacts.length === 0 ? (
              <EmptyState>No named contacts.</EmptyState>
            ) : (
              [...contacts]
                .sort((a, b) => (b.titleRank ?? 0) - (a.titleRank ?? 0))
                .map((c) => (
                  <div key={c.id} className="row-between" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <div className="t-title">
                        {c.name}
                        {c.isDecisionMaker && <span className="pill tier-high" style={{ marginLeft: 8 }}>decision-maker</span>}
                      </div>
                      {c.title && <div className="t-sub">{c.title}</div>}
                      <div className="t-sub">
                        {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                        {c.phone && <> · {c.phone}</>}
                      </div>
                    </div>
                    <div className="inline" style={{ alignItems: 'flex-end' }}>
                      {c.roleCategory && <span className="chip">owns {categoryLabel(c.roleCategory)}</span>}
                    </div>
                  </div>
                ))
            )}
          </div>
        </Card>
      </div>

      {budgetLines.length > 0 && (
        <Card title={`Budget intel (${budgetLines.length})`}>
          <table className="table">
            <thead>
              <tr><th>Program</th><th>Period</th><th className="num">Amount</th><th>Trend</th><th>Categories</th></tr>
            </thead>
            <tbody>
              {budgetLines.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span className="t-title">{b.program}</span>
                    {b.narrative && <div className="t-sub">{b.narrative.slice(0, 120)}…</div>}
                  </td>
                  <td>{b.fiscalPeriod ?? '—'}</td>
                  <td className="num"><strong>{fmtMoney(b.amount)}</strong></td>
                  <td><TrendPill delta={b.trendDelta} /></td>
                  <td><Chips items={b.categoryKeys.slice(0, 6)} kind="category" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {offices.length > 0 && (
        <Card title={`Procurement offices (${offices.length})`}>
          <div className="card-body chips">
            {offices.map((o) => (
              <span key={o.id} className="chip">{o.name}</span>
            ))}
          </div>
        </Card>
      )}

      {similar.length > 0 && (
        <Card title="Similar buyers" right={<span className="t-sub">buy / fund the same categories</span>}>
          <table className="table">
            <thead>
              <tr><th>Buyer</th><th>Type</th><th>Shared categories</th><th className="num">Similarity</th></tr>
            </thead>
            <tbody>
              {similar.map((s) => (
                <tr key={s.entityId} className="row" onClick={() => navigate(`/buyers/${s.entityId}`)}>
                  <td><span className="t-title">{s.entityName}</span></td>
                  <td><span className="pill soft">{entityTypeLabel(s.entityType)}</span></td>
                  <td><Chips items={s.sharedCategories} kind="category" /></td>
                  <td className="num">{Math.round(s.score * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
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
