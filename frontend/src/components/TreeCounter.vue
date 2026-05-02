<template>
  <div class="card-accent p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-[#3aaa68] text-xs font-bold uppercase tracking-widest">Trees Planted</h2>
      <span class="text-gray-400 text-xs">
        Batch {{ currentBatch }} · {{ visitsPerTree }} per tree
      </span>
    </div>

    <!-- Forest scene -->
    <div
      class="forest-scene relative rounded-2xl overflow-hidden mb-4"
      :class="{ celebrating }"
    >
      <!-- Sky + ground gradient -->
      <div class="absolute inset-0 pointer-events-none"
        style="background: linear-gradient(175deg, #f0fdf4 0%, #dcfce7 55%, #a7f3d0 100%)" />
      <div class="absolute bottom-0 inset-x-0 h-10 pointer-events-none"
        style="background: linear-gradient(to top, #6ee7b788, transparent)" />

      <!-- 3-layer rows ------------------------------------------------ -->

      <!-- Back row (4 slots, small + dim) -->
      <div class="tree-row" style="top: 6px; height: 48px">
        <TransitionGroup name="tback" tag="div" class="tree-row-inner">
          <span
            v-for="n in backCount"
            :key="`b${n}`"
            class="tree tback"
            :style="vars(n, 'back')"
          >🌳</span>
        </TransitionGroup>
      </div>

      <!-- Mid row (3 slots, medium) -->
      <div class="tree-row" style="top: 50px; height: 62px">
        <TransitionGroup name="tmid" tag="div" class="tree-row-inner">
          <span
            v-for="n in midCount"
            :key="`m${n}`"
            class="tree tmid"
            :style="vars(n, 'mid')"
          >🌳</span>
        </TransitionGroup>
      </div>

      <!-- Front row (3 slots, large + vivid) — newest trees land here -->
      <div class="tree-row" style="top: 104px; height: 76px">
        <TransitionGroup name="tfront" tag="div" class="tree-row-inner">
          <span
            v-for="n in frontCount"
            :key="`f${n}`"
            class="tree tfront"
            :style="vars(n, 'front')"
          >🌳</span>
        </TransitionGroup>
      </div>

      <!-- Milestone banner (shown during celebration) -->
      <Transition name="banner">
        <div
          v-if="celebrating"
          class="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div class="bg-[#3aaa68] text-white text-sm font-black px-6 py-2 rounded-full shadow-lg shadow-[#3aaa68]/40 tracking-wide">
            🌳 Batch complete! +{{ visitsPerTree }} trees
          </div>
        </div>
      </Transition>

      <!-- Stats pill -->
      <div v-if="!celebrating" class="absolute bottom-2.5 inset-x-0 flex justify-center">
        <div class="flex items-center gap-3 bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-sm border border-white/60">
          <!-- Ring -->
          <svg class="-rotate-90 shrink-0" width="38" height="38" viewBox="0 0 38 38">
            <circle cx="19" cy="19" r="15" fill="none" stroke="#e5e7eb" stroke-width="3.5" />
            <circle
              cx="19" cy="19" r="15" fill="none"
              stroke="url(#rg)" stroke-width="3.5" stroke-linecap="round"
              :stroke-dasharray="circum"
              :stroke-dashoffset="dashOffset"
              class="ring-progress"
            />
            <defs>
              <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#3aaa68" />
                <stop offset="100%" stop-color="#65D693" />
              </linearGradient>
            </defs>
          </svg>
          <!-- Count -->
          <div>
            <div class="text-gray-900 text-2xl font-black tabular-nums leading-none">
              {{ displayed }}
            </div>
            <div class="text-gray-400 text-[10px] leading-none mt-0.5">trees planted</div>
          </div>
          <!-- Overflow -->
          <span
            v-if="totalTreesPlanted > MAX_DISPLAY_EVER"
            class="text-[#3aaa68] text-[10px] font-bold bg-[#65D693]/10 border border-[#65D693]/25 rounded-full px-2 py-0.5"
          >
            +{{ totalTreesPlanted - MAX_DISPLAY_EVER }}
          </span>
        </div>
      </div>

      <!-- Empty-state -->
      <Transition name="fade">
        <div
          v-if="totalTreesPlanted === 0 && !celebrating"
          class="absolute inset-0 flex items-center justify-center"
        >
          <p class="text-gray-400 text-sm italic">No trees yet — keep visiting!</p>
        </div>
      </Transition>
    </div>

    <!-- Progress bar -->
    <div class="space-y-1.5">
      <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full bg-gradient-to-r from-[#3aaa68] to-[#65D693] progress-bar"
          :style="{ width: `${batchPercent}%` }"
        />
      </div>
      <div class="flex justify-between text-xs text-gray-400">
        <span>{{ treesInBatch }} / {{ visitsPerTree }} in current batch</span>
        <span>Next milestone: {{ nextMilestone }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useCountUp } from '../composables/useCountUp';

// Slots per layer — fill back→mid→front so newest trees land in front
const BACK_SLOTS  = 4;
const MID_SLOTS   = 3;
const FRONT_SLOTS = 3;
const MAX_DISPLAY_EVER = BACK_SLOTS + MID_SLOTS + FRONT_SLOTS; // 10

const props = defineProps<{
  totalTreesPlanted: number;
  visitsPerTree: number;
}>();

const { displayed, animateTo } = useCountUp();

const celebrating  = ref(false);
let   celebTimer: ReturnType<typeof setTimeout> | null = null;

// Trees to show in the forest: normally = batch progress, during celebration = full batch
const forestCount = ref(0);

watch(
  () => props.totalTreesPlanted,
  (newVal, oldVal) => {
    animateTo(newVal);

    const vpt     = props.visitsPerTree;
    const newBatch = newVal % vpt;
    const isMilestone = newVal > 0 && newVal > (oldVal ?? 0) && newBatch === 0;

    if (isMilestone) {
      forestCount.value = vpt; // fill forest completely
      celebrating.value = true;
      if (celebTimer) clearTimeout(celebTimer);
      celebTimer = setTimeout(() => {
        celebrating.value = false;
        forestCount.value  = 0; // reset for next batch
      }, 1_600);
    } else if (!celebrating.value) {
      forestCount.value = newBatch;
    }
  },
  { immediate: true },
);

onUnmounted(() => { if (celebTimer) clearTimeout(celebTimer); });

// Distribute forestCount across layers: back first, then mid, then front
const backCount  = computed(() => Math.min(forestCount.value, BACK_SLOTS));
const midCount   = computed(() => Math.max(0, Math.min(forestCount.value - BACK_SLOTS, MID_SLOTS)));
const frontCount = computed(() => Math.max(0, Math.min(forestCount.value - BACK_SLOTS - MID_SLOTS, FRONT_SLOTS)));

const treesInBatch   = computed(() => props.totalTreesPlanted % props.visitsPerTree);
const batchPercent   = computed(() => (treesInBatch.value / props.visitsPerTree) * 100);
const nextMilestone  = computed(() =>
  Math.ceil((props.totalTreesPlanted + 1) / props.visitsPerTree) * props.visitsPerTree,
);
const currentBatch   = computed(() =>
  Math.floor(props.totalTreesPlanted / props.visitsPerTree) + 1,
);

const circum     = 2 * Math.PI * 15;
const dashOffset = computed(() => circum * (1 - batchPercent.value / 100));

type Layer = 'front' | 'mid' | 'back';

// CSS custom properties per tree — NO animation here, that lives in CSS
function vars(slot: number, layer: Layer): Record<string, string> {
  const seed = slot * 11 + (layer === 'front' ? 0 : layer === 'mid' ? 50 : 100);
  const dur   = (3.5 + (seed % 25) * 0.12).toFixed(2);       // 3.5–6.5 s
  const dly   = (-((seed * 7) % 55) / 10).toFixed(2);         // 0 to -5.4 s
  const rot   = (1.5 + (seed % 15) * 0.1).toFixed(1);         // 1.5–3° sway
  const nudgeY = ((seed * 13) % 9) - 4;
  const sz =
    layer === 'front' ? 30 + (seed % 9) :
    layer === 'mid'   ? 21 + (seed % 7) :
                        13 + (seed % 5);
  return {
    '--dur': `${dur}s`,
    '--dly': `${dly}s`,
    '--rot': `${rot}deg`,
    '--nudge': `${nudgeY}px`,
    '--sz': `${sz}px`,
  };
}
</script>

<style scoped>
/* Layout ------------------------------------------------------------ */
.forest-scene { height: 196px; }

.tree-row {
  position: absolute;
  inset-inline: 0;
}
.tree-row-inner {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  width: 100%;
  height: 100%;
  padding-inline: 0.5rem;
}

/* Tree base --------------------------------------------------------- */
.tree {
  display: inline-block;
  font-size: var(--sz, 28px);
  line-height: 1;
  transform-origin: bottom center;
  /* sway runs continuously; enter/leave animations override it via !important */
  animation: sway var(--dur, 4s) ease-in-out var(--dly, 0s) infinite;
  translate: 0 var(--nudge, 0px);
}

.tback  { opacity: 0.45; filter: brightness(0.75) saturate(0.8); }
.tmid   { opacity: 0.72; }
.tfront { opacity: 1;    }

@keyframes sway {
  0%, 100% { rotate: calc(-1 * var(--rot, 2deg)); }
  50%       { rotate: var(--rot, 2deg); translate: 0 calc(var(--nudge, 0px) - 3px); }
}

/* Entrance animations (override sway with !important) --------------- */
.tfront-enter-active {
  animation: grow-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;
}
@keyframes grow-pop {
  from { opacity: 0; scale: 0; rotate: -15deg; }
  to   { opacity: 1; scale: 1; rotate: 0deg; }
}

.tmid-enter-active {
  animation: grow-mid 0.45s cubic-bezier(0.34, 1.4, 0.64, 1) both !important;
}
@keyframes grow-mid {
  from { opacity: 0; scale: 0; }
  to   { opacity: 0.72; scale: 1; }
}

.tback-enter-active {
  animation: grow-back 0.35s ease-out both !important;
}
@keyframes grow-back {
  from { opacity: 0; translate: 0 10px; }
  to   { opacity: 0.45; translate: 0 0; }
}

/* Leave (stop sway + fade out) -------------------------------------- */
.tfront-leave-active,
.tmid-leave-active,
.tback-leave-active {
  animation: none !important;
  transition: opacity 0.25s ease, scale 0.25s ease;
}
.tfront-leave-to,
.tmid-leave-to,
.tback-leave-to {
  opacity: 0 !important;
  scale: 0;
}

/* Milestone celebration --------------------------------------------- */
.forest-scene.celebrating {
  animation: forest-pulse 0.5s ease 3;
}
@keyframes forest-pulse {
  0%, 100% { filter: brightness(1) saturate(1); }
  50%       { filter: brightness(1.25) saturate(1.6); }
}

/* Banner / fade transitions ----------------------------------------- */
.banner-enter-active { animation: banner-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.banner-leave-active { animation: banner-out 0.3s ease-in both; }
@keyframes banner-in  { from { opacity: 0; scale: 0.7; } to { opacity: 1; scale: 1; } }
@keyframes banner-out { from { opacity: 1; scale: 1; } to { opacity: 0; scale: 0.8; } }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }

/* Ring + bar smooth transitions ------------------------------------- */
.ring-progress { transition: stroke-dashoffset 0.7s ease; }
.progress-bar  { transition: width 0.7s ease; }
</style>
