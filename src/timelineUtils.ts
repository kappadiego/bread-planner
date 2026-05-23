import type { TimelineStep } from './timeline';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export type TimerState = {
  status: TimerStatus;
  startedAt: number | null;
  pausedAt: number | null;
  accumulatedPauseMs: number;
};

export type CurrentStepInfo = {
  index: number;
  step: TimelineStep;
  stepStartMs: number;
  stepEndMs: number;
  elapsedInStepMs: number;
  remainingInStepMs: number;
};

export const initialTimer: TimerState = {
  status: 'idle',
  startedAt: null,
  pausedAt: null,
  accumulatedPauseMs: 0,
};

export const safeDuration = (durationMinutes: number) =>
  Number.isFinite(durationMinutes) ? Math.max(0, durationMinutes) : 0;

export const getElapsedMs = (timer: TimerState) => {
  if (timer.startedAt === null) {
    return 0;
  }

  const now = timer.status === 'paused' && timer.pausedAt !== null ? timer.pausedAt : Date.now();

  return Math.max(0, now - timer.startedAt - timer.accumulatedPauseMs);
};

export const getTotalDurationMs = (steps: TimelineStep[]) =>
  steps.reduce((total, step) => total + safeDuration(step.durationMinutes) * 60 * 1000, 0);

export const getCurrentStepInfo = (
  steps: TimelineStep[],
  elapsedMs: number,
): CurrentStepInfo | null => {
  let accumulated = 0;

  for (let index = 0; index < steps.length; index += 1) {
    const stepDurationMs = safeDuration(steps[index].durationMinutes) * 60 * 1000;
    const stepStartMs = accumulated;
    const stepEndMs = accumulated + stepDurationMs;

    if (elapsedMs < stepEndMs) {
      return {
        index,
        step: steps[index],
        stepStartMs,
        stepEndMs,
        elapsedInStepMs: elapsedMs - stepStartMs,
        remainingInStepMs: stepEndMs - elapsedMs,
      };
    }

    accumulated += stepDurationMs;
  }

  return null;
};

export const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
};
