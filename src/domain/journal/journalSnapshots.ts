import type {
  CurrentJournalDraft,
  JournalEntry,
  RecipeSnapshot,
  TimelineSnapshot,
} from '../../archiveTypes';
import { cloneValue } from '../shared/cloneValue';
import { formatDiaryDate, toDateInputValue } from './journalDates';

export const getFallbackJournalTitle = (recipeSnapshot: RecipeSnapshot, createdAt: number) => {
  const recipeName = recipeSnapshot.name.trim();
  if (recipeName && recipeName !== 'Entry corrente' && recipeName !== 'Impasto corrente') {
    return recipeName;
  }

  const customName = recipeSnapshot.customProfileName.trim();
  if (customName && customName !== 'Custom') {
    return customName;
  }

  return `Impasto del ${formatDiaryDate(createdAt)}`;
};

export const createJournalEntryFromLegacyDraft = (draft: CurrentJournalDraft): JournalEntry => ({
  id: draft.id,
  schemaVersion: 1,
  createdAt: draft.createdAt,
  updatedAt: draft.updatedAt,
  title: getFallbackJournalTitle(draft.recipeSnapshot, draft.createdAt),
  date: toDateInputValue(draft.createdAt),
  recipeSnapshot: cloneValue(draft.recipeSnapshot),
  timelineSnapshot: draft.timelineSnapshot ? cloneValue(draft.timelineSnapshot) : undefined,
  timerState: draft.timerState ? cloneValue(draft.timerState) : undefined,
  planning: draft.planning ? cloneValue(draft.planning) : undefined,
  sessionData: {
    ambientTemperature: draft.temperatureSetting,
    status: draft.status,
    initialNotes: '',
    finalNotes: '',
    resultLabel: '',
    nextAdjustment: '',
  },
});

export const createJournalSnapshot = (
  recipeSnapshot: RecipeSnapshot,
  timelineSnapshot?: TimelineSnapshot,
) => ({
  recipeSnapshot: cloneValue(recipeSnapshot),
  timelineSnapshot: timelineSnapshot ? cloneValue(timelineSnapshot) : undefined,
});
