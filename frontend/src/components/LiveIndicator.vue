<template>
  <div class="flex items-center gap-2 text-xs font-medium">
    <span class="relative flex h-2 w-2">
      <span
        v-if="status === 'connected'"
        class="absolute inset-0 rounded-full bg-[#65D693] animate-ping opacity-60"
      />
      <span
        class="relative inline-flex h-2 w-2 rounded-full transition-colors duration-500"
        :class="{
          'bg-[#65D693]': status === 'connected',
          'bg-yellow-400': status === 'reconnecting',
          'bg-red-400': status === 'error',
        }"
      />
    </span>
    <span
      class="font-semibold transition-colors duration-500"
      :class="{
        'text-[#3aaa68]': status === 'connected',
        'text-yellow-600': status === 'reconnecting',
        'text-red-500': status === 'error',
      }"
    >{{ label }}</span>
    <span v-if="relativeTime" class="text-gray-300">· {{ relativeTime }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import type { ConnectionStatus } from '../composables/useVisitsData';

const props = defineProps<{
  status: ConnectionStatus;
  lastUpdated: Date | null;
}>();

const label = computed(() => {
  if (props.status === 'connected') return 'Live';
  if (props.status === 'reconnecting') return 'Reconnecting…';
  return 'Disconnected';
});

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => { now.value = Date.now(); }, 5_000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});

const relativeTime = computed(() => {
  if (!props.lastUpdated) return '';
  const diffS = Math.floor((now.value - props.lastUpdated.getTime()) / 1000);
  if (diffS < 10) return 'just now';
  if (diffS < 60) return `${diffS}s ago`;
  return `${Math.floor(diffS / 60)}m ago`;
});
</script>
