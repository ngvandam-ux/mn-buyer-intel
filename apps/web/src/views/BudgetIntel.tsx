import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.ts';
import {
  Card,
  Chips,
  EmptyState,
  ErrorState,
  Loading,
  Stat,
  TrendPill,
  entityTypeLabel,
  fmtMoney,
} from '../components/ui.tsx';

export function BudgetIntel() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['budget'], queryFn: api.budget });

  if (isLoading) return <Loading what="budget intel" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  if (data.lines.length === 0) {
    return (
      <EmptyState>
        No budget intel ingested yet. Run <span className="kbd">pnpm ingest mn-mmb-budget</span> to pull MMB
        agency budget books, or it loads on the next deploy seed.
      </EmptyState>
    );
  }

  const maxCat = Math.max(1, ...data.totalsByCategory.map((c) => c.total));

  return (
    <div className="stack">
      <div className="grid cols-3">
        <Stat label="Tracked budget" value={fmtMoney(data.totalBudget)} hint="across ingested agency budget books" />
        <Stat label="Agencies" value={data.byEntity.length} hint="with budget intel" />
        <Stat label="Funded categories" value={data.totalsByCategory.length} hint="product/tech + others" />
      </div>

      <Card title="Budget exposure by category" right={<span className="t-sub">where the money is</span>}>
        <div className="card-body">
          <div className="hbars">
            {data.totalsByCategory.slice(0, 12).map((c) => (
              <div className="hbar" key={c.key}>
                <span className="lbl" title={c.label}>{c.label}</span>
                <div className="track">
                  <div className="fill" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                </div>
                <span className="cnt">{fmtMoney(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Agencies by funded budget">
        <table className="table">
          <thead>
            <tr><th>Agency</th><th className="num">Budget</th><th>Trend</th><th>Funded categories</th></tr>
          </thead>
          <tbody>
            {data.byEntity.map((e) => (
              <tr key={e.entityId} className="row" onClick={() => navigate(`/buyers/${e.entityId}`)}>
                <td>
                  <span className="t-title">{e.entityName}</span>
                  <div className="t-sub">{entityTypeLabel(e.entityType)}</div>
                </td>
                <td className="num"><strong>{fmtMoney(e.total)}</strong></td>
                <td><TrendPill delta={e.trendDelta} /></td>
                <td><Chips items={e.categoryKeys.slice(0, 6)} kind="category" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Budget lines" right={<span className="t-sub">{data.lines.length} lines</span>}>
        <table className="table">
          <thead>
            <tr><th>Program</th><th>Agency</th><th>Period</th><th className="num">Amount</th><th>Trend</th><th>Categories</th></tr>
          </thead>
          <tbody>
            {data.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  <span className="t-title">{l.program}</span>
                  {l.narrative && <div className="t-sub">{l.narrative.slice(0, 110)}…</div>}
                </td>
                <td>{l.entityName ?? '—'}</td>
                <td>{l.fiscalPeriod ?? '—'}</td>
                <td className="num">{fmtMoney(l.amount)}</td>
                <td><TrendPill delta={l.trendDelta} /></td>
                <td><Chips items={l.categoryKeys.slice(0, 5)} kind="category" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
