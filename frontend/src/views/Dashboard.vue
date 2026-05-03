<template>
  <div class="min-h-screen bg-[#f8faf9]">
    <div class="max-w-5xl mx-auto px-4 py-10">

      <!-- Header -->
      <header class="text-center mb-8 animate-fade-up">
        <div class="flex justify-center mb-5">
          <img
            src="/tree-nation-icon.png"
            alt="Tree-Nation"
            class="w-20 h-20"
          />
        </div>
        <h1 class="text-4xl font-black text-gray-900 tracking-tight leading-none mb-3">
          {{ visitsPerTree }} Visits&nbsp;=&nbsp;<span class="text-[#48C4D8]">1</span>&nbsp;<span class="text-[#3aaa68]">Tree</span>
        </h1>
        <p class="text-gray-400 text-sm font-medium">
          Real-time reforestation tracker &middot; Tree-Nation
        </p>
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
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3aaa68] opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-[#3aaa68]"></span>
            </span>
            Live
          </button>
        </div>
      </div>

      <!-- Admin reset — always visible, protected by ADMIN_SECRET in the modal -->
      <div
        class="mb-8 rounded-2xl border border-red-100 bg-red-50/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <p class="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">Admin reset</p>
          <p class="text-xs text-red-700 font-semibold">Resets both Demo and Live panels</p>
          <p class="text-[10px] text-red-400 mt-0.5">
            Deletes all demo/live visits and customers, then reloads the seeded demo dataset.
          </p>
          <p v-if="resetStatus" class="text-[10px] font-semibold mt-1" :class="resetError ? 'text-red-600' : 'text-[#3aaa68]'">
            {{ resetStatus }}
          </p>
        </div>
        <button
          @click="openResetModal"
          :disabled="resetting"
          class="shrink-0 flex items-center justify-center gap-1.5 text-[10px] font-bold px-3 py-2 rounded-full border transition-all duration-200
                 bg-white border-red-200 text-red-500 hover:border-red-300 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          title="Reset demo and live visits/customers"
        >
          <span>↺</span> {{ resetting ? 'Resetting...' : 'Reset all data' }}
        </button>
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
          v-else-if="error && !totalCustomers"
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
                  title="Visits"
                  :value="demoChartTotal"
                  :subtitle="demoChartLabel"
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
                  subtitle="funded by visits"
                  icon="🌳"
                />
              </div>

              <div class="card-accent p-6">
                <VisitsChart filter="all" :last-updated="lastUpdated" @stats-update="onDemoStats" />
              </div>

              <EventSimulator :key="simulatorKey" :visits-per-tree="visitsPerTree" @visit-recorded="refresh" />

              <LiveDashboard
                mode="demo"
                :visits="demoVisits"
                :visits-per-tree="visitsPerTree"
              />

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
                  title="Visits"
                  :value="liveChartTotal"
                  :subtitle="liveChartLabel"
                  icon="📈"
                />
                <StatsCard
                  title="Devices"
                  :value="liveDevices"
                  subtitle="unique devices tracked"
                  icon="📱"
                />
                <StatsCard
                  title="Trees"
                  :value="liveTrees"
                  subtitle="funded by visits"
                  icon="🌳"
                />
              </div>

              <div class="card-accent p-6">
                <VisitsChart filter="real" :last-updated="lastUpdated" @stats-update="onLiveStats" />
              </div>

              <LiveDashboard
                :visits="recentVisits"
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

    <ConfirmModal
      v-model="showResetModal"
      variant="danger"
      title="Reset Demo and Live data?"
      description="This clears every stored visit and customer from both dashboard panels, then reloads the seeded demo dataset so you can test from a clean state."
      :busy="resetting"
      @close="closeResetModal"
    >
      <template #icon>↺</template>
      <template #label>Destructive local action</template>

      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div class="rounded-2xl border border-red-100 bg-red-50/60 px-3 py-3">
            <p class="text-[9px] font-black uppercase tracking-widest text-red-300 mb-1">Deletes</p>
            <p class="text-xs font-bold text-red-700">Demo visits</p>
          </div>
          <div class="rounded-2xl border border-red-100 bg-red-50/60 px-3 py-3">
            <p class="text-[9px] font-black uppercase tracking-widest text-red-300 mb-1">Deletes</p>
            <p class="text-xs font-bold text-red-700">Live visits</p>
          </div>
          <div class="rounded-2xl border border-[#65D693]/25 bg-[#65D693]/10 px-3 py-3">
            <p class="text-[9px] font-black uppercase tracking-widest text-[#3aaa68]/50 mb-1">Reloads</p>
            <p class="text-xs font-bold text-[#3aaa68]">Demo seed</p>
          </div>
        </div>

        <label class="block">
          <span class="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Admin secret</span>
          <input
            v-model="adminSecret"
            type="password"
            autocomplete="off"
            placeholder="local-dev-admin-secret"
            :disabled="resetting"
            class="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono text-gray-700 outline-none transition-all
                   focus:border-red-200 focus:bg-white focus:ring-4 focus:ring-red-100 disabled:opacity-50"
          />
        </label>

        <p v-if="modalError" class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
          {{ modalError }}
        </p>
      </div>

      <template #actions>
        <button
          type="button"
          class="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-2xl text-sm font-bold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40 active:scale-[0.98]"
          :disabled="resetting"
          @click="closeResetModal"
        >
          Cancel
        </button>
        <button
          type="button"
          class="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-2xl text-sm font-black bg-red-500 text-white shadow-lg shadow-red-500/25 hover:bg-red-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="resetting || !adminSecret.trim()"
          @click="confirmReset"
        >
          {{ resetting ? 'Resetting…' : 'Yes, reset everything' }}
        </button>
      </template>
    </ConfirmModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useVisitsData, POLL_INTERVAL_MS } from '../composables/useVisitsData';
