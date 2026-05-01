<template>
  <div
    class="card-accent p-6 text-center transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md cursor-default"
  >
    <div class="text-xl mb-3" role="img" :aria-label="title">{{ icon }}</div>
    <div class="text-[#3aaa68] text-xs font-bold uppercase tracking-widest mb-3">{{ title }}</div>
    <div class="text-gray-900 text-5xl font-black leading-none mb-2 tabular-nums">
      {{ displayed.toLocaleString() }}
    </div>
    <div class="text-gray-400 text-sm">{{ subtitle }}</div>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useCountUp } from '../composables/useCountUp';

const props = defineProps<{
  title: string;
  value: number;
  subtitle: string;
  icon: string;
}>();

const { displayed, animateTo } = useCountUp();
watch(() => props.value, (v) => animateTo(v), { immediate: true });
</script>
