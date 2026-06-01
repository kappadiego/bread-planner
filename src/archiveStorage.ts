import type {
  ArchiveRecordBase,
  ArchiveState,
  JournalEntry,
  RecipeSnapshot,
  SavedRecipe,
  SavedTimeline,
  TimelineSnapshot,
} from './archiveTypes';
import { cloneValue } from './domain/shared/cloneValue';
import { readLocalStorageItem, writeLocalStorageItem } from './storage/localStorageAdapter';
import type { TimelinePlanningState } from './timelinePlanning';
import type { TimerState } from './timelineUtils';

export const BREAD_PLANNER_ARCHIVE_KEY = 'breadPlanner.archive.v1';

export const createEmptyArchive = (): ArchiveState => ({
  schemaVersion: 1,
  recipes: [],
  timelines: [],
  journal: [],
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isString = (value: unknown): value is string => typeof value === 'string';

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isBaseRecord = (value: unknown): value is ArchiveRecordBase =>
  isObject(value) &&
  isString(value.id) &&
  value.schemaVersion === 1 &&
  isNumber(value.createdAt) &&
  isNumber(value.updatedAt);

const isRecipeSnapshot = (value: unknown): value is RecipeSnapshot =>
  isObject(value) &&
  value.schemaVersion === 1 &&
  isString(value.name) &&
  isString(value.notes) &&
  isString(value.activeProfileId) &&
  isString(value.customProfileName) &&
  isObject(value.inputs) &&
  isObject(value.flourMix) &&
  (value.ambientTemperature === 'cold' || value.ambientTemperature === 'normal' || value.ambientTemperature === 'warm') &&
  isObject(value.calculatedIngredients) &&
  isNumber(value.estimatedDoughWeight);

const isTimelineSnapshot = (value: unknown): value is TimelineSnapshot =>
  isObject(value) &&
  value.schemaVersion === 1 &&
  isString(value.name) &&
  isString(value.notes) &&
  isString(value.selectedPresetId) &&
  (
    value.ambientTemperature === undefined ||
    value.ambientTemperature === 'cold' ||
    value.ambientTemperature === 'normal' ||
    value.ambientTemperature === 'warm'
  ) &&
  isNumber(value.totalDurationMinutes) &&
  Array.isArray(value.steps);

const isTimerState = (value: unknown): value is TimerState =>
  isObject(value) &&
  (value.status === 'idle' || value.status === 'running' || value.status === 'paused' || value.status === 'finished') &&
  (value.startedAt === null || isNumber(value.startedAt)) &&
  (value.pausedAt === null || isNumber(value.pausedAt)) &&
  isNumber(value.accumulatedPauseMs) &&
  value.accumulatedPauseMs >= 0;

const isTimelinePlanningState = (value: unknown): value is TimelinePlanningState =>
  isObject(value) &&
  (value.mode === 'now' || value.mode === 'backward') &&
  isString(value.targetEndDate) &&
  isString(value.targetEndTime);

const isSavedRecipe = (value: unknown): value is SavedRecipe => {
  if (!isObject(value) || !isBaseRecord(value) || !isRecipeSnapshot(value)) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return item.associatedTimelineId === undefined || isString(item.associatedTimelineId);
};

const isSavedTimeline = (value: unknown): value is SavedTimeline =>
  isBaseRecord(value) && isTimelineSnapshot(value);

const isJournalEntry = (value: unknown): value is JournalEntry => {
  if (!isObject(value) || !isBaseRecord(value)) {
    return false;
  }

  const item = value as Record<string, unknown>;
  const sessionData = item.sessionData;
  if (!isObject(sessionData)) {
    return false;
  }

  return isString(item.title) &&
    isString(item.date) &&
    (item.sourceRecipeId === undefined || isString(item.sourceRecipeId)) &&
    (item.sourceTimelineId === undefined || isString(item.sourceTimelineId)) &&
    isRecipeSnapshot(item.recipeSnapshot) &&
    (item.timelineSnapshot === undefined || isTimelineSnapshot(item.timelineSnapshot)) &&
    (item.timerState === undefined || isTimerState(item.timerState)) &&
    (item.planning === undefined || isTimelinePlanningState(item.planning)) &&
    (
      sessionData.status === 'draft' ||
      sessionData.status === 'active' ||
      sessionData.status === 'scheduled' ||
      sessionData.status === 'completed'
    ) &&
    isString(sessionData.initialNotes) &&
    isString(sessionData.finalNotes) &&
    isString(sessionData.resultLabel) &&
    isString(sessionData.nextAdjustment);
};

const isArchiveState = (value: unknown): value is ArchiveState =>
  isObject(value) &&
  value.schemaVersion === 1 &&
  Array.isArray(value.recipes) &&
  value.recipes.every(isSavedRecipe) &&
  Array.isArray(value.timelines) &&
  value.timelines.every(isSavedTimeline) &&
    Array.isArray(value.journal) &&
    value.journal.every(isJournalEntry);

export const createArchiveId = (prefix: string) => {
  const randomPart = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomPart}`;
};

export const loadArchive = (): ArchiveState => {
  try {
    const rawValue = readLocalStorageItem(BREAD_PLANNER_ARCHIVE_KEY);
    if (!rawValue) {
      return createEmptyArchive();
    }

    const parsed = JSON.parse(rawValue) as unknown;
    return isArchiveState(parsed) ? parsed : createEmptyArchive();
  } catch {
    return createEmptyArchive();
  }
};

export const saveArchive = (archive: ArchiveState) => {
  writeLocalStorageItem(BREAD_PLANNER_ARCHIVE_KEY, JSON.stringify(archive));
};

export const addRecipe = (archive: ArchiveState, recipe: SavedRecipe): ArchiveState => ({
  ...archive,
  recipes: [recipe, ...archive.recipes],
});

export const updateRecipe = (archive: ArchiveState, recipe: SavedRecipe): ArchiveState => ({
  ...archive,
  recipes: archive.recipes.map((item) => (item.id === recipe.id ? recipe : item)),
});

export const deleteRecipe = (archive: ArchiveState, recipeId: string): ArchiveState => ({
  ...archive,
  recipes: archive.recipes.filter((recipe) => recipe.id !== recipeId),
});

export const duplicateRecipe = (archive: ArchiveState, recipeId: string): ArchiveState => {
  const recipe = archive.recipes.find((item) => item.id === recipeId);
  if (!recipe) {
    return archive;
  }
  const now = Date.now();
  return addRecipe(archive, {
    ...recipe,
    id: createArchiveId('recipe'),
    name: `${recipe.name} copia`,
    createdAt: now,
    updatedAt: now,
  });
};

export const addTimeline = (archive: ArchiveState, timeline: SavedTimeline): ArchiveState => ({
  ...archive,
  timelines: [timeline, ...archive.timelines],
});

export const updateTimeline = (archive: ArchiveState, timeline: SavedTimeline): ArchiveState => ({
  ...archive,
  timelines: archive.timelines.map((item) => (item.id === timeline.id ? timeline : item)),
});

export const deleteTimeline = (archive: ArchiveState, timelineId: string): ArchiveState => ({
  ...archive,
  timelines: archive.timelines.filter((timeline) => timeline.id !== timelineId),
  recipes: archive.recipes.map((recipe) => (
    recipe.associatedTimelineId === timelineId ? { ...recipe, associatedTimelineId: undefined } : recipe
  )),
});

export const duplicateTimeline = (archive: ArchiveState, timelineId: string): ArchiveState => {
  const timeline = archive.timelines.find((item) => item.id === timelineId);
  if (!timeline) {
    return archive;
  }
  const now = Date.now();
  return addTimeline(archive, {
    ...timeline,
    id: createArchiveId('timeline'),
    name: `${timeline.name} copia`,
    createdAt: now,
    updatedAt: now,
  });
};

export const addJournalEntry = (archive: ArchiveState, entry: JournalEntry): ArchiveState => ({
  ...archive,
  journal: [entry, ...archive.journal],
});

export const updateJournalEntry = (archive: ArchiveState, entry: JournalEntry): ArchiveState => ({
  ...archive,
  journal: archive.journal.map((item) => (item.id === entry.id ? entry : item)),
});

export const deleteJournalEntry = (archive: ArchiveState, entryId: string): ArchiveState => ({
  ...archive,
  journal: archive.journal.filter((entry) => entry.id !== entryId),
});

export const createJournalSnapshot = (
  recipeSnapshot: RecipeSnapshot,
  timelineSnapshot?: TimelineSnapshot,
) => ({
  recipeSnapshot: cloneValue(recipeSnapshot),
  timelineSnapshot: timelineSnapshot ? cloneValue(timelineSnapshot) : undefined,
});
