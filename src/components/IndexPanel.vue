<script setup lang="ts">
  import FloatingWindow from './containers/FloatingWindow.vue';
  import DataCard from './DataCard.vue';
  import { useDataStore } from '@/stores/data';
  import { useUiStateStore } from '@/stores/uistate';
  import { computed } from 'vue';
  import { useAutoLabelCurrentPage } from '@/composables/useAutoLabelCurrentPage';
  import { debounce } from '@/utils';

  const dataStore = useDataStore();
  const uiStateStore = useUiStateStore();
  const {
    autoLabelWarningVisible,
    isStartingAutoLabel,
    currentPageImageLabel,
    canUseAutoLabel,
    canStartAutoLabel,
    openAutoLabelWarning,
    closeAutoLabelWarning,
    confirmAutoLabel,
  } = useAutoLabelCurrentPage();

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
  });

</script>

<template>
  <div class="w-full h-full flex flex-col bg-white gap-2">
    <div
      v-if="canUseAutoLabel"
      class="flex items-center justify-between gap-3 px-4 pt-3 pb-1 text-xs text-slate-500"
    >
      <div class="min-w-0">
        {{ currentPageImageLabel }} on this page
      </div>

      <button
        @click="openAutoLabelWarning"
        :disabled="!canStartAutoLabel"
        class="shrink-0 rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-45"
      >
        Auto-label page
      </button>
    </div>

    <div :class="'w-full h-full flex bg-white overflow-y-auto shadow-inner justify-center items-start' + (uiStateStore.pageIndexLoading ? ' opacity-50' : '')">
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

    <FloatingWindow v-model:show="autoLabelWarningVisible" title="Start Auto-label Job">
      <div class="flex flex-col gap-4 p-4 max-w-xl">
        <p class="text-sm text-gray-700">
          Start a background auto-label job for all {{ currentPageImageLabel }} on the current page.
        </p>

        <div class="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This process cannot be stopped or undone after it starts. AI-generated labels will be generated again for bot-labeled images, while human edits will be kept.
        </div>

        <p class="text-sm text-gray-700">
          Continue only if you want to queue the entire current page for background processing.
        </p>

        <div class="flex justify-end gap-3">
          <button
            type="button"
            @click="closeAutoLabelWarning"
            :disabled="isStartingAutoLabel"
            class="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="confirmAutoLabel"
            :disabled="!canStartAutoLabel"
            class="px-4 py-2 text-sm rounded-md bg-cyan-600 text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ isStartingAutoLabel ? 'Starting...' : 'Start background job' }}
          </button>
        </div>
      </div>
    </FloatingWindow>
  </div>
</template>

<style scoped>
  ._no-newline {
    white-space: nowrap;
  }
</style>
