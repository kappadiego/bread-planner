import type { AmbientTemperatureId } from './ambientTemperature';
import { getFlourProfile, type FlourMix } from './flours';
import type { TimelineStep } from './timeline';

export type TimelineAdjustmentLevel = 'none' | 'shorter' | 'longer' | 'watch';

export type TimelineAdjustment = {
  stepId: string;
  level: TimelineAdjustmentLevel;
  message: string;
};

export type TimelineAdjustmentInput = {
  steps: TimelineStep[];
  flourMix: FlourMix;
  ambientTemperature: AmbientTemperatureId;
};

const isFermentationStep = (step: TimelineStep) => {
  const label = step.label.toLowerCase();
  return ['bulk', 'fermentazione', 'lievitazione', 'proof', 'frigo'].some((term) => label.includes(term));
};

const isRestOrFoldStep = (step: TimelineStep) => {
  const label = step.label.toLowerCase();
  return ['riposo', 'piega', 'fold', 'coil'].some((term) => label.includes(term));
};

export const getTimelineAdjustments = ({
  steps,
  flourMix,
  ambientTemperature,
}: TimelineAdjustmentInput): TimelineAdjustment[] => {
  const profiles = flourMix.items.map((item) => getFlourProfile(item.flourProfileId));
  const hasAbsorbentFlours = profiles.some((profile) => profile.absorptionLevel === 'high' || profile.absorptionLevel === 'very-high');
  const hasStrongFlours = profiles.some((profile) => profile.strengthLevel === 'very-high' || profile.id === 'manitoba');

  return steps.flatMap((step) => {
    const adjustments: TimelineAdjustment[] = [];

    if (ambientTemperature === 'warm' && isFermentationStep(step)) {
      adjustments.push({
        stepId: step.id,
        level: 'shorter',
        message: 'Controlla prima della fine: ambiente caldo.',
      });
    }

    if (ambientTemperature === 'cold' && isFermentationStep(step)) {
      adjustments.push({
        stepId: step.id,
        level: 'longer',
        message: 'Potrebbe richiedere più tempo: ambiente fresco.',
      });
    }

    if (hasAbsorbentFlours && isRestOrFoldStep(step)) {
      adjustments.push({
        stepId: step.id,
        level: 'watch',
        message: 'Osserva consistenza e assorbimento prima di procedere.',
      });
    }

    if (hasStrongFlours && isFermentationStep(step)) {
      adjustments.push({
        stepId: step.id,
        level: 'watch',
        message: 'Buona struttura per processi più lunghi: controlla sviluppo e tenuta.',
      });
    }

    return adjustments.slice(0, 2);
  });
};
