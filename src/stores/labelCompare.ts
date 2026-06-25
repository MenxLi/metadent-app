import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'

function normalizeDir(input: string): string {
  let value = input.trim()
  if (!value) return ''
  if (value.startsWith('/')) value = value.slice(1)
  if (!value.endsWith('/')) value += '/'
  return value
}

function normalizeDirList(input: string[]): string[] {
  const dirs = input
    .map((dir) => normalizeDir(dir))
    .filter(Boolean)

  return [...new Set(dirs)]
}

export const useLabelCompareStore = defineStore('labelCompare', () => {
  const imageDir: Ref<string> = ref('public/images/')
  const metaDirs: Ref<string[]> = ref(['public/meta/'])
  const selectedImagePath: Ref<string> = ref('')
  const imagePageIndex: Ref<number> = ref(0)
  const activeLabelByMetaDir: Ref<Record<string, string | null>> = ref({})

  function setImageDir(dir: string) {
    imageDir.value = normalizeDir(dir)
  }

  function setMetaDirs(dirs: string[]) {
    const nextDirs = normalizeDirList(dirs)
    metaDirs.value = nextDirs.length > 0 ? nextDirs : ['public/meta/']
  }

  function setSelectedImagePath(path: string) {
    selectedImagePath.value = path.trim()
  }

  function setImagePageIndex(index: number) {
    imagePageIndex.value = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0
  }

  function setActiveLabel(metaDir: string, labelId: string | null) {
    const normalizedMetaDir = normalizeDir(metaDir)
    if (!normalizedMetaDir) return

    activeLabelByMetaDir.value = {
      ...activeLabelByMetaDir.value,
      [normalizedMetaDir]: labelId,
    }
  }

  return {
    imageDir,
    metaDirs,
    selectedImagePath,
    imagePageIndex,
    activeLabelByMetaDir,
    setImageDir,
    setMetaDirs,
    setSelectedImagePath,
    setImagePageIndex,
    setActiveLabel,
  }
}, {
  persist: {
    pick: ['imageDir', 'metaDirs', 'selectedImagePath', 'imagePageIndex', 'activeLabelByMetaDir'],
  },
})
