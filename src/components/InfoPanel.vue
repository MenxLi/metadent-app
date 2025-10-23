<script setup lang="ts">
import { computed } from 'vue'
import { useDataStore } from '@/stores/data'
import { useUserStore } from '@/stores/user'
import { useUiStateStore } from '@/stores/uistate'

const dataStore = useDataStore()
const userStore = useUserStore()
const uiStateStore = useUiStateStore()
const dataInfo = computed(() => dataStore.activeDataInfo)
const annotators = computed(() => dataStore.activeDataLabel?.annotators)

// const formatFileSize = (bytes: number) =>
//   bytes > 1024 * 1024
//     ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
//     : `${(bytes / 1024).toFixed(2)} KB`
</script>

<template>
  <div
    class="p-4 rounded-md"
    :class="{
      'bg-blue-100 text-blue-800': uiStateStore.msg.level === 'info',
      'bg-yellow-100 text-yellow-800': uiStateStore.msg.level === 'warning',
      'bg-red-100 text-red-800': uiStateStore.msg.level === 'error',
    }"
    v-if="uiStateStore.msg.content"
  >
      <div v-html="uiStateStore.msg.content"></div>
  </div>
  <div v-if="dataInfo" class="flex items-center justify-between bg-white shadow-md p-4 rounded-lg">
    <div class="bg-transparent p-2 rounded text-gray-700 text-xs grid [grid-template-columns:auto_1fr] gap-x-2 gap-y-1">
      <div class="font-semibold">Filename:</div><div>{{ dataInfo.fileName }}</div>
      <!-- <div class="font-semibold">Path:</div><div>{{ dataInfo.path }}</div> -->
      <div class="font-semibold">Source:</div><div>{{ dataInfo.source }}</div>
      <div class="font-semibold">Dimensions:</div><div>{{ dataInfo.width }}×{{ dataInfo.height }}</div>
    </div>

    <div v-if="dataStore.activeDataLock !== null && userStore.user && userStore.user.username !== dataStore.activeDataLock[1].lockedBy"
    class="flex items-center justify-center gap-2 bg-red-50 p-2 rounded-xl">
      <div class="flex items-center justify-center w-10 h-10 bg-red-200 rounded-full">
        <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" stroke-width="2"
            viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M16 12V8a4 4 0 10-8 0v4M5 12h14v10H5V12z"/>
        </svg>
      </div>
      <span class="text-red-900 text-md font-semibold">Locked by {{
      dataStore.activeDataLock[1].lockedBy
      }}</span>
    </div>

    <div v-else-if="annotators && annotators.length > 0"
    class="flex items-center justify-center gap-2 bg-green-50 p-2 rounded-xl">
      <span class="text-green-900 text-md font-semibold">Annotated by [{{
      annotators!.join(', ') }}]
      </span>
    </div>
  </div>
</template>
