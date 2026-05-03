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
      </div>
    </TransitionGroup>

    <!-- Footer -->
    <p class="text-gray-300 text-[10px] text-center mt-4 font-medium">
      Progress shows current cycle · {{ visitsPerTree }} visits = 1 tree
    </p>
  </div>
</template>

<script setup lang="ts">
import type { CustomerListItem } from '../types/api';

const props = defineProps<{
  customers: CustomerListItem[];
  visitsPerTree: number;
}>();

const gridStyle = { gridTemplateColumns: '1fr 72px 54px 52px' };

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
</style>