import { apiFetch } from '../lib/api';
import StatsCard from '../components/StatsCard.vue';
import VisitsChart from '../components/VisitsChart.vue';
import CustomerLeaderboard from '../components/CustomerLeaderboard.vue';
import EventSimulator from '../components/EventSimulator.vue';
import LiveDashboard from '../components/LiveDashboard.vue';
import LiveIndicator from '../components/LiveIndicator.vue';
import SkeletonCard from '../components/SkeletonCard.vue';
import ConfirmModal from '../components/ConfirmModal.vue';

const activeTab = ref<'demo' | 'live'>('demo');
const resetting = ref(false);
const resetStatus = ref('');
const resetError = ref(false);
const showResetModal = ref(false);
const modalError = ref('');
const adminSecret = ref(window.localStorage.getItem('treeVisitsAdminSecret') ?? '');
const simulatorKey = ref(0);

const demoChartTotal = ref(0);
const demoChartLabel = ref('Last 24 hours');
const liveChartTotal = ref(0);
const liveChartLabel = ref('Last 24 hours');

function onDemoStats(total: number, label: string) {
  demoChartTotal.value = total;
  demoChartLabel.value = label;
}
function onLiveStats(total: number, label: string) {
  liveChartTotal.value = total;
  liveChartLabel.value = label;
}

function openResetModal() {
  resetStatus.value = '';
  resetError.value = false;
  modalError.value = '';
  showResetModal.value = true;
}

function closeResetModal() {
  if (resetting.value) return;
  showResetModal.value = false;
  modalError.value = '';
}

async function confirmReset() {
  const secret = adminSecret.value.trim();
  if (!secret || resetting.value) return;
  window.localStorage.setItem('treeVisitsAdminSecret', secret);

  resetting.value = true;
  resetStatus.value = '';
  resetError.value = false;
  modalError.value = '';
  try {
    await apiFetch('/api/v1/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-secret': secret,
      },
      body: '{}',
    });
    await refresh();
    simulatorKey.value++;
    showResetModal.value = false;
    resetStatus.value = 'Data reset complete. Demo seed reloaded.';
  } catch (err) {
    resetError.value = true;
    modalError.value = err instanceof Error ? err.message : 'Reset failed';
    resetStatus.value = modalError.value;
  } finally {
    resetting.value = false;
  }
}

const demoCustomers = computed(() =>
  customers.value.filter(c => c.customerId.startsWith('device-store-'))
);
const liveCustomers = computed(() =>
  customers.value.filter(c => !c.customerId.startsWith('device-store-'))
);

const {
  totalTreesPlanted,
  totalCustomers,
  visitsPerTree,
  customers,
  recentVisits,
  demoVisits,
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

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active form,
.modal-leave-active form {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from form,
.modal-leave-to form {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}
</style>
