import type { AmbientTemperatureId } from './ambientTemperature';
import type { BreadInputs, BreadResults } from './calculations';
import type { FlourMix } from './flours';
import type { TimelineStep } from './timeline';
import type { TimelinePlanningState } from './timelinePlanning';
import type { TimerState } from './timelineUtils';

export type ArchiveTab = 'recipes' | 'timelines' | 'journal';

export type ArchiveRecordBase = {
  id: string;
  schemaVersion: 1;
  createdAt: number;
  updatedAt: number;
};

export type RecipeSnapshot = {
  schemaVersion: 1;
  name: string;
  notes: string;
  activeProfileId: string;
  customProfileName: string;
  inputs: BreadInputs;
  flourMix: FlourMix;
  ambientTemperature: AmbientTemperatureId;
  calculatedIngredients: BreadResults;
  estimatedDoughWeight: number;
};

export type TimelineSnapshot = {
  schemaVersion: 1;
  name: string;
  notes: string;
  activeProfileId?: string;
  selectedPresetId: string;
  ambientTemperature?: AmbientTemperatureId;
  totalDurationMinutes: number;
  steps: TimelineStep[];
};

export type SavedRecipe = ArchiveRecordBase & RecipeSnapshot & {
  associatedTimelineId?: string;
};

export type SavedTimeline = ArchiveRecordBase & TimelineSnapshot;

export type JournalStatus = 'draft' | 'active' | 'scheduled' | 'completed';

/**
 * Legacy shape kept only to migrate local drafts created before journal
 * sessions became regular diary entries.
 */
export type CurrentJournalDraft = {
  id: string;
  status: JournalStatus;
  recipeSnapshot: RecipeSnapshot;
  timelineSnapshot?: TimelineSnapshot;
  temperatureSetting: AmbientTemperatureId;
  createdAt: number;
  updatedAt: number;
  timerState?: TimerState;
  planning?: TimelinePlanningState;
};

export type JournalSessionData = {
  ambientTemperature: AmbientTemperatureId;
  waterTemperature?: number;
  doughTemperature?: number;
  startTime?: string;
  endTime?: string;
  status: JournalStatus;
  initialNotes: string;
  finalNotes: string;
  resultRating?: number;
  resultLabel: string;
  crumbNotes?: string;
  crustNotes?: string;
  acidityNotes?: string;
  doughHandlingNotes?: string;
  nextAdjustment: string;
};

export type JournalEntry = ArchiveRecordBase & {
  title: string;
  date: string;
  sourceRecipeId?: string;
  sourceTimelineId?: string;
  recipeSnapshot: RecipeSnapshot;
  timelineSnapshot?: TimelineSnapshot;
  sessionData: JournalSessionData;
  timerState?: TimerState;
  planning?: TimelinePlanningState;
};

export type ArchiveState = {
  schemaVersion: 1;
  recipes: SavedRecipe[];
  timelines: SavedTimeline[];
  journal: JournalEntry[];
};
