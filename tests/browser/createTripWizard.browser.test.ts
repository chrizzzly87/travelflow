// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  startClientAsyncTripGeneration: vi.fn().mockResolvedValue({}),
  createTripGenerationRequest: vi.fn(),
  ensureDbSession: vi.fn().mockResolvedValue('session-1'),
  confirm: vi.fn().mockResolvedValue(false),
  getTripReadyNotificationPermission: vi.fn().mockReturnValue('default' as NotificationPermission),
  requestTripReadyNotificationPermission: vi.fn().mockResolvedValue('granted' as NotificationPermission),
  authState: {
    isAuthenticated: true,
  },
}));

vi.mock('../../components/navigation/SiteHeader', () => ({
  SiteHeader: () => React.createElement('div', { 'data-testid': 'site-header' }),
}));

vi.mock('../../components/marketing/SiteFooter', () => ({
  SiteFooter: () => React.createElement('div', { 'data-testid': 'site-footer' }),
}));

vi.mock('../../components/HeroWebGLBackground', () => ({
  HeroWebGLBackground: () => React.createElement('div', { 'data-testid': 'hero-background' }),
}));

vi.mock('../../components/TripView', () => ({
  TripView: () => React.createElement('div', { 'data-testid': 'trip-view' }),
}));

vi.mock('../../components/TripGenerationSkeleton', () => ({
  TripGenerationSkeleton: () => React.createElement('div', { 'data-testid': 'trip-generation-skeleton' }),
}));

vi.mock('../../components/CountrySelect', () => ({
  CountrySelect: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    React.createElement('input', {
      'aria-label': 'country-select',
      value,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    })
  ),
}));

vi.mock('../../components/DateRangePicker', () => ({
  DateRangePicker: ({
    startDate,
    endDate,
    onChange,
  }: {
    startDate?: string;
    endDate?: string;
    onChange: (nextStartDate: string, nextEndDate: string) => void;
  }) => React.createElement(
    'div',
    { 'data-testid': 'date-range-picker' },
    React.createElement('div', null, `${startDate || 'unset'}:${endDate || 'unset'}`),
    React.createElement('button', {
      type: 'button',
      onClick: () => onChange('2026-04-01', '2026-04-01'),
    }, 'set-same-day-range'),
    React.createElement('button', {
      type: 'button',
      onClick: () => onChange('2026-04-01', '2026-04-03'),
    }, 'set-three-day-range'),
  ),
}));

vi.mock('../../components/MonthSeasonStrip', () => ({
  MonthSeasonStrip: () => React.createElement('div', { 'data-testid': 'month-season-strip' }),
}));

vi.mock('../../components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: (next: boolean) => void }) => (
    React.createElement('button', {
      type: 'button',
      role: 'switch',
      'aria-checked': checked ? 'true' : 'false',
      onClick: () => onCheckedChange?.(!checked),
    }, checked ? 'on' : 'off')
  ),
}));

vi.mock('../../components/ui/select', async () => {
  const ReactModule = await import('react');
  const SelectContext = ReactModule.createContext<{ onValueChange?: (value: string) => void } | null>(null);

  return {
    Select: ({ value: _value, onValueChange, children }: { value?: string; onValueChange?: (value: string) => void; children: React.ReactNode }) => (
      ReactModule.createElement(SelectContext.Provider, { value: { onValueChange } }, children)
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => ReactModule.createElement('div', null, children),
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => ReactModule.createElement('div', null, children),
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const context = ReactModule.useContext(SelectContext);
      return ReactModule.createElement('button', {
        type: 'button',
        onClick: () => context?.onValueChange?.(value),
      }, children);
    },
  };
});

vi.mock('../../services/geminiService', () => ({
  buildWizardItineraryPrompt: vi.fn().mockReturnValue('wizard prompt'),
}));

vi.mock('../../services/tripGenerationClientAsyncService', () => ({
  startClientAsyncTripGeneration: (...args: unknown[]) => mocks.startClientAsyncTripGeneration(...args),
}));

