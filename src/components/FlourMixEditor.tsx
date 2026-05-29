import { CirclePlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FlourMix } from '../flours';
import {
  calculateFlourBreakdown,
  flourProfiles,
  getFlourMixHints,
  getFlourProfile,
  getWeightedProteinPercentage,
} from '../flours';

type FlourMixEditorProps = {
  flourTotal: number;
  flourMix: FlourMix;
  flourPrompt: string;
  mixStatus: string;
  isMixValid: boolean;
  onChange: (flourMix: FlourMix) => void;
  onClose: () => void;
};

type MixInputUnit = '%' | 'g';

const createMixItem = (index: number, percentage = 0) => ({
  id: `flour-${Date.now()}-${index}`,
  flourProfileId: index === 0 ? '0-bread' : 'manitoba',
  percentage,
});

const formatPercent = (value: number) => {
  return String(Math.round(value));
};

export function FlourMixEditor({
  flourTotal,
  flourMix,
  flourPrompt,
  mixStatus,
  isMixValid,
  onChange,
  onClose,
}: FlourMixEditorProps) {
  const [unitModes, setUnitModes] = useState<Record<string, MixInputUnit>>({});
  const [gramValues, setGramValues] = useState<Record<string, number>>({});
  const breakdown = calculateFlourBreakdown(flourTotal, flourMix);
  const weightedProtein = getWeightedProteinPercentage(flourMix);
  const hints = getFlourMixHints(flourMix);
  const firstItem = flourMix.items[0] ?? createMixItem(0, 100);
  const firstProfile = getFlourProfile(firstItem.flourProfileId);

  const updateMix = (nextMix: FlourMix) => {
    onChange(nextMix);
  };

  const gramsFromPercent = (percentage: number) => Math.max(flourTotal, 0) * Math.max(percentage, 0) / 100;
  const percentFromGrams = (grams: number) => (flourTotal > 0 ? Math.max(grams, 0) / flourTotal * 100 : 0);
  const getUnitMode = (itemId: string): MixInputUnit => unitModes[itemId] ?? '%';
  const getGramValue = (item: FlourMix['items'][number]) => gramValues[item.id] ?? gramsFromPercent(item.percentage);

  const setItemUnitMode = (item: FlourMix['items'][number], unit: MixInputUnit) => {
    if (getUnitMode(item.id) === unit) {
      return;
    }

    if (unit === 'g') {
      setGramValues((current) => ({ ...current, [item.id]: gramsFromPercent(item.percentage) }));
      setUnitModes((current) => ({ ...current, [item.id]: 'g' }));
      return;
    }

    const nextPercentage = percentFromGrams(getGramValue(item));
    setUnitModes((current) => ({ ...current, [item.id]: '%' }));
    updateItem(item.id, { percentage: nextPercentage });
  };

  const setMode = (mode: FlourMix['mode']) => {
    if (mode === flourMix.mode) {
      return;
    }

    if (mode === 'single') {
      updateMix({
        ...flourMix,
        mode,
        items: [{ ...firstItem, percentage: 100 }],
      });
      return;
    }

    updateMix({
      ...flourMix,
      mode,
      items: [
        { ...firstItem, percentage: 70 },
        {
          id: `flour-${Date.now()}-1`,
          flourProfileId: 'manitoba',
          percentage: 30,
        },
      ],
    });
  };

  const updateItem = (itemId: string, changes: Partial<FlourMix['items'][number]>) => {
    updateMix({
      ...flourMix,
      items: flourMix.items.map((item) => (item.id === itemId ? { ...item, ...changes } : item)),
    });
  };

  const updateItemAmount = (item: FlourMix['items'][number], value: number) => {
    const safeValue = Math.max(value, 0);
    if (getUnitMode(item.id) === 'g') {
      setGramValues((current) => ({ ...current, [item.id]: safeValue }));
      updateItem(item.id, { percentage: percentFromGrams(safeValue) });
      return;
    }

    updateItem(item.id, { percentage: safeValue });
  };

  const addItem = () => {
    updateMix({
      ...flourMix,
      mode: 'mix',
      items: [...flourMix.items, createMixItem(flourMix.items.length, 0)],
    });
  };

  const removeItem = (itemId: string) => {
    if (flourMix.items.length <= 2) {
      return;
    }

    updateMix({
      ...flourMix,
      items: flourMix.items.filter((item) => item.id !== itemId),
    });
  };

  return (
    <section className="border-t border-[#322e2b14] bg-[#fffdf8] p-4">
      <div className="mb-4 grid gap-3">
        <p className="text-sm leading-5 text-[#6f6257]">{flourPrompt}</p>
        <p className={`rounded-2xl px-3 py-2 text-sm font-semibold ${isMixValid ? 'bg-proof-50 text-proof-700 ring-1 ring-proof-100' : 'bg-wheat-50 text-ink ring-1 ring-wheat-200'}`}>
          {mixStatus}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid w-full max-w-[260px] grid-cols-2 overflow-hidden rounded-full border border-[#322e2b18] bg-cream/35 p-1 text-sm font-semibold">
          {(['single', 'mix'] as FlourMix['mode'][]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMode(mode)}
              className={`min-h-9 rounded-full px-3 transition ${
                flourMix.mode === mode ? 'bg-white text-crust shadow-sm ring-1 ring-crust/20' : 'text-[#6f6257] hover:text-ink'
              }`}
              aria-pressed={flourMix.mode === mode}
            >
              {mode === 'single' ? 'Una farina' : 'Mix farine'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 rounded-full border border-[#322e2b18] bg-white px-3 text-sm font-semibold text-[#6f6257] transition hover:border-crust/35 hover:bg-cream/40 hover:text-ink sm:ml-auto"
        >
          Chiudi
        </button>
      </div>

      {flourMix.mode === 'single' ? (
        <div className="mt-4 grid gap-3 rounded-2xl border border-[#322e2b14] bg-cream/30 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Tipo farina
            <select
              value={firstItem.flourProfileId}
              onChange={(event) => updateMix({ ...flourMix, items: [{ ...firstItem, flourProfileId: event.currentTarget.value, percentage: 100 }] })}
              className="min-h-11 rounded-2xl border border-[#322e2b24] bg-white px-3 text-base font-medium text-ink outline-none focus:border-crust focus:ring-4 focus:ring-[rgba(178,104,55,0.18)]"
            >
              {flourProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setMode('mix')}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-crust/25 bg-cream px-4 text-sm font-semibold text-crust transition hover:border-crust/45 hover:bg-wheat-50"
          >
            <CirclePlus size={18} aria-hidden="true" />
            Crea un mix
          </button>
          <p className="text-sm leading-5 text-[#6f6257] sm:col-span-2">{firstProfile.description}</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {flourMix.items.map((item, index) => {
            const row = breakdown.find((breakdownRow) => breakdownRow.id === item.id);
            const rowId = `flour-mix-${item.id}`;
            const unitMode = getUnitMode(item.id);
            const amountValue = unitMode === 'g' ? Math.round(getGramValue(item)) : Math.round(item.percentage);
            return (
              <div key={item.id} className="grid min-w-0 gap-3 rounded-2xl border border-[#322e2b14] bg-cream/30 p-3 md:grid-cols-2 md:items-end">
                <label className="grid gap-2 text-sm font-semibold text-ink">
                  Farina {index + 1}
                  <select
                    id={`${rowId}-profile`}
                    value={item.flourProfileId}
                    onChange={(event) => updateItem(item.id, { flourProfileId: event.currentTarget.value })}
                    className="min-h-11 rounded-2xl border border-[#322e2b24] bg-white px-3 text-base font-medium text-ink outline-none focus:border-crust focus:ring-4 focus:ring-[rgba(178,104,55,0.18)]"
                  >
                    {flourProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-semibold text-ink">
                  Quantità
                  <span className="flex min-h-11 overflow-hidden rounded-2xl border border-[#322e2b24] bg-white focus-within:border-crust focus-within:ring-4 focus-within:ring-[rgba(178,104,55,0.18)]">
                    <input
                      id={`${rowId}-percentage`}
                      type="number"
                      min="0"
                      step={1}
                      value={amountValue}
                      onChange={(event) => updateItemAmount(item, event.currentTarget.valueAsNumber || 0)}
                      className="min-w-0 flex-1 bg-transparent px-3 text-base font-medium text-ink outline-none"
                    />
                    <span className="flex items-center gap-1 border-l border-[#322e2b14] bg-cream/35 p-1">
                      {(['%', 'g'] as MixInputUnit[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setItemUnitMode(item, option)}
                          className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-xs font-semibold transition ${
                            unitMode === option
                              ? 'bg-white text-crust shadow-sm ring-1 ring-crust/20'
                              : 'text-[#6f6257] hover:text-ink'
                          }`}
                          aria-pressed={unitMode === option}
                        >
                          {option}
                        </button>
                      ))}
                    </span>
                  </span>
                </label>

                <div className="grid gap-2 text-sm font-semibold text-ink">
                  Grammi
                  <div className="grid min-h-11 place-items-center rounded-2xl border border-[#322e2b14] bg-white px-3 text-base font-semibold text-ink">
                    {Math.round(row?.grams ?? 0)} g
                  </div>
                </div>

                <label className="grid gap-2 text-sm font-semibold text-ink">
                  Proteine
                  <span className="flex min-h-11 overflow-hidden rounded-2xl border border-[#322e2b24] bg-white focus-within:border-crust focus-within:ring-4 focus-within:ring-[rgba(178,104,55,0.18)]">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={typeof item.proteinPercentage === 'number' ? Math.round(item.proteinPercentage) : ''}
                      placeholder="opz."
                      onChange={(event) => updateItem(item.id, { proteinPercentage: event.currentTarget.value === '' ? undefined : Math.max(event.currentTarget.valueAsNumber || 0, 0) })}
                      className="min-w-0 flex-1 bg-transparent px-3 text-base font-medium text-ink outline-none placeholder:text-[#9b9188]"
                    />
                    <span className="grid w-9 place-items-center border-l border-[#322e2b14] bg-cream/30 text-[#6f6257]">%</span>
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={flourMix.items.length <= 2}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#322e2b18] bg-white px-3 text-sm font-semibold text-[#6f6257] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-45 md:col-span-2"
                  aria-label={`Rimuovi farina ${index + 1}`}
                >
                  <Trash2 size={17} aria-hidden="true" />
                  Rimuovi
                </button>
              </div>
            );
          })}

          <div>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-crust/25 bg-cream px-4 text-sm font-semibold text-crust transition hover:border-crust/45 hover:bg-wheat-50"
            >
              <CirclePlus size={18} aria-hidden="true" />
              Aggiungi farina
            </button>
          </div>
        </div>
      )}

      {(weightedProtein || hints.length > 0) && (
        <div className="mt-4 grid gap-2 rounded-2xl bg-cream/35 px-3 py-3 text-sm leading-5 text-[#6f6257]">
          {weightedProtein && <p>Proteine medie stimate: {formatPercent(weightedProtein)}%.</p>}
          {hints.map((hint) => (
            <p key={hint}>{hint}</p>
          ))}
        </div>
      )}
    </section>
  );
}
