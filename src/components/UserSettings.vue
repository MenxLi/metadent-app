<script setup lang="ts">
import { ref, watch } from 'vue'
import FloatingWindow from './containers/FloatingWindow.vue'
import { useUserStore } from '@/stores/user'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const showWindow = ref(props.show)
watch(() => props.show, val => showWindow.value = val)
watch(showWindow, val => emit('update:show', val))

const userStore = useUserStore()
const imageDir = ref(userStore.settings.imageDir)
const metaDir = ref(userStore.settings.metaDir)
const apiKey = ref(userStore.settings.openaiAPIKey)
const apiBase = ref(userStore.settings.openaiAPIBase)
const selectedModel = ref(userStore.settings.openaiModel)
const descriptionPrompt = ref(userStore.settings.descPrompt)
const availableModels = ['qwen-vl-max', 'qwen-vl-plus']

function saveSettings() {
  userStore.settings.imageDir = imageDir.value
  userStore.settings.metaDir = metaDir.value
  userStore.settings.openaiAPIKey = apiKey.value
  userStore.settings.openaiAPIBase = apiBase.value
  userStore.settings.openaiModel = selectedModel.value
  userStore.settings.descPrompt = descriptionPrompt.value
  showWindow.value = false
}
</script>

<template>
  <FloatingWindow v-model:show="showWindow" title="User Settings">
    <div class="flex flex-col gap-4 w-full p-4 min-w-100">
      <div class="flex flex-col">
        <label class="text-sm font-medium text-gray-700">Image Directory</label>
        <input
          v-model="imageDir"
          type="text"
          class="mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder="Enter image directory"
        />
      </div>
      <div class="flex flex-col">
        <label class="text-sm font-medium text-gray-700">Metadata Directory</label>
        <input
          v-model="metaDir"
          type="text"
          class="mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          placeholder="Enter metadata directory"
        />
      </div>

      <details>
        <summary class="cursor-pointer text-sm font-medium text-gray-700">VLM Settings</summary>
        <div class="mt-2 flex flex-col gap-4">
          <!-- Advanced settings content can go here if needed -->
          <div class="flex flex-col">
            <label class="text-sm font-medium text-gray-700">API Base</label>
            <input
              v-model="apiBase"
              type="text"
              class="mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <div class="flex flex-col">
            <label class="text-sm font-medium text-gray-700">API Key</label>
            <input
              v-model="apiKey"
              type="password"
              placeholder="Please enter your OpenAI API key"
              class="mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <div class="flex flex-col">
            <label class="text-sm font-medium text-gray-700">Description Prompt</label>
            <textarea
              v-model="descriptionPrompt"
              placeholder="Your description prompt here"
              class="mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm h-fit"
              rows="5"
            ></textarea>
          </div>

          <div class="flex flex-col">
            <label class="text-sm font-medium text-gray-700">Model</label>
            <select
              v-model="selectedModel"
              class="mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option v-for="model in availableModels" :key="model" :value="model">
                {{ model }}
              </option>
            </select>
          </div>
        </div>
      </details>

      <div class="flex justify-end gap-2 pt-2">
        <button
          @click="saveSettings"
          class="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          Save
        </button>
        <button
          @click="showWindow = false"
          class="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  </FloatingWindow>
</template>
