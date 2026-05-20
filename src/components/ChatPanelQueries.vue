<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string[]
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
  (e: 'submit', value: string): void
}>()

const isManagerOpen = ref(false)
const isEditorOpen = ref(false)
const editingIndex = ref<number | null>(null)
const editorDraft = ref('')
const drafts = ref<string[]>([])

function toDrafts(queries: string[]) {
  return queries.length ? [...queries] : ['']
}

watch(
  () => props.modelValue,
  (queries) => {
    if (!isManagerOpen.value) {
      drafts.value = toDrafts(queries)
    }
  },
  { immediate: true },
)

const visibleQueries = computed(() => props.modelValue.filter((query) => query.trim().length > 0))
const hasUnsavedChanges = computed(() => {
  const normalizedDrafts = drafts.value.map((query) => query.trim())
  const normalizedModel = props.modelValue.map((query) => query.trim())
  return JSON.stringify(normalizedDrafts) !== JSON.stringify(normalizedModel)
})

function openManager() {
  drafts.value = toDrafts(props.modelValue)
  isManagerOpen.value = true
}

function closeManager() {
  drafts.value = toDrafts(props.modelValue)
  isManagerOpen.value = false
  closeEditor()
}

function openEditor(index?: number) {
  editingIndex.value = index ?? null
  editorDraft.value = index === undefined ? '' : (drafts.value[index] ?? '')
  isEditorOpen.value = true
}

function closeEditor() {
  isEditorOpen.value = false
  editingIndex.value = null
  editorDraft.value = ''
}

function removeDraft(index: number) {
  drafts.value.splice(index, 1)
  if (!drafts.value.length) {
    drafts.value = ['']
  }
}

function moveDraft(index: number, direction: -1 | 1) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= drafts.value.length) {
    return
  }

  const nextDrafts = [...drafts.value]
  const draft = nextDrafts[index]
  if (draft === undefined) {
    return
  }

  nextDrafts.splice(index, 1)
  nextDrafts.splice(nextIndex, 0, draft)
  drafts.value = nextDrafts
}

function saveEditor() {
  const query = editorDraft.value.trim()
  if (!query) {
    return
  }

  if (editingIndex.value === null) {
    drafts.value = [...drafts.value.filter((draft) => draft.trim().length > 0), query]
  } else {
    drafts.value.splice(editingIndex.value, 1, query)
    drafts.value = [...drafts.value]
  }

  closeEditor()
}

function saveDrafts() {
  emit('update:modelValue', drafts.value)
  isManagerOpen.value = false
  closeEditor()
}
</script>

<template>
  <div class="relative rounded-sm p-0">
    <button
      type="button"
      class="absolute right-1.5 top-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/80 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="disabled"
      @click="openManager"
      aria-label="Manage predefined queries"
      title="Manage predefined queries"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-3.5 w-3.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 8h16M4 12h16M4 16h16" />
      </svg>
    </button>

    <div v-if="visibleQueries.length" class="flex flex-wrap gap-1.5 pr-7">
      <button
        v-for="query in visibleQueries"
        :key="query"
        type="button"
          class="max-w-full rounded-full px-2 py-1 text-left text-xs disabled:cursor-not-allowed disabled:opacity-50
          border border-slate-200 bg-blue-50/50 text-stone-600 transition hover:bg-blue-50 hover:text-stone-800 "
        :disabled="disabled"
        @click="emit('submit', query)"
      >
        <span class="block max-w-full truncate">{{ query }}</span>
      </button>
    </div>
    <p v-else class="pr-7 text-xs text-slate-400">
      No saved queries.
    </p>

    <div v-if="isManagerOpen" class="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 p-4">
      <div class="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h4 class="text-sm font-semibold text-slate-900">Manage Queries</h4>
            <p class="text-xs text-slate-500">Keep the list compact and reusable.</p>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100"
              @click="openEditor()"
              aria-label="Add query"
              title="Add query"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100"
              @click="closeManager"
              aria-label="Close query manager"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div class="max-h-[60vh] overflow-y-auto px-4 py-3">
          <div v-if="drafts.length" class="flex flex-col gap-2">
            <div
              v-for="(draft, index) in drafts"
              :key="`query-draft-${index}`"
              class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <button
                type="button"
                class="min-w-0 flex-1 text-left"
                @click="openEditor(index)"
              >
                <p class="line-clamp-2 text-sm text-slate-800">
                  {{ draft.trim() || 'Untitled query' }}
                </p>
              </button>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="index === 0"
                  @click="moveDraft(index, -1)"
                  aria-label="Move query up"
                  title="Move up"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 5l-5 5m5-5l5 5M12 5v14" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="index === drafts.length - 1"
                  @click="moveDraft(index, 1)"
                  aria-label="Move query down"
                  title="Move down"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l5-5m-5 5l-5-5m5 5V5" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                  @click="removeDraft(index)"
                  aria-label="Delete query"
                  title="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div v-else class="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
            No queries yet.
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <p class="text-xs text-slate-500">Click a row to edit its text.</p>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              @click="closeManager"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!hasUnsavedChanges"
              @click="saveDrafts"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isEditorOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div class="border-b border-slate-200 px-4 py-3">
          <h4 class="text-sm font-semibold text-slate-900">
            {{ editingIndex === null ? 'Add Query' : `Edit Query ${editingIndex + 1}` }}
          </h4>
        </div>
        <div class="px-4 py-4">
          <textarea
            v-model="editorDraft"
            rows="5"
            class="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            placeholder="Enter a reusable prompt"
          />
        </div>
        <div class="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            @click="closeEditor"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!editorDraft.trim()"
            @click="saveEditor"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
