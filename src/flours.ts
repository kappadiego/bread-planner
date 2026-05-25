export type FlourAbsorptionLevel = 'low' | 'medium' | 'high' | 'very-high';

export type FlourStrengthLevel = 'low' | 'medium' | 'high' | 'very-high' | 'special';

export type GlutenBehavior = 'weak' | 'balanced' | 'tenacious' | 'different';

export type FlourProfile = {
  id: string;
  label: string;
  description: string;
  defaultProteinPercentage?: number;
  absorptionLevel: FlourAbsorptionLevel;
  strengthLevel: FlourStrengthLevel;
  glutenBehavior: GlutenBehavior;
};

export type FlourMixItem = {
  id: string;
  flourProfileId: string;
  customName?: string;
  percentage: number;
  proteinPercentage?: number;
};

export type FlourMixMode = 'single' | 'mix';

export type FlourMix = {
  id: string;
  name: string;
  mode: FlourMixMode;
  items: FlourMixItem[];
};

export type FlourBreakdownRow = {
  id: string;
  label: string;
  description: string;
  percentage: number;
  grams: number;
  proteinPercentage?: number;
};

export const flourProfiles: FlourProfile[] = [
  {
    id: '00-weak',
    label: 'Tipo 0 / 00',
    description: 'Assorbimento medio-basso, adatta a impasti base e lavorazioni semplici.',
    absorptionLevel: 'low',
    strengthLevel: 'low',
    glutenBehavior: 'weak',
  },
  {
    id: '0-bread',
    label: '0 / pane',
    description: 'Farina versatile per pane quotidiano e lievitazioni medie.',
    absorptionLevel: 'medium',
    strengthLevel: 'medium',
    glutenBehavior: 'balanced',
  },
  {
    id: 'type-1',
    label: 'Tipo 1',
    description: 'Farina semi-integrale con buon assorbimento e aroma più presente.',
    absorptionLevel: 'high',
    strengthLevel: 'medium',
    glutenBehavior: 'balanced',
  },
  {
    id: 'type-2',
    label: 'Tipo 2',
    description: 'Farina rustica, più ricca di crusca e adatta a impasti saporiti.',
    absorptionLevel: 'high',
    strengthLevel: 'medium',
    glutenBehavior: 'balanced',
  },
  {
    id: 'whole-wheat',
    label: 'Integrale',
    description: 'Farina completa con alto assorbimento e struttura più delicata.',
    absorptionLevel: 'very-high',
    strengthLevel: 'medium',
    glutenBehavior: 'balanced',
  },
  {
    id: 'manitoba',
    label: 'Manitoba',
    description: 'Farina forte per rinforzare impasti lunghi o molto idratati.',
    absorptionLevel: 'high',
    strengthLevel: 'very-high',
    glutenBehavior: 'tenacious',
  },
  {
    id: 'semola',
    label: 'Semola rimacinata',
    description: 'Farina di grano duro, tenace e profumata.',
    absorptionLevel: 'high',
    strengthLevel: 'special',
    glutenBehavior: 'tenacious',
  },
  {
    id: 'spelt',
    label: 'Farro',
    description: 'Farina aromatica con glutine più fragile rispetto al grano tenero.',
    absorptionLevel: 'medium',
    strengthLevel: 'special',
    glutenBehavior: 'different',
  },
  {
    id: 'rye',
    label: 'Segale',
    description: 'Farina con comportamento diverso, poco elastica e molto assorbente.',
    absorptionLevel: 'very-high',
    strengthLevel: 'special',
    glutenBehavior: 'different',
  },
  {
    id: 'custom',
    label: 'Farina custom',
    description: 'Profilo libero per farine non ancora classificate.',
    absorptionLevel: 'medium',
    strengthLevel: 'medium',
    glutenBehavior: 'balanced',
  },
];

const FLOUR_MIX_TOLERANCE = 0.1;

const safeNumber = (value: number) => (Number.isFinite(value) ? Math.max(value, 0) : 0);

export const getFlourProfile = (profileId: string) =>
  flourProfiles.find((profile) => profile.id === profileId) ?? flourProfiles[0];

export const getFlourMixTotalPercentage = (flourMix: FlourMix) =>
  flourMix.items.reduce((total, item) => total + safeNumber(item.percentage), 0);

export const isFlourMixValid = (flourMix: FlourMix) => {
  const total = getFlourMixTotalPercentage(flourMix);
  return (
    flourMix.items.length > 0 &&
    flourMix.items.every((item) => Number.isFinite(item.percentage) && item.percentage >= 0) &&
    total >= 100 - FLOUR_MIX_TOLERANCE &&
    total <= 100 + FLOUR_MIX_TOLERANCE
  );
};

export const calculateFlourBreakdown = (flourTotal: number, flourMix: FlourMix): FlourBreakdownRow[] => {
  const safeFlourTotal = safeNumber(flourTotal);

  return flourMix.items.map((item) => {
    const profile = getFlourProfile(item.flourProfileId);
    const percentage = safeNumber(item.percentage);
    return {
      id: item.id,
      label: item.customName?.trim() || profile.label,
      description: profile.description,
      percentage,
      grams: safeFlourTotal * percentage / 100,
      proteinPercentage: item.proteinPercentage,
    };
  });
};

export const getWeightedProteinPercentage = (flourMix: FlourMix) => {
  const itemsWithProtein = flourMix.items.filter(
    (item) => Number.isFinite(item.proteinPercentage) && safeNumber(item.percentage) > 0,
  );

  if (itemsWithProtein.length !== flourMix.items.filter((item) => safeNumber(item.percentage) > 0).length) {
    return undefined;
  }

  const totalPercentage = itemsWithProtein.reduce((total, item) => total + safeNumber(item.percentage), 0);
  if (totalPercentage === 0) {
    return undefined;
  }

  return itemsWithProtein.reduce(
    (total, item) => total + safeNumber(item.percentage) * safeNumber(item.proteinPercentage ?? 0),
    0,
  ) / totalPercentage;
};

export const getFlourMixHints = (flourMix: FlourMix) => {
  const profiles = flourMix.items.map((item) => getFlourProfile(item.flourProfileId));
  const hints = new Set<string>();

  if (profiles.some((profile) => profile.absorptionLevel === 'high' || profile.absorptionLevel === 'very-high')) {
    hints.add('Alcune farine del mix possono assorbire più acqua.');
  }

  if (profiles.some((profile) => profile.strengthLevel === 'very-high')) {
    hints.add('La presenza di farina forte può aiutare impasti lunghi o strutturati.');
  }

  if (profiles.some((profile) => profile.glutenBehavior === 'different')) {
    hints.add('Alcune farine hanno un comportamento diverso dal grano tenero.');
  }

  return Array.from(hints);
};
