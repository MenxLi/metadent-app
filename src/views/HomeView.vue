{<script setup lang="ts">
  import { onUnmounted } from 'vue';
  import { useUserStore } from '@/stores/user';
  import { useDataStore } from '@/stores/data';
  import { useRouter } from 'vue-router'
  import InfoPanel from '@/components/InfoPanel.vue';
  import IndexPanel from '@/components/IndexPanel.vue';
  import TopBar from '@/components/TopBar.vue';
  import LabelPanel from '@/components/LabelPanel.vue';

  const router = useRouter()
  const userStore = useUserStore()
  userStore.configureOverride()
  userStore.verifyLoginRedirect()

  const dataStore = useDataStore()

  async function checkUrlParamForItem() {
    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('item');
    if (itemId != null) {
      console.log('goto item from url param:', itemId);
      await dataStore.gotoGlobalDataIdx(parseInt(itemId) - 1);
    }
  }

  dataStore.updateIndex().then(() => {
    // After initial index load, check if we have an item query param to jump to
    checkUrlParamForItem();
  });

  function logout() {
    userStore.logout();
    router.push({ name: 'login' });
  }

  onUnmounted(() => {
    dataStore.unlockActiveDataItem();
  });
</script>

<template>
  <div class="w-full h-full flex flex-col bg-gray-100">
    <TopBar :userInfo="userStore.user" @logout="logout" />
    <div class="flex flex-1 overflow-hidden">
      <aside class="w-1/3 max-w-lg bg-white p-4">
        <IndexPanel></IndexPanel>
      </aside>

      <!-- Right: Business area -->
      <main class="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
        <InfoPanel></InfoPanel>
        <LabelPanel></LabelPanel>
      </main>
    </div>
  </div>
</template>}
