/**
 * The evidence model — the backbone of the "no fabricated data" guarantee.
 *
 * A connector `fetch()` produces {@link RawDocument}s (stored verbatim). Its `parse()`
 * produces {@link Extraction}s, each carrying the {@link EvidenceSpan}s that justify
 * its fields. Ingestion persists both, so every normalized field traces back to an exact
 * snippet in a captured source document.
 */

import type { ExtractionKind } from './taxonomy.js';

/** A captured source response, stored verbatim for auditing. */
export interface RawDocument {
  /** Connector that produced this document, e.g. `mn-osp-solicitations`. */
  connectorId: string;
  /** The exact URL fetched. */
  url: string;
  /** ISO-8601 capture time. */
  fetchedAt: string;
  /** e.g. `text/html`, `application/json`. */
  contentType: string;
  /** Raw response body (HTML / JSON / text), unmodified. */
  body: string;
  /** SHA-256 hex of `body`, for change detection + dedupe. */
  sha256: string;
  /** Optional HTTP status, for diagnostics. */
  httpStatus?: number;
}

/**
 * A pointer from an extracted field back to the precise place it came from.
 * `locator` is a connector-defined address: a CSS selector, an XPath, a JSON path
 * (`json:$.events[3].title`), or a character range (`offset:120-180`).
 */
export interface EvidenceSpan {
  locator: string;
  rawSnippet: string;
  extractedAt: string;
}

/**
 * One structured record parsed from a {@link RawDocument}.
 * `fields` is intentionally loose at the connector boundary; ingestion validates and
 * maps it onto the typed domain models.
 */
export interface Extraction {
  kind: ExtractionKind;
  fields: Record<string, unknown>;
  /** Evidence justifying this extraction. At least one span is expected for real data. */
  evidence: EvidenceSpan[];
  /** Extractor confidence, 0..1. */
  confidence: number;
  /** True when required fields are missing but a partial record is still useful. */
  partial: boolean;
}

/** Helper: build an EvidenceSpan with a single timestamp. */
export function evidenceSpan(locator: string, rawSnippet: string, extractedAt: string): EvidenceSpan {
  return { locator, rawSnippet, extractedAt };
}
