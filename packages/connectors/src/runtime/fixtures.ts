/**
 * Read committed fixtures. Used by parser tests and by the offline seed path (parse the
 * latest captured snapshot without hitting the network).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RawDocument } from '@mn/core';
import { parseFixtureTimestamp } from './dates.js';
import { sha256 } from './hash.js';

// src/runtime → up 4 → repo root (same depth from dist/runtime).
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

export function fixturesRoot(): string {
  return resolve(REPO_ROOT, 'fixtures');
}

export interface FixtureFile {
  path: string;
  name: string;
  body: string;
  capturedAt: string | null;
}

/** Newest committed fixture for a connector, or null if none exists. */
export function latestFixture(connectorId: string): FixtureFile | null {
  const dir = resolve(fixturesRoot(), connectorId);
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.html') || f.endsWith('.json') || f.endsWith('.txt'))
    .sort();
  const name = files.at(-1);
  if (!name) return null;
  const path = resolve(dir, name);
  return { path, name, body: readFileSync(path, 'utf8'), capturedAt: parseFixtureTimestamp(name) };
}

const isFixture = (f: string) => f.endsWith('.html') || f.endsWith('.json') || f.endsWith('.txt');
const contentTypeFor = (path: string) =>
  path.endsWith('.json') ? 'application/json' : path.endsWith('.txt') ? 'text/plain' : 'text/html';

/** All committed fixtures for a connector (multiple agencies/counties), oldest→newest. */
export function allFixtures(connectorId: string): FixtureFile[] {
  const dir = resolve(fixturesRoot(), connectorId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(isFixture)
    .sort()
    .map((name) => {
      const path = resolve(dir, name);
      return { path, name, body: readFileSync(path, 'utf8'), capturedAt: parseFixtureTimestamp(name) };
    });
}

/** Every fixture for a connector as RawDocuments — for multi-document offline ingest. */
export function fixtureDocsForConnector(connectorId: string, url: string): RawDocument[] {
  return allFixtures(connectorId).map((f) => ({
    connectorId,
    url,
    fetchedAt: f.capturedAt ?? new Date().toISOString(),
    contentType: contentTypeFor(f.path),
    body: f.body,
    sha256: sha256(f.body),
  }));
}

/** Build a RawDocument from the newest fixture, for offline parsing. */
export function fixtureAsRawDocument(connectorId: string, url: string): RawDocument | null {
  const f = latestFixture(connectorId);
  if (!f) return null;
  return {
    connectorId,
    url,
    fetchedAt: f.capturedAt ?? new Date().toISOString(),
    contentType: f.path.endsWith('.json')
      ? 'application/json'
      : f.path.endsWith('.txt')
        ? 'text/plain'
        : 'text/html',
    body: f.body,
    sha256: sha256(f.body),
  };
}
