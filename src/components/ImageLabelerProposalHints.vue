<template>
  <template v-if="displayHints.length">
    <rect
      v-for="hint in displayHints"
      :key="hint.key"
      :x="hint.x"
      :y="hint.y"
      :width="hint.width"
      :height="hint.height"
      :fill="hint.fill"
      :stroke="hint.stroke"
      :stroke-width="hint.strokeWidth"
      :stroke-dasharray="hint.strokeDasharray"
      rx="6"
    />
  </template>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { RegionProposalBboxHint } from '@/composables/useRegionProposalHints';

const props = defineProps<{
  regionProposalBboxHints: RegionProposalBboxHint[];
  imageWidth: number;
  imageHeight: number;
  activeLabel: string | null;
}>();

type DisplayProposalHint = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray: string;
  isActive: boolean;
};

function withAlphaHex(color: string, alphaHex: string): string {
  const hex = color.trim();
  if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return color;
  return `${hex}${alphaHex}`;
}

const displayHints = computed<DisplayProposalHint[]>(() =>
  props.regionProposalBboxHints.flatMap((hint) => {
    const isActive = hint.labelId === props.activeLabel;
    return hint.bboxes.map((bbox, bboxIndex) => {
      const [x1, y1, x2, y2] = bbox;
      const left = Math.min(x1, x2) * props.imageWidth;
      const top = Math.min(y1, y2) * props.imageHeight;
      const width = Math.abs(x2 - x1) * props.imageWidth;
      const height = Math.abs(y2 - y1) * props.imageHeight;

      return {
        key: `${hint.labelId}-${bboxIndex}`,
        x: left,
        y: top,
        width,
        height,
        fill: withAlphaHex(hint.color, isActive ? '18' : '0A'),
        stroke: withAlphaHex(hint.color, isActive ? 'EE' : '99'),
        strokeWidth: isActive ? 2.4 : 1.6,
        strokeDasharray: isActive ? '10,6' : '8,6',
        isActive,
      };
    });
  }).sort((a, b) => {
    if (a.isActive === b.isActive) return 0;
    return a.isActive ? 1 : -1;
  })
);
</script>
