<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: boolean;
  trueLabel: string;
  falseLabel: string;
  trueTitle?: string;
  falseTitle?: string;
  tone?: 'default' | 'highlight';
  size?: 'default' | 'compact';
  surface?: 'white' | 'muted';
  stopClickPropagation?: boolean;
}>(), {
  tone: 'default',
  size: 'default',
  surface: 'white',
  stopClickPropagation: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

function setValue(value: boolean) {
  if (props.modelValue === value) {
    return;
  }
  emit('update:modelValue', value);
}

const wrapClass = computed(() => {
  const surfaceClass = props.surface === 'muted'
    ? 'bg-gray-100'
    : 'bg-white shadow-sm'
  return `inline-flex rounded-full p-1 ${surfaceClass}`
})

const buttonClass = computed(() => {
  return props.size === 'compact'
    ? 'px-2 py-1 rounded-full text-xs transition-colors'
    : 'px-3 py-1 rounded-full text-xs transition-colors'
})

const inactiveClass = computed(() => {
  return props.surface === 'muted'
    ? 'text-gray-600 hover:bg-gray-200'
    : 'text-gray-600 hover:bg-gray-100'
})

const trueActiveClass = computed(() => {
  return props.tone === 'highlight'
    ? 'bg-rose-500 text-white'
    : 'bg-emerald-500 text-white'
})

const falseActiveClass = computed(() => {
  return props.tone === 'highlight'
    ? 'bg-slate-500 text-white'
    : 'bg-sky-500 text-white'
})
</script>

<template>
  <div :class="wrapClass" @click="if (stopClickPropagation) { $event.stopPropagation(); }">
    <button
      type="button"
      :title="trueTitle"
      :class="[
        buttonClass,
        modelValue ? trueActiveClass : inactiveClass,
      ]"
      @click="setValue(true)"
    >
      {{ trueLabel }}
    </button>
    <button
      type="button"
      :title="falseTitle"
      :class="[
        buttonClass,
        !modelValue ? falseActiveClass : inactiveClass,
      ]"
      @click="setValue(false)"
    >
      {{ falseLabel }}
    </button>
  </div>
</template>
