export type CalculatorMode = 'flour' | 'finalWeight';

export type BreadInputs = {
  mode: CalculatorMode;
  flourTotal: number;
  finalWeight: number;
  hydration: number;
  saltPercentage: number;
  starterPercentage: number;
  starterHydration: number;
  oilPercentage: number;
};

export type BreadResults = {
  flourTotal: number;
  waterTotal: number;
  salt: number;
  oil: number;
  starter: number;
  starterFlour: number;
  starterWater: number;
  flourToAdd: number;
  waterToAdd: number;
  estimatedFinalWeight: number;
  hasNegativeAdditions: boolean;
};

const safeNumber = (value: number) => (Number.isFinite(value) ? Math.max(value, 0) : 0);

export const calculateBread = (inputs: BreadInputs): BreadResults => {
  const hydration = safeNumber(inputs.hydration);
  const saltPercentage = safeNumber(inputs.saltPercentage);
  const starterPercentage = safeNumber(inputs.starterPercentage);
  const starterHydration = safeNumber(inputs.starterHydration);
  const oilPercentage = safeNumber(inputs.oilPercentage);

  const flourTotal =
    inputs.mode === 'finalWeight'
      ? safeNumber(inputs.finalWeight) / (1 + hydration / 100 + saltPercentage / 100)
      : safeNumber(inputs.flourTotal);

  const waterTotal = flourTotal * hydration / 100;
  const salt = flourTotal * saltPercentage / 100;
  const oil = flourTotal * oilPercentage / 100;
  const starter = flourTotal * starterPercentage / 100;
  const starterFlour = starter / (1 + starterHydration / 100);
  const starterWater = starter - starterFlour;
  const flourToAdd = flourTotal - starterFlour;
  const waterToAdd = waterTotal - starterWater;

  return {
    flourTotal,
    waterTotal,
    salt,
    oil,
    starter,
    starterFlour,
    starterWater,
    flourToAdd,
    waterToAdd,
    estimatedFinalWeight: flourTotal + waterTotal + salt + oil,
    hasNegativeAdditions: flourToAdd < 0 || waterToAdd < 0,
  };
};

export const roundGram = (value: number) => Math.round(value);
