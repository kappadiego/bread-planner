import {
  CirclePlus,
  GripVertical,
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
import { cloneTimelineSteps } from '../defaults';
import type { FlourMix } from '../flours';
import { timelinePresets, type TimelineStep } from '../timeline';
import { getTimelineAdjustments } from '../timelineAdjustments';
import { getTimelineRecommendation } from '../timelineRecommendations';
import {
  formatDuration,
  getCurrentStepInfo,
  getElapsedMs,
  getTotalDurationMs,
  initialTimer,
  type TimerState,
} from '../timelineUtils';

type TimelinePlannerProps = {
  activeProfileId: string;
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

export function TimelinePlanner({
  activeProfileId,
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
  const recommendation = useMemo(
    () => getTimelineRecommendation({ activeProfileId, flourMix, ambientTemperature }),
    [activeProfileId, flourMix, ambientTemperature],
  );
  const recommendedPreset = useMemo(
    () => timelinePresets.find((preset) => preset.id === recommendation.recommendedPresetId) ?? timelinePresets[0],
    [recommendation.recommendedPresetId],
  );
  const adjustments = useMemo(
    () => getTimelineAdjustments({ steps, flourMix, ambientTemperature }),
    [steps, flourMix, ambientTemperature],
  );
  const adjustmentsByStepId = useMemo(() => {
    const map = new Map<string, typeof adjustments>();
    adjustments.forEach((adjustment) => {
      map.set(adjustment.stepId, [...(map.get(adjustment.stepId) ?? []), adjustment]);
    });
    return map;
  }, [adjustments]);
  const firstStep = steps[0];
  const lastStep = steps[steps.length - 1];
  const contextWarnings = [...recommendation.warnings, ...adjustments.map((adjustment) => adjustment.message)]
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 3);

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

  const applyPreset = (presetId: string) => {
    const preset = timelinePresets.find((item) => item.id === presetId) ?? timelinePresets[0];
    onSelectedPresetIdChange(preset.id);
    onStepsChange(cloneTimelineSteps(preset.steps));
    resetTimer();
  };

  const restoreSelectedPreset = () => {
    onStepsChange(cloneTimelineSteps(selectedPreset.steps));
    resetTimer();
  };

  const updateStep = (stepId: string, patch: Partial<Pick<TimelineStep, 'label' | 'durationMinutes'>>) => {
    onStepsChange(steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)));
    resetTimer();
  };

  const addStep = () => {
    onStepsChange([
      ...steps,
      {
        id: `custom-${Date.now()}`,
        label: 'Nuovo step',
        durationMinutes: 30,
      },
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
            Crea una timeline progressiva per riposi, pieghe e fermentazione.
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
                  <span className="ml-1 text-stone-600">Confidenza: {recommendation.confidence}.</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => applyPreset(recommendation.recommendedPresetId)}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                Applica suggerimento
              </button>
            </div>
            <div className="mt-3 grid gap-2 text-sm leading-5 text-stone-700">
              {recommendation.reasons.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
              {recommendation.warnings.map((warning) => (
                <p key={warning} className="font-medium text-amber-950">
                  {warning}
                </p>
              ))}
            </div>
          </section>

          <section className="mb-4 grid gap-3 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Durata base" value={formatDuration(totalDurationMs)} />
            <Metric label="Step" value={String(steps.length)} />
            <Metric label="Primo step" value={firstStep?.label ?? 'Nessuno'} />
            <Metric label="Ultimo step" value={lastStep?.label ?? 'Nessuno'} />
          </section>

          {contextWarnings.length > 0 && (
            <section className="mb-4 rounded-lg bg-stone-50 px-4 py-3 text-sm leading-5 text-stone-700">
              <h3 className="font-semibold text-ink">Indicazioni di contesto</h3>
              {contextWarnings.map((warning) => (
                <p key={warning} className="mt-1">
                  {warning}
                </p>
              ))}
            </section>
          )}

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
                const stepAdjustments = adjustmentsByStepId.get(step.id) ?? [];
                return (
                  <div
                    key={step.id}
                    data-step-id={step.id}
                    className={`grid gap-3 rounded-lg border border-stone-200 bg-stone-50/70 p-3 transition sm:grid-cols-[76px_minmax(0,1fr)_130px_40px] sm:items-start ${
                      draggingStepId === step.id ? 'scale-[0.99] border-amber-300 bg-amber-50/70 shadow-sm' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:pt-1">
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
                      <input
                        type="text"
                        value={step.label}
                        onChange={(event) => updateStep(step.id, { label: event.currentTarget.value })}
                        className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 text-base font-medium normal-case tracking-normal text-ink outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                      />
                      {stepAdjustments.length > 0 && (
                        <span className="grid gap-1">
                          {stepAdjustments.map((adjustment) => (
                            <span key={`${step.id}-${adjustment.level}-${adjustment.message}`} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-stone-600 ring-1 ring-stone-200">
                              {adjustment.message}
                            </span>
                          ))}
                        </span>
                      )}
                    </label>
                    <label className="grid">
                      <span className="sr-only">Minuti</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={step.durationMinutes}
                        onChange={(event) =>
                          updateStep(step.id, { durationMinutes: event.currentTarget.valueAsNumber || 0 })
                        }
                        className="min-h-11 rounded-lg border border-stone-300 bg-white px-3 text-base font-medium normal-case tracking-normal text-ink outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
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
            Aggiungi step
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
