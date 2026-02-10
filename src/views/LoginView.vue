
<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/stores/user';
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'

const router = useRouter()
const token = ref('')
const error = ref('')
const loading = ref(false)

const userStore = useUserStore()
const { settings } = storeToRefs(userStore)

async function handleLogin() {
  error.value = ''
  loading.value = true

  try {
    if (
      userStore.settings.enableAIAutoGen &&
      !userStore.settings.aiBackendUrl
    ) {
      error.value = 'AI backend URL is required when AI auto generation is enabled.'
      return
    }

    userStore.hashkey = token.value
    const user = await userStore.login()
    if (!user) {
      error.value = 'Invalid token.'
    }
    else {
      router.push({ name: 'home' })
    }
  } catch (err) {
    console.error(err)
    error.value = 'Login failed.'
  } finally {
    loading.value = false
  }
}
</script>


<template>
  <div class="w-full h-full flex items-center justify-center bg-gray-100">
    <div class="bg-white p-8 rounded-2xl shadow-md w-full max-w-md mx-4 flex flex-col gap-2">
      <h1 class="text-2xl font-semibold mb-6 text-center">App Login</h1>
      <p class="mb-4 text-gray-600 text-sm">
        The labeling tool connects to an <a href="https://github.com/menxli/lfss" target="_blank" class="text-blue-500 underline"><b>LFSS</b></a> backend.
        Please provide the LFSS backend URL, and your access token for authentication.
      </p>
      <p class="mb-4 text-gray-600 text-sm">
        More details can be found in the <a href="https://menxli.github.io/metadent-app/docs/setup-backend.html" target="_blank" class="text-blue-500 underline"><b>documentation</b></a>.
      </p>
      <form @submit.prevent="handleLogin" class="flex flex-col gap-2">
        <div class="mb-4">
          <p class="text-gray-700 font-medium mb-2"> LFSS endpoint </p>
          <input
            type="text"
            v-model="userStore.backendUrl"
            class="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div class="mb-4">
          <label for="token" class="block text-gray-700 font-medium mb-2">LFSS token</label>
          <input
            id="token"
            v-model="token"
            type="password"
            class="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Enter your token"
          />
        </div>
        <div class="mb-4">
          <label class="flex items-center gap-2 text-gray-700 font-medium">
            <input type="checkbox" v-model="settings.enableAIAutoGen" />
            Enable AI to automatically generate descriptions.
          </label>
        </div>

        <div v-if="settings.enableAIAutoGen" class="mb-4">
          <p class="text-gray-700 font-medium mb-2">AI backend endpoint</p>
          <input
            type="text"
            v-model="settings.aiBackendUrl"
            placeholder="http://xxx.xx.xx.xx:xxxx/infer"
            class="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl transition disabled:opacity-50"
        >
          {{ loading ? "Logging in..." : "Login" }}
        </button>
      </form>
      <p v-if="error" class="text-red-500 text-sm mt-4 text-center">{{ error }}</p>
    </div>
  </div>
</template>


<style scoped>
b {
  color: #3b82f6;
}
</style>
