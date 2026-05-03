export interface StatsResponse {
  totalTreesPlanted: number;
  totalCustomers: number;
  totalVisits: number;
}

export interface LiveStatsResponse {
  realVisits24h: number;
  realDevices: number;
  realTrees: number;
}

export interface ConfigResponse {
  visitsPerTree: number;
}

export interface CustomerListItem {
  customerId: string;
  totalVisits: number;
  treesPlanted: number;
  lastSeen: string;
  visitsUntilNextTree: number;
}

/** @deprecated Use CustomerListItem */
export type CustomerResponse = CustomerListItem;

export interface CustomersListResponse {
  customers: CustomerListItem[];
}

export interface VisitResponse {
  customerId: string;
  totalVisits: number;
  treesPlanted: number;
  treeEarned: boolean;
  lastSeen: string;
}

export interface TrackResult {
  customerId: string;
  totalVisits: number;
  treesPlanted: number;
  treeEarned: boolean;
  lastSeen: string;
  visitsUntilNextTree: number;
  visitsPerTree: number;
}

export interface DeviceInfo {
  type: string;
  os: string;
  browser: string;
  brand: string | null;
}

export interface RecentTrackedVisit {
  id: number;
  customerId: string;
  visitedAt: string;
  device: DeviceInfo;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  language: string | null;
}

export interface RecentVisitsResponse {
  visits: RecentTrackedVisit[];
}
