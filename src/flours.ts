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
  percentage: number;
  proteinPercentage?: number;
};

export type FlourMix = {
  id: string;
  name: string;
  items: FlourMixItem[];
};

export const flourProfiles: FlourProfile[] = [
  {
    id: '00-weak',
    label: '00 / debole',
    description: 'Farina fine e debole, adatta a impasti brevi e prodotti delicati.',
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
    label: 'Altro / custom',
    description: 'Profilo libero per farine non ancora classificate.',
    absorptionLevel: 'medium',
    strengthLevel: 'medium',
    glutenBehavior: 'balanced',
  },
];
