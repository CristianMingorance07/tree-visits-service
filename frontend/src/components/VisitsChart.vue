<template>
  <div class="relative h-56">
    <canvas ref="canvasRef" class="w-full h-full" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { Chart } from 'chart.js/auto';
import type { ScriptableContext } from 'chart.js';
import type { HourlyDataPoint } from '../types/api';

const props = defineProps<{
  data: HourlyDataPoint[];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let chart: Chart | null = null;

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function makeGradient(ctx: CanvasRenderingContext2D, top: number, bottom: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(101, 214, 147, 0.8)');
  g.addColorStop(1, 'rgba(101, 214, 147, 0.08)');
  return g;
}

onMounted(() => {
  if (!canvasRef.value) return;

  chart = new Chart(canvasRef.value, {
    type: 'bar',
    data: {
      labels: props.data.map((d) => formatHour(d.hour)),
      datasets: [
        {
          label: 'Visits',
          data: props.data.map((d) => d.count),
          backgroundColor(context: ScriptableContext<'bar'>) {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return 'rgba(101, 214, 147, 0.6)';
            return makeGradient(ctx, chartArea.top, chartArea.bottom);
          },
          borderColor: 'rgba(58, 170, 104, 0.6)',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#ffffff',
          titleColor: '#111827',
          bodyColor: '#6b7280',
          borderColor: 'rgba(101, 214, 147, 0.5)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (item) =>
              ` ${item.parsed.y} visit${item.parsed.y !== 1 ? 's' : ''}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#9ca3af', font: { size: 11 }, maxRotation: 45 },
          grid: { color: 'rgba(0,0,0,0.05)' },
          border: { color: 'rgba(0,0,0,0.08)' },
        },
        y: {
          ticks: { color: '#9ca3af', font: { size: 11 }, stepSize: 1 },
          grid: { color: 'rgba(0,0,0,0.05)' },
          border: { color: 'rgba(0,0,0,0.08)' },
          beginAtZero: true,
        },
      },
    },
  });
});

watch(
  () => props.data,
  () => {
    if (!chart) return;
    chart.data.labels = props.data.map((d) => formatHour(d.hour));
    chart.data.datasets[0].data = props.data.map((d) => d.count);
    chart.update('none');
  },
  { deep: true },
);

onUnmounted(() => {
  chart?.destroy();
});
</script>