vi.mock('../../services/tripGenerationQueueService', () => ({
  createTripGenerationRequest: (...args: unknown[]) => mocks.createTripGenerationRequest(...args),
}));

vi.mock('../../services/dbService', () => ({
  ensureDbSession: (...args: unknown[]) => mocks.ensureDbSession(...args),
}));

vi.mock('../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({
    confirm: (...args: unknown[]) => mocks.confirm(...args),
  }),
}));

vi.mock('../../services/tripGenerationTabFeedbackService', () => ({
  getTripReadyNotificationPermission: (...args: unknown[]) => mocks.getTripReadyNotificationPermission(...args),
  requestTripReadyNotificationPermission: (...args: unknown[]) => mocks.requestTripReadyNotificationPermission(...args),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mocks.authState,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options && typeof options.days === 'number' && key === 'snapshot.days') {
        return `${options.days} days`;
      }
      if (options && typeof options.weeks === 'number' && key === 'wizard.dates.flexLength') {
        return `${options.weeks} weeks`;
      }
      if (
        options
        && typeof options.days === 'number'
        && typeof options.nights === 'number'
        && key === 'wizard.dates.exactLength'
      ) {
        return `${options.days} days / ${options.nights} nights`;
      }
      if (options && typeof options.current === 'number' && typeof options.total === 'number' && key === 'wizard.stepBadge') {
        return `Step ${options.current} of ${options.total}`;
      }
      if (options && typeof options.index === 'number' && key === 'wizard.loading.stopTitle') {
        return `Stop ${options.index}`;
      }
      if (options && typeof options.window === 'string' && key === 'wizard.review.flexDates') {
        return `${options.weeks} weeks / ${options.window}`;
      }
      if (key === 'errors.minimumNightStay') {
        return 'Choose an end date at least one night after your start date.';
      }
      return key;
    },
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

import { CreateTripV3Page } from '../../pages/CreateTripV3Page';

const encodePrefill = (value: unknown): string => {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const decodePrefill = (encoded: string): Record<string, unknown> => {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
};

const renderPage = ({
  initialEntries = ['/create-trip/wizard'],
  props,
}: {
  initialEntries?: string[];
  props?: Partial<React.ComponentProps<typeof CreateTripV3Page>>;
} = {}) => render(
  React.createElement(
    MemoryRouter,
    { initialEntries },
    React.createElement(CreateTripV3Page, {
      onTripGenerated: vi.fn(),
      onOpenManager: vi.fn(),
      ...props,
    })
  )
);

const getPrimaryActions = (label: RegExp) => screen.getAllByRole('button', { name: label });

const getPrimaryAction = (label: RegExp) => {
  const matches = getPrimaryActions(label);
  return matches.find((button) => !button.hasAttribute('disabled')) ?? matches[matches.length - 1];
};

const clickPopularPick = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  const matches = screen.getAllByRole('button', { name: label });
  await user.click(matches.find((button) => !button.hasAttribute('disabled')) ?? matches[0]);
};

const continueWizard = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(getPrimaryAction(/wizard\.actions\.continue/i));
};

const waitForWizardText = async (text: string) => {
  await waitFor(() => {
    expect(screen.queryAllByText(text).length).toBeGreaterThan(0);
  });
};

const buildPrefilledWizardEntry = (payload: unknown) => `/create-trip/wizard?prefill=${encodePrefill(payload)}`;

const getClassicCardPrefill = () => {
  const href = screen.getByRole('link', { name: 'labsBanner.links.classicCard' }).getAttribute('href') || '';
  const url = new URL(href, 'https://travelflow.test');
  const prefill = url.searchParams.get('prefill');
  return prefill ? decodePrefill(prefill) : null;
};

const waitForPrefill = async (assertion: (payload: Record<string, unknown>) => void) => {
  await waitFor(() => {
    const payload = getClassicCardPrefill();
    expect(payload).not.toBeNull();
    assertion(payload as Record<string, unknown>);
  });
};

