import type { AmbientTemperatureId } from '../../ambientTemperature';
import type { JournalStatus, RecipeSnapshot, TimelineSnapshot } from '../../archiveTypes';
import type { TimelinePlanningState } from '../../timelinePlanning';
import type { TimerState } from '../../timelineUtils';

export type ActiveSessionStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'finished';

export type ActiveBreadSession = {
  sessionId: string;
  journalEntryId?: string;
  recipeSnapshot: RecipeSnapshot;
  timelineSnapshot?: TimelineSnapshot;
  timerState: TimerState;
  planning: TimelinePlanningState;
  ambientTemperature: AmbientTemperatureId;
  status: ActiveSessionStatus;
  journalStatus?: JournalStatus;
  createdAt: number;
  updatedAt: number;
};
