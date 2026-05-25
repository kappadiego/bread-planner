import type { AmbientTemperatureId } from './ambientTemperature';
import { getFlourProfile, getFlourMixTotalPercentage, isFlourMixValid, type FlourMix } from './flours';

export type TimelineRecommendation = {
  recommendedPresetId: string;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
  warnings: string[];
};

export type TimelineRecommendationInput = {
  activeProfileId: string;
  flourMix: FlourMix;
  ambientTemperature: AmbientTemperatureId;
};

const hasAbsorbentFlours = (flourMix: FlourMix) =>
  flourMix.items
    .map((item) => getFlourProfile(item.flourProfileId))
    .some((profile) => (
      profile.absorptionLevel === 'high' ||
      profile.absorptionLevel === 'very-high' ||
      ['type-1', 'type-2', 'whole-wheat', 'rye'].includes(profile.id)
    ));

const hasStrongFlours = (flourMix: FlourMix) =>
  flourMix.items
    .map((item) => getFlourProfile(item.flourProfileId))
    .some((profile) => profile.strengthLevel === 'very-high' || profile.id === 'manitoba');

export const getTimelineRecommendation = ({
  activeProfileId,
  flourMix,
  ambientTemperature,
}: TimelineRecommendationInput): TimelineRecommendation => {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const absorbentFlours = hasAbsorbentFlours(flourMix);
  const strongFlours = hasStrongFlours(flourMix);
  let recommendedPresetId = 'basic-same-day';
  let confidence: TimelineRecommendation['confidence'] = 'medium';

  if (activeProfileId === 'focaccia') {
    recommendedPresetId = 'focaccia';
    confidence = 'high';
    reasons.push('Il profilo Focaccia usa una lievitazione in teglia più lineare.');
  } else if (activeProfileId === 'high') {
    recommendedPresetId = 'high-hydration';
    confidence = 'high';
    reasons.push('Il profilo Alta idratazione beneficia di pieghe più ravvicinate.');
  } else if (activeProfileId === 'base') {
    recommendedPresetId = 'basic-same-day';
    confidence = 'high';
    reasons.push('Il profilo Pane base usa la timeline quotidiana come riferimento.');
  } else if (strongFlours) {
    recommendedPresetId = 'long-fermentation';
    confidence = 'medium';
    reasons.push('La presenza di farina forte può sostenere processi più lunghi.');
  } else if (absorbentFlours) {
    recommendedPresetId = 'high-hydration';
    confidence = 'medium';
    reasons.push('Il mix contiene farine più assorbenti: osserva l’impasto durante riposi e pieghe.');
  } else {
    reasons.push('Per un profilo Custom senza segnali particolari, la timeline base resta il punto di partenza più chiaro.');
  }

  if (ambientTemperature === 'warm') {
    warnings.push('Ambiente caldo: controlla prima l’impasto, i tempi potrebbero accorciarsi.');
  }

  if (ambientTemperature === 'cold') {
    warnings.push('Ambiente fresco: i tempi potrebbero allungarsi.');
  }

  if (absorbentFlours && !reasons.some((reason) => reason.includes('assorbenti'))) {
    reasons.push('Il mix contiene farine più assorbenti: osserva l’impasto durante riposi e pieghe.');
  }

  if (!isFlourMixValid(flourMix)) {
    confidence = 'low';
    warnings.push(`Completa il mix farine prima di usare la timeline come riferimento. Ora sei a ${Math.round(getFlourMixTotalPercentage(flourMix) * 10) / 10}%.`);
  }

  return {
    recommendedPresetId,
    confidence,
    reasons: reasons.slice(0, 3),
    warnings,
  };
};
