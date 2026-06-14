import type { RawDocument, StaticFetchInit } from '@mn/core';
import { sha256 } from './hash.js';

const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Plain HTTP fetch (Node global fetch) → RawDocument. For sources that serve static
 * HTML/JSON. Sets a desktop UA and a timeout; throws on non-2xx so the orchestrator can
 * record a failed refresh job.
 */
export function makeStaticFetch(connectorId: string, now: () => string) {
  return async function fetchStatic(url: string, init: StaticFetchInit = {}): Promise<RawDocument> {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': DEFAULT_UA,
        accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        ...init.headers,
      },
      signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
    });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`static fetch ${url} → HTTP ${res.status} (${body.length} bytes)`);
    }
    return {
      connectorId,
      url: res.url || url,
      fetchedAt: now(),
      contentType: res.headers.get('content-type') ?? 'text/html',
      body,
      sha256: sha256(body),
      httpStatus: res.status,
    };
  };
}
