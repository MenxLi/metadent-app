import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

type TextInputElement = HTMLInputElement | HTMLTextAreaElement

function getInsertedCharacterCount(previousValue: string, currentValue: string) {
  let prefixLength = 0
  const sharedLength = Math.min(previousValue.length, currentValue.length)

  while (prefixLength < sharedLength && previousValue[prefixLength] === currentValue[prefixLength]) {
    prefixLength += 1
  }

  let suffixLength = 0
  while (
    suffixLength < sharedLength - prefixLength
    && previousValue[previousValue.length - suffixLength - 1] === currentValue[currentValue.length - suffixLength - 1]
  ) {
    suffixLength += 1
  }

  return currentValue.length - prefixLength - suffixLength
}

export function useInputTracking(value: MaybeRefOrGetter<string>, onTextInserted: (characterCount: number) => void) {
  const isComposing = ref(false)
  const lastTrackedValue = ref('')

  function resetTrackedValue(nextValue: string) {
    lastTrackedValue.value = nextValue
  }

  function commit(target: EventTarget | null, isComposingEvent = false) {
    if (isComposing.value || isComposingEvent || !target) {
      return
    }

    const currentValue = (target as TextInputElement).value
    const insertedCharacterCount = getInsertedCharacterCount(lastTrackedValue.value, currentValue)
    if (insertedCharacterCount > 0) {
      onTextInserted(insertedCharacterCount)
    }
    lastTrackedValue.value = currentValue
  }

  function handleInput(event: InputEvent) {
    commit(event.target, event.isComposing)
  }

  function handleCompositionStart() {
    isComposing.value = true
  }

  function handleCompositionEnd(event: CompositionEvent) {
    isComposing.value = false
    commit(event.target)
  }

  watch(() => toValue(value), (nextValue) => {
    if (!isComposing.value) {
      resetTrackedValue(nextValue ?? '')
    }
  }, { immediate: true })

  return {
    handleInput,
    handleCompositionStart,
    handleCompositionEnd,
  }
}
