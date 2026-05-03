import { getDb } from '../db';
import { toISO } from '../utils/date';
import { getVisitsPerTree } from '../repositories/configRepository';
import {
  getCustomerById,
  incrementTreesPlanted,
  upsertCustomerVisit,
} from '../repositories/customerRepository';
import {
  enrichVisit as enrichVisitRow,
  insertVisit,
  type GeoEnrichment,
  type VisitMeta,
} from '../repositories/visitRepository';

export interface VisitResult {
  visitId: number;
  customerId: string;
  totalVisits: number;
  treesPlanted: number;
  treeEarned: boolean;
  lastSeen: string;
}

export type { VisitMeta };

export function registerVisit(customerId: string, meta?: VisitMeta): VisitResult {
  const db = getDb();

  const transaction = db.transaction((id: string): VisitResult => {
    upsertCustomerVisit(id, db);
    const visitId = insertVisit(id, meta, db);
    const customer = getCustomerById(id, db);

    if (!customer) throw new Error(`Customer ${id} not found after upsert`);

    const visitsPerTree = getVisitsPerTree(db);
    const treeEarned = customer.total_visits % visitsPerTree === 0;

    if (treeEarned) {
      incrementTreesPlanted(id, db);
    }

    return {
      visitId,
      customerId: id,
      totalVisits: customer.total_visits,
      treesPlanted: treeEarned ? customer.trees_planted + 1 : customer.trees_planted,
      treeEarned,
      lastSeen: toISO(customer.last_seen),
    };
  });

  return transaction(customerId);
}

// Enrich a visit record with geo + language data after the HTTP response
// has been sent. Called fire-and-forget so it never blocks the user.
export function enrichVisit(
  visitId: number,
  data: GeoEnrichment,
): void {
  enrichVisitRow(visitId, data);
}
