import { ref, onMounted, onUnmounted } from 'vue';
import { apiFetch } from '../lib/api';
import type {
  HourlyResponse,
  StatsResponse,
  ConfigResponse,
  CustomerListItem,
  CustomersListResponse,
  RecentScan,
  RecentScansResponse,
} from '../types/api';

export type { CustomerListItem, RecentScan };
export const POLL_INTERVAL_MS = 10_000;

export type ConnectionStatus = 'connected' | 'reconnecting' | 'error';

interface LiveStatsResponse {
  realVisits24h: number;
  realDevices: number;
  realTrees: number;
}

export function useVisitsData() {
  const totalVisits24h = ref(0);
  const totalTreesPlanted = ref(0);
  const totalCustomers = ref(0);
  const totalVisits = ref(0);
  const visitsPerTree = ref(10);
  const customers = ref<CustomerListItem[]>([]);
  const recentScans = ref<RecentScan[]>([]);
  const demoScans = ref<RecentScan[]>([]);
  const liveVisits24h = ref(0);
  const liveDevices = ref(0);
  const liveTrees = ref(0);
  const isLoading = ref(true);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  const connectionStatus = ref<ConnectionStatus>('connected');

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let failCount = 0;

  async function fetchData() {
    try {
      const [hourly, stats, config, customerList, recent, liveStats, demoFeed] = await Promise.all([
        apiFetch<HourlyResponse>('/api/v1/visits/hourly'),
        apiFetch<StatsResponse>('/api/v1/stats'),
        apiFetch<ConfigResponse>('/api/v1/config'),
        apiFetch<CustomersListResponse>('/api/v1/customers'),
        apiFetch<RecentScansResponse>('/api/v1/visits/recent?filter=real'),
        apiFetch<LiveStatsResponse>('/api/v1/stats/live'),
        apiFetch<RecentScansResponse>('/api/v1/visits/recent?filter=demo'),
      ]);

      totalVisits24h.value = hourly.totalVisits24h;
      totalTreesPlanted.value = stats.totalTreesPlanted;
      totalCustomers.value = stats.totalCustomers;
      totalVisits.value = stats.totalVisits;
      visitsPerTree.value = config.visitsPerTree;
      customers.value = customerList.customers;
      recentScans.value = recent.scans;
      demoScans.value = demoFeed.scans;
      liveVisits24h.value = liveStats.realVisits24h;
      liveDevices.value = liveStats.realDevices;
      liveTrees.value = liveStats.realTrees;
      error.value = null;
      lastUpdated.value = new Date();
      failCount = 0;
      connectionStatus.value = 'connected';
    } catch (err) {
      failCount++;
      error.value = err instanceof Error ? err.message : 'Unknown error';
      connectionStatus.value = failCount >= 3 ? 'error' : 'reconnecting';
    } finally {
      isLoading.value = false;
    }
  }

  onMounted(() => {
    fetchData();
    intervalId = setInterval(fetchData, POLL_INTERVAL_MS);
  });

  onUnmounted(() => {
    if (intervalId !== null) clearInterval(intervalId);
  });

  return {
    totalVisits24h,
    totalTreesPlanted,
    totalCustomers,
    totalVisits,
    visitsPerTree,
    customers,
    recentScans,
    demoScans,
    liveVisits24h,
    liveDevices,
    liveTrees,
    isLoading,
    error,
    lastUpdated,
    connectionStatus,
    refresh: fetchData,
  };
}
