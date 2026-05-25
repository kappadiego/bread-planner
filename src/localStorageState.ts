import type { AmbientTemperatureId } from './ambientTemperature';
import type { BreadInputs } from './calculations';
import type { GramValues, UnitModes } from './defaults';
import type { FlourMix } from './flours';
import type { TimelineStep } from './timeline';
import type { TimerState } from './timelineUtils';

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
  timerWasRunning: boolean;
};

const canUseLocalStorage = () => {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeTimer = (timer: TimerState) => {
  if (timer.status !== 'running') {
    return { timer, timerWasRunning: false };
  }

  return {
    timer: {
      ...timer,
      status: 'paused' as const,
      pausedAt: Date.now(),
    },
    timerWasRunning: true,
  };
};

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
    if (!isObject(parsed) || parsed.version !== 1 || !isObject(parsed.timeline)) {
      return null;
    }

    const persistedState = parsed as PersistedBreadPlannerState;
    const normalized = normalizeTimer(persistedState.timeline.timer);

    return {
      state: {
        ...persistedState,
        timeline: {
          ...persistedState.timeline,
          timer: normalized.timer,
        },
      },
      timerWasRunning: normalized.timerWasRunning,
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
