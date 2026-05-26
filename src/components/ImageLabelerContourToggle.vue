<script lang="ts" setup>
  import { computed } from 'vue';
  import FloatingIconButton from './containers/FloatingIconButton.vue';

  type ContourVisibilityMode = 'none' | 'active' | 'all';

  const props = defineProps<{
    mode: ContourVisibilityMode;
  }>();

  const emit = defineEmits<{
    (e: 'cycle'): void;
  }>();

  const visibilityLabelMap: Record<ContourVisibilityMode, string> = {
    none: 'Hide contours',
    active: 'Show active contour only',
    all: 'Show all contours',
  };

  const nextModeMap: Record<ContourVisibilityMode, ContourVisibilityMode> = {
    none: 'active',
    active: 'all',
    all: 'none',
  };

  const contourVisibilityLabel = computed(() => visibilityLabelMap[props.mode]);

  const nextContourVisibilityLabel = computed(() => {
    const nextMode = nextModeMap[props.mode];
    return visibilityLabelMap[nextMode].toLowerCase();
  });
</script>

<template>
  <FloatingIconButton
    positionClass="top-2 right-2"
    :ariaLabel="contourVisibilityLabel"
    :title="`${contourVisibilityLabel} (click to ${nextContourVisibilityLabel})`"
    @click="emit('cycle')"
  >
    <svg v-if="mode === 'all'" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
    <svg v-else-if="mode === 'none'" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" >
      <path d="M13.875 18.825A10.05 10.05 0 0112 19c-7 0-11-7-11-7a21.3 21.3 0 015.341-5.986m4.086-1.587A9.953 9.953 0 0112 5c7 0 11 7 11 7a21.3 21.3 0 01-3.752 4.834M3 3l18 18" />
    </svg>
    <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="6" stroke-dasharray="2 2" />
    </svg>
  </FloatingIconButton>
</template>
