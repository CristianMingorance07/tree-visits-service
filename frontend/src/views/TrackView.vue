<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-700"
    :class="bgClass"
  >
    <!-- Decorative blobs -->
    <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
      <div
        class="absolute -top-40 -right-40 w-80 h-80 rounded-full transition-all duration-700"
        :class="isCelebration ? 'bg-white/10' : 'bg-[#3aaa68]/8'"
      />
      <div
        class="absolute -bottom-28 -left-28 w-64 h-64 rounded-full transition-all duration-700"
        :class="isCelebration ? 'bg-white/8' : 'bg-[#65D693]/10'"
      />
    </div>

    <Transition name="fade" mode="out-in">

      <!-- LOADING -->
      <div v-if="state === 'loading'" key="loading" class="flex flex-col items-center text-center px-8 gap-7">
        <img src="/tree-nation-icon.png" alt="Tree-Nation" class="w-24 h-24 animate-pulse" />
        <div class="flex gap-2">
          <span class="w-2 h-2 rounded-full bg-[#3aaa68] animate-bounce" style="animation-delay:0ms" />
          <span class="w-2 h-2 rounded-full bg-[#3aaa68] animate-bounce" style="animation-delay:140ms" />
          <span class="w-2 h-2 rounded-full bg-[#3aaa68] animate-bounce" style="animation-delay:280ms" />
        </div>
        <div>
          <p class="text-gray-700 font-bold text-base">Registering your visit…</p>
          <p class="text-gray-400 text-sm mt-1">Identifying your device</p>
        </div>
      </div>

      <!-- TREE EARNED: CELEBRATION -->
      <div
        v-else-if="isCelebration"
        key="celebration"
        class="w-full max-w-sm mx-auto px-6 py-12 flex flex-col items-center text-center"
      >
        <div class="celebrate-pop text-[96px] leading-none mb-5 select-none">🌳</div>

        <h1 class="text-4xl font-black text-white leading-tight mb-2">
          You planted<br/>a tree!
        </h1>
        <p class="text-white/65 text-sm mb-10 leading-relaxed">
          A real tree will be planted in<br/>your name with Tree-Nation
        </p>

        <!-- Big tree count -->
        <div class="w-full bg-white/15 backdrop-blur-sm border border-white/20 rounded-3xl px-8 py-10 mb-5">
          <div class="text-8xl font-black text-white tabular-nums leading-none mb-3">
            {{ result!.treesPlanted }}
          </div>
          <div class="text-white/55 text-xs font-bold uppercase tracking-widest">
            Tree{{ result!.treesPlanted !== 1 ? 's' : '' }} planted by you
          </div>
        </div>

        <!-- New cycle -->
        <div class="w-full bg-white/10 border border-white/15 rounded-2xl p-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-white/55 text-xs font-bold uppercase tracking-widest">Next tree</span>
            <span class="text-white/70 text-xs font-mono">{{ result!.visitsPerTree }} visits to go</span>
          </div>
          <div class="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div class="h-full w-[2%] rounded-full bg-white" />
          </div>
        </div>

        <p class="text-white/25 text-[10px] font-mono mt-8 truncate max-w-full">
          {{ result!.customerId }}
        </p>
      </div>

      <!-- NORMAL VISIT SUCCESS -->
      <div
        v-else-if="state === 'success' && result"
        key="success"
        class="w-full max-w-sm mx-auto px-6 py-8 flex flex-col items-center"
      >
        <img src="/tree-nation-icon.png" alt="Tree-Nation" class="w-20 h-20 mb-6" />

        <div class="text-center mb-8">
          <h1 class="text-2xl font-black text-gray-900 mb-1.5">
            {{ result.totalVisits === 1 ? 'Welcome! 🌱' : 'Welcome back!' }}
          </h1>
          <p class="text-gray-400 text-sm">
            {{ result.totalVisits === 1
              ? 'Your tree journey has begun'
              : `Visit #${result.totalVisits} · device recognized` }}
          </p>
        </div>

        <!-- Progress ring -->
        <div class="relative w-52 h-52 mb-8">
          <svg class="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" stroke-width="7"/>
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke="url(#ringGrad)" stroke-width="7"
              stroke-linecap="round"
              :stroke-dasharray="326.7"
              :stroke-dashoffset="animatedOffset"
              style="transition: stroke-dashoffset 1.2s cubic-bezier(0.34,1.1,0.64,1)"
            />
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#3aaa68"/>
                <stop offset="100%" stop-color="#48C4D8"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-5xl font-black text-gray-900 tabular-nums leading-none">{{ cycleVisits }}</span>
            <span class="text-sm text-gray-400 font-semibold mt-1">of {{ result.visitsPerTree }}</span>
            <span class="text-[10px] text-gray-300 mt-0.5 uppercase tracking-widest font-bold">visits</span>
          </div>
        </div>

        <!-- Stats grid -->
        <div class="grid grid-cols-2 gap-3 w-full mb-4">
          <div class="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
            <div class="text-3xl font-black text-gray-900 tabular-nums">{{ result.totalVisits }}</div>
            <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Total visits</div>
          </div>
          <div class="bg-[#3aaa68]/6 border border-[#3aaa68]/15 rounded-2xl p-4 text-center">
            <div class="text-3xl font-black text-[#3aaa68] tabular-nums">{{ result.treesPlanted }}</div>
            <div class="text-[10px] text-[#3aaa68]/60 font-bold uppercase tracking-widest mt-1">Trees planted</div>
          </div>
        </div>

        <!-- Next tree bar -->
        <div class="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm w-full mb-6">
          <div class="flex items-center justify-between mb-3">
            <span class="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Next tree</span>
            <span class="text-[11px] font-mono font-semibold text-[#3aaa68]">
              {{ result.visitsUntilNextTree }} visit{{ result.visitsUntilNextTree !== 1 ? 's' : '' }} away
            </span>
          </div>
          <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full bg-gradient-to-r from-[#3aaa68] to-[#48C4D8]"
              :style="{ width: progressPct + '%', transition: 'width 1.2s cubic-bezier(0.34,1.1,0.64,1)' }"
            />
          </div>
        </div>

        <!-- Device fingerprint -->
        <div class="flex items-center gap-2 opacity-40">
          <span class="text-sm">🔐</span>
          <span class="text-[10px] text-gray-500 font-mono truncate max-w-[220px]">{{ result.customerId }}</span>
        </div>
      </div>

      <!-- COOLDOWN -->
      <div
        v-else-if="state === 'cooldown'"
        key="cooldown"
        class="w-full max-w-sm mx-auto px-6 py-10 flex flex-col items-center text-center"
      >
        <img src="/tree-nation-icon.png" alt="Tree-Nation" class="w-16 h-16 mb-5 opacity-50" />
        <div class="text-5xl mb-4">⏳</div>
        <h1 class="text-2xl font-black text-gray-900 mb-2">Already registered</h1>
        <p class="text-gray-400 text-sm mb-8 leading-relaxed">
          Your last visit was <strong class="text-gray-600">{{ cooldownMsg }}</strong>.<br/>
          Come back on your next store visit.
        </p>
        <div v-if="result" class="grid grid-cols-2 gap-3 w-full mb-4">
          <div class="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
            <div class="text-2xl font-black text-gray-900 tabular-nums">{{ result.totalVisits }}</div>
            <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Total visits</div>
          </div>
          <div class="bg-[#3aaa68]/6 border border-[#3aaa68]/15 rounded-2xl p-4 text-center">
            <div class="text-2xl font-black text-[#3aaa68] tabular-nums">{{ result.treesPlanted }}</div>
            <div class="text-[10px] text-[#3aaa68]/60 font-bold uppercase tracking-widest mt-1">Trees planted</div>
          </div>
        </div>
        <div v-if="result" class="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm w-full">
          <div class="flex items-center justify-between mb-2.5">
            <span class="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Next tree</span>
            <span class="text-[11px] font-mono text-[#3aaa68]">{{ result.visitsUntilNextTree }}v left</span>
          </div>
          <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div class="h-full rounded-full bg-[#3aaa68]" :style="{ width: progressPct + '%' }" />
          </div>
        </div>
        <p class="text-[10px] text-gray-300 font-mono mt-6 truncate max-w-full">{{ deviceId }}</p>
      </div>

      <!-- ERROR -->
      <div v-else-if="state === 'error'" key="error" class="flex flex-col items-center text-center px-8">
        <img src="/tree-nation-icon.png" alt="Tree-Nation" class="w-16 h-16 mb-6 opacity-35" />
        <div class="text-5xl mb-4">⚠️</div>
        <p class="text-gray-800 font-bold text-lg mb-2">Connection error</p>
        <p class="text-gray-400 text-sm mb-8 font-mono break-all">{{ errorMsg }}</p>
        <button
          @click="recordVisit"
          class="px-10 py-3.5 bg-[#3aaa68] text-white font-bold rounded-full text-sm
                 hover:bg-[#2d8a56] active:scale-95 transition-all duration-150
                 shadow-lg shadow-[#3aaa68]/30"
        >
          Try again
        </button>
      </div>

    </Transition>

    <!-- Brand footer -->
    <div class="absolute bottom-4 flex flex-col items-center gap-1" :class="isCelebration ? 'opacity-25' : 'opacity-20'">
      <div class="flex items-center gap-2">
        <img src="/tree-nation-icon.png" alt="Tree-Nation" class="w-5 h-5" />
        <span class="text-[11px] font-bold" :class="isCelebration ? 'text-white' : 'text-gray-500'">Tree-Nation</span>
      </div>
      <span class="text-[9px] font-mono" :class="isCelebration ? 'text-white' : 'text-gray-400'">
        IP &amp; approximate location collected for visit enrichment
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import confetti from 'canvas-confetti';
import { apiFetch } from '../lib/api';
import type { TrackResult, CustomerListItem, ConfigResponse } from '../types/api';

const route = useRoute();

type AppState = 'loading' | 'success' | 'cooldown' | 'error';

const state = ref<AppState>('loading');
const result = ref<TrackResult | null>(null);
const errorMsg = ref('');
const cooldownMsg = ref('');
const deviceId = ref('');
const animatedOffset = ref(326.7);

const isCelebration = computed(() => state.value === 'success' && result.value?.treeEarned === true);

const bgClass = computed(() =>
  isCelebration.value
    ? 'bg-gradient-to-br from-[#1a5c38] via-[#2d8a56] to-[#3aaa68]'
    : 'bg-gradient-to-b from-[#f0fdf4] to-white',
);

const CUSTOMER_ID_RE = /^[a-zA-Z0-9_.-]{1,100}$/;

// 0 disables the cooldown; set to e.g. 8 * 3600_000 for real deployments.
const VISIT_COOLDOWN_MS = 0;

// SHA-256 of stable browser signals → consistent identity across sessions.
// localStorage is a fast-path cache only; clearing it does not lose history
// because the hash recomputes to the same value on the same device.
async function getDeviceFingerprint(): Promise<string> {
  const fromQuery = (route.query.id as string | undefined)?.trim();
  if (fromQuery && CUSTOMER_ID_RE.test(fromQuery)) {
    try { localStorage.setItem('tree_device_id', fromQuery); } catch { /* private browsing */ }
    return fromQuery;
  }

  try {
    const cached = localStorage.getItem('tree_device_id');
    if (cached) return cached;
  } catch { /* private browsing — recompute each visit */ }

  const signals = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(navigator.hardwareConcurrency ?? ''),
    String((navigator as unknown as Record<string, unknown>).deviceMemory ?? ''),
    String(navigator.maxTouchPoints ?? ''),
    navigator.platform ?? '',
  ].join('||');

  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(signals));
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const fp = `fp-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 28)}`;
  try { localStorage.setItem('tree_device_id', fp); } catch { /* private browsing */ }
  return fp;
}

const cycleVisits = computed(() => {
  if (!result.value) return 0;
  return result.value.visitsPerTree - result.value.visitsUntilNextTree;
});

const progressPct = computed(() => {
  if (!result.value) return 2;
  return Math.min(100, Math.max(2, (cycleVisits.value / result.value.visitsPerTree) * 100));
});

async function recordVisit() {
  state.value = 'loading';
  animatedOffset.value = 326.7;

  try {
    const id = await getDeviceFingerprint();
    deviceId.value = id;

    const cooldownKey = `tree_last_visit_${id}`;
    let lastVisitTs: string | null = null;
    try { lastVisitTs = localStorage.getItem(cooldownKey); } catch { /* private browsing */ }
    const now = Date.now();

    if (lastVisitTs && now - parseInt(lastVisitTs, 10) < VISIT_COOLDOWN_MS) {
      cooldownMsg.value = formatElapsed(now - parseInt(lastVisitTs, 10));
      try {
        const [customer, cfg] = await Promise.all([
          apiFetch<CustomerListItem>(`/api/v1/customers/${encodeURIComponent(id)}`),
          apiFetch<ConfigResponse>('/api/v1/config'),
        ]);
        result.value = { ...customer, treeEarned: false, visitsPerTree: cfg.visitsPerTree };
      } catch { /* stats unavailable — show cooldown screen without data */ }
      state.value = 'cooldown';
      return;
    }

    const tracked = await apiFetch<TrackResult>(`/api/v1/visits/track/${encodeURIComponent(id)}`);

    // Rapid-fire filter returns {} — fetch existing stats and show cooldown instead
    if (!tracked?.customerId) {
      cooldownMsg.value = 'just now';
      try {
        const [customer, cfg] = await Promise.all([
          apiFetch<CustomerListItem>(`/api/v1/customers/${encodeURIComponent(id)}`),
          apiFetch<ConfigResponse>('/api/v1/config'),
        ]);
        result.value = { ...customer, treeEarned: false, visitsPerTree: cfg.visitsPerTree };
      } catch { /* stats unavailable — show cooldown without data */ }
      state.value = 'cooldown';
      return;
    }

    result.value = tracked;
    try { localStorage.setItem(cooldownKey, String(now)); } catch { /* private browsing */ }

    state.value = 'success';

    if (result.value.treeEarned) {
      const colors = ['#3aaa68', '#65D693', '#48C4D8', '#d1fae5', '#ffffff', '#a7f3d0'];
      const burst = (opts: confetti.Options) => confetti({ colors, gravity: 0.85, ...opts });
      setTimeout(() => {
        burst({ particleCount: 120, spread: 80, origin: { y: 0.4 } });
        setTimeout(() => burst({ particleCount: 60, angle: 60,  spread: 60, origin: { x: 0, y: 0.5 } }), 200);
        setTimeout(() => burst({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.5 } }), 350);
      }, 350);
    } else {
      await nextTick();
      setTimeout(() => {
        animatedOffset.value = 326.7 * (1 - cycleVisits.value / result.value!.visitsPerTree);
      }, 80);
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Unknown error';
    state.value = 'error';
  }
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} seconds ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`;
  return `${Math.floor(m / 60)} hour${Math.floor(m / 60) !== 1 ? 's' : ''} ago`;
}

onMounted(recordVisit);
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@keyframes celebrate-pop {
  0%   { transform: scale(0) rotate(-12deg); opacity: 0; }
  60%  { transform: scale(1.25) rotate(6deg); opacity: 1; }
  80%  { transform: scale(0.92) rotate(-3deg); }
  100% { transform: scale(1) rotate(0deg); }
}
.celebrate-pop {
  animation: celebrate-pop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
</style>
