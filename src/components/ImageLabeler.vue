<template>
  <div
    ref="containerRef"
    class="relative"
    tabindex="0"
    :class="canvasCursorClass"

    @mousedown="startDrawing"
    @mousemove="draw"
    @mouseup="stopDrawing"

    @touchstart="startDrawing"
    @touchmove.prevent="draw"
    @touchend="stopDrawing"
  >
    <img
      ref="imageRef"
      :src="imageSrc"
      class="object-contain select-none"
      :style="{ maxHeight: `${maxHeight}px`, maxWidth: `${maxWidth}px`}"

      @load="onImageLoad"
      @dragstart.prevent
      @contextmenu="(event) => event.preventDefault()"
    />
    <div v-if="userStore.settings.showImageLabelerHint"
      class="pointer-events-none"
    >
      <div
        v-if="!isHintCollapsed"
        class="pointer-events-none absolute top-2 left-2 right-2 z-10 sm:right-auto"
      >
        <div
          class="max-w-60 overflow-hidden rounded-lg border border-white/10 bg-stone-950/30 text-white shadow-md backdrop-blur-sm"
        >
          <div class="flex items-center justify-between gap-2 border-b border-white/8 px-2 py-1">
            <div class="flex items-center gap-1.5 min-w-0">
              <span
                class="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
                :class="hintBadgeClass"
              >
                {{ hintBadgeLabel }}
              </span>
              <span class="truncate text-[10px] text-white/50">Help</span>
            </div>
            <button
              type="button"
              class="pointer-events-auto inline-flex h-5 w-5 items-center justify-center rounded-full text-white/65 transition hover:bg-white/12 hover:text-white"
              aria-label="Collapse help hint"
              @click="isHintCollapsed = true"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-3.5 w-3.5">
                <path d="M4.22 4.22a.75.75 0 0 1 1.06 0L8 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L9.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L8 9.06l-2.72 2.72a.75.75 0 1 1-1.06-1.06L6.94 8 4.22 5.28a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>
          </div>
          <p class="px-2 py-1.5 text-[11px] leading-4 text-white/72">
            {{ interactionHint }}
          </p>
        </div>
      </div>
      <div
        v-else
        class="pointer-events-none absolute top-2 left-2 z-10"
      >
        <FloatingIconButton
          ariaLabel="Show help hint"
          title="Show help hint"
          positionClass="top-0 left-0"
          @click="isHintCollapsed = false"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="h-3.5 w-3.5 text-white/70">
            <path d="M8 1.25a6.75 6.75 0 1 0 0 13.5A6.75 6.75 0 0 0 8 1.25Zm0 9.85a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Zm1.19-3.67-.4.27c-.47.32-.64.55-.64 1.1v.3a.75.75 0 0 1-1.5 0v-.3c0-1.12.49-1.77 1.3-2.31l.4-.27c.44-.29.65-.58.65-.97 0-.6-.5-1.02-1.2-1.02-.67 0-1.17.33-1.5.97a.75.75 0 0 1-1.34-.67c.58-1.16 1.61-1.8 2.84-1.8 1.55 0 2.7.97 2.7 2.52 0 .94-.47 1.63-1.31 2.18Z" />
          </svg>
        </FloatingIconButton>
      </div>

    </div>
    <svg
      class="absolute top-0 left-0 pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
      :width="imageSize.width"
      :height="imageSize.height"
    >
      <template v-if="displayContours.length">
        <template v-for="contourItem in displayContours" :key="contourItem.key">
          <polygon
            :points="getReactiveSvgPoints(contourItem.contour)"
            :fill="getPolygonFillColor(contourItem.labelId, contourItem.contourIndex, contourItem.color)"
            :stroke="getPolygonStrokeColor(contourItem.labelId, contourItem.contourIndex, contourItem.color)"
            :stroke-width="getPolygonStrokeWidth(contourItem.labelId, contourItem.contourIndex)"
            fill-rule="evenodd"
            class="pointer-events-auto"
            @click.left.stop="contourItem.selectable && maybeActivateLabel(contourItem.labelId)"
            @dblclick.left.stop="requestContourRefine(contourItem.labelId)"
            @pointerdown="focusCanvas"
            @touchend.stop.prevent="contourItem.selectable && maybeActivateLabel(contourItem.labelId)"
            @mouseenter="contourItem.isActive && setHoveredPolygon(contourItem.labelId, contourItem.contourIndex)"
            @mouseleave="contourItem.isActive && clearHoveredPolygon(contourItem.labelId, contourItem.contourIndex)"
          />
        </template>
      </template>
      <polyline
        v-if="drawing && currentContour.length"
        :points="getReactiveSvgPoints(currentContour)"
        fill="none"
        :stroke="props.activeLabel ? props.labels.find(label => label.id === props.activeLabel)?.color : '#000000'"
        stroke-width="2"
      />
      <polyline
        :points="getReactiveCropPoints(currentCrop)"
        fill="none"
        stroke="#33EECC"
        stroke-width="2"
        stroke-dasharray="5,3"
      />
    </svg>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount, toRef } from 'vue';
