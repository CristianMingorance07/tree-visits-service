<template>
  <div class="card-accent p-6">

    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
      <div>
        <h2 class="text-[#3aaa68] text-xs font-bold uppercase tracking-widest">Customer Activity</h2>
        <p class="text-gray-400 text-[10px] mt-0.5">
          One entry per device · visits tracked since first connection
        </p>
      </div>
      <span class="text-gray-300 text-[10px] font-mono">{{ customers.length }} devices</span>
    </div>

    <!-- Column labels -->
    <div class="grid gap-3 px-3 mb-2" :style="gridStyle">
      <span class="text-[9px] font-bold uppercase tracking-wider text-gray-300">Device</span>
      <span class="text-[9px] font-bold uppercase tracking-wider text-gray-300 text-right">Visits</span>
      <span class="text-[9px] font-bold uppercase tracking-wider text-gray-300 text-right">Trees</span>
      <span class="text-[9px] font-bold uppercase tracking-wider text-gray-300 text-right">Next</span>
      <span class="text-[9px] font-bold uppercase tracking-wider text-gray-300 text-center">Scan</span>
    </div>

    <!-- Skeleton -->
    <div v-if="!customers.length" class="space-y-2">
      <div v-for="i in 6" :key="i" class="h-[56px] rounded-xl bg-gray-100 animate-pulse" />
    </div>

    <!-- Rows -->
    <TransitionGroup v-else name="row" tag="div" class="space-y-1.5">
      <div
        v-for="customer in customers"
        :key="customer.customerId"
      >
        <div
          class="grid gap-3 items-center rounded-xl border px-3 py-3 transition-all duration-500"
          :style="gridStyle"
          :class="customer.visitsUntilNextTree === 1
            ? 'border-[#3aaa68]/25 bg-[#3aaa68]/[0.04]'
            : 'border-gray-100 bg-white'"
        >
          <!-- Device ID + progress bar -->
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="text-[11px] font-semibold text-gray-700 font-mono truncate leading-none">
                {{ customer.customerId }}
              </span>
              <span
                v-if="customer.visitsUntilNextTree === 1"
                class="shrink-0 text-[9px] font-bold text-[#3aaa68] bg-[#3aaa68]/10 px-1.5 py-0.5 rounded-full leading-none"
              >
                next visit plants a tree
              </span>
            </div>
            <div class="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-700 ease-out bg-[#3aaa68]/60"
                :style="{ width: cycleProgress(customer) }"
              />
            </div>
          </div>

          <!-- Total visits -->
          <span class="text-sm font-bold text-gray-600 tabular-nums text-right">
            {{ customer.totalVisits }}
          </span>

          <!-- Trees planted -->
          <span
            class="text-sm font-black tabular-nums text-right"
            :class="customer.treesPlanted > 0 ? 'text-[#3aaa68]' : 'text-gray-300'"
          >
            {{ customer.treesPlanted }}
          </span>

          <!-- Visits until next tree -->
          <span
            class="text-xs tabular-nums text-right font-semibold"
            :class="customer.visitsUntilNextTree <= 2 ? 'text-[#3aaa68]' : 'text-gray-400'"
          >
            {{ customer.visitsUntilNextTree }}v
          </span>

          <!-- QR toggle -->
          <button
            @click="toggleQr(customer.customerId)"
            class="flex items-center justify-center w-7 h-7 rounded-lg border transition-all duration-200 mx-auto"
            :class="activeQr === customer.customerId
              ? 'border-[#3aaa68]/40 bg-[#3aaa68]/10 text-[#3aaa68]'
              : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-[#3aaa68]/30 hover:text-[#3aaa68]'"
            :title="`QR code to record a real visit for ${customer.customerId}`"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
              <rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/>
              <rect x="19" y="19" width="2" height="2"/>
            </svg>
          </button>
        </div>

        <!-- QR panel -->
        <Transition name="qr">
          <div
            v-if="activeQr === customer.customerId"
            class="mx-1 mb-1 rounded-xl border border-[#3aaa68]/20 bg-[#3aaa68]/[0.03] p-4 flex items-center gap-5"
          >
            <img
              v-if="qrCache[customer.customerId]"
              :src="qrCache[customer.customerId]"
              alt="QR code"
              class="w-24 h-24 rounded-lg border border-gray-100 shrink-0"
            />
            <div class="min-w-0">
              <p class="text-[11px] font-bold text-gray-700 mb-1">Scan to record a real visit</p>
              <p class="text-[10px] text-gray-400 mb-2 leading-relaxed">
                Scan this QR code with any device on the same network. Each scan sends a real
                <span class="font-mono">POST /api/v1/visits</span> to the API.
              </p>
              <a
                :href="scanUrl(customer.customerId)"
                target="_blank"
                class="text-[10px] font-mono text-[#3aaa68] break-all hover:underline"
              >
                {{ scanUrl(customer.customerId) }}
              </a>
            </div>
          </div>
        </Transition>
      </div>
    </TransitionGroup>

    <!-- Footer -->
    <p class="text-gray-300 text-[10px] text-center mt-4 font-medium">
      Progress shows current cycle · {{ visitsPerTree }} visits = 1 tree · click
      <svg class="inline w-3 h-3 -mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
      to scan from any device
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import QRCode from 'qrcode';
import type { CustomerListItem } from '../types/api';

const props = defineProps<{
  customers: CustomerListItem[];
  visitsPerTree: number;
}>();

const gridStyle = { gridTemplateColumns: '1fr 72px 54px 52px 40px' };

const activeQr = ref<string | null>(null);
const qrCache = ref<Record<string, string>>({});

function scanUrl(customerId: string): string {
  return `${window.location.origin}/api/v1/visits/scan/${encodeURIComponent(customerId)}`;
}

async function generateQr(customerId: string) {
  if (qrCache.value[customerId]) return;
  try {
    qrCache.value[customerId] = await QRCode.toDataURL(scanUrl(customerId), {
      width: 192,
      margin: 1,
      color: { dark: '#111827', light: '#ffffff' },
    });
  } catch {
    // silently fail — URL still works
  }
}

function toggleQr(customerId: string) {
  if (activeQr.value === customerId) {
    activeQr.value = null;
  } else {
    activeQr.value = customerId;
    generateQr(customerId);
  }
}

function cycleProgress(c: CustomerListItem): string {
  const done = props.visitsPerTree - c.visitsUntilNextTree;
  return `${Math.max(2, Math.min(100, (done / props.visitsPerTree) * 100))}%`;
}
</script>

<style scoped>
.row-move,
.row-enter-active,
.row-leave-active {
  transition: all 0.35s ease;
}
.row-enter-from { opacity: 0; transform: translateY(-4px); }
.row-leave-to   { opacity: 0; }
.row-leave-active { position: absolute; width: 100%; }

.qr-enter-active, .qr-leave-active { transition: all 0.25s ease; }
.qr-enter-from, .qr-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
