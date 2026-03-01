import { defineStore } from 'pinia';

interface descInputExpose {
  focus: () => Promise<void>;
  autoGenerateOverallDescription: () => Promise<void>;
}

// global store for sharing component methods
export const useComponentStore = defineStore('componentStore', () => {
  const descInputExpose = null;
  return {
    descInputExpose,
  } as {
    descInputExpose: descInputExpose | null;
  }
});
