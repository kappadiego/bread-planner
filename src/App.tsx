import {
  BookOpen,
  CalendarDays,
  CircleHelp,
  CirclePlus,
  Clock3,
  Droplets,
  FilePlus2,
  FolderOpen,
  Play,
  RotateCcw,
  Save,
  Thermometer,
  Trash2,
  Wheat,
  X,
} from 'lucide-react';
import type { ComponentType, CSSProperties, MouseEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ArchiveState,
  ArchiveTab,
  CurrentJournalDraft,
  JournalEntry,
  JournalSessionData,
  JournalStatus,
  RecipeSnapshot,
  SavedRecipe,
  SavedTimeline,
  TimelineSnapshot,
} from './archiveTypes';
import {
  defaultAmbientTemperature,
  getAmbientTemperatureOption,
  type AmbientTemperatureId,
} from './ambientTemperature';
import { calculateBread, type BreadInputs, roundGram } from './calculations';
import { ActiveSessionBar } from './components/ActiveSessionBar';
import { ArchivePanel } from './components/ArchivePanel';
import { FlourMixEditor } from './components/FlourMixEditor';
import { TimelinePlanner } from './components/TimelinePlanner';
import {
  cloneTimelineSteps,
  convertibleFields,
  initialFlourMix,
  initialInputs,
  initialPlanning,
  initialTimelinePresetId,
  initialTimelineSteps,
  initialTimelineTimer,
  initialUnitModes,
  type ConvertibleField,
  type GramValues,
  type InputUnit,
  type UnitModes,
} from './defaults';
import { formatDiaryDate, toDateInputValue } from './domain/journal/journalDates';
import { createScheduledJournalEntry } from './domain/journal/scheduledJournal';
import { sortJournalEntries } from './domain/journal/journalSorting';
import {
  createJournalEntryFromLegacyDraft,
  createJournalSnapshot,
  getFallbackJournalTitle,
} from './domain/journal/journalSnapshots';
import type { ActiveSession } from './domain/session/activeSessionTypes';
import {
  activeSessionToTimerState,
  completeActiveSession,
  createActiveSession,
  getSessionEndDate,
  getSessionPauseMinutes,
  getSessionStartDate,
} from './domain/session/activeSessionUtils';
import { getActiveSessionBlockingMessage, getActiveSessionRecipeName, isBlockingLiveSession } from './domain/session/sessionGuards';
import { cloneValue } from './domain/shared/cloneValue';
import { doughProfiles, type DoughProfile } from './doughProfiles';
import {
  calculateFlourBreakdown,
  getFlourMixTotalPercentage,
  getFlourProfile,
  isFlourMixValid,
  type FlourBreakdownRow,
  type FlourMix,
} from './flours';
import {
  addJournalEntry,
  addRecipe,
  addTimeline,
  createArchiveId,
  deleteJournalEntry,
  deleteRecipe,
  deleteTimeline,
  duplicateRecipe,
  duplicateTimeline,
  loadArchive,
  saveArchive,
  updateJournalEntry,
  updateRecipe,
  updateTimeline,
} from './archiveStorage';
import {
  clearPersistedState,
  loadPersistedState,
  savePersistedState,
  type PersistedLegacyActiveSession,
  type PersistedBreadPlannerState,
} from './localStorageState';
import { timelinePresets, type TimelineStep } from './timeline';
import type { TimelinePlanningState } from './timelinePlanning';
import { getCurrentStepInfo, getElapsedMs, getTotalDurationMs, type TimerState } from './timelineUtils';
import { useActiveSessionController } from './hooks/useActiveSessionController';

type IconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
};

type IconComponent = ComponentType<IconProps>;

const ingredientIconPaths = {
  flour: './icons/ingredients/farina.svg',
  hydration: './icons/ingredients/idratazione.svg',
  salt: './icons/ingredients/sale.svg',
  starter: './icons/ingredients/starter.svg',
  starterHydration: './icons/ingredients/idratazione-starter.svg',
  oil: './icons/ingredients/olio.svg',
  flourMix: './icons/ingredients/mix-farine.svg',
} as const;

type IngredientIconName = keyof typeof ingredientIconPaths;
type IngredientIconStyle = CSSProperties & { '--ingredient-icon-url': string };

type ActiveProfileId = string;
type AppView = 'planner' | 'recipes' | 'timelines';
type PlannerSection = 'planner' | 'times' | 'diary';

type FieldConfig = {
  field: keyof BreadInputs;
  label: string;
  unit: InputUnit;
  value: number;
  step?: number;
  icon: IconComponent;
  ingredientIcon?: IngredientIconName;
  convertibleField?: ConvertibleField;
};

const safeNumber = (value: number) => (Number.isFinite(value) ? Math.max(value, 0) : 0);

const percentFromGrams = (grams: number, flourTotal: number) => {
  const safeFlour = safeNumber(flourTotal);
  return safeFlour > 0 ? safeNumber(grams) / safeFlour * 100 : 0;
};

const gramsFromPercent = (field: ConvertibleField, inputs: BreadInputs) => {
  const flourTotal = safeNumber(inputs.flourTotal);
  return flourTotal * safeNumber(inputs[field]) / 100;
};

const getGramValues = (inputs: BreadInputs): GramValues => ({
  saltPercentage: gramsFromPercent('saltPercentage', inputs),
  starterPercentage: gramsFromPercent('starterPercentage', inputs),
  oilPercentage: gramsFromPercent('oilPercentage', inputs),
});

const getEffectiveInputs = (
  inputs: BreadInputs,
  unitModes: UnitModes,
  gramValues: GramValues,
): BreadInputs => {
  const nextInputs = { ...inputs };

  convertibleFields.forEach((field) => {
    if (unitModes[field] === 'g') {
      nextInputs[field] = percentFromGrams(gramValues[field], nextInputs.flourTotal);
    }
  });

  return nextInputs;
};

const personalizedTimelineName = 'Piano personalizzato';
const unsavedTimelineName = 'Piano non salvato';

const getTimelinePresetLabel = (presetId: string) =>
  timelinePresets.find((preset) => preset.id === presetId)?.label ?? personalizedTimelineName;

const getDefaultTimelineName = (presetId: string) =>
  presetId === 'custom' ? personalizedTimelineName : getTimelinePresetLabel(presetId);

const getReadableTimelineName = (name?: string, fallback = personalizedTimelineName) => {
  const trimmedName = name?.trim();
  if (!trimmedName || trimmedName === 'Piano corrente' || trimmedName === 'Timeline corrente') {
    return fallback;
  }
  return trimmedName;
};

const getTimelineNameAfterCustomization = (name?: string) => {
  const readableName = getReadableTimelineName(name, personalizedTimelineName);
  const isPresetName = timelinePresets.some((preset) => preset.label === readableName);
  return isPresetName ? personalizedTimelineName : readableName;
};

const isGenericRecipeName = (name?: string) => {
  const trimmedName = name?.trim();
  return !trimmedName || trimmedName === 'Custom' || trimmedName === 'Impasto corrente' || trimmedName === 'Planner corrente';
};

const statusLabels: Record<JournalStatus, string> = {
  draft: 'Bozza',
  active: 'Attiva',
  scheduled: 'Programmata',
  completed: 'Completata',
};

const journalStatusVisuals: Record<JournalStatus, { card: string; badge: string }> = {
  draft: {
    card: 'border-l-crust bg-cream/40 ring-crust/10',
    badge: 'bg-cream text-crust ring-crust/20',
  },
  active: {
    card: 'border-l-crust bg-[#fff7ef] ring-crust/20',
    badge: 'bg-crust text-white ring-crust/25',
  },
  scheduled: {
    card: 'border-l-wheat bg-wheat/15 ring-wheat/20',
    badge: 'bg-wheat/35 text-ink ring-wheat/30',
  },
  completed: {
    card: 'border-l-sage bg-sage/15 ring-sage/20',
    badge: 'bg-sage/20 text-ink ring-sage/30',
  },
};

type InitialAppState = {
  inputs: BreadInputs;
  unitModes: UnitModes;
  gramValues: GramValues;
  activeProfileId: ActiveProfileId;
  customProfileName: string;
  flourMix: FlourMix;
  ambientTemperature: AmbientTemperatureId;
  timelineName: string;
  timelineIsCustom: boolean;
  selectedTimelinePresetId: string;
  timelineSteps: TimelineStep[];
  timer: TimerState;
  planning: TimelinePlanningState;
  currentJournalEntryId?: string;
  legacyCurrentJournalDraft?: CurrentJournalDraft;
  legacyScheduledActiveSession?: PersistedLegacyActiveSession;
  activeSession?: ActiveSession;
  timerRestoreNotice: string | null;
  wasRestoredFromLocal: boolean;
};

const createDefaultAppState = (): InitialAppState => ({
  inputs: initialInputs,
  unitModes: initialUnitModes,
  gramValues: getGramValues(initialInputs),
  activeProfileId: 'base',
  customProfileName: 'Custom',
  flourMix: initialFlourMix,
  ambientTemperature: defaultAmbientTemperature,
  timelineName: getDefaultTimelineName(initialTimelinePresetId),
  timelineIsCustom: false,
  selectedTimelinePresetId: initialTimelinePresetId,
  timelineSteps: initialTimelineSteps(),
  timer: initialTimelineTimer,
  planning: initialPlanning,
  currentJournalEntryId: undefined,
  legacyCurrentJournalDraft: undefined,
  legacyScheduledActiveSession: undefined,
  activeSession: undefined,
  timerRestoreNotice: null,
  wasRestoredFromLocal: false,
});

const createInitialAppState = (): InitialAppState => {
  const loadedState = loadPersistedState();
  if (!loadedState) {
    return createDefaultAppState();
  }

  return {
    inputs: loadedState.state.inputs,
    unitModes: loadedState.state.unitModes,
    gramValues: loadedState.state.gramValues,
    activeProfileId: loadedState.state.activeProfileId,
    customProfileName: loadedState.state.customProfileName,
    flourMix: loadedState.state.flourMix,
    ambientTemperature: loadedState.state.ambientTemperature,
    timelineName: getReadableTimelineName(
      loadedState.state.timeline.name,
      loadedState.state.timeline.selectedPresetId === 'custom'
        ? personalizedTimelineName
        : getDefaultTimelineName(loadedState.state.timeline.selectedPresetId),
    ),
    timelineIsCustom: loadedState.state.timeline.isCustom ?? loadedState.state.timeline.selectedPresetId === 'custom',
    selectedTimelinePresetId: loadedState.state.timeline.selectedPresetId,
    timelineSteps: cloneTimelineSteps(loadedState.state.timeline.steps),
    timer: loadedState.state.activeSession ? initialTimelineTimer : loadedState.state.timeline.timer,
    planning: loadedState.state.timeline.planning ?? initialPlanning,
    currentJournalEntryId: loadedState.state.currentJournalEntryId,
    legacyCurrentJournalDraft: loadedState.state.currentJournalDraft,
    legacyScheduledActiveSession: loadedState.legacyScheduledActiveSession,
    activeSession: loadedState.state.activeSession,
    timerRestoreNotice: null,
    wasRestoredFromLocal: true,
  };
};

