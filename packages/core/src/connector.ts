/**
 * The connector contract. One module per source implements this. The fetch
 * capabilities are injected via {@link FetchContext} so connectors stay pure and
 * testable — the Playwright/undici machinery lives in `@mn/connectors`, never here.
 */

import type { EntityType } from './taxonomy.js';
import type { Extraction, RawDocument } from './evidence.js';

export interface SourceMeta {
  /** Stable connector id, e.g. `mn-osp-solicitations`. Also the fixtures/ folder name. */
  id: string;
  /** Human-readable source name. */
  sourceName: string;
  /** Canonical landing/listing URL for the source. */
  url: string;
  /** Jurisdiction code — `MN` today; other states reuse the schema unchanged. */
  jurisdiction: string;
  /** Default entity type for records from this source (may be overridden per-record). */
  entityHint: EntityType;
  /** Whether the source can be read with plain HTTP or needs a real browser. */
  fetchMode: 'static' | 'browser';
  /** Short description for the Source Health view. */
  description?: string;
  /** When false, the connector is a scaffold: implemented but not yet parsing real data. */
  live: boolean;
}

export interface StaticFetchInit {
  headers?: Record<string, string>;
  /** Milliseconds. */
  timeoutMs?: number;
}

export interface BrowserFetchOptions {
  /** CSS selector to wait for before capturing, e.g. a results table. */
  waitForSelector?: string;
  /** Extra settle time in ms after load. */
  settleMs?: number;
  timeoutMs?: number;
}

/**
 * Capabilities handed to a connector at fetch time. Tests pass fakes; production passes
 * the real undici/Playwright-backed implementations from `@mn/connectors`.
 */
export interface FetchContext {
  fetchStatic(url: string, init?: StaticFetchInit): Promise<RawDocument>;
  /** Present only when a browser runtime is available. Scaffolds must degrade gracefully. */
  fetchBrowser?(url: string, opts?: BrowserFetchOptions): Promise<RawDocument>;
  /** Injectable clock for deterministic tests. Returns an ISO-8601 string. */
  now(): string;
  log(message: string): void;
}

export interface SourceConnector {
  meta: SourceMeta;
  /** Fetch one or more raw documents from the source. */
  fetch(ctx: FetchContext): Promise<RawDocument[]>;
  /** Parse a raw document into structured extractions with evidence. */
  parse(raw: RawDocument): Promise<Extraction[]> | Extraction[];
}
