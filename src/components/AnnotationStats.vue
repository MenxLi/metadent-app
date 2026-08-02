<template>
  <div v-if="statStore.enabled" class="flex h-8 items-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 shadow-sm">
    <div v-if="showStats" class="flex h-full items-center divide-x divide-slate-100">
      <span class="inline-flex h-full items-center gap-1.5 px-2.5 font-mono tabular-nums text-slate-700" title="Annotation time">
        <svg viewBox="0 0 20 20" class="h-3.5 w-3.5 text-sky-600" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <circle cx="10" cy="10" r="6.5" />
          <path d="M10 6.5v3.75l2.5 1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        {{ formatDuration(statStore.totalSeconds) }}
      </span>
      <span class="inline-flex h-full items-center gap-1.5 px-2.5 tabular-nums" :title="`${statStore.manualInputCount} characters entered`">
        <svg viewBox="0 0 20 20" class="h-3.5 w-3.5 text-violet-600" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <path d="M5 5.5h10M5 10h6.5M5 14.5h8" stroke-linecap="round" />
        </svg>
        {{ statStore.manualInputCount }}
      </span>
      <span class="inline-flex h-full items-center gap-1.5 px-2.5 tabular-nums" :title="`${statStore.contourCount} contours drawn`">
        <svg viewBox="0 0 20 20" class="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <path d="M4 14.5 7.5 7l3 3 2-1.5L16 4.5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M4 14.5h12" stroke-linecap="round" />
        </svg>
        {{ statStore.contourCount }}
      </span>
    </div>
    <div class="flex h-full items-center border-l border-slate-100">
      <button type="button" class="inline-flex h-full w-8 items-center justify-center transition hover:bg-slate-50" :aria-label="showStats ? 'Hide stats' : 'Show stats'" :title="showStats ? 'Hide stats' : 'Show stats'" @click="showStats = !showStats">
        <svg v-if="showStats" viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <path d="M2.75 10s2.5-4 7.25-4 7.25 4 7.25 4-2.5 4-7.25 4-7.25-4-7.25-4Z" stroke-linejoin="round" />
          <circle cx="10" cy="10" r="1.75" />
        </svg>
        <svg v-else viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <path d="M3 3 17 17M2.75 10s2.5-4 7.25-4c1.2 0 2.24.26 3.14.64M17.25 10s-2.5 4-7.25 4c-1.2 0-2.24-.26-3.14-.64" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button type="button" class="inline-flex h-full w-8 items-center justify-center transition hover:bg-slate-50" :aria-label="statStore.paused ? 'Resume stats' : 'Pause stats'" :title="statStore.paused ? 'Resume stats' : 'Pause stats'" @click="statStore.togglePause()">
        <svg v-if="statStore.paused" viewBox="0 0 20 20" class="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M6.5 4.5v11l8-5.5-8-5.5Z" /></svg>
        <svg v-else viewBox="0 0 20 20" class="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M6 5.25A1.25 1.25 0 0 1 7.25 4h.5A1.25 1.25 0 0 1 9 5.25v9.5A1.25 1.25 0 0 1 7.75 16h-.5A1.25 1.25 0 0 1 6 14.75v-9.5Zm5 0A1.25 1.25 0 0 1 12.25 4h.5A1.25 1.25 0 0 1 14 5.25v9.5A1.25 1.25 0 0 1 12.75 16h-.5A1.25 1.25 0 0 1 11 14.75v-9.5Z" /></svg>
      </button>
      <button type="button" class="inline-flex h-full w-8 items-center justify-center transition hover:bg-slate-50" aria-label="Reset stats" title="Reset stats" @click="statStore.reset()">
        <svg viewBox="0 0 20 20" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <path d="M5.25 7.25A5.75 5.75 0 1 1 4.5 12" stroke-linecap="round" />
          <path d="M5.25 3.75v3.5h3.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useStatStore } from '@/stores/stat'

const statStore = useStatStore()
const showStats = ref(true)

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds]
    .map(value => String(value).padStart(2, '0'))
    .join(':')
}
</script>