function App() {
  const [initialAppState] = useState(createInitialAppState);
  const [inputs, setInputs] = useState<BreadInputs>(initialAppState.inputs);
  const [unitModes, setUnitModes] = useState<UnitModes>(initialAppState.unitModes);
  const [gramValues, setGramValues] = useState<GramValues>(initialAppState.gramValues);
  const [activeProfileId, setActiveProfileId] = useState<ActiveProfileId>(initialAppState.activeProfileId);
  const [customProfileName, setCustomProfileName] = useState(initialAppState.customProfileName);
  const [flourMix, setFlourMix] = useState<FlourMix>(initialAppState.flourMix);
  const [ambientTemperature, setAmbientTemperature] = useState<AmbientTemperatureId>(initialAppState.ambientTemperature);
  const [timelineName, setTimelineName] = useState(initialAppState.timelineName);
  const [timelineIsCustom, setTimelineIsCustom] = useState(initialAppState.timelineIsCustom);
  const [selectedTimelinePresetId, setSelectedTimelinePresetId] = useState(initialAppState.selectedTimelinePresetId);
  const [timelineSteps, setTimelineSteps] = useState<TimelineStep[]>(initialAppState.timelineSteps);
  const [timer, setTimer] = useState<TimerState>(initialAppState.timer);
  const [planning, setPlanning] = useState<TimelinePlanningState>(initialAppState.planning);
  const [currentJournalEntryId, setCurrentJournalEntryId] = useState<string | undefined>(
    initialAppState.currentJournalEntryId,
  );
  const {
    activeSession,
    setActiveSession,
    isActiveSessionDrawerOpen,
    setIsActiveSessionDrawerOpen,
    openActiveSessionDrawer,
    closeActiveSessionDrawer,
    notificationPermission,
    canStartNewLiveSession,
    getBlockingActiveSessionMessage,
    startLiveSession,
    pauseCurrentActiveSession,
    resumeCurrentActiveSession,
    skipCurrentActiveSessionStep,
    completeCurrentActiveSessionStep,
    finishCurrentActiveSession,
    clearActiveSession,
    requestActiveSessionNotifications,
    toggleActiveSessionSound,
  } = useActiveSessionController(initialAppState.activeSession);
  const [timerRestoreNotice, setTimerRestoreNotice] = useState<string | null>(initialAppState.timerRestoreNotice);
  const [archive, setArchive] = useState<ArchiveState>(loadArchive);
  const [activeArchiveTab, setActiveArchiveTab] = useState<ArchiveTab>('recipes');
  const [activeView, setActiveView] = useState<AppView>('planner');
  const [activePlannerSection, setActivePlannerSection] = useState<PlannerSection>('planner');
  const [newRecipeBadge, setNewRecipeBadge] = useState(false);
  const [newTimelineBadge, setNewTimelineBadge] = useState(false);
  const [activeRecipeId, setActiveRecipeId] = useState<string | undefined>();
  const [activeTimelineId, setActiveTimelineId] = useState<string | undefined>();
  const [archiveMessage, setArchiveMessage] = useState('');
  const [localMemoryMessage, setLocalMemoryMessage] = useState(
    initialAppState.wasRestoredFromLocal ? 'Stato ripristinato localmente.' : 'Stato salvato localmente.',
  );
  const skipNextPersistRef = useRef(false);
  const legacyDraftMigratedRef = useRef(false);
  const legacyScheduledMigratedRef = useRef(false);

  const effectiveInputs = useMemo(
    () => getEffectiveInputs(inputs, unitModes, gramValues),
    [inputs, unitModes, gramValues],
  );
  const results = useMemo(() => calculateBread(effectiveInputs), [effectiveInputs]);
  const flourBreakdown = useMemo(
    () => calculateFlourBreakdown(effectiveInputs.flourTotal, flourMix),
    [effectiveInputs.flourTotal, flourMix],
  );
  const timelineTimer = timer;

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }

    const stateToPersist: PersistedBreadPlannerState = {
      version: 1,
      savedAt: Date.now(),
      inputs,
      unitModes,
      gramValues,
      activeProfileId,
      customProfileName,
      flourMix,
      ambientTemperature,
      timeline: {
        name: timelineName,
        isCustom: timelineIsCustom,
        selectedPresetId: selectedTimelinePresetId,
        steps: timelineSteps,
        timer: timelineTimer,
        planning,
      },
      currentJournalEntryId,
      activeSession,
    };

    savePersistedState(stateToPersist);
    setLocalMemoryMessage('Stato salvato localmente.');
  }, [
    activeProfileId,
    activeSession,
    ambientTemperature,
    customProfileName,
    currentJournalEntryId,
    flourMix,
    gramValues,
    inputs,
    planning,
    selectedTimelinePresetId,
    timelineIsCustom,
    timelineName,
    timelineSteps,
    timelineTimer,
    timer,
    unitModes,
  ]);

  useEffect(() => {
    saveArchive(archive);
  }, [archive]);

  useEffect(() => {
    if (legacyDraftMigratedRef.current || !initialAppState.legacyCurrentJournalDraft) {
      return;
    }

    legacyDraftMigratedRef.current = true;
    const migratedEntry = createJournalEntryFromLegacyDraft(initialAppState.legacyCurrentJournalDraft);
    setArchive((current) => {
      const existingEntry = current.journal.find((entry) => entry.id === migratedEntry.id);
      if (existingEntry) {
        return updateJournalEntry(current, {
          ...existingEntry,
          ...migratedEntry,
          title: existingEntry.title || migratedEntry.title,
          sessionData: {
            ...migratedEntry.sessionData,
            ...existingEntry.sessionData,
          },
        });
      }
      return addJournalEntry(current, migratedEntry);
    });
    setCurrentJournalEntryId(migratedEntry.id);
  }, [initialAppState.legacyCurrentJournalDraft]);

  useEffect(() => {
    const legacySession = initialAppState.legacyScheduledActiveSession;
    if (legacyScheduledMigratedRef.current || !legacySession) {
      return;
    }

    legacyScheduledMigratedRef.current = true;
    const scheduledStartAt = legacySession.scheduledStartAt ?? legacySession.createdAt;
    const targetEndAt = scheduledStartAt + legacySession.timelineSnapshot.totalDurationMinutes * 60 * 1000;
    const migratedEntry = createScheduledJournalEntry({
      id: legacySession.journalEntryId ?? createArchiveId('journal'),
      recipeSnapshot: legacySession.recipeSnapshot,
      timelineSnapshot: legacySession.timelineSnapshot,
      ambientTemperature: legacySession.recipeSnapshot.ambientTemperature,
      planning: {
        mode: 'backward',
        targetEndDate: toDateInputValue(targetEndAt),
        targetEndTime: new Date(targetEndAt).toTimeString().slice(0, 5),
      },
      scheduledStartAt,
      targetEndAt,
      existingEntry: legacySession.journalEntryId
        ? archive.journal.find((entry) => entry.id === legacySession.journalEntryId)
        : undefined,
    });

    setArchive((current) => (
      current.journal.some((journalEntry) => journalEntry.id === migratedEntry.id)
        ? updateJournalEntry(current, migratedEntry)
        : addJournalEntry(current, migratedEntry)
    ));
    setCurrentJournalEntryId(migratedEntry.id);
    setArchiveMessage('Sessione programmata spostata nel Diario. La sessione attiva resta libera.');
  }, [archive.journal, initialAppState.legacyScheduledActiveSession]);

  useEffect(() => {
    if (activeView === 'planner') {
      return undefined;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveView('planner');
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeView]);

  const updateInput = (field: keyof BreadInputs, value: number) => {
    const safeValue = safeNumber(value);
    markRecipeAsCustomFromCurrent();

    if (field === 'flourTotal') {
      setInputs((current) => {
        const nextInputs = { ...current, flourTotal: safeValue };
        convertibleFields.forEach((currentField) => {
          if (unitModes[currentField] === 'g') {
            nextInputs[currentField] = percentFromGrams(gramValues[currentField], safeValue);
          }
        });
        return nextInputs;
      });
    } else if (convertibleFields.includes(field as ConvertibleField) && unitModes[field as ConvertibleField] === 'g') {
      const currentField = field as ConvertibleField;
      setGramValues((current) => ({ ...current, [currentField]: safeValue }));
      setInputs((current) => ({
        ...current,
        [currentField]: percentFromGrams(safeValue, current.flourTotal),
      }));
    } else {
      setInputs((current) => ({ ...current, [field]: safeValue }));
    }

    setActiveProfileId('custom');
  };

  const updateUnitMode = (field: ConvertibleField, unit: InputUnit) => {
    if (unitModes[field] === unit) {
      return;
    }

    if (unit === 'g') {
      setGramValues((current) => ({
        ...current,
        [field]: gramsFromPercent(field, effectiveInputs),
      }));
      setUnitModes((current) => ({ ...current, [field]: 'g' }));
      return;
    }

    const nextPercentage = percentFromGrams(gramValues[field], inputs.flourTotal);
    setInputs((current) => ({ ...current, [field]: nextPercentage }));
    setUnitModes((current) => ({ ...current, [field]: '%' }));
  };

  const reset = () => {
    const defaultState = createDefaultAppState();
    skipNextPersistRef.current = true;
    clearPersistedState();
    setInputs(defaultState.inputs);
    setUnitModes(defaultState.unitModes);
    setGramValues(defaultState.gramValues);
    setFlourMix(defaultState.flourMix);
    setAmbientTemperature(defaultState.ambientTemperature);
    setTimelineName(defaultState.timelineName);
    setTimelineIsCustom(defaultState.timelineIsCustom);
    setSelectedTimelinePresetId(defaultState.selectedTimelinePresetId);
    setTimelineSteps(defaultState.timelineSteps);
    setTimer(defaultState.timer);
    setPlanning(defaultState.planning);
    setCurrentJournalEntryId(defaultState.currentJournalEntryId);
    setActiveSession(undefined);
    setIsActiveSessionDrawerOpen(false);
    setTimerRestoreNotice(null);
    setActiveProfileId(defaultState.activeProfileId);
    setCustomProfileName(defaultState.customProfileName);
    setLocalMemoryMessage('Memoria locale cancellata.');
  };

  const applyProfile = (profile: DoughProfile) => {
    markRecipeAsCustomFromCurrent();
    const nextInputs = { ...inputs, ...profile.values };
    setActiveProfileId(profile.id);
    setUnitModes(initialUnitModes);
    setInputs(nextInputs);
    setGramValues(getGramValues(nextInputs));
  };

  const selectCustomProfile = () => {
    markRecipeAsCustomFromCurrent();
    setActiveProfileId('custom');
  };

  const updateFlourMix = (nextFlourMix: FlourMix) => {
    markRecipeAsCustomFromCurrent();
    setFlourMix(nextFlourMix);
  };

  const updateCustomProfileName = (name: string) => {
    setCustomProfileName(name);
    setActiveProfileId('custom');
    setActiveRecipeId(undefined);
  };

  function markRecipeAsCustomFromCurrent() {
    if (activeRecipeId) {
      const activeRecipe = archive.recipes.find((recipe) => recipe.id === activeRecipeId);
      const nextName = activeRecipe?.name ?? customProfileName;
      if (isGenericRecipeName(customProfileName) && nextName) {
        setCustomProfileName(nextName);
      }
    }
    setActiveRecipeId(undefined);
  }

  const updateAmbientTemperature = (value: AmbientTemperatureId) => {
    setAmbientTemperature(value);
    markTimelineAsCustomFromCurrent();
  };

  const applyTimelinePresetState = (presetId: string, steps: TimelineStep[]) => {
    setSelectedTimelinePresetId(presetId);
    setTimelineSteps(steps);
    setTimelineName(getDefaultTimelineName(presetId));
    setTimelineIsCustom(presetId === 'custom');
    setActiveTimelineId(undefined);
  };

  const updateTimelineStepsAsCustom = (steps: TimelineStep[]) => {
    setTimelineSteps(steps);
    markTimelineAsCustomFromCurrent();
  };

  const updateTimelineName = (name: string) => {
    setTimelineName(name);
    setSelectedTimelinePresetId('custom');
    setTimelineIsCustom(true);
    setActiveTimelineId(undefined);
  };

  const updateTimelinePlanningAsCustom = (nextPlanning: TimelinePlanningState) => {
    setPlanning(nextPlanning);
    markTimelineAsCustomFromCurrent();
  };

  function markTimelineAsCustomFromCurrent() {
    const activeTimeline = activeTimelineId
      ? archive.timelines.find((timeline) => timeline.id === activeTimelineId)
      : undefined;
    setSelectedTimelinePresetId('custom');
    setTimelineIsCustom(true);
    setActiveTimelineId(undefined);
    setTimelineName((current) => getTimelineNameAfterCustomization(activeTimeline?.name ?? current));
  }

  const updateTimelineTimer = (nextTimer: TimerState) => {
    setTimerRestoreNotice(null);
    setTimer(nextTimer);
  };

  const validateTimelineSessionReady = () => {
    if (!isFlourMixValid(flourMix)) {
      setArchiveMessage('Completa il mix farine al 100% prima di avviare una sessione.');
      setActivePlannerSection('planner');
      setActiveView('planner');
      return false;
    }

    if (timelineSteps.length === 0 || getTotalDurationMs(timelineSteps) <= 0) {
      setArchiveMessage('Aggiungi una timeline con durata valida prima di avviare una sessione.');
      setActivePlannerSection('times');
      setActiveView('planner');
      return false;
    }

    return true;
  };

  const startActiveSessionNow = (nextTimer: TimerState) => {
    if (!validateTimelineSessionReady()) {
      return false;
    }

    if (!canStartNewLiveSession) {
      setArchiveMessage(getBlockingActiveSessionMessage());
      setActivePlannerSection('times');
      setActiveView('planner');
      return false;
    }

    const entry = updateCurrentJournalEntryFromTimeline(
      'active',
      nextTimer,
      { ...planning, mode: 'now' },
      timelineIsCustom,
    );
    const session = createActiveSession({
      id: createArchiveId('session'),
      recipeSnapshot: entry.recipeSnapshot,
      timelineSnapshot: entry.timelineSnapshot ?? createTimelineSnapshotFromCurrentTimeline(timelineName, ''),
      journalEntryId: entry.id,
      startedAt: nextTimer?.startedAt ?? Date.now(),
    });

    const result = startLiveSession(session);
    if (!result.ok) {
      setArchiveMessage(result.message);
      return false;
    }
    return true;
  };

  const getPlanningTargetEndAt = (nextPlanning: TimelinePlanningState) => {
    if (!nextPlanning.targetEndDate || !nextPlanning.targetEndTime) {
      return undefined;
    }
    const targetEndAt = new Date(`${nextPlanning.targetEndDate}T${nextPlanning.targetEndTime}`).getTime();
    return Number.isFinite(targetEndAt) ? targetEndAt : undefined;
  };

  const programTimelineInDiary = (nextPlanning: TimelinePlanningState, scheduledStartAt?: number) => {
    if (!scheduledStartAt) {
      setArchiveMessage('Scegli giorno e ora di fine validi per programmare il piano.');
      setActivePlannerSection('times');
      setActiveView('planner');
      return;
    }

    if (!validateTimelineSessionReady()) {
      return;
    }

    const recipeSnapshot = createRecipeSnapshotFromCurrentPlanner('', '');
    const timelineSnapshot = createTimelineSnapshotFromCurrentTimeline(timelineName, '');
    const existingEntry = currentJournalEntryId
      ? archive.journal.find((entry) => (
          entry.id === currentJournalEntryId &&
          (entry.sessionData.status === 'draft' || entry.sessionData.status === 'scheduled')
        ))
      : undefined;
    const scheduledEntry = createScheduledJournalEntry({
      id: existingEntry?.id ?? createArchiveId('journal'),
      recipeSnapshot,
      timelineSnapshot,
      ambientTemperature,
      scheduledStartAt,
      targetEndAt: getPlanningTargetEndAt(nextPlanning) ?? scheduledStartAt + timelineSnapshot.totalDurationMinutes * 60 * 1000,
      planning: nextPlanning,
      existingEntry,
      sourceRecipeId: activeRecipeId,
      sourceTimelineId: timelineIsCustom ? undefined : activeTimelineId,
    });

    setArchive((current) => (
      current.journal.some((journalEntry) => journalEntry.id === scheduledEntry.id)
        ? updateJournalEntry(current, scheduledEntry)
        : addJournalEntry(current, scheduledEntry)
    ));
    setCurrentJournalEntryId(scheduledEntry.id);
    setTimer(initialTimelineTimer);
    setArchiveMessage(
      activeSession
        ? 'Sessione programmata nel Diario. La sessione attiva resta in corso.'
        : 'Sessione programmata nel Diario.',
    );
    setActivePlannerSection('diary');
    setActiveView('planner');
  };

  const clearLocalMemory = () => {
    reset();
  };

  const openArchiveTab = (tab: ArchiveTab) => {
    if (tab === 'journal') {
      setActiveArchiveTab('journal');
      setActivePlannerSection('diary');
      setActiveView('planner');
      return;
    }

    setActiveArchiveTab(tab);
    setActiveView(tab);
    if (tab === 'recipes') {
      setNewRecipeBadge(false);
    }
    if (tab === 'timelines') {
      setNewTimelineBadge(false);
    }
  };

  const openPlanner = () => {
    setActiveView('planner');
    setActivePlannerSection('planner');
  };

  const getCurrentPlannerRecipeName = (name?: string): string => {
    const trimmedName = name?.trim();
    if (trimmedName && !isGenericRecipeName(trimmedName)) {
      return trimmedName;
    }
    const activeRecipe = activeRecipeId ? archive.recipes.find((recipe) => recipe.id === activeRecipeId) : undefined;
    if (activeRecipe?.name) {
      return activeRecipe.name;
    }
    if (!isGenericRecipeName(customProfileName)) {
      return customProfileName.trim();
    }
    return 'Impasto';
  };

  const createRecipeSnapshotFromCurrentPlanner = (name: string, notes: string): RecipeSnapshot => ({
    schemaVersion: 1,
    name: getCurrentPlannerRecipeName(name),
    notes,
    activeProfileId,
    customProfileName,
    inputs: cloneValue(effectiveInputs),
    flourMix: cloneValue(flourMix),
    ambientTemperature,
    calculatedIngredients: cloneValue(results),
    estimatedDoughWeight: results.estimatedDoughWeight,
  });

  const createTimelineSnapshotFromCurrentTimeline = (name: string, notes: string): TimelineSnapshot => ({
    schemaVersion: 1,
    name: getReadableTimelineName(
      name,
      activeTimelineId
        ? archive.timelines.find((timeline) => timeline.id === activeTimelineId)?.name ?? personalizedTimelineName
        : timelineIsCustom
          ? personalizedTimelineName
          : getDefaultTimelineName(selectedTimelinePresetId),
    ),
    notes,
    activeProfileId,
    selectedPresetId: selectedTimelinePresetId,
    ambientTemperature,
    totalDurationMinutes: Math.round(getTotalDurationMs(timelineSteps) / 60000),
    steps: cloneValue(timelineSteps),
  });

  const createSavedRecipe = (
    name: string,
    notes: string,
    associatedTimelineId?: string,
  ): SavedRecipe => {
    const now = Date.now();
    return {
      ...createRecipeSnapshotFromCurrentPlanner(name, notes),
      id: createArchiveId('recipe'),
      createdAt: now,
      updatedAt: now,
      associatedTimelineId,
    };
  };

  const createSavedTimeline = (name: string, notes: string): SavedTimeline => {
    const now = Date.now();
    return {
      ...createTimelineSnapshotFromCurrentTimeline(name, notes),
      id: createArchiveId('timeline'),
      createdAt: now,
      updatedAt: now,
    };
  };

  const createDraftJournalEntry = (recipeSnapshot: RecipeSnapshot, existingEntry?: JournalEntry): JournalEntry => {
    const now = Date.now();
    const createdAt = existingEntry?.createdAt ?? now;
    return {
      id: existingEntry?.id ?? createArchiveId('journal'),
      schemaVersion: 1,
      createdAt,
      updatedAt: now,
      title: existingEntry?.title || getFallbackJournalTitle(recipeSnapshot, createdAt),
      date: existingEntry?.date || toDateInputValue(createdAt),
      sourceRecipeId: activeRecipeId,
      sourceTimelineId: existingEntry?.sourceTimelineId,
      recipeSnapshot: cloneValue(recipeSnapshot),
      timelineSnapshot: existingEntry?.timelineSnapshot ? cloneValue(existingEntry.timelineSnapshot) : undefined,
      timerState: existingEntry?.timerState ? cloneValue(existingEntry.timerState) : undefined,
      planning: existingEntry?.planning ? cloneValue(existingEntry.planning) : undefined,
      sessionData: {
        ambientTemperature,
        status: 'draft',
        initialNotes: existingEntry?.sessionData.initialNotes ?? '',
        finalNotes: existingEntry?.sessionData.finalNotes ?? '',
        resultLabel: existingEntry?.sessionData.resultLabel ?? '',
        nextAdjustment: existingEntry?.sessionData.nextAdjustment ?? '',
      },
    };
  };

  const continueToTimes = () => {
    const recipeSnapshot = createRecipeSnapshotFromCurrentPlanner('', '');
    const existingEntry = currentJournalEntryId
      ? archive.journal.find((entry) => entry.id === currentJournalEntryId && entry.sessionData.status !== 'completed')
      : undefined;
    const entry = createDraftJournalEntry(recipeSnapshot, existingEntry);
    setArchive((current) => (
      current.journal.some((journalEntry) => journalEntry.id === entry.id)
        ? updateJournalEntry(current, entry)
        : addJournalEntry(current, entry)
    ));
    setCurrentJournalEntryId(entry.id);
    setActivePlannerSection('times');
  };

  const updateCurrentJournalEntryFromTimeline = (
    status: Extract<JournalStatus, 'active' | 'scheduled'>,
    nextTimer?: TimerState,
    nextPlanning: TimelinePlanningState = planning,
    forceCustomTimeline = false,
  ): JournalEntry => {
    const now = Date.now();
    const timelineSnapshot = createTimelineSnapshotFromCurrentTimeline(timelineName, '');
    const existingEntry = currentJournalEntryId
      ? archive.journal.find((entry) => entry.id === currentJournalEntryId && entry.sessionData.status !== 'completed')
      : undefined;
    const baseEntry = existingEntry ?? createDraftJournalEntry(
      createRecipeSnapshotFromCurrentPlanner('', ''),
    );
    const updatedEntry: JournalEntry = {
      ...baseEntry,
      updatedAt: now,
      sourceTimelineId: timelineIsCustom || forceCustomTimeline ? undefined : activeTimelineId,
      timelineSnapshot: cloneValue(timelineSnapshot),
      timerState: nextTimer ? cloneValue(nextTimer) : baseEntry.timerState,
      planning: cloneValue(nextPlanning),
      sessionData: {
        ...baseEntry.sessionData,
        ambientTemperature,
        status,
      },
    };
    setArchive((current) => (
      current.journal.some((journalEntry) => journalEntry.id === updatedEntry.id)
        ? updateJournalEntry(current, updatedEntry)
        : addJournalEntry(current, updatedEntry)
    ));
    setCurrentJournalEntryId(updatedEntry.id);
    setActivePlannerSection('diary');
    setActiveView('planner');
    return updatedEntry;
  };

  const saveJournalRecipeToArchive = (entryId: string) => {
    const entry = archive.journal.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }
    const now = Date.now();
    const recipe: SavedRecipe = {
      ...cloneValue(entry.recipeSnapshot),
      id: createArchiveId('recipe'),
      createdAt: now,
      updatedAt: now,
    };
    setArchive((current) => updateJournalEntry(addRecipe(current, recipe), {
      ...entry,
      sourceRecipeId: recipe.id,
      updatedAt: now,
    }));
    setActiveRecipeId(recipe.id);
    setArchiveMessage(`Ricetta salvata dall'entry: ${entry.title}.`);
    setNewRecipeBadge(true);
  };

  const saveJournalTimelineToArchive = (entryId: string) => {
    const entry = archive.journal.find((item) => item.id === entryId);
    if (!entry?.timelineSnapshot) {
      return;
    }
    const now = Date.now();
    const timeline: SavedTimeline = {
      ...cloneValue(entry.timelineSnapshot),
      id: createArchiveId('timeline'),
      createdAt: now,
      updatedAt: now,
    };
    setArchive((current) => updateJournalEntry(addTimeline(current, timeline), {
      ...entry,
      sourceTimelineId: timeline.id,
      updatedAt: now,
    }));
    setActiveTimelineId(timeline.id);
    setArchiveMessage(`Timeline salvata dall'entry: ${entry.title}.`);
    setNewTimelineBadge(true);
  };

  const loadRecipeIntoPlanner = (snapshot: RecipeSnapshot) => {
    setInputs(cloneValue(snapshot.inputs));
    setUnitModes(initialUnitModes);
    setGramValues(getGramValues(snapshot.inputs));
    setFlourMix(cloneValue(snapshot.flourMix));
    setAmbientTemperature(snapshot.ambientTemperature);
    setActiveProfileId(snapshot.activeProfileId);
    setCustomProfileName(snapshot.customProfileName);
  };

  const loadTimelineIntoPlanner = (snapshot: TimelineSnapshot) => {
    setSelectedTimelinePresetId(snapshot.selectedPresetId);
    setTimelineName(getReadableTimelineName(snapshot.name, getTimelinePresetLabel(snapshot.selectedPresetId)));
    setTimelineIsCustom(false);
    setTimelineSteps(cloneValue(snapshot.steps));
    setTimer(initialTimelineTimer);
    setTimerRestoreNotice(null);
  };

  const getRecipeSnapshotForJournal = (recipeId?: string) => {
    const savedRecipe = recipeId ? archive.recipes.find((recipe) => recipe.id === recipeId) : undefined;
    return savedRecipe ?? createRecipeSnapshotFromCurrentPlanner(customDisplayName || 'Impasto corrente', '');
  };

  const getTimelineSnapshotForJournal = (timelineId?: string) => {
    if (!timelineId) {
      return undefined;
    }
    return archive.timelines.find((timeline) => timeline.id === timelineId);
  };

  const createJournalEntryFromValues = ({
    title,
    date,
    status,
    resultLabel,
    initialNotes,
    finalNotes,
    nextAdjustment,
    sourceRecipeId,
    sourceTimelineId,
  }: {
    title: string;
    date: string;
    status: JournalStatus;
    resultLabel: string;
    initialNotes: string;
    finalNotes: string;
    nextAdjustment: string;
    sourceRecipeId?: string;
    sourceTimelineId?: string;
  }): JournalEntry => {
    const now = Date.now();
    const recipeSnapshot = getRecipeSnapshotForJournal(sourceRecipeId);
    const timelineSnapshot = getTimelineSnapshotForJournal(sourceTimelineId);
    const snapshots = createJournalSnapshot(recipeSnapshot, timelineSnapshot);
    const sessionData: JournalSessionData = {
      ambientTemperature: recipeSnapshot.ambientTemperature,
      status,
      initialNotes,
      finalNotes,
      resultLabel,
      nextAdjustment,
    };

    return {
      id: createArchiveId('journal'),
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      title: title.trim() || recipeSnapshot.name || 'Entry senza titolo',
      date: date || new Date().toISOString().slice(0, 10),
      sourceRecipeId,
      sourceTimelineId,
      ...snapshots,
      sessionData,
    };
  };

  const saveActiveSessionToJournal = () => {
    if (!activeSession) {
      return;
    }

    const completedSession = activeSession.status === 'completed'
      ? activeSession
      : completeActiveSession(activeSession);
    const now = Date.now();
    const startDate = new Date(getSessionStartDate(completedSession));
    const endDate = new Date(getSessionEndDate(completedSession));
    const completedSteps = completedSession.stepSchedule.filter((step) => step.completedAt).length;
    const skippedSteps = completedSession.stepSchedule.filter((step) => step.skippedAt).length;
    const pauseMinutes = getSessionPauseMinutes(completedSession);
    const durationMinutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime() - completedSession.accumulatedPauseMs) / 60000));
    const autoSummary = [
      `Sessione: ${completedSession.recipeSnapshot.name || completedSession.recipeSnapshot.customProfileName || 'Impasto'}`,
      `Timeline: ${completedSession.timelineSnapshot.name || 'Piano di lavorazione'}`,
      `Inizio: ${startDate.toLocaleString('it-IT')}`,
      `Fine: ${endDate.toLocaleString('it-IT')}`,
      `Step completati: ${completedSteps}`,
      `Step saltati: ${skippedSteps}`,
      `Pause: ${pauseMinutes} min`,
      `Durata reale: ${durationMinutes} min`,
    ].join('\n');
    const finalNotes = autoSummary;
    const existingEntry = completedSession.journalEntryId
      ? archive.journal.find((entry) => entry.id === completedSession.journalEntryId)
      : undefined;
    const entry: JournalEntry = existingEntry
      ? {
          ...existingEntry,
          updatedAt: now,
          recipeSnapshot: cloneValue(completedSession.recipeSnapshot),
          timelineSnapshot: cloneValue(completedSession.timelineSnapshot),
          timerState: activeSessionToTimerState(completedSession),
          sessionData: {
            ...existingEntry.sessionData,
            ambientTemperature: completedSession.recipeSnapshot.ambientTemperature,
            status: 'completed',
            startTime: startDate.toTimeString().slice(0, 5),
            endTime: endDate.toTimeString().slice(0, 5),
            finalNotes,
            resultLabel: existingEntry.sessionData.resultLabel,
            nextAdjustment: existingEntry.sessionData.nextAdjustment,
          },
        }
      : {
          id: createArchiveId('journal'),
          schemaVersion: 1,
          createdAt: now,
          updatedAt: now,
          title: completedSession.recipeSnapshot.name || getFallbackJournalTitle(completedSession.recipeSnapshot, completedSession.createdAt),
          date: toDateInputValue(endDate),
          recipeSnapshot: cloneValue(completedSession.recipeSnapshot),
          timelineSnapshot: cloneValue(completedSession.timelineSnapshot),
          timerState: activeSessionToTimerState(completedSession),
          sessionData: {
            ambientTemperature: completedSession.recipeSnapshot.ambientTemperature,
            status: 'completed',
            startTime: startDate.toTimeString().slice(0, 5),
            endTime: endDate.toTimeString().slice(0, 5),
            initialNotes: '',
            finalNotes,
            resultLabel: '',
            nextAdjustment: '',
          },
        };

    setArchive((current) => (
      current.journal.some((journalEntry) => journalEntry.id === entry.id)
        ? updateJournalEntry(current, entry)
        : addJournalEntry(current, entry)
    ));
    setCurrentJournalEntryId(entry.id);
    setActiveSession(undefined);
    setIsActiveSessionDrawerOpen(false);
    setArchiveMessage(`Sessione salvata nel Diario: ${entry.title}.`);
    setActiveArchiveTab('journal');
    setActivePlannerSection('diary');
    setActiveView('planner');
  };

  const startScheduledJournalEntry = (entryId: string) => {
    const entry = archive.journal.find((item) => item.id === entryId);
    if (!entry || entry.sessionData.status !== 'scheduled') {
      return;
    }

    if (!entry.timelineSnapshot) {
      setArchiveMessage('Questa sessione programmata non ha una timeline valida.');
      return;
    }

    if (isBlockingLiveSession(activeSession)) {
      setArchiveMessage(getActiveSessionBlockingMessage(activeSession));
      openActiveSessionDrawer();
      return;
    }

    const startedAt = Date.now();
    const session = createActiveSession({
      id: createArchiveId('session'),
      recipeSnapshot: entry.recipeSnapshot,
      timelineSnapshot: entry.timelineSnapshot,
      journalEntryId: entry.id,
      startedAt,
    });
    const result = startLiveSession(session);
    if (!result.ok) {
      setArchiveMessage(result.message);
      return;
    }

    const updatedEntry: JournalEntry = {
      ...entry,
      updatedAt: startedAt,
      timerState: activeSessionToTimerState(session),
      sessionData: {
        ...entry.sessionData,
        status: 'active',
        startTime: new Date(startedAt).toTimeString().slice(0, 5),
      },
    };

    setArchive((current) => updateJournalEntry(current, updatedEntry));
    setCurrentJournalEntryId(entry.id);
    setArchiveMessage(`Sessione avviata dal Diario: ${entry.title}.`);
    setActivePlannerSection('diary');
    setActiveView('planner');
  };

  const saveRecipeToArchive = (name: string, notes: string, associatedTimelineId?: string) => {
    const recipe = createSavedRecipe(name, notes, associatedTimelineId);
    setArchive((current) => addRecipe(current, recipe));
    setActiveRecipeId(recipe.id);
    setArchiveMessage('Ricetta salvata. La trovi in Ricette, nell\'header.');
    setNewRecipeBadge(true);
    setActiveArchiveTab('recipes');
    setActiveView('recipes');
  };

  const updateActiveRecipe = (name: string, notes: string, associatedTimelineId?: string) => {
    const existingRecipe = archive.recipes.find((recipe) => recipe.id === activeRecipeId);
    if (!existingRecipe) {
      saveRecipeToArchive(name, notes, associatedTimelineId);
      return;
    }
    const updatedRecipe: SavedRecipe = {
      ...existingRecipe,
      ...createRecipeSnapshotFromCurrentPlanner(name, notes),
      associatedTimelineId,
      updatedAt: Date.now(),
    };
    setArchive((current) => updateRecipe(current, updatedRecipe));
    setArchiveMessage(`Ricetta aggiornata: ${updatedRecipe.name}.`);
    setActiveArchiveTab('recipes');
    setActiveView('recipes');
  };

  const saveRecipeAndTimelineToArchive = (name: string, notes: string) => {
    const timeline = createSavedTimeline(`${name || 'Ricetta'} timeline`, '');
    const recipe = createSavedRecipe(name, notes, timeline.id);
    setArchive((current) => addRecipe(addTimeline(current, timeline), recipe));
    setActiveRecipeId(recipe.id);
    setActiveTimelineId(timeline.id);
    setArchiveMessage('Ricetta salvata. La trovi in Ricette, nell\'header.');
    setNewRecipeBadge(true);
    setNewTimelineBadge(true);
    setActiveArchiveTab('recipes');
    setActiveView('recipes');
  };

  const loadRecipeFromArchive = (recipeId: string) => {
    const recipe = archive.recipes.find((item) => item.id === recipeId);
    if (!recipe) {
      return;
    }
    loadRecipeIntoPlanner(recipe);
    setActiveRecipeId(recipe.id);
    setArchiveMessage(`Ricetta caricata nel planner: ${recipe.name}.`);
    setActivePlannerSection('planner');
    setActiveView('planner');
  };

  const duplicateRecipeInArchive = (recipeId: string) => {
    setArchive((current) => duplicateRecipe(current, recipeId));
    setArchiveMessage('Ricetta duplicata.');
  };

  const deleteRecipeFromArchive = (recipeId: string) => {
    const recipe = archive.recipes.find((item) => item.id === recipeId);
    if (!recipe || !window.confirm(`Eliminare la ricetta "${recipe.name}"?`)) {
      return;
    }
    setArchive((current) => deleteRecipe(current, recipeId));
    if (activeRecipeId === recipeId) {
      setActiveRecipeId(undefined);
    }
    setArchiveMessage('Ricetta eliminata.');
  };

  const saveTimelineToArchive = (name: string, notes: string) => {
    const timeline = createSavedTimeline(name, notes);
    setArchive((current) => addTimeline(current, timeline));
    setActiveTimelineId(timeline.id);
    setTimelineName(timeline.name);
    setTimelineIsCustom(false);
    setArchiveMessage('Timeline salvata. La trovi in Timeline, nell\'header.');
    setNewTimelineBadge(true);
    setActiveArchiveTab('timelines');
    setActiveView('timelines');
  };

  const updateActiveTimeline = (name: string, notes: string) => {
    const existingTimeline = archive.timelines.find((timeline) => timeline.id === activeTimelineId);
    if (!existingTimeline) {
      saveTimelineToArchive(name, notes);
      return;
    }
    const updatedTimeline: SavedTimeline = {
      ...existingTimeline,
      ...createTimelineSnapshotFromCurrentTimeline(name, notes),
      updatedAt: Date.now(),
    };
    setArchive((current) => updateTimeline(current, updatedTimeline));
    setTimelineName(updatedTimeline.name);
    setTimelineIsCustom(false);
    setArchiveMessage(`Timeline aggiornata: ${updatedTimeline.name}.`);
    setActiveArchiveTab('timelines');
    setActiveView('timelines');
  };

  const loadTimelineFromArchive = (timelineId: string) => {
    const timeline = archive.timelines.find((item) => item.id === timelineId);
    if (!timeline) {
      return;
    }
    loadTimelineIntoPlanner(timeline);
    setActiveTimelineId(timeline.id);
    setArchiveMessage(`Timeline caricata: ${timeline.name}.`);
    setActivePlannerSection('times');
    setActiveView('planner');
  };

  const duplicateTimelineInArchive = (timelineId: string) => {
    setArchive((current) => duplicateTimeline(current, timelineId));
    setArchiveMessage('Timeline duplicata.');
  };

  const deleteTimelineFromArchive = (timelineId: string) => {
    const timeline = archive.timelines.find((item) => item.id === timelineId);
    if (!timeline || !window.confirm(`Eliminare la timeline "${timeline.name}"?`)) {
      return;
    }
    setArchive((current) => deleteTimeline(current, timelineId));
    if (activeTimelineId === timelineId) {
      setActiveTimelineId(undefined);
    }
    setArchiveMessage('Timeline eliminata.');
  };

  const associateTimelineToRecipe = (timelineId: string, recipeId: string) => {
    const recipe = archive.recipes.find((item) => item.id === recipeId);
    if (!recipe) {
      return;
    }
    setArchive((current) => updateRecipe(current, {
      ...recipe,
      associatedTimelineId: timelineId,
      updatedAt: Date.now(),
    }));
    setArchiveMessage('Timeline associata alla ricetta.');
  };

  const createJournalEntry = (values: {
    title: string;
    date: string;
    status: JournalStatus;
    resultLabel: string;
    initialNotes: string;
    finalNotes: string;
    nextAdjustment: string;
    sourceRecipeId: string;
    sourceTimelineId: string;
  }) => {
    const entry = createJournalEntryFromValues({
      ...values,
      sourceRecipeId: values.sourceRecipeId || undefined,
      sourceTimelineId: values.sourceTimelineId || undefined,
    });
    setArchive((current) => addJournalEntry(current, entry));
    setCurrentJournalEntryId(entry.id);
    setArchiveMessage('Entry salvata nel Diario.');
    setActiveArchiveTab('journal');
    setActivePlannerSection('diary');
    setActiveView('planner');
  };

  const createJournalFromRecipe = (recipeId: string) => {
    const recipe = archive.recipes.find((item) => item.id === recipeId);
    if (!recipe) {
      return;
    }
    const entry = createJournalEntryFromValues({
      title: recipe.name,
      date: new Date().toISOString().slice(0, 10),
      status: 'draft',
      resultLabel: '',
      initialNotes: recipe.notes,
      finalNotes: '',
      nextAdjustment: '',
      sourceRecipeId: recipe.id,
      sourceTimelineId: recipe.associatedTimelineId,
    });
    setArchive((current) => addJournalEntry(current, entry));
    setCurrentJournalEntryId(entry.id);
    setArchiveMessage(`Entry creata da ricetta: ${recipe.name}.`);
    setActiveArchiveTab('journal');
    setActivePlannerSection('diary');
    setActiveView('planner');
  };

  const createJournalFromTimeline = (timelineId: string, recipeId?: string) => {
    const timeline = archive.timelines.find((item) => item.id === timelineId);
    if (!timeline && timelineId) {
      return;
    }
    const recipe = recipeId ? archive.recipes.find((item) => item.id === recipeId) : undefined;
    const entry = createJournalEntryFromValues({
      title: recipe?.name ?? timeline?.name ?? 'Nuova entry',
      date: new Date().toISOString().slice(0, 10),
      status: 'draft',
      resultLabel: '',
      initialNotes: recipe?.notes ?? '',
      finalNotes: '',
      nextAdjustment: '',
      sourceRecipeId: recipe?.id,
      sourceTimelineId: timeline?.id,
    });
    setArchive((current) => addJournalEntry(current, entry));
    setCurrentJournalEntryId(entry.id);
    setArchiveMessage('Entry salvata nel Diario.');
    setActiveArchiveTab('journal');
    setActivePlannerSection('diary');
    setActiveView('planner');
  };

  const updateJournalInArchive = (entryId: string, values: {
    title: string;
    date: string;
    status: JournalStatus;
    resultLabel: string;
    initialNotes: string;
    finalNotes: string;
    nextAdjustment: string;
    sourceRecipeId: string;
    sourceTimelineId: string;
  }) => {
    const entry = archive.journal.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }
    const updatedEntry: JournalEntry = {
      ...entry,
      title: values.title.trim() || entry.title,
      date: values.date || entry.date,
      sourceRecipeId: values.sourceRecipeId || entry.sourceRecipeId,
      sourceTimelineId: values.sourceTimelineId || entry.sourceTimelineId,
      updatedAt: Date.now(),
      sessionData: {
        ...entry.sessionData,
        status: values.status,
        initialNotes: values.initialNotes,
        finalNotes: values.finalNotes,
        resultLabel: values.resultLabel,
        nextAdjustment: values.nextAdjustment,
      },
    };
    setArchive((current) => updateJournalEntry(current, updatedEntry));
    setArchiveMessage(`Entry aggiornata: ${updatedEntry.title}.`);
  };

  const deleteJournalFromArchive = (entryId: string) => {
    const entry = archive.journal.find((item) => item.id === entryId);
    if (!entry || !window.confirm(`Eliminare l'entry "${entry.title}"?`)) {
      return;
    }
    setArchive((current) => deleteJournalEntry(current, entryId));
    if (currentJournalEntryId === entryId) {
      setCurrentJournalEntryId(undefined);
    }
    setArchiveMessage('Entry eliminata.');
  };

  const loadJournalSnapshotIntoPlanner = (entryId: string) => {
    const entry = archive.journal.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }
    loadRecipeIntoPlanner(entry.recipeSnapshot);
    setActiveRecipeId(entry.sourceRecipeId);
    if (entry.timelineSnapshot) {
      loadTimelineIntoPlanner(entry.timelineSnapshot);
      setActiveTimelineId(entry.sourceTimelineId);
    }
    setArchiveMessage(`Snapshot caricato nel planner: ${entry.title}.`);
    setActivePlannerSection('planner');
    setActiveView('planner');
  };

  const loadJournalRecipeIntoPlanner = (entryId: string) => {
    const entry = archive.journal.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }
    loadRecipeIntoPlanner(entry.recipeSnapshot);
    setActiveRecipeId(entry.sourceRecipeId);
    setArchiveMessage(`Ingredienti caricati nel planner: ${entry.title}.`);
    setActivePlannerSection('planner');
    setActiveView('planner');
  };

  const loadJournalTimelineIntoPlanner = (entryId: string) => {
    const entry = archive.journal.find((item) => item.id === entryId);
    if (!entry?.timelineSnapshot) {
      setArchiveMessage('Questa entry non ha ancora un piano da caricare.');
      return;
    }
    loadTimelineIntoPlanner(entry.timelineSnapshot);
    setActiveTimelineId(entry.sourceTimelineId);
    setAmbientTemperature(entry.sessionData.ambientTemperature);
    setArchiveMessage(`Tempi caricati: ${entry.title}.`);
    setActivePlannerSection('times');
    setActiveView('planner');
  };

  const createNewTrialFromJournal = (entryId: string) => {
    const entry = archive.journal.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }
    loadRecipeIntoPlanner(entry.recipeSnapshot);
    if (entry.timelineSnapshot) {
      loadTimelineIntoPlanner(entry.timelineSnapshot);
    }
    const now = Date.now();
    const newEntry: JournalEntry = {
      id: createArchiveId('journal'),
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      title: `${entry.title} nuova entry`,
      date: toDateInputValue(now),
      sourceRecipeId: entry.sourceRecipeId,
      sourceTimelineId: entry.sourceTimelineId,
      recipeSnapshot: cloneValue(entry.recipeSnapshot),
      timelineSnapshot: entry.timelineSnapshot ? cloneValue(entry.timelineSnapshot) : undefined,
      sessionData: {
        ...entry.sessionData,
        status: 'draft',
        initialNotes: entry.sessionData.finalNotes,
        finalNotes: '',
        resultLabel: '',
        nextAdjustment: '',
      },
    };
    setArchive((current) => addJournalEntry(current, newEntry));
    setCurrentJournalEntryId(newEntry.id);
    setArchiveMessage(`Nuova entry creata da: ${entry.title}.`);
    setActiveArchiveTab('journal');
    setActivePlannerSection('diary');
    setActiveView('planner');
  };

  const customDisplayName = customProfileName.trim() || 'Custom';

  const getProfileIcon = (profileId: string): IconComponent => {
    if (profileId === 'high') {
      return Droplets;
    }
    if (profileId === 'focaccia') {
      return FocacciaIcon;
    }
    return BreadIcon;
  };

  return (
    <main className="min-h-screen bg-flour text-ink">
      <Header
        activeView={activeView}
        recipesCount={archive.recipes.length}
        timelinesCount={archive.timelines.length}
        newRecipeBadge={newRecipeBadge}
        newTimelineBadge={newTimelineBadge}
        activeSession={activeSession}
        onOpenPlanner={openPlanner}
        onOpenRecipes={() => openArchiveTab('recipes')}
        onOpenTimelines={() => openArchiveTab('timelines')}
        onOpenActiveSession={openActiveSessionDrawer}
        onReset={reset}
      />

      {activeSession && (
        <ActiveSessionBar
          session={activeSession}
          isDrawerOpen={isActiveSessionDrawerOpen}
          notificationPermission={notificationPermission}
          onOpenDrawer={openActiveSessionDrawer}
          onCloseDrawer={closeActiveSessionDrawer}
          onPause={pauseCurrentActiveSession}
          onResume={resumeCurrentActiveSession}
          onCompleteStep={completeCurrentActiveSessionStep}
          onSkipStep={skipCurrentActiveSessionStep}
          onFinish={finishCurrentActiveSession}
          onClear={() => {
            if (window.confirm('Chiudere la sessione completata senza salvarla nel Diario?')) {
              clearActiveSession(false);
            }
          }}
          onSaveJournal={saveActiveSessionToJournal}
          onOpenDiary={() => {
            setActivePlannerSection('diary');
            setActiveView('planner');
            closeActiveSessionDrawer();
          }}
          onRequestNotifications={requestActiveSessionNotifications}
          onToggleSound={toggleActiveSessionSound}
        />
      )}

      <div className="mx-auto flex w-full max-w-[1510px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="rounded-[24px] border border-[#322e2b18] bg-[#fffdf8]/92 shadow-air backdrop-blur">
          <MainFlowTabs
            activeSection={activePlannerSection}
            onChange={setActivePlannerSection}
          />

          <div className="border-t border-[#322e2b18] bg-[#fffdf8] p-3 sm:p-5">
            {activePlannerSection === 'planner' ? (
          <section className="grid gap-5">
            <div className="mb-5">
              <h2 className="font-display text-[30px] font-semibold tracking-normal text-ink">Scegli il tuo impasto</h2>
            </div>

            <div className="grid gap-6">
              <DoughProfileSelector
                activeProfileId={activeProfileId}
                customDisplayName={customDisplayName}
                customProfileName={customProfileName}
                profiles={doughProfiles}
                getProfileIcon={getProfileIcon}
                onSelectProfile={applyProfile}
                onSelectCustom={selectCustomProfile}
                onCustomProfileNameChange={updateCustomProfileName}
                onLoadRecipe={() => openArchiveTab('recipes')}
              />

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                <section className="bp-soft-card rounded-[18px] p-4 sm:p-5">
                  <div>
                    <h2 className="text-xl font-semibold text-ink">Pianificatore degli ingredienti</h2>
                    <p className="mt-1 text-sm leading-5 text-[#6f6257]">
                      Imposta quantità, idratazione, starter e olio.
                    </p>
                  </div>

                  <FlourTotalForm
                    flourTotal={effectiveInputs.flourTotal}
                    flourMix={flourMix}
                    onChange={(value) => updateInput('flourTotal', value)}
                    onFlourMixChange={updateFlourMix}
                  />

                  <CalculatorForm
                    inputs={effectiveInputs}
                    unitModes={unitModes}
                    gramValues={gramValues}
                    onChange={updateInput}
                    onUnitChange={updateUnitMode}
                  />
                </section>

                <div className="grid gap-3 xl:sticky xl:top-6 xl:self-start">
                  <IngredientsToWeighCard
                    results={results}
                    flourBreakdown={flourBreakdown}
                    onSaveRecipe={() => openArchiveTab('recipes')}
                    onContinueToTimes={continueToTimes}
                  />
                  {results.hasNegativeAdditions && (
                    <div className="rounded-2xl border border-wheat-200 bg-wheat-50 px-4 py-3 text-sm font-medium leading-5 text-ink">
                      Controlla le percentuali: lo starter contiene più farina o acqua di quanta ne richieda
                      la formula.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
            ) : activePlannerSection === 'times' ? (
          <TimelinePlanner
            activeProfileId={activeProfileId}
            inputs={effectiveInputs}
            flourMix={flourMix}
            ambientTemperature={ambientTemperature}
            selectedPresetId={selectedTimelinePresetId}
            timelineName={timelineName}
            isTimelineCustom={timelineIsCustom}
            steps={timelineSteps}
            timer={timelineTimer}
            planning={planning}
            timerRestoreNotice={timerRestoreNotice}
            onPresetApplied={applyTimelinePresetState}
            onStepsChange={updateTimelineStepsAsCustom}
            onTimelineNameChange={updateTimelineName}
            onTimerChange={updateTimelineTimer}
            onPlanningChange={updateTimelinePlanningAsCustom}
            onAmbientTemperatureChange={updateAmbientTemperature}
            onOpenTimelines={() => openArchiveTab('timelines')}
            onSaveTimeline={() => openArchiveTab('timelines')}
            onStartTimelineNow={startActiveSessionNow}
            onProgramTimeline={(nextPlanning, scheduledStartAt) => {
              updateTimelinePlanningAsCustom(nextPlanning);
              programTimelineInDiary(nextPlanning, scheduledStartAt);
            }}
            liveSessionBlockMessage={activeSession
              ? activeSession.status === 'completed'
                ? getActiveSessionBlockingMessage(activeSession)
                : `Sessione in corso: ${getActiveSessionRecipeName(activeSession)}. Puoi programmare questo piano per dopo, ma non avviarlo ora.`
              : undefined}
            onStartBlocked={() => {
              setArchiveMessage(getActiveSessionBlockingMessage(activeSession));
              openActiveSessionDrawer();
            }}
          />
            ) : (
          <DiaryPanel
            archive={archive}
            archiveMessage={archiveMessage}
            currentJournalEntryId={currentJournalEntryId}
            timer={timelineTimer}
            onUpdateJournalEntry={updateJournalInArchive}
            onDeleteJournalEntry={deleteJournalFromArchive}
            onLoadJournalSnapshot={loadJournalSnapshotIntoPlanner}
            onLoadJournalRecipe={loadJournalRecipeIntoPlanner}
            onLoadJournalTimeline={loadJournalTimelineIntoPlanner}
            onCreateTrialFromJournal={createNewTrialFromJournal}
            onResumeSession={() => setActivePlannerSection('times')}
            activeSessionBlockMessage={activeSession ? getActiveSessionBlockingMessage(activeSession) : ''}
            onStartScheduledJournalEntry={startScheduledJournalEntry}
            onSaveJournalRecipe={saveJournalRecipeToArchive}
            onSaveJournalTimeline={saveJournalTimelineToArchive}
          />
            )}
          </div>
        </section>

        {activePlannerSection !== 'diary' && <QuickGuidelines />}

        <div className="flex flex-col items-center justify-center gap-3 text-center text-sm text-[#6f6257] sm:flex-row">
          <p>
            Le quantità sono calcolate con arrotondamento al grammo. {localMemoryMessage}
          </p>
          <button
            type="button"
            onClick={clearLocalMemory}
            className="bp-focus min-h-9 rounded-full border border-[#322e2b24] bg-white/80 px-3 text-sm font-semibold text-[#6f6257] transition hover:border-crust/40 hover:bg-cream/55 hover:text-ink"
          >
            Cancella memoria locale
          </button>
        </div>
      </div>

      {activeView !== 'planner' && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-[#322e2b]/38 px-3 py-4 backdrop-blur-[2px] sm:px-6 sm:py-8"
          role="presentation"
          onMouseDown={openPlanner}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={
              activeArchiveTab === 'recipes'
                  ? 'Ricette'
                  : 'Timeline'
            }
            className="relative mx-auto w-full max-w-[1320px]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={openPlanner}
              className="bp-focus absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-[#322e2b24] bg-white text-[#6f6257] shadow-air transition hover:border-crust/40 hover:bg-cream/60 hover:text-ink"
              aria-label="Chiudi pannello"
            >
              <X size={20} aria-hidden="true" />
            </button>
            <ArchivePanel
              archive={archive}
              activeTab={activeArchiveTab}
              activeRecipeId={activeRecipeId}
              activeTimelineId={activeTimelineId}
              archiveMessage={archiveMessage}
              onTabChange={openArchiveTab}
              onSaveRecipe={saveRecipeToArchive}
              onUpdateRecipe={updateActiveRecipe}
              onSaveRecipeWithTimeline={saveRecipeAndTimelineToArchive}
              onLoadRecipe={loadRecipeFromArchive}
              onDuplicateRecipe={duplicateRecipeInArchive}
              onDeleteRecipe={deleteRecipeFromArchive}
              onCreateJournalFromRecipe={createJournalFromRecipe}
              onSaveTimeline={saveTimelineToArchive}
              onUpdateTimeline={updateActiveTimeline}
              onLoadTimeline={loadTimelineFromArchive}
              onDuplicateTimeline={duplicateTimelineInArchive}
              onDeleteTimeline={deleteTimelineFromArchive}
              onAssociateTimelineToRecipe={associateTimelineToRecipe}
              onCreateJournalFromTimeline={createJournalFromTimeline}
              onCreateJournalEntry={createJournalEntry}
              onUpdateJournalEntry={updateJournalInArchive}
              onDeleteJournalEntry={deleteJournalFromArchive}
              onLoadJournalSnapshot={loadJournalSnapshotIntoPlanner}
              onCreateTrialFromJournal={createNewTrialFromJournal}
            />
          </div>
        </div>
      )}
    </main>
  );
}

function DiaryPanel({
  archive,
  archiveMessage,
  currentJournalEntryId,
  timer,
  onUpdateJournalEntry,
  onDeleteJournalEntry,
  onLoadJournalSnapshot,
  onLoadJournalRecipe,
  onLoadJournalTimeline,
  onCreateTrialFromJournal,
  onResumeSession,
  activeSessionBlockMessage,
  onStartScheduledJournalEntry,
  onSaveJournalRecipe,
  onSaveJournalTimeline,
}: {
  archive: ArchiveState;
  archiveMessage: string;
  currentJournalEntryId?: string;
  timer: TimerState;
  onUpdateJournalEntry: Parameters<typeof ArchivePanel>[0]['onUpdateJournalEntry'];
  onDeleteJournalEntry: (entryId: string) => void;
  onLoadJournalSnapshot: (entryId: string) => void;
  onLoadJournalRecipe: (entryId: string) => void;
  onLoadJournalTimeline: (entryId: string) => void;
  onCreateTrialFromJournal: (entryId: string) => void;
  onResumeSession: () => void;
  activeSessionBlockMessage: string;
  onStartScheduledJournalEntry: (entryId: string) => void;
  onSaveJournalRecipe: (entryId: string) => void;
  onSaveJournalTimeline: (entryId: string) => void;
}) {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [editorValues, setEditorValues] = useState<JournalEditorValues | null>(null);
  const sortedEntries = useMemo(
    () => sortJournalEntries(archive.journal, currentJournalEntryId),
    [archive.journal, currentJournalEntryId],
  );
  const selectedEntry = selectedEntryId ? archive.journal.find((entry) => entry.id === selectedEntryId) : undefined;

  useEffect(() => {
    if (selectedEntryId && !selectedEntry) {
      setSelectedEntryId(null);
      setEditorValues(null);
    }
  }, [selectedEntry, selectedEntryId]);

  const openEntry = (entry: JournalEntry) => {
    setSelectedEntryId(entry.id);
    setEditorValues({
      title: entry.title,
      date: entry.date,
      status: entry.sessionData.status,
      resultLabel: entry.sessionData.resultLabel,
      initialNotes: entry.sessionData.initialNotes,
      finalNotes: entry.sessionData.finalNotes,
      nextAdjustment: entry.sessionData.nextAdjustment,
    });
  };

  const saveEntry = () => {
    if (!selectedEntry || !editorValues) {
      return;
    }

    onUpdateJournalEntry(selectedEntry.id, {
      ...editorValues,
      sourceRecipeId: selectedEntry.sourceRecipeId ?? '',
      sourceTimelineId: selectedEntry.sourceTimelineId ?? '',
    });
  };

  if (selectedEntry && editorValues) {
    return (
      <DiaryEntryEditor
        entry={selectedEntry}
        values={editorValues}
        timer={selectedEntry.id === currentJournalEntryId ? timer : selectedEntry.timerState}
        onChange={setEditorValues}
        onBack={() => {
          setSelectedEntryId(null);
          setEditorValues(null);
        }}
        onSave={saveEntry}
        onResumeSession={onResumeSession}
        onLoadJournalRecipe={() => onLoadJournalRecipe(selectedEntry.id)}
        onLoadJournalTimeline={() => onLoadJournalTimeline(selectedEntry.id)}
        onSaveJournalRecipe={() => onSaveJournalRecipe(selectedEntry.id)}
        onSaveJournalTimeline={() => onSaveJournalTimeline(selectedEntry.id)}
        onLoadJournalSnapshot={() => onLoadJournalSnapshot(selectedEntry.id)}
        onCreateTrialFromJournal={() => onCreateTrialFromJournal(selectedEntry.id)}
        onDeleteJournalEntry={() => onDeleteJournalEntry(selectedEntry.id)}
        activeSessionBlockMessage={activeSessionBlockMessage}
        onStartScheduledJournalEntry={() => onStartScheduledJournalEntry(selectedEntry.id)}
        isRecipeSaved={Boolean(selectedEntry.sourceRecipeId && archive.recipes.some((recipe) => recipe.id === selectedEntry.sourceRecipeId))}
        isTimelineSaved={Boolean(selectedEntry.sourceTimelineId && archive.timelines.some((timeline) => timeline.id === selectedEntry.sourceTimelineId))}
      />
    );
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-[30px] font-semibold tracking-normal text-ink">Diario</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6f6257]">
            Bozze, sessioni attive e impasti completati vivono nello stesso elenco.
          </p>
        </div>
        {archiveMessage && (
          <p className="rounded-full border border-sage/25 bg-sage/12 px-3 py-2 text-sm font-semibold text-ink">
            {archiveMessage}
          </p>
        )}
      </div>

      <div className="grid gap-3">
        {sortedEntries.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#322e2b24] bg-cream/35 p-5 text-sm leading-6 text-[#6f6257]">
            Nessuna entry nel Diario. Parti dal Planner e usa Vai ai Tempi per creare la prossima bozza.
          </div>
        ) : sortedEntries.map((entry) => (
          <DiaryEntryCard
            key={entry.id}
            entry={entry}
            isCurrent={entry.id === currentJournalEntryId}
            onOpen={() => openEntry(entry)}
            onResume={entry.sessionData.status === 'active' ? onResumeSession : undefined}
            onStartScheduled={entry.sessionData.status === 'scheduled' ? () => onStartScheduledJournalEntry(entry.id) : undefined}
            activeSessionBlockMessage={activeSessionBlockMessage}
          />
        ))}
      </div>
    </section>
  );
}

type JournalEditorValues = {
  title: string;
  date: string;
  status: JournalStatus;
  resultLabel: string;
  initialNotes: string;
  finalNotes: string;
  nextAdjustment: string;
};

const formatScheduledDateTime = (value?: number) => {
  if (!value) {
    return 'Orario da definire';
  }
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

function DiaryEntryCard({
  entry,
  isCurrent,
  onOpen,
  onResume,
  onStartScheduled,
  activeSessionBlockMessage,
}: {
  entry: JournalEntry;
  isCurrent: boolean;
  onOpen: () => void;
  onResume?: () => void;
  onStartScheduled?: () => void;
  activeSessionBlockMessage: string;
}) {
  const visual = journalStatusVisuals[entry.sessionData.status];
  const isScheduledBlocked = Boolean(onStartScheduled && activeSessionBlockMessage);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`cursor-pointer rounded-[18px] border border-l-[6px] p-4 text-left text-sm leading-5 text-[#6f6257] shadow-inner-soft ring-1 transition hover:-translate-y-0.5 hover:shadow-air focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(178,104,55,0.18)] ${visual.card} ${
      isCurrent ? 'border-crust/35 ring-2 ring-crust/25' : 'border-[#322e2b14]'
    }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-ink">{entry.title}</h3>
            <StatusBadge status={entry.sessionData.status} />
          </div>
          <p className="mt-1 text-[#8d8176]">{formatDiaryDate(entry.date)}</p>
          {entry.sessionData.status === 'scheduled' && (
            <p className="mt-2 font-semibold text-ink">
              Programmata: {formatScheduledDateTime(entry.sessionData.scheduledStartAt)}
            </p>
          )}
          {entry.sessionData.resultLabel && (
            <p className="mt-2 font-medium text-ink">Risultato: {entry.sessionData.resultLabel}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <SummaryPill>
              Ingredienti: {formatGram(entry.recipeSnapshot.inputs.flourTotal)} farina · {Math.round(entry.recipeSnapshot.inputs.hydration)}% idratazione · {getRecipeProfileLabel(entry.recipeSnapshot)}
            </SummaryPill>
            <SummaryPill>
              Tempi: {getReadableTimelineName(entry.timelineSnapshot?.name, entry.timelineSnapshot ? personalizedTimelineName : 'piano da completare')} · temperatura {getAmbientTemperatureOption(entry.timelineSnapshot?.ambientTemperature ?? entry.sessionData.ambientTemperature).label.toLowerCase()}
            </SummaryPill>
          </div>
          {entry.sessionData.finalNotes && (
            <p className="mt-3 line-clamp-2">{entry.sessionData.finalNotes}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
          {onResume && (
            <DiaryActionButton
              onClick={(event) => {
                event.stopPropagation();
                onResume();
              }}
            >
              Riprendi
            </DiaryActionButton>
          )}
          {onStartScheduled && (
            <div className="grid gap-1">
              <DiaryActionButton
                disabled={isScheduledBlocked}
                onClick={(event) => {
                  event.stopPropagation();
                  onStartScheduled();
                }}
              >
                Avvia sessione
              </DiaryActionButton>
              {isScheduledBlocked && (
                <span className="max-w-[220px] text-xs font-semibold leading-4 text-[#6f6257]">
                  Hai già una sessione in corso
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function DiaryEntryEditor({
  entry,
  values,
  timer,
  onChange,
  onBack,
  onSave,
  onResumeSession,
  onLoadJournalRecipe,
  onLoadJournalTimeline,
  onSaveJournalRecipe,
  onSaveJournalTimeline,
  onLoadJournalSnapshot,
  onCreateTrialFromJournal,
  onDeleteJournalEntry,
  activeSessionBlockMessage,
  onStartScheduledJournalEntry,
  isRecipeSaved,
  isTimelineSaved,
}: {
  entry: JournalEntry;
  values: JournalEditorValues;
  timer?: TimerState;
  onChange: (values: JournalEditorValues) => void;
  onBack: () => void;
  onSave: () => void;
  onResumeSession: () => void;
  onLoadJournalRecipe: () => void;
  onLoadJournalTimeline: () => void;
  onSaveJournalRecipe: () => void;
  onSaveJournalTimeline: () => void;
  onLoadJournalSnapshot: () => void;
  onCreateTrialFromJournal: () => void;
  onDeleteJournalEntry: () => void;
  activeSessionBlockMessage: string;
  onStartScheduledJournalEntry: () => void;
  isRecipeSaved: boolean;
  isTimelineSaved: boolean;
}) {
  const recipeName = getReadableRecipeName(entry.recipeSnapshot, entry.title);
  const timelineName = getReadableTimelineName(entry.timelineSnapshot?.name, entry.timelineSnapshot ? personalizedTimelineName : unsavedTimelineName);
  const isScheduledBlocked = Boolean(activeSessionBlockMessage);

  return (
    <section className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="bp-focus inline-flex min-h-9 items-center justify-center rounded-full border border-[#322e2b24] bg-white px-3 text-sm font-semibold text-[#6f6257] transition hover:border-crust/35 hover:bg-cream/45 hover:text-ink"
          >
            Torna al Diario
          </button>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h2 className="font-display text-[30px] font-semibold tracking-normal text-ink">{entry.title}</h2>
            <StatusBadge status={entry.sessionData.status} />
          </div>
          <p className="mt-1 text-sm leading-6 text-[#6f6257]">
            Snapshot ricetta e piano restano legati a questa entry del diario.
          </p>
        </div>
        {entry.sessionData.status === 'active' && (
          <button
            type="button"
            onClick={onResumeSession}
            className="bp-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-crust bg-crust px-4 text-sm font-semibold text-white transition hover:border-[#925028] hover:bg-[#925028]"
          >
            <Play size={16} aria-hidden="true" />
            Riprendi
          </button>
        )}
        {entry.sessionData.status === 'scheduled' && (
          <div className="grid gap-1 sm:justify-items-end">
            <button
              type="button"
              onClick={onStartScheduledJournalEntry}
              disabled={isScheduledBlocked}
              className="bp-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-crust bg-crust px-4 text-sm font-semibold text-white transition hover:border-[#925028] hover:bg-[#925028] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Play size={16} aria-hidden="true" />
              Avvia sessione
            </button>
            {isScheduledBlocked && (
              <p className="max-w-[240px] text-right text-xs font-semibold leading-4 text-[#6f6257]">
                Hai già una sessione in corso
              </p>
            )}
          </div>
        )}
      </div>
      {entry.sessionData.status === 'scheduled' && (
        <p className="rounded-2xl border border-wheat/25 bg-wheat/15 px-4 py-3 text-sm font-semibold text-ink">
          Programmata: {formatScheduledDateTime(entry.sessionData.scheduledStartAt)}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="rounded-[18px] border border-[#322e2b14] bg-[#fffdf8] p-4 shadow-inner-soft">
          <div className="grid gap-3 sm:grid-cols-2">
            <JournalTextInput
              label="Titolo entry"
              value={values.title}
              onChange={(title) => onChange({ ...values, title })}
            />
            <JournalTextInput
              label="Data"
              type="date"
              value={values.date}
              onChange={(date) => onChange({ ...values, date })}
            />
            <JournalSelect
              label="Stato"
              value={values.status}
              onChange={(status) => onChange({ ...values, status: status as JournalStatus })}
              options={[
                { value: 'draft', label: 'Bozza' },
                { value: 'active', label: 'Attiva' },
                { value: 'scheduled', label: 'Programmata' },
                { value: 'completed', label: 'Completata' },
              ]}
            />
            <div className="grid gap-3 sm:col-span-2 lg:grid-cols-2">
              <DiaryReferencePanel
                title="Ricetta usata"
                name={recipeName}
                status={isRecipeSaved ? 'Ricetta salvata nell\'archivio.' : 'Questa ricetta non è ancora salvata.'}
                onSecondary={onLoadJournalRecipe}
                secondaryLabel="Carica nel planner"
                onSave={isRecipeSaved ? undefined : onSaveJournalRecipe}
                saveLabel="Salva ricetta"
              />
              <DiaryReferencePanel
                title="Timeline usata"
                name={timelineName}
                status={isTimelineSaved ? 'Timeline salvata nell\'archivio.' : 'Questa timeline non è ancora salvata.'}
                onSecondary={entry.timelineSnapshot ? onLoadJournalTimeline : undefined}
                secondaryLabel="Carica nei Tempi"
                onSave={entry.timelineSnapshot && !isTimelineSaved ? onSaveJournalTimeline : undefined}
                saveLabel="Salva la timeline"
              />
            </div>
            <JournalTextInput
              label="Risultato"
              value={values.resultLabel}
              onChange={(resultLabel) => onChange({ ...values, resultLabel })}
              placeholder="Buona, da migliorare..."
            />
          </div>
          <div className="mt-3 grid gap-3">
            <JournalTextArea
              label="Note iniziali"
              value={values.initialNotes}
              onChange={(initialNotes) => onChange({ ...values, initialNotes })}
            />
            <JournalTextArea
              label="Note"
              value={values.finalNotes}
              onChange={(finalNotes) => onChange({ ...values, finalNotes })}
            />
            <JournalTextArea
              label="Cosa cambiare la prossima volta"
              value={values.nextAdjustment}
              onChange={(nextAdjustment) => onChange({ ...values, nextAdjustment })}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <DiaryActionButton onClick={onSave} tone="primary" icon={Save}>Salva modifiche</DiaryActionButton>
            <DiaryActionButton onClick={onLoadJournalSnapshot} icon={FolderOpen}>Usa come base</DiaryActionButton>
            <DiaryActionButton onClick={onCreateTrialFromJournal} icon={FilePlus2}>Nuova entry</DiaryActionButton>
            <DiaryActionButton onClick={onDeleteJournalEntry} tone="danger" icon={Trash2}>Elimina</DiaryActionButton>
          </div>
        </div>

        <aside className="grid gap-4 xl:sticky xl:top-6 xl:self-start">
          <DiaryIngredientsSnapshotCard
            entry={entry}
            onLoadJournalRecipe={onLoadJournalRecipe}
            onSaveJournalRecipe={onSaveJournalRecipe}
          />

          <DiaryTimelineSnapshotCard
            entry={entry}
            onLoadJournalTimeline={onLoadJournalTimeline}
            onSaveJournalTimeline={onSaveJournalTimeline}
            onResumeSession={onResumeSession}
          />

          {entry.sessionData.status === 'active' && (
            <DiaryTimerSummary entry={entry} timer={timer} />
          )}
        </aside>
      </div>
    </section>
  );
}

function DiaryIngredientsSnapshotCard({
  entry,
  onLoadJournalRecipe,
  onSaveJournalRecipe,
}: {
  entry: JournalEntry;
  onLoadJournalRecipe: () => void;
  onSaveJournalRecipe: () => void;
}) {
  const recipe = entry.recipeSnapshot;
  const ingredients = recipe.calculatedIngredients;
  const recipeName = getReadableRecipeName(recipe, entry.title);
  const profileLabel = getRecipeProfileLabel(recipe);
  const flourRows = calculateFlourBreakdown(recipe.inputs.flourTotal, recipe.flourMix);
  const visibleFlourRows = flourRows.filter((row) => row.percentage > 0);

  return (
    <section className="rounded-[18px] border border-[#322e2b14] bg-cream/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">Ingredienti</h3>
          <p className="mt-1 text-sm font-semibold text-crust">{recipeName}</p>
        </div>
        {profileLabel !== recipeName && (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#6f6257] ring-1 ring-[#322e2b14]">
            {profileLabel}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-2 text-sm text-[#6f6257]">
        <SessionMetric label="Farina" value={formatGram(recipe.inputs.flourTotal)} />
        <SessionMetric label="Idratazione" value={`${Math.round(recipe.inputs.hydration)}%`} />
        <SessionMetric label="Acqua" value={formatGram(ingredients.waterTotal)} />
        <SessionMetric label="Starter" value={formatGram(ingredients.starter)} />
        <SessionMetric label="Idratazione starter" value={`${Math.round(recipe.inputs.starterHydration)}%`} />
        <SessionMetric label="Sale" value={formatGram(ingredients.salt)} />
        <SessionMetric label="Olio" value={formatGram(ingredients.oil)} />
        <SessionMetric label="Peso impasto stimato" value={formatGram(recipe.estimatedDoughWeight)} />
      </div>

      {visibleFlourRows.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[#322e2b14] bg-white/74 p-3">
          <h4 className="text-sm font-semibold text-ink">Mix farine</h4>
          <div className="mt-2 grid gap-2">
            {visibleFlourRows.map((row) => (
              <div key={row.id} className="flex items-baseline justify-between gap-3 text-sm text-[#6f6257]">
                <span>{row.label}</span>
                <span className="text-right font-semibold text-ink">
                  {Math.round(row.percentage)}% · {formatGram(row.grams)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <DiaryActionButton onClick={onLoadJournalRecipe} icon={FolderOpen}>Carica nel planner</DiaryActionButton>
        <DiaryActionButton onClick={onSaveJournalRecipe} icon={FilePlus2}>Salva ricetta</DiaryActionButton>
      </div>
    </section>
  );
}

function DiaryReferencePanel({
  title,
  name,
  status,
  onSecondary,
  secondaryLabel,
  onSave,
  saveLabel,
}: {
  title: string;
  name: string;
  status: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
  onSave?: () => void;
  saveLabel: string;
}) {
  return (
    <section className="rounded-2xl border border-[#322e2b14] bg-cream/35 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8d8176]">{title}</p>
      <h3 className="mt-1 text-base font-semibold text-ink">{name}</h3>
      <p className="mt-1 text-sm leading-5 text-[#6f6257]">{status}</p>
      {(onSecondary || onSave) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onSecondary && secondaryLabel && (
            <button
              type="button"
              onClick={onSecondary}
              className="bp-focus inline-flex min-h-9 items-center justify-center rounded-full border border-[#322e2b18] bg-white px-3 text-sm font-semibold text-[#6f6257] transition hover:border-crust/35 hover:bg-cream/45 hover:text-ink"
            >
              {secondaryLabel}
            </button>
          )}
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="bp-focus inline-flex min-h-9 items-center justify-center rounded-full border border-crust/25 bg-white px-3 text-sm font-semibold text-crust transition hover:border-crust/45 hover:bg-cream"
            >
              {saveLabel}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function DiaryTimelineSnapshotCard({
  entry,
  onLoadJournalTimeline,
  onSaveJournalTimeline,
  onResumeSession,
}: {
  entry: JournalEntry;
  onLoadJournalTimeline: () => void;
  onSaveJournalTimeline: () => void;
  onResumeSession: () => void;
}) {
  const timeline = entry.timelineSnapshot;
  const temperature = getAmbientTemperatureOption(timeline?.ambientTemperature ?? entry.sessionData.ambientTemperature);
  const timelineName = getReadableTimelineName(timeline?.name, timeline ? personalizedTimelineName : unsavedTimelineName);
  const hasProgrammedDate = Boolean(entry.planning?.targetEndDate && entry.planning?.targetEndTime);

  return (
    <section className="rounded-[18px] border border-[#322e2b14] bg-[#fffdf8] p-4 shadow-inner-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">Tempi</h3>
          <p className="mt-1 text-sm font-semibold text-crust">{timelineName}</p>
        </div>
        <span className="rounded-full bg-wheat/30 px-3 py-1 text-xs font-semibold text-ink ring-1 ring-wheat/30">
          {temperature.label}
        </span>
      </div>

      {!timeline ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#322e2b24] bg-cream/45 p-3 text-sm leading-6 text-[#6f6257]">
          Piano non ancora completato. Aggiungi una timeline dalla tab Tempi quando sei pronto.
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-2 text-sm text-[#6f6257]">
            <SessionMetric label="Temperatura" value={`${temperature.label} · ${temperature.rangeLabel}`} />
            <SessionMetric label="Durata totale" value={formatDurationMinutes(timeline.totalDurationMinutes)} />
            <SessionMetric label="Step" value={`${timeline.steps.length}`} />
            {entry.planning?.mode === 'backward' && hasProgrammedDate && (
              <SessionMetric label="Programmata per" value={`${entry.planning.targetEndDate} ${entry.planning.targetEndTime}`} />
            )}
          </div>

          <ol className="mt-4 grid gap-2">
            {timeline.steps.map((step, index) => (
              <li key={step.id} className="rounded-2xl border border-[#322e2b14] bg-cream/35 p-3">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{index + 1}. {step.label}</span>
                  <span className="shrink-0 font-semibold text-crust">{formatDurationMinutes(step.durationMinutes)}</span>
                </div>
                {(step.description || step.note) && (
                  <p className="mt-1 text-xs leading-5 text-[#6f6257]">{step.note || step.description}</p>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {timeline ? (
          <>
            <DiaryActionButton onClick={onLoadJournalTimeline} icon={Clock3}>Carica nei Tempi</DiaryActionButton>
            <DiaryActionButton onClick={onSaveJournalTimeline} icon={FilePlus2}>Salva il piano</DiaryActionButton>
          </>
        ) : (
          <DiaryActionButton onClick={onResumeSession} icon={Clock3}>Torna ai Tempi</DiaryActionButton>
        )}
      </div>
    </section>
  );
}

function DiaryTimerSummary({ entry, timer }: { entry: JournalEntry; timer?: TimerState }) {
  const timelineSteps = entry.timelineSnapshot?.steps ?? [];
  const elapsedMs = timer ? getElapsedMs(timer) : 0;
  const totalDurationMs = getTotalDurationMs(timelineSteps);
  const currentStepInfo = getCurrentStepInfo(timelineSteps, elapsedMs);
  const nextStep = currentStepInfo ? timelineSteps[currentStepInfo.index + 1] : null;
  const progressPercentage =
    totalDurationMs > 0 ? Math.min(100, Math.round((elapsedMs / totalDurationMs) * 100)) : 0;

  return (
    <div className="rounded-[18px] border border-[#322e2b14] bg-[#fffdf8] p-4 shadow-inner-soft">
      <h3 className="text-lg font-semibold text-ink">Timer</h3>
      {timelineSteps.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-[#6f6257]">
          Aggiungi un piano nella tab Tempi per vedere qui il riepilogo operativo.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 text-sm text-[#6f6257]">
          <SessionMetric label="Step corrente" value={currentStepInfo?.step.label ?? 'Pronta per partire'} />
          <SessionMetric label="Tempo rimanente" value={formatTimerMs(currentStepInfo?.remainingInStepMs ?? 0)} />
          <SessionMetric label="Prossimo step" value={nextStep?.label ?? 'Nessun prossimo step'} />
          <SessionMetric label="Avanzamento" value={`${progressPercentage}%`} />
          <div className="h-3 overflow-hidden rounded-full bg-cream">
            <div className="h-full rounded-full bg-crust transition-all" style={{ width: `${progressPercentage}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: JournalStatus }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${journalStatusVisuals[status].badge}`}>
      {statusLabels[status]}
    </span>
  );
}

function SummaryPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[#322e2b14] bg-cream/42 px-3 py-1 text-xs font-semibold text-[#6f6257]">
      {children}
    </span>
  );
}

function DiaryActionButton({
  children,
  onClick,
  tone = 'secondary',
  disabled = false,
  icon: Icon,
}: {
  children: ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  tone?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  icon?: IconComponent;
}) {
  const className = tone === 'primary'
    ? 'border-crust bg-crust text-white hover:border-[#925028] hover:bg-[#925028]'
    : tone === 'danger'
      ? 'border-[#322e2b18] bg-white text-[#6f6257] hover:border-red-200 hover:bg-red-50 hover:text-red-600'
      : 'border-[#322e2b18] bg-white text-[#6f6257] hover:border-crust/35 hover:bg-cream/45 hover:text-ink';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`bp-focus inline-flex min-h-9 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
    >
      {Icon && <Icon size={15} aria-hidden="true" />}
      {children}
    </button>
  );
}

function JournalTextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#6f6257]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        className="min-h-11 rounded-2xl border border-[#322e2b24] bg-white px-3 text-base font-medium text-ink outline-none transition focus:border-crust focus:ring-4 focus:ring-[rgba(178,104,55,0.18)]"
      />
    </label>
  );
}

function JournalTextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#6f6257]">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        rows={3}
        className="rounded-2xl border border-[#322e2b24] bg-white px-3 py-2 text-base font-medium text-ink outline-none transition focus:border-crust focus:ring-4 focus:ring-[rgba(178,104,55,0.18)]"
      />
    </label>
  );
}

function JournalSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#6f6257]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-11 rounded-2xl border border-[#322e2b24] bg-white px-3 text-base font-medium text-ink outline-none transition focus:border-crust focus:ring-4 focus:ring-[rgba(178,104,55,0.18)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function SessionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#322e2b14] pb-2 last:border-b-0 last:pb-0">
      <span>{label}</span>
      <span className="text-right font-semibold text-ink">{value}</span>
    </div>
  );
}

function formatTimerMs(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function formatDurationMinutes(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const restMinutes = safeMinutes % 60;
  if (hours > 0 && restMinutes > 0) {
    return `${hours}h ${restMinutes} min`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${restMinutes} min`;
}

function getRecipeProfileLabel(recipe: RecipeSnapshot) {
  if (recipe.activeProfileId === 'custom') {
    return recipe.customProfileName.trim() || 'Custom';
  }
  return doughProfiles.find((profile) => profile.id === recipe.activeProfileId)?.label ?? recipe.customProfileName ?? 'Impasto';
}

function getReadableRecipeName(recipe: RecipeSnapshot, fallback = 'Impasto') {
  const recipeName = recipe.name.trim();
  if (recipeName && recipeName !== 'Impasto corrente' && recipeName !== 'Planner corrente') {
    return recipeName;
  }

  const customName = recipe.customProfileName.trim();
  return customName && customName !== 'Custom' ? customName : fallback;
}

function Header({
  activeView,
  recipesCount,
  timelinesCount,
  newRecipeBadge,
  newTimelineBadge,
  activeSession,
  onOpenPlanner,
  onOpenRecipes,
  onOpenTimelines,
  onOpenActiveSession,
  onReset,
}: {
  activeView: AppView;
  recipesCount: number;
  timelinesCount: number;
  newRecipeBadge: boolean;
  newTimelineBadge: boolean;
  activeSession?: ActiveSession;
  onOpenPlanner: () => void;
  onOpenRecipes: () => void;
  onOpenTimelines: () => void;
  onOpenActiveSession: () => void;
  onReset: () => void;
}) {
  return (
    <header className="border-b border-[#322e2b14] bg-[#fffdf8]/88 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1510px] flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <button
          type="button"
          onClick={onOpenPlanner}
          className="bp-focus flex items-center gap-3 rounded-2xl text-left"
          aria-label="Apri il planner"
        >
          <div className="grid h-12 w-14 place-items-center rounded-[18px] border border-[#322e2b18] bg-cream text-ink shadow-inner-soft">
            <BreadIcon size={44} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <h1 className="font-display text-[27px] font-semibold tracking-normal text-ink sm:text-[30px]">
            Bread Planner
          </h1>
        </button>

        <nav className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#6f6257] sm:gap-3">
          <HeaderAction
            icon={<BookOpen size={18} />}
            label="Ricette"
            isActive={activeView === 'recipes'}
            hasContent={recipesCount > 0}
            hasNewBadge={newRecipeBadge}
            onClick={onOpenRecipes}
          />
          <HeaderAction
            icon={<CalendarDays size={18} />}
            label="Timeline"
            isActive={activeView === 'timelines'}
            hasContent={timelinesCount > 0}
            hasNewBadge={newTimelineBadge}
            onClick={onOpenTimelines}
          />
          {activeSession && (
            <HeaderAction
              icon={<Clock3 size={18} />}
              label="Timer"
              hasContent
              hasNewBadge={activeSession.status === 'running' || activeSession.status === 'completed'}
              onClick={onOpenActiveSession}
            />
          )}
          <HeaderAction icon={<CircleHelp size={20} />} label="Guida" disabled />
          <HeaderAction icon={<RotateCcw size={20} />} label="Ripristina" onClick={onReset} />
        </nav>
      </div>
    </header>
  );
}

function HeaderAction({
  icon,
  label,
  onClick,
  disabled = false,
  isActive = false,
  hasContent = false,
  hasNewBadge = false,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  isActive?: boolean;
  hasContent?: boolean;
  hasNewBadge?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Disponibile in una prossima release' : hasNewBadge ? `${label}: nuovo contenuto salvato` : undefined}
      className={`bp-focus relative inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-[#6f6257] transition hover:text-ink disabled:cursor-not-allowed disabled:text-[#9b9188] disabled:hover:text-[#9b9188] ${
        isActive
          ? 'border-crust/35 bg-cream text-ink shadow-inner-soft'
          : hasContent
            ? 'border-[#322e2b18] bg-white/80 text-ink'
            : 'border-transparent bg-transparent'
      }`}
      aria-current={isActive ? 'page' : undefined}
      aria-label={hasNewBadge ? `${label}, nuovo contenuto salvato` : label}
    >
      {icon}
      <span>{label}</span>
      {hasNewBadge && (
        <span className="absolute -right-1 -top-1 grid h-3 w-3 place-items-center rounded-full bg-crust ring-2 ring-white">
          <span className="sr-only">Nuovo contenuto salvato</span>
        </span>
      )}
    </button>
  );
}

function MainFlowTabs({
  activeSection,
  onChange,
}: {
  activeSection: PlannerSection;
  onChange: (section: PlannerSection) => void;
}) {
  const tabs: Array<{ id: PlannerSection; label: string; copy: string }> = [
    {
      id: 'planner',
      label: 'Planner',
      copy: 'Costruisci la ricetta e prepara gli ingredienti.',
    },
    {
      id: 'times',
      label: 'Tempi',
      copy: 'Organizza tempi, temperatura e timer.',
    },
    {
      id: 'diary',
      label: 'Diario',
      copy: 'Bozza, sessione attiva e storico impasti.',
    },
  ];

  return (
    <nav
      className="grid gap-0 bg-cream/45 px-2 pt-2 md:grid-cols-3 md:px-3"
      aria-label="Fasi del planner"
    >
      {tabs.map((tab) => {
        const isActive = activeSection === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`bp-focus min-h-16 rounded-t-[18px] border px-4 py-3 text-left transition ${
              isActive
                ? 'relative -mb-px border-[#322e2b18] border-b-[#fffdf8] bg-[#fffdf8] text-ink shadow-inner-soft'
                : 'border-transparent bg-transparent text-[#6f6257] hover:border-[#322e2b18] hover:bg-white/70'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="block text-base font-semibold">{tab.label}</span>
            <span className="mt-1 block text-sm leading-5 text-[#6f6257]">{tab.copy}</span>
          </button>
        );
      })}
    </nav>
  );
}

