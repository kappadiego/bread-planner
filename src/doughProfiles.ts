import type { BreadInputs } from './calculations';

export type DoughProfile = {
  id: 'base' | 'high' | 'focaccia';
  label: string;
  description: string;
  values: Pick<
    BreadInputs,
    'hydration' | 'saltPercentage' | 'starterPercentage' | 'starterHydration' | 'oilPercentage'
  >;
  recommendedTimelinePresetId?: string;
};

export const doughProfiles: DoughProfile[] = [
  {
    id: 'base',
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
    label: 'Focaccia',
    description: 'Impasto morbido, con olio.',
    values: {
      hydration: 75,
      saltPercentage: 2.2,
      starterPercentage: 15,
      starterHydration: 100,
      oilPercentage: 4,
    },
    recommendedTimelinePresetId: 'focaccia',
  },
];
