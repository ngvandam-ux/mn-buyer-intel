import {
  ENTITY_TYPE_LABELS,
  SIGNAL_TYPE_LABELS,
  type EvidenceRef,
  type MatchReason,
  categoryLabel,
} from '@mn/core';
import type { ReactNode } from 'react';

export const entityTypeLabel = (t: string) => ENTITY_TYPE_LABELS[t as keyof typeof ENTITY_TYPE_LABELS] ?? t;
export const signalTypeLabel = (t: string) => SIGNAL_TYPE_LABELS[t as keyof typeof SIGNAL_TYPE_LABELS] ?? t;
export { categoryLabel };

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function relativeDue(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return '';
  const days = Math.round((d - Date.now()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return 'today';
  return `in ${days}d`;
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill status-${status}`}>{status}</span>;
}

export function TierPill({ tier }: { tier: string }) {
  return <span className={`pill tier-${tier}`}>{tier} fit</span>;
}

const band = (n: number) => (n >= 70 ? 'high' : n >= 40 ? 'medium' : 'low');

export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="scorebox">
      <span className="n">{score}</span>
      <div className={`bar score-${band(score)}`} style={{ width: 90 }}>
        <span style={{ width: `${Math.min(100, score)}%` }} />
      </div>
    </div>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="scorebox" title={`confidence ${pct}%`}>
      <div className={`bar score-${band(pct)}`} style={{ width: 70 }}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="t-sub">{pct}%</span>
    </div>
  );
}

export function Chips({ items, kind }: { items: string[]; kind?: 'category' }) {
  if (!items.length) return <span className="t-sub">—</span>;
  return (
    <div className="chips">
      {items.map((c) => (
        <span key={c} className="chip">
          {kind === 'category' ? categoryLabel(c) : c}
        </span>
      ))}
    </div>
  );
}

export function Loading({ what = 'data' }: { what?: string }) {
  return <div className="loading">Loading {what}…</div>;
}

export function ErrorState({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="card pad">
      <div style={{ color: 'var(--danger)', fontWeight: 600 }}>Couldn’t load data</div>
      <div className="t-sub" style={{ marginTop: 6 }}>{msg}</div>
      <div className="t-sub" style={{ marginTop: 10 }}>
        Is the API running? Start it with <span className="kbd">pnpm dev:api</span>.
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Card({ title, right, children, pad }: { title?: string; right?: ReactNode; children: ReactNode; pad?: boolean }) {
  return (
    <div className="card">
      {title && (
        <div className="card-head">
          <h3>{title}</h3>
          {right}
        </div>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function HBars({ data, labelFn }: { data: Array<{ key: string; count: number }>; labelFn?: (k: string) => string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length) return <EmptyState>No data yet.</EmptyState>;
  return (
    <div className="hbars">
      {data.map((d) => (
        <div className="hbar" key={d.key}>
          <span className="lbl" title={labelFn ? labelFn(d.key) : d.key}>{labelFn ? labelFn(d.key) : d.key}</span>
          <div className="track">
            <div className="fill" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <span className="cnt">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

export function EvidenceChain({ evidence }: { evidence: EvidenceRef[] }) {
  if (!evidence.length) return <EmptyState>No evidence captured.</EmptyState>;
  return (
    <div className="evidence">
      {evidence.map((e) => (
        <div className="ev" key={e.id}>
          <div className="snip">“{e.rawSnippet}”</div>
          <div className="meta">
            <span className="loc">{e.field} · {e.locator}</span>
            <span>·</span>
            <span>{e.sourceConnectorId}</span>
            {e.sourceUrl && (
              <>
                <span>·</span>
                <a href={e.sourceUrl} target="_blank" rel="noreferrer">source ↗</a>
              </>
            )}
            <span className="spacer" />
            <span>captured {fmtDate(e.fetchedAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Reasons({ reasons }: { reasons: MatchReason[] }) {
  if (!reasons.length) return <span className="t-sub">No reasons.</span>;
  return (
    <div className="reasons">
      {reasons.map((r, i) => (
        <div className="reason" key={`${r.factor}-${i}`}>
          <span className="factor">{r.factor.replace(/_/g, ' ')}</span>
          <span className="txt">{r.reason}</span>
          <span className="pts">+{r.contribution}</span>
        </div>
      ))}
    </div>
  );
}
