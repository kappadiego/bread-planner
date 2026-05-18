import {
  BookOpen,
  Calculator,
  ChefHat,
  Droplets,
  FlaskConical,
  Scale,
  Wheat,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { calculateBread, type BreadInputs, type CalculatorMode, roundGram } from './calculations';

type Preset = {
  id: string;
  label: string;
  description: string;
  values: Pick<BreadInputs, 'hydration' | 'saltPercentage' | 'starterPercentage' | 'starterHydration'>;
};

const presets: Preset[] = [
  {
    id: 'base',
    label: 'Pane base',
    description: 'Equilibrato e gestibile',
    values: { hydration: 65, saltPercentage: 2, starterPercentage: 20, starterHydration: 100 },
  },
  {
    id: 'high',
    label: 'Alta idratazione',
    description: 'Mollica aperta',
    values: { hydration: 80, saltPercentage: 2, starterPercentage: 20, starterHydration: 100 },
  },
  {
    id: 'focaccia',
    label: 'Focaccia',
    description: 'Soffice e saporita',
    values: { hydration: 75, saltPercentage: 2.2, starterPercentage: 15, starterHydration: 100 },
  },
];

const initialInputs: BreadInputs = {
  mode: 'flour',
  flourTotal: 1000,
  finalWeight: 1000,
  hydration: 65,
  saltPercentage: 2,
  starterPercentage: 20,
  starterHydration: 100,
};

function App() {
  const [inputs, setInputs] = useState<BreadInputs>(initialInputs);
  const [activePreset, setActivePreset] = useState('base');

  const results = useMemo(() => calculateBread(inputs), [inputs]);

  const updateInput = (field: keyof BreadInputs, value: number | CalculatorMode) => {
    setInputs((current) => ({ ...current, [field]: value }));
  };

  const applyPreset = (preset: Preset) => {
    setActivePreset(preset.id);
    setInputs((current) => ({ ...current, ...preset.values }));
  };

  return (
    <main className="min-h-screen bg-stone-50 text-ink">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-7">
        <Header />

        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-start">
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft sm:p-5">
            <ModeTabs mode={inputs.mode} onChange={(mode) => updateInput('mode', mode)} />

            <PresetSelector
              activePreset={activePreset}
              presets={presets}
              onSelect={applyPreset}
            />

            <CalculatorForm inputs={inputs} onChange={updateInput} />
          </div>

          <div className="grid gap-4">
            <ResultCards results={results} />
            {results.hasNegativeAdditions && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                Controlla le percentuali: lo starter contiene piu farina o acqua di quanta ne richieda
                la formula.
              </div>
            )}
          </div>
        </section>

        <QuickGuidelines />
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-4 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-wheat-100 text-wheat-600">
          <Wheat size={24} strokeWidth={1.9} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-ink">Bread Planner</h1>
          <p className="text-sm leading-5 text-stone-600">
            Calcola ingredienti e starter con le percentuali del panificatore.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700">
        <Calculator size={17} strokeWidth={1.8} aria-hidden="true" />
        Aggiornamento in tempo reale
      </div>
    </header>
  );
}