import type { LabelItem } from '@/api';
import { useUserStore } from '@/stores/user'
import { useImageLabelerInteraction, type CropDraft, type CropRect, type Point } from '@/composables/useImageLabelerInteraction';
import FloatingIconButton from './containers/FloatingIconButton.vue';

const props = defineProps<{
  imageSrc: string;
  maxHeight: number;
  maxWidth: number;
  labels: LabelItem[];
  crop: CropRect | null; // [x, y, width, height] in normalized coordinates [0,1]
  activeLabel: string | null;
  contourVisibilityMode: 'none' | 'active' | 'all';
}>();

const emit = defineEmits<{
  (e: 'update:labels', value: LabelItem[]): void;
  (e: 'update:crop', value: CropRect | null): void;
  (e: 'update:activeLabel', value: string): void;
  (e: 'contour-committed', value: { label: LabelItem; labels: LabelItem[] }): void;
  (e: 'contour-dbclick', value: { label: LabelItem; labels: LabelItem[] }): void;
  (e: 'restore-contour-backup'): void;
}>();

type HoveredPolygonState = { labelId: string; contourIndex: number };
type DisplayContour = {
  key: string;
  labelId: string;
  contourIndex: number;
  contour: Point[];
  color: string;
  isActive: boolean;
  selectable: boolean;
};

const imageRef = ref<HTMLImageElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);

watch(
  () => props.labels,
  (labels) => {
    const updated = labels.map(label => {
      // if user deletes all text, restore auto-generated text
      if (
        label.description.trim() === '' &&
        label.autoGenerated != null
      ) {
        return {
          ...label,
          autoGenerated: null,
        };
      }
      return label;
    });

    // Only emit if there is a real change, to avoid infinite loop
    const changed = updated.some((l, i) => l !== labels[i]);
    if (changed) {
      emit('update:labels', updated);
    }
  },
  { deep: true }
);

const hoveredPolygon = ref<HoveredPolygonState | null>(null);
const imageSize = ref({ width: 1, height: 1 });

const visibleLabels = computed(() => {
  if (props.contourVisibilityMode === 'none') {
    return [];
  }
  if (props.contourVisibilityMode === 'active') {
    return props.labels.filter(label => label.id === props.activeLabel);
  }
  return props.labels;
});

const displayContours = computed<DisplayContour[]>(() =>
  visibleLabels.value.flatMap(label =>
    label.contours.map((contour, contourIndex) => ({
      key: `${label.id}-${contourIndex}`,
      labelId: label.id,
      contourIndex,
      contour,
      color: label.color,
      isActive: label.id === props.activeLabel,
      selectable: label.id !== props.activeLabel,
    }))
  ).sort((a, b) => {
    if (a.isActive === b.isActive) return 0;
    return a.isActive ? 1 : -1;
  })
);

const userStore = useUserStore();

const {
  canvasCursorClass,
  consumePolygonActivationSuppression,
  currentContour,
  currentCrop,
  draw,
  drawing,
  interactionHint,
  startDrawing,
  stopDrawing,
} = useImageLabelerInteraction({
  imageRef,
  activeLabel: toRef(props, 'activeLabel'),
  crop: toRef(props, 'crop'),
  onCropCommitted: (crop) => emit('update:crop', crop),
  onContourCommitted: (contour) => commitContour(contour),
});

const isHintCollapsed = ref(true);

const hintBadgeLabel = computed(() => {
  if (interactionHint.value === 'Release to finish crop') return 'Cropping';
  if (interactionHint.value === 'Release to finish contour') return 'Drawing';
  if (props.activeLabel) return 'Ready';
  return 'Select';
});

const hintBadgeClass = computed(() => {
  if (interactionHint.value === 'Release to finish crop') {
    return 'bg-cyan-300/20 text-cyan-100 ring-1 ring-inset ring-cyan-200/30';
  }
  if (interactionHint.value === 'Release to finish contour') {
    return 'bg-emerald-300/20 text-emerald-100 ring-1 ring-inset ring-emerald-200/30';
  }
  if (props.activeLabel) {
    return 'bg-amber-300/20 text-amber-100 ring-1 ring-inset ring-amber-200/30';
  }
  return 'bg-white/10 text-white/80 ring-1 ring-inset ring-white/15';
});

function isHoveredPolygon(labelId: string, contourIndex: number) {
  return hoveredPolygon.value?.labelId === labelId && hoveredPolygon.value?.contourIndex === contourIndex;
}

function setHoveredPolygon(labelId: string, contourIndex: number) {
  if (props.activeLabel !== labelId) return;
  hoveredPolygon.value = { labelId, contourIndex };
}

function clearHoveredPolygon(labelId: string, contourIndex: number) {
  if (isHoveredPolygon(labelId, contourIndex)) {
    hoveredPolygon.value = null;
  }
}

function activateLabel(labelId: string) {
  if (props.activeLabel === labelId) return;
  hoveredPolygon.value = null;
  emit('update:activeLabel', labelId);
}

