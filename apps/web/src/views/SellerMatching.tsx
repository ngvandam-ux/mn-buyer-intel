import type { MatchResults, MatchView } from '@mn/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { type SellerInputBody, api } from '../api.ts';
import {
  Card,
  EmptyState,
  EvidenceChain,
  Reasons,
  ScoreBar,
  TierPill,
  entityTypeLabel,
} from '../components/ui.tsx';

const parseList = (s: string): string[] => s.split(',').map((x) => x.trim()).filter(Boolean);
const toStr = (a: string[] | undefined): string => (a ?? []).join(', ');

interface FormState {
  companyName: string;
  capabilities: string;
  services: string;
  products: string;
  keywords: string;
  certifications: string;
  geographies: string;
  categories: string[];
}

const EMPTY: FormState = {
  companyName: '',
  capabilities: '',
  services: '',
  products: '',
  keywords: '',
  certifications: '',
  geographies: 'statewide',
  categories: [],
};

function formToBody(f: FormState): SellerInputBody {
  return {
    companyName: f.companyName.trim() || 'Untitled profile',
    capabilities: parseList(f.capabilities),
    services: parseList(f.services),
    products: parseList(f.products),
    keywords: parseList(f.keywords),
    certifications: parseList(f.certifications),
    geographies: parseList(f.geographies),
    categories: f.categories,
  };
}

