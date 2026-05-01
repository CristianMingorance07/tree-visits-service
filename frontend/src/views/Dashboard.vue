<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-5xl mx-auto px-4 py-12">

      <!-- Header — matches Tree-Nation's bold black headline style -->
      <header class="text-center mb-12 animate-fade-up">
        <div
          class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#65D693]/15 border border-[#65D693]/30 mb-6 text-3xl"
          aria-hidden="true"
        >🌱</div>
        <h1 class="text-4xl font-black text-gray-900 tracking-tight leading-none mb-3">
          X Visits =&nbsp;<span class="text-brand-gradient">1 Tree</span>
        </h1>
        <p class="text-gray-500 text-base font-medium">
          Real-time reforestation tracker &middot; Tree-Nation
        </p>
      </header>

      <!-- Loading skeleton -->
      <Transition name="dashboard" mode="out-in">
        <div v-if="isLoading" key="loading">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <SkeletonCard v-for="i in 3" :key="i" />
          </div>
          <div class="card p-6 mb-4 h-72">
            <div class="skeleton h-3 w-32 mb-6" />
            <div class="skeleton h-48" />
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
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

        <!-- Dashboard -->
        <div v-else key="content" class="space-y-4">

          <!-- Stats row -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title="Visits (24 h)"
              :value="totalVisits24h"
              subtitle="in the last 24 hours"
              icon="📈"
            />
            <StatsCard
              title="Customers"
              :value="totalCustomers"
              subtitle="unique devices tracked"
              icon="👤"
            />
            <StatsCard
              title="Trees Planted"
              :value="totalTreesPlanted"
              subtitle="trees funded by visits"
              icon="🌳"
            />
          </div>

          <!-- Chart -->
          <div class="card-accent p-6">
            <div class="flex items-center justify-between mb-5">
              <h2 class="text-[#3aaa68] text-xs font-bold uppercase tracking-widest">
                Hourly activity
              </h2>
              <span class="text-gray-400 text-xs">Last 24 hours</span>
            </div>
            <VisitsChart :data="chartData" />
          </div>

          <!-- Tree counter + Customer lookup -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TreeCounter :total-trees-planted="totalTreesPlanted" />
            <CustomerLookup />
          </div>
        </div>
      </Transition>

      <!-- Footer -->
      <footer class="mt-10 pt-5 border-t border-gray-100 flex items-center justify-between">
        <LiveIndicator :status="connectionStatus" :last-updated="lastUpdated" />
        <span class="text-gray-300 text-xs">Refreshes every {{ POLL_INTERVAL_MS / 1000 }}s</span>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVisitsData, POLL_INTERVAL_MS } from '../composables/useVisitsData';
import StatsCard from '../components/StatsCard.vue';
import VisitsChart from '../components/VisitsChart.vue';
import TreeCounter from '../components/TreeCounter.vue';
import CustomerLookup from '../components/CustomerLookup.vue';
import LiveIndicator from '../components/LiveIndicator.vue';
import SkeletonCard from '../components/SkeletonCard.vue';

const {
  chartData,
  totalVisits24h,
  totalTreesPlanted,
  totalCustomers,
  isLoading,
  error,
  lastUpdated,
  connectionStatus,
} = useVisitsData();
</script>

<style scoped>
.dashboard-enter-active,
.dashboard-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.dashboard-enter-from,
.dashboard-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
