import {
  CalendarDays,
  CircleHelp,
  CirclePlus,
  Clock3,
  Droplets,
  RotateCcw,
  Thermometer,
  Wheat,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ArchiveState,
  ArchiveTab,
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
  type AmbientTemperatureId,
} from './ambientTemperature';
import { calculateBread, type BreadInputs, roundGram } from './calculations';
import { ArchivePanel } from './components/ArchivePanel';
import { AmbientTemperatureSelector } from './components/AmbientTemperatureSelector';
import { FlourMixEditor } from './components/FlourMixEditor';
import { TimelinePlanner } from './components/TimelinePlanner';
import {
  cloneTimelineSteps,
  convertibleFields,
  initialFlourMix,
  initialInputs,
  initialTimelinePresetId,
  initialTimelineSteps,
  initialTimelineTimer,
  initialUnitModes,
  type ConvertibleField,
  type GramValues,
  type InputUnit,
  type UnitModes,
} from './defaults';
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
  createJournalSnapshot,
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
  type PersistedBreadPlannerState,
} from './localStorageState';
import type { TimelineStep } from './timeline';
import { getTotalDurationMs, type TimerState } from './timelineUtils';

type IconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
};

type IconComponent = ComponentType<IconProps>;

type ActiveProfileId = string;

type FieldConfig = {
  field: keyof BreadInputs;
  label: string;
  unit: InputUnit;
  value: number;
  step?: number;
  icon: IconComponent;
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

const cloneValue = <T,>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value) as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

