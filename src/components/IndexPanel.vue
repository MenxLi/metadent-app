<script setup lang="ts">
  import DataCard from './DataCard.vue';
  import { useDataStore } from '@/stores/data';
  import { useUiStateStore } from '@/stores/uistate';
  import { computed } from 'vue';
  import { debounce } from '@/utils';

  const dataStore = useDataStore();
  const uiStateStore = useUiStateStore();

  function nextPage() {
    if (uiStateStore.pageIndex >= uiStateStore.pageMax) {
      return;
    }
    uiStateStore.setPageIndex(uiStateStore.pageIndex + 1);
    dataStore.updateIndex();
  }

  function prevPage() {
    if (uiStateStore.pageIndex > 0) {
      uiStateStore.setPageIndex(uiStateStore.pageIndex - 1);
      dataStore.updateIndex();
    }
  }

  const debouncedUpdateIndex = debounce(() => {
    dataStore.updateIndex();
  }, 300);
  const pageIdxPlusOne = computed({
    get: () => uiStateStore.pageIndex + 1,
    set: (val: number) => {
      uiStateStore.setPageIndex(val - 1);
      debouncedUpdateIndex();
    }
  })
</script>

<template>
  <div class="w-full h-full flex flex-col bg-white gap-2">
    <div :class="'w-full h-full flex bg-white overflow-y-auto shadow-inner items-start' + (uiStateStore.pageIndexLoading ? ' opacity-50' : '')">
      <DataCard
        :items="dataStore.dataItems" @select="(item) => dataStore.setActiveDataItem(item)"
        :select="dataStore.activeDataItem"
      />
    </div>
    <div class="relative bottom-0 left-0 right-0 bg-white p-4 flex justify-center items-center gap-4 shadow-inner flex-col md:flex-col lg:flex-row">
      <button
        @click="prevPage"
        class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md w-md max-w-full"
      >
        <span class="text-lg">Previous</span>
      </button>

      <span
        class="text-blue-700 text-lg font-semibold outline-none border border-transparent focus:border-blue-400 px-2 rounded _no-newline"
      >
        Page <input type="number" v-model="pageIdxPlusOne" class="w-12 text-center border-b border-blue-500 focus:outline-none" />/{{ uiStateStore.pageMax }}
      </span>

      <button
        @click="nextPage"
        class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md w-md max-w-full"
      >
        <span class="text-lg">Next</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
  ._no-newline {
    white-space: nowrap;
  }
</style>
