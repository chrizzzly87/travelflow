// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  startClientAsyncTripGeneration: vi.fn().mockResolvedValue({}),
  createTripGenerationRequest: vi.fn(),
  ensureDbSession: vi.fn().mockResolvedValue('session-1'),
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
  DateRangePicker: () => React.createElement('div', { 'data-testid': 'date-range-picker' }, 'date-range-picker'),
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

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
  }),
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
      if (options && typeof options.days === 'number' && key === 'wizard.dates.exactLength') {
        return `${options.days} days`;
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
      return key;
    },
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

import { CreateTripV3Page } from '../../pages/CreateTripV3Page';

const renderPage = () => render(
  React.createElement(
    MemoryRouter,
    { initialEntries: ['/create-trip/wizard'] },
    React.createElement(CreateTripV3Page, {
      onTripGenerated: vi.fn(),
      onOpenManager: vi.fn(),
    })
  )
);

describe('pages/CreateTripV3Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureDbSession.mockResolvedValue('session-1');
    mocks.startClientAsyncTripGeneration.mockResolvedValue({});
  });

  it('reorders the first step based on the selected branch', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('wizard.intent.options.known_dates_need_destination.title'));

    expect(screen.getByText('wizard.dates.title')).toBeInTheDocument();
    expect(screen.queryByText('wizard.destination.title')).not.toBeInTheDocument();
  });

  it('submits the adaptive wizard with shared preference signals', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('wizard.intent.options.known_destinations_flexible_dates.title'));
    await user.click(screen.getByText('Japan'));
    await user.click(screen.getByRole('button', { name: /wizard\.actions\.continue/i }));
    await user.click(screen.getByRole('button', { name: /wizard\.actions\.continue/i }));

    await user.click(screen.getByText('traveler.options.family'));
    await user.click(screen.getByText('transport.options.train'));
    await user.click(screen.getByRole('button', { name: /wizard\.actions\.continue/i }));

    await user.click(screen.getByText('wizard.budgetOptions.high'));
    await user.click(screen.getByText('wizard.paceOptions.fast'));
    await user.type(screen.getByPlaceholderText('wizard.details.notesPlaceholder'), 'No overnight buses');
    await user.click(screen.getByRole('button', { name: /wizard\.actions\.continue/i }));

    await user.click(screen.getByRole('button', { name: /wizard\.actions\.generate/i }));

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
});