function DoughProfileSelector({
  activeProfileId,
  customDisplayName,
  customProfileName,
  profiles,
  getProfileIcon,
  onSelectProfile,
  onSelectCustom,
  onCustomProfileNameChange,
  onLoadRecipe,
}: {
  activeProfileId: ActiveProfileId;
  customDisplayName: string;
  customProfileName: string;
  profiles: DoughProfile[];
  getProfileIcon: (profileId: string) => IconComponent;
  onSelectProfile: (profile: DoughProfile) => void;
  onSelectCustom: () => void;
  onCustomProfileNameChange: (value: string) => void;
  onLoadRecipe: () => void;
}) {
  const profileCopy: Record<string, string> = {
    base: 'Equilibrato, semplice da gestire.',
    high: 'Più acqua, impasto più elastico.',
    focaccia: 'Impasto morbido, olio incluso.',
  };
  return (
    <section className="rounded-[18px] border border-[#322e2b14] bg-[#fffdf8] p-4 shadow-inner-soft sm:p-5">
      <div className="mb-3">
        <h2 className="text-xl font-semibold text-ink">Profilo impasto</h2>
        <p className="mt-1 text-sm leading-5 text-[#6f6257]">
          Parti da un profilo e personalizza la ricetta.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {profiles.map((profile) => {
          const Icon = getProfileIcon(profile.id);
          const isSelected = activeProfileId === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelectProfile(profile)}
              className={`bp-focus flex min-h-[124px] flex-col items-start rounded-[18px] border p-3 text-left transition ${
                isSelected
                  ? 'border-crust/65 bg-cream text-ink ring-2 ring-crust/15'
                  : 'border-[#322e2b18] bg-white text-[#6f6257] hover:border-crust/35 hover:bg-cream/35'
              }`}
              aria-pressed={isSelected}
            >
              <span className={`grid h-10 w-10 place-items-center rounded-full ${
                isSelected ? 'bg-white text-crust ring-1 ring-crust/25' : 'bg-cream/55 text-ink ring-1 ring-[#322e2b18]'
              }`}>
                <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="mt-3 block text-base font-semibold text-ink">{profile.label}</span>
              <span className="mt-1 block text-sm leading-5 text-[#6f6257]">
                {profileCopy[profile.id] ?? profile.description}
              </span>
            </button>
          );
        })}
        {(() => {
          const isSelected = activeProfileId === 'custom';
          return (
        <div
          role="button"
          tabIndex={0}
          onClick={onSelectCustom}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelectCustom();
            }
          }}
          className={`bp-focus flex min-h-[124px] cursor-pointer flex-col items-start rounded-[18px] border p-3 text-left transition ${
            isSelected
              ? 'border-crust/65 bg-cream text-ink ring-2 ring-crust/15'
              : 'border-[#322e2b18] bg-white text-[#6f6257] hover:border-crust/35 hover:bg-cream/35'
          }`}
          aria-pressed={isSelected}
        >
          <span className={`grid h-9 w-9 place-items-center rounded-full ${
            isSelected ? 'bg-white text-crust ring-1 ring-crust/25' : 'bg-cream/55 text-ink ring-1 ring-[#322e2b18]'
          }`}>
            <CirclePlus size={21} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="mt-3 min-w-0 flex-1">
            {isSelected ? (
              <input
                type="text"
                aria-label="Nome profilo custom"
                value={customProfileName}
                placeholder="Custom"
                onClick={(event) => event.stopPropagation()}
                onFocus={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                onChange={(event) => onCustomProfileNameChange(event.currentTarget.value)}
                className="min-h-10 w-full min-w-0 rounded-xl border border-crust/25 bg-white px-3 text-base font-semibold text-ink outline-none transition placeholder:text-[#9b9188] focus:border-crust focus:ring-4 focus:ring-[rgba(178,104,55,0.18)]"
              />
            ) : (
              <span className="block text-base font-semibold">{customDisplayName}</span>
            )}
            <span className="mt-1 block text-sm leading-5 text-[#6f6257]">Crea il tuo profilo.</span>
          </span>
        </div>
          );
        })()}
        <button
          type="button"
          onClick={onLoadRecipe}
          className="bp-focus flex min-h-[124px] flex-col items-start rounded-[18px] border border-dashed border-[#322e2b2e] bg-cream/30 p-3 text-left text-[#6f6257] transition hover:border-crust/40 hover:bg-cream/55"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-ink ring-1 ring-[#322e2b18]">
            <BookOpen size={21} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="mt-3 block text-base font-semibold text-ink">Carica ricetta</span>
          <span className="mt-1 block text-sm leading-5 text-[#6f6257]">
            Usa una ricetta salvata e adattala alle tue esigenze.
          </span>
          <span className="mt-3 inline-flex min-h-8 items-center rounded-full border border-crust/25 bg-white px-3 text-xs font-semibold text-crust">
            Carica
          </span>
        </button>
      </div>
    </section>
  );
}

