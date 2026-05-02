<template>
  <div class="min-h-screen bg-gradient-to-b from-[#f0fdf4] to-white flex flex-col items-center justify-center p-6 relative overflow-hidden">

    <Transition name="fade" mode="out-in">

      <!-- Loading / fingerprinting -->
      <div v-if="state === 'loading'" key="loading" class="text-center">
        <div class="w-20 h-20 rounded-[28px] bg-[#3aaa68] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[#3aaa68]/30 animate-pulse">
          <TreeIcon class="w-11 h-11 text-white" />
        </div>
        <p class="text-gray-400 text-sm font-medium tracking-wide">Identifying your device…</p>
        <p class="text-gray-300 text-[10px] mt-1">Computing device fingerprint</p>
      </div>

      <!-- Already visited recently (cooldown) -->
      <div v-else-if="state === 'cooldown'" key="cooldown" class="max-w-sm w-full text-center">
        <div class="w-20 h-20 rounded-[28px] bg-amber-50 border-2 border-amber-100 flex items-center justify-center mx-auto mb-6">
          <span class="text-4xl">⏳</span>
        </div>
        <h1 class="text-2xl font-black text-gray-900 mb-2">Already registered</h1>
        <p class="text-gray-400 text-sm mb-8">
          Your last visit was registered <strong>{{ cooldownMsg }}</strong>.<br/>
          Come back after your next real store visit.
        </p>
        <div v-if="result" class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
              <div class="text-2xl font-black text-gray-900 tabular-nums">{{ result.totalVisits }}</div>
              <div class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">Total visits</div>
            </div>
            <div class="bg-[#3aaa68]/6 border border-[#3aaa68]/15 rounded-2xl p-4 text-center">
              <div class="text-2xl font-black text-[#3aaa68] tabular-nums">{{ result.treesPlanted }}</div>
              <div class="text-[10px] text-[#3aaa68]/60 font-semibold uppercase tracking-wider mt-1">Trees planted</div>
            </div>
          </div>
          <div class="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Next tree</span>
              <span class="text-[11px] font-mono text-[#3aaa68]">{{ result.visitsUntilNextTree }}v left</span>
            </div>
            <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full bg-[#3aaa68]" :style="{ width: progressPct + '%' }" />
            </div>
          </div>
        </div>
        <p class="text-center text-[10px] text-gray-300 font-mono mt-6">{{ deviceId }}</p>
      </div>

      <!-- Tree earned: celebration -->
      <div v-else-if="state === 'success' && result?.treeEarned" key="celebration" class="text-center max-w-sm w-full">
        <div class="w-28 h-28 rounded-[36px] bg-gradient-to-br from-[#3aaa68] to-[#65D693] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-[#3aaa68]/40">
          <span class="text-6xl leading-none">🌳</span>
        </div>
        <h1 class="text-3xl font-black text-gray-900 mb-2">Tree Planted!</h1>
        <p class="text-gray-400 text-sm mb-8">A new tree has been planted in your name 🎉</p>

        <div class="bg-[#3aaa68]/8 border border-[#3aaa68]/20 rounded-3xl p-8 mb-5">
          <div class="text-6xl font-black text-[#3aaa68] mb-1 tabular-nums">{{ result!.treesPlanted }}</div>
          <div class="text-xs font-bold text-[#3aaa68]/50 uppercase tracking-widest">Total trees planted</div>
        </div>

        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-6">
          <div class="flex items-center justify-between mb-2.5">
            <span class="text-[11px] font-bold text-gray-400 uppercase tracking-widest">New cycle begins</span>
            <span class="text-[11px] font-mono text-[#3aaa68]">0 / {{ result!.visitsPerTree }}</span>
          </div>
          <div class="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div class="h-full w-[2%] rounded-full bg-[#3aaa68]" />
          </div>
          <p class="text-[11px] text-gray-400 mt-2.5">{{ result!.visitsPerTree }} more visits to plant your next tree</p>
        </div>

        <p class="text-[10px] text-gray-300 font-mono">{{ result!.customerId }}</p>
      </div>

      <!-- Normal visit success -->
      <div v-else-if="state === 'success' && result" key="success" class="max-w-sm w-full">

        <div class="text-center mb-8">
          <div class="w-20 h-20 rounded-[28px] bg-[#3aaa68] flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#3aaa68]/30">
            <TreeIcon class="w-11 h-11 text-white" />
          </div>
          <!-- First visit vs returning -->
          <div v-if="result.totalVisits === 1">
            <h1 class="text-2xl font-black text-gray-900 mb-1">Welcome! 🌱</h1>
            <p class="text-gray-400 text-sm">Your first visit has been recorded</p>
          </div>
          <div v-else>
            <h1 class="text-2xl font-black text-gray-900 mb-1">Welcome back!</h1>
            <p class="text-gray-400 text-sm">Visit #{{ result.totalVisits }} recorded · your device is recognized</p>
          </div>
        </div>

        <!-- Progress ring -->
        <div class="flex justify-center mb-8">
          <div class="relative w-36 h-36">
            <svg class="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" stroke-width="8" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                stroke="#3aaa68" stroke-width="8"
                stroke-linecap="round"
                :stroke-dasharray="326.7"
                :stroke-dashoffset="animatedOffset"
                style="transition: stroke-dashoffset 1s cubic-bezier(0.34,1.1,0.64,1)"
              />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-3xl font-black text-gray-900 tabular-nums leading-none">{{ cycleVisits }}</span>
              <span class="text-[11px] text-gray-400 font-semibold mt-0.5">of {{ result.visitsPerTree }}</span>
            </div>
          </div>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-center">
            <div class="text-2xl font-black text-gray-900 tabular-nums">{{ result.totalVisits }}</div>
            <div class="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-1">Total visits</div>
          </div>
          <div class="bg-[#3aaa68]/6 border border-[#3aaa68]/15 rounded-2xl p-4 text-center">
            <div class="text-2xl font-black text-[#3aaa68] tabular-nums">{{ result.treesPlanted }}</div>
            <div class="text-[10px] text-[#3aaa68]/60 font-semibold uppercase tracking-wider mt-1">Trees planted</div>
          </div>
        </div>

        <!-- Next tree -->
        <div class="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4">
          <div class="flex items-center justify-between mb-2.5">
            <span class="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Next tree</span>
            <span class="text-[11px] font-mono text-[#3aaa68] font-semibold">
              {{ result.visitsUntilNextTree }} visit{{ result.visitsUntilNextTree !== 1 ? 's' : '' }} left
            </span>
          </div>
          <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full bg-[#3aaa68]"
              :style="{ width: progressPct + '%', transition: 'width 1s cubic-bezier(0.34,1.1,0.64,1)' }"
            />
          </div>
        </div>

        <!-- Device identity info -->
        <div class="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3">
          <span class="text-lg">🔐</span>
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-bold text-gray-500 mb-0.5">Device fingerprint</p>
            <p class="text-[9px] font-mono text-gray-300 truncate">{{ result.customerId }}</p>
          </div>
          <span
            class="shrink-0 text-[9px] font-bold px-2 py-1 rounded-full"
            :class="result.totalVisits === 1
              ? 'bg-blue-50 text-blue-400 border border-blue-100'
              : 'bg-[#3aaa68]/8 text-[#3aaa68] border border-[#3aaa68]/15'"
          >
            {{ result.totalVisits === 1 ? 'New device' : 'Recognized' }}
          </span>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="state === 'error'" key="error" class="text-center max-w-xs w-full">
        <div class="text-5xl mb-5">⚠️</div>
        <p class="text-gray-800 font-bold mb-2">Connection error</p>
        <p class="text-gray-400 text-sm mb-7 font-mono">{{ errorMsg }}</p>
        <button
          @click="recordVisit"
          class="px-8 py-3 bg-[#3aaa68] text-white font-bold rounded-full text-sm hover:bg-[#2d8a56] transition-colors active:scale-95"
        >
          Try again
        </button>
      </div>

    </Transition>

    <!-- Brand footer -->
    <div class="absolute bottom-6 flex items-center gap-2 opacity-30">
      <div class="w-5 h-5 rounded-md bg-[#3aaa68] flex items-center justify-center">
        <TreeIcon class="w-3 h-3 text-white" />
      </div>
      <span class="text-[11px] font-bold text-gray-500">Tree-Nation Tracker</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, h, defineComponent } from 'vue';
import { useRoute } from 'vue-router';
import confetti from 'canvas-confetti';
import type { ScanResult } from '../types/api';

const route = useRoute();

type AppState = 'loading' | 'success' | 'cooldown' | 'error';

const state = ref<AppState>('loading');
const result = ref<ScanResult | null>(null);
const errorMsg = ref('');
const cooldownMsg = ref('');
const deviceId = ref('');
const animatedOffset = ref(326.7);

// ─── Cooldown: minimum interval between counted visits ─────────────────────
// Prevents the same physical visit from being counted multiple times if the
// user refreshes or re-opens the browser shortly after. Tune per use-case.
const VISIT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// ─── Device fingerprinting ─────────────────────────────────────────────────
// Derives a deterministic ID from stable browser/hardware signals using
// SHA-256. The resulting hash is stable across sessions on the same device,
// so clearing localStorage does NOT lose the visitor's history.
// localStorage acts only as a fast cache to avoid recomputing on every visit.
async function getDeviceFingerprint(): Promise<string> {
  // (1) Admin-generated per-device QR overrides everything
  const fromQuery = route.query.id as string | undefined;
  if (fromQuery) {
    localStorage.setItem('tree_device_id', fromQuery);
    return fromQuery;
  }

  // (2) Fast path: cached fingerprint already in localStorage
  const cached = localStorage.getItem('tree_device_id');
  if (cached) return cached;

  // (3) Compute fingerprint from stable, device-specific signals
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

  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(signals),
  );
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Format as fp-xxxxxxxx-xxxx-xxxx-xxxxxxxxxxxx (visually distinct in admin)
  const fp = `fp-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 28)}`;
  localStorage.setItem('tree_device_id', fp);
  return fp;
}

// ─── Computed ──────────────────────────────────────────────────────────────
const cycleVisits = computed(() => {
  if (!result.value) return 0;
  return result.value.visitsPerTree - result.value.visitsUntilNextTree;
});

const progressPct = computed(() => {
  if (!result.value) return 2;
  return Math.min(100, Math.max(2, (cycleVisits.value / result.value.visitsPerTree) * 100));
});

// ─── Main flow ─────────────────────────────────────────────────────────────
async function recordVisit() {
  state.value = 'loading';
  animatedOffset.value = 326.7;

  try {
    const id = await getDeviceFingerprint();
    deviceId.value = id;

    // Cooldown check: avoid double-counting within the same physical visit
    const cooldownKey = `tree_last_visit_${id}`;
    const lastVisitTs = localStorage.getItem(cooldownKey);
    const now = Date.now();

    if (lastVisitTs && now - parseInt(lastVisitTs, 10) < VISIT_COOLDOWN_MS) {
      // Within cooldown — fetch current stats without registering a new visit
      cooldownMsg.value = formatElapsed(now - parseInt(lastVisitTs, 10));
      const statsRes = await fetch(`/api/v1/customers/${encodeURIComponent(id)}`);
      if (statsRes.ok) {
        const customer = await statsRes.json() as {
          customerId: string; totalVisits: number; treesPlanted: number;
          lastSeen: string; visitsUntilNextTree: number;
        };
        result.value = { ...customer, treeEarned: false, visitsPerTree: 10 };
        // Get real visitsPerTree from config
        const cfgRes = await fetch('/api/v1/config');
        if (cfgRes.ok) {
          const cfg = await cfgRes.json() as { visitsPerTree: number };
          result.value.visitsPerTree = cfg.visitsPerTree;
        }
      }
      state.value = 'cooldown';
      return;
    }

    // Register visit
    const res = await fetch(`/api/v1/visits/scan/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    result.value = await res.json() as ScanResult;

    // Persist cooldown timestamp after successful registration
    localStorage.setItem(cooldownKey, String(now));

    state.value = 'success';

    if (result.value.treeEarned) {
      setTimeout(() => {
        confetti({
          particleCount: 130, spread: 80, origin: { y: 0.35 },
          colors: ['#3aaa68', '#65D693', '#d1fae5', '#ffffff', '#a7f3d0'],
          gravity: 0.85,
        });
      }, 250);
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

// ─── Inline component ──────────────────────────────────────────────────────
const TreeIcon = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs }) {
    return () => h('svg', { viewBox: '0 0 36 44', fill: 'none', ...attrs }, [
      h('path', { d: 'M18 1L1 18.5H9.5L3 30H13V43H23V30H33L26.5 18.5H35L18 1Z', fill: 'currentColor', 'fill-rule': 'evenodd' }),
    ]);
  },
});
</script>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
