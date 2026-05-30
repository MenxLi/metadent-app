<template>
  <div class="relative w-full">
    <textarea
      v-model="modelValue"
      :disabled="isBusy"
      class="w-full p-2 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-500"
      placeholder="Overall description"
      ref="textareaRef"
      rows="3"
      @input="handleInput"
      @keydown="handleKeydown"
    ></textarea>

    <div v-if="visibleActions.length" class="absolute bottom-3 right-1 inline-flex items-center gap-0.5 rounded-full border border-slate-200/90 bg-white/95 p-0.5 shadow-sm backdrop-blur-sm">
      <button
        v-for="action in visibleActions"
        :key="action.key"
        :title="action.title"
        :disabled="isBusy"
        @click="runAction(action)"
        class="grid h-7 w-7 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg
          v-if="activeActionKey === action.key"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="12"
          height="12"
          class="mx-auto animate-spin"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-3.2-6.9" />
        </svg>

        <template v-else>
          <svg
            v-if="action.key === 'regen'"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="12"
            height="12"
            class="mx-auto"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 15.3-6.4" />
            <path d="M21 12a9 9 0 0 1-15.3 6.4" />
            <path d="M18 2v4h-4" />
            <path d="M6 22v-4h4" />
          </svg>

          <span
            v-else
            :class="action.key === 'complexify' ? 'text-[15px]' : 'text-[16px]'"
            class="select-none font-semibold leading-none"
            aria-hidden="true"
          >{{ action.key === 'complexify' ? '+' : '-' }}</span>
        </template>
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useDataStore } from '@/stores/data';
import { useComponentStore } from '@/stores/component';
import { AIService } from '@/api';
import { nextTick } from 'vue';
import { useUserStore } from '@/stores/user';

const modelValue = defineModel('modelValue', {
  type: String,
  default: ''
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'enter'): void
}>()

const dataStore = useDataStore()
const componentStore = useComponentStore()
const userStore = useUserStore()
const aiService = new AIService()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const activeActionKey = ref<string | null>(null)
const actionUndoStack = ref<string[]>([])
const hasUserEditedSinceLastAction = ref(false)
const MAX_ACTION_UNDO = 20

const isBusy = computed(() => activeActionKey.value != null)
const isAiEnabled = computed(() => userStore.settings.enableAIHelpers)
const canUseOverallDescriptionImprovement = computed(() => {
  const settings = userStore.settings
  return isAiEnabled.value
    && settings.aiFeatureSet.overallDescriptionImprovement
    && Boolean(settings.aiBackendUrl?.trim())
    && Boolean(settings.aiBackendToken?.trim())
})

interface DescAction {
  key: 'regen' | 'complexify' | 'simplify';
  title: string;
  run: () => Promise<void>;
}

const visibleActions = computed<DescAction[]>(() => {
  if (!isAiEnabled.value) {
    return []
  }

  const actions: DescAction[] = [
    {
      key: 'regen',
      title: 'Re-generate overall description',
      run: autoGenerateOverallDescription,
    },
  ]

  if (canUseOverallDescriptionImprovement.value) {
    actions.push(
      {
        key: 'complexify',
        title: 'Complexify current description',
        run: () => enhanceOverallDescription('complexify'),
      },
      {
        key: 'simplify',
        title: 'Simplify current description',
        run: () => enhanceOverallDescription('simplify'),
      },
    )
  }

  return actions
})

watch(() => dataStore.activeDataItem?.fileName, () => {
  actionUndoStack.value = []
  hasUserEditedSinceLastAction.value = false
})

onMounted(() => {
  componentStore.descInputExpose = {
    focus,
    autoGenerateOverallDescription
  }
})
onUnmounted(() => {
  componentStore.descInputExpose = null
})

function handleKeydown(event: KeyboardEvent) {
  const isUndo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey
  if (isUndo && !hasUserEditedSinceLastAction.value && undoLastActionChange()) {
    event.preventDefault()
    return
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    emit('enter')
  }
}

function handleInput() {
  hasUserEditedSinceLastAction.value = true
}

function pushActionUndoSnapshot() {
  actionUndoStack.value.push(modelValue.value ?? '')
  if (actionUndoStack.value.length > MAX_ACTION_UNDO) {
    actionUndoStack.value.shift()
  }
}

function applyGeneratedDescription(nextValue: string | null | undefined) {
  const current = modelValue.value ?? ''
  const normalized = nextValue?.trim() ?? ''
  if (!normalized || normalized === current) {
    return
  }
  pushActionUndoSnapshot()
  hasUserEditedSinceLastAction.value = false
  emit('update:modelValue', normalized)
}

function getActiveImageId(): string | null {
  const fileName = dataStore.activeDataItem?.fileName
  if (!fileName) {
    return null
  }
  return fileName.replace(/\.[^/.]+$/, '')
}

function undoLastActionChange() {
  const prev = actionUndoStack.value.pop()
  if (prev == null) {
    return false
  }
  hasUserEditedSinceLastAction.value = false
  emit('update:modelValue', prev)
  return true
}

const focus = async () => {
  activeActionKey.value = null
  await nextTick();
  textareaRef.value?.focus({
    preventScroll: true
  })
}

async function runAction(action: DescAction) {
  if (isBusy.value) {
    return
  }

  activeActionKey.value = action.key
  try {
    await action.run()
  } finally {
    activeActionKey.value = null
  }
}

async function autoGenerateOverallDescription() {
  if (dataStore.activeDataItem == null || dataStore.activeDataLabel == null) {
    return
  }
  const image_id = getActiveImageId()
  if (!image_id) {
    return
  }

  try {
    const res = await aiService.overallDescription(image_id)
    console.log('Auto-complete response:', res)
    applyGeneratedDescription(res)
  } catch (error) {
    console.error('Error fetching auto-complete:', error)
  }
}

async function enhanceOverallDescription(mode: 'complexify' | 'simplify') {
  const image_id = getActiveImageId()
  if (!image_id) {
    return
  }

  const userDescription = modelValue.value?.trim() ?? ''
  try {
    const res = mode === 'complexify'
      ? await aiService.overallDescriptionComplexify(image_id, userDescription)
      : await aiService.overallDescriptionSimplify(image_id, userDescription)
    applyGeneratedDescription(res)
  } catch (error) {
    console.error('Error enhancing overall description:', error)
  }
}

defineExpose({ focus, autoGenerateOverallDescription })
</script>
