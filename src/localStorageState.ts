import type { AmbientTemperatureId } from './ambientTemperature';
import type { CurrentJournalDraft, RecipeSnapshot, TimelineSnapshot } from './archiveTypes';
import type { BreadInputs } from './calculations';
import type { ActiveSession, ActiveSessionStep, LegacyActiveSessionStatus } from './domain/session/activeSessionTypes';
import { normalizeActiveSession } from './domain/session/activeSessionUtils';
import type { GramValues, UnitModes } from './defaults';
import type { FlourMix } from './flours';
import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from './storage/localStorageAdapter';
import {
  timelineStepDefinitions,
  type TimelineStep,
  type TimelineStepCategory,
  type TimelineStepType,
} from './timeline';
import {
  initialTimelinePlanning,
  type TimelinePlanningMode,
  type TimelinePlanningState,
} from './timelinePlanning';
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
    name?: string;
    isCustom?: boolean;
    selectedPresetId: string;
    steps: TimelineStep[];
    timer: TimerState;
    planning?: TimelinePlanningState;
  };
  currentJournalEntryId?: string;
  currentJournalDraft?: CurrentJournalDraft;
  activeSession?: ActiveSession;
};

export type LoadedBreadPlannerState = {
  state: PersistedBreadPlannerState;
  legacyScheduledActiveSession?: PersistedLegacyActiveSession;
};

export type PersistedLegacyActiveSession = Omit<ActiveSession, 'status'> & {
  status: LegacyActiveSessionStatus;
};

const convertibleFields = ['saltPercentage', 'starterPercentage', 'oilPercentage'] as const;
const temperatureIds = ['cold', 'normal', 'warm'] as const;
const timerStatuses: TimerStatus[] = ['idle', 'running', 'paused', 'finished'];
const planningModes: TimelinePlanningMode[] = ['now', 'backward'];
const journalStatuses = ['draft', 'active', 'scheduled', 'completed'] as const;
const activeSessionStatuses = ['running', 'paused', 'completed'] as const;
const legacyActiveSessionStatuses = ['scheduled', ...activeSessionStatuses] as const;
const timelineStepTypes = Object.keys(timelineStepDefinitions) as TimelineStepType[];
const timelineStepCategories = ['rest', 'fold', 'fermentation', 'shaping', 'cold', 'bake', 'custom'] as TimelineStepCategory[];

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

const isTimelinePlanningState = (value: unknown): value is TimelinePlanningState =>
  isObject(value) &&
  planningModes.includes(value.mode as TimelinePlanningMode) &&
  isString(value.targetEndDate) &&
  isString(value.targetEndTime);

const isRecipeSnapshot = (value: unknown): value is RecipeSnapshot =>
  isObject(value) &&
  value.schemaVersion === 1 &&
  isString(value.name) &&
  isString(value.notes) &&
  isString(value.activeProfileId) &&
  isString(value.customProfileName) &&
  isBreadInputs(value.inputs) &&
  isFlourMix(value.flourMix) &&
  isAmbientTemperature(value.ambientTemperature) &&
  isObject(value.calculatedIngredients) &&
  isFiniteNumber(value.estimatedDoughWeight);

const isTimelineSnapshot = (value: unknown): value is TimelineSnapshot =>
  isObject(value) &&
  value.schemaVersion === 1 &&
  isString(value.name) &&
  isString(value.notes) &&
  (value.activeProfileId === undefined || isString(value.activeProfileId)) &&
  isString(value.selectedPresetId) &&
  (value.ambientTemperature === undefined || isAmbientTemperature(value.ambientTemperature)) &&
  isFiniteNumber(value.totalDurationMinutes) &&
  Array.isArray(value.steps) &&
  value.steps.every(isTimelineStep);

const isCurrentJournalDraft = (value: unknown): value is CurrentJournalDraft =>
  isObject(value) &&
  isString(value.id) &&
  journalStatuses.includes(value.status as (typeof journalStatuses)[number]) &&
  isRecipeSnapshot(value.recipeSnapshot) &&
  (value.timelineSnapshot === undefined || isTimelineSnapshot(value.timelineSnapshot)) &&
  isAmbientTemperature(value.temperatureSetting) &&
  isFiniteNumber(value.createdAt) &&
  isFiniteNumber(value.updatedAt) &&
  (value.timerState === undefined || isTimerState(value.timerState)) &&
  (value.planning === undefined || isTimelinePlanningState(value.planning));

