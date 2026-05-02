<template>
  <div class="space-y-4">

    <!-- Share card -->
    <div class="card-accent p-6">

      <!-- Empty state: hero QR -->
      <Transition name="mode" mode="out-in">
        <div v-if="!scans.length" key="empty" class="text-center">
          <div class="flex justify-center mb-5">
            <div class="w-14 h-14 rounded-[20px] bg-[#3aaa68] flex items-center justify-center shadow-lg shadow-[#3aaa68]/30">
              <svg class="w-8 h-8" viewBox="0 0 36 44" fill="none">
                <path d="M18 1L1 18.5H9.5L3 30H13V43H23V30H33L26.5 18.5H35L18 1Z" fill="white" fill-rule="evenodd"/>
              </svg>
            </div>
          </div>
          <h2 class="text-xl font-black text-gray-900 mb-2">Start tracking real visits</h2>
          <p class="text-gray-400 text-sm mb-8 max-w-xs mx-auto">
            Share this QR — each device that scans it gets its own personal tree journey
          </p>

          <div class="flex justify-center mb-5">
            <div class="p-3 rounded-2xl border-2 border-gray-100 bg-white shadow-sm inline-block">
              <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code" class="w-48 h-48 rounded-xl block" />
              <div v-else class="w-48 h-48 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          </div>

          <p class="text-[11px] font-mono text-gray-300 mb-6 break-all px-4">{{ trackUrl }}</p>

          <div class="flex justify-center gap-3 flex-wrap">
            <a
              :href="whatsappUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#25D366] text-white text-sm font-bold
                     hover:bg-[#1ebd5a] active:scale-95 transition-all duration-150 shadow-sm"
            >
              <WhatsAppIcon />
              Share on WhatsApp
            </a>
            <button
              @click="copyLink"
              class="flex items-center gap-2 px-6 py-2.5 rounded-full border border-gray-200 text-gray-600 text-sm font-bold
                     hover:border-gray-300 hover:bg-gray-50 active:scale-95 transition-all duration-150"
            >
              {{ copied ? '✓ Copied!' : '📋 Copy link' }}
            </button>
          </div>
        </div>

        <!-- With data: compact share bar -->
        <div v-else key="compact" class="flex items-center gap-5">
          <div class="shrink-0">
            <div class="p-1.5 rounded-xl border border-gray-100 bg-white inline-block">
              <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code" class="w-14 h-14 rounded-lg block" />
              <div v-else class="w-14 h-14 rounded-lg bg-gray-100 animate-pulse" />
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="text-[#3aaa68] text-xs font-bold uppercase tracking-widest mb-1">Live tracking active</h2>
            <p class="text-[10px] font-mono text-gray-300 truncate mb-3">{{ trackUrl }}</p>
            <div class="flex items-center gap-2 flex-wrap">
              <a
                :href="whatsappUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full bg-[#25D366] text-white
                       hover:bg-[#1ebd5a] active:scale-95 transition-all duration-150"
              >
                <WhatsAppIcon class="w-3 h-3" />
                WhatsApp
              </a>
              <button
                @click="copyLink"
                class="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full border border-gray-200 text-gray-500
                       hover:border-gray-300 active:scale-95 transition-all duration-150"
              >
                {{ copied ? '✓ Copied!' : 'Copy link' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Live feed -->
    <div class="card-accent p-6">
      <div class="flex items-center justify-between mb-5">
        <div>
          <h2 class="text-[#3aaa68] text-xs font-bold uppercase tracking-widest">Live Scan Feed</h2>
          <p class="text-gray-400 text-[10px] mt-0.5">Real device visits · updates automatically</p>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-[#3aaa68] animate-pulse" />
          <span class="text-[10px] text-[#3aaa68] font-bold">LIVE</span>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="!scans.length"
        class="flex flex-col items-center justify-center text-center py-12"
      >
        <div class="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl mb-3">📡</div>
        <p class="text-gray-500 text-xs font-semibold mb-1">Waiting for real scans</p>
        <p class="text-gray-300 text-[10px] leading-relaxed max-w-[180px]">
          Scan or share the QR above — device visits will appear here instantly
        </p>
      </div>

      <!-- Feed -->
      <TransitionGroup v-else name="scan" tag="div" class="space-y-2">
        <div
          v-for="scan in scans"
          :key="scan.id"
          class="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5"
        >
          <span class="text-xl shrink-0 leading-none">{{ deviceIcon(scan.device.type) }}</span>
          <div class="flex-1 min-w-0">
            <div class="text-[11px] font-bold text-gray-700 font-mono truncate leading-none mb-0.5">
              {{ scan.customerId }}
            </div>
            <div class="text-[10px] text-gray-400 leading-none">
              {{ scan.device.browser }} · {{ scan.device.os }}
              <span class="text-gray-200 mx-1">·</span>
              <span class="capitalize">{{ scan.device.type }}</span>
            </div>
          </div>
          <span class="text-[10px] text-gray-300 font-mono shrink-0">{{ timeAgo(scan.visitedAt) }}</span>
        </div>
      </TransitionGroup>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineComponent, h } from 'vue';
import QRCode from 'qrcode';
import type { RecentScan } from '../types/api';

const props = defineProps<{
  scans: RecentScan[];
  visitsPerTree: number;
}>();

const qrDataUrl = ref<string | null>(null);
const copied = ref(false);

const trackUrl = `${window.location.origin}/track`;

const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
  `🌳 Scan this to track your visit and help plant trees!\n${trackUrl}`
)}`;

onMounted(async () => {
  try {
    qrDataUrl.value = await QRCode.toDataURL(trackUrl, {
      width: 240,
      margin: 1,
      color: { dark: '#111827', light: '#ffffff' },
    });
  } catch { /* silently fail */ }
});

async function copyLink() {
  await navigator.clipboard.writeText(trackUrl);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

function deviceIcon(type: string): string {
  if (type === 'mobile') return '📱';
  if (type === 'tablet') return '📟';
  return '💻';
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const WhatsAppIcon = defineComponent({
  render() {
    return h('svg', { viewBox: '0 0 24 24', fill: 'currentColor', class: 'w-4 h-4' }, [
      h('path', {
        d: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
      }),
    ]);
  },
});
</script>

<style scoped>
.mode-enter-active,
.mode-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.mode-enter-from,
.mode-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.scan-move,
.scan-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.scan-leave-active {
  transition: all 0.3s ease;
  position: absolute;
  width: 100%;
}
.scan-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.96);
}
.scan-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
