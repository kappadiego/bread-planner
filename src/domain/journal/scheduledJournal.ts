import type { AmbientTemperatureId } from '../../ambientTemperature';
import type { JournalEntry, RecipeSnapshot, TimelineSnapshot } from '../../archiveTypes';
import type { TimelinePlanningState } from '../../timelinePlanning';
import { cloneValue } from '../shared/cloneValue';
import { toDateInputValue } from './journalDates';
import { getFallbackJournalTitle } from './journalSnapshots';

export const createScheduledJournalEntry = ({
  id,
  recipeSnapshot,
  timelineSnapshot,
  ambientTemperature,
  planning,
  scheduledStartAt,
  targetEndAt,
  existingEntry,
  sourceRecipeId,
  sourceTimelineId,
}: {
  id: string;
  recipeSnapshot: RecipeSnapshot;
  timelineSnapshot: TimelineSnapshot;
  ambientTemperature: AmbientTemperatureId;
  planning: TimelinePlanningState;
  scheduledStartAt: number;
  targetEndAt?: number;
  existingEntry?: JournalEntry;
  sourceRecipeId?: string;
  sourceTimelineId?: string;
}): JournalEntry => {
  const now = Date.now();
  const createdAt = existingEntry?.createdAt ?? now;

  return {
    id,
    schemaVersion: 1,
    createdAt,
    updatedAt: now,
    title: existingEntry?.title || getFallbackJournalTitle(recipeSnapshot, scheduledStartAt),
    date: existingEntry?.date || toDateInputValue(scheduledStartAt),
    sourceRecipeId,
    sourceTimelineId,
    recipeSnapshot: cloneValue(recipeSnapshot),
    timelineSnapshot: cloneValue(timelineSnapshot),
    timerState: existingEntry?.timerState ? cloneValue(existingEntry.timerState) : undefined,
    planning: cloneValue(planning),
    sessionData: {
      ...existingEntry?.sessionData,
      ambientTemperature,
      status: 'scheduled',
      scheduledStartAt,
      targetEndAt,
      scheduledLabel: existingEntry?.sessionData.scheduledLabel,
      initialNotes: existingEntry?.sessionData.initialNotes ?? '',
      finalNotes: existingEntry?.sessionData.finalNotes ?? '',
      resultLabel: existingEntry?.sessionData.resultLabel ?? '',
      nextAdjustment: existingEntry?.sessionData.nextAdjustment ?? '',
    },
  };
};
