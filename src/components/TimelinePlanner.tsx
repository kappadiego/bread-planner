import {
  CirclePlus,
  GripVertical,
  Info,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Trash2,
} from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AmbientTemperatureId } from '../ambientTemperature';
import type { BreadInputs } from '../calculations';
import { cloneTimelineSteps } from '../defaults';
import type { FlourMix } from '../flours';
import { AmbientTemperatureSelector } from './AmbientTemperatureSelector';
import {
  createCustomTimelineStep,
  createTimelineStep,
  predefinedTimelineStepTypes,
  timelinePresets,
  timelineStepDefinitions,
  type TimelineStep,
  type TimelineStepType,
} from '../timeline';
import { buildSuggestedTimeline } from '../timelineSuggestions';
import {
  getCurrentStepInfo,
  getElapsedMs,
  getTotalDurationMs,
  initialTimer,
  safeDuration,
  type TimerState,
} from '../timelineUtils';
import {
  buildBackwardTimelinePlan,
  formatStepScheduleRange,
  type TimelinePlanningState,
} from '../timelinePlanning';

type TimelinePlannerProps = {
  activeProfileId: string;
  inputs: BreadInputs;
  flourMix: FlourMix;
  ambientTemperature: AmbientTemperatureId;
  selectedPresetId: string;
  steps: TimelineStep[];
  timer: TimerState;
  planning: TimelinePlanningState;
  timerRestoreNotice: string | null;
  onSelectedPresetIdChange: (presetId: string) => void;
  onStepsChange: (steps: TimelineStep[]) => void;
  onTimerChange: (timer: TimerState) => void;
  onPlanningChange: (planning: TimelinePlanningState) => void;
  onAmbientTemperatureChange: (value: AmbientTemperatureId) => void;
  onOpenTimelines?: () => void;
  onSaveTimeline?: () => void;
  onStartTimelineNow?: (timer: TimerState) => void;
  onProgramTimeline?: (planning: TimelinePlanningState) => void;
};

const formatDigitalDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
};

const formatStartCountdown = (ms: number) => {
  const safeMs = Math.max(0, ms);
  const dayMs = 24 * 60 * 60 * 1000;
  const weekMs = 7 * dayMs;

  if (safeMs < dayMs) {
    return formatDigitalDuration(safeMs);
  }

  if (safeMs < weekMs) {
    const days = Math.ceil(safeMs / dayMs);
    return `+${days} ${days === 1 ? 'giorno' : 'giorni'}`;
  }

  const weeks = Math.ceil(safeMs / weekMs);
  return `+${weeks} ${weeks === 1 ? 'settimana' : 'settimane'}`;
};

