<template>
  <div class="card-accent p-6">
    <h2 class="text-[#3aaa68] text-xs font-bold uppercase tracking-widest mb-5">Customer Lookup</h2>

    <form @submit.prevent="lookup" class="flex gap-2 mb-5">
      <input
        v-model.trim="customerId"
        type="text"
        placeholder="Enter customer ID…"
        class="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#65D693] focus:ring-2 focus:ring-[#65D693]/20 transition-all duration-200"
        :disabled="isSearching"
        maxlength="100"
      />
      <button
        type="submit"
        :disabled="!customerId || isSearching"
        class="bg-[#48C4D8] text-gray-900 font-semibold text-sm rounded-xl px-5 py-2.5 disabled:opacity-40 hover:bg-[#6dd4e3] active:scale-95 transition-all duration-150"
      >
        {{ isSearching ? '…' : 'Search' }}
      </button>
    </form>

    <Transition name="result">
      <div v-if="customer" key="found" class="grid grid-cols-3 gap-3">
        <div class="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
          <div class="text-gray-900 text-2xl font-black tabular-nums">{{ customer.totalVisits }}</div>
          <div class="text-gray-400 text-xs mt-1">Total visits</div>
        </div>
        <div class="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
          <div class="text-gray-900 text-2xl font-black tabular-nums">{{ customer.treesPlanted }}</div>
          <div class="text-gray-400 text-xs mt-1">Trees planted</div>
        </div>
        <div class="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
          <div class="text-[#3aaa68] text-2xl font-black tabular-nums">{{ customer.visitsUntilNextTree }}</div>
          <div class="text-gray-400 text-xs mt-1">Until next tree</div>
        </div>
      </div>
      <div
        v-else-if="notFound"
        key="not-found"
        class="text-gray-400 text-sm text-center py-4 italic"
      >
        No customer found for
        <span class="font-mono text-gray-600 not-italic">{{ lastId }}</span>
      </div>
      <div
        v-else-if="fetchError"
        key="fetch-error"
        class="text-red-500 text-sm text-center py-4"
      >
        {{ fetchError }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { apiFetch, ApiError } from '../lib/api';
import type { CustomerResponse } from '../types/api';

const customerId = ref('');
const customer = ref<CustomerResponse | null>(null);
const notFound = ref(false);
const fetchError = ref<string | null>(null);
const isSearching = ref(false);
const lastId = ref('');

async function lookup() {
  if (!customerId.value) return;

  isSearching.value = true;
  customer.value = null;
  notFound.value = false;
  fetchError.value = null;
  lastId.value = customerId.value;

  try {
    customer.value = await apiFetch<CustomerResponse>(
      `/api/v1/customers/${encodeURIComponent(customerId.value)}`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound.value = true;
    } else {
      fetchError.value = err instanceof Error ? err.message : 'Request failed';
    }
  } finally {
    isSearching.value = false;
  }
}
</script>

<style scoped>
.result-enter-active,
.result-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.result-enter-from,
.result-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
