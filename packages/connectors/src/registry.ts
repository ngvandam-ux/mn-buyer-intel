/**
 * The connector registry. Register every source here; ingestion and the Source Health
 * view enumerate this list.
 */

import type { SourceConnector } from '@mn/core';
import { metroCountiesConnector } from './sources/metro-counties.js';
import { mmbBudgetConnector } from './sources/mmb-budget.js';
import { orgChartsConnector } from './sources/org-charts.js';
import { minnstateConnector } from './sources/minnstate.js';
import { ospContactsConnector } from './sources/osp-contacts.js';
import { ospSolicitationsConnector } from './sources/osp-solicitations.js';
import {
  metroCouncilConnector,
  mndotConnector,
  nationalGuardConnector,
} from './sources/scaffolds.js';
import { sourcewellConnector } from './sources/sourcewell.js';
import { supplierPortalConnector } from './sources/supplier-portal.js';
import { umnConnector } from './sources/umn.js';

export { metroCountiesConnector } from './sources/metro-counties.js';
export { mmbBudgetConnector } from './sources/mmb-budget.js';
export { orgChartsConnector } from './sources/org-charts.js';
export { minnstateConnector } from './sources/minnstate.js';
export { ospContactsConnector } from './sources/osp-contacts.js';
export { ospSolicitationsConnector } from './sources/osp-solicitations.js';
export {
  metroCouncilConnector,
  mndotConnector,
  nationalGuardConnector,
} from './sources/scaffolds.js';
export { sourcewellConnector } from './sources/sourcewell.js';
export { supplierPortalConnector } from './sources/supplier-portal.js';
export { umnConnector } from './sources/umn.js';

export const CONNECTORS: SourceConnector[] = [
  supplierPortalConnector,
  sourcewellConnector,
  ospSolicitationsConnector,
  ospContactsConnector,
  minnstateConnector,
  umnConnector,
  mmbBudgetConnector,
  metroCountiesConnector,
  orgChartsConnector,
  mndotConnector,
  metroCouncilConnector,
  nationalGuardConnector,
];

const BY_ID = new Map(CONNECTORS.map((c) => [c.meta.id, c]));

export function getConnector(id: string): SourceConnector | undefined {
  return BY_ID.get(id);
}

export function liveConnectors(): SourceConnector[] {
  return CONNECTORS.filter((c) => c.meta.live);
}
