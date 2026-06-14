import type { FetchContext } from '@mn/core';
import { makeBrowserFetch } from './browser-fetch.js';
import { makeStaticFetch } from './static-fetch.js';

export interface FetchContextOptions {
  /** Include a Playwright-backed `fetchBrowser`. Default true. */
  enableBrowser?: boolean;
  /** Injectable clock (tests). Default: real time. */
  now?: () => string;
  /** Log sink. Default: console.log with a connector prefix. */
  log?: (message: string) => void;
}

/** Build the real fetch capabilities handed to a connector at runtime. */
export function createFetchContext(connectorId: string, opts: FetchContextOptions = {}): FetchContext {
  const now = opts.now ?? (() => new Date().toISOString());
  const log = opts.log ?? ((m: string) => console.log(`[${connectorId}] ${m}`));
  const ctx: FetchContext = {
    fetchStatic: makeStaticFetch(connectorId, now),
    now,
    log,
  };
  if (opts.enableBrowser !== false) {
    ctx.fetchBrowser = makeBrowserFetch(connectorId, now);
  }
  return ctx;
}

export { closeBrowser } from './browser-fetch.js';
