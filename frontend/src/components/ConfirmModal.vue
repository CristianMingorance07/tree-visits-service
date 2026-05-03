<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <Transition name="bd">
      <div
        v-if="modelValue"
        aria-hidden="true"
        class="fixed inset-0 z-[100] bg-gray-950/50 backdrop-blur-[3px]"
        @click="handleBackdropClick"
      />
    </Transition>

    <!-- Sheet / Dialog -->
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-x-0 bottom-0 z-[101] sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-6 sm:pointer-events-none"
      >
        <div
          ref="dialogRef"
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          class="modal-panel relative w-full sm:max-w-md bg-white outline-none
                 rounded-t-[2.5rem] sm:rounded-[2rem] overflow-hidden
                 shadow-[0_-4px_32px_rgba(0,0,0,0.08),0_-1px_0_rgba(0,0,0,0.05)]
                 sm:shadow-[0_32px_64px_-8px_rgba(0,0,0,0.26),0_0_0_1px_rgba(0,0,0,0.05)]
                 sm:pointer-events-auto"
        >
          <!-- Mobile drag handle -->
          <div class="flex justify-center pt-3.5 pb-1 sm:hidden" aria-hidden="true">
            <div class="w-10 h-[3px] rounded-full bg-gray-200" />
          </div>

          <!-- Header -->
          <div class="relative px-6 pt-3 pb-6 sm:pt-7" :class="headerClass">
            <!-- Close button -->
            <button
              type="button"
              :disabled="busy"
              aria-label="Close"
              @click="close"
              class="absolute right-4 top-4 sm:right-5 sm:top-5 z-10
                     w-8 h-8 inline-flex items-center justify-center rounded-full
                     text-gray-400 hover:text-gray-600 hover:bg-black/[0.06]
                     transition-all duration-150 active:scale-90
                     disabled:opacity-30
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
            >
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" class="w-[11px] h-[11px]">
                <path d="M1 1l10 10M11 1L1 11"/>
              </svg>
            </button>

            <!-- Icon -->
            <div
              v-if="$slots.icon"
              class="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-2xl mb-4 ring-1 shadow-sm"
              :class="iconClass"
            >
              <slot name="icon" />
            </div>

            <!-- Label -->
            <p
              v-if="$slots.label"
              class="text-[9px] font-black uppercase tracking-[0.22em] mb-2 leading-none"
              :class="labelClass"
            >
              <slot name="label" />
            </p>

            <!-- Title -->
            <h2
              :id="titleId"
              class="text-[22px] font-black text-gray-900 tracking-tight leading-tight mb-1.5"
            >
              <slot name="title">{{ title }}</slot>
            </h2>

            <!-- Description -->
            <p v-if="description || $slots.description" class="text-[13px] text-gray-500 leading-relaxed">
              <slot name="description">{{ description }}</slot>
            </p>
          </div>

          <!-- Body -->
          <div
            v-if="$slots.default"
            class="px-6 py-5 border-t border-gray-100 max-h-[45vh] overflow-y-auto overscroll-contain"
          >
            <slot />
          </div>

          <!-- Actions -->
          <div
            v-if="$slots.actions"
            class="flex flex-col sm:flex-row sm:justify-end gap-2 px-4 pt-3 border-t border-gray-100"
            :style="{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }"
          >
            <slot name="actions" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';

interface Props {
  modelValue: boolean;
  title?: string;
  description?: string;
  busy?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  variant?: 'default' | 'danger' | 'success';
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm action',
  description: '',
  busy: false,
  closeOnBackdrop: true,
  closeOnEscape: true,
  variant: 'default',
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
  confirm: [];
}>();

const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;
const dialogRef = ref<HTMLElement | null>(null);

const headerClass = computed(() => {
  switch (props.variant) {
    case 'danger':  return 'bg-gradient-to-br from-red-50 to-white';
    case 'success': return 'bg-gradient-to-br from-[#3aaa68]/[0.07] to-white';
    default:        return '';
  }
});

const iconClass = computed(() => {
  switch (props.variant) {
    case 'danger':  return 'bg-red-50 ring-red-100 text-red-500';
    case 'success': return 'bg-[#3aaa68]/[0.1] ring-[#3aaa68]/20 text-[#3aaa68]';
    default:        return 'bg-gray-100 ring-gray-200 text-gray-500';
  }
});

const labelClass = computed(() => {
  switch (props.variant) {
    case 'danger':  return 'text-red-400';
    case 'success': return 'text-[#3aaa68]/70';
    default:        return 'text-gray-400';
  }
});

function close() {
  if (props.busy) return;
  emit('update:modelValue', false);
  emit('close');
}

function handleBackdropClick() {
  if (props.closeOnBackdrop && !props.busy) close();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.closeOnEscape && !props.busy) close();
}

watch(() => props.modelValue, async (open) => {
  if (open) {
    document.addEventListener('keydown', handleKeydown);
    document.body.style.overflow = 'hidden';
    await nextTick();
    dialogRef.value?.focus();
  } else {
    document.removeEventListener('keydown', handleKeydown);
    document.body.style.overflow = '';
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.body.style.overflow = '';
});
</script>

<style scoped>
/* Backdrop */
.bd-enter-active, .bd-leave-active { transition: opacity 0.25s ease; }
.bd-enter-from, .bd-leave-to { opacity: 0; }

/* Mobile: slide up from bottom */
.modal-enter-active .modal-panel {
  transition: transform 0.42s cubic-bezier(0.32, 0.72, 0, 1);
}
.modal-leave-active .modal-panel {
  transition: transform 0.28s cubic-bezier(0.4, 0, 1, 1);
}
.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  transform: translateY(110%);
}

/* Desktop: scale + fade from center */
@media (min-width: 640px) {
  .modal-enter-active .modal-panel {
    transition: transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s ease;
  }
  .modal-leave-active .modal-panel {
    transition: transform 0.22s ease, opacity 0.18s ease;
  }
  .modal-enter-from .modal-panel,
  .modal-leave-to .modal-panel {
    transform: scale(0.94) translateY(12px);
    opacity: 0;
  }
}
</style>
