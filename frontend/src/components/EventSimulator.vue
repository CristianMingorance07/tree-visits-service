<template>
  <div class="card-accent p-6">

    <!-- Header -->
    <div class="flex items-center justify-between mb-1">
      <div>
        <h2 class="text-[#3aaa68] text-xs font-bold uppercase tracking-widest">Device Event Simulator</h2>
        <p class="text-gray-400 text-[10px] mt-0.5">
          Simulates physical device events → <span class="font-mono">POST /api/v1/visits</span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Transition name="session">
          <span
            v-if="sessionTrees > 0"
            class="flex items-center gap-1 bg-[#65D693]/10 border border-[#65D693]/30 text-[#3aaa68]
                   text-[10px] font-bold px-2 py-0.5 rounded-full"
          >
            🌳 {{ sessionTrees }} planted
          </span>
        </Transition>
        <button
          @click="handleReset"
          :disabled="resetting"
          class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all duration-200
                 bg-gray-100 border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-400 disabled:opacity-40"
          title="Reset demo data"
        >
          <span>↺</span> Reset
        </button>
        <button
          @click="toggleAuto"
          class="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all duration-200"
          :class="autoMode
            ? 'bg-[#3aaa68] border-[#3aaa68] text-white'
            : 'bg-gray-100 border-gray-200 text-gray-500 hover:border-[#65D693]/50'"
        >
          <span :class="autoMode ? 'animate-pulse' : ''">⚡</span>
          {{ autoMode ? 'Auto ON' : 'Auto' }}
        </button>
      </div>
    </div>

    <!-- Device grid -->
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4 mt-4">
      <button
        v-for="device in devices"
        :key="device.id"
        @click="sendVisit(device.id)"
        :disabled="pending !== null || !device.loaded"
        class="group relative flex flex-col rounded-xl border p-3 text-left transition-all duration-200
               bg-gray-50 border-gray-200 hover:border-[#65D693]/50 hover:bg-[#65D693]/5
               disabled:cursor-not-allowed active:scale-95 overflow-hidden"
        :class="{
          'border-[#65D693]/70 bg-[#65D693]/8 shadow-sm shadow-[#65D693]/20': device.celebrating,
          'ring-2 ring-[#3aaa68]/40 border-[#3aaa68]/40': device.loaded && device.visitsUntilNextTree === 1 && !device.celebrating,
        }"
      >
        <!-- "SO CLOSE" badge -->
        <span
          v-if="device.loaded && device.visitsUntilNextTree === 1 && !device.celebrating"
          class="absolute -top-0.5 -right-0.5 bg-[#3aaa68] text-white text-[8px] font-black
                 px-1.5 py-0.5 rounded-bl-lg rounded-tr-xl animate-pulse z-10"
        >
          1 AWAY!
        </span>

        <!-- Icon + name -->
        <div class="flex items-center gap-2 mb-2.5">
          <span class="text-xl leading-none">{{ device.icon }}</span>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold text-gray-700 truncate leading-none mb-0.5">{{ device.name }}</div>
            <div class="text-[9px] text-gray-400 font-mono truncate">{{ device.id }}</div>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1.5">
          <div
            class="h-full rounded-full transition-all duration-500 ease-out"
            :class="device.celebrating
              ? 'bg-[#3aaa68]'
              : 'bg-gradient-to-r from-[#3aaa68] to-[#65D693]'"
            :style="{ width: progressWidth(device) }"
          />
        </div>

        <!-- Stats row -->
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-gray-500 font-medium">
            🌳 {{ device.treesPlanted }}
          </span>
          <span
            class="text-[10px] font-bold transition-colors duration-300"
            :class="device.loaded && device.visitsUntilNextTree <= 2
              ? 'text-[#3aaa68]'
              : 'text-gray-400'"
          >
            <template v-if="device.loaded">{{ device.visitsUntilNextTree }}v left</template>
            <template v-else>—</template>
          </span>
        </div>

        <!-- Sending overlay -->
        <div
          v-if="pending === device.id"
          class="absolute inset-0 rounded-xl flex items-center justify-center bg-white/80"
        >
          <span class="text-[#3aaa68] text-sm animate-spin">⟳</span>
        </div>

        <!-- Celebrate flash -->
        <Transition name="celebrate-flash">
          <div
            v-if="device.celebrating"
            class="absolute inset-0 rounded-xl bg-[#65D693]/20 pointer-events-none"
          />
        </Transition>
      </button>
    </div>

    <!-- Rate limit toast -->
    <Transition name="toast">
      <div
        v-if="rateLimited"
        class="border border-amber-200 bg-amber-50 text-amber-700 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
      >
        <span class="text-base shrink-0">⏱</span>
        <span>Too many requests — slow down a little and try again</span>
      </div>
    </Transition>

    <!-- Result toast -->
    <Transition name="toast">
      <div
        v-if="lastResult && !rateLimited"
        :class="lastResult.treeEarned
          ? 'bg-[#65D693]/10 border-[#65D693]/40 text-[#3aaa68]'
          : 'bg-gray-50 border-gray-200 text-gray-600'"
        class="border rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
      >
        <span class="text-base shrink-0">{{ lastResult.treeEarned ? '🌳' : '✅' }}</span>
        <span v-if="lastResult.treeEarned">
          Tree planted! <span class="font-mono font-normal">{{ lastResult.customerId }}</span>
          now has <strong>{{ lastResult.treesPlanted }} tree{{ lastResult.treesPlanted !== 1 ? 's' : '' }}</strong>
        </span>
        <span v-else>
          Visit #<strong>{{ lastResult.totalVisits }}</strong> recorded ·
          <span class="font-mono font-normal">{{ lastResult.customerId }}</span>
        </span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import confetti from 'canvas-confetti';
