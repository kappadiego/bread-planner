export type AmbientTemperatureId = 'cold' | 'normal' | 'warm';

export type AmbientTemperatureOption = {
  id: AmbientTemperatureId;
  label: string;
  rangeLabel: string;
  description: string;
  timelineHint: string;
};

export const ambientTemperatureOptions: AmbientTemperatureOption[] = [
  {
    id: 'cold',
    label: 'Freddo',
    rangeLabel: '16–20 °C',
    description: 'Ambiente fresco: la fermentazione tende a rallentare.',
    timelineHint: 'Prevedi tempi più lunghi e controlla lo sviluppo dell\'impasto prima di procedere.',
  },
  {
    id: 'normal',
    label: 'Normale',
    rangeLabel: '21–24 °C',
    description: 'Condizione stabile: usa i tempi base della timeline.',
    timelineHint: 'I preset timeline possono essere usati come riferimento principale.',
  },
  {
    id: 'warm',
    label: 'Caldo',
    rangeLabel: '25–30 °C',
    description: 'Ambiente caldo: la fermentazione tende ad accelerare.',
    timelineHint: 'Controlla prima l\'impasto: i passaggi potrebbero richiedere meno tempo.',
  },
];

export const defaultAmbientTemperature: AmbientTemperatureId = 'normal';

export const getAmbientTemperatureOption = (id: AmbientTemperatureId) =>
  ambientTemperatureOptions.find((option) => option.id === id) ?? ambientTemperatureOptions[1];
