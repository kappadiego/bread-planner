import type { AmbientTemperatureId } from './ambientTemperature';
import { getFlourProfile, type FlourMix } from './flours';

export const getAmbientTemperatureFlourHints = (
  temperatureId: AmbientTemperatureId,
  flourMix: FlourMix,
): string[] => {
  const profiles = flourMix.items.map((item) => getFlourProfile(item.flourProfileId));
  const hints = new Set<string>();

  if (temperatureId === 'warm') {
    hints.add('Con ambiente caldo, controlla l\'impasto prima del timer: la fermentazione puo accelerare.');
  }

  if (temperatureId === 'cold') {
    hints.add('Con ambiente fresco, i tempi della timeline potrebbero allungarsi.');
  }

  if (profiles.some((profile) => profile.absorptionLevel === 'high' || profile.absorptionLevel === 'very-high')) {
    hints.add('Farine piu assorbenti o integrali possono richiedere piu attenzione durante riposi e pieghe.');
  }

  if (profiles.some((profile) => profile.strengthLevel === 'very-high')) {
    hints.add('La presenza di farina forte puo aiutare nei processi piu lunghi.');
  }

  return Array.from(hints);
};
