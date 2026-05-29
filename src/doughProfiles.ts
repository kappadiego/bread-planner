import type { FormulaPercentages } from './calculations';

export type DoughProfileSource = 'system' | 'user';

export type DoughProfile = {
  id: string;
  source: DoughProfileSource;
  label: string;
  description: string;
  values: FormulaPercentages;
  recommendedTimelinePresetId?: string;
};

export const doughProfiles: DoughProfile[] = [
  {
    id: 'base',
    source: 'system',
    label: 'Pane base',
    description: 'Equilibrato, senza grassi aggiunti.',
    values: {
      hydration: 65,
      saltPercentage: 2,
      starterPercentage: 20,
      starterHydration: 100,
      oilPercentage: 0,
    },
    recommendedTimelinePresetId: 'basic-same-day',
  },
  {
    id: 'high',
    source: 'system',
    label: 'Alta idratazione',
    description: 'Più acqua, impasto più delicato.',
    values: {
      hydration: 80,
      saltPercentage: 2,
      starterPercentage: 20,
      starterHydration: 100,
      oilPercentage: 0,
    },
    recommendedTimelinePresetId: 'high-hydration',
  },
  {
    id: 'focaccia',
    source: 'system',
    label: 'Focaccia',
    description: 'Impasto morbido, con olio.',
    values: {
      hydration: 75,
      saltPercentage: 2,
      starterPercentage: 15,
      starterHydration: 100,
      oilPercentage: 4,
    },
    recommendedTimelinePresetId: 'focaccia',
  },
];
