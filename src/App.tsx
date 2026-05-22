import {
  Bookmark,
  CalendarDays,
  CircleHelp,
  CirclePlus,
  Clock3,
  Droplets,
  RotateCcw,
  Scale,
  Thermometer,
  Wheat,
} from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { calculateBread, type BreadInputs, type CalculatorMode, roundGram } from './calculations';
import { TimelinePlanner } from './components/TimelinePlanner';
import { doughProfiles, type DoughProfile } from './doughProfiles';

type IconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
};

type IconComponent = ComponentType<IconProps>;

type ActiveProfileId = DoughProfile['id'] | 'custom';

type FieldConfig = {
  field: keyof BreadInputs;
  label: string;
  unit: 'g' | '%';
  value: number;
  step?: number;
  icon: IconComponent;
};

const initialInputs: BreadInputs = {
  mode: 'flour',
  flourTotal: 1000,
  finalWeight: 1000,
  hydration: 65,
  saltPercentage: 2,
  starterPercentage: 20,
  starterHydration: 100,
  oilPercentage: 0,
};

function App() {
  const [inputs, setInputs] = useState<BreadInputs>(initialInputs);
  const [activeProfileId, setActiveProfileId] = useState<ActiveProfileId>('base');
  const [customProfileName, setCustomProfileName] = useState('Custom');

  const results = useMemo(() => calculateBread(inputs), [inputs]);

  const updateInput = (field: keyof BreadInputs, value: number | CalculatorMode) => {
    setInputs((current) => ({ ...current, [field]: value }));
    setActiveProfileId('custom');
  };

  const reset = () => {
    setInputs(initialInputs);
    setActiveProfileId('base');
    setCustomProfileName('Custom');
  };

  const applyProfile = (profile: DoughProfile) => {
    setActiveProfileId(profile.id);
    setCustomProfileName('Custom');
    setInputs((current) => ({ ...current, ...profile.values }));
  };

  const selectCustomProfile = () => {
    setActiveProfileId('custom');
  };

  const customDisplayName = customProfileName.trim() || 'Custom';

  const getProfileIcon = (profileId: DoughProfile['id']): IconComponent => {
    if (profileId === 'high') {
      return Droplets;
    }
    if (profileId === 'focaccia') {
      return FocacciaIcon;
    }
    return BreadIcon;
  };

  return (
    <main className="min-h-screen bg-flour text-ink">
      <Header onReset={reset} />

      <div className="mx-auto flex w-full max-w-[1510px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-7 xl:grid-cols-[minmax(560px,0.98fr)_minmax(520px,0.92fr)] xl:items-start">
          <div className="rounded-[14px] border border-stone-200 bg-white/82 p-4 shadow-air backdrop-blur sm:p-5">
            <div className="rounded-[12px] border border-stone-200 bg-white p-4 shadow-inner-soft">
              <DoughProfileSelector
                activeProfileId={activeProfileId}
                customDisplayName={customDisplayName}
                customProfileName={customProfileName}
                profiles={doughProfiles}
                getProfileIcon={getProfileIcon}
                onSelectProfile={applyProfile}
                onSelectCustom={selectCustomProfile}
                onCustomProfileNameChange={setCustomProfileName}
              />

              <div className="mt-6">
                <ModeTabs mode={inputs.mode} onChange={(mode) => updateInput('mode', mode)} />
              </div>

              <CalculatorForm inputs={inputs} onChange={updateInput} />

            </div>
          </div>

          <div className="grid gap-5">
            <ResultCards results={results} />
            {results.hasNegativeAdditions && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                Controlla le percentuali: lo starter contiene più farina o acqua di quanta ne richieda
                la formula.
              </div>
            )}
          </div>
        </section>

        <TimelinePlanner />

        <QuickGuidelines />

        <p className="text-center text-sm text-stone-500">
          Le quantità sono calcolate con arrotondamento al grammo.
        </p>
      </div>
    </main>
  );
}

