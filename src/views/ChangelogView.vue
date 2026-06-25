<script setup lang="ts">
import { computed } from 'vue'

const changelogEntries = [
  {
    version: 'DEV-0623',
    date: '2026-06-23',
    title: 'AI, contour, and backend improvements',
    changes: [
      'Expanded the chat workflow with predefined queries, conversation trimming, transcript capture, and more reliable overall-description generation.',
      'Improved contour editing and refinement with hover states, deletion, simplification, reorder controls, and active-label handling.',
      'Added and polished the Python backend API, docs, and data export/copy utilities, plus small UI and labeling fixes.',
      'Added a comparison view for side-by-side label review and comparison.',
    ],
  },
  {
    version: 'DEV-0509',
    date: '2026-05-09',
    title: 'Polish and workflow fixes',
    changes: [
      'Improved contour editing with polygon hover states, contour deletion, and click-to-activate label selection.',
      'Fixed page index updates and made automatic overall-description generation more reliable during load.',
      'Refined API and AI feature defaults, and refreshed the README and backend documentation.',
      'Added a changelog page.',
    ],
  },
  {
    version: '0.0.1',
    date: '2026-03-01',
    title: 'Initial labeling workflow',
    changes: [
      'First release.',
    ],
  },
]

const latestVersion = computed(() => changelogEntries[0]?.version ?? '')
const entryCount = computed(() => changelogEntries.length)
</script>

<template>
  <div class="min-h-full bg-slate-50 px-4 py-12 text-slate-800 sm:px-6 lg:px-8">
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <section class="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <p class="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Metadent App</p>
        <h1 class="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Changelog</h1>
        <p class="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          Recent product changes. The latest version is
          <span class="font-semibold text-slate-900">{{ latestVersion }}</span>
          across
          <span class="font-semibold text-slate-900">{{ entryCount }}</span>
          entries.
        </p>
      </section>

      <section class="flex flex-col gap-4">
        <article
          v-for="(entry, index) in changelogEntries"
          :key="`${entry.version}-${entry.date}`"
          class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <span
                class="rounded-full px-3 py-1"
                :class="index === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'"
              >
                {{ entry.version }}
              </span>
              <span>{{ entry.date }}</span>
            </div>
            <h2 class="text-xl font-semibold text-slate-950 sm:text-2xl">{{ entry.title }}</h2>
          </div>

          <ul class="mt-5 space-y-3 text-sm leading-6 text-slate-700 sm:text-base">
            <li
              v-for="change in entry.changes"
              :key="change"
              class="rounded-2xl bg-slate-50 px-4 py-3"
            >
              {{ change }}
            </li>
          </ul>
        </article>
      </section>
    </div>
  </div>
</template>
