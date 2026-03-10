export const CREATE_TRIP_DATE_INPUT_MODE_VALUES = ['exact', 'flex'] as const;
export type CreateTripDateInputMode = (typeof CREATE_TRIP_DATE_INPUT_MODE_VALUES)[number];

export const CREATE_TRIP_FLEX_WINDOW_VALUES = ['spring', 'summer', 'autumn', 'winter', 'shoulder'] as const;
export type CreateTripFlexWindow = (typeof CREATE_TRIP_FLEX_WINDOW_VALUES)[number];

export const CREATE_TRIP_TRAVELER_TYPE_VALUES = ['solo', 'couple', 'friends', 'family'] as const;
export type CreateTripTravelerType = (typeof CREATE_TRIP_TRAVELER_TYPE_VALUES)[number];

export const CREATE_TRIP_TRANSPORT_PREFERENCE_VALUES = ['auto', 'plane', 'car', 'train', 'bus', 'cycle', 'walk', 'camper'] as const;
export type CreateTripTransportPreference = (typeof CREATE_TRIP_TRANSPORT_PREFERENCE_VALUES)[number];

export const CREATE_TRIP_TRAVELER_GENDER_VALUES = ['', 'female', 'male', 'non-binary', 'prefer-not'] as const;
export type CreateTripTravelerGender = (typeof CREATE_TRIP_TRAVELER_GENDER_VALUES)[number];

export const CREATE_TRIP_TRAVELER_COMFORT_VALUES = ['social', 'balanced', 'private'] as const;
export type CreateTripTravelerComfort = (typeof CREATE_TRIP_TRAVELER_COMFORT_VALUES)[number];

export const CREATE_TRIP_FRIENDS_ENERGY_VALUES = ['chill', 'mixed', 'full-send'] as const;
export type CreateTripFriendsEnergy = (typeof CREATE_TRIP_FRIENDS_ENERGY_VALUES)[number];

export const CREATE_TRIP_COUPLE_OCCASION_VALUES = ['none', 'honeymoon', 'anniversary', 'city-break'] as const;
export type CreateTripCoupleOccasion = (typeof CREATE_TRIP_COUPLE_OCCASION_VALUES)[number];

export const CREATE_TRIP_WIZARD_BRANCH_VALUES = [
  'known_destinations_exact_dates',
  'known_destinations_flexible_dates',
  'known_dates_need_destination',
  'need_inspiration',
] as const;
export type CreateTripWizardBranch = (typeof CREATE_TRIP_WIZARD_BRANCH_VALUES)[number];

export interface CreateTripTravelerDetails {
  soloGender?: CreateTripTravelerGender;
  soloAge?: string;
  soloComfort?: CreateTripTravelerComfort;
  coupleTravelerA?: CreateTripTravelerGender;
  coupleTravelerB?: CreateTripTravelerGender;
  coupleOccasion?: CreateTripCoupleOccasion;
  friendsCount?: number;
  friendsEnergy?: CreateTripFriendsEnergy;
  familyAdults?: number;
  familyChildren?: number;
  familyBabies?: number;
}

export interface CreateTripPreferenceSignals {
  dateInputMode?: CreateTripDateInputMode;
  flexWindow?: CreateTripFlexWindow;
  flexWeeks?: number;
  startDestination?: string;
  destinationOrder?: string[];
  routeLock?: boolean;
  travelerType?: CreateTripTravelerType;
  travelerDetails?: CreateTripTravelerDetails;
  tripStyleTags?: string[];
  tripVibeTags?: string[];
  transportPreferences?: CreateTripTransportPreference[];
  hasTransportOverride?: boolean;
  specificCities?: string;
  notes?: string;
  idealMonths?: string[];
  shoulderMonths?: string[];
  recommendedDurationDays?: number;
  selectedIslandNames?: string[];
  enforceIslandOnly?: boolean;
}

export interface CreateTripPrefillDraft extends CreateTripPreferenceSignals {
  version: 1 | 2;
  wizardBranch?: CreateTripWizardBranch;
}

const toSet = <T extends string>(values: readonly T[]): Set<string> => new Set<string>(values);

const DATE_INPUT_MODE_SET = toSet(CREATE_TRIP_DATE_INPUT_MODE_VALUES);
const FLEX_WINDOW_SET = toSet(CREATE_TRIP_FLEX_WINDOW_VALUES);
const TRAVELER_TYPE_SET = toSet(CREATE_TRIP_TRAVELER_TYPE_VALUES);
const TRANSPORT_PREFERENCE_SET = toSet(CREATE_TRIP_TRANSPORT_PREFERENCE_VALUES);
const TRAVELER_GENDER_SET = toSet(CREATE_TRIP_TRAVELER_GENDER_VALUES);
const TRAVELER_COMFORT_SET = toSet(CREATE_TRIP_TRAVELER_COMFORT_VALUES);
const FRIENDS_ENERGY_SET = toSet(CREATE_TRIP_FRIENDS_ENERGY_VALUES);
const COUPLE_OCCASION_SET = toSet(CREATE_TRIP_COUPLE_OCCASION_VALUES);
const WIZARD_BRANCH_SET = toSet(CREATE_TRIP_WIZARD_BRANCH_VALUES);

export const isCreateTripDateInputMode = (value: unknown): value is CreateTripDateInputMode =>
  typeof value === 'string' && DATE_INPUT_MODE_SET.has(value);

export const isCreateTripFlexWindow = (value: unknown): value is CreateTripFlexWindow =>
  typeof value === 'string' && FLEX_WINDOW_SET.has(value);

export const isCreateTripTravelerType = (value: unknown): value is CreateTripTravelerType =>
  typeof value === 'string' && TRAVELER_TYPE_SET.has(value);

export const isCreateTripTransportPreference = (value: unknown): value is CreateTripTransportPreference =>
  typeof value === 'string' && TRANSPORT_PREFERENCE_SET.has(value);

export const isCreateTripTravelerGender = (value: unknown): value is CreateTripTravelerGender =>
  typeof value === 'string' && TRAVELER_GENDER_SET.has(value);

export const isCreateTripTravelerComfort = (value: unknown): value is CreateTripTravelerComfort =>
  typeof value === 'string' && TRAVELER_COMFORT_SET.has(value);

export const isCreateTripFriendsEnergy = (value: unknown): value is CreateTripFriendsEnergy =>
  typeof value === 'string' && FRIENDS_ENERGY_SET.has(value);

export const isCreateTripCoupleOccasion = (value: unknown): value is CreateTripCoupleOccasion =>
  typeof value === 'string' && COUPLE_OCCASION_SET.has(value);

export const isCreateTripWizardBranch = (value: unknown): value is CreateTripWizardBranch =>
  typeof value === 'string' && WIZARD_BRANCH_SET.has(value);
