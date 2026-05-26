import type { AmbientTemperatureId } from './ambientTemperature';
import type { BreadInputs } from './calculations';
import { getFlourProfile, isFlourMixValid, type FlourMix } from './flours';
import {
  timelinePresets,
  type TimelineStep,
} from './timeline';

export type TimelineAdjustmentLevel = 'info' | 'watch' | 'shorter' | 'longer';

export type TimelineStepAdjustment = {
  stepId: string;
  baseDurationMinutes: number;
  suggestedDurationMinutes: number;
  deltaMinutes: number;
  reasons: string[];
  level: TimelineAdjustmentLevel;
};

export type SuggestedTimelineStep = {
  step: TimelineStep;
  baseDurationMinutes: number;
  suggestedDurationMinutes: number;
  deltaMinutes: number;
  level: TimelineAdjustmentLevel;
  reasons: string[];
};

export type SuggestedTimelineResult = {
  recommendedPresetId: string;
  confidence: 'low' | 'medium' | 'high';
  steps: SuggestedTimelineStep[];
  reasons: string[];
  warnings: string[];
};

export type BuildSuggestedTimelineInput = {
  activeProfileId: string;
  inputs: BreadInputs;
  flourMix: FlourMix;
  ambientTemperature: AmbientTemperatureId;
  selectedPresetId: string;
  steps?: TimelineStep[];
};

const profilePresetMap: Record<string, string> = {
  base: 'basic-same-day',
  high: 'high-hydration',
  focaccia: 'focaccia',
};

const getPreset = (presetId: string) =>
  timelinePresets.find((preset) => preset.id === presetId) ?? timelinePresets[0];

const safeNumber = (value: number) => (Number.isFinite(value) ? Math.max(value, 0) : 0);

const clamp = (value: number, min?: number, max?: number) => {
  let next = value;
  if (typeof min === 'number') {
    next = Math.max(min, next);
  }
  if (typeof max === 'number') {
    next = Math.min(max, next);
  }
  return next;
};

const roundToStep = (value: number, step: number) => {
  const safeStep = step > 0 ? step : 1;
  return Math.round(value / safeStep) * safeStep;
};

const flourProfilesForMix = (flourMix: FlourMix) =>
  flourMix.items.map((item) => getFlourProfile(item.flourProfileId));

export const hasAbsorbentFlours = (flourMix: FlourMix) =>
  flourProfilesForMix(flourMix).some((profile) => (
    profile.absorptionLevel === 'high' ||
    profile.absorptionLevel === 'very-high' ||
    ['type-1', 'type-2', 'whole-wheat', 'rye'].includes(profile.id)
  ));

export const hasStrongFlours = (flourMix: FlourMix) =>
  flourProfilesForMix(flourMix).some((profile) => (
    profile.strengthLevel === 'very-high' ||
    profile.id === 'manitoba' ||
    safeNumber(profile.defaultProteinPercentage ?? 0) >= 13
  ));

const isFermentationStep = (step: TimelineStep) =>
  step.type === 'bulk' || step.type === 'proof' || step.type === 'pan-proof';

const isRestStep = (step: TimelineStep) =>
  step.type === 'autolysis' || step.type === 'initial-rest';

const isFoldStep = (step: TimelineStep) =>
  step.type === 'stretch-fold' || step.type === 'coil-fold' || step.type === 'lamination';

const addDelta = (
  delta: number,
  reasons: string[],
  reason: string,
) => {
  reasons.push(reason);
  return delta;
};

const getRecommendedPresetId = ({
  activeProfileId,
  inputs,
  flourMix,
}: Pick<BuildSuggestedTimelineInput, 'activeProfileId' | 'inputs' | 'flourMix'>) => {
  const mappedPreset = profilePresetMap[activeProfileId];
  if (mappedPreset) {
    return mappedPreset;
  }

  if (safeNumber(inputs.oilPercentage) >= 3) {
    return 'focaccia';
  }

  if (safeNumber(inputs.hydration) >= 76 || hasAbsorbentFlours(flourMix)) {
    return 'high-hydration';
  }

  if (hasStrongFlours(flourMix)) {
    return 'long-fermentation';
  }

  return 'basic-same-day';
};

