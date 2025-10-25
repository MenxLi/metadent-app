import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'

export class UiMessage {
  content: string;
  level: 'info' | 'warning' | 'error';
  constructor(content: string, level: 'info' | 'warning' | 'error' = 'info') {
    this.content = content;
    this.level = level;
  }
  reset() {
    this.content = "";
    this.level = 'info';
  }
  set(content: string, level: 'info' | 'warning' | 'error' = 'info') {
    this.content = content;
    this.level = level;
  }
}

export const useUiStateStore = defineStore('uiState', () => {

  const PAGE_SIZE = 24;
  const pageIndex: Ref<number> = ref(0);
  const pageMax: Ref<number> = ref(0);
  const pageIndexLoading: Ref<boolean> = ref(false);
  const labelPanelLoading: Ref<boolean> = ref(false);
  const msg: Ref<UiMessage> = ref(new UiMessage(""));

  const setPageIndex = (index: number) => {
    if (index < 0) {
      pageIndex.value = 0;
    }
    else if (index >= pageMax.value) {
      pageIndex.value = pageMax.value - 1;
    }
    else {
      pageIndex.value = index;
    }
  }

  return {
    msg,
    pageIndex,
    pageMax,
    pageIndexLoading,
    labelPanelLoading,
    PAGE_SIZE,
    setPageIndex,
  }
}, {
  persist: {
    pick: ['pageIndex'],
    serializer: {
      serialize: (state) => {
        return JSON.stringify(state);
      },
      deserialize: (state) => {
        const ret = JSON.parse(state);
        if (typeof ret.pageIndex === 'string') {
          ret.pageIndex = parseInt(ret.pageIndex);
        }
        return ret;
      }
    }
  }
})
