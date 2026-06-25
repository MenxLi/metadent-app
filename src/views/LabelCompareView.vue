<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import FloatingWindow from '@/components/containers/FloatingWindow.vue'
import DataCard from '@/components/DataCard.vue'
import { FileLabelStatus, type DataItem, type DataLabel, type LabelItem } from '@/api'
import { toCamelCaseObj } from '@/utils'
import { useUserStore } from '@/stores/user'
import { useLabelCompareStore } from '@/stores/labelCompare'

type ComparisonSource = {
  metaDir: string
  labelPath: string
  title: string
  overallDescription: string
  labels: LabelItem[]
  activeLabelId: string | null
  enabled: boolean
  error: string | null
}

const sourcePalette = ['#2563eb', '#059669', '#d97706', '#db2777', '#7c3aed', '#0891b2']
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'])
const IMAGE_PAGE_SIZE = 24
const SOURCE_VISIBLE_CLASS = 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
const SOURCE_HIDDEN_CLASS = 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100'
const LABEL_ACTIVE_CLASS = 'border-blue-300 bg-blue-50 text-blue-900'
const LABEL_INACTIVE_CLASS = 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
const LABEL_DISABLED_CLASS = 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'

const userStore = useUserStore()
const compareStore = useLabelCompareStore()
userStore.configureOverride()
userStore.verifyLoginRedirect()

const showConfig = ref(false)
const loadingImages = ref(false)
const loadingLabels = ref(false)
const loadError = ref('')
const imageItems = ref<DataItem[]>([])
const sources = ref<ComparisonSource[]>([])
const imageLoaded = ref(false)
const imageNaturalSize = ref({ width: 1, height: 1 })
const imageRef = ref<HTMLImageElement | null>(null)

const draftImageDir = ref(compareStore.imageDir)
const draftMetaDirs = ref(compareStore.metaDirs.length ? [...compareStore.metaDirs] : [''])

const selectedImage = computed(() =>
  imageItems.value.find((item) => item.fileName === compareStore.selectedImagePath) ?? null
)
const imagePageMax = computed(() => Math.max(1, Math.ceil(imageItems.value.length / IMAGE_PAGE_SIZE)))
const pagedImageItems = computed(() => {
  const start = compareStore.imagePageIndex * IMAGE_PAGE_SIZE
  return imageItems.value.slice(start, start + IMAGE_PAGE_SIZE)
})
const imagePageIndexPlusOne = computed({
  get: () => compareStore.imagePageIndex + 1,
  set: (value: number) => {
    if (!Number.isFinite(value)) return
    const next = Math.min(imagePageMax.value - 1, Math.max(0, Math.floor(value) - 1))
    compareStore.setImagePageIndex(next)
  },
})
const imageSrc = computed(() => selectedImage.value?.imageUrl ?? '')
const hasImage = computed(() => selectedImage.value != null)
const sourceCount = computed(() => sources.value.length)
const activeSourceCount = computed(() =>
  sources.value.filter((source) => source.enabled && source.activeLabelId != null).length
)