const getStepAdjustment = (
  step: TimelineStep,
  input: BuildSuggestedTimelineInput,
): TimelineStepAdjustment => {
  const reasons: string[] = [];
  const baseDurationMinutes = safeNumber(step.durationMinutes);
  let deltaMinutes = 0;
  let level: TimelineAdjustmentLevel = 'info';
  const absorbentFlours = hasAbsorbentFlours(input.flourMix);
  const strongFlours = hasStrongFlours(input.flourMix);
  const hydration = safeNumber(input.inputs.hydration);
  const starterPercentage = safeNumber(input.inputs.starterPercentage);
  const oilPercentage = safeNumber(input.inputs.oilPercentage);

  if (input.ambientTemperature === 'warm' && isFermentationStep(step)) {
    const warmDelta = step.type === 'bulk' ? -30 : -15;
    deltaMinutes += addDelta(warmDelta, reasons, 'Ambiente caldo: controlla prima la fermentazione.');
    level = 'shorter';
  }

  if (input.ambientTemperature === 'cold' && isFermentationStep(step)) {
    const coldDelta = step.type === 'bulk' ? 60 : 30;
    deltaMinutes += addDelta(coldDelta, reasons, 'Ambiente fresco: potrebbe servire più tempo.');
    level = 'longer';
  }

  if (absorbentFlours && isRestStep(step)) {
    deltaMinutes += addDelta(
      step.type === 'autolysis' ? 30 : 15,
      reasons,
      'Farine più assorbenti: osserva idratazione e consistenza.',
    );
    if (level === 'info') {
      level = 'watch';
    }
  }

  if (absorbentFlours && isFoldStep(step)) {
    reasons.push('Farine assorbenti o integrali: valuta sviluppo e tenuta durante le pieghe.');
    if (level === 'info') {
      level = 'watch';
    }
  }

  if (hydration >= 76 && step.type === 'coil-fold') {
    reasons.push('Alta idratazione: meglio lavorare con pieghe delicate e ravvicinate.');
    if (level === 'info') {
      level = 'watch';
    }
  }

  if (starterPercentage >= 25 && isFermentationStep(step) && input.ambientTemperature !== 'cold') {
    deltaMinutes += addDelta(-15, reasons, 'Starter alto: la fermentazione può partire più rapidamente.');
    if (level === 'info') {
      level = 'shorter';
    }
  }

  if (oilPercentage >= 3 && step.type === 'pan-proof') {
    reasons.push('Focaccia con olio: usa la teglia come riferimento e controlla lo sviluppo.');
    if (level === 'info') {
      level = 'watch';
    }
  }

  if (strongFlours && (step.type === 'bulk' || step.type === 'cold-rest')) {
    reasons.push('Farina forte/proteica: può sostenere processi più lunghi, controllando sviluppo e tenuta.');
    if (level === 'info') {
      level = 'watch';
    }
  }

  if (step.type === 'cold-rest' && input.ambientTemperature !== 'normal') {
    reasons.push('Il frigo è un contesto separato: non applico lo stesso effetto della temperatura ambiente.');
    if (level === 'info') {
      level = 'watch';
    }
  }

  if (step.type === 'custom') {
    return {
      stepId: step.id,
      baseDurationMinutes,
      suggestedDurationMinutes: baseDurationMinutes,
      deltaMinutes: 0,
      reasons,
      level: reasons.length > 0 ? level : 'info',
    };
  }

  const suggestedDurationMinutes = clamp(
    roundToStep(baseDurationMinutes + deltaMinutes, step.durationStepMinutes),
    step.minDurationMinutes,
    step.maxDurationMinutes,
  );

  return {
    stepId: step.id,
    baseDurationMinutes,
    suggestedDurationMinutes,
    deltaMinutes: suggestedDurationMinutes - baseDurationMinutes,
    reasons,
    level: reasons.length > 0 ? level : 'info',
  };
};

export const buildSuggestedTimeline = (input: BuildSuggestedTimelineInput): SuggestedTimelineResult => {
  const recommendedPresetId = getRecommendedPresetId(input);
  const selectedPreset = getPreset(input.selectedPresetId || recommendedPresetId);
  const baseSteps = input.steps ?? selectedPreset.steps;
  const reasons: string[] = [];
  const warnings: string[] = [];
  let confidence: SuggestedTimelineResult['confidence'] = profilePresetMap[input.activeProfileId] ? 'high' : 'medium';

  if (input.activeProfileId === 'focaccia') {
    reasons.push('Il profilo Focaccia mette al centro bulk breve e lievitazione in teglia.');
  } else if (input.activeProfileId === 'high') {
    reasons.push('Il profilo Alta idratazione beneficia di coil fold e controllo della struttura.');
  } else if (input.activeProfileId === 'base') {
    reasons.push('Il profilo Pane base usa riposi, pieghe e bulk come percorso principale.');
  } else {
    reasons.push('Il profilo Custom usa ingredienti, farine e temperatura per orientare la timeline.');
  }

  if (input.ambientTemperature === 'warm') {
    reasons.push('Ambiente caldo: la proposta riduce o anticipa il controllo degli step fermentativi.');
  }

  if (input.ambientTemperature === 'cold') {
    reasons.push('Ambiente fresco: la proposta allunga gli step fermentativi più sensibili.');
  }

  if (hasAbsorbentFlours(input.flourMix)) {
    reasons.push('Farine assorbenti o integrali: più attenzione a riposi e pieghe.');
  }

  if (hasStrongFlours(input.flourMix)) {
    reasons.push('Farine forti/proteiche: possono sostenere processi più lunghi.');
  }

  if (!isFlourMixValid(input.flourMix)) {
    confidence = 'low';
    warnings.push('Completa il mix farine prima di usare la timeline come riferimento.');
  }

  const steps = baseSteps.map((step) => {
    const adjustment = getStepAdjustment(step, input);
    return {
      step,
      baseDurationMinutes: adjustment.baseDurationMinutes,
      suggestedDurationMinutes: adjustment.suggestedDurationMinutes,
      deltaMinutes: adjustment.deltaMinutes,
      level: adjustment.level,
      reasons: adjustment.reasons,
    };
  });

  return {
    recommendedPresetId,
    confidence,
    steps,
    reasons: reasons.slice(0, 4),
    warnings,
  };
};