function Header({ onReset }: { onReset: () => void }) {
  return (
    <header className="border-b border-stone-200 bg-white/88 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1510px] flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="flex items-center gap-4">
          <div className="grid h-11 w-14 place-items-center rounded-full border-2 border-amber-600/80 bg-amber-50 text-amber-700">
            <BreadIcon size={32} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <h1 className="text-[28px] font-semibold tracking-normal text-ink sm:text-[30px]">
            Bread Planner
          </h1>
        </div>

        <nav className="flex flex-wrap items-center gap-4 text-sm font-medium text-stone-700 sm:gap-7">
          <HeaderAction icon={<RotateCcw size={20} />} label="Ripristina" onClick={onReset} />
          <HeaderAction icon={<Bookmark size={20} />} label="Salva ricetta" />
          <HeaderAction icon={<CircleHelp size={20} />} label="Guida" />
        </nav>
      </div>
    </header>
  );
}

function HeaderAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-2 rounded-md px-1 text-stone-700 transition hover:text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ModeTabs({
  mode,
  onChange,
}: {
  mode: CalculatorMode;
  onChange: (mode: CalculatorMode) => void;
}) {
  const tabs: Array<{ id: CalculatorMode; label: string; icon: ReactNode }> = [
    { id: 'flour', label: 'Parto dalla farina', icon: <Wheat size={22} strokeWidth={1.75} /> },
    { id: 'finalWeight', label: 'Parto dal peso finale', icon: <Scale size={22} strokeWidth={1.75} /> },
  ];

  return (
    <div className="grid overflow-hidden rounded-lg border border-stone-200 bg-stone-50 shadow-inner-soft sm:grid-cols-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          aria-selected={mode === tab.id}
          className={`relative flex min-h-[56px] items-center justify-center gap-3 px-4 text-base font-semibold transition ${
            mode === tab.id
              ? 'bg-white text-amber-700 after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:bg-amber-600'
              : 'text-stone-600 hover:bg-white/70 hover:text-ink'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function DoughProfileSelector({
  activeProfileId,
  customDisplayName,
  customProfileName,
  profiles,
  getProfileIcon,
  onSelectProfile,
  onSelectCustom,
  onCustomProfileNameChange,
}: {
  activeProfileId: ActiveProfileId;
  customDisplayName: string;
  customProfileName: string;
  profiles: DoughProfile[];
  getProfileIcon: (profileId: DoughProfile['id']) => IconComponent;
  onSelectProfile: (profile: DoughProfile) => void;
  onSelectCustom: () => void;
  onCustomProfileNameChange: (value: string) => void;
}) {
  return (
    <section className="mt-5">
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-ink">Scegli il tipo di impasto</h2>
        <p className="mt-1 text-sm leading-5 text-stone-600">
          Parti da un profilo base o crea una formula personalizzata.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {profiles.map((profile) => {
          const Icon = getProfileIcon(profile.id);
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelectProfile(profile)}
              className={`flex min-h-[94px] items-start gap-3 rounded-lg border p-4 text-left transition ${
                activeProfileId === profile.id
                  ? 'border-amber-600 bg-amber-50 text-amber-700 shadow-sm'
                  : 'border-stone-300 bg-white text-stone-600 hover:border-amber-300 hover:bg-amber-50/40'
              }`}
            >
              <Icon size={25} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                <span className="block text-base font-semibold">{profile.label}</span>
                <span className="mt-1 block text-sm leading-5 text-stone-500">{profile.description}</span>
              </span>
            </button>
          );
        })}
        <div
          role="button"
          tabIndex={0}
          onClick={onSelectCustom}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelectCustom();
            }
          }}
          className={`flex min-h-[94px] cursor-pointer items-start gap-3 rounded-lg border p-4 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 ${
            activeProfileId === 'custom'
              ? 'border-amber-600 bg-amber-50 text-amber-700 shadow-sm'
              : 'border-stone-300 bg-white text-stone-600 hover:border-amber-300 hover:bg-amber-50/40'
          }`}
        >
          <CirclePlus size={25} strokeWidth={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {activeProfileId === 'custom' ? (
              <input
                type="text"
                aria-label="Nome profilo custom"
                value={customProfileName}
                placeholder="Custom"
                onClick={(event) => event.stopPropagation()}
                onFocus={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                onChange={(event) => onCustomProfileNameChange(event.currentTarget.value)}
                className="min-h-9 w-full min-w-0 rounded-lg border border-amber-200 bg-white px-3 text-base font-semibold text-ink outline-none transition placeholder:text-stone-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
              />
            ) : (
              <span className="block text-base font-semibold">{customDisplayName}</span>
            )}
            <span className="mt-1 block text-sm leading-5 text-stone-500">Crea il tuo profilo.</span>
          </span>
        </div>
      </div>
    </section>
  );
}

function CalculatorForm({
  inputs,
  onChange,
}: {
  inputs: BreadInputs;
  onChange: (field: keyof BreadInputs, value: number | CalculatorMode) => void;
}) {
  const baseField: FieldConfig =
    inputs.mode === 'flour'
      ? {
          field: 'flourTotal',
          label: 'Farina totale',
          unit: 'g',
          value: inputs.flourTotal,
          icon: Wheat,
        }
      : {
          field: 'finalWeight',
          label: 'Peso finale',
          unit: 'g',
          value: inputs.finalWeight,
          icon: Scale,
        };

  const fields: FieldConfig[] = [
    baseField,
    {
      field: 'hydration',
      label: 'Idratazione impasto',
      unit: '%',
      value: inputs.hydration,
      step: 0.1,
      icon: Droplets,
    },
    {
      field: 'saltPercentage',
      label: 'Sale',
      unit: '%',
      value: inputs.saltPercentage,
      step: 0.1,
      icon: SaltIcon,
    },
    {
      field: 'starterPercentage',
      label: 'Starter',
      unit: '%',
      value: inputs.starterPercentage,
      step: 0.1,
      icon: JarIcon,
    },
    {
      field: 'starterHydration',
      label: 'Idratazione starter',
      unit: '%',
      value: inputs.starterHydration,
      step: 0.1,
      icon: Droplets,
    },
    {
      field: 'oilPercentage',
      label: 'Olio',
      unit: '%',
      value: inputs.oilPercentage,
      step: 0.1,
      icon: OilIcon,
    },
  ];

  return (
    <form className="mt-6 overflow-hidden rounded-lg border border-stone-200 bg-white" onSubmit={(event) => event.preventDefault()}>
      {fields.map((field) => (
        <NumberField
          key={field.field}
          label={field.label}
          unit={field.unit}
          value={field.value}
          step={field.step}
          icon={field.icon}
          onChange={(value) => onChange(field.field, value)}
        />
      ))}
    </form>
  );
}

function NumberField({
  label,
  unit,
  value,
  step = 1,
  icon: Icon,
  onChange,
}: {
  label: string;
  unit: 'g' | '%';
  value: number;
  step?: number;
  icon: IconComponent;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-3 border-b border-stone-200 px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_260px] sm:items-center">
      <span className="flex min-w-0 items-center gap-4 text-base font-semibold text-ink">
        <Icon size={25} strokeWidth={1.85} className="shrink-0 text-stone-900" aria-hidden="true" />
        <span className="min-w-0">{label}</span>
      </span>
      <span className="flex min-h-12 overflow-hidden rounded-lg border border-stone-300 bg-white focus-within:border-amber-500 focus-within:ring-4 focus-within:ring-amber-100">
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber || 0)}
          className="w-full min-w-0 bg-transparent px-3 text-[22px] font-medium text-ink outline-none"
        />
        <span className="grid w-12 place-items-center border-l border-stone-200 bg-stone-50 text-base font-medium text-stone-700">
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
        tone="amber"
        icon={<BagIcon size={30} strokeWidth={1.75} aria-hidden="true" />}
        rows={[
          ['Farina totale', results.flourTotal],
          ['Acqua totale', results.waterTotal, true],
          ['Sale', results.salt],
          ['Olio', results.oil],
          ['Starter', results.starter],
        ]}
      />

      <section className="rounded-[12px] border border-stone-200 bg-white p-6 shadow-air ring-1 ring-black/[0.02] border-l-[5px] border-l-proof-600">
        <div className="mb-5 flex items-center gap-4 text-[24px] font-semibold text-proof-700">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-proof-100 text-proof-700">
            <BowlIcon size={28} strokeWidth={1.75} aria-hidden="true" />
          </span>
          Ingredienti da pesare
        </div>
        <div className="divide-y divide-stone-200">
          <ResultRow label="Farina da aggiungere" value={results.flourToAdd} />
          <ResultRow label="Acqua da aggiungere" value={results.waterToAdd} emphasis="green" />
          <ResultRow label="Olio da aggiungere" value={results.oil} />
        </div>
      </section>

      <ResultCard
        title="Composizione starter"
        tone="blue"
        icon={<JarIcon size={27} strokeWidth={1.75} aria-hidden="true" />}
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
  tone,
}: {
  title: string;
  icon: ReactNode;
  rows: Array<[string, number, boolean?]>;
  tone: 'amber' | 'blue';
}) {
  const toneClasses =
    tone === 'amber'
      ? 'border-l-amber-600 text-amber-700 bg-amber-50'
      : 'border-l-blue-600 text-blue-700 bg-blue-50';

  return (
    <section className={`rounded-[12px] border border-stone-200 border-l-[5px] bg-white p-6 shadow-air ring-1 ring-black/[0.02] ${toneClasses.split(' ')[0]}`}>
      <div className={`mb-5 flex items-center gap-4 text-[24px] font-semibold ${tone === 'amber' ? 'text-ink' : 'text-blue-700'}`}>
        <span className={`grid h-12 w-12 place-items-center rounded-full ${toneClasses.split(' ').slice(1).join(' ')}`}>
          {icon}
        </span>
        {title}
      </div>
      <div className="divide-y divide-stone-200">
        {rows.map(([label, value, highlight]) => (
          <ResultRow key={label} label={label} value={value} emphasis={highlight ? 'green' : undefined} />
        ))}
      </div>
    </section>
  );
}

function ResultRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: 'green';
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className={`text-[18px] ${emphasis === 'green' ? 'font-semibold text-proof-700' : 'text-stone-700'}`}>
        {label}
      </span>
      <span className={`whitespace-nowrap text-[20px] font-semibold ${emphasis === 'green' ? 'text-proof-700' : 'text-ink'}`}>
        {formatGram(value)}
      </span>
    </div>
  );
}

function QuickGuidelines() {
  const guidelines = [
    {
      title: 'Idratazione',
      text: 'Più idratazione = mollica più soffice ma impasto più delicato.',
      icon: Droplets,
    },
    {
      title: 'Autolisi',
      text: '20-60 min migliorano estensibilità e sviluppo del glutine.',
      icon: Clock3,
    },
    {
      title: 'Temperatura impasto',
      text: 'Mantieni l\'impasto tra 24-26 °C per una fermentazione ottimale.',
      icon: Thermometer,
    },
    {
      title: 'Sale',
      text: 'Non superare 2,2% sulla farina per non rallentare la lievitazione.',
      icon: BowlIcon,
    },
    {
      title: 'Pianifica',
      text: 'Fermentazioni lente in frigo migliorano aroma e digeribilità.',
      icon: CalendarDays,
    },
  ];

  return (
    <section className="rounded-[12px] border border-stone-200 bg-white/88 p-5 shadow-air">
      <div className="mb-5 flex items-center gap-3 text-[22px] font-semibold text-ink">
        <span className="text-amber-700">
          <BulbIcon size={28} strokeWidth={1.75} aria-hidden="true" />
        </span>
        Linee guida rapide
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {guidelines.map((guideline) => {
          const Icon = guideline.icon;
          return (
            <article key={guideline.title} className="flex gap-4 border-stone-200 xl:border-l xl:pl-5 first:border-l-0 first:pl-0">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-800 ring-1 ring-amber-100">
                <Icon size={28} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-ink">{guideline.title}</h2>
                <p className="mt-2 text-sm leading-5 text-stone-600">{guideline.text}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function BreadIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M5 21.5c0-6.2 4.3-10.7 9.5-10.7 1.7-3.9 7-4.4 9.2-.9 3.2.5 5.3 3.3 5.3 6.7 0 4.2-3.1 7.4-7.5 7.4H8.4C6.5 24 5 22.9 5 21.5Z" />
      <path d="M14.7 11.1c-.6 1.3-.9 2.7-.7 4.1" />
      <path d="M21.1 9.4c.6 1.4.7 3 .2 4.5" />
    </svg>
  );
}

function FocacciaIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <circle cx="16" cy="16" r="10.5" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="19.8" cy="11.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="21" cy="18.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="13.6" cy="21" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.7" cy="16.2" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SaltIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M12 8.5h8" />
      <path d="M13 8.5v4.2l-2.1 3.1a5 5 0 0 0-.8 2.7v6.2c0 1.4 1.1 2.5 2.5 2.5h6.8c1.4 0 2.5-1.1 2.5-2.5v-6.2c0-1-.3-1.9-.8-2.7L19 12.7V8.5" />
      <path d="M11 18.5h10" />
      <path d="M14 5.5h4" />
    </svg>
  );
}

function JarIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M11 8h10" />
      <path d="M12 5.5h8" />
      <path d="M12 8v3.1c-1.4.9-2.2 2.4-2.2 4v9.1c0 1.6 1.3 2.8 2.8 2.8h6.8c1.6 0 2.8-1.3 2.8-2.8v-9.1c0-1.7-.8-3.2-2.2-4V8" />
      <path d="M10 17.3h12" />
      <path d="M13.4 21h5.2" />
    </svg>
  );
}

function OilIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M16 5.5c4.2 4.8 7 8.7 7 12.7a7 7 0 0 1-14 0c0-4 2.8-7.9 7-12.7Z" />
      <path d="M13.3 20.4c.7 1.2 1.7 1.8 3.1 1.8" />
    </svg>
  );
}

function BagIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M10.5 12.5h11L24 26H8l2.5-13.5Z" />
      <path d="M12.5 12.5c0-3 1.5-5 3.5-5s3.5 2 3.5 5" />
      <path d="M13.2 18.6c1.8-1.3 3.8-1.3 5.6 0" />
      <path d="M14.4 22.1h3.2" />
    </svg>
  );
}

function BowlIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M7 14h18c-.5 6.7-4 10.5-9 10.5S7.5 20.7 7 14Z" />
      <path d="M10 24.5h12" />
      <path d="M11 10c1.6 1.2 3.2 1.2 5 0s3.4-1.2 5 0" />
    </svg>
  );
}

function BulbIcon({ size = 24, strokeWidth = 1.8, className, 'aria-hidden': ariaHidden }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M16 5.5a8 8 0 0 0-4.2 14.8c.8.5 1.2 1.4 1.2 2.3v.4h6v-.4c0-1 .5-1.8 1.3-2.3A8 8 0 0 0 16 5.5Z" />
      <path d="M13 26h6" />
      <path d="M14 29h4" />
      <path d="M16 2.5v1.2" />
      <path d="m6.9 7.4.9.9" />
      <path d="m25.1 7.4-.9.9" />
    </svg>
  );
}

function formatGram(value: number) {
  return `${roundGram(value)} g`;
}

export default App;
