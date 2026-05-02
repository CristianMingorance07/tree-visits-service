<template>
  <div class="card-accent p-6 flex flex-col">

    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
      <div>
        <h2 class="text-[#3aaa68] text-xs font-bold uppercase tracking-widest">Live Scan Feed</h2>
        <p class="text-gray-400 text-[10px] mt-0.5">Real device visits via QR · updates every 5s</p>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-1.5 h-1.5 rounded-full bg-[#3aaa68] animate-pulse"></span>
        <span class="text-[10px] text-[#3aaa68] font-bold">LIVE</span>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="!scans.length"
      class="flex-1 flex flex-col items-center justify-center text-center py-8 px-4"
    >
      <div class="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl mb-3">
        📡
      </div>
      <p class="text-gray-500 text-xs font-semibold mb-1">Waiting for real scans</p>
      <p class="text-gray-300 text-[10px] leading-relaxed max-w-[180px]">
        Scan a QR code from any device to see it appear here instantly
      </p>
    </div>

    <!-- Feed list -->
    <TransitionGroup v-else name="scan" tag="div" class="space-y-2 flex-1">
      <div
        v-for="scan in scans"
        :key="scan.id"
        class="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5"
      >
        <!-- Device icon -->
        <span class="text-xl shrink-0 leading-none">{{ deviceIcon(scan.device.type) }}</span>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="text-[11px] font-bold text-gray-700 font-mono truncate leading-none mb-0.5">
            {{ scan.customerId }}
          </div>
          <div class="text-[10px] text-gray-400 leading-none">
            {{ scan.device.browser }} · {{ scan.device.os }}
            <span class="text-gray-200 mx-1">·</span>
            <span class="capitalize text-gray-400">{{ scan.device.type }}</span>
          </div>
        </div>

        <!-- Time -->
        <span class="text-[10px] text-gray-300 font-mono shrink-0">{{ timeAgo(scan.visitedAt) }}</span>
      </div>
    </TransitionGroup>

    <!-- Footer -->
    <p class="text-gray-200 text-[10px] text-center mt-4 font-medium">
      Only shows visits from real QR scans · simulator visits not included
    </p>
  </div>
</template>

<script setup lang="ts">
import type { RecentScan } from '../types/api';

defineProps<{ scans: RecentScan[] }>();

function deviceIcon(type: string): string {
  if (type === 'mobile') return '📱';
  if (type === 'tablet') return '📟';
  return '💻';
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5)  return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
</script>

<style scoped>
.scan-move,
.scan-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.scan-leave-active {
  transition: all 0.3s ease;
}
.scan-enter-from {
  opacity: 0;
  transform: translateY(-12px) scale(0.95);
}
.scan-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
.scan-leave-active {
  position: absolute;
  width: 100%;
}
</style>