function CalculatorForm({
  inputs,
  unitModes,
  gramValues,
  onChange,
  onUnitChange,
}: {
  inputs: BreadInputs;
  unitModes: UnitModes;
  gramValues: GramValues;
  onChange: (field: keyof BreadInputs, value: number) => void;
  onUnitChange: (field: ConvertibleField, unit: InputUnit) => void;
}) {
  const fields: FieldConfig[] = [
    {
      field: 'hydration',
      label: 'Idratazione',
      unit: '%',
      value: inputs.hydration,
      step: 1,
      icon: Droplets,
      ingredientIcon: 'hydration',
    },
    {
      field: 'saltPercentage',
      label: 'Sale',
      unit: unitModes.saltPercentage,
      value: unitModes.saltPercentage === 'g' ? gramValues.saltPercentage : inputs.saltPercentage,
      step: 1,
      icon: SaltIcon,
      ingredientIcon: 'salt',
      convertibleField: 'saltPercentage',
    },
    {
      field: 'starterPercentage',
      label: 'Starter',
      unit: unitModes.starterPercentage,
      value: unitModes.starterPercentage === 'g' ? gramValues.starterPercentage : inputs.starterPercentage,
      step: 1,
      icon: JarIcon,
      ingredientIcon: 'starter',
      convertibleField: 'starterPercentage',
    },
    {
      field: 'starterHydration',
      label: 'Idratazione starter',
      unit: '%',
      value: inputs.starterHydration,
      step: 1,
      icon: Droplets,
      ingredientIcon: 'starterHydration',
    },
    {
      field: 'oilPercentage',
      label: 'Olio',
      unit: unitModes.oilPercentage,
      value: unitModes.oilPercentage === 'g' ? gramValues.oilPercentage : inputs.oilPercentage,
      step: 1,
      icon: OilIcon,
      ingredientIcon: 'oil',
      convertibleField: 'oilPercentage',
    },
  ];

  return (
    <form className="mt-0 overflow-hidden rounded-b-[18px] border border-t-0 border-[#322e2b14] bg-white" onSubmit={(event) => event.preventDefault()}>
      {fields.map((field) => (
        <NumberField
          key={field.field}
          label={field.label}
          unit={field.unit}
          value={field.value}
          step={field.step}
          icon={field.icon}
          ingredientIcon={field.ingredientIcon}
          convertibleField={field.convertibleField}
          onChange={(value) => onChange(field.field, value)}
          onUnitChange={field.convertibleField ? (unit) => onUnitChange(field.convertibleField!, unit) : undefined}
        />
      ))}
    </form>
  );
}

