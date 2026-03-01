<script setup lang="ts">
import { ref, watch } from 'vue'
import FloatingWindow from './containers/FloatingWindow.vue'
import { useUserStore } from '@/stores/user'
import { useDataStore } from '@/stores/data';

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
const loadNextGoToUnlabeled = ref(userStore.settings.loadNextGoToUnlabeled)
const enableAIAutoGen = ref(userStore.settings.enableAIAutoGen)
const aiBackendUrl = ref(userStore.settings.aiBackendUrl)
const aiBackendToken = ref(userStore.settings.aiBackendToken)
const aiFeatureSet = ref({ ...userStore.settings.aiFeatureSet })
watch(showWindow, () => {
    // sync with settings when opened
    // or reset to current settings when window is closed without saving
    imageDir.value = userStore.settings.imageDir
    metaDir.value = userStore.settings.metaDir
    loadNextGoToUnlabeled.value = userStore.settings.loadNextGoToUnlabeled
    enableAIAutoGen.value = userStore.settings.enableAIAutoGen
    aiBackendUrl.value = userStore.settings.aiBackendUrl
    aiBackendToken.value = userStore.settings.aiBackendToken
    aiFeatureSet.value = { ...userStore.settings.aiFeatureSet }
})

function saveSettings() {
  if (enableAIAutoGen.value && !aiBackendUrl.value.trim()) {
    userStore.settings.enableAIAutoGen = false
    alert('AI backend URL is required when AI auto generation is enabled.')
    return
  }

  let needFullReset = false;
  if (userStore.settings.imageDir !== imageDir.value || userStore.settings.metaDir !== metaDir.value) {
    needFullReset = true;
  }

  userStore.settings.imageDir = imageDir.value
  userStore.settings.metaDir = metaDir.value
  userStore.settings.enableAIAutoGen = enableAIAutoGen.value
  userStore.settings.aiBackendUrl = aiBackendUrl.value
  userStore.settings.aiBackendToken = aiBackendToken.value
  userStore.settings.loadNextGoToUnlabeled = loadNextGoToUnlabeled.value;
  userStore.settings.aiFeatureSet = { ...aiFeatureSet.value }
  showWindow.value = false

  if (needFullReset) {
    const dataStore = useDataStore();
    userStore.backend.configurePath({
      imageDir: userStore.settings.imageDir,
      metaDir: userStore.settings.metaDir
    });
    dataStore.resetActiveData();
    dataStore.updateIndex();
  }
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
      <div class="flex items-center gap-2">
        <input
          v-model="loadNextGoToUnlabeled"
          type="checkbox"
          id="loadNextGoToUnlabeled"
          class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label for="loadNextGoToUnlabeled" class="text-sm font-medium text-gray-700">
          Next button loads unlabeled image
        </label>
      </div>

      <div>
        <label class="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
          type="checkbox" class="w-4 h-4"
          v-model="enableAIAutoGen" />
          Enable AI assisted labeling (experimental)
        </label>
      </div>

      <div v-if="enableAIAutoGen" class="flex flex-col gap-1.5">
        <div class="flex flex-col gap-0.5">
          <label class="text-sm font-medium text-gray-700">
            AI Backend Endpoint
          </label>
          <input
            v-model="aiBackendUrl"
            type="text"
            placeholder="https://xxx.com:xxxxx"
            class="mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="flex flex-col gap-0.5">
          <label class="text-sm font-medium text-gray-700">
            AI Backend Token
          </label>
          <input
            v-model="aiBackendToken"
            type="text"
            placeholder="Enter token"
            class="mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="flex flex-col gap-0.5 text-sm">
          <label class="text-sm font-medium text-gray-700">
            AI Features
          </label>
          <div class="flex flex-col gap-1 pl-4">
            <label class="flex items-center gap-2 text-gray-700">
              <input
                type="checkbox" class="w-4 h-4"
                v-model="aiFeatureSet.overallDescriptionOnLoad" />
              Overall description on image load
            </label>
            <label class="flex items-center gap-2 text-gray-700">
              <input
                type="checkbox" class="w-4 h-4"
                v-model="aiFeatureSet.regionDescriptionOnDraw" />
              Region description on contour draw
            </label>
          </div>
        </div>
      </div>

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
