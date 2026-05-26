<script lang="ts" setup>
  withDefaults(defineProps<{
    ariaLabel: string;
    title?: string;
    positionClass?: string;
  }>(), {
    title: undefined,
    positionClass: 'top-2 left-2',
  });

  const emit = defineEmits<{
    (e: 'click'): void;
  }>();
</script>

<template>
  <button
    type="button"
    @click.stop="emit('click')"
    :aria-label="ariaLabel"
    :title="title ?? ariaLabel"
    :class="[
      'absolute z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-stone-950/28 text-white/72 shadow-sm backdrop-blur-sm transition hover:bg-stone-950/42 hover:text-white pointer-events-auto',
      positionClass,
    ]"
  >
    <slot />
  </button>
</template>