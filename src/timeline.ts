export type TimelineStep = {
  id: string;
  label: string;
  durationMinutes: number;
  description?: string;
};

export type TimelinePreset = {
  id: string;
  label: string;
  description: string;
  steps: TimelineStep[];
};

export const timelinePresets: TimelinePreset[] = [
  {
    id: 'basic-same-day',
    label: 'Pane base',
    description: 'Riposo iniziale, pieghe e fermentazione in massa.',
    steps: [
      { id: 'rest-1', label: 'Riposo iniziale', durationMinutes: 60 },
      { id: 'fold-1', label: 'Stretch and fold', durationMinutes: 30 },
      { id: 'fold-2', label: 'Stretch and fold', durationMinutes: 30 },
      { id: 'fold-3', label: 'Stretch and fold', durationMinutes: 30 },
      { id: 'bulk', label: 'Fermentazione in massa', durationMinutes: 240 },
    ],
  },
  {
    id: 'high-hydration',
    label: 'Alta idratazione',
    description: 'Pieghe piu ravvicinate per dare struttura all impasto.',
    steps: [
      { id: 'rest-1', label: 'Riposo iniziale', durationMinutes: 45 },
      { id: 'coil-1', label: 'Coil fold', durationMinutes: 20 },
      { id: 'coil-2', label: 'Coil fold', durationMinutes: 20 },
      { id: 'coil-3', label: 'Coil fold', durationMinutes: 20 },
      { id: 'coil-4', label: 'Coil fold', durationMinutes: 20 },
      { id: 'bulk', label: 'Fermentazione in massa', durationMinutes: 300 },
    ],
  },
  {
    id: 'focaccia',
    label: 'Focaccia',
    description: 'Timeline semplice per impasto morbido e lievitazione in teglia.',
    steps: [
      { id: 'rest-1', label: 'Riposo iniziale', durationMinutes: 30 },
      { id: 'fold-1', label: 'Prima piega', durationMinutes: 30 },
      { id: 'fold-2', label: 'Seconda piega', durationMinutes: 30 },
      { id: 'bulk', label: 'Prima lievitazione', durationMinutes: 120 },
      { id: 'pan-proof', label: 'Lievitazione in teglia', durationMinutes: 90 },
    ],
  },
  {
    id: 'long-fermentation',
    label: 'Lunga fermentazione',
    description: 'Poche pieghe, poi maturazione lenta.',
    steps: [
      { id: 'rest-1', label: 'Riposo iniziale', durationMinutes: 60 },
      { id: 'fold-1', label: 'Prima piega', durationMinutes: 30 },
      { id: 'fold-2', label: 'Seconda piega', durationMinutes: 30 },
      { id: 'bulk', label: 'Fermentazione in massa', durationMinutes: 180 },
      { id: 'cold', label: 'Riposo in frigo', durationMinutes: 720 },
    ],
  },
];
