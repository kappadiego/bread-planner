import type { TimelineSnapshot } from '../../archiveTypes';
import type { TimelinePlanningState } from '../../timelinePlanning';
import { initialTimer, type TimerState } from '../../timelineUtils';
import type { ActiveSession, ActiveSessionDerivedState, ActiveSessionStep } from './activeSessionTypes';

const minutesToMs = (minutes: number) => minutes * 60 * 1000;

const safeDurationMinutes = (minutes: number) =>
  Number.isFinite(minutes) ? Math.max(0, minutes) : 0;

export const getActiveSessionTotalDurationMs = (session: ActiveSession) =>
  session.stepSchedule.reduce((total, step) => total + minutesToMs(step.durationMinutes), 0);

export const buildActiveSessionStepSchedule = (
  timelineSnapshot: TimelineSnapshot,
  startAt: number,
): ActiveSessionStep[] => {
  let cursor = startAt;

  return timelineSnapshot.steps.map((step) => {
    const durationMinutes = safeDurationMinutes(step.durationMinutes);
    const startsAt = cursor;
    cursor += minutesToMs(durationMinutes);

    return {
      stepId: step.id,
      label: step.label,
      startsAt,
      endsAt: cursor,
      durationMinutes,
    };
  });
};

export const createActiveSession = ({
  id,
  recipeSnapshot,
  timelineSnapshot,
  journalEntryId,
  status,
  startedAt,
  scheduledStartAt,
}: {
  id: string;
  recipeSnapshot: ActiveSession['recipeSnapshot'];
  timelineSnapshot: TimelineSnapshot;
  journalEntryId?: string;
  status: Extract<ActiveSession['status'], 'running' | 'scheduled'>;
  startedAt?: number;
  scheduledStartAt?: number;
}): ActiveSession => {
  const now = Date.now();
  const sessionStartAt = status === 'scheduled'
    ? scheduledStartAt ?? now
    : startedAt ?? now;
  const stepSchedule = buildActiveSessionStepSchedule(timelineSnapshot, sessionStartAt);

  return {
    id,
    status,
    recipeSnapshot,
    timelineSnapshot,
    journalEntryId,
    createdAt: now,
    scheduledStartAt: status === 'scheduled' ? sessionStartAt : undefined,
    startedAt: status === 'running' ? sessionStartAt : undefined,
    accumulatedPauseMs: 0,
    currentStepId: stepSchedule[0]?.stepId,
    stepSchedule,
    soundEnabled: false,
  };
};

export const getActiveSessionElapsedMs = (session: ActiveSession, now = Date.now()) => {
  if (!session.startedAt) {
    return 0;
  }

  const endAt = session.status === 'paused' && session.pausedAt ? session.pausedAt : now;
  return Math.max(0, endAt - session.startedAt - session.accumulatedPauseMs);
};

export const getActiveSessionDerivedState = (
  session: ActiveSession,
  now = Date.now(),
): ActiveSessionDerivedState => {
  const totalDurationMs = getActiveSessionTotalDurationMs(session);
  const elapsedMs = Math.min(getActiveSessionElapsedMs(session, now), totalDurationMs);
  const isStartDue = session.status === 'scheduled' && Boolean(session.scheduledStartAt && session.scheduledStartAt <= now);
  const isFinishedByTime = totalDurationMs > 0 && elapsedMs >= totalDurationMs;

  let accumulatedMs = 0;
  let currentStep: ActiveSessionStep | undefined;
  let nextStep: ActiveSessionStep | undefined;

  for (let index = 0; index < session.stepSchedule.length; index += 1) {
    const step = session.stepSchedule[index];
    const stepDurationMs = minutesToMs(step.durationMinutes);
    const stepEndMs = accumulatedMs + stepDurationMs;

    if (elapsedMs < stepEndMs && !currentStep) {
      currentStep = step;
      nextStep = session.stepSchedule[index + 1];
      break;
    }

    accumulatedMs = stepEndMs;
  }

  return {
    currentStep,
    nextStep,
    elapsedMs,
    totalDurationMs,
    remainingMs: Math.max(0, totalDurationMs - elapsedMs),
    progressPercentage: totalDurationMs > 0 ? Math.min(100, Math.round(elapsedMs / totalDurationMs * 100)) : 0,
    isStartDue,
    isFinishedByTime,
  };
};

export const normalizeActiveSession = (session: ActiveSession, now = Date.now()): ActiveSession => {
  if (session.status !== 'running') {
    return session;
  }

  const derived = getActiveSessionDerivedState(session, now);
  if (!derived.isFinishedByTime) {
    return {
      ...session,
      currentStepId: derived.currentStep?.stepId,
    };
  }

  return {
    ...session,
    status: 'completed',
    completedAt: session.completedAt ?? now,
    pausedAt: undefined,
    currentStepId: undefined,
  };
};

