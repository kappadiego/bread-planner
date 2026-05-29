export type TimelineStepType =
  | 'autolysis'
  | 'initial-rest'
  | 'stretch-fold'
  | 'coil-fold'
  | 'lamination'
  | 'bulk'
  | 'pre-shape'
  | 'bench-rest'
  | 'shape'
  | 'proof'
  | 'pan-proof'
  | 'cold-rest'
  | 'bake'
  | 'custom';

export type TimelineStepCategory =
  | 'rest'
  | 'fold'
  | 'fermentation'
  | 'shaping'
  | 'cold'
  | 'bake'
  | 'custom';

export type TimelineStep = {
  id: string;
  type: TimelineStepType;
  label: string;
  category: TimelineStepCategory;
  defaultDurationMinutes: number;
  durationMinutes: number;
  minDurationMinutes?: number;
  maxDurationMinutes?: number;
  durationStepMinutes: number;
  isCustom: boolean;
  isDurationEditable: boolean;
  isLabelEditable: boolean;
  description?: string;
  note?: string;
};

export type TimelineStepDefinition = Omit<TimelineStep, 'id' | 'durationMinutes' | 'note'>;

export type TimelinePreset = {
  id: string;
  label: string;
  description: string;
  steps: TimelineStep[];
};

export const timelineStepDefinitions: Record<TimelineStepType, TimelineStepDefinition> = {
  autolysis: {
    type: 'autolysis',
    label: 'Autolisi',
    category: 'rest',
    defaultDurationMinutes: 60,
    minDurationMinutes: 30,
    maxDurationMinutes: 120,
    durationStepMinutes: 15,
    isCustom: false,
    isDurationEditable: true,
    isLabelEditable: false,
    description: 'Riposo iniziale di farina e acqua, utile per idratare e rilassare l’impasto.',
  },
  'initial-rest': {
    type: 'initial-rest',
    label: 'Riposo iniziale',
    category: 'rest',
    defaultDurationMinutes: 60,
    minDurationMinutes: 30,
    maxDurationMinutes: 90,
    durationStepMinutes: 15,
    isCustom: false,
    isDurationEditable: true,
    isLabelEditable: false,
    description: 'Primo riposo dopo l’impasto o dopo l’unione degli ingredienti.',
  },
  'stretch-fold': {
    type: 'stretch-fold',
    label: 'Stretch and fold',
    category: 'fold',
    defaultDurationMinutes: 30,
    minDurationMinutes: 30,
    maxDurationMinutes: 120,
    durationStepMinutes: 30,
    isCustom: false,
    isDurationEditable: true,
    isLabelEditable: false,
    description: 'Pieghe a intervalli regolari per dare struttura a impasti base.',
  },
  'coil-fold': {
    type: 'coil-fold',
    label: 'Coil fold',
    category: 'fold',
    defaultDurationMinutes: 30,
    minDurationMinutes: 30,
    maxDurationMinutes: 120,
    durationStepMinutes: 30,
    isCustom: false,
    isDurationEditable: true,
    isLabelEditable: false,
    description: 'Pieghe delicate, utili per impasti più idratati.',
  },
  lamination: {
    type: 'lamination',
    label: 'Laminazione',
    category: 'fold',
    defaultDurationMinutes: 30,
    minDurationMinutes: 15,
    maxDurationMinutes: 60,
    durationStepMinutes: 15,
    isCustom: false,
    isDurationEditable: true,
    isLabelEditable: false,
    description: 'Stesura e ripiegatura dell’impasto per distribuire tensione e inclusioni.',
  },
  bulk: {
    type: 'bulk',
    label: 'Fermentazione in massa',
    category: 'fermentation',
    defaultDurationMinutes: 240,
    minDurationMinutes: 120,
    maxDurationMinutes: 480,
    durationStepMinutes: 30,
    isCustom: false,
    isDurationEditable: true,
    isLabelEditable: false,
    description: 'Fermentazione principale dell’impasto prima della formatura.',
  },
  'pre-shape': {
    type: 'pre-shape',
    label: 'Pre-forma',
    category: 'shaping',
    defaultDurationMinutes: 20,
    minDurationMinutes: 10,
    maxDurationMinutes: 30,
    durationStepMinutes: 5,
    isCustom: false,
    isDurationEditable: true,
    isLabelEditable: false,
    description: 'Prima formatura leggera per organizzare la massa.',
  },
  'bench-rest': {
    type: 'bench-rest',
    label: 'Riposo banco',
    category: 'shaping',
    defaultDurationMinutes: 20,
    minDurationMinutes: 10,
    maxDurationMinutes: 40,
    durationStepMinutes: 5,
    isCustom: false,
    isDurationEditable: true,
    isLabelEditable: false,
    description: 'Riposo breve sul banco prima della forma finale.',
  },
  shape: {
    type: 'shape',
    label: 'Forma',
    category: 'shaping',
    defaultDurationMinutes: 15,
    minDurationMinutes: 5,
    maxDurationMinutes: 30,
    durationStepMinutes: 5,
    isCustom: false,
    isDurationEditable: true,
    isLabelEditable: false,
    description: 'Forma finale prima dell’appretto o della teglia.',
  },
  proof: {
    type: 'proof',
    label: 'Appretto',
    category: 'fermentation',
    defaultDurationMinutes: 90,
    minDurationMinutes: 45,
    maxDurationMinutes: 180,
    durationStepMinutes: 15,
    isCustom: false,
    isDurationEditable: true,
    isLabelEditable: false,
    description: 'Lievitazione finale prima della cottura.',
  },
  'pan-proof': {
    type: 'pan-proof',
    label: 'Lievitazione in teglia',
    category: 'fermentation',
    defaultDurationMinutes: 90,
    minDurationMinutes: 30,
    maxDurationMinutes: 180,
    durationStepMinutes: 15,
    isCustom: false,
    isDurationEditable: true,
    isLabelEditable: false,
    description: 'Lievitazione in teglia, centrale per focacce e impasti morbidi.',
  },
  'cold-rest': {
    type: 'cold-rest',
    label: 'Riposo in frigo',
    category: 'cold',
    defaultDurationMinutes: 720,
    minDurationMinutes: 480,
    maxDurationMinutes: 1440,
    durationStepMinutes: 60,
    isCustom: false,
    isDurationEditable: true,
    isLabelEditable: false,
    description: 'Maturazione lunga in ambiente freddo.',
  },
  bake: {
    type: 'bake',
    label: 'Cottura',
    category: 'bake',
    defaultDurationMinutes: 45,
    minDurationMinutes: 20,
    maxDurationMinutes: 60,
    durationStepMinutes: 5,
    isCustom: false,
    isDurationEditable: true,
    isLabelEditable: false,
    description: 'Tempo indicativo di cottura.',
  },
  custom: {
    type: 'custom',
    label: 'Step custom',
    category: 'custom',
    defaultDurationMinutes: 30,
    minDurationMinutes: 0,
    maxDurationMinutes: 1440,
    durationStepMinutes: 5,
    isCustom: true,
    isDurationEditable: true,
    isLabelEditable: true,
    description: 'Step libero per note e passaggi personali.',
  },
};

