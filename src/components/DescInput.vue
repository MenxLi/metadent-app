<template>
  <div class="relative w-full">
    <textarea
      v-model="modelValue"
      :disabled="isBusy"
      class="w-full p-2 pb-10 border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-500 resize-y overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      placeholder="Overall description"
      ref="textareaRef"
      rows="1"
      @input="handleInput"
      @compositionstart="handleCompositionStart"
      @compositionend="handleCompositionEnd"
      @keydown="handleKeydown"
    ></textarea>

    <div v-if="visibleActions.length" class="absolute bottom-3 right-1 inline-flex items-center gap-0.5 rounded-full border border-slate-200/90 bg-white/95 p-0.5 shadow-sm backdrop-blur-sm">
      <button
        v-for="action in visibleActions"
        :key="action.key"
        :title="action.title"
        :disabled="isActionDisabled(action.key)"
        @click="runAction(action.key)"
        class="grid h-7 w-7 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg
          v-if="activeActionKey === action.key || (action.key === 'transcript' && transcriptBusy)"
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
            v-if="action.key === 'transcript' && transcriptRecording"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="12"
            height="12"
            class="mx-auto"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>

          <svg
            v-else-if="action.key === 'transcript'"
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
            aria-hidden="true"
          >
            <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <path d="M12 19v3" />
            <path d="M8 22h8" />
          </svg>

          <svg
            v-else-if="action.key === 'regen'"
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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDataStore } from '@/stores/data';
import { useComponentStore } from '@/stores/component';
import { AIService } from '@/api';
import { useUserStore } from '@/stores/user';
import { useStatStore } from '@/stores/stat';
import { useInputTracking } from '@/composables/useInputTracking';

const modelValue = defineModel('modelValue', {
  type: String,
  default: ''
})

const props = defineProps<{
  transcriptEnabled?: boolean
  transcriptBusy?: boolean
  transcriptRecording?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'enter'): void
  (e: 'transcribe'): void
}>()

const dataStore = useDataStore()
const componentStore = useComponentStore()
const userStore = useUserStore()
const statStore = useStatStore()
const aiService = new AIService()
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const activeActionKey = ref<string | null>(null)
const { handleInput: trackInput, handleCompositionStart, handleCompositionEnd } = useInputTracking(
  () => modelValue.value ?? '',
  statStore.recordManualInput,
)
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

type DescActionKey = 'regen' | 'complexify' | 'simplify' | 'transcript'

interface DescAction {
  key: DescActionKey
  title: string
}

const DESC_ACTIONS: Record<Exclude<DescActionKey, 'transcript'>, DescAction> = {
  regen: {
    key: 'regen',
    title: 'Re-generate overall description',
  },
  complexify: {
    key: 'complexify',
    title: 'Complexify current description',
  },
  simplify: {
    key: 'simplify',
    title: 'Simplify current description',
  },
}

const transcriptBusy = computed(() => Boolean(props.transcriptBusy))
const transcriptRecording = computed(() => Boolean(props.transcriptRecording))
const transcriptActionTitle = computed(() => {
  if (transcriptBusy.value) {
    return 'Transcribing audio'
  }

  if (transcriptRecording.value) {
    return 'Stop recording and transcribe'
  }

  return 'Start recording audio for overall description'
})

const visibleActions = computed<DescAction[]>(() => {
  const actions: DescAction[] = []

  if (isAiEnabled.value && props.transcriptEnabled) {
    actions.push({
      key: 'transcript',
      title: transcriptActionTitle.value,
    })
  }

  if (!isAiEnabled.value) {
    return actions
  }

  actions.push(DESC_ACTIONS.regen)

  if (canUseOverallDescriptionImprovement.value) {
    actions.push(DESC_ACTIONS.complexify, DESC_ACTIONS.simplify)
  }

  return actions
})

function isActionDisabled(actionKey: DescActionKey) {
  if (actionKey === 'transcript') {
    return isBusy.value || transcriptBusy.value
  }

  return isBusy.value || transcriptBusy.value || transcriptRecording.value
}

function commitActionValue(nextValue: string) {
  pushActionUndoSnapshot()
  hasUserEditedSinceLastAction.value = false
  emit('update:modelValue', nextValue)
}

function resetActionUndoState() {
  actionUndoStack.value = []
  hasUserEditedSinceLastAction.value = false
}

function insertTranscriptAtCursor(text: string) {
  const normalized = text.trim()
  if (!normalized) {
    return
  }

  const current = modelValue.value ?? ''
  const textarea = textareaRef.value
  if (!textarea) {
    const separator = current && !current.endsWith(' ') ? ' ' : ''
    commitActionValue(`${current}${separator}${normalized}`)
    return
  }

  const selectionStart = textarea.selectionStart ?? current.length
  const selectionEnd = textarea.selectionEnd ?? selectionStart
  const before = current.slice(0, selectionStart)
  const after = current.slice(selectionEnd)
  const leading = before.length > 0 && !/\s$/.test(before) ? ' ' : ''
  const trailing = after.length > 0 && !/^\s/.test(after) ? ' ' : ''
  const insertText = `${leading}${normalized}${trailing}`
  const nextValue = `${before}${insertText}${after}`

  commitActionValue(nextValue)

  const caret = before.length + insertText.length
  requestAnimationFrame(() => {
    textarea.focus({ preventScroll: true })
    textarea.setSelectionRange(caret, caret)
  })
}

watch(() => dataStore.activeDataItem?.fileName, resetActionUndoState)

watch(modelValue, () => {
  autoResizeTextarea()
})

onMounted(async () => {
  componentStore.descInputExpose = {
    focus,
    autoGenerateOverallDescription,
    insertTranscriptAtCursor,
  }
  await nextTick()
  autoResizeTextarea()
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

function handleInput(event: InputEvent) {
  hasUserEditedSinceLastAction.value = true
  trackInput(event)
  autoResizeTextarea()
}

async function autoResizeTextarea() {
  const el = textareaRef.value
  if (!el) return
  await nextTick()
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
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
  commitActionValue(normalized)
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

async function runAction(actionKey: DescActionKey) {
  if (isActionDisabled(actionKey)) {
    return
  }

  if (actionKey === 'transcript') {
    emit('transcribe')
    return
  }

  activeActionKey.value = actionKey
  try {
    switch (actionKey) {
      case 'regen':
        await autoGenerateOverallDescription()
        break
      case 'complexify':
        await enhanceOverallDescription('complexify')
        break
      case 'simplify':
        await enhanceOverallDescription('simplify')
        break
    }
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

defineExpose({
  focus,
  autoGenerateOverallDescription,
  insertTranscriptAtCursor,
})
</script>
