<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-1">
    <div
      v-for="item in items"
      :key="item.fileName"
      @click="handleClick(item)"
      :class="(select?.fileName === item.fileName ? 'bg-blue-100':'bg-white') +
      ' cursor-pointer shadow-md rounded-xl p-4 flex flex-col items-center transition-transform hover:scale-105 hover:bg-blue-50 w-fit h-fit'"
    >
      <img
        :src="item.thumbUrl"
        :alt="item.fileName"
        class="w-24 h-24 object-cover rounded-md mb-2"
      />
      <div class="text-gray-700 text-sm font-semibold">{{ item.fileName }}</div>
      <div class="text-gray-500 text-sm mt-1">
        {{ statusEmojiMap[item.status] }} {{ item.status }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { defineProps, defineEmits } from 'vue'
  import { type DataItem, FileLabelStatus } from '@/api'

  defineProps<{
    items: DataItem[]
    select: DataItem | null
  }>()

  const emit = defineEmits<{
    (e: 'select', item: DataItem): void
  }>()

  const statusEmojiMap: Record<FileLabelStatus, string> = {
    [FileLabelStatus.DONE]: '✅✔',
    [FileLabelStatus.LABELED]: '️✅',
    [FileLabelStatus.SKIPPED]: '⏭️',
    [FileLabelStatus.LOCKED]: '🔒',
    [FileLabelStatus.UNLABELED]: ' ',
  }

  function handleClick(item: DataItem) {
    emit('select', item)
  }
</script>
