import type { RawDocument } from '@mn/core';
import { sha256 } from './hash.js';
import { extractPdfText } from './pdf.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Fetch a PDF and return its extracted text as a RawDocument (body = text). */
export function makePdfFetch(connectorId: string, now: () => string) {
  return async function fetchPdf(url: string): Promise<RawDocument> {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'application/pdf,*/*' },
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new Error(`pdf fetch ${url} → HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const { text, pages } = await extractPdfText(bytes);
    return {
      connectorId,
      url: res.url || url,
      fetchedAt: now(),
      contentType: 'application/pdf',
      body: `<!-- pdf:${pages}pages -->\n${text}`,
      sha256: sha256(text),
      httpStatus: res.status,
    };
  };
}
