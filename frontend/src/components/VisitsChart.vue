<template>
  <div class="relative" style="height: 200px;">
    <canvas ref="canvasRef" class="w-full h-full" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { Chart } from 'chart.js/auto';
import type { ScriptableContext } from 'chart.js';
import type { HourlyDataPoint } from '../types/api';

const props = defineProps<{ data: HourlyDataPoint[] }>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let chart: Chart | null = null;

function fill24Hours(data: HourlyDataPoint[]): HourlyDataPoint[] {
  const byHour = new Map<string, number>();
  for (const d of data) {
    byHour.set(d.hour.slice(0, 13), d.count);
  }
  const result: HourlyDataPoint[] = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(d.getHours() - i, 0, 0, 0);
    const key = d.toISOString().slice(0, 13);
    result.push({ hour: d.toISOString(), count: byHour.get(key) ?? 0 });
  }
  return result;
}

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function makeGradient(ctx: CanvasRenderingContext2D, top: number, bottom: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(58, 170, 104, 0.22)');
  g.addColorStop(0.6, 'rgba(58, 170, 104, 0.06)');
  g.addColorStop(1, 'rgba(58, 170, 104, 0)');
  return g;
}

onMounted(() => {
  if (!canvasRef.value) return;
  const filled = fill24Hours(props.data);

  chart = new Chart(canvasRef.value, {
    type: 'line',
    data: {
      labels: filled.map(d => formatHour(d.hour)),
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
          return (context.raw as number) > 0 ? 3 : 0;
        },
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#3aaa68',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeInOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff',
          titleColor: '#111827',
          bodyColor: '#6b7280',
          borderColor: 'rgba(58, 170, 104, 0.25)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          displayColors: false,
          callbacks: {
            title: ([item]) => item.label,
            label: (item) => `${item.parsed.y} visit${item.parsed.y !== 1 ? 's' : ''}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#d1d5db',
            font: { size: 10, family: 'ui-monospace, SFMono-Regular, monospace' },
            maxRotation: 0,
            maxTicksLimit: 12,
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
});

watch(
  () => props.data,
  (newData) => {
    if (!chart) return;
    const filled = fill24Hours(newData);
    chart.data.labels = filled.map(d => formatHour(d.hour));
    chart.data.datasets[0].data = filled.map(d => d.count);
    chart.update('active');
  },
  { deep: true },
);

onUnmounted(() => { chart?.destroy(); });
</script>
