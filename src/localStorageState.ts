import type { AmbientTemperatureId } from './ambientTemperature';
import type { BreadInputs } from './calculations';
import type { GramValues, UnitModes } from './defaults';
import type { FlourMix } from './flours';
import {
  timelineStepDefinitions,
  type TimelineStep,
  type TimelineStepCategory,
  type TimelineStepType,
} from './timeline';
import { getElapsedMs, getTotalDurationMs, type TimerState, type TimerStatus } from './timelineUtils';

export const BREAD_PLANNER_STORAGE_KEY = 'bread-planner:v1';

export type PersistedBreadPlannerState = {
  version: 1;
  savedAt: number;
  inputs: BreadInputs;
  unitModes: UnitModes;
  gramValues: GramValues;
  activeProfileId: string;
  customProfileName: string;
  flourMix: FlourMix;
  ambientTemperature: AmbientTemperatureId;
  timeline: {
    selectedPresetId: string;
    steps: TimelineStep[];
    timer: TimerState;
  };
};

export type LoadedBreadPlannerState = {
  state: PersistedBreadPlannerState;
};

const convertibleFields = ['saltPercentage', 'starterPercentage', 'oilPercentage'] as const;
const temperatureIds = ['cold', 'normal', 'warm'] as const;
const timerStatuses: TimerStatus[] = ['idle', 'running', 'paused', 'finished'];
const timelineStepTypes = Object.keys(timelineStepDefinitions) as TimelineStepType[];
const timelineStepCategories = ['rest', 'fold', 'fermentation', 'shaping', 'cold', 'bake', 'custom'] as TimelineStepCategory[];

const canUseLocalStorage = () => {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isOptionalFiniteNumber = (value: unknown) => value === undefined || isFiniteNumber(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const isBreadInputs = (value: unknown): value is BreadInputs =>
  isObject(value) &&
  isFiniteNumber(value.flourTotal) &&
  isFiniteNumber(value.hydration) &&
  isFiniteNumber(value.saltPercentage) &&
  isFiniteNumber(value.starterPercentage) &&
  isFiniteNumber(value.starterHydration) &&
  isFiniteNumber(value.oilPercentage);

const isUnitModes = (value: unknown): value is UnitModes =>
  isObject(value) &&
  convertibleFields.every((field) => value[field] === '%' || value[field] === 'g');

const isGramValues = (value: unknown): value is GramValues =>
  isObject(value) && convertibleFields.every((field) => isFiniteNumber(value[field]));

const isFlourMix = (value: unknown): value is FlourMix =>
  isObject(value) &&
  isString(value.id) &&
  isString(value.name) &&
  (value.mode === 'single' || value.mode === 'mix') &&
  Array.isArray(value.items) &&
  value.items.length > 0 &&
  value.items.every((item) => (
    isObject(item) &&
    isString(item.id) &&
    isString(item.flourProfileId) &&
    (item.customName === undefined || isString(item.customName)) &&
    isFiniteNumber(item.percentage) &&
    item.percentage >= 0 &&
    isOptionalFiniteNumber(item.proteinPercentage)
  ));

const isAmbientTemperature = (value: unknown): value is AmbientTemperatureId =>
  temperatureIds.includes(value as AmbientTemperatureId);

const isTimelineStep = (value: unknown): value is TimelineStep =>
  isObject(value) &&
  isString(value.id) &&
  timelineStepTypes.includes(value.type as TimelineStepType) &&
  isString(value.label) &&
  timelineStepCategories.includes(value.category as TimelineStepCategory) &&
  isFiniteNumber(value.defaultDurationMinutes) &&
  isFiniteNumber(value.durationMinutes) &&
  isOptionalFiniteNumber(value.minDurationMinutes) &&
  isOptionalFiniteNumber(value.maxDurationMinutes) &&
  isFiniteNumber(value.durationStepMinutes) &&
  value.durationStepMinutes > 0 &&
  isBoolean(value.isCustom) &&
  isBoolean(value.isDurationEditable) &&
  isBoolean(value.isLabelEditable) &&
  (value.description === undefined || isString(value.description)) &&
  (value.note === undefined || isString(value.note));

const isTimerState = (value: unknown): value is TimerState =>
  isObject(value) &&
  timerStatuses.includes(value.status as TimerStatus) &&
  (value.startedAt === null || isFiniteNumber(value.startedAt)) &&
  (value.pausedAt === null || isFiniteNumber(value.pausedAt)) &&
  isFiniteNumber(value.accumulatedPauseMs) &&
  value.accumulatedPauseMs >= 0;

const finishTimerIfElapsed = (timer: TimerState, steps: TimelineStep[]): TimerState => {
  if (timer.status !== 'running') {
    return timer;
  }

  const totalDurationMs = getTotalDurationMs(steps);
  if (totalDurationMs > 0 && getElapsedMs(timer) >= totalDurationMs) {
    return {
      ...timer,
      status: 'finished',
      pausedAt: null,
    };
  }

  return timer;
};

const isPersistedState = (value: unknown): value is PersistedBreadPlannerState =>
  isObject(value) &&
  value.version === 1 &&
  isFiniteNumber(value.savedAt) &&
  isBreadInputs(value.inputs) &&
  isUnitModes(value.unitModes) &&
  isGramValues(value.gramValues) &&
  isString(value.activeProfileId) &&
  isString(value.customProfileName) &&
  isFlourMix(value.flourMix) &&
  isAmbientTemperature(value.ambientTemperature) &&
  isObject(value.timeline) &&
  isString(value.timeline.selectedPresetId) &&
  Array.isArray(value.timeline.steps) &&
  value.timeline.steps.every(isTimelineStep) &&
  isTimerState(value.timeline.timer);

export const loadPersistedState = (): LoadedBreadPlannerState | null => {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(BREAD_PLANNER_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as unknown;
    if (!isPersistedState(parsed)) {
      return null;
    }

    return {
      state: {
        ...parsed,
        timeline: {
          ...parsed.timeline,
          timer: finishTimerIfElapsed(parsed.timeline.timer, parsed.timeline.steps),
        },
      },
    };
  } catch {
    return null;
  }
};

export const savePersistedState = (state: PersistedBreadPlannerState) => {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(BREAD_PLANNER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage can fail in private mode or when storage quota is full.
  }
};

export const clearPersistedState = () => {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(BREAD_PLANNER_STORAGE_KEY);
  } catch {
    // Ignore storage errors: clearing local memory should never break the app.
  }
};
