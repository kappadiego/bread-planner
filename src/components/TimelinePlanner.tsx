import {
  CirclePlus,
  GripVertical,
  Info,
  ListRestart,
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
  formatDuration,
  getCurrentStepInfo,
  getElapsedMs,
  getTotalDurationMs,
  initialTimer,
  safeDuration,
  type TimerState,
} from '../timelineUtils';

type TimelinePlannerProps = {
  activeProfileId: string;
  inputs: BreadInputs;
  flourMix: FlourMix;
  ambientTemperature: AmbientTemperatureId;
  selectedPresetId: string;
  steps: TimelineStep[];
  timer: TimerState;
  timerRestoreNotice: string | null;
  onSelectedPresetIdChange: (presetId: string) => void;
  onStepsChange: (steps: TimelineStep[]) => void;
  onTimerChange: (timer: TimerState) => void;
};

const formatMinuteDuration = (minutes: number) => formatDuration(minutes * 60 * 1000).replace(' 00s', '');

const formatDelta = (deltaMinutes: number) => {
  if (deltaMinutes > 0) {
    return `+${deltaMinutes} min`;
  }
  if (deltaMinutes < 0) {
    return `${deltaMinutes} min`;
  }
  return 'controlla';
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
  timerRestoreNotice,
  onSelectedPresetIdChange,
  onStepsChange,
  onTimerChange,
}: TimelinePlannerProps) {
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const draggingStepIdRef = useRef<string | null>(null);
  const [, setNowTick] = useState(0);

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
  const suggestedStepById = useMemo(() => {
    const map = new Map<string, (typeof suggestedTimeline.steps)[number]>();
    suggestedTimeline.steps.forEach((item) => map.set(item.step.id, item));
    return map;
  }, [suggestedTimeline.steps]);

  useEffect(() => {
    if (timer.status !== 'running') {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setNowTick((tick) => tick + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timer.status]);

  useEffect(() => {
    if (timer.status === 'running' && totalDurationMs > 0 && getElapsedMs(timer) >= totalDurationMs) {
      onTimerChange({ ...timer, status: 'finished', pausedAt: null });
    }
  }, [onTimerChange, timer, totalDurationMs]);

  const resetTimer = () => onTimerChange(initialTimer);

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
    onSelectedPresetIdChange(preset.id);
    onStepsChange(buildPresetSteps(preset.id));
    resetTimer();
  };

  const restoreSelectedPreset = () => {
    onStepsChange(buildPresetSteps(selectedPreset.id));
    resetTimer();
  };

  const applySuggestedTimeline = () => {
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

  const start = () => {
    if (!canStart) {
      return;
    }

    onTimerChange({
      status: 'running',
      startedAt: Date.now(),
      pausedAt: null,
      accumulatedPauseMs: 0,
    });
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
    <section className="rounded-[14px] border border-stone-200 bg-white/88 p-4 shadow-air sm:p-5">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[24px] font-semibold text-ink">Piano di lavorazione</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Timeline proposta in base al tipo di impasto, agli ingredienti, al mix farine e alla temperatura ambiente.
            Puoi modificare gli step o aggiungere note custom.
          </p>
        </div>
        <button
          type="button"
          onClick={restoreSelectedPreset}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:border-amber-300 hover:bg-amber-50"
        >
          <ListRestart size={18} aria-hidden="true" />
          Ripristina preset
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.75fr)]">
        <div className="rounded-[12px] border border-stone-200 bg-white p-4">
          <section className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-amber-900">Timeline suggerita</h3>
                <p className="mt-1 text-sm leading-5 text-stone-700">
                  Ti consigliamo: <span className="font-semibold text-ink">{recommendedPreset.label}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={applySuggestedTimeline}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                Applica proposta
              </button>
            </div>
            <div className="mt-3 grid gap-2 text-sm leading-5 text-stone-700">
              {recommendationNotes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </section>

          {timerRestoreNotice && (
            <p className="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
              {timerRestoreNotice}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {timelinePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={`rounded-lg border px-3 py-3 text-left transition ${
                  selectedPresetId === preset.id
                    ? 'border-amber-600 bg-amber-50 text-amber-800'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-amber-300'
                }`}
              >
                <span className="block text-sm font-semibold">{preset.label}</span>
                <span className="mt-1 block text-xs leading-5 text-stone-500">{preset.description}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {steps.length === 0 ? (
              <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-600">
                Nessuno step nella timeline. Aggiungi uno step per avviare il timer.
              </div>
            ) : (
              steps.map((step, index) => {
                const suggestion = suggestedStepById.get(step.id);
                const hasDelta = suggestion ? suggestion.deltaMinutes !== 0 : false;
                const hasReasons = suggestion ? suggestion.reasons.length > 0 : false;
                return (
                  <div
                    key={step.id}
                    data-step-id={step.id}
                    className={`grid gap-3 rounded-lg border border-stone-200 bg-stone-50/70 p-3 transition lg:grid-cols-[76px_minmax(190px,0.95fr)_minmax(0,1.2fr)_132px_40px] lg:items-start ${
                      draggingStepId === step.id ? 'scale-[0.99] border-amber-300 bg-amber-50/70 shadow-sm' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 lg:pt-1">
                      <button
                        type="button"
                        onPointerDown={(event) => startStepDrag(step.id, event)}
                        className="grid h-9 w-8 touch-none place-items-center rounded-lg border border-stone-200 bg-white text-stone-500 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 active:cursor-grabbing"
                        aria-label={`Sposta ${step.label}`}
                      >
                        <GripVertical size={18} aria-hidden="true" />
                      </button>
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-sm font-semibold text-amber-700 ring-1 ring-stone-200">
                        {index + 1}
                      </span>
                    </div>

                    <label className="grid gap-2">
                      <span className="sr-only">Step</span>
                      <select
                        aria-label={`Tipo step ${index + 1}`}
                        value={step.type}
                        onChange={(event) => changeStepType(step.id, event.currentTarget.value as TimelineStepType)}
                        className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 text-base font-medium normal-case tracking-normal text-ink outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
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
                          className="min-h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium normal-case tracking-normal text-ink outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                        />
                      )}
                    </label>

                    <div className="grid gap-2">
                      <div className="min-h-11 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">
                            {suggestion ? formatMinuteDuration(suggestion.suggestedDurationMinutes) : formatMinuteDuration(step.durationMinutes)}
                          </span>
                          {suggestion && (hasDelta || hasReasons) && (
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              suggestion.level === 'shorter'
                                ? 'bg-blue-50 text-blue-800'
                                : suggestion.level === 'longer'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-stone-100 text-stone-700'
                            }`}>
                              {hasDelta ? formatDelta(suggestion.deltaMinutes) : 'controlla prima'}
                            </span>
                          )}
                        </div>
                        {step.description && (
                          <p className="mt-1 text-xs leading-5 text-stone-500">{step.description}</p>
                        )}
                        {suggestion && hasReasons && (
                          <details className="mt-2">
                            <summary className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-amber-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100">
                              <Info size={14} aria-hidden="true" />
                              Motivo
                            </summary>
                            <div className="mt-1 grid gap-1 text-xs leading-5 text-stone-600">
                              {suggestion.reasons.map((reason) => (
                                <p key={reason}>{reason}</p>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                      {step.isCustom && (
                        <textarea
                          aria-label="Nota step custom"
                          value={step.note ?? ''}
                          onChange={(event) => updateStep(step.id, { note: event.currentTarget.value })}
                          rows={2}
                          placeholder="Nota personale"
                          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                        />
                      )}
                    </div>

                    <label className="grid gap-2">
                      <span className="sr-only">Minuti</span>
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
                        className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 text-base font-medium normal-case tracking-normal text-ink outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 disabled:bg-stone-100 disabled:text-stone-500"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => deleteStep(step.id)}
                      className="grid h-10 w-10 place-items-center rounded-lg border border-stone-200 bg-white text-stone-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
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
            className="mt-7 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100"
          >
            <CirclePlus size={18} aria-hidden="true" />
            Aggiungi step custom
          </button>
        </div>

        <aside className="rounded-[12px] border border-stone-200 border-l-[5px] border-l-amber-600 bg-white p-5 shadow-air">
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">Step attuale</div>
            <div className="mt-1 text-[24px] font-semibold text-ink">
              {timer.status === 'finished'
                ? 'Timeline completata'
                : currentStepInfo?.step.label ?? 'Pronta per partire'}
            </div>
          </div>

          <div className="grid gap-3 rounded-lg bg-stone-50 p-4">
            <Metric label="Tempo rimanente" value={formatDuration(currentStepInfo?.remainingInStepMs ?? 0)} />
            <Metric label="Prossimo step" value={nextStep?.label ?? 'Nessun prossimo step'} />
            <Metric label="Timeline totale" value={`${formatDuration(elapsedMs)} / ${formatDuration(totalDurationMs)}`} />
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-stone-600">
              <span>Avanzamento</span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-amber-600 transition-all"
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
              <button type="button" onClick={start} disabled={!canStart} className="timeline-primary disabled:cursor-not-allowed disabled:opacity-45">
                <Play size={18} aria-hidden="true" />
                Avvia timeline
              </button>
            )}

            <button
              type="button"
              onClick={skipCurrentStep}
              disabled={!currentStepInfo || timer.status === 'idle' || timer.status === 'finished'}
              className="timeline-secondary disabled:cursor-not-allowed disabled:opacity-45"
            >
              <SkipForward size={18} aria-hidden="true" />
              Salta step
            </button>
            <button type="button" onClick={resetTimer} className="timeline-secondary sm:col-span-2">
              <RotateCcw size={18} aria-hidden="true" />
              Reset
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-stone-200 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm font-medium text-stone-600">{label}</span>
      <span className="text-right text-base font-semibold text-ink">{value}</span>
    </div>
  );
}