function normalizeDirInput(value: string) {
  const trimmed = value.trim().replace(/^\/+/, '')
  if (!trimmed) return ''
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

function fileStem(fileName: string) {
  const parts = fileName.split('.')
  if (parts.length <= 1) return fileName
  return parts.slice(0, -1).join('.')
}

function sourceColor(index: number) {
  return sourcePalette[index % sourcePalette.length] ?? '#2563eb'
}

function createEmptyDataLabel(): DataLabel {
  return {
    annotators: [],
    overallDescription: '',
    items: [],
    crop: null,
    abnormalityExhausted: true,
  }
}

function withAlphaHex(color: string, alphaHex: string) {
  const hex = color.trim()
  if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return color
  return `${hex}${alphaHex}`
}

function buildFileUrl(path: string, thumb = false) {
  const endpoint = userStore.backend.connector.config.endpoint.replace(/\/+$/, '')
  const token = userStore.backend.connector.config.token
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const query = thumb ? 'thumb=true' : 'download=true'
  return `${endpoint}/${encodedPath}?token=${encodeURIComponent(token)}&${query}`
}

function activeLabelKey(metaDir: string, fileName: string) {
  return `${normalizeDirInput(metaDir)}|${fileName}`
}

function toLabelPath(metaDir: string, fileName: string) {
  return `${normalizeDirInput(metaDir)}${fileStem(fileName)}/label.json`
}

function sourceTitle(metaDir: string) {
  const clean = normalizeDirInput(metaDir).replace(/\/+$/, '')
  if (!clean) return 'Meta source'
  const parts = clean.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? clean
}

function isImageFile(url: string) {
  const base = url.split('/').pop() ?? ''
  const ext = base.includes('.') ? base.split('.').pop()?.toLowerCase() ?? '' : ''
  return IMAGE_EXTENSIONS.has(ext)
}

function normalizeLabelItem(item: unknown, index: number): LabelItem {
  const value = item as Partial<LabelItem> | null | undefined
  return {
    id: String(value?.id ?? `label-${index + 1}`),
    lowConfidence: Boolean(value?.lowConfidence),
    description: typeof value?.description === 'string' ? value.description : '',
    color: typeof value?.color === 'string' ? value.color : sourceColor(index),
    contours: Array.isArray(value?.contours) ? value.contours : [],
    autoGenerated: value?.autoGenerated ?? null,
    preRefineContours: value?.preRefineContours ?? null,
  }
}

function normalizeDataLabel(raw: unknown): DataLabel {
  const value = toCamelCaseObj(raw) as Partial<DataLabel>
  return {
    annotators: Array.isArray(value.annotators) ? value.annotators.filter((item): item is string => typeof item === 'string') : [],
    overallDescription: typeof value.overallDescription === 'string' ? value.overallDescription : '',
    items: Array.isArray(value.items) ? value.items.map((item, index) => normalizeLabelItem(item, index)) : [],
    crop: Array.isArray(value.crop) && value.crop.length === 4 ? value.crop as [number, number, number, number] : null,
    abnormalityExhausted: value.abnormalityExhausted !== false,
  }
}

function createComparisonSource(payload: {
  metaDir: string
  fileName: string
  overallDescription: string
  labels: LabelItem[]
  activeLabelId: string | null
  enabled: boolean
  error: string | null
}): ComparisonSource {
  return {
    metaDir: payload.metaDir,
    labelPath: toLabelPath(payload.metaDir, payload.fileName),
    title: sourceTitle(payload.metaDir),
    overallDescription: payload.overallDescription,
    labels: payload.labels,
    activeLabelId: payload.activeLabelId,
    enabled: payload.enabled,
    error: payload.error,
  }
}

function isSourceToggleable(source: ComparisonSource) {
  return source.enabled
}

function sourceToggleClass(source: ComparisonSource) {
  return source.enabled ? SOURCE_VISIBLE_CLASS : SOURCE_HIDDEN_CLASS
}

function labelButtonClass(source: ComparisonSource, label: LabelItem) {
  if (!isSourceToggleable(source)) return LABEL_DISABLED_CLASS
  return source.activeLabelId === label.id ? LABEL_ACTIVE_CLASS : LABEL_INACTIVE_CLASS
}

function setDraftFromStore() {
  draftImageDir.value = compareStore.imageDir
  draftMetaDirs.value = compareStore.metaDirs.length ? [...compareStore.metaDirs] : ['']
}

function syncImagePageWithSelection() {
  const selected = compareStore.selectedImagePath
  if (!selected) return
  const idx = imageItems.value.findIndex((item) => item.fileName === selected)
  if (idx < 0) return
  compareStore.setImagePageIndex(Math.floor(idx / IMAGE_PAGE_SIZE))
}

function prevImagePage() {
  compareStore.setImagePageIndex(compareStore.imagePageIndex - 1)
}

function nextImagePage() {
  compareStore.setImagePageIndex(compareStore.imagePageIndex + 1)
}

function applyDraftConfig() {
  const imageDir = normalizeDirInput(draftImageDir.value)
  const metaDirs = draftMetaDirs.value.map(normalizeDirInput).filter(Boolean)

  if (!imageDir) {
    loadError.value = 'Image directory is required.'
    return false
  }
  if (!metaDirs.length) {
    loadError.value = 'Please configure at least one metadata directory.'
    return false
  }

  compareStore.setImageDir(imageDir)
  compareStore.setMetaDirs(metaDirs)
  setDraftFromStore()
  return true
}

async function refreshImages() {
  loadingImages.value = true
  loadError.value = ''

  try {
    const files = await userStore.backend.connector.listFiles(compareStore.imageDir, {
      flat: true,
      orderBy: 'url',
      orderDesc: false,
      limit: 3000,
    })

    const list = files
      .filter((file) => isImageFile(file.url))
      .map((file): DataItem => {
        const relativeName = file.url.startsWith(compareStore.imageDir)
          ? file.url.slice(compareStore.imageDir.length)
          : file.url.split('/').pop() ?? file.url

        return {
          imageUrl: buildFileUrl(file.url, false),
          thumbUrl: buildFileUrl(file.url, true),
          fileName: relativeName,
          identifier: fileStem(relativeName),
          status: FileLabelStatus.UNLABELED,
        }
      })

    imageItems.value = list

    if (!list.length) {
      compareStore.setSelectedImagePath('')
      sources.value = []
      return
    }

    const selectedExists = list.some((item) => item.fileName === compareStore.selectedImagePath)
    if (!selectedExists) {
      compareStore.setSelectedImagePath(list[0]!.fileName)
    }

    if (compareStore.imagePageIndex >= imagePageMax.value) {
      compareStore.setImagePageIndex(imagePageMax.value - 1)
    }
    syncImagePageWithSelection()

    await loadLabelsForSelectedImage()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Failed to load images from the directory.'
  } finally {
    loadingImages.value = false
  }
}

async function loadLabelsForSelectedImage() {
  const selected = selectedImage.value
  if (!selected) {
    sources.value = []
    return
  }

  loadingLabels.value = true
  loadError.value = ''
  imageLoaded.value = false

  try {
    const sourceEnabledState = new Map(sources.value.map((source) => [source.metaDir, source.enabled]))
    const nextSources = await Promise.all(compareStore.metaDirs.map(async (metaDir) => {
      const labelPath = toLabelPath(metaDir, selected.fileName)
      let labelData: DataLabel = createEmptyDataLabel()
      let error: string | null = null

      try {
        const raw = await userStore.backend.connector.getJson(labelPath)
        labelData = normalizeDataLabel(raw)
      } catch (reason) {
        error = reason instanceof Error ? reason.message : 'Failed to load label file.'
      }

      const key = activeLabelKey(metaDir, selected.fileName)
      const savedActive = compareStore.activeLabelByMetaDir[key] ?? null
      const fallbackActive = labelData.items[0]?.id ?? null
      const activeLabelId = labelData.items.some((item) => item.id === savedActive) ? savedActive : fallbackActive

      if (activeLabelId !== savedActive) {
        compareStore.setActiveLabel(key, activeLabelId)
      }

      return createComparisonSource({
        metaDir,
        fileName: selected.fileName,
        overallDescription: labelData.overallDescription,
        labels: labelData.items,
        activeLabelId,
        enabled: sourceEnabledState.get(metaDir) ?? true,
        error,
      })
    }))

    sources.value = nextSources
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Failed to load labels.'
  } finally {
    loadingLabels.value = false
  }
}

function addMetaDirField() {
  draftMetaDirs.value = [...draftMetaDirs.value, '']
}

function removeMetaDirField(index: number) {
  draftMetaDirs.value = draftMetaDirs.value.filter((_, i) => i !== index)
  if (!draftMetaDirs.value.length) {
    draftMetaDirs.value = ['']
  }
}

function selectImage(item: DataItem) {
  compareStore.setSelectedImagePath(item.fileName)
  syncImagePageWithSelection()
  loadLabelsForSelectedImage()
}

function setSourceActiveLabel(source: ComparisonSource, labelId: string | null) {
  if (!selectedImage.value) return
  source.activeLabelId = labelId
  compareStore.setActiveLabel(activeLabelKey(source.metaDir, selectedImage.value.fileName), labelId)
}

function selectLabel(sourceIndex: number, labelId: string) {
  const source = sources.value[sourceIndex]
  if (!source) return
  if (!isSourceToggleable(source)) return
  const nextLabelId = source.activeLabelId === labelId ? null : labelId
  setSourceActiveLabel(source, nextLabelId)
}

function clearAllSelections() {
  if (!selectedImage.value) return
  sources.value.forEach((source) => {
    if (source.activeLabelId != null) {
      setSourceActiveLabel(source, null)
    }
  })
}

function toggleSourceEnabled(sourceIndex: number) {
  const source = sources.value[sourceIndex]
  if (!source) return
  source.enabled = !source.enabled
}

function onImageLoad() {
  if (imageRef.value) {
    imageNaturalSize.value = {
      width: imageRef.value.naturalWidth || 1,
      height: imageRef.value.naturalHeight || 1,
    }
  }
  imageLoaded.value = true
}

function contourPoints(contour: [number, number][]) {
  const width = imageNaturalSize.value.width
  const height = imageNaturalSize.value.height
  if (!width || !height) return ''
  return contour.map(([x, y]) => `${x * width},${y * height}`).join(' ')
}

const activeOverlays = computed(() =>
  sources.value.flatMap((source) => {
    if (!source.enabled) return []
    const label = source.labels.find((item) => item.id === source.activeLabelId)
    if (!label) return []
    return label.contours.map((contour, contourIndex) => ({
      key: `${source.metaDir}-${label.id}-${contourIndex}`,
      points: contourPoints(contour),
      fillColor: withAlphaHex(label.color, '33'),
      strokeColor: label.color,
    }))
  })
)

async function saveConfigAndReload() {
  if (!applyDraftConfig()) return
  showConfig.value = false
  await refreshImages()
}

onMounted(() => {
  setDraftFromStore()
  if (!compareStore.imageDir || !compareStore.metaDirs.length) {
    showConfig.value = true
    return
  }
  refreshImages()
})

watch(
  () => imageItems.value.length,
  () => {
    if (compareStore.imagePageIndex >= imagePageMax.value) {
      compareStore.setImagePageIndex(imagePageMax.value - 1)
    }
  }
)
</script>

<template>
  <div class="h-full w-full bg-gray-100 text-gray-800">
    <div class="flex h-full w-full flex-col gap-3 p-3">
      <header class="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Label Compare</p>
            <p class="text-sm text-gray-600">Image directory with multiple metadata directories.</p>
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-600">
            <span class="rounded-md bg-gray-100 px-2 py-1">Sources: {{ sourceCount }}</span>
            <span class="rounded-md bg-gray-100 px-2 py-1">Active overlays: {{ activeSourceCount }}</span>
            <button
              type="button"
              class="rounded-md border border-gray-300 bg-white px-3 py-1.5 font-medium hover:bg-gray-50"
              @click="showConfig = true"
            >
              Configure
            </button>
            <button
              type="button"
              class="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
              :disabled="loadingImages || loadingLabels"
              @click="refreshImages"
            >
              Reload
            </button>
          </div>
        </div>
        <div v-if="loadError" class="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {{ loadError }}
        </div>
      </header>

      <main class="grid min-h-0 flex-1 gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <section class="flex min-h-0 flex-col gap-3">
          <article class="flex min-h-0 shrink-0 flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <div class="mb-2 flex items-center justify-between text-xs text-gray-500">
              <span>{{ selectedImage?.fileName || 'No image selected' }}</span>
              <span>{{ imageLoaded ? 'Ready' : 'Loading image...' }}</span>
            </div>
            <div class="relative h-[min(52vh,34rem)] overflow-hidden rounded-md border border-gray-200 bg-gray-50">
              <div v-if="!hasImage" class="flex h-full items-center justify-center px-4 text-center text-sm text-gray-500">
                Configure directories and select an image to start comparison.
              </div>
              <template v-else>
                <img
                  ref="imageRef"
                  :src="imageSrc"
                  :alt="selectedImage?.fileName || 'Selected image'"
                  class="h-full w-full object-contain"
                  @load="onImageLoad"
                />
                <svg
                  v-if="imageLoaded"
                  class="pointer-events-none absolute inset-0 h-full w-full"
                  xmlns="http://www.w3.org/2000/svg"
                  :viewBox="`0 0 ${imageNaturalSize.width} ${imageNaturalSize.height}`"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <polygon
                    v-for="overlay in activeOverlays"
                    :key="overlay.key"
                    :points="overlay.points"
                    :fill="overlay.fillColor"
                    :stroke="overlay.strokeColor"
                    stroke-width="2"
                    fill-rule="evenodd"
                  />
                </svg>
              </template>
            </div>
          </article>

          <article class="flex min-h-0 max-h-[42vh] flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
            <div class="mb-2 flex items-center justify-between px-1 text-xs text-gray-500">
              <span>Image selection</span>
              <span>{{ imageItems.length }} images</span>
            </div>
            <div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              <DataCard
                :items="pagedImageItems"
                :select="selectedImage"
                @select="selectImage"
              />
            </div>
            <div class="mt-2 shrink-0 flex items-center justify-center gap-3 rounded-md bg-white p-2 shadow-inner">
              <button
                type="button"
                class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                :disabled="compareStore.imagePageIndex <= 0"
                @click="prevImagePage"
              >
                Previous
              </button>
              <span class="text-sm font-semibold text-blue-700">
                Page
                <input
                  v-model.number="imagePageIndexPlusOne"
                  type="number"
                  min="1"
                  :max="imagePageMax"
                  class="mx-1 w-12 border-b border-blue-500 text-center focus:outline-none"
                />
                / {{ imagePageMax }}
              </span>
              <button
                type="button"
                class="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                :disabled="compareStore.imagePageIndex >= imagePageMax - 1"
                @click="nextImagePage"
              >
                Next
              </button>
            </div>
          </article>
        </section>

        <section class="min-h-0 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div class="mb-3 flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <span>Click active label again to hide its contour.</span>
            <button
              type="button"
              class="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              @click="clearAllSelections"
            >
              Clear all
            </button>
          </div>
          <div class="space-y-3">
            <article
              v-for="(source, sourceIndex) in sources"
              :key="source.metaDir"
              class="rounded-md border border-gray-200 bg-gray-50 p-3"
            >
              <div class="mb-2 flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-gray-800">{{ source.title }}</p>
                  <p class="truncate text-xs text-gray-500">{{ source.labelPath }}</p>
                  <p
                    v-if="source.overallDescription"
                    class="mt-1 line-clamp-2 text-xs text-gray-600"
                    :title="source.overallDescription"
                  >
                    {{ source.overallDescription }}
                  </p>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded border px-2 py-1 text-[11px] font-medium transition"
                  :class="sourceToggleClass(source)"
                  @click="toggleSourceEnabled(sourceIndex)"
                >
                  {{ source.enabled ? 'Visible' : 'Hidden' }}
                </button>
              </div>

              <p v-if="source.error" class="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                {{ source.error }}
              </p>

              <div class="space-y-1.5">
                <button
                  v-for="label in source.labels"
                  :key="label.id"
                  type="button"
                  class="flex w-full items-start gap-2 rounded border px-2 py-2 text-left text-sm transition"
                  :class="labelButtonClass(source, label)"
                  :disabled="!isSourceToggleable(source)"
                  @click="selectLabel(sourceIndex, label.id)"
                >
                  <span
                    class="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    :style="{ backgroundColor: label.color }"
                  />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-xs text-current/80">{{ label.description || 'No description' }}</span>
                  </span>
                  <span
                    v-if="label.lowConfidence"
                    class="shrink-0 rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                  >
                    Low
                  </span>
                  <span class="shrink-0 text-[10px] text-current/70">{{ label.contours.length }}</span>
                  <span class="max-w-18 shrink truncate text-[9px] text-current/35">{{ label.id }}</span>
                </button>
                <div v-if="source.labels.length === 0" class="rounded border border-dashed border-gray-300 px-2 py-3 text-xs text-gray-500">
                  No labels in this source for current image.
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>

    <FloatingWindow v-model:show="showConfig" title="Label Compare Settings" :z-index="120">
      <div class="w-[min(92vw,42rem)] space-y-4 p-2">
        <div class="space-y-1">
          <label class="text-sm font-medium text-gray-700">Image directory</label>
          <input
            v-model="draftImageDir"
            type="text"
            class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="public/images/"
          />
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-gray-700">Metadata directory(s)</label>
            <button
              type="button"
              class="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              @click="addMetaDirField"
            >
              Add
            </button>
          </div>

          <div class="space-y-2">
            <div v-for="(metaDir, index) in draftMetaDirs" :key="index" class="flex items-center gap-2">
              <input
                v-model="draftMetaDirs[index]"
                type="text"
                class="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="public/meta/"
              />
              <button
                type="button"
                class="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                @click="removeMetaDirField(index)"
              >
                Delete
              </button>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <button
            type="button"
            class="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            @click="setDraftFromStore(); showConfig = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            @click="saveConfigAndReload"
          >
            Save and reload
          </button>
        </div>
      </div>
    </FloatingWindow>
  </div>
</template>
