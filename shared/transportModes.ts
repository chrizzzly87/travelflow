export const TRANSPORT_MODE_VALUES = [
  'plane',
  'train',
  'bus',
  'boat',
  'car',
  'walk',
  'bicycle',
  'motorcycle',
  'na',
] as const;

export type TransportMode = (typeof TRANSPORT_MODE_VALUES)[number];

export const MODEL_TRANSPORT_MODE_VALUES = TRANSPORT_MODE_VALUES.filter(
  (mode): mode is Exclude<TransportMode, 'na'> => mode !== 'na'
);

export const TRANSPORT_MODE_UI_ORDER: readonly TransportMode[] = [
  'na',
  'plane',
  'train',
  'bus',
  'car',
  'motorcycle',
  'bicycle',
  'walk',
  'boat',
];

const TRANSPORT_MODE_SET = new Set<string>(TRANSPORT_MODE_VALUES);

const TRANSPORT_MODE_ALIASES: Record<string, TransportMode> = {
  plane: 'plane',
  flight: 'plane',
  flights: 'plane',
  airline: 'plane',
  airplane: 'plane',
  aeroplane: 'plane',
  air: 'plane',

  train: 'train',
  rail: 'train',
  railway: 'train',
  metro: 'train',
  subway: 'train',
  tram: 'train',
  shinkansen: 'train',

  bus: 'bus',
  coach: 'bus',
  shuttle: 'bus',

  boat: 'boat',
  ferry: 'boat',
  ship: 'boat',
  cruise: 'boat',

  car: 'car',
  auto: 'car',
  automobile: 'car',
  taxi: 'car',
  uber: 'car',
  drive: 'car',
  driving: 'car',

  walk: 'walk',
  walking: 'walk',
  foot: 'walk',
  onfoot: 'walk',

  bicycle: 'bicycle',
  bike: 'bicycle',
  biking: 'bicycle',
  cycle: 'bicycle',
  cycling: 'bicycle',

  motorcycle: 'motorcycle',
  motorbike: 'motorcycle',
  scooter: 'motorcycle',
  moto: 'motorcycle',

  na: 'na',
  'n a': 'na',
  none: 'na',
  unknown: 'na',
  unset: 'na',
  notset: 'na',
  notspecified: 'na',
  notavailable: 'na',
};

const normalizeAliasKey = (value: string): string => {
  return value
    .toLocaleLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const compactAliasKey = (value: string): string => value.replace(/\s+/g, '');

export interface ParsedTransportMode {
  mode: TransportMode;
  recognized: boolean;
  rawValue: string;
}

export const parseTransportMode = (value: unknown): ParsedTransportMode => {
  const rawValue = typeof value === 'string' ? value.trim() : '';
  if (!rawValue) {
    return { mode: 'na', recognized: false, rawValue };
  }

  const normalized = normalizeAliasKey(rawValue);
  if (TRANSPORT_MODE_SET.has(normalized)) {
    return {
      mode: normalized as TransportMode,
      recognized: true,
      rawValue,
    };
  }

  const directAlias = TRANSPORT_MODE_ALIASES[normalized];
  if (directAlias) {
    return {
      mode: directAlias,
      recognized: true,
      rawValue,
    };
  }

  const compact = compactAliasKey(normalized);
  const compactAlias = TRANSPORT_MODE_ALIASES[compact];
  if (compactAlias) {
    return {
      mode: compactAlias,
      recognized: true,
      rawValue,
    };
  }

  return {
    mode: 'na',
    recognized: false,
    rawValue,
  };
};

export const normalizeTransportMode = (value: unknown): TransportMode =>
  parseTransportMode(value).mode;

export const buildTransportModePromptGuidance = (): string => {
  const allowed = MODEL_TRANSPORT_MODE_VALUES.join(', ');
  return `
      Transport mode contract (strict):
      - travelSegments.transportMode MUST be a lowercase string from this list only:
        [${allowed}]
      - Valid examples:
        {"transportMode":"train"}
        {"transportMode":"plane"}
      - Invalid examples:
        {"transportMode":"Train"}
        {"transportMode":"rail"}
        {"transportMode":"flight"}
    `;
};
