/** Typed API client. Shapes come from @mn/core so the whole stack shares one contract. */

import type {
  Category,
  ContactListItem,
  DashboardDTO,
  EntityDetail,
  EntityListItem,
  EvidenceRef,
  MatchResults,
  OpportunityDetail,
  OpportunityListItem,
  RefreshJob,
  SellerProfile,
  SignalListItem,
  SourceHealth,
} from '@mn/core';

import { UNAUTHORIZED_EVENT, authHeader, clearCreds } from './auth.ts';

// Prod build points at the Fly API via VITE_API_URL; dev uses '' + the Vite proxy.
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

function handleStatus(res: Response, path: string): void {
  if (res.status === 401) {
    clearCreds();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new Error('Unauthorized — please sign in again.');
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { headers: { accept: 'application/json', ...authHeader() } });
  handleStatus(res, path);
  return res.json() as Promise<T>;
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', accept: 'application/json', ...authHeader() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  handleStatus(res, path);
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | undefined>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export interface SellerInputBody {
  companyName: string;
  capabilities?: string[];
  services?: string[];
  products?: string[];
  keywords?: string[];
  certifications?: string[];
  categories?: string[];
  geographies?: string[];
  notes?: string | null;
}

export const api = {
  dashboard: () => get<DashboardDTO>('/api/dashboard'),

  entities: (f: { type?: string; q?: string; category?: string } = {}) =>
    get<EntityListItem[]>(`/api/entities${qs(f)}`),
  entity: (id: string) => get<EntityDetail>(`/api/entities/${id}`),

  opportunities: (f: { status?: string; category?: string; q?: string; entityType?: string; source?: string } = {}) =>
    get<OpportunityListItem[]>(`/api/opportunities${qs(f)}`),
  opportunity: (id: string) => get<OpportunityDetail>(`/api/opportunities/${id}`),

  contacts: (f: { q?: string; entityId?: string } = {}) => get<ContactListItem[]>(`/api/contacts${qs(f)}`),
  signals: (f: { type?: string; q?: string; entityId?: string } = {}) => get<SignalListItem[]>(`/api/signals${qs(f)}`),
  categories: () => get<Array<Category & { count: number }>>('/api/categories'),

  sources: () => get<SourceHealth[]>('/api/sources'),
  refreshJobs: (limit = 50) => get<RefreshJob[]>(`/api/refresh-jobs${qs({ limit })}`),
  reviewQueue: () => get<{ opportunities: OpportunityListItem[]; contacts: ContactListItem[] }>('/api/review-queue'),
  refresh: (connectorId: string) => send<unknown>('POST', `/api/refresh/${connectorId}`),

  sellerProfiles: () => get<SellerProfile[]>('/api/seller-profiles'),
  sellerProfile: (id: string) => get<SellerProfile>(`/api/seller-profiles/${id}`),
  createSeller: (body: SellerInputBody) => send<SellerProfile>('POST', '/api/seller-profiles', body),
  updateSeller: (id: string, body: SellerInputBody) => send<SellerProfile>('PUT', `/api/seller-profiles/${id}`, body),
  deleteSeller: (id: string) => send<{ ok: boolean }>('DELETE', `/api/seller-profiles/${id}`),
  sellerMatches: (id: string) => get<MatchResults>(`/api/seller-profiles/${id}/matches`),
  previewMatches: (body: SellerInputBody) => send<MatchResults>('POST', '/api/match/preview', body),

  evidence: (targetId: string) => get<EvidenceRef[]>(`/api/evidence/${targetId}`),
};
