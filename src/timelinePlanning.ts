import type { TimelineStep } from './timeline';
import { safeDuration } from './timelineUtils';

export type TimelinePlanningMode = 'now' | 'backward';

export type TimelinePlanningState = {
  mode: TimelinePlanningMode;
  targetEndDate: string;
  targetEndTime: string;
};

export type TimelinePlanningWarningId =
  | 'missing-target'
  | 'empty-timeline'
  | 'zero-duration'
  | 'end-in-past'
  | 'start-in-past'
  | 'invalid-target';

export type TimelinePlanningWarning = {
  id: TimelinePlanningWarningId;
  message: string;
};

export type TimelineStepSchedule = {
  stepId: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
};

export type BackwardTimelinePlan = {
  startAt: Date | null;
  endAt: Date | null;
  totalDurationMinutes: number;
  stepSchedule: TimelineStepSchedule[];
  warnings: TimelinePlanningWarning[];
};

export const initialTimelinePlanning: TimelinePlanningState = {
  mode: 'now',
  targetEndDate: '',
  targetEndTime: '',
};

const minutesToMs = (minutes: number) => minutes * 60 * 1000;

const getTargetEndAt = (targetEndDate: string, targetEndTime: string) => {
  if (!targetEndDate || !targetEndTime) {
    return null;
  }

  const target = new Date(`${targetEndDate}T${targetEndTime}`);
  return Number.isNaN(target.getTime()) ? null : target;
};

export const getTimelineTotalDurationMinutes = (steps: TimelineStep[]) =>
  steps.reduce((total, step) => total + safeDuration(step.durationMinutes), 0);

export const buildStepSchedule = (steps: TimelineStep[], startAt: Date): TimelineStepSchedule[] => {
  let cursor = startAt.getTime();

  return steps.map((step) => {
    const durationMinutes = safeDuration(step.durationMinutes);
    const stepStartAt = new Date(cursor);
    cursor += minutesToMs(durationMinutes);

    return {
      stepId: step.id,
      startAt: stepStartAt,
      endAt: new Date(cursor),
      durationMinutes,
    };
  });
};

export const buildBackwardTimelinePlan = ({
  steps,
  targetEndDate,
  targetEndTime,
  now = new Date(),
}: {
  steps: TimelineStep[];
  targetEndDate: string;
  targetEndTime: string;
  now?: Date;
}): BackwardTimelinePlan => {
  const totalDurationMinutes = getTimelineTotalDurationMinutes(steps);
  const warnings: TimelinePlanningWarning[] = [];

  if (steps.length === 0) {
    warnings.push({
      id: 'empty-timeline',
      message: 'Crea o seleziona una timeline per pianificare a ritroso.',
    });
  }

  if (steps.length > 0 && totalDurationMinutes <= 0) {
    warnings.push({
      id: 'zero-duration',
      message: 'La timeline non ha ancora una durata valida.',
    });
  }

  if (!targetEndDate || !targetEndTime) {
    warnings.push({
      id: 'missing-target',
      message: 'Scegli giorno e ora di fine per calcolare quando iniziare.',
    });
    return {
      startAt: null,
      endAt: null,
      totalDurationMinutes,
      stepSchedule: [],
      warnings,
    };
  }

  const endAt = getTargetEndAt(targetEndDate, targetEndTime);
  if (!endAt) {
    warnings.push({
      id: 'invalid-target',
      message: 'Scegli giorno e ora di fine validi.',
    });
    return {
      startAt: null,
      endAt: null,
      totalDurationMinutes,
      stepSchedule: [],
      warnings,
    };
  }

  const startAt = new Date(endAt.getTime() - minutesToMs(totalDurationMinutes));
  const nowTime = now.getTime();

  if (endAt.getTime() < nowTime) {
    warnings.push({
      id: 'end-in-past',
      message: "L'orario scelto è già passato.",
    });
  }

  if (startAt.getTime() < nowTime) {
    warnings.push({
      id: 'start-in-past',
      message: 'Per completare la timeline a questo orario avresti dovuto iniziare prima.',
    });
  }

  return {
    startAt,
    endAt,
    totalDurationMinutes,
    stepSchedule: totalDurationMinutes > 0 ? buildStepSchedule(steps, startAt) : [],
    warnings,
  };
};

export const formatClockTime = (date: Date) =>
  new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

const startOfLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const formatRelativeDay = (date: Date, referenceDate = new Date()) => {
  const dayDelta = Math.round((startOfLocalDay(date) - startOfLocalDay(referenceDate)) / 86400000);

  if (dayDelta === -1) {
    return 'Ieri';
  }
  if (dayDelta === 0) {
    return 'Oggi';
  }
  if (dayDelta === 1) {
    return 'Domani';
  }

  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: 'short',
  }).format(date);
};

export const formatPlannedDateTime = (date: Date, referenceDate = new Date()) =>
  `${formatRelativeDay(date, referenceDate)} ${formatClockTime(date)}`;

export const formatStepScheduleRange = (
  startAt: Date,
  endAt: Date,
  referenceDate = new Date(),
) => {
  const startDay = formatRelativeDay(startAt, referenceDate);
  const endDay = formatRelativeDay(endAt, referenceDate);
  const startTime = formatClockTime(startAt);
  const endTime = formatClockTime(endAt);

  if (startDay === endDay) {
    return `${startDay} ${startTime} → ${endTime}`;
  }

  return `${startDay} ${startTime} → ${endDay} ${endTime}`;
};
