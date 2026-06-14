import type { BrowserFetchOptions, RawDocument } from '@mn/core';
import { type Browser, chromium } from 'playwright';
import { sha256 } from './hash.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
  }
  return browserPromise;
}

/** Dispose the shared browser. Call once at end of a run. */
export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}

/**
 * Render a page with a real Chromium and capture the final HTML. For JS-rendered
 * (PeopleSoft) or bot-protected sources. The launched browser is shared and reused;
 * each fetch gets its own incognito context.
 */
export function makeBrowserFetch(connectorId: string, now: () => string) {
  return async function fetchBrowser(
    url: string,
    opts: BrowserFetchOptions = {},
  ): Promise<RawDocument> {
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1366, height: 900 },
      locale: 'en-US',
      timezoneId: 'America/Chicago',
    });
    // Light fingerprint cleanup — drop the headless `navigator.webdriver` tell.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await context.newPage();
    const timeout = opts.timeoutMs ?? 45_000;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      if (opts.waitForSelector) {
        await page.waitForSelector(opts.waitForSelector, { timeout }).catch(() => {});
      }
      if (opts.settleMs) {
        await page.waitForTimeout(opts.settleMs);
      } else {
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      }
      const body = await page.content();
      return {
        connectorId,
        url: page.url(),
        fetchedAt: now(),
        contentType: 'text/html',
        body,
        sha256: sha256(body),
        httpStatus: 200,
      };
    } finally {
      await context.close();
    }
  };
}
