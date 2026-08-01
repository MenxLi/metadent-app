
<template>
  <header class="w-full bg-white text-gray-700 py-2 px-8 flex justify-between items-center shadow-md z-50">
    <div v-if="userInfo" class="flex items-center space-x-4 gap-1">
      <span class="font-semibold text-md">Hi, {{ userInfo.username }}</span>
      <span
        v-if="userInfo.isAdmin"
        class="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-xl"
      >
        Admin
      </span>
    </div>
    <div v-else class="text-gray-400 italic">Not logged in</div>

    <div v-if="userInfo" class="flex items-center gap-2">
      <div v-if="statStore.enabled" class="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
        <span>{{ formatDuration(statStore.totalSeconds) }}</span>
        <span class="text-slate-400">•</span>
        <span>{{ statStore.manualInputCount }} chars</span>
        <button
          type="button"
          class="rounded-full px-1.5 py-0.5 text-[11px] hover:bg-slate-200"
          :title="statStore.paused ? 'Resume stats' : 'Pause stats'"
          @click="statStore.togglePause()"
        >
          {{ statStore.paused ? '▶' : '⏸' }}
        </button>
        <button
          type="button"
          class="rounded-full px-1.5 py-0.5 text-[11px] hover:bg-slate-200"
          title="Reset stats"
          @click="statStore.reset()"
        >
          ↺
        </button>
      </div>

      <UserSettings v-model:show="showSettings" />
      <button
        @click="showSettings = !showSettings"
        class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition"
      >
        Settings
      </button>
      <button
        @click="logout"
        class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition"
      >
        Logout
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import UserSettings from './UserSettings.vue';
  import type { UserInfo } from '../api'
  import { useStatStore } from '@/stores/stat'

  defineProps<{
    userInfo: UserInfo | null
  }>()

  const emit = defineEmits<{
    (e: 'logout'): void
  }>()

  const statStore = useStatStore()

  function logout() {
    emit('logout')
  }

  function formatDuration(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return [hours, minutes, seconds]
      .map(value => String(value).padStart(2, '0'))
      .join(':')
  }

  const showSettings = ref(false)
</script>
