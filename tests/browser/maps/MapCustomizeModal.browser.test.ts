// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { MapCustomizeModal } from '../../../components/maps/MapCustomizeModal';
import {
  MAP_PREFERENCE_PRESETS,
  matchMapPreferencePreset,
  resolveMapPreferences,
  type ResolvedMapPreferences,
} from '../../../shared/mapPreferences';

/**
 * The preferences a freshly-opened trip carries, which match the "default"
 * whole-panel preset. That is the case the "Mine" bug lived in.
 */
const defaultPreferences = (): ResolvedMapPreferences => ({
  ...resolveMapPreferences({ viewSettings: {}, userSettings: null }),
  ...(MAP_PREFERENCE_PRESETS.find((preset) => preset.id === 'default')?.values ?? {}),
} as ResolvedMapPreferences);

const baseProps = () => ({
  isOpen: true,
  onClose: vi.fn(),
  preferences: defaultPreferences(),
  onChange: vi.fn(),
  onReset: vi.fn(),
  onSaveAsDefault: vi.fn(),
  hasSavedPreset: true,
  onApplySavedPreset: vi.fn(),
  isMobile: true,
  activeRenderer: 'mapbox' as const,
  tripId: 'trip-1',
});

/** 'custom' is the value the "Mine" segment carries. */
const findPresetRadio = (value: string): HTMLInputElement => {
  const node = document.querySelector(`input[name="map-preference-preset"][value="${value}"]`);
  if (!node) throw new Error(`no preset radio for "${value}"`);
  return node as HTMLInputElement;
};

describe('components/maps/MapCustomizeModal', () => {
  it('confirms the fixture really does match a named preset', () => {
    // Otherwise the regression below would pass for the wrong reason.
    expect(matchMapPreferencePreset(defaultPreferences())).toBe('default');
  });

  it('keeps "Mine" selected after it is picked, even when the values also match Default', () => {
    /**
     * The selection used to be derived purely from the values. A saved preset
     * does not carry routeMode, showCityNames or colorMode — they live on the
     * view settings — so restoring it can land on exactly the named preset the
     * traveller was already on, and the control snapped straight back to
     * "Default". From the phone that read as a tap that had been ignored, and
     * the only way to make it stick was to pass through "Minimal" first.
     */
    const props = baseProps();
    const { rerender } = render(React.createElement(MapCustomizeModal, props));

    fireEvent.click(findPresetRadio('custom'));
    expect(props.onApplySavedPreset).toHaveBeenCalledTimes(1);

    // The owner answers by flipping isSavedPresetActive; the preferences are
    // unchanged, because the saved preset restored to the same values.
    rerender(React.createElement(MapCustomizeModal, { ...props, isSavedPresetActive: true }));

    expect(findPresetRadio('custom').checked).toBe(true);
    expect(findPresetRadio('default').checked).toBe(false);
  });

  it('keeps the footer a single row of short buttons', () => {
    // It used to wrap. Three buttons stacked vertically at the bottom of a
    // phone sheet read as three unrelated controls rather than one footer, and
    // "Save as my preset" was what pushed the row over the edge.
    render(React.createElement(MapCustomizeModal, baseProps()));

    const save = screen.getByRole('button', { name: /save/i });
    expect(save.textContent?.trim()).toBe('Save');
    expect(save).toHaveAttribute('title');

    const footerRow = save.closest('div')?.parentElement;
    expect(footerRow?.className ?? '').not.toContain('flex-wrap');
  });

  it('gives the sheet one height cap and keeps the footer inside it', () => {
    /**
     * The sheet capped itself at 64vh and then stacked a 58vh body, a title and
     * a footer inside that cap, so it always asked for more room than it was
     * allowed and the footer was clipped off the bottom of the screen. `vh` was
     * the second half of it: on iOS that is the tallest the viewport ever gets,
     * so the sheet reached below the visible display.
     */
    render(React.createElement(MapCustomizeModal, baseProps()));

    const sheet = screen.getByTestId('map-customize-sheet');
    expect(sheet.className).toContain('dvh');
    expect(sheet.className).not.toContain('vh]');
    expect(sheet.className).toContain('flex');

    const body = sheet.querySelector('[data-slot], div');
    expect(body?.className ?? '').not.toContain('max-h-[58vh]');
  });
});
