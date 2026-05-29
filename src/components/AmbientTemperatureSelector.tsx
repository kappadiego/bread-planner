import { Circle, Snowflake, Sun, Thermometer } from 'lucide-react';
import {
  ambientTemperatureOptions,
  type AmbientTemperatureId,
} from '../ambientTemperature';

type AmbientTemperatureSelectorProps = {
  value: AmbientTemperatureId;
  onChange: (value: AmbientTemperatureId) => void;
  description?: string;
};

export function AmbientTemperatureSelector({
  value,
  onChange,
  description,
}: AmbientTemperatureSelectorProps) {
  const temperatureIcons = {
    cold: Snowflake,
    normal: Circle,
    warm: Sun,
  };

  return (
    <section className="rounded-2xl border border-[#322e2b14] bg-[#fffdf8] p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream/65 text-ink ring-1 ring-[#322e2b12]">
          <Thermometer size={24} strokeWidth={1.85} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink">Temperatura ambiente</h2>
          {description && (
            <p className="mt-1 text-sm leading-5 text-[#6f6257]">{description}</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3" role="group" aria-label="Temperatura ambiente">
        {ambientTemperatureOptions.map((option) => {
          const Icon = temperatureIcons[option.id];
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-center transition focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(178,104,55,0.18)] ${
                value === option.id
                  ? 'border-crust/65 bg-cream text-ink shadow-sm'
                  : 'border-[#322e2b20] bg-white text-[#6f6257] hover:border-crust/35 hover:bg-cream/35'
              }`}
              aria-label={`${option.label}, ${option.rangeLabel}. ${option.description}`}
              aria-pressed={value === option.id}
            >
              <Icon size={25} strokeWidth={1.8} aria-hidden="true" />
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="text-xs font-medium text-[#6f6257]">{option.rangeLabel}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