function ModeTabs({
  mode,
  onChange,
}: {
  mode: CalculatorMode;
  onChange: (mode: CalculatorMode) => void;
}) {
  const tabs: Array<{ id: CalculatorMode; label: string }> = [
    { id: 'flour', label: 'Parto dalla farina' },
    { id: 'finalWeight', label: 'Parto dal peso finale' },
  ];

  return (
    <div className="grid grid-cols-2 rounded-lg bg-stone-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`min-h-11 rounded-md px-3 text-sm font-semibold transition ${
            mode === tab.id
              ? 'bg-white text-ink shadow-sm'
              : 'text-stone-600 hover:bg-white/70 hover:text-ink'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function PresetSelector({
  activePreset,
  presets,
  onSelect,
}: {
  activePreset: string;
  presets: Preset[];
  onSelect: (preset: Preset) => void;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-700">
        <ChefHat size={16} aria-hidden="true" />
        Preset
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            className={`rounded-lg border p-3 text-left transition ${
              activePreset === preset.id
                ? 'border-wheat-400 bg-wheat-50 text-ink'
                : 'border-stone-200 bg-white text-stone-700 hover:border-wheat-200 hover:bg-wheat-50/50'
            }`}
          >
            <span className="block text-sm font-semibold">{preset.label}</span>
            <span className="mt-1 block text-xs leading-4 text-stone-500">{preset.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CalculatorForm({
  inputs,
  onChange,
}: {
  inputs: BreadInputs;
  onChange: (field: keyof BreadInputs, value: number | CalculatorMode) => void;
}) {
  return (
    <form className="mt-5 grid gap-4" onSubmit={(event) => event.preventDefault()}>
      {inputs.mode === 'flour' ? (
        <NumberField
          label="Farina totale"
          unit="g"
          value={inputs.flourTotal}
          onChange={(value) => onChange('flourTotal', value)}
        />
      ) : (
        <NumberField
          label="Peso finale"
          unit="g"
          value={inputs.finalWeight}
          onChange={(value) => onChange('finalWeight', value)}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Idratazione impasto"
          unit="%"
          value={inputs.hydration}
          step={0.1}
          onChange={(value) => onChange('hydration', value)}
        />
        <NumberField
          label="Sale"
          unit="%"
          value={inputs.saltPercentage}
          step={0.1}
          onChange={(value) => onChange('saltPercentage', value)}
        />
        <NumberField
          label="Starter"
          unit="%"
          value={inputs.starterPercentage}
          step={0.1}
          onChange={(value) => onChange('starterPercentage', value)}
        />
        <NumberField
          label="Idratazione starter"
          unit="%"
          value={inputs.starterHydration}
          step={0.1}
          onChange={(value) => onChange('starterHydration', value)}
        />
      </div>
    </form>
  );
}

function NumberField({
  label,
  unit,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  unit: 'g' | '%';
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-stone-700">{label}</span>
      <span className="flex min-h-12 overflow-hidden rounded-lg border border-stone-200 bg-white focus-within:border-proof-600 focus-within:ring-4 focus-within:ring-proof-100">
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber || 0)}
          className="w-full min-w-0 bg-transparent px-3 text-base font-semibold text-ink outline-none"
        />
        <span className="grid w-14 place-items-center border-l border-stone-200 bg-stone-50 text-sm font-semibold text-stone-500">
          {unit}
        </span>
      </span>
    </label>
  );
}

function ResultCards({ results }: { results: ReturnType<typeof calculateBread> }) {
  return (
    <>
      <ResultCard
        title="Risultato totale"
        icon={<Scale size={18} aria-hidden="true" />}
        rows={[
          ['Farina totale', results.flourTotal],
          ['Acqua totale', results.waterTotal],
          ['Sale', results.salt],
          ['Starter', results.starter],
        ]}
      />

      <section className="rounded-lg border border-proof-100 bg-proof-50 p-4 shadow-soft sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-proof-700">
          <Droplets size={18} aria-hidden="true" />
          Ingredienti da pesare
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FeaturedAmount label="Farina da aggiungere" value={results.flourToAdd} />
          <FeaturedAmount label="Acqua da aggiungere" value={results.waterToAdd} />
        </div>
      </section>

      <ResultCard
        title="Composizione starter"
        icon={<FlaskConical size={18} aria-hidden="true" />}
        rows={[
          ['Farina nello starter', results.starterFlour],
          ['Acqua nello starter', results.starterWater],
        ]}
      />
    </>
  );
}

function ResultCard({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: ReactNode;
  rows: Array<[string, number]>;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-soft sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
        {icon}
        {title}
      </div>
      <div className="divide-y divide-stone-100">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <span className="text-sm text-stone-600">{label}</span>
            <span className="whitespace-nowrap text-lg font-semibold text-ink">{formatGram(value)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturedAmount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-sm font-medium text-proof-700">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-normal text-proof-700">{formatGram(value)}</div>
    </div>
  );
}

function QuickGuidelines() {
  const guidelines = [
    'Usa la farina totale come 100% della formula.',
    'Lo starter contribuisce sia farina sia acqua: pesali una sola volta.',
    'Aumenta l\'idratazione gradualmente se l\'impasto diventa difficile da gestire.',
    'Il peso finale stimato include farina, acqua e sale; lo starter e gia scomposto nella formula.',
  ];

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
        <BookOpen size={18} aria-hidden="true" />
        Linee guida rapide
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {guidelines.map((guideline) => (
          <p key={guideline} className="rounded-lg bg-stone-50 p-3 text-sm leading-5 text-stone-600">
            {guideline}
          </p>
        ))}
      </div>
    </section>
  );
}

function formatGram(value: number) {
  return `${roundGram(value)} g`;
}

export default App;
