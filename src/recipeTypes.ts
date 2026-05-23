import type { BatchTarget, FormulaPercentages } from './calculations';

export type RecipeDraft = {
  id: string;
  name: string;
  profileId: string;
  formula: FormulaPercentages;
  batch: BatchTarget;
  timelinePresetId?: string;
  flourMixId?: string;
  createdAt?: string;
  updatedAt?: string;
};
