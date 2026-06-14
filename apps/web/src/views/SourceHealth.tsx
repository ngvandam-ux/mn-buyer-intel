import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api.ts';
import { Card, EmptyState, ErrorState, Loading, entityTypeLabel, fmtDateTime } from '../components/ui.tsx';

function jobPill(status: string | undefined) {
  if (!status) return <span className="pill soft">never run</span>;
  const cls = status === 'success' ? 'status-open' : status === 'error' ? 'status-closed' : status === 'partial' ? 'status-upcoming' : 'soft';
  return <span className={`pill ${cls}`}>{status}</span>;
}

export function SourceHealth() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const sources = useQuery({ queryKey: ['sources'], queryFn: api.sources });
  const jobs = useQuery({ queryKey: ['refreshJobs'], queryFn: () => api.refreshJobs(40) });
  const review = useQuery({ queryKey: ['reviewQueue'], queryFn: api.reviewQueue });

  const refresh = useMutation({
    mutationFn: (id: string) => api.refresh(id),
    onMutate: (id) => setBusy(id),
    onSettled: () => {
      setBusy(null);
      qc.invalidateQueries({ queryKey: ['sources'] });
      qc.invalidateQueries({ queryKey: ['refreshJobs'] });
    },
  });

  return (
    <div className="stack">
      <Card title="Source connectors" right={<span className="t-sub">live fetch hits the real public sources</span>}>
        {sources.isLoading ? (
          <Loading what="sources" />
        ) : sources.error ? (
          <ErrorState error={sources.error} />
        ) : (
          <table className="table">
            <thead>
              <tr><th>Source</th><th>Mode</th><th>Status</th><th>Last run</th><th className="num">Upserted</th><th></th></tr>
            </thead>
            <tbody>
              {(sources.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="t-title">{s.sourceName}</span>
                    <div className="t-sub">{s.description}</div>
                    <div className="t-sub">{entityTypeLabel(s.entityHint)} · <a href={s.url} target="_blank" rel="noreferrer">{s.id}</a></div>
                  </td>
                  <td>
                    <span className="pill soft">{s.fetchMode}</span>
                    {!s.live && <div className="t-sub" style={{ marginTop: 4 }}>scaffold</div>}
                  </td>
                  <td>{jobPill(s.lastJob?.status)}{s.lastJob?.error && <div className="t-sub" style={{ color: 'var(--danger)' }}>{s.lastJob.error.slice(0, 80)}</div>}</td>
                  <td>{s.lastJob ? fmtDateTime(s.lastJob.finishedAt ?? s.lastJob.startedAt) : '—'}</td>
                  <td className="num">{s.lastJob?.recordsUpserted ?? '—'}</td>
                  <td>
                    <button className="btn sm" disabled={busy !== null} onClick={() => refresh.mutate(s.id)}>
                      {busy === s.id ? 'Refreshing…' : 'Refresh'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid cols-2">
        <Card title="Refresh log">
          <div className="card-body">
            {jobs.isLoading ? (
              <Loading what="jobs" />
            ) : !jobs.data || jobs.data.length === 0 ? (
              <EmptyState>No refresh jobs yet. Data was seeded from committed fixtures.</EmptyState>
            ) : (
              <table className="table">
                <thead><tr><th>Connector</th><th>Status</th><th>When</th><th className="num">Parsed</th></tr></thead>
                <tbody>
                  {jobs.data.map((j) => (
                    <tr key={j.id}>
                      <td>{j.connectorId}</td>
                      <td>{jobPill(j.status)}</td>
                      <td>{fmtDateTime(j.finishedAt ?? j.startedAt ?? j.createdAt)}</td>
                      <td className="num">{j.extractionsParsed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card title="Admin review queue" right={<span className="t-sub">low-confidence extractions</span>}>
          <div className="card-body stack">
            {review.isLoading ? (
              <Loading what="review queue" />
            ) : (
              <>
                <div className="inline">
                  <span className="pill status-upcoming">{review.data?.opportunities.length ?? 0} opportunities</span>
                  <span className="pill status-upcoming">{review.data?.contacts.length ?? 0} contacts</span>
                </div>
                {(review.data?.opportunities.length ?? 0) === 0 && (review.data?.contacts.length ?? 0) === 0 ? (
                  <EmptyState>Nothing awaiting review — all extractions are above the confidence threshold.</EmptyState>
                ) : (
                  <div className="stack">
                    {(review.data?.opportunities ?? []).slice(0, 10).map((o) => (
                      <div key={o.id} className="row-between">
                        <span className="t-title">{o.title}</span>
                        <span className="t-sub">{Math.round(o.confidence * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
