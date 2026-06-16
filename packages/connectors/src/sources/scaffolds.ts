/**
 * Second-wave source scaffolds. Each implements the full `SourceConnector` interface and
 * fetches its page, but `parse()` returns no extractions until a fixture is captured and a
 * real parser is written (see CLAUDE.md → "Adding a connector"). Scaffolds never throw, so
 * the registry and ingest loop stay green while coverage grows.
 */

import type { EntityType, Extraction, FetchContext, RawDocument, SourceConnector } from '@mn/core';

interface ScaffoldSpec {
  id: string;
  sourceName: string;
  url: string;
  entityHint: EntityType;
  description: string;
}

function makeScaffold(spec: ScaffoldSpec): SourceConnector {
  return {
    meta: {
      id: spec.id,
      sourceName: spec.sourceName,
      url: spec.url,
      jurisdiction: 'MN',
      entityHint: spec.entityHint,
      fetchMode: 'static',
      description: spec.description,
      live: false,
    },
    async fetch(ctx: FetchContext): Promise<RawDocument[]> {
      try {
        return [await ctx.fetchStatic(spec.url)];
      } catch (err) {
        ctx.log(`scaffold fetch failed (non-fatal): ${String(err).slice(0, 120)}`);
        return [];
      }
    },
    parse(_raw: RawDocument): Extraction[] {
      // No parser yet — capture a fixture and implement extraction to promote to live.
      return [];
    },
  };
}

export const nationalGuardConnector = makeScaffold({
  id: 'mn-natl-guard',
  sourceName: 'MN National Guard / Military Affairs',
  url: 'https://mn.gov/mnsmb/',
  entityHint: 'military_national_guard',
  description: 'Minnesota National Guard / Dept. of Military Affairs budget & priorities (second-wave).',
});
