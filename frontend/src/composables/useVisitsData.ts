import { ref, onMounted, onUnmounted } from 'vue';
import { apiFetch } from '../lib/api';
import type { HourlyDataPoint, HourlyResponse, StatsResponse, ConfigResponse } from '../types/api';

export type { HourlyDataPoint };
export const POLL_INTERVAL_MS = 10_000;

export type ConnectionStatus = 'connected' | 'reconnecting' | 'error';

export function useVisitsData() {
  const chartData = ref<HourlyDataPoint[]>([]);
  const totalVisits24h = ref(0);
  const totalTreesPlanted = ref(0);
  const totalCustomers = ref(0);
  const totalVisits = ref(0);
  const visitsPerTree = ref(10);
  const isLoading = ref(true);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  const connectionStatus = ref<ConnectionStatus>('connected');

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let failCount = 0;

  async function fetchData() {
    try {
      const [hourly, stats, config] = await Promise.all([
        apiFetch<HourlyResponse>('/api/v1/visits/hourly'),
        apiFetch<StatsResponse>('/api/v1/stats'),
        apiFetch<ConfigResponse>('/api/v1/config'),
      ]);

      chartData.value = hourly.data;
      totalVisits24h.value = hourly.totalVisits24h;
      totalTreesPlanted.value = stats.totalTreesPlanted;
      totalCustomers.value = stats.totalCustomers;
      totalVisits.value = stats.totalVisits;
      visitsPerTree.value = config.visitsPerTree;
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
    chartData,
    totalVisits24h,
    totalTreesPlanted,
    totalCustomers,
    totalVisits,
    visitsPerTree,
    isLoading,
    error,
    lastUpdated,
    connectionStatus,
  };
}
