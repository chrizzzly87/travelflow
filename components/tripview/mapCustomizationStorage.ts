import { readLocalStorageItem, writeLocalStorageItem } from '../../services/browserStorageService';
import { normalizeMapCustomization } from '../../shared/mapPreferences';
import type { IMapCustomization } from '../../types';

/**
 * The traveller's own default map look, written only by "save as my default"
 * and read when a trip carries no look of its own.
 *
 * Device-level for now. Syncing it across devices needs a `map_customization`
 * column on `user_settings`, and this repo never applies a migration from a
 * deploy — adding the column to the upsert before it exists would break saving
 * every other user setting in production. Tracked as a follow-up in
 * `docs/superpowers/specs/2026-09-18-map-provider-customization-design.md`.
 */
export const MAP_CUSTOMIZATION_DEFAULT_KEY = 'tf_map_customization_default_v1';

export const readUserDefaultMapCustomization = (): IMapCustomization => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = readLocalStorageItem(MAP_CUSTOMIZATION_DEFAULT_KEY);
    return stored ? normalizeMapCustomization(JSON.parse(stored)) : {};
  } catch {
    // A quota-blocked or disabled store is not worth failing a trip over: the
    // traveller simply opens on the app defaults.
    return {};
  }
};

/**
 * Whether a preset has been saved at all.
 *
 * Distinct from "the preset has any fields in it": a preset that matches every
 * app default serialises to `{}`, and reading that back as "nothing saved"
 * would hide the traveller's own entry after the button said it had saved.
 */
export const hasUserDefaultMapCustomization = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return readLocalStorageItem(MAP_CUSTOMIZATION_DEFAULT_KEY) !== null;
  } catch {
    return false;
  }
};

export const writeUserDefaultMapCustomization = (customization: IMapCustomization): boolean => (
  writeLocalStorageItem(MAP_CUSTOMIZATION_DEFAULT_KEY, JSON.stringify(customization))
);