export function SellerMatching() {
  const qc = useQueryClient();
  const profiles = useQuery({ queryKey: ['sellerProfiles'], queryFn: api.sellerProfiles });
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [results, setResults] = useState<MatchResults | null>(null);
  const [tab, setTab] = useState<'opportunities' | 'buyers'>('opportunities');
  const [loadError, setLoadError] = useState<string | null>(null);
  const latestReq = useRef<string | null>(null);

  // Auto-select the first saved profile once loaded.
  useEffect(() => {
    if (selectedId === null && profiles.data && profiles.data.length > 0) {
      selectProfile(profiles.data[0]!.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles.data]);

  async function selectProfile(id: string) {
    setSelectedId(id);
    setLoadError(null);
    latestReq.current = id;
    try {
      const p = await api.sellerProfile(id);
      if (latestReq.current !== id) return; // a newer selection superseded this one
      setForm({
        companyName: p.companyName,
        capabilities: toStr(p.capabilities),
        services: toStr(p.services),
        products: toStr(p.products),
        keywords: toStr(p.keywords),
        certifications: toStr(p.certifications),
        geographies: toStr(p.geographies),
        categories: p.categories ?? [],
      });
      const m = await api.sellerMatches(id);
      if (latestReq.current !== id) return;
      setResults(m);
    } catch (err) {
      if (latestReq.current === id) setLoadError(err instanceof Error ? err.message : String(err));
    }
  }

  function newProfile() {
    setSelectedId(null);
    setForm(EMPTY);
    setResults(null);
    setLoadError(null);
    latestReq.current = null;
  }

  const preview = useMutation({
    mutationFn: () => api.previewMatches(formToBody(form)),
    onSuccess: (r) => setResults(r),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = formToBody(form);
      const saved = selectedId ? await api.updateSeller(selectedId, body) : await api.createSeller(body);
      const m = await api.sellerMatches(saved.id);
      return { saved, m };
    },
    onSuccess: ({ saved, m }) => {
      setSelectedId(saved.id);
      setResults(m);
      qc.invalidateQueries({ queryKey: ['sellerProfiles'] });
    },
  });

  const del = useMutation({
    mutationFn: () => api.deleteSeller(selectedId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sellerProfiles'] });
      newProfile();
    },
  });

  const toggleCategory = (key: string) =>
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(key) ? f.categories.filter((c) => c !== key) : [...f.categories, key],
    }));

  const matches = results ? (tab === 'opportunities' ? results.opportunityMatches : results.entityMatches) : [];

  return (
    <div className="grid" style={{ gridTemplateColumns: '380px 1fr', gap: 18, alignItems: 'start' }}>
      {/* ---- profile editor ---- */}
      <div className="stack">
        <Card title="Seller profiles">
          <div className="card-body stack">
            <select value={selectedId ?? 'new'} onChange={(e) => (e.target.value === 'new' ? newProfile() : selectProfile(e.target.value))}>
              <option value="new">+ New profile</option>
              {(profiles.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.companyName}</option>
              ))}
            </select>
          </div>
        </Card>

        <Card title={selectedId ? 'Edit profile' : 'New profile'}>
          <div className="card-body stack">
            <Field label="Company name">
              <input type="text" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Acme Fiber Co." />
            </Field>
            <Field label="Capabilities (comma-separated)">
              <input type="text" value={form.capabilities} onChange={(e) => setForm({ ...form, capabilities: e.target.value })} placeholder="fiber installation, network design" />
            </Field>
            <Field label="Services">
              <input type="text" value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} />
            </Field>
            <Field label="Products">
              <input type="text" value={form.products} onChange={(e) => setForm({ ...form, products: e.target.value })} />
            </Field>
            <Field label="Keywords">
              <input type="text" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="broadband, wan, cabling" />
            </Field>
            <Field label="Certifications">
              <input type="text" value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} placeholder="Targeted Group Business" />
            </Field>
            <Field label="Geographies (counties/cities, or 'statewide')">
              <input type="text" value={form.geographies} onChange={(e) => setForm({ ...form, geographies: e.target.value })} />
            </Field>
            <Field label="Categories">
              <div className="chips" style={{ marginTop: 4 }}>
                {(categories.data ?? []).map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={`chip ${form.categories.includes(c.key) ? '' : ''}`}
                    style={form.categories.includes(c.key) ? { background: 'var(--accent-soft)', color: 'var(--brand-ink)', borderColor: '#bcd3ff' } : {}}
                    onClick={() => toggleCategory(c.key)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="inline" style={{ marginTop: 6 }}>
              <button className="btn primary" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? 'Saving…' : selectedId ? 'Save & rematch' : 'Create & match'}
              </button>
              <button className="btn" disabled={preview.isPending} onClick={() => preview.mutate()}>
                {preview.isPending ? 'Matching…' : 'Preview (no save)'}
              </button>
              {selectedId && (
                <button className="btn danger sm" onClick={() => del.mutate()}>Delete</button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* ---- results ---- */}
      <div className="stack">
        <Card
          title="Ranked matches"
          right={
            results ? (
              <div className="inline">
                <button className={`btn sm ${tab === 'opportunities' ? 'primary' : ''}`} onClick={() => setTab('opportunities')}>
                  Opportunities ({results.opportunityMatches.length})
                </button>
                <button className={`btn sm ${tab === 'buyers' ? 'primary' : ''}`} onClick={() => setTab('buyers')}>
                  Buyers ({results.entityMatches.length})
                </button>
              </div>
            ) : null
          }
        >
          <div className="card-body stack">
            {(loadError || preview.error || save.error) && (
              <div style={{ color: 'var(--danger)', fontSize: 13 }}>
                {loadError ?? (preview.error ?? save.error)?.toString()}
              </div>
            )}
            {!results ? (
              <EmptyState>Pick a profile or fill the form, then “Preview” or “Create &amp; match”.</EmptyState>
            ) : matches.length === 0 ? (
              <EmptyState>No {tab} matched. Try broader categories or keywords.</EmptyState>
            ) : (
              matches.map((m) => <MatchCard key={`${m.targetType}-${m.targetId}`} m={m} />)
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field" style={{ width: '100%' }}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function MatchCard({ m }: { m: MatchView }) {
  const [open, setOpen] = useState(false);
  const isOpp = m.targetType === 'opportunity';
  const title = isOpp ? m.opportunity?.title ?? 'Opportunity' : m.entity?.name ?? 'Buyer';
  const link = isOpp ? `/opportunities/${m.targetId}` : `/buyers/${m.targetId}`;
  const sub = isOpp
    ? m.opportunity?.entityName ?? ''
    : m.entity
      ? entityTypeLabel(m.entity.entityType)
      : '';

  return (
    <div className="match">
      <div className="row-between">
        <div>
          <Link to={link} className="mt">{title}</Link>
          {sub && <div className="t-sub">{sub}</div>}
        </div>
        <div className="inline">
          <TierPill tier={m.tier} />
          <ScoreBar score={m.score} />
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <Reasons reasons={m.reasons} />
      </div>
      {m.evidence.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button className="btn sm" onClick={() => setOpen(!open)}>
            {open ? 'Hide' : 'Show'} evidence ({m.evidence.length})
          </button>
          {open && (
            <div style={{ marginTop: 10 }}>
              <EvidenceChain evidence={m.evidence} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
