export interface HourlyDataPoint {
  hour: string;
  count: number;
}

export interface HourlyResponse {
  data: HourlyDataPoint[];
  totalVisits24h: number;
}

export interface StatsResponse {
  totalTreesPlanted: number;
  totalCustomers: number;
  totalVisits: number;
}

export interface ConfigResponse {
  visitsPerTree: number;
}

export interface CustomerResponse {
  customerId: string;
  totalVisits: number;
  treesPlanted: number;
  lastSeen: string;
  visitsUntilNextTree: number;
}