function FlourTotalForm({
  flourTotal,
  flourMix,
  onChange,
  onFlourMixChange,
}: {
  flourTotal: number;
  flourMix: FlourMix;
  onChange: (value: number) => void;
  onFlourMixChange: (flourMix: FlourMix) => void;
}) {
  const [isFlourPanelOpen, setIsFlourPanelOpen] = useState(false);
  const firstFlourProfile = getFlourProfile(flourMix.items[0]?.flourProfileId ?? '0-bread');
  const totalPercentage = getFlourMixTotalPercentage(flourMix);
  const isMixValid = isFlourMixValid(flourMix);
  const flourPrompt = flourMix.mode === 'mix'
    ? 'Hai configurato un mix farine. Vuoi modificarlo?'
    : `La farina base è impostata su ${firstFlourProfile.label}. Vuoi modificare o creare un mix?`;
  const mixStatus = isMixValid
    ? `Mix completo: ${formatPercent(totalPercentage)}%.`
    : `Il mix deve arrivare al 100%. Ora sei a ${formatPercent(totalPercentage)}%.`;

  return (
    <form className="mt-4 overflow-hidden rounded-t-[18px] border border-[#322e2b14] bg-white" onSubmit={(event) => event.preventDefault()}>
      <NumberField
        label="Farina"
        unit="g"
        value={flourTotal}
        icon={Wheat}
        ingredientIcon="flour"
        onChange={onChange}
        hideBottomBorder
      />
      {isFlourPanelOpen ? (
        <FlourMixEditor
          flourTotal={flourTotal}
          flourMix={flourMix}
          flourPrompt={flourPrompt}
          mixStatus={mixStatus}
          isMixValid={isMixValid}
          onChange={onFlourMixChange}
          onClose={() => setIsFlourPanelOpen(false)}
        />
      ) : (
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-cream/55 py-1 pl-2 pr-3 font-semibold text-ink">
              <IngredientIcon
                name={flourMix.mode === 'mix' ? 'flourMix' : 'flour'}
                className="h-5 w-5 text-ink"
              />
              {flourMix.mode === 'single' ? 'Una farina' : 'Mix farine'}
            </span>
            <span className={isMixValid ? 'font-semibold text-proof-700' : 'font-semibold text-ink'}>
              {mixStatus}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsFlourPanelOpen(true)}
            className="bp-focus inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-crust/25 bg-cream py-1 pl-2 pr-4 text-sm font-semibold text-crust transition hover:border-crust/45 hover:bg-wheat-50"
          >
            <IngredientIcon name="flourMix" className="h-6 w-6 text-crust" />
            Modifica o crea mix
          </button>
        </div>
      )}
    </form>
  );
}

