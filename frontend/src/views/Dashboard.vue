<template>
  <div class="min-h-screen bg-[#f8faf9]">
    <div class="max-w-5xl mx-auto px-4 py-10">

      <!-- Header -->
      <header class="text-center mb-8 animate-fade-up">
        <div class="flex justify-center mb-5">
          <div class="w-16 h-16 rounded-3xl bg-[#3aaa68] flex items-center justify-center shadow-lg shadow-[#3aaa68]/30">
            <svg class="w-9 h-9" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 1L1 18.5H9.5L3 30H13V43H23V30H33L26.5 18.5H35L18 1Z" fill="white" fill-rule="evenodd"/>
            </svg>
          </div>
        </div>
        <h1 class="text-4xl font-black text-gray-900 tracking-tight leading-none mb-3">
          X Visits&nbsp;=&nbsp;<span class="text-brand-gradient">1 Tree</span>
        </h1>
        <p class="text-gray-400 text-sm font-medium mb-4">
          Real-time reforestation tracker &middot; Tree-Nation
        </p>
        <Transition name="badge">
          <div
            v-if="visitsPerTree > 0"
            class="inline-flex items-center gap-1.5 bg-[#3aaa68]/10 border border-[#3aaa68]/20
                   text-[#3aaa68] text-xs font-semibold px-3.5 py-1.5 rounded-full"
          >
            <svg class="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
              <circle cx="6" cy="6" r="5" fill="currentColor" opacity="0.2"/>
              <circle cx="6" cy="6" r="2.5" fill="currentColor"/>
            </svg>
            Every {{ visitsPerTree }} visits plants 1 tree
          </div>
        </Transition>
      </header>

      <!-- Tab switcher -->
      <div class="flex justify-center mb-8">
        <div class="inline-flex rounded-2xl bg-gray-100 p-1 gap-0.5">
          <button
            @click="activeTab = 'demo'"
            class="px-8 py-2 rounded-xl text-sm font-bold transition-all duration-200"
            :class="activeTab === 'demo'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-400 hover:text-gray-600'"
          >
            Demo
          </button>
          <button
            @click="activeTab = 'live'"
            class="px-8 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2"
            :class="activeTab === 'live'
              ? 'bg-white shadow text-gray-900'
              : 'text-gray-400 hover:text-gray-600'"
          >
            <span
              v-if="recentScans.length"
              class="w-1.5 h-1.5 rounded-full bg-[#3aaa68] animate-pulse"
            />
            Live
          </button>
        </div>
      </div>

      <!-- Loading skeleton -->
      <Transition name="dashboard" mode="out-in">
        <div v-if="isLoading" key="loading">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <SkeletonCard v-for="i in 3" :key="i" />
          </div>
          <div class="card p-6 mb-4 h-64">
            <div class="skeleton h-3 w-32 mb-6" />
            <div class="skeleton h-44" />
          </div>
          <SkeletonCard class="mb-4 h-64" />
          <SkeletonCard class="h-64" />
        </div>

        <!-- Hard error -->
        <div
          v-else-if="error && !chartData.length"
          key="error"
          class="card p-12 text-center"
        >
          <div class="text-5xl mb-4">⚠️</div>
          <p class="text-gray-800 font-semibold mb-2">Cannot reach the API</p>
          <p class="text-gray-400 text-sm font-mono">{{ error }}</p>
        </div>

        <!-- Dashboard content -->
        <div v-else key="content" class="space-y-4">

          <!-- Tab content -->
          <Transition name="tab" mode="out-in">

            <!-- DEMO TAB -->
            <div v-if="activeTab === 'demo'" key="demo" class="space-y-4">

              <!-- Demo stats -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatsCard
                  title="Visits (24 h)"
                  :value="totalVisits24h"
                  subtitle="simulated + real · last 24h"
                  icon="📈"
                />
                <StatsCard
                  title="Devices"
                  :value="totalCustomers"
                  subtitle="unique devices tracked"
                  icon="📡"
                />
                <StatsCard
                  title="Trees Planted"
                  :value="totalTreesPlanted"
                  subtitle="trees funded by visits"
                  icon="🌳"
                />
              </div>

              <div class="card-accent p-6">
                <div class="flex items-center justify-between mb-5">
                  <h2 class="text-[#3aaa68] text-xs font-bold uppercase tracking-widest">
                    Visit activity
                  </h2>
                  <span class="text-gray-300 text-[10px] font-mono">Last 24 hours · hourly</span>
                </div>
                <VisitsChart :data="chartData" />
              </div>

              <EventSimulator :visits-per-tree="visitsPerTree" @visit-recorded="refresh" />

              <CustomerLeaderboard
                :customers="demoCustomers"
                :visits-per-tree="visitsPerTree"
              />
            </div>

            <!-- LIVE TAB -->
            <div v-else key="live" class="space-y-4">

              <!-- Live-only stats -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatsCard
                  title="Real Scans (24 h)"
                  :value="liveVisits24h"
                  subtitle="QR scans in the last 24h"
                  icon="📲"
                />
                <StatsCard
                  title="Real Devices"
                  :value="liveDevices"
                  subtitle="unique real-world devices"
                  icon="📱"
                />
                <StatsCard
                  title="Trees (real)"
                  :value="liveTrees"
                  subtitle="planted via real visits"
                  icon="🌳"
                />
              </div>

              <LiveDashboard
                :scans="recentScans"
                :visits-per-tree="visitsPerTree"
              />

              <CustomerLeaderboard
                v-if="liveCustomers.length"
                :customers="liveCustomers"
                :visits-per-tree="visitsPerTree"
              />
            </div>

          </Transition>
        </div>
      </Transition>

      <!-- Footer -->
      <footer class="mt-10 pt-5 border-t border-gray-100 flex items-center justify-between">
        <LiveIndicator :status="connectionStatus" :last-updated="lastUpdated" />
        <span class="text-gray-300 text-[10px] font-mono">Auto-refresh every {{ POLL_INTERVAL_MS / 1000 }}s</span>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useVisitsData, POLL_INTERVAL_MS } from '../composables/useVisitsData';
import StatsCard from '../components/StatsCard.vue';
import VisitsChart from '../components/VisitsChart.vue';
import CustomerLeaderboard from '../components/CustomerLeaderboard.vue';
import EventSimulator from '../components/EventSimulator.vue';
import LiveDashboard from '../components/LiveDashboard.vue';
import LiveIndicator from '../components/LiveIndicator.vue';
import SkeletonCard from '../components/SkeletonCard.vue';

const activeTab = ref<'demo' | 'live'>('demo');

const demoCustomers = computed(() =>
  customers.value.filter(c => c.customerId.startsWith('device-store-'))
);
const liveCustomers = computed(() =>
  customers.value.filter(c => !c.customerId.startsWith('device-store-'))
);

const {
  chartData,
  totalVisits24h,
  totalTreesPlanted,
  totalCustomers,
  visitsPerTree,
  customers,
  recentScans,
  liveVisits24h,
  liveDevices,
  liveTrees,
  isLoading,
  error,
  lastUpdated,
  connectionStatus,
  refresh,
} = useVisitsData();
</script>

<style scoped>
.badge-enter-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.badge-enter-from {
  opacity: 0;
  transform: translateY(4px) scale(0.95);
}

.dashboard-enter-active,
.dashboard-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.dashboard-enter-from,
.dashboard-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.tab-enter-active,
.tab-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.tab-enter-from,
.tab-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