export const predefinedTimelineStepTypes = Object.values(timelineStepDefinitions)
  .filter((definition) => !definition.isCustom)
  .map((definition) => definition.type);

export const createTimelineStep = (
  type: TimelineStepType,
  id: string,
  durationMinutes = timelineStepDefinitions[type].defaultDurationMinutes,
  overrides: Partial<Pick<TimelineStep, 'label' | 'note' | 'description'>> = {},
): TimelineStep => {
  const definition = timelineStepDefinitions[type];
  return {
    ...definition,
    id,
    label: overrides.label ?? definition.label,
    description: overrides.description ?? definition.description,
    durationMinutes,
    note: overrides.note,
  };
};

export const createCustomTimelineStep = (id: string): TimelineStep =>
  createTimelineStep('custom', id, 30, { label: 'Nuovo step' });

export const timelinePresets: TimelinePreset[] = [
  {
    id: 'basic-same-day',
    label: 'Pane base',
    description: 'Riposo iniziale, pieghe e fermentazione in massa.',
    steps: [
      createTimelineStep('initial-rest', 'rest-1', 60),
      createTimelineStep('stretch-fold', 'fold-1', 30),
      createTimelineStep('stretch-fold', 'fold-2', 30),
      createTimelineStep('stretch-fold', 'fold-3', 30),
      createTimelineStep('bulk', 'bulk', 240),
    ],
  },
  {
    id: 'high-hydration',
    label: 'Alta idratazione',
    description: 'Pieghe più ravvicinate per dare struttura all’impasto.',
    steps: [
      createTimelineStep('autolysis', 'autolysis-1', 60),
      createTimelineStep('coil-fold', 'coil-1', 30),
      createTimelineStep('coil-fold', 'coil-2', 30),
      createTimelineStep('coil-fold', 'coil-3', 30),
      createTimelineStep('coil-fold', 'coil-4', 30),
      createTimelineStep('bulk', 'bulk', 300),
    ],
  },
  {
    id: 'focaccia',
    label: 'Focaccia',
    description: 'Timeline semplice per impasto morbido e lievitazione in teglia.',
    steps: [
      createTimelineStep('initial-rest', 'rest-1', 45),
      createTimelineStep('stretch-fold', 'fold-1', 30, { description: 'Prima piega per dare struttura.' }),
      createTimelineStep('stretch-fold', 'fold-2', 30, { description: 'Seconda piega per sostenere l’impasto.' }),
      createTimelineStep('bulk', 'bulk', 120),
      createTimelineStep('pan-proof', 'pan-proof', 90),
    ],
  },
  {
    id: 'long-fermentation',
    label: 'Lunga fermentazione',
    description: 'Poche pieghe, poi maturazione lenta.',
    steps: [
      createTimelineStep('autolysis', 'autolysis-1', 60),
      createTimelineStep('stretch-fold', 'fold-1', 30, { description: 'Prima piega prima della fermentazione lunga.' }),
      createTimelineStep('stretch-fold', 'fold-2', 30, { description: 'Seconda piega prima della maturazione.' }),
      createTimelineStep('bulk', 'bulk', 180),
      createTimelineStep('cold-rest', 'cold-rest', 720),
    ],
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Parti da uno step libero e costruisci il tuo piano.',
    steps: [
      createCustomTimelineStep('custom-1'),
    ],
  },
];
