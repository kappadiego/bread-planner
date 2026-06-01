import type { RecipeSnapshot, TimelineSnapshot } from '../../archiveTypes';

export type ActiveSessionStatus = 'scheduled' | 'running' | 'paused' | 'completed';

export type ActiveSessionStep = {
  stepId: string;
  label: string;
  startsAt: number;
  endsAt: number;
  durationMinutes: number;
  completedAt?: number;
  skippedAt?: number;
};

export type ActiveSession = {
  id: string;
  status: ActiveSessionStatus;
  recipeSnapshot: RecipeSnapshot;
  timelineSnapshot: TimelineSnapshot;
  journalEntryId?: string;
  createdAt: number;
  scheduledStartAt?: number;
  startedAt?: number;
  pausedAt?: number;
  completedAt?: number;
  accumulatedPauseMs: number;
  currentStepId?: string;
  stepSchedule: ActiveSessionStep[];
  notificationPermissionAsked?: boolean;
  soundEnabled?: boolean;
};

export type ActiveSessionDerivedState = {
  currentStep?: ActiveSessionStep;
  nextStep?: ActiveSessionStep;
  elapsedMs: number;
  totalDurationMs: number;
  remainingMs: number;
  progressPercentage: number;
  isStartDue: boolean;
  isFinishedByTime: boolean;
};