describe('pages/CreateTripV3Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureDbSession.mockResolvedValue('session-1');
    mocks.startClientAsyncTripGeneration.mockResolvedValue({});
    mocks.confirm.mockResolvedValue(false);
    mocks.getTripReadyNotificationPermission.mockReturnValue('default');
    mocks.requestTripReadyNotificationPermission.mockResolvedValue('granted');
    mocks.authState.isAuthenticated = true;
  });

  afterEach(() => {
    cleanup();
  });

  it('reorders the first step based on the selected branch', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /wizard\.intent\.options\.known_dates_need_destination\.title/i }));

    expect(screen.getByText('wizard.dates.title')).toBeInTheDocument();
    expect(screen.queryByText('wizard.destination.title')).not.toBeInTheDocument();
  });

  it('submits the adaptive wizard with shared preference signals', async () => {
    const user = userEvent.setup();
    renderPage({
      initialEntries: [
        buildPrefilledWizardEntry({
          countries: ['Japan'],
          mode: 'wizard',
          meta: {
            draft: {
              version: 2,
              wizardBranch: 'known_destinations_flexible_dates',
              dateInputMode: 'flex',
              flexWeeks: 2,
              flexWindow: 'shoulder',
            },
          },
        }),
      ],
    });
    await waitForPrefill((payload) => {
      expect(payload.countries).toEqual(['Japan']);
      expect(payload.mode).toBe('wizard');
      expect((payload.meta as { draft?: { wizardBranch?: string; dateInputMode?: string } }).draft?.wizardBranch)
        .toBe('known_destinations_flexible_dates');
      expect((payload.meta as { draft?: { wizardBranch?: string; dateInputMode?: string } }).draft?.dateInputMode)
        .toBe('flex');
    });

    await user.click(screen.getByRole('button', { name: /wizard\.intent\.options\.known_destinations_flexible_dates\.title/i }));
    await waitForWizardText('wizard.destination.title');
    await waitFor(() => {
      expect(screen.getByLabelText('country-select')).toHaveValue('Japan');
    });
    await continueWizard(user);
    await waitForWizardText('wizard.dates.title');
    await continueWizard(user);
    await waitForWizardText('wizard.preferences.title');

    await user.click(screen.getByRole('button', { name: 'traveler.options.family' }));
    await user.click(screen.getByRole('button', { name: 'transport.options.train' }));
    await continueWizard(user);
    await waitForWizardText('wizard.details.title');

    await user.click(screen.getByRole('button', { name: 'wizard.budgetOptions.high' }));
    await user.click(screen.getByRole('button', { name: 'wizard.paceOptions.fast' }));
    await user.type(screen.getByPlaceholderText('wizard.details.notesPlaceholder'), 'No overnight buses');
    await continueWizard(user);
    await waitForWizardText('wizard.review.title');

    await user.click(getPrimaryAction(/wizard\.actions\.generate/i));

    await waitFor(() => {
      expect(mocks.startClientAsyncTripGeneration).toHaveBeenCalledTimes(1);
    });

    const firstCall = mocks.startClientAsyncTripGeneration.mock.calls[0]?.[0];
    expect(firstCall).toEqual(expect.objectContaining({
      flow: 'wizard',
      prompt: 'wizard prompt',
    }));
    expect(firstCall.inputSnapshot.payload.options).toEqual(expect.objectContaining({
      countries: ['Japan'],
      dateInputMode: 'flex',
      flexWeeks: 2,
      budget: 'High',
      pace: 'Fast',
      travelerType: 'family',
      transportPreferences: ['train'],
      hasTransportOverride: true,
    }));
  });

  it('blocks same-day exact ranges and sends totalNights for valid exact trips', async () => {
    const user = userEvent.setup();
    renderPage({
      initialEntries: [
        buildPrefilledWizardEntry({
          countries: ['Japan'],
          startDate: '2026-04-01',
          endDate: '2026-04-03',
          mode: 'wizard',
          meta: {
            draft: {
              version: 2,
              wizardBranch: 'known_dates_need_destination',
              dateInputMode: 'exact',
            },
          },
        }),
      ],
    });
    await waitForPrefill((payload) => {
      expect(payload.countries).toEqual(['Japan']);
      expect(payload.startDate).toBe('2026-04-01');
      expect(payload.endDate).toBe('2026-04-03');
      expect((payload.meta as { draft?: { wizardBranch?: string; dateInputMode?: string } }).draft?.wizardBranch)
        .toBe('known_dates_need_destination');
      expect((payload.meta as { draft?: { wizardBranch?: string; dateInputMode?: string } }).draft?.dateInputMode)
        .toBe('exact');
    });

    await user.click(screen.getByRole('button', { name: /wizard\.intent\.options\.known_dates_need_destination\.title/i }));
    await waitForWizardText('wizard.dates.title');
    await waitForWizardText('2026-04-01:2026-04-03');

    await user.click(screen.getAllByRole('button', { name: 'set-same-day-range' })[0]);
    expect(screen.getByText('Choose an end date at least one night after your start date.')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'set-three-day-range' })[0]);
    expect(screen.getAllByText('3 days / 2 nights').length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(getPrimaryAction(/wizard\.actions\.continue/i)).toBeEnabled();
    });

    await continueWizard(user);
    await waitForWizardText('wizard.destination.title');
    await continueWizard(user);
    await waitForWizardText('wizard.preferences.title');
    await continueWizard(user);
    await waitForWizardText('wizard.details.title');
    await continueWizard(user);
    await waitForWizardText('wizard.review.title');
    await user.click(getPrimaryAction(/wizard\.actions\.generate/i));

    await waitFor(() => {
      expect(mocks.startClientAsyncTripGeneration).toHaveBeenCalledTimes(1);
    });

    const firstCall = mocks.startClientAsyncTripGeneration.mock.calls[0]?.[0];
    expect(firstCall.inputSnapshot.payload.options).toEqual(expect.objectContaining({
      countries: ['Japan'],
      dateInputMode: 'exact',
      startDate: '2026-04-01',
      endDate: '2026-04-03',
      totalDays: 3,
      totalNights: 2,
    }));
  });

  it('asks for browser notification permission before generation when permission is undecided', async () => {
    const user = userEvent.setup();
    mocks.confirm.mockResolvedValue(true);
    renderPage({
      initialEntries: [
        buildPrefilledWizardEntry({
          countries: ['Japan'],
          mode: 'wizard',
          meta: {
            draft: {
              version: 2,
              wizardBranch: 'known_destinations_flexible_dates',
              dateInputMode: 'flex',
              flexWeeks: 2,
              flexWindow: 'shoulder',
            },
          },
        }),
      ],
    });
    await waitForPrefill((payload) => {
      expect(payload.countries).toEqual(['Japan']);
      expect((payload.meta as { draft?: { wizardBranch?: string; dateInputMode?: string } }).draft?.wizardBranch)
        .toBe('known_destinations_flexible_dates');
      expect((payload.meta as { draft?: { wizardBranch?: string; dateInputMode?: string } }).draft?.dateInputMode)
        .toBe('flex');
    });

    await user.click(screen.getByRole('button', { name: /wizard\.intent\.options\.known_destinations_flexible_dates\.title/i }));
    await waitForWizardText('wizard.destination.title');
    await waitFor(() => {
      expect(screen.getByLabelText('country-select')).toHaveValue('Japan');
    });
    await continueWizard(user);
    await waitForWizardText('wizard.dates.title');
    await continueWizard(user);
    await waitForWizardText('wizard.preferences.title');
    await continueWizard(user);
    await waitForWizardText('wizard.details.title');
    await continueWizard(user);
    await waitForWizardText('wizard.review.title');
    await user.click(getPrimaryAction(/wizard\.actions\.generate/i));

    await waitFor(() => {
      expect(mocks.confirm).toHaveBeenCalledTimes(1);
    });
    expect(mocks.requestTripReadyNotificationPermission).toHaveBeenCalledTimes(1);
    expect(mocks.startClientAsyncTripGeneration).toHaveBeenCalledTimes(1);
  });

});
