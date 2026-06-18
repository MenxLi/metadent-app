import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface DescInputExpose {
  focus: () => Promise<void>
  autoGenerateOverallDescription: () => Promise<void>
  insertTranscriptAtCursor: (text: string) => void
}

// global store for sharing component methods
export const useComponentStore = defineStore('componentStore', () => {
  const descInputExpose = ref<DescInputExpose | null>(null)

  return {
    descInputExpose,
  }
})
