<template>
  <div class="card-accent p-6">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-[#3aaa68] text-xs font-bold uppercase tracking-widest">Trees Planted</h2>
      <span class="text-gray-400 text-xs">Batch size: 10</span>
    </div>

    <div class="flex flex-col sm:flex-row items-center gap-8 mb-6">
      <!-- SVG Progress Ring -->
      <div class="relative flex-shrink-0" aria-hidden="true">
        <svg class="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="#e5e7eb"
            stroke-width="7"
          />
          <circle
            cx="50" cy="50" r="42"
            fill="none"
            stroke="url(#ring-gradient)"
            stroke-width="7"
            stroke-linecap="round"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="dashOffset"
            class="transition-all duration-700 ease-out"
          />
          <defs>
            <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#3aaa68" />
              <stop offset="100%" stop-color="#65D693" />
            </linearGradient>
          </defs>
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-gray-900 text-3xl font-black tabular-nums leading-none">
            {{ displayed }}
          </span>
          <span class="text-gray-400 text-xs mt-1">trees</span>
        </div>
      </div>

      <!-- Emoji grid with TransitionGroup -->
      <div
        class="flex flex-wrap justify-center gap-1 text-2xl leading-8 flex-1 min-h-8"
        :aria-label="`${totalTreesPlanted} trees planted`"
      >
        <TransitionGroup name="tree">
          <span v-for="i in displayedCount" :key="i" role="img" aria-hidden="true">🌳</span>
        </TransitionGroup>
        <span v-if="extraCount > 0" class="text-[#3aaa68] text-sm font-semibold self-center ml-2">
          +{{ extraCount }} more
        </span>
        <span v-if="totalTreesPlanted === 0" class="text-gray-400 text-sm self-center italic">
          No trees yet — keep visiting!
        </span>
      </div>
    </div>

    <!-- Milestone progress bar -->
    <div class="space-y-2">
      <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full bg-gradient-to-r from-[#3aaa68] to-[#65D693] transition-all duration-700 ease-out"
          :style="{ width: `${milestonePercent}%` }"
        />
      </div>
      <div class="flex justify-between text-xs text-gray-400">
        <span>{{ treesInBatch }} / 10 in current batch</span>
        <span>Next milestone: {{ nextMilestone }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useCountUp } from '../composables/useCountUp';

const MAX_DISPLAY = 20;
const BATCH_SIZE = 10;

const props = defineProps<{
  totalTreesPlanted: number;
}>();

const { displayed, animateTo } = useCountUp();
watch(() => props.totalTreesPlanted, (v) => animateTo(v), { immediate: true });

const displayedCount = computed(() => Math.min(props.totalTreesPlanted, MAX_DISPLAY));
const extraCount = computed(() => Math.max(0, props.totalTreesPlanted - MAX_DISPLAY));

const treesInBatch = computed(() => props.totalTreesPlanted % BATCH_SIZE);
const milestonePercent = computed(() => (treesInBatch.value / BATCH_SIZE) * 100);
const nextMilestone = computed(
  () => Math.ceil((props.totalTreesPlanted + 1) / BATCH_SIZE) * BATCH_SIZE,
);

const circumference = 2 * Math.PI * 42;
const dashOffset = computed(() => circumference * (1 - milestonePercent.value / 100));
</script>

<style scoped>
.tree-enter-active {
  animation: tree-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.tree-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.tree-leave-to {
  opacity: 0;
  transform: scale(0);
}
.tree-move {
  transition: transform 0.3s ease;
}
@keyframes tree-pop {
  from { opacity: 0; transform: scale(0) rotate(-15deg); }
  to   { opacity: 1; transform: scale(1) rotate(0deg); }
}
</style>
