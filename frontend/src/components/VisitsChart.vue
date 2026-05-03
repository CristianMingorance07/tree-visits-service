<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-[#3aaa68] text-xs font-bold uppercase tracking-widest">Visit Activity</h2>
        <p class="text-[10px] text-gray-300 font-mono mt-0.5">
          {{ total }} visit{{ total !== 1 ? 's' : '' }} · {{ rangeLabel }}
        </p>
      </div>
      <div class="flex bg-gray-50 rounded-xl p-0.5">
        <button
          v-for="r in RANGES"
          :key="r.value"
          @click="selectRange(r.value)"
          class="px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all duration-150"
          :class="selectedRange === r.value
            ? 'bg-white shadow-sm text-gray-800'
            : 'text-gray-400 hover:text-gray-600'"
        >
          {{ r.label }}
        </button>
      </div>
    </div>

    <div class="relative" style="height: 180px">
      <canvas ref="canvasRef" class="w-full h-full" />
      <Transition name="fade">
        <div
          v-if="loading"
          class="absolute inset-0 bg-white/70 rounded-lg flex items-center justify-center"
        >
          <div class="w-5 h-5 border-2 border-[#3aaa68] border-t-transparent rounded-full animate-spin" />
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Chart } from 'chart.js/auto';
import type { ScriptableContext } from 'chart.js';

type Range = '24h' | '7d' | '30d';
type Granularity = 'hour' | 'day';
interface DataPoint { label: string; count: number; }

const props = defineProps<{
  filter?: 'all' | 'real';
  lastUpdated?: Date | null;
}>();

const RANGES: { value: Range; label: string; description: string }[] = [
  { value: '24h', label: '24H', description: 'Last 24 hours' },
  { value: '7d',  label: '7D',  description: 'Last 7 days'   },
  { value: '30d', label: '30D', description: 'Last 30 days'  },
];

const canvasRef    = ref<HTMLCanvasElement | null>(null);
const selectedRange = ref<Range>('24h');
const total        = ref(0);
const loading      = ref(true);

let chart: Chart | null = null;
let rawLabels: string[] = [];
let currentGran: Granularity = 'hour';
let activeRange: Range | null = null;

const rangeLabel = computed(() =>
  RANGES.find(r => r.value === selectedRange.value)?.description ?? ''
);

function fillGaps(data: DataPoint[], range: Range, gran: Granularity): DataPoint[] {
  const keyLen = gran === 'hour' ? 13 : 10;
  const byKey  = new Map(data.map(d => [d.label.slice(0, keyLen), d.count]));
  const result: DataPoint[] = [];
  const now = new Date();

  if (gran === 'hour') {
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(d.getHours() - i, 0, 0, 0);
      const key = d.toISOString().slice(0, 13);
      result.push({ label: d.toISOString(), count: byKey.get(key) ?? 0 });
    }
  } else {
    const days = range === '7d' ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({ label: key, count: byKey.get(key) ?? 0 });
    }
  }
  return result;
}

function fmtAxisLabel(label: string, gran: Granularity): string {
  if (gran === 'hour') {
    return new Date(label).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  const d = new Date(label + 'T12:00:00');
  return selectedRange.value === '7d'
    ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
    : d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

function fmtTooltipDate(label: string, gran: Granularity): string {
  if (gran === 'hour') {
    return new Date(label).toLocaleString('en-GB', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }
  return new Date(label + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function makeGradient(ctx: CanvasRenderingContext2D, top: number, bottom: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0,   'rgba(58,170,104,0.22)');
  g.addColorStop(0.6, 'rgba(58,170,104,0.06)');
  g.addColorStop(1,   'rgba(58,170,104,0)');
  return g;
}

function buildChart(filled: DataPoint[], gran: Granularity) {
  if (!canvasRef.value) return;
  chart?.destroy();

  chart = new Chart(canvasRef.value, {
    type: 'line',
    data: {
      labels: filled.map(d => fmtAxisLabel(d.label, gran)),
      datasets: [{
        label: 'Visits',
        data: filled.map(d => d.count),
        borderColor: '#3aaa68',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        backgroundColor(context: ScriptableContext<'line'>) {
          const { ctx, chartArea } = context.chart;
          if (!chartArea) return 'transparent';
          return makeGradient(ctx, chartArea.top, chartArea.bottom);
        },
        pointBackgroundColor: '#3aaa68',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius(context: ScriptableContext<'line'>) {
          return (context.raw as number) > 0 ? (gran === 'hour' ? 3 : 4) : 0;
        },
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#3aaa68',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeInOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff',
          titleColor: '#111827',
          bodyColor: '#6b7280',
          borderColor: 'rgba(58,170,104,0.25)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            title: ([item]) => fmtTooltipDate(rawLabels[item.dataIndex] ?? '', currentGran),
            label: (item) => `${item.parsed.y} visit${item.parsed.y !== 1 ? 's' : ''}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#d1d5db',
            font: { size: 10, family: 'ui-monospace,SFMono-Regular,monospace' },
            maxRotation: 0,
            maxTicksLimit: gran === 'hour' ? 12 : (selectedRange.value === '7d' ? 7 : 10),
          },
          grid: { display: false },
          border: { color: 'rgba(0,0,0,0.06)' },
        },
        y: {
          ticks: {
            color: '#d1d5db',
            font: { size: 10 },
            precision: 0,
            maxTicksLimit: 5,
          },
          grid: { color: 'rgba(0,0,0,0.04)', tickLength: 0 },
          border: { display: false },
          beginAtZero: true,
        },
      },
    },
  });
}

async function fetchAndUpdate() {
  loading.value = true;
  try {
    const res = await fetch(
      `/api/v1/visits/chart?range=${selectedRange.value}&filter=${props.filter ?? 'all'}`
    );
    if (!res.ok) return;
    const json = await res.json() as { data: DataPoint[]; total: number; granularity: Granularity };
    const filled = fillGaps(json.data, selectedRange.value, json.granularity);
    total.value  = json.total;
    rawLabels    = filled.map(d => d.label);
    currentGran  = json.granularity;

    if (activeRange !== selectedRange.value || !chart) {
      activeRange = selectedRange.value;
      buildChart(filled, json.granularity);
    } else {
      chart.data.labels             = filled.map(d => fmtAxisLabel(d.label, json.granularity));
      chart.data.datasets[0].data   = filled.map(d => d.count);
      chart.update('active');
    }
  } catch { /* network error — keep showing last data */ }
  finally { loading.value = false; }
}

async function selectRange(range: Range) {
  if (range === selectedRange.value) return;
  selectedRange.value = range;
  await fetchAndUpdate();
}

watch(() => props.lastUpdated, fetchAndUpdate);
onMounted(fetchAndUpdate);
onUnmounted(() => { chart?.destroy(); });
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from,   .fade-leave-to     { opacity: 0; }
</style>