const formatHumanMinutes = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${remainingMinutes}m`;
};

const formatHumanDuration = (ms: number) => formatHumanMinutes(Math.round(ms / 60000));

const formatDelta = (deltaMinutes: number) => {
  if (deltaMinutes > 0) {
    return `+${deltaMinutes} min`;
  }
  if (deltaMinutes < 0) {
    return `${deltaMinutes} min`;
  }
  return 'controlla';
};

const getPresetShortDescription = (presetId: string, fallback: string) => {
  const descriptions: Record<string, string> = {
    'basic-same-day': 'Riposo iniziale e fermentazione in massa.',
    'high-hydration': 'Pieghe ravvicinate per dare struttura.',
    focaccia: 'Step semplici per lievitazione in teglia.',
    'long-fermentation': 'Poche pieghe, maturazione lenta.',
    custom: 'Costruisci il tuo piano liberamente.',
  };
  return descriptions[presetId] ?? fallback;
};

const clampDuration = (value: number, step: TimelineStep) => {
  const min = typeof step.minDurationMinutes === 'number' ? step.minDurationMinutes : 0;
  const max = typeof step.maxDurationMinutes === 'number' ? step.maxDurationMinutes : 1440;
  return Math.min(max, Math.max(min, safeDuration(value)));
};

export function TimelinePlanner({
  activeProfileId,
  inputs,
  flourMix,
  ambientTemperature,
  selectedPresetId,
  steps,
  timer,
  planning,
  timerRestoreNotice,
  onSelectedPresetIdChange,
  onStepsChange,
  onTimerChange,
  onPlanningChange,
  onAmbientTemperatureChange,
  onOpenTimelines,
  onSaveTimeline,
  onStartTimelineNow,
  onProgramTimeline,
}: TimelinePlannerProps) {
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [appliedSuggestionPresetId, setAppliedSuggestionPresetId] = useState<string | null>(null);
  const [isProgramOpen, setIsProgramOpen] = useState(false);
  const draggingStepIdRef = useRef<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const selectedPreset = useMemo(
    () => timelinePresets.find((preset) => preset.id === selectedPresetId) ?? timelinePresets[0],
    [selectedPresetId],
  );
  const totalDurationMs = useMemo(() => getTotalDurationMs(steps), [steps]);
  const elapsedMs = Math.min(getElapsedMs(timer), totalDurationMs);
  const currentStepInfo = getCurrentStepInfo(steps, elapsedMs);
  const progressPercentage =
    totalDurationMs > 0 ? Math.min(100, Math.round((elapsedMs / totalDurationMs) * 100)) : 0;
  const nextStep = currentStepInfo ? steps[currentStepInfo.index + 1] : null;
  const canStart = steps.length > 0 && totalDurationMs > 0;
  const suggestedTimeline = useMemo(
    () => buildSuggestedTimeline({
      activeProfileId,
      inputs,
      flourMix,
      ambientTemperature,
      selectedPresetId,
      steps,
    }),
    [activeProfileId, ambientTemperature, flourMix, inputs, selectedPresetId, steps],
  );
  const recommendedPreset = useMemo(
    () => timelinePresets.find((preset) => preset.id === suggestedTimeline.recommendedPresetId) ?? timelinePresets[0],
    [suggestedTimeline.recommendedPresetId],
  );
  const recommendationNotes = useMemo(
    () => [
      ...suggestedTimeline.reasons,
      ...suggestedTimeline.warnings,
      ...suggestedTimeline.steps.flatMap((item) => item.reasons),
    ]
      .filter((value, index, list) => list.indexOf(value) === index)
      .slice(0, 6),
    [suggestedTimeline],
  );
  const recommendationSummary = useMemo(() => recommendationNotes.slice(0, 2), [recommendationNotes]);
  const isSuggestionApplied =
    appliedSuggestionPresetId === suggestedTimeline.recommendedPresetId &&
    selectedPresetId === suggestedTimeline.recommendedPresetId;
  const recommendationCopy =
    suggestedTimeline.confidence === 'high' ? `Profilo suggerito: ${recommendedPreset.label}` : '';
  const suggestedStepById = useMemo(() => {
    const map = new Map<string, (typeof suggestedTimeline.steps)[number]>();
    suggestedTimeline.steps.forEach((item) => map.set(item.step.id, item));
    return map;
  }, [suggestedTimeline.steps]);
  const planningNow = useMemo(() => new Date(nowTick), [nowTick]);
  const backwardPlan = useMemo(
    () => buildBackwardTimelinePlan({
      steps,
      targetEndDate: planning.targetEndDate,
      targetEndTime: planning.targetEndTime,
      now: planningNow,
    }),
    [planning.targetEndDate, planning.targetEndTime, planningNow, steps],
  );
  const stepScheduleById = useMemo(() => {
    const map = new Map<string, (typeof backwardPlan.stepSchedule)[number]>();
    backwardPlan.stepSchedule.forEach((item) => map.set(item.stepId, item));
    return map;
  }, [backwardPlan.stepSchedule]);
  const isBackwardPlanning = planning.mode === 'backward';
  const isTimerActive = timer.status === 'running' || timer.status === 'paused' || timer.status === 'finished';
  const startCountdownMs = backwardPlan.startAt ? backwardPlan.startAt.getTime() - planningNow.getTime() : null;
  const showProgramCountdown = isBackwardPlanning && !isTimerActive;
  const timerMainLabel = showProgramCountdown ? 'Inizia tra' : 'Manca ancora';
  const timerMainValue = (() => {
    if (!showProgramCountdown) {
      return formatDigitalDuration(currentStepInfo?.remainingInStepMs ?? 0);
    }
    if (!planning.targetEndDate || !planning.targetEndTime || !backwardPlan.startAt || startCountdownMs === null) {
      return 'Imposta giorno e ora';
    }
    if (startCountdownMs <= 0) {
      return 'Dovevi iniziare prima';
    }
    return formatStartCountdown(startCountdownMs);
  })();
  const isTimerMainText = showProgramCountdown && (
    timerMainValue === 'Imposta giorno e ora' ||
    timerMainValue === 'Dovevi iniziare prima'
  );

  useEffect(() => {
    if (timer.status !== 'running') {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timer.status]);

  useEffect(() => {
    if (planning.mode !== 'backward' || timer.status === 'running') {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [planning.mode, timer.status]);

  useEffect(() => {
    if (timer.status === 'running' && totalDurationMs > 0 && getElapsedMs(timer) >= totalDurationMs) {
      onTimerChange({ ...timer, status: 'finished', pausedAt: null });
    }
  }, [onTimerChange, timer, totalDurationMs]);

  const resetTimer = () => onTimerChange(initialTimer);
  const openProgram = () => {
    setIsProgramOpen(true);
    const nextPlanning: TimelinePlanningState = planning.mode !== 'backward' ? { ...planning, mode: 'backward' } : planning;
    if (planning.mode !== 'backward') {
      onPlanningChange(nextPlanning);
    }
    onProgramTimeline?.(nextPlanning);
  };

  const buildPresetSteps = (presetId: string) => {
    const preset = timelinePresets.find((item) => item.id === presetId) ?? timelinePresets[0];
    const suggestion = buildSuggestedTimeline({
      activeProfileId,
      inputs,
      flourMix,
      ambientTemperature,
      selectedPresetId: preset.id,
      steps: cloneTimelineSteps(preset.steps),
    });
    return suggestion.steps.map((item) => ({
      ...item.step,
      durationMinutes: item.suggestedDurationMinutes,
    }));
  };

  const applyPreset = (presetId: string) => {
    const preset = timelinePresets.find((item) => item.id === presetId) ?? timelinePresets[0];
    setAppliedSuggestionPresetId(null);
    onSelectedPresetIdChange(preset.id);
    onStepsChange(buildPresetSteps(preset.id));
    resetTimer();
  };

  const restoreSelectedPreset = () => {
    setAppliedSuggestionPresetId(null);
    onStepsChange(buildPresetSteps(selectedPreset.id));
    resetTimer();
  };

  const applySuggestedTimeline = () => {
    setAppliedSuggestionPresetId(suggestedTimeline.recommendedPresetId);
    onSelectedPresetIdChange(suggestedTimeline.recommendedPresetId);
    onStepsChange(buildPresetSteps(suggestedTimeline.recommendedPresetId));
    resetTimer();
  };

  const updateStep = (stepId: string, patch: Partial<Pick<TimelineStep, 'label' | 'durationMinutes' | 'note'>>) => {
    onStepsChange(steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)));
    resetTimer();
  };

  const changeStepType = (stepId: string, type: TimelineStepType) => {
    onStepsChange(steps.map((step) => {
      if (step.id !== stepId) {
        return step;
      }
      if (type === 'custom') {
        return createCustomTimelineStep(step.id);
      }
      return createTimelineStep(type, step.id);
    }));
    resetTimer();
  };

  const addStep = () => {
    onStepsChange([
      ...steps,
      createCustomTimelineStep(`custom-${Date.now()}`),
    ]);
    resetTimer();
  };

  const deleteStep = (stepId: string) => {
    onStepsChange(steps.filter((step) => step.id !== stepId));
    resetTimer();
  };

  const moveStep = (fromStepId: string, toStepId: string) => {
    const fromIndex = steps.findIndex((step) => step.id === fromStepId);
    const toIndex = steps.findIndex((step) => step.id === toStepId);

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }

    const next = [...steps];
    const [movedStep] = next.splice(fromIndex, 1);
    if (!movedStep) {
      return;
    }
    next.splice(toIndex, 0, movedStep);
    onStepsChange(next);
  };

  const startStepDrag = (stepId: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingStepIdRef.current = stepId;
    setDraggingStepId(stepId);

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      pointerEvent.preventDefault();
      const targetRow = document
        .elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)
        ?.closest<HTMLElement>('[data-step-id]');
      const targetStepId = targetRow?.dataset.stepId;
      const currentDraggingStepId = draggingStepIdRef.current;

      if (!targetStepId || !currentDraggingStepId || targetStepId === currentDraggingStepId) {
        return;
      }

      moveStep(currentDraggingStepId, targetStepId);
    };

    const finishDrag = () => {
      draggingStepIdRef.current = null;
      setDraggingStepId(null);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
  };

  const startNow = () => {
    setIsProgramOpen(false);
    if (planning.mode !== 'now') {
      onPlanningChange({ ...planning, mode: 'now' });
    }
    if (!canStart) {
      return;
    }

    const nextTimer: TimerState = {
      status: 'running',
      startedAt: Date.now(),
      pausedAt: null,
      accumulatedPauseMs: 0,
    };
    onTimerChange(nextTimer);
    onStartTimelineNow?.(nextTimer);
  };

  const pause = () => {
    if (timer.status === 'running') {
      onTimerChange({ ...timer, status: 'paused', pausedAt: Date.now() });
    }
  };

  const resume = () => {
    if (timer.status !== 'paused' || timer.pausedAt === null) {
      return;
    }

    onTimerChange({
      ...timer,
      status: 'running',
      accumulatedPauseMs: timer.accumulatedPauseMs + Date.now() - timer.pausedAt,
      pausedAt: null,
    });
  };

  const skipCurrentStep = () => {
    if (!currentStepInfo || timer.startedAt === null) {
      return;
    }

    const targetElapsed = Math.min(currentStepInfo.stepEndMs, totalDurationMs);
    const baseNow = timer.status === 'paused' && timer.pausedAt !== null ? timer.pausedAt : Date.now();

    onTimerChange({
      ...timer,
      status: targetElapsed >= totalDurationMs ? 'finished' : timer.status,
      startedAt: baseNow - targetElapsed - timer.accumulatedPauseMs,
      pausedAt: timer.status === 'paused' ? baseNow : null,
    });
  };

  return (
    <section className="grid gap-5">
      <div className="mb-5">
        <h2 className="font-display text-[24px] font-semibold text-ink">Scegli il piano di lavorazione</h2>
      </div>

      <div className="grid gap-6">
        <div className="rounded-[18px] border border-[#322e2b14] bg-[#fffdf8] p-4 shadow-inner-soft">
          {timerRestoreNotice && (
            <p className="mb-4 rounded-2xl bg-proof-50 px-4 py-3 text-sm font-medium text-proof-700 ring-1 ring-proof-100">
              {timerRestoreNotice}
            </p>
          )}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-ink">Piani disponibili</h3>
              <p className="mt-1 text-sm leading-5 text-[#6f6257]">
                Parti da una timeline e adattala ai tuoi tempi.
              </p>
            </div>
            <button
              type="button"
              onClick={restoreSelectedPreset}
              className="text-left text-sm font-semibold text-[#6f6257] underline-offset-4 transition hover:text-crust hover:underline focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(178,104,55,0.18)] sm:text-right"
            >
              Ripristina preset
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {timelinePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={`min-h-[92px] rounded-2xl border px-3 py-3 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(178,104,55,0.18)] ${
                  selectedPresetId === preset.id
                    ? 'border-crust/65 bg-cream text-ink ring-2 ring-crust/15'
                    : 'border-[#322e2b18] bg-white text-[#6f6257] hover:border-crust/35 hover:bg-cream/30'
                }`}
                aria-pressed={selectedPresetId === preset.id}
              >
                <span className="block text-sm font-semibold">{preset.label}</span>
                <span className="mt-1 block text-xs leading-5 text-[#6f6257]">
                  {getPresetShortDescription(preset.id, preset.description)}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={onOpenTimelines ?? onSaveTimeline}
              className="min-h-[92px] rounded-2xl border border-dashed border-[#322e2b2e] bg-cream/30 px-3 py-3 text-left text-[#6f6257] transition hover:border-crust/40 hover:bg-cream/55 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(178,104,55,0.18)]"
            >
              <span className="block text-sm font-semibold text-ink">Carica timeline</span>
              <span className="mt-1 block text-xs leading-5 text-[#6f6257]">
                Usa una timeline salvata.
              </span>
              <span className="mt-2 inline-flex min-h-7 items-center rounded-full border border-crust/25 bg-white px-2.5 text-xs font-semibold text-crust">
                Carica
              </span>
            </button>
          </div>

          <section className="mt-3 rounded-2xl border border-wheat-200 bg-wheat-50/70 px-3 py-2">
            {isSuggestionApplied ? (
              <p className="text-sm font-semibold leading-5 text-ink">
                Proposta applicata: {recommendedPreset.label}. Puoi modificare gli step qui sotto.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Timeline consigliata</h3>
                    {recommendationCopy && (
                      <p className="text-sm leading-5 text-[#6f6257]">{recommendationCopy}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={applySuggestedTimeline}
                    className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-full border border-crust/25 bg-white px-3 text-sm font-semibold text-crust transition hover:border-crust/45 hover:bg-cream"
                  >
                    Applica proposta
                  </button>
                </div>
                {recommendationSummary.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-5 text-[#6f6257]">
                    {recommendationSummary.map((note) => (
                      <p key={note}>{note}</p>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[18px] border border-[#322e2b14] bg-[#fffdf8] p-4">
          <AmbientTemperatureSelector
            value={ambientTemperature}
            onChange={onAmbientTemperatureChange}
            description="La temperatura aiuta a interpretare i tempi della fermentazione."
          />
          <p className="mt-2 text-sm leading-5 text-[#6f6257]">
            A temperature più alte l'impasto può maturare più velocemente.
          </p>

          <div className="mt-5 space-y-3">
            {steps.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#322e2b2e] bg-cream/30 px-4 py-8 text-center text-sm text-[#6f6257]">
                Nessuno step nella timeline. Aggiungi uno step per avviare il timer.
              </div>
            ) : (
              steps.map((step, index) => {
                const suggestion = suggestedStepById.get(step.id);
                const schedule = stepScheduleById.get(step.id);
                const hasDelta = suggestion ? suggestion.deltaMinutes !== 0 : false;
                const hasReasons = suggestion ? suggestion.reasons.length > 0 : false;
                return (
                  <div
                    key={step.id}
                    data-step-id={step.id}
                    className={`grid gap-3 rounded-[18px] border border-[#322e2b14] bg-cream/28 p-3 transition lg:grid-cols-[72px_minmax(190px,0.95fr)_minmax(0,1fr)_118px_40px] lg:items-start ${
                      draggingStepId === step.id ? 'scale-[0.99] border-crust/40 bg-cream shadow-sm' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 lg:pt-1">
                      <button
                        type="button"
                        onPointerDown={(event) => startStepDrag(step.id, event)}
                        className="grid h-9 w-8 touch-none place-items-center rounded-xl border border-[#322e2b18] bg-white text-[#6f6257] transition hover:border-crust/35 hover:bg-cream/50 hover:text-crust active:cursor-grabbing"
                        aria-label={`Sposta ${step.label}`}
                      >
                        <GripVertical size={18} aria-hidden="true" />
                      </button>
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-sm font-semibold text-crust ring-1 ring-crust/20">
                        {index + 1}
                      </span>
                    </div>

                    <label className="grid gap-2">
                      <span className="sr-only">Step</span>
                      <select
                        aria-label={`Tipo step ${index + 1}`}
                        value={step.type}
                        onChange={(event) => changeStepType(step.id, event.currentTarget.value as TimelineStepType)}
                        className="min-h-11 rounded-2xl border border-[#322e2b24] bg-white px-3 text-base font-medium normal-case tracking-normal text-ink outline-none focus:border-crust focus:ring-4 focus:ring-[rgba(178,104,55,0.18)]"
                      >
                        {predefinedTimelineStepTypes.map((type) => (
                          <option key={type} value={type}>{timelineStepDefinitions[type].label}</option>
                        ))}
                        <option value="custom">Step custom</option>
                      </select>
                      {step.isLabelEditable && (
                        <input
                          type="text"
                          aria-label="Nome step custom"
                          value={step.label}
                          onChange={(event) => updateStep(step.id, { label: event.currentTarget.value })}
                          className="min-h-10 rounded-2xl border border-[#322e2b24] bg-white px-3 text-sm font-medium normal-case tracking-normal text-ink outline-none focus:border-crust focus:ring-4 focus:ring-[rgba(178,104,55,0.18)]"
                        />
                      )}
                    </label>

                    <div className="grid gap-2">
                      <div className="min-h-11 px-1 py-1 text-sm text-[#6f6257]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8d8176]">Durata</span>
                          <span className="font-semibold text-ink">
                            {suggestion ? formatHumanMinutes(suggestion.suggestedDurationMinutes) : formatHumanMinutes(step.durationMinutes)}
                          </span>
                          {suggestion && (hasDelta || hasReasons) && (
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              suggestion.level === 'shorter'
                                ? 'bg-proof-50 text-proof-700'
                                : suggestion.level === 'longer'
                                  ? 'bg-wheat-100 text-ink'
                                  : 'bg-cream text-[#6f6257]'
                            }`}>
                              {hasDelta ? formatDelta(suggestion.deltaMinutes) : 'controlla prima'}
                            </span>
                          )}
                        </div>
                        {step.description && (
                          <p className="mt-1 text-xs leading-5 text-[#6f6257]">{step.description}</p>
                        )}
                        {suggestion && hasReasons && (
                          <details className="mt-2">
                            <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-crust focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(178,104,55,0.18)]">
                              <Info size={14} aria-hidden="true" />
                              Perché questo step?
                            </summary>
                            <div className="mt-1 grid gap-1 text-xs leading-5 text-[#6f6257]">
                              {suggestion.reasons.map((reason) => (
                                <p key={reason}>{reason}</p>
                              ))}
                            </div>
                          </details>
                        )}
                        {isBackwardPlanning && schedule && (
                          <p className="mt-2 rounded-full bg-white px-2 py-1 text-xs font-medium leading-5 text-[#6f6257] ring-1 ring-[#322e2b14]">
                            {formatStepScheduleRange(schedule.startAt, schedule.endAt, planningNow)} · {formatHumanMinutes(schedule.durationMinutes)}
                          </p>
                        )}
                      </div>
                      {step.isCustom && (
                        <textarea
                          aria-label="Nota step custom"
                          value={step.note ?? ''}
                          onChange={(event) => updateStep(step.id, { note: event.currentTarget.value })}
                          rows={2}
                          placeholder="Nota personale"
                          className="rounded-2xl border border-[#322e2b24] bg-white px-3 py-2 text-sm text-ink outline-none focus:border-crust focus:ring-4 focus:ring-[rgba(178,104,55,0.18)]"
                        />
                      )}
                    </div>

                    <label className="grid gap-2">
                      <span className="sr-only">Minuti</span>
                      <span className="flex min-h-11 overflow-hidden rounded-2xl border border-[#322e2b24] bg-white focus-within:border-crust focus-within:ring-4 focus-within:ring-[rgba(178,104,55,0.18)]">
                        <input
                          aria-label={`Durata in minuti per ${step.label}`}
                          type="number"
                          min={step.minDurationMinutes ?? 0}
                          max={step.maxDurationMinutes ?? undefined}
                          step={step.durationStepMinutes}
                          value={step.durationMinutes}
                          disabled={!step.isDurationEditable}
                          onChange={(event) =>
                            updateStep(step.id, { durationMinutes: clampDuration(event.currentTarget.valueAsNumber || 0, step) })
                          }
                          className="min-w-0 flex-1 bg-transparent px-3 text-base font-medium normal-case tracking-normal text-ink outline-none disabled:bg-cream/60 disabled:text-[#8d8176]"
                        />
                        <span className="grid w-11 place-items-center border-l border-[#322e2b14] bg-cream/35 text-sm font-semibold text-[#6f6257]">
                          min
                        </span>
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => deleteStep(step.id)}
                      className="grid h-10 w-10 place-items-center rounded-xl border border-[#322e2b18] bg-white text-[#6f6257] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Elimina ${step.label}`}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={addStep}
            className="mt-7 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-crust/25 bg-cream px-4 text-sm font-semibold text-crust transition hover:border-crust/45 hover:bg-wheat-50"
          >
            <CirclePlus size={18} aria-hidden="true" />
            Aggiungi step custom
          </button>
          </div>

        <aside className="rounded-[20px] border border-[#322e2b14] border-l-[6px] border-l-crust bg-[#fffdf8] p-5 shadow-air xl:sticky xl:top-6 xl:self-start">
          <div className="mb-4">
            <h3 className="text-[22px] font-semibold text-ink">Timer</h3>
            <div className="mt-3 text-sm font-medium text-[#6f6257]">Ora sei in</div>
            <div className="mt-1 text-[20px] font-semibold leading-6 text-ink">
              {timer.status === 'finished'
                ? 'Timeline completata'
                : currentStepInfo?.step.label ?? 'Pronta per partire'}
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl bg-cream/38 p-3">
            <div>
              <div className="text-sm font-medium text-[#6f6257]">{timerMainLabel}</div>
              <div className={`mt-1 font-semibold leading-none text-ink ${
                isTimerMainText ? 'text-[19px] leading-6' : 'font-mono text-[28px]'
              }`}>
                {timerMainValue}
              </div>
            </div>
            <div className="border-b border-[#322e2b14] pb-3">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-medium text-[#6f6257]">Prossimo step</span>
                <span className="text-right text-base font-semibold text-ink">{nextStep?.label ?? 'Nessun prossimo step'}</span>
              </div>
              <button
                type="button"
                onClick={skipCurrentStep}
                disabled={!currentStepInfo || timer.status === 'idle' || timer.status === 'finished'}
                className="mt-2 inline-flex min-h-8 items-center justify-center gap-1 rounded-full border border-[#322e2b18] bg-white px-2 text-xs font-semibold text-[#6f6257] transition hover:border-crust/35 hover:bg-cream/50 hover:text-crust disabled:cursor-not-allowed disabled:opacity-45"
              >
                <SkipForward size={14} aria-hidden="true" />
                Passa al prossimo step
              </button>
            </div>
            <Metric label="In tutto manca" value={`${formatHumanDuration(elapsedMs)} / ${formatHumanDuration(totalDurationMs)}`} />
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-[#6f6257]">
              <span>Avanzamento</span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-cream">
              <div
                className="h-full rounded-full bg-crust transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {timer.status === 'running' ? (
              <button type="button" onClick={pause} className="timeline-primary">
                <Pause size={18} aria-hidden="true" />
                Pausa
              </button>
            ) : timer.status === 'paused' ? (
              <button type="button" onClick={resume} className="timeline-primary">
                <Play size={18} aria-hidden="true" />
                Riprendi
              </button>
            ) : (
              <button type="button" onClick={startNow} disabled={!canStart} className="timeline-primary whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-45">
                <Play size={18} aria-hidden="true" />
                Inizia subito
              </button>
            )}

            <button
              type="button"
              onClick={openProgram}
              className={`timeline-secondary ${
                isProgramOpen ? 'border-crust/35 bg-cream text-crust' : ''
              }`}
              aria-pressed={isProgramOpen}
            >
              Programma
            </button>
            <button type="button" onClick={resetTimer} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-transparent px-3 text-sm font-semibold text-[#6f6257] transition hover:border-[#322e2b18] hover:bg-cream/40 hover:text-ink sm:col-span-2">
              <RotateCcw size={18} aria-hidden="true" />
              Reset
            </button>
          </div>

          {isProgramOpen && (
            <TimelinePlanningCard
              planning={planning}
              onChange={onPlanningChange}
            />
          )}

          {onSaveTimeline && (
            <button
              type="button"
              onClick={onSaveTimeline}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-crust/25 bg-cream px-4 text-sm font-semibold text-crust transition hover:border-crust/45 hover:bg-wheat-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(178,104,55,0.18)]"
            >
              Salva il piano
            </button>
          )}
        </aside>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#322e2b14] pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm font-medium text-[#6f6257]">{label}</span>
      <span className="text-right text-base font-semibold text-ink">{value}</span>
    </div>
  );
}

