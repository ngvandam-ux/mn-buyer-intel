import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.ts';
import {
  Card,
  ErrorState,
  HBars,
  Loading,
  Stat,
  StatusPill,
  entityTypeLabel,
  fmtDate,
  fmtDateTime,
  relativeDue,
  signalTypeLabel,
} from '../components/ui.tsx';

export function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });

  if (isLoading) return <Loading what="dashboard" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const c = data.counts;
  const liveSources = data.sourceHealth.filter((s) => s.live).length;

  return (
    <div className="stack">
      <div className="grid cols-4">
        <Stat label="Buyers" value={c.entities} hint="public-sector entities" />
        <Stat label="Opportunities" value={c.opportunities} hint={`${c.openOpportunities} open now`} />
        <Stat label="Signals" value={c.signals} hint="buying signals tracked" />
        <Stat label="Contacts" value={c.contacts} hint="procurement contacts" />
      </div>

      <div className="grid cols-2">
        <Card title="Buyers by type">
          <div className="card-body">
            <HBars data={data.entitiesByType.map((e) => ({ key: e.entityType, count: e.count }))} labelFn={entityTypeLabel} />
          </div>
        </Card>
        <Card title="Top categories">
          <div className="card-body">
            <HBars data={data.topCategories.map((c2) => ({ key: c2.key, count: c2.count }))} labelFn={(k) => data.topCategories.find((x) => x.key === k)?.label ?? k} />
          </div>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title="Signals by type">
          <div className="card-body">
            <HBars data={data.signalsByType.map((s) => ({ key: s.signalType, count: s.count }))} labelFn={signalTypeLabel} />
          </div>
        </Card>
        <Card title="Opportunities by status">
          <div className="card-body">
            <HBars data={data.opportunitiesByStatus.map((s) => ({ key: s.status, count: s.count }))} />
          </div>
        </Card>
      </div>

      <Card
        title="Latest opportunities"
        right={<Link to="/opportunities" className="t-sub">View all →</Link>}
      >
        <table className="table">
          <thead>
            <tr>
              <th>Solicitation</th>
              <th>Buyer</th>
              <th>Status</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {data.recentOpportunities.map((o) => (
              <tr key={o.id} className="row" onClick={() => navigate(`/opportunities/${o.id}`)}>
                <td><span className="t-title">{o.title}</span></td>
                <td>{o.entityName ?? '—'}</td>
                <td><StatusPill status={o.status} /></td>
                <td>{fmtDate(o.dueDate)} <span className="t-sub">{relativeDue(o.dueDate)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card
        title="Source health"
        right={<Link to="/sources" className="t-sub">Details →</Link>}
      >
        <div className="card-body row-between">
          <div className="inline">
            <span className="pill status-open">{liveSources} live</span>
            <span className="pill soft">{data.sourceHealth.length - liveSources} scaffold</span>
            <span className="t-sub">across {data.sourceHealth.length} connectors</span>
          </div>
          <div className="t-sub">Last refresh: {data.lastRefresh ? fmtDateTime(data.lastRefresh) : 'seeded from fixtures'}</div>
        </div>
      </Card>
    </div>
  );
}
