import type { BreadInputs } from './calculations';
import type { FlourMix } from './flours';
import { timelinePresets, type TimelineStep } from './timeline';
import { initialTimelinePlanning, type TimelinePlanningState } from './timelinePlanning';
import { initialTimer, type TimerState } from './timelineUtils';

export type InputUnit = 'g' | '%';
export type ConvertibleField = 'saltPercentage' | 'starterPercentage' | 'oilPercentage';
export type UnitModes = Record<ConvertibleField, InputUnit>;
export type GramValues = Record<ConvertibleField, number>;

export const initialInputs: BreadInputs = {
  flourTotal: 1000,
  hydration: 65,
  saltPercentage: 2,
  starterPercentage: 20,
  starterHydration: 100,
  oilPercentage: 0,
};

export const convertibleFields: ConvertibleField[] = ['saltPercentage', 'starterPercentage', 'oilPercentage'];

export const initialUnitModes: UnitModes = {
  saltPercentage: '%',
  starterPercentage: '%',
  oilPercentage: '%',
};

export const initialFlourMix: FlourMix = {
  id: 'current-flour-mix',
  name: 'Farine formula',
  mode: 'single',
  items: [
    {
      id: 'flour-1',
      flourProfileId: '0-bread',
      percentage: 100,
    },
  ],
};

export const initialTimelinePresetId = timelinePresets[0].id;

export const cloneTimelineSteps = (steps: TimelineStep[]) => steps.map((step) => ({ ...step }));

export const initialTimelineSteps = () => cloneTimelineSteps(timelinePresets[0].steps);

export const initialTimelineTimer: TimerState = initialTimer;

export const initialPlanning: TimelinePlanningState = initialTimelinePlanning;