function maybeActivateLabel(labelId: string) {
  if (consumePolygonActivationSuppression()) {
    return;
  }
  activateLabel(labelId);
}

function withAlphaHex(color: string, alphaHex: string): string {
  const hex = color.trim();
  if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return color;
  return `${hex}${alphaHex}`;
}

function getPolygonFillColor(labelId: string, contourIndex: number, baseColor: string) {
  const isActive = props.activeLabel === labelId;
  const isHoveredActive = isActive && isHoveredPolygon(labelId, contourIndex);
  const alpha = isHoveredActive ? 'AA' : isActive ? '77' : '44';
  return withAlphaHex(baseColor, alpha);
}

function getPolygonStrokeColor(labelId: string, contourIndex: number, baseColor: string) {
  const isActive = props.activeLabel === labelId;
  const isHoveredActive = isActive && isHoveredPolygon(labelId, contourIndex);
  const alpha = isHoveredActive ? 'FF' : isActive ? 'DD' : '77';
  return withAlphaHex(baseColor, alpha);
}

function getPolygonStrokeWidth(labelId: string, contourIndex: number) {
  const isActive = props.activeLabel === labelId;
  if (!isActive) return 1.2;
  return isHoveredPolygon(labelId, contourIndex) ? 3 : 2.2;
}

function removeContour(labelId: string, contourIndex: number) {
  const updatedLabels: LabelItem[] = props.labels.map(label => {
    if (label.id !== labelId) return label;
    return {
      ...label,
      contours: label.contours.filter((_, i) => i !== contourIndex),
      preRefineContours: null,
    };
  });
  emit('update:labels', updatedLabels);
}

function handleDeleteHoveredPolygon(event: KeyboardEvent) {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return;
  if (!hoveredPolygon.value) return;

  const activeElement = document.activeElement as HTMLElement | null;
  const tagName = activeElement?.tagName?.toLowerCase();
  const isEditable =
    activeElement?.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select';
  if (isEditable) return;

  const { labelId, contourIndex } = hoveredPolygon.value;
  if (props.activeLabel !== labelId) return;
  removeContour(labelId, contourIndex);
  hoveredPolygon.value = null;
}

watch(() => props.activeLabel, (activeLabel) => {
  if (hoveredPolygon.value && hoveredPolygon.value.labelId !== activeLabel) {
    hoveredPolygon.value = null;
  }
});

onMounted(() => {
  window.addEventListener('keydown', handleDeleteHoveredPolygon);
  window.addEventListener('keydown', handleRestoreContourBackup);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleDeleteHoveredPolygon);
  window.removeEventListener('keydown', handleRestoreContourBackup);
});

function onImageLoad() {
  nextTick(() => {
    if (imageRef.value) {
      const { width, height } = imageRef.value.getBoundingClientRect();
      imageSize.value = { width, height };
    }
  });
}

function toSvgPoints(contour: Point[]): string {
  const { width, height } = imageSize.value;
  return contour.map(([x, y]) => `${x * width},${y * height}`).join(' ');
}

function getReactiveSvgPoints(contour: Point[]) {
  return computed(() => toSvgPoints(contour)).value;
}

function getReactiveCropPoints(crop: CropDraft | null) {
  if (!crop) return '';
  const contour: Point[] = [
    [Math.min(crop[0][0], crop[1][0]), Math.min(crop[0][1], crop[1][1])],
    [Math.max(crop[0][0], crop[1][0]), Math.min(crop[0][1], crop[1][1])],
    [Math.max(crop[0][0], crop[1][0]), Math.max(crop[0][1], crop[1][1])],
    [Math.min(crop[0][0], crop[1][0]), Math.max(crop[0][1], crop[1][1])],
    [Math.min(crop[0][0], crop[1][0]), Math.min(crop[0][1], crop[1][1])],
  ];
  return computed(() => toSvgPoints(contour)).value;
}

function commitContour(contour: Point[]) {
  if (!props.activeLabel) return;

  const updatedLabels: LabelItem[] = props.labels.map(label =>
    label.id === props.activeLabel
      ? { ...label, contours: [...label.contours, contour], preRefineContours: null }
      : label
  );
  emit('update:labels', updatedLabels);

  const label = updatedLabels.find(l => l.id === props.activeLabel);
  if (label) {
    emit('contour-committed', { label, labels: updatedLabels });
  }
}

function requestContourRefine(labelId: string) {
  const label = props.labels.find(item => item.id === labelId);
  if (!label || label.contours.length === 0) return;
  emit('contour-dbclick', { label, labels: props.labels });
}

function focusCanvas() {
  containerRef.value?.focus();
}

function handleRestoreContourBackup(event: KeyboardEvent) {
  const activeElement = document.activeElement as HTMLElement | null;
  if (activeElement !== containerRef.value) return;
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
  event.preventDefault();
  emit('restore-contour-backup');
}
</script>

<style scoped>
  img {
    -webkit-touch-callout: none;
  }
</style>