const isActiveSessionStep = (value: unknown): value is ActiveSessionStep =>
  isObject(value) &&
  isString(value.stepId) &&
  isString(value.label) &&
  isFiniteNumber(value.startsAt) &&
  isFiniteNumber(value.endsAt) &&
  isFiniteNumber(value.durationMinutes) &&
  value.durationMinutes >= 0 &&
  (value.completedAt === undefined || isFiniteNumber(value.completedAt)) &&
  (value.skippedAt === undefined || isFiniteNumber(value.skippedAt));

const isPersistedLegacyActiveSession = (value: unknown): value is PersistedLegacyActiveSession =>
  isObject(value) &&
  isString(value.id) &&
  legacyActiveSessionStatuses.includes(value.status as (typeof legacyActiveSessionStatuses)[number]) &&
  isRecipeSnapshot(value.recipeSnapshot) &&
  isTimelineSnapshot(value.timelineSnapshot) &&
  (value.journalEntryId === undefined || isString(value.journalEntryId)) &&
  isFiniteNumber(value.createdAt) &&
  (value.scheduledStartAt === undefined || isFiniteNumber(value.scheduledStartAt)) &&
  (value.startedAt === undefined || isFiniteNumber(value.startedAt)) &&
  (value.pausedAt === undefined || isFiniteNumber(value.pausedAt)) &&
  (value.completedAt === undefined || isFiniteNumber(value.completedAt)) &&
  isFiniteNumber(value.accumulatedPauseMs) &&
  value.accumulatedPauseMs >= 0 &&
  (value.currentStepId === undefined || isString(value.currentStepId)) &&
  Array.isArray(value.stepSchedule) &&
  value.stepSchedule.every(isActiveSessionStep) &&
  (value.notificationPermissionAsked === undefined || isBoolean(value.notificationPermissionAsked)) &&
  (value.soundEnabled === undefined || isBoolean(value.soundEnabled));

const isActiveSession = (value: unknown): value is ActiveSession =>
  isPersistedLegacyActiveSession(value) &&
  activeSessionStatuses.includes(value.status as (typeof activeSessionStatuses)[number]);

const normalizeTimelinePlanning = (value: unknown): TimelinePlanningState =>
  isTimelinePlanningState(value) ? value : initialTimelinePlanning;

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
  (value.timeline.name === undefined || isString(value.timeline.name)) &&
  (value.timeline.isCustom === undefined || isBoolean(value.timeline.isCustom)) &&
  isString(value.timeline.selectedPresetId) &&
  Array.isArray(value.timeline.steps) &&
  value.timeline.steps.every(isTimelineStep) &&
  isTimerState(value.timeline.timer) &&
  (value.timeline.planning === undefined || isTimelinePlanningState(value.timeline.planning)) &&
  (value.currentJournalEntryId === undefined || isString(value.currentJournalEntryId)) &&
  (value.currentJournalDraft === undefined || isCurrentJournalDraft(value.currentJournalDraft));

export const loadPersistedState = (): LoadedBreadPlannerState | null => {
  try {
    const rawValue = readLocalStorageItem(BREAD_PLANNER_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as unknown;
    if (!isPersistedState(parsed)) {
      return null;
    }

    const parsedRecord = parsed as Record<string, unknown>;
    const persistedActiveSession = isPersistedLegacyActiveSession(parsedRecord.activeSession)
      ? parsedRecord.activeSession
      : undefined;
    const legacyScheduledActiveSession = persistedActiveSession?.status === 'scheduled'
      ? persistedActiveSession
      : undefined;
    const activeSession = isActiveSession(persistedActiveSession)
      ? normalizeActiveSession(persistedActiveSession)
      : undefined;

    return {
      state: {
        ...parsed,
        timeline: {
          ...parsed.timeline,
          timer: finishTimerIfElapsed(parsed.timeline.timer, parsed.timeline.steps),
          planning: normalizeTimelinePlanning(parsed.timeline.planning),
        },
        activeSession,
      },
      legacyScheduledActiveSession,
    };
  } catch {
    return null;
  }
};

export const savePersistedState = (state: PersistedBreadPlannerState) => {
  writeLocalStorageItem(BREAD_PLANNER_STORAGE_KEY, JSON.stringify(state));
};

export const clearPersistedState = () => {
  removeLocalStorageItem(BREAD_PLANNER_STORAGE_KEY);
};
