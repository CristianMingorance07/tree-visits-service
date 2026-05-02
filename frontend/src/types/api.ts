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

export interface VisitResponse {
  customerId: string;
  totalVisits: number;
  treesPlanted: number;
  treeEarned: boolean;
  lastSeen: string;
}

export interface CustomerListItem {
  customerId: string;
  totalVisits: number;
  treesPlanted: number;
  lastSeen: string;
  visitsUntilNextTree: number;
}

export interface CustomersListResponse {
  customers: CustomerListItem[];
}

export interface DeviceInfo {
  type: string;   // 'mobile' | 'tablet' | 'desktop'
  os: string;
  browser: string;
  brand: string | null;
}

export interface RecentScan {
  id: number;
  customerId: string;
  visitedAt: string;
  device: DeviceInfo;
}

export interface RecentScansResponse {
  scans: RecentScan[];
}

export interface ScanResult {
  customerId: string;
  totalVisits: number;
  treesPlanted: number;
  treeEarned: boolean;
  lastSeen: string;
  visitsUntilNextTree: number;
  visitsPerTree: number;
}