function IngredientIcon({
  name,
  className,
}: {
  name: IngredientIconName;
  className: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`block shrink-0 bg-current ${className}`}
      style={{
        '--ingredient-icon-url': `url(${ingredientIconPaths[name]})`,
        WebkitMask: 'var(--ingredient-icon-url) center / contain no-repeat',
        mask: 'var(--ingredient-icon-url) center / contain no-repeat',
      } as IngredientIconStyle}
    />
  );
}

function NumberField({
  label,
  unit,
  value,
  step = 1,
  icon: Icon,
  ingredientIcon,
  convertibleField,
  onChange,
  onUnitChange,
  hideBottomBorder = false,
}: {
  label: string;
  unit: InputUnit;
  value: number;
  step?: number;
  icon: IconComponent;
  ingredientIcon?: IngredientIconName;
  convertibleField?: ConvertibleField;
  onChange: (value: number) => void;
  onUnitChange?: (unit: InputUnit) => void;
  hideBottomBorder?: boolean;
}) {
  const inputId = `field-${convertibleField ?? label.toLowerCase().replace(/\s+/g, '-')}`;
  const displayValue = Math.round(value);

  return (
    <div className={`grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(210px,260px)] sm:items-center ${
      hideBottomBorder ? '' : 'border-b border-[#322e2b14] last:border-b-0'
    }`}>
      <label htmlFor={inputId} className="flex min-w-0 items-center gap-4 text-base font-semibold text-ink">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream/65 text-ink ring-1 ring-[#322e2b12]">
          {ingredientIcon ? (
            <IngredientIcon name={ingredientIcon} className="h-8 w-8 text-ink" />
          ) : (
            <Icon size={24} strokeWidth={1.85} aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0">{label}</span>
      </label>
      <span className="flex min-h-12 overflow-hidden rounded-2xl border border-[#322e2b24] bg-white focus-within:border-crust focus-within:ring-4 focus-within:ring-[rgba(178,104,55,0.18)]">
        <input
          id={inputId}
          type="number"
          min="0"
          step={step}
          value={displayValue}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber || 0)}
          className="w-full min-w-0 bg-transparent px-3 text-[22px] font-medium text-ink outline-none"
        />
        {onUnitChange ? (
          <span className="flex items-center gap-1 border-l border-[#322e2b14] bg-cream/35 p-1">
            {(['%', 'g'] as InputUnit[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onUnitChange(option)}
                className={`grid h-9 min-w-9 place-items-center rounded-full px-2 text-sm font-semibold transition ${
                  unit === option
                    ? 'bg-white text-crust shadow-sm ring-1 ring-crust/20'
                    : 'text-[#6f6257] hover:text-ink'
                }`}
                aria-pressed={unit === option}
              >
                {option}
              </button>
            ))}
          </span>
        ) : (
          <span className="grid w-12 place-items-center border-l border-[#322e2b14] bg-cream/35 text-base font-medium text-[#6f6257]">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

function IngredientsToWeighCard({
  results,
  flourBreakdown,
  onSaveRecipe,
  onContinueToTimes,
}: {
  results: ReturnType<typeof calculateBread>;
  flourBreakdown: FlourBreakdownRow[];
  onSaveRecipe: () => void;
  onContinueToTimes: () => void;
}) {
  const hasFlourMix = flourBreakdown.length > 1;
  const hasOil = results.oil !== 0;

  return (
    <aside className="rounded-[20px] border border-[#322e2b14] border-l-[6px] border-l-sage bg-[#fffdf8] p-4 shadow-air sm:p-5">
      <div className="mb-4">
        <h2 className="text-[22px] font-semibold text-ink">Ingredienti da pesare</h2>
        <p className="mt-1 text-sm leading-5 text-[#6f6257]">Usa questi valori durante la preparazione.</p>
      </div>

      <div className="grid gap-3 border-t border-[#322e2b14] pt-4">
        <div className="grid gap-2">
          <WeighRow label="Farina" value={results.flourTotal} />
          {hasFlourMix && (
            <div className="grid gap-1 rounded-2xl bg-cream/40 px-3 py-2">
              {flourBreakdown.map((row) => (
                <div key={row.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-[#6f6257]">{row.label}</span>
                  <span className="whitespace-nowrap font-semibold text-ink">{formatGram(row.grams)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <WeighRow label="Acqua" value={results.waterTotal} />
        <WeighRow label="Starter" value={results.starter} />
        <WeighRow label="Sale" value={results.salt} />
        {hasOil && <WeighRow label="Olio" value={results.oil} />}
      </div>

      <div className="my-3 flex items-baseline justify-between gap-3 rounded-2xl border border-[#322e2b14] bg-cream/42 px-3 py-3">
        <div className="text-sm font-semibold text-[#6f6257]">Peso impasto stimato</div>
        <div className="text-xl font-semibold leading-none text-ink">
          {formatGram(results.estimatedDoughWeight)}
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        <button
          type="button"
          onClick={onContinueToTimes}
          className="bp-focus inline-flex min-h-11 w-full items-center justify-center rounded-full border border-crust bg-crust px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(178,104,55,0.22)] transition hover:border-[#925028] hover:bg-[#925028]"
        >
          Vai ai Tempi
        </button>
        <button
          type="button"
          onClick={onSaveRecipe}
          className="bp-focus inline-flex min-h-10 w-full items-center justify-center rounded-full border border-crust/25 bg-cream/55 px-4 text-sm font-semibold text-crust transition hover:border-crust/45 hover:bg-wheat-50"
        >
          Salva ricetta
        </button>
      </div>
    </aside>
  );
}

function WeighRow({
  label,
  value,
  subtle = false,
}: {
  label: string;
  value: number;
  subtle?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`text-sm leading-5 ${subtle ? 'text-[#8d8176]' : 'text-[#6f6257]'}`}>
        {label}
      </span>
      <span className={`whitespace-nowrap text-right font-semibold text-ink ${subtle ? 'text-[19px]' : 'text-[22px]'}`}>
        {formatGram(value)}
      </span>
    </div>
  );
}

function QuickGuidelines() {
  const guidelines = [
    {
      title: 'Idratazione',
      text: 'Più idratazione = mollica più soffice ma impasto più delicato.',
      icon: Droplets,
    },
    {
      title: 'Autolisi',
      text: '20-60 min migliorano estensibilità e sviluppo del glutine.',
      icon: Clock3,
    },
    {
      title: 'Temperatura impasto',
      text: 'Mantieni l\'impasto tra 24-26 °C per una fermentazione ottimale.',
      icon: Thermometer,
    },
    {
      title: 'Sale',
      text: 'Resta intorno al 2% sulla farina per non rallentare la lievitazione.',
      icon: BowlIcon,
    },
    {
      title: 'Pianifica',
      text: 'Fermentazioni lente in frigo migliorano aroma e digeribilità.',
      icon: CalendarDays,
    },
  ];

  return (
    <section className="bp-card rounded-[20px] p-5">
      <div className="bp-doodle-divider mb-5 flex items-center gap-3 text-[22px] font-semibold text-ink">
        <span className="text-crust">
          <BulbIcon size={28} strokeWidth={1.75} aria-hidden="true" />
        </span>
        Linee guida rapide
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {guidelines.map((guideline) => {
          const Icon = guideline.icon;
          return (
            <article key={guideline.title} className="flex gap-4 border-[#322e2b14] xl:border-l xl:pl-5 first:border-l-0 first:pl-0">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-cream text-crust ring-1 ring-crust/15">
                <Icon size={28} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-ink">{guideline.title}</h2>
                <p className="mt-2 text-sm leading-5 text-[#6f6257]">{guideline.text}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function BreadIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 96"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M16.8 64.7c1.4-16.6 12.6-29.4 29.6-34.4 10.8-3.2 22.2-2.4 34.1.9 15.9 4.4 27.2 15.2 29.8 28.8 2.1 11-4.9 19.9-17.5 22.2-18.3 3.4-40.6 2.8-61.7.2-9.5-1.1-15.1-8-14.3-17.7Z" strokeWidth={strokeWidth * 3.2} />
      <path d="M19.5 66.4c15.2 3.1 39.6 4.8 67.9 1.8 8.5-.9 16.2-2 22.2-3.9" strokeWidth={strokeWidth * 1.45} opacity=".78" />
      <path d="M25.5 77.8c9.5 1.6 21.2 2.7 34.3 2.7 17.2.1 33.2-1.4 45.2-4" strokeWidth={strokeWidth * 1.55} opacity=".7" />
      <path d="M36.8 35.2c12.1 3.2 21 11.2 27.4 23.1" strokeWidth={strokeWidth * 2.7} />
      <path d="M58 27.7c10.5 6.1 17.2 15.3 20.2 27.4" strokeWidth={strokeWidth * 2.7} />
      <path d="M78.8 31.7c8.7 6.8 13.7 14.7 15.3 23.3" strokeWidth={strokeWidth * 2.45} />
      <path d="M36.6 55.4c-1.3 1.2-2 2.9-2.2 5.1" strokeWidth={strokeWidth * 1.25} />
      <path d="M44.3 69.2c2.6.7 5.1 1.1 7.5 1.2" strokeWidth={strokeWidth * 1.2} />
      <path d="M29.5 64.9c-1.6 2.2-1.7 4.4-.2 6.4" strokeWidth={strokeWidth * 1.1} />
      <path d="M91.2 66.2c2.1-1.4 3.4-3.2 4-5.3" strokeWidth={strokeWidth * 1.2} />
      <path d="M72.7 73.1c2.4-.1 4.4-.4 6-.8" strokeWidth={strokeWidth * 1.1} />
    </svg>
  );
}

function FocacciaIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <circle cx="16" cy="16" r="10.5" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="19.8" cy="11.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="21" cy="18.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="13.6" cy="21" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.7" cy="16.2" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SaltIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M12 8.5h8" />
      <path d="M13 8.5v4.2l-2.1 3.1a5 5 0 0 0-.8 2.7v6.2c0 1.4 1.1 2.5 2.5 2.5h6.8c1.4 0 2.5-1.1 2.5-2.5v-6.2c0-1-.3-1.9-.8-2.7L19 12.7V8.5" />
      <path d="M11 18.5h10" />
      <path d="M14 5.5h4" />
    </svg>
  );
}

function JarIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M11 8h10" />
      <path d="M12 5.5h8" />
      <path d="M12 8v3.1c-1.4.9-2.2 2.4-2.2 4v9.1c0 1.6 1.3 2.8 2.8 2.8h6.8c1.6 0 2.8-1.3 2.8-2.8v-9.1c0-1.7-.8-3.2-2.2-4V8" />
      <path d="M10 17.3h12" />
      <path d="M13.4 21h5.2" />
    </svg>
  );
}

function OilIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M16 5.5c4.2 4.8 7 8.7 7 12.7a7 7 0 0 1-14 0c0-4 2.8-7.9 7-12.7Z" />
      <path d="M13.3 20.4c.7 1.2 1.7 1.8 3.1 1.8" />
    </svg>
  );
}

function BowlIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M7 14h18c-.5 6.7-4 10.5-9 10.5S7.5 20.7 7 14Z" />
      <path d="M10 24.5h12" />
      <path d="M11 10c1.6 1.2 3.2 1.2 5 0s3.4-1.2 5 0" />
    </svg>
  );
}

function BulbIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M16 5.5a8 8 0 0 0-4.2 14.8c.8.5 1.2 1.4 1.2 2.3v.4h6v-.4c0-1 .5-1.8 1.3-2.3A8 8 0 0 0 16 5.5Z" />
      <path d="M13 26h6" />
      <path d="M14 29h4" />
      <path d="M16 2.5v1.2" />
      <path d="m6.9 7.4.9.9" />
      <path d="m25.1 7.4-.9.9" />
    </svg>
  );
}

function formatGram(value: number) {
  return `${roundGram(value)} g`;
}

function formatPercent(value: number) {
  return String(Math.round(value));
}

export default App;
