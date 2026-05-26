import { Circle, Snowflake, Sun, Thermometer } from 'lucide-react';
import {
  ambientTemperatureOptions,
  type AmbientTemperatureId,
} from '../ambientTemperature';

type AmbientTemperatureSelectorProps = {
  value: AmbientTemperatureId;
  onChange: (value: AmbientTemperatureId) => void;
};

export function AmbientTemperatureSelector({
  value,
  onChange,
}: AmbientTemperatureSelectorProps) {
  const temperatureIcons = {
    cold: Snowflake,
    normal: Circle,
    warm: Sun,
  };

  return (
    <section className="mt-6 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Thermometer size={25} strokeWidth={1.85} className="shrink-0 text-stone-900" aria-hidden="true" />
        <h2 className="text-base font-semibold text-ink">Temperatura ambiente</h2>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3" role="group" aria-label="Temperatura ambiente">
        {ambientTemperatureOptions.map((option) => {
          const Icon = temperatureIcons[option.id];
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-lg border px-3 py-3 text-center transition focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-100 ${
                value === option.id
                  ? 'border-amber-600 bg-amber-50 text-amber-800 shadow-sm'
                  : 'border-stone-300 bg-white text-stone-700 hover:border-amber-300 hover:bg-amber-50/40'
              }`}
              aria-label={`${option.label}, ${option.rangeLabel}. ${option.description}`}
              aria-pressed={value === option.id}
            >
              <Icon size={25} strokeWidth={1.8} aria-hidden="true" />
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-xs font-medium text-stone-500">{option.rangeLabel}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