function TimelinePlanningCard({
  planning,
  onChange,
}: {
  planning: TimelinePlanningState;
  onChange: (planning: TimelinePlanningState) => void;
}) {
  const updatePlanningField = (field: keyof Pick<TimelinePlanningState, 'targetEndDate' | 'targetEndTime'>, value: string) => {
    onChange({ ...planning, [field]: value });
  };

  return (
    <section className="mt-5 rounded-2xl border border-[#322e2b14] bg-cream/35 p-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Giorno
          <input
            type="date"
            value={planning.targetEndDate}
            onChange={(event) => updatePlanningField('targetEndDate', event.currentTarget.value)}
            className="min-h-10 rounded-2xl border border-[#322e2b24] bg-white px-3 text-sm font-medium text-ink outline-none focus:border-crust focus:ring-4 focus:ring-[rgba(178,104,55,0.18)]"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-ink">
          Ora
          <input
            type="time"
            value={planning.targetEndTime}
            onChange={(event) => updatePlanningField('targetEndTime', event.currentTarget.value)}
            className="min-h-10 rounded-2xl border border-[#322e2b24] bg-white px-3 text-sm font-medium text-ink outline-none focus:border-crust focus:ring-4 focus:ring-[rgba(178,104,55,0.18)]"
          />
        </label>
      </div>
    </section>
  );
}
