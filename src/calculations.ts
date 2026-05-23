export type FormulaPercentages = {
  hydration: number;
  saltPercentage: number;
  starterPercentage: number;
  starterHydration: number;
  oilPercentage: number;
};

export type BatchTarget = {
  flourTotal: number;
};

export type BreadInputs = BatchTarget & FormulaPercentages;

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
  estimatedDoughWeight: number;
  estimatedFinalWeight: number;
  hasNegativeAdditions: boolean;
};

const safeNumber = (value: number) => (Number.isFinite(value) ? Math.max(value, 0) : 0);

export const calculateBread = (inputs: BreadInputs): BreadResults => {
  const flourTotal = safeNumber(inputs.flourTotal);
  const hydration = safeNumber(inputs.hydration);
  const saltPercentage = safeNumber(inputs.saltPercentage);
  const starterPercentage = safeNumber(inputs.starterPercentage);
  const starterHydration = safeNumber(inputs.starterHydration);
  const oilPercentage = safeNumber(inputs.oilPercentage);

  const waterTotal = flourTotal * hydration / 100;
  const salt = flourTotal * saltPercentage / 100;
  const oil = flourTotal * oilPercentage / 100;
  const starter = flourTotal * starterPercentage / 100;
  const starterFlour = starter / (1 + starterHydration / 100);
  const starterWater = starter - starterFlour;
  const flourToAdd = flourTotal;
  const waterToAdd = waterTotal;
  const estimatedDoughWeight = flourTotal + waterTotal + starter + salt + oil;

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
    estimatedDoughWeight,
    estimatedFinalWeight: estimatedDoughWeight,
    hasNegativeAdditions: false,
  };
};

export const roundGram = (value: number) => Math.round(value);
