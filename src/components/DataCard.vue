<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 py-1">
    <div
      v-for="item in items"
      :key="item.fileName"
      @click="handleClick(item)"
      :class="(select?.fileName === item.fileName ? 'bg-blue-100':'bg-white') +
      ' cursor-pointer py-2 px-2 flex flex-col items-center transition-transform w-fit h-fit [box-shadow:0_0_0_0.1px_#9999,inset_0_0_0_0.1px_#9999]' +
      ' hover:scale-102 hover:bg-blue-50 hover:[box-shadow:0_0_0_0.5px_#99f9,inset_0_0_0_0.5px_#99f9] hover:rounded-xs'
      "
    >
      <img
        :src="item.thumbUrl"
        :alt="item.fileName"
        class="w-24 h-24 object-cover rounded-sm mb-2"
      />
      <div class="text-gray-700 text-xs font-semibold">{{ item.fileName }}</div>
      <div class="text-gray-500 text-sm mt-1">
        {{ statusEmojiMap[item.status] }} {{ item.status }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