import { apiFetch } from '../lib/api';
import { ApiError } from '../lib/api';
import type { VisitResponse, CustomerResponse } from '../types/api';

const props = defineProps<{ visitsPerTree: number }>();
const emit = defineEmits<{ 'visit-recorded': [] }>();

interface DeviceState {
  id: string;
  name: string;
  icon: string;
  totalVisits: number;
  treesPlanted: number;
  visitsUntilNextTree: number;
  loaded: boolean;
  celebrating: boolean;
}

const DEMO_DEVICES: Pick<DeviceState, 'id' | 'name' | 'icon'>[] = [
  { id: 'device-store-01', name: 'Clothing',    icon: '👕' },
  { id: 'device-store-03', name: 'Coffee',      icon: '☕' },
  { id: 'device-store-05', name: 'Pharmacy',    icon: '💊' },
  { id: 'device-store-07', name: 'Supermarket', icon: '🛒' },
  { id: 'device-store-02', name: 'Electronics', icon: '📱' },
  { id: 'device-store-08', name: 'Sports',      icon: '⚽' },
];

const devices = ref<DeviceState[]>(
  DEMO_DEVICES.map(d => ({
    ...d,
    totalVisits: 0,
    treesPlanted: 0,
    visitsUntilNextTree: props.visitsPerTree,
    loaded: false,
    celebrating: false,
  })),
);

const pending = ref<string | null>(null);
const lastResult = ref<VisitResponse | null>(null);
const rateLimited = ref(false);
const sessionTrees = ref(0);
const autoMode = ref(false);
const resetting = ref(false);

let clearResultTimer: ReturnType<typeof setTimeout> | null = null;
let autoInterval: ReturnType<typeof setInterval> | null = null;
let autoIndex = 0;

function progressWidth(device: DeviceState): string {
  if (!device.loaded) return '0%';
  if (device.celebrating) return '100%';
  const filled = props.visitsPerTree - device.visitsUntilNextTree;
  return `${(filled / props.visitsPerTree) * 100}%`;
}

