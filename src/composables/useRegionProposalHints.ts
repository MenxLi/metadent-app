import { computed, ref, watch, type ComputedRef } from 'vue';
import type { LabelItem } from '@/api';

export type NormalizedBbox = [number, number, number, number];

export interface RegionProposalBboxHint {
  labelId: string;
  color: string;
  bboxes: NormalizedBbox[];
}

export function useRegionProposalHints(options: {
  activeFileName: ComputedRef<string | null | undefined>;
  labelItems: ComputedRef<LabelItem[]>;
}) {
  const bboxByLabelId = ref<Record<string, NormalizedBbox[]>>({});

  function resetRegionProposalBboxHints() {
    bboxByLabelId.value = {};
  }

  function setRegionProposalBboxHintsForLabel(labelId: string, bboxes: NormalizedBbox[]) {
    if (bboxes.length === 0) {
      clearRegionProposalBboxHintsForLabel(labelId);
      return;
    }

    bboxByLabelId.value = {
      ...bboxByLabelId.value,
      [labelId]: bboxes.map((bbox) => [...bbox] as NormalizedBbox),
    };
  }

  function clearRegionProposalBboxHintsForLabel(labelId: string) {
    if (!(labelId in bboxByLabelId.value)) {
      return;
    }

    const nextBboxes = { ...bboxByLabelId.value };
    delete nextBboxes[labelId];
    bboxByLabelId.value = nextBboxes;
  }

  watch(
    () => options.activeFileName.value,
    () => {
      resetRegionProposalBboxHints();
    },
    { immediate: true }
  );

  watch(
    () => options.labelItems.value.map((item) => item.id),
    (labelIds) => {
      const validIds = new Set(labelIds);
      const nextBboxes = Object.fromEntries(
        Object.entries(bboxByLabelId.value).filter(([labelId]) => validIds.has(labelId))
      ) as Record<string, NormalizedBbox[]>;

      if (Object.keys(nextBboxes).length !== Object.keys(bboxByLabelId.value).length) {
        bboxByLabelId.value = nextBboxes;
      }
    },
    { immediate: true }
  );

  const regionProposalBboxHints = computed<RegionProposalBboxHint[]>(() =>
    options.labelItems.value.flatMap((item) => {
      const bboxes = bboxByLabelId.value[item.id];
      if (!bboxes?.length) {
        return [];
      }

      return [{
        labelId: item.id,
        color: item.color,
        bboxes,
      }];
    })
  );

  return {
    regionProposalBboxHints,
    setRegionProposalBboxHintsForLabel,
    clearRegionProposalBboxHintsForLabel,
  };
}
