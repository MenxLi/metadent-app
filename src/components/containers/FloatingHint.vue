<script lang="ts" setup>
withDefaults(defineProps<{
  title?: string;
  body: string;
  positionClass?: string;
  tone?: 'info' | 'success' | 'error';
  busy?: boolean;
  dismissible?: boolean;
}>(), {
  title: 'Hint',
  positionClass: 'top-2 right-2',
  tone: 'info',
  busy: false,
  dismissible: true,
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();
</script>

<template>
  <div
    :class="[
      'absolute z-10 max-w-72 rounded-lg border px-3 py-2 text-white shadow-md backdrop-blur-sm pointer-events-auto',
      tone === 'success' ? 'border-emerald-200/30 bg-emerald-900/78' : '',
      tone === 'error' ? 'border-rose-200/35 bg-rose-900/78' : '',
      tone === 'info' ? 'border-cyan-200/30 bg-stone-950/78' : '',
      positionClass,
    ]"
    role="status"
    aria-live="polite"
  >
    <div class="flex items-start gap-2">
      <span
        v-if="busy"
        class="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-3.2-6.9" />
        </svg>
      </span>
      <div class="min-w-0 grow">
        <div class="text-[10px] font-semibold uppercase tracking-[0.12em]">
          {{ title }}
        </div>
        <p class="mt-1 text-xs leading-4 text-white/85">{{ body }}</p>
      </div>
      <button
        v-if="dismissible"
        type="button"
        class="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-white"
        aria-label="Dismiss hint"
        title="Dismiss"
        @click.stop="emit('close')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-3.5 w-3.5">
          <path d="M4.22 4.22a.75.75 0 0 1 1.06 0L8 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L9.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L8 9.06l-2.72 2.72a.75.75 0 1 1-1.06-1.06L6.94 8 4.22 5.28a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>
    </div>
  </div>
</template>