function fireCelebration() {
  const colors = ['#65D693', '#3aaa68', '#48C4D8', '#ffffff', '#d1fae5'];
  confetti({
    particleCount: 70,
    spread: 55,
    origin: { x: 0.35, y: 0.65 },
    colors,
    gravity: 0.9,
    scalar: 1.1,
  });
  confetti({
    particleCount: 70,
    spread: 55,
    origin: { x: 0.65, y: 0.65 },
    colors,
    gravity: 0.9,
    scalar: 1.1,
  });
}

async function sendVisit(deviceId: string) {
  if (pending.value !== null) return;
  pending.value = deviceId;

  try {
    const result = await apiFetch<VisitResponse>('/api/v1/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: deviceId }),
    });

    const device = devices.value.find(d => d.id === deviceId);
    if (device) {
      device.totalVisits = result.totalVisits;
      device.treesPlanted = result.treesPlanted;
      device.visitsUntilNextTree =
        props.visitsPerTree - (result.totalVisits % props.visitsPerTree) || props.visitsPerTree;

      if (result.treeEarned) {
        device.celebrating = true;
        sessionTrees.value++;
        fireCelebration();
        setTimeout(() => { device.celebrating = false; }, 900);
      }
    }

    lastResult.value = result;
    emit('visit-recorded');

    if (clearResultTimer) clearTimeout(clearResultTimer);
    clearResultTimer = setTimeout(() => { lastResult.value = null; }, 5_000);
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    if (err.status === 429) {
      rateLimited.value = true;
      setTimeout(() => { rateLimited.value = false; }, 3000);
    }
  } finally {
    pending.value = null;
  }
}

async function handleReset() {
  if (resetting.value) return;
  resetting.value = true;
  try {
    await apiFetch('/api/v1/reset', { method: 'POST' });
    sessionTrees.value = 0;
    lastResult.value = null;
    devices.value.forEach(d => { d.loaded = false; d.celebrating = false; });
    const results = await Promise.allSettled(
      DEMO_DEVICES.map(d =>
        apiFetch<CustomerResponse>(`/api/v1/customers/${encodeURIComponent(d.id)}`),
      ),
    );
    results.forEach((result, i) => {
      const device = devices.value[i];
      if (result.status === 'fulfilled') {
        device.totalVisits = result.value.totalVisits;
        device.treesPlanted = result.value.treesPlanted;
        device.visitsUntilNextTree = result.value.visitsUntilNextTree;
        device.loaded = true;
      }
    });
    emit('visit-recorded');
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
  } finally {
    resetting.value = false;
  }
}

function toggleAuto() {
  autoMode.value = !autoMode.value;
  if (autoMode.value) {
    autoInterval = setInterval(() => {
      const device = devices.value[autoIndex % devices.value.length];
      autoIndex++;
      if (pending.value === null) sendVisit(device.id);
    }, 1_500);
  } else {
    if (autoInterval) clearInterval(autoInterval);
    autoInterval = null;
  }
}

onMounted(async () => {
  const results = await Promise.allSettled(
    DEMO_DEVICES.map(d =>
      apiFetch<CustomerResponse>(`/api/v1/customers/${encodeURIComponent(d.id)}`),
    ),
  );
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      const device = devices.value[i];
      device.totalVisits = result.value.totalVisits;
      device.treesPlanted = result.value.treesPlanted;
      device.visitsUntilNextTree = result.value.visitsUntilNextTree;
      device.loaded = true;
    }
  });
});

onUnmounted(() => {
  if (clearResultTimer) clearTimeout(clearResultTimer);
  if (autoInterval) clearInterval(autoInterval);
});
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.session-enter-active,
.session-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.session-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.celebrate-flash-enter-active,
.celebrate-flash-leave-active {
  transition: opacity 0.4s ease;
}
.celebrate-flash-enter-from,
.celebrate-flash-leave-to {
  opacity: 0;
}
</style>