type InitialAppState = {
  inputs: BreadInputs;
  unitModes: UnitModes;
  gramValues: GramValues;
  activeProfileId: ActiveProfileId;
  customProfileName: string;
  flourMix: FlourMix;
  ambientTemperature: AmbientTemperatureId;
  selectedTimelinePresetId: string;
  timelineSteps: TimelineStep[];
  timer: TimerState;
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
  selectedTimelinePresetId: initialTimelinePresetId,
  timelineSteps: initialTimelineSteps(),
  timer: initialTimelineTimer,
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
    selectedTimelinePresetId: loadedState.state.timeline.selectedPresetId,
    timelineSteps: cloneTimelineSteps(loadedState.state.timeline.steps),
    timer: loadedState.state.timeline.timer,
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
  const [selectedTimelinePresetId, setSelectedTimelinePresetId] = useState(initialAppState.selectedTimelinePresetId);
  const [timelineSteps, setTimelineSteps] = useState<TimelineStep[]>(initialAppState.timelineSteps);
  const [timer, setTimer] = useState<TimerState>(initialAppState.timer);
  const [timerRestoreNotice, setTimerRestoreNotice] = useState<string | null>(initialAppState.timerRestoreNotice);
  const [archive, setArchive] = useState<ArchiveState>(loadArchive);
  const [activeArchiveTab, setActiveArchiveTab] = useState<ArchiveTab>('recipes');
  const [activeRecipeId, setActiveRecipeId] = useState<string | undefined>();
  const [activeTimelineId, setActiveTimelineId] = useState<string | undefined>();
  const [archiveMessage, setArchiveMessage] = useState('');
  const [localMemoryMessage, setLocalMemoryMessage] = useState(
    initialAppState.wasRestoredFromLocal ? 'Stato ripristinato localmente.' : 'Stato salvato localmente.',
  );
  const skipNextPersistRef = useRef(false);

  const effectiveInputs = useMemo(
    () => getEffectiveInputs(inputs, unitModes, gramValues),
    [inputs, unitModes, gramValues],
  );
  const results = useMemo(() => calculateBread(effectiveInputs), [effectiveInputs]);
  const flourBreakdown = useMemo(
    () => calculateFlourBreakdown(effectiveInputs.flourTotal, flourMix),
    [effectiveInputs.flourTotal, flourMix],
  );

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
        selectedPresetId: selectedTimelinePresetId,
        steps: timelineSteps,
        timer,
      },
    };

    savePersistedState(stateToPersist);
    setLocalMemoryMessage('Stato salvato localmente.');
  }, [
    activeProfileId,
    ambientTemperature,
    customProfileName,
    flourMix,
    gramValues,
    inputs,
    selectedTimelinePresetId,
    timelineSteps,
    timer,
    unitModes,
  ]);

  useEffect(() => {
    saveArchive(archive);
  }, [archive]);

  const updateInput = (field: keyof BreadInputs, value: number) => {
    const safeValue = safeNumber(value);

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
    setSelectedTimelinePresetId(defaultState.selectedTimelinePresetId);
    setTimelineSteps(defaultState.timelineSteps);
    setTimer(defaultState.timer);
    setTimerRestoreNotice(null);
    setActiveProfileId(defaultState.activeProfileId);
    setCustomProfileName(defaultState.customProfileName);
    setLocalMemoryMessage('Memoria locale cancellata.');
  };

  const applyProfile = (profile: DoughProfile) => {
    const nextInputs = { ...inputs, ...profile.values };
    setActiveProfileId(profile.id);
    setCustomProfileName('Custom');
    setUnitModes(initialUnitModes);
    setInputs(nextInputs);
    setGramValues(getGramValues(nextInputs));
  };

  const selectCustomProfile = () => {
    setActiveProfileId('custom');
  };

  const updateFlourMix = (nextFlourMix: FlourMix) => {
    setFlourMix(nextFlourMix);
  };

  const updateAmbientTemperature = (value: AmbientTemperatureId) => {
    setAmbientTemperature(value);
  };

  const updateTimelineTimer = (nextTimer: TimerState) => {
    setTimerRestoreNotice(null);
    setTimer(nextTimer);
  };

  const clearLocalMemory = () => {
    reset();
  };

  const openArchiveTab = (tab: ArchiveTab) => {
    setActiveArchiveTab(tab);
    window.requestAnimationFrame(() => {
      document.getElementById('archive-local')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const createRecipeSnapshotFromCurrentPlanner = (name: string, notes: string): RecipeSnapshot => ({
    schemaVersion: 1,
    name,
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
    name,
    notes,
    activeProfileId,
    selectedPresetId: selectedTimelinePresetId,
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
    setTimelineSteps(cloneValue(snapshot.steps));
    setTimer(initialTimelineTimer);
    setTimerRestoreNotice(null);
  };

  const getRecipeSnapshotForJournal = (recipeId?: string) => {
    const savedRecipe = recipeId ? archive.recipes.find((recipe) => recipe.id === recipeId) : undefined;
    return savedRecipe ?? createRecipeSnapshotFromCurrentPlanner('Planner corrente', '');
  };

  const getTimelineSnapshotForJournal = (timelineId?: string) => {
    const savedTimeline = timelineId ? archive.timelines.find((timeline) => timeline.id === timelineId) : undefined;
    return savedTimeline ?? createTimelineSnapshotFromCurrentTimeline('Timeline corrente', '');
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
      title: title.trim() || recipeSnapshot.name || 'Sessione senza titolo',
      date: date || new Date().toISOString().slice(0, 10),
      sourceRecipeId,
      sourceTimelineId,
      ...snapshots,
      sessionData,
    };
  };

  const saveRecipeToArchive = (name: string, notes: string, associatedTimelineId?: string) => {
    const recipe = createSavedRecipe(name, notes, associatedTimelineId);
    setArchive((current) => addRecipe(current, recipe));
    setActiveRecipeId(recipe.id);
    setArchiveMessage(`Ricetta salvata: ${recipe.name}.`);
    openArchiveTab('recipes');
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
    openArchiveTab('recipes');
  };

  const saveRecipeAndTimelineToArchive = (name: string, notes: string) => {
    const timeline = createSavedTimeline(`${name || 'Ricetta'} timeline`, '');
    const recipe = createSavedRecipe(name, notes, timeline.id);
    setArchive((current) => addRecipe(addTimeline(current, timeline), recipe));
    setActiveRecipeId(recipe.id);
    setActiveTimelineId(timeline.id);
    setArchiveMessage(`Ricetta e timeline salvate: ${recipe.name}.`);
    openArchiveTab('recipes');
  };

  const loadRecipeFromArchive = (recipeId: string) => {
    const recipe = archive.recipes.find((item) => item.id === recipeId);
    if (!recipe) {
      return;
    }
    loadRecipeIntoPlanner(recipe);
    setActiveRecipeId(recipe.id);
    setArchiveMessage(`Ricetta caricata nel planner: ${recipe.name}.`);
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
    setArchiveMessage(`Timeline salvata: ${timeline.name}.`);
    openArchiveTab('timelines');
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
    setArchiveMessage(`Timeline aggiornata: ${updatedTimeline.name}.`);
    openArchiveTab('timelines');
  };

  const loadTimelineFromArchive = (timelineId: string) => {
    const timeline = archive.timelines.find((item) => item.id === timelineId);
    if (!timeline) {
      return;
    }
    loadTimelineIntoPlanner(timeline);
    setActiveTimelineId(timeline.id);
    setArchiveMessage(`Timeline caricata: ${timeline.name}.`);
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
    setArchiveMessage(`Sessione journal salvata: ${entry.title}.`);
    openArchiveTab('journal');
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
    setArchiveMessage(`Sessione creata da ricetta: ${recipe.name}.`);
    openArchiveTab('journal');
  };

  const createJournalFromTimeline = (timelineId: string, recipeId?: string) => {
    const timeline = archive.timelines.find((item) => item.id === timelineId);
    if (!timeline && timelineId) {
      return;
    }
    const recipe = recipeId ? archive.recipes.find((item) => item.id === recipeId) : undefined;
    const entry = createJournalEntryFromValues({
      title: recipe?.name ?? timeline?.name ?? 'Nuova sessione',
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
    setArchiveMessage('Sessione journal creata.');
    openArchiveTab('journal');
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
    setArchiveMessage(`Voce journal aggiornata: ${updatedEntry.title}.`);
  };

  const deleteJournalFromArchive = (entryId: string) => {
    const entry = archive.journal.find((item) => item.id === entryId);
    if (!entry || !window.confirm(`Eliminare la voce journal "${entry.title}"?`)) {
      return;
    }
    setArchive((current) => deleteJournalEntry(current, entryId));
    setArchiveMessage('Voce journal eliminata.');
  };

  const loadJournalSnapshotIntoPlanner = (entryId: string) => {
    const entry = archive.journal.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }
    loadRecipeIntoPlanner(entry.recipeSnapshot);
    loadTimelineIntoPlanner(entry.timelineSnapshot);
    setArchiveMessage(`Snapshot caricato nel planner: ${entry.title}.`);
  };

  const createNewTrialFromJournal = (entryId: string) => {
    const entry = archive.journal.find((item) => item.id === entryId);
    if (!entry) {
      return;
    }
    loadRecipeIntoPlanner(entry.recipeSnapshot);
    loadTimelineIntoPlanner(entry.timelineSnapshot);
    const newEntry = createJournalEntryFromValues({
      title: `${entry.title} nuova prova`,
      date: new Date().toISOString().slice(0, 10),
      status: 'draft',
      resultLabel: '',
      initialNotes: entry.sessionData.finalNotes,
      finalNotes: '',
      nextAdjustment: '',
      sourceRecipeId: entry.sourceRecipeId,
      sourceTimelineId: entry.sourceTimelineId,
    });
    setArchive((current) => addJournalEntry(current, newEntry));
    setArchiveMessage(`Nuova prova creata da: ${entry.title}.`);
    openArchiveTab('journal');
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
      <Header onReset={reset} />

      <div className="mx-auto flex w-full max-w-[1510px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[14px] border border-stone-200 bg-white/88 p-4 shadow-air backdrop-blur sm:p-5">
          <div className="mb-5">
            <h2 className="text-[30px] font-semibold tracking-normal text-ink">Planner</h2>
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
              onCustomProfileNameChange={setCustomProfileName}
            />

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
              <section className="rounded-[12px] border border-stone-200 bg-stone-50/55 p-4 sm:p-5">
                <div>
                  <h2 className="text-xl font-semibold text-ink">Pianificatore degli ingredienti</h2>
                  <p className="mt-1 text-sm leading-5 text-stone-600">
                    Imposta quantità, idratazione, starter e temperatura.
                  </p>
                </div>

                <FlourTotalForm
                  flourTotal={effectiveInputs.flourTotal}
                  flourMix={flourMix}
                  onChange={(value) => updateInput('flourTotal', value)}
                  onFlourMixChange={updateFlourMix}
                />

                <AmbientTemperatureSelector
                  value={ambientTemperature}
                  onChange={updateAmbientTemperature}
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
                />
                {results.hasNegativeAdditions && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-5 text-amber-900">
                    Controlla le percentuali: lo starter contiene più farina o acqua di quanta ne richieda
                    la formula.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <TimelinePlanner
          activeProfileId={activeProfileId}
          inputs={effectiveInputs}
          flourMix={flourMix}
          ambientTemperature={ambientTemperature}
          selectedPresetId={selectedTimelinePresetId}
          steps={timelineSteps}
          timer={timer}
          timerRestoreNotice={timerRestoreNotice}
          onSelectedPresetIdChange={setSelectedTimelinePresetId}
          onStepsChange={setTimelineSteps}
          onTimerChange={updateTimelineTimer}
          onSaveTimeline={() => openArchiveTab('timelines')}
          onStartJournalSession={() => openArchiveTab('journal')}
        />

        <ArchivePanel
          archive={archive}
          activeTab={activeArchiveTab}
          activeRecipeId={activeRecipeId}
          activeTimelineId={activeTimelineId}
          archiveMessage={archiveMessage}
          onTabChange={setActiveArchiveTab}
          onFocusRecipeSave={() => openArchiveTab('recipes')}
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

        <QuickGuidelines />

        <div className="flex flex-col items-center justify-center gap-3 text-center text-sm text-stone-500 sm:flex-row">
          <p>
            Le quantità sono calcolate con arrotondamento al grammo. {localMemoryMessage}
          </p>
          <button
            type="button"
            onClick={clearLocalMemory}
            className="min-h-9 rounded-lg border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-ink"
          >
            Cancella memoria locale
          </button>
        </div>
      </div>
    </main>
  );
}

function Header({ onReset }: { onReset: () => void }) {
  return (
    <header className="border-b border-stone-200 bg-white/88 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1510px] flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex items-center gap-4">
          <div className="grid h-11 w-14 place-items-center rounded-full border-2 border-amber-600/80 bg-amber-50 text-amber-700">
            <BreadIcon size={32} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <h1 className="text-[28px] font-semibold tracking-normal text-ink sm:text-[30px]">
            Bread Planner
          </h1>
        </div>

        <nav className="flex flex-wrap items-center gap-4 text-sm font-medium text-stone-700 sm:gap-7">
          <HeaderAction icon={<RotateCcw size={20} />} label="Ripristina" onClick={onReset} />
          <HeaderAction icon={<CircleHelp size={20} />} label="Guida" disabled />
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
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Disponibile in una prossima release' : undefined}
      className="inline-flex min-h-9 items-center gap-2 rounded-md px-1 text-stone-700 transition hover:text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 disabled:cursor-not-allowed disabled:text-stone-400 disabled:hover:text-stone-400"
    >
      {icon}
      <span>{label}</span>
    </button>
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
}: {
  activeProfileId: ActiveProfileId;
  customDisplayName: string;
  customProfileName: string;
  profiles: DoughProfile[];
  getProfileIcon: (profileId: string) => IconComponent;
  onSelectProfile: (profile: DoughProfile) => void;
  onSelectCustom: () => void;
  onCustomProfileNameChange: (value: string) => void;
}) {
  const profileCopy: Record<string, string> = {
    base: 'Equilibrato, semplice da gestire.',
    high: 'Più acqua, impasto più elastico.',
    focaccia: 'Impasto morbido, olio incluso.',
  };

  return (
    <section className="rounded-[12px] border border-stone-200 bg-white p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="text-xl font-semibold text-ink">Scegli il tuo impasto</h2>
        <p className="mt-1 text-sm leading-5 text-stone-600">
          Parti da un profilo e personalizza la ricetta.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {profiles.map((profile) => {
          const Icon = getProfileIcon(profile.id);
          const isSelected = activeProfileId === profile.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelectProfile(profile)}
              className={`flex min-h-[116px] flex-col items-start rounded-lg border p-3 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 ${
                isSelected
                  ? 'border-amber-600 bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-amber-300 hover:bg-amber-50/35'
              }`}
              aria-pressed={isSelected}
            >
              <span className={`grid h-9 w-9 place-items-center rounded-full ${
                isSelected ? 'bg-white text-amber-700 ring-1 ring-amber-200' : 'bg-stone-50 text-stone-700 ring-1 ring-stone-200'
              }`}>
                <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="mt-3 block text-base font-semibold text-ink">{profile.label}</span>
              <span className="mt-1 block text-sm leading-5 text-stone-500">
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
          className={`flex min-h-[116px] cursor-pointer flex-col items-start rounded-lg border p-3 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 ${
            isSelected
              ? 'border-amber-600 bg-amber-50 text-amber-800 ring-1 ring-amber-200'
              : 'border-stone-200 bg-white text-stone-700 hover:border-amber-300 hover:bg-amber-50/35'
          }`}
          aria-pressed={isSelected}
        >
          <span className={`grid h-9 w-9 place-items-center rounded-full ${
            isSelected ? 'bg-white text-amber-700 ring-1 ring-amber-200' : 'bg-stone-50 text-stone-700 ring-1 ring-stone-200'
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
                className="min-h-10 w-full min-w-0 rounded-lg border border-amber-200 bg-white px-3 text-base font-semibold text-ink outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
              />
            ) : (
              <span className="block text-base font-semibold">{customDisplayName}</span>
            )}
            <span className="mt-1 block text-sm leading-5 text-stone-500">Crea il tuo profilo.</span>
          </span>
        </div>
          );
        })()}
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
      step: 0.1,
      icon: Droplets,
    },
    {
      field: 'saltPercentage',
      label: 'Sale',
      unit: unitModes.saltPercentage,
      value: unitModes.saltPercentage === 'g' ? gramValues.saltPercentage : inputs.saltPercentage,
      step: unitModes.saltPercentage === 'g' ? 1 : 0.1,
      icon: SaltIcon,
      convertibleField: 'saltPercentage',
    },
    {
      field: 'starterPercentage',
      label: 'Starter',
      unit: unitModes.starterPercentage,
      value: unitModes.starterPercentage === 'g' ? gramValues.starterPercentage : inputs.starterPercentage,
      step: unitModes.starterPercentage === 'g' ? 1 : 0.1,
      icon: JarIcon,
      convertibleField: 'starterPercentage',
    },
    {
      field: 'starterHydration',
      label: 'Idratazione starter',
      unit: '%',
      value: inputs.starterHydration,
      step: 0.1,
      icon: Droplets,
    },
    {
      field: 'oilPercentage',
      label: 'Olio',
      unit: unitModes.oilPercentage,
      value: unitModes.oilPercentage === 'g' ? gramValues.oilPercentage : inputs.oilPercentage,
      step: unitModes.oilPercentage === 'g' ? 1 : 0.1,
      icon: OilIcon,
      convertibleField: 'oilPercentage',
    },
  ];

  return (
    <form className="mt-4 overflow-hidden rounded-lg border border-stone-200 bg-white" onSubmit={(event) => event.preventDefault()}>
      {fields.map((field) => (
        <NumberField
          key={field.field}
          label={field.label}
          unit={field.unit}
          value={field.value}
          step={field.step}
          icon={field.icon}
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
    <form className="mt-4 overflow-hidden rounded-lg border border-stone-200 bg-white" onSubmit={(event) => event.preventDefault()}>
      <NumberField
        label="Farina"
        unit="g"
        value={flourTotal}
        icon={Wheat}
        onChange={onChange}
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
        <div className="border-t border-stone-200 px-4 py-4">
          <button
            type="button"
            onClick={() => setIsFlourPanelOpen(true)}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
          >
            Modifica o crea mix
          </button>
        </div>
      )}
    </form>
  );
}

function NumberField({
  label,
  unit,
  value,
  step = 1,
  icon: Icon,
  convertibleField,
  onChange,
  onUnitChange,
}: {
  label: string;
  unit: InputUnit;
  value: number;
  step?: number;
  icon: IconComponent;
  convertibleField?: ConvertibleField;
  onChange: (value: number) => void;
  onUnitChange?: (unit: InputUnit) => void;
}) {
  const inputId = `field-${convertibleField ?? label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="grid gap-3 border-b border-stone-200 px-4 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(210px,260px)] sm:items-center">
      <label htmlFor={inputId} className="flex min-w-0 items-center gap-4 text-base font-semibold text-ink">
        <Icon size={25} strokeWidth={1.85} className="shrink-0 text-stone-900" aria-hidden="true" />
        <span className="min-w-0">{label}</span>
      </label>
      <span className="flex min-h-12 overflow-hidden rounded-lg border border-stone-300 bg-white focus-within:border-amber-500 focus-within:ring-4 focus-within:ring-amber-100">
        <input
          id={inputId}
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber || 0)}
          className="w-full min-w-0 bg-transparent px-3 text-[22px] font-medium text-ink outline-none"
        />
        {onUnitChange ? (
          <span className="flex items-center gap-1 border-l border-stone-200 bg-stone-50 p-1">
            {(['%', 'g'] as InputUnit[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onUnitChange(option)}
                className={`grid h-9 min-w-9 place-items-center rounded-md px-2 text-sm font-semibold transition ${
                  unit === option
                    ? 'bg-white text-amber-700 shadow-sm ring-1 ring-stone-200'
                    : 'text-stone-500 hover:text-ink'
                }`}
                aria-pressed={unit === option}
              >
                {option}
              </button>
            ))}
          </span>
        ) : (
          <span className="grid w-12 place-items-center border-l border-stone-200 bg-stone-50 text-base font-medium text-stone-700">
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
}: {
  results: ReturnType<typeof calculateBread>;
  flourBreakdown: FlourBreakdownRow[];
  onSaveRecipe: () => void;
}) {
  const hasFlourMix = flourBreakdown.length > 1;
  const hasOil = results.oil !== 0;

  return (
    <aside className="rounded-[12px] border border-stone-200 border-l-[5px] border-l-proof-600 bg-white p-4 shadow-air sm:p-5">
      <div className="mb-4">
        <h2 className="text-[22px] font-semibold text-ink">Ingredienti da pesare</h2>
        <p className="mt-1 text-sm leading-5 text-stone-600">Usa questi valori durante la preparazione.</p>
      </div>

      <div className="grid gap-3 border-t border-stone-200 pt-4">
        <div className="grid gap-2">
          <WeighRow label="Farina" value={results.flourTotal} />
          {hasFlourMix && (
            <div className="grid gap-1 rounded-lg bg-stone-50 px-3 py-2">
              {flourBreakdown.map((row) => (
                <div key={row.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate text-stone-600">{row.label}</span>
                  <span className="whitespace-nowrap font-semibold text-stone-800">{formatGram(row.grams)}</span>
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

      <div className="my-3 flex items-baseline justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
        <div className="text-sm font-semibold text-stone-600">Peso impasto stimato</div>
        <div className="text-xl font-semibold leading-none text-ink">
          {formatGram(results.estimatedDoughWeight)}
        </div>
      </div>

      <button
        type="button"
        onClick={onSaveRecipe}
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100"
      >
        Salva ricetta
      </button>
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
      <span className={`text-sm leading-5 ${subtle ? 'text-stone-500' : 'text-stone-600'}`}>
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
      text: 'Non superare 2,2% sulla farina per non rallentare la lievitazione.',
      icon: BowlIcon,
    },
    {
      title: 'Pianifica',
      text: 'Fermentazioni lente in frigo migliorano aroma e digeribilità.',
      icon: CalendarDays,
    },
  ];

  return (
    <section className="rounded-[12px] border border-stone-200 bg-white/88 p-5 shadow-air">
      <div className="mb-5 flex items-center gap-3 text-[22px] font-semibold text-ink">
        <span className="text-amber-700">
          <BulbIcon size={28} strokeWidth={1.75} aria-hidden="true" />
        </span>
        Linee guida rapide
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {guidelines.map((guideline) => {
          const Icon = guideline.icon;
          return (
            <article key={guideline.title} className="flex gap-4 border-stone-200 xl:border-l xl:pl-5 first:border-l-0 first:pl-0">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-100">
                <Icon size={28} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-ink">{guideline.title}</h2>
                <p className="mt-2 text-sm leading-5 text-stone-600">{guideline.text}</p>
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
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M5 21.5c0-6.2 4.3-10.7 9.5-10.7 1.7-3.9 7-4.4 9.2-.9 3.2.5 5.3 3.3 5.3 6.7 0 4.2-3.1 7.4-7.5 7.4H8.4C6.5 24 5 22.9 5 21.5Z" />
      <path d="M14.7 11.1c-.6 1.3-.9 2.7-.7 4.1" />
      <path d="M21.1 9.4c.6 1.4.7 3 .2 4.5" />
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
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export default App;
