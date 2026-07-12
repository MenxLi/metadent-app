import { computed, ref } from 'vue'
import { useDataStore } from '@/stores/data'
import { useUiStateStore } from '@/stores/uistate'
import { useUserStore } from '@/stores/user'

export function useAutoLabelCurrentPage() {
  const dataStore = useDataStore()
  const uiStateStore = useUiStateStore()
  const userStore = useUserStore()

  const showAutoLabelWarning = ref(false)
  const isStartingAutoLabel = ref(false)

  const currentPageItemCount = computed(() => dataStore.dataItems.length)
  const currentPageImageLabel = computed(() => {
    return `${currentPageItemCount.value} image${currentPageItemCount.value === 1 ? '' : 's'}`
  })
  const canUseAutoLabel = computed(() => {
    return userStore.settings.enableAIHelpers && userStore.settings.aiFeatureSet.autoLabelCurrentPage
  })
  const canStartAutoLabel = computed(() => {
    return canUseAutoLabel.value && currentPageItemCount.value > 0 && !isStartingAutoLabel.value
  })
  const autoLabelWarningVisible = computed({
    get: () => showAutoLabelWarning.value,
    set: (value: boolean) => {
      if (!value) {
        closeAutoLabelWarning()
        return
      }
      showAutoLabelWarning.value = true
    },
  })

  function openAutoLabelWarning() {
    if (!canUseAutoLabel.value) {
      return
    }
    if (!currentPageItemCount.value) {
      uiStateStore.msg.set('No images are loaded on the current page.', 'warning')
      return
    }
    showAutoLabelWarning.value = true
  }

  function closeAutoLabelWarning() {
    if (isStartingAutoLabel.value) {
      return
    }
    showAutoLabelWarning.value = false
  }

  async function confirmAutoLabel() {
    if (!canStartAutoLabel.value) {
      return
    }

    isStartingAutoLabel.value = true
    try {
      const submittedCount = await dataStore.startAutoLabelCurrentPage()
      showAutoLabelWarning.value = false
      uiStateStore.msg.set(
        `Started an auto-label background job for ${submittedCount} image${submittedCount === 1 ? '' : 's'} on this page.`,
        'info'
      )
    }
    finally {
      isStartingAutoLabel.value = false
    }
  }

  return {
    autoLabelWarningVisible,
    isStartingAutoLabel,
    currentPageItemCount,
    currentPageImageLabel,
    canUseAutoLabel,
    canStartAutoLabel,
    openAutoLabelWarning,
    closeAutoLabelWarning,
    confirmAutoLabel,
  }
}
