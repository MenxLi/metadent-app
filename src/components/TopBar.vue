
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

    <UserSettings v-if="userInfo" v-model:show="showSettings"/>
    <div class="flex gap-2">
      <button
        v-if="userInfo"
        @click="showSettings = !showSettings"
        class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition"
      >
        Settings
      </button>
      <button
        v-if="userInfo"
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
  import type { UserInfo } from '../api' // adjust this path based on your project

  defineProps<{
    userInfo: UserInfo | null
  }>()

  const emit = defineEmits<{
    (e: 'logout'): void
  }>()

  function logout() {
    emit('logout')
  }

  const showSettings = ref(false)
</script>
