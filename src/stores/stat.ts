import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useUserStore } from './user'

export const useStatStore = defineStore('StatInfo', () => {
  const enabled = ref(false)
  const paused = ref(false)
  const totalSeconds = ref(0)
  const manualInputCount = ref(0)
  const contourCount = ref(0)
  let sessionStartedAt: number | null = null
  let hasActiveSession = false
  let timer: number | null = null
  let windowFocused = true

  function isPageActive() {
    return windowFocused && !document.hidden
  }

  function stopTimer() {
    syncElapsedTime()
    if (timer !== null) {
      window.clearInterval(timer)
      timer = null
    }
    sessionStartedAt = null
  }

  function syncElapsedTime() {
    if (sessionStartedAt == null) {
      return
    }

    const now = Date.now()
    const deltaSeconds = Math.max(0, Math.floor((now - sessionStartedAt) / 1000))
    if (deltaSeconds > 0) {
      totalSeconds.value += deltaSeconds
      sessionStartedAt += deltaSeconds * 1000
    }
  }

  function ensureTimer() {
    if (!enabled.value || paused.value || !hasActiveSession || !isPageActive() || timer !== null) {
      return
    }

    sessionStartedAt = Date.now()
    timer = window.setInterval(() => {
      syncElapsedTime()
    }, 1000)
  }

  function setEnabled(value: boolean) {
    enabled.value = value
    if (!enabled.value) {
      stopTimer()
      hasActiveSession = false
      return
    }

    if (!paused.value) {
      hasActiveSession = true
      ensureTimer()
    }
  }

  function togglePause() {
    if (!enabled.value) {
      return
    }

    paused.value = !paused.value
    if (paused.value) {
      stopTimer()
      return
    }

    hasActiveSession = true
    ensureTimer()
  }

  function reset() {
    const resumeSession = hasActiveSession
    stopTimer()
    totalSeconds.value = 0
    manualInputCount.value = 0
    contourCount.value = 0
    hasActiveSession = resumeSession

    if (enabled.value && !paused.value) {
      ensureTimer()
    }
  }

  function recordManualInput(characterCount: number) {
    if (!enabled.value || paused.value) {
      return
    }

    if (characterCount <= 0) {
      return
    }

    manualInputCount.value += characterCount
    hasActiveSession = true
    ensureTimer()
  }

  function recordContourCount(count: number) {
    if (!enabled.value || paused.value) {
      return
    }

    if (count <= 0) {
      return
    }

    contourCount.value += count
    hasActiveSession = true
    ensureTimer()
  }

  function clear() {
    stopTimer()
    enabled.value = false
    paused.value = false
    totalSeconds.value = 0
    manualInputCount.value = 0
    contourCount.value = 0
    hasActiveSession = false
    window.localStorage.removeItem('StatInfo')
  }

  function handleVisibilityChange() {
    if (!isPageActive()) {
      stopTimer()
      return
    }

    ensureTimer()
  }

  function handleFocusChange() {
    windowFocused = document.hasFocus()
    if (!isPageActive()) {
      stopTimer()
      return
    }

    ensureTimer()
  }

  const userStore = useUserStore()
  watch(() => userStore.settings.enableAnnotationStats, (value) => {
    setEnabled(Boolean(value))
  }, { immediate: true })
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handleFocusChange)
  window.addEventListener('blur', handleFocusChange)

  return {
    enabled,
    paused,
    totalSeconds,
    manualInputCount,
    contourCount,
    syncElapsedTime,
    ensureTimer,
    setEnabled,
    togglePause,
    reset,
    recordManualInput,
    recordContourCount,
    clear,
  }
}, {
  persist: {
    key: 'StatInfo',
  },
})