export const startScheduledActiveSession = (session: ActiveSession, now = Date.now()): ActiveSession => {
  const startedAt = session.scheduledStartAt ?? now;
  return normalizeActiveSession({
    ...session,
    status: 'running',
    startedAt,
    pausedAt: undefined,
    scheduledStartAt: session.scheduledStartAt ?? startedAt,
    stepSchedule: buildActiveSessionStepSchedule(session.timelineSnapshot, startedAt),
    currentStepId: session.stepSchedule[0]?.stepId,
  }, now);
};

export const pauseActiveSession = (session: ActiveSession, now = Date.now()): ActiveSession =>
  session.status === 'running'
    ? { ...session, status: 'paused', pausedAt: now }
    : session;

export const resumeActiveSession = (session: ActiveSession, now = Date.now()): ActiveSession => {
  if (session.status !== 'paused' || !session.pausedAt) {
    return session;
  }

  return normalizeActiveSession({
    ...session,
    status: 'running',
    accumulatedPauseMs: session.accumulatedPauseMs + now - session.pausedAt,
    pausedAt: undefined,
  }, now);
};

const moveSessionToStepEnd = (
  session: ActiveSession,
  action: 'completedAt' | 'skippedAt',
  now = Date.now(),
): ActiveSession => {
  const derived = getActiveSessionDerivedState(session, now);
  const currentStep = derived.currentStep;
  if (!currentStep || !session.startedAt || session.status === 'completed') {
    return session;
  }

  const targetElapsedMs = session.stepSchedule
    .slice(0, session.stepSchedule.findIndex((step) => step.stepId === currentStep.stepId) + 1)
    .reduce((total, step) => total + minutesToMs(step.durationMinutes), 0);
  const baseNow = session.status === 'paused' && session.pausedAt ? session.pausedAt : now;
  const nextStartedAt = baseNow - targetElapsedMs - session.accumulatedPauseMs;
  const stepSchedule = session.stepSchedule.map((step) => (
    step.stepId === currentStep.stepId ? { ...step, [action]: now } : step
  ));
  const finished = targetElapsedMs >= derived.totalDurationMs;

  return {
    ...session,
    status: finished ? 'completed' : session.status,
    startedAt: nextStartedAt,
    pausedAt: session.status === 'paused' && !finished ? baseNow : undefined,
    completedAt: finished ? now : session.completedAt,
    currentStepId: finished ? undefined : getActiveSessionDerivedState({ ...session, startedAt: nextStartedAt, stepSchedule }, now).currentStep?.stepId,
    stepSchedule,
  };
};

export const completeActiveSessionStep = (session: ActiveSession, now = Date.now()) =>
  moveSessionToStepEnd(session, 'completedAt', now);

export const skipActiveSessionStep = (session: ActiveSession, now = Date.now()) =>
  moveSessionToStepEnd(session, 'skippedAt', now);

export const completeActiveSession = (session: ActiveSession, now = Date.now()): ActiveSession => ({
  ...session,
  status: 'completed',
  completedAt: session.completedAt ?? now,
  pausedAt: undefined,
  currentStepId: undefined,
});

export const setActiveSessionSoundEnabled = (session: ActiveSession, soundEnabled: boolean): ActiveSession => ({
  ...session,
  soundEnabled,
});

export const markActiveSessionNotificationAsked = (session: ActiveSession): ActiveSession => ({
  ...session,
  notificationPermissionAsked: true,
});

export const activeSessionToTimerState = (session?: ActiveSession): TimerState => {
  if (!session) {
    return initialTimer;
  }

  if (session.status === 'scheduled') {
    return initialTimer;
  }

  if (session.status === 'completed') {
    return {
      status: 'finished',
      startedAt: session.startedAt ?? null,
      pausedAt: null,
      accumulatedPauseMs: session.accumulatedPauseMs,
    };
  }

  return {
    status: session.status === 'paused' ? 'paused' : 'running',
    startedAt: session.startedAt ?? null,
    pausedAt: session.status === 'paused' ? session.pausedAt ?? null : null,
    accumulatedPauseMs: session.accumulatedPauseMs,
  };
};

export const getSessionStartDate = (session: ActiveSession) =>
  session.startedAt ?? session.scheduledStartAt ?? session.createdAt;

export const getSessionEndDate = (session: ActiveSession) =>
  session.completedAt ?? Date.now();

export const getSessionPauseMinutes = (session: ActiveSession) =>
  Math.round(session.accumulatedPauseMs / 60000);

export const getTimelinePlanningFromSession = (_session: ActiveSession): TimelinePlanningState => ({
  mode: 'now',
  targetEndDate: '',
  targetEndTime: '',
});
