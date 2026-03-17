// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  authState: {
    isAdmin: false,
    isAuthenticated: true,
    isAnonymous: false,
  },
  confirm: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../components/AppDialogProvider', () => ({
  useAppDialog: () => ({
    confirm: (...args: unknown[]) => mocks.confirm(...args),
  }),
}));

vi.mock('../../components/navigation/SiteHeader', () => ({
  SiteHeader: () => React.createElement('div', { 'data-testid': 'site-header' }),
}));

vi.mock('../../components/marketing/SiteFooter', () => ({
  SiteFooter: () => React.createElement('footer', { 'data-testid': 'site-footer' }),
}));

vi.mock('../../components/create-trip/CreateTripWizardCtaBanner', () => ({
  CreateTripWizardCtaBanner: () => React.createElement('div', { 'data-testid': 'wizard-cta-banner' }),
}));

vi.mock('../../components/DateRangePicker', () => ({
  DateRangePicker: () => React.createElement('div', { 'data-testid': 'date-range-picker' }),
}));

vi.mock('../../components/IdealTravelTimeline', () => ({
  IdealTravelTimeline: () => React.createElement('div', { 'data-testid': 'ideal-travel-timeline' }),
}));

vi.mock('../../components/flags/FlagIcon', () => ({
  FlagIcon: ({ value }: { value?: string }) => React.createElement('span', { 'aria-hidden': 'true' }, value || 'flag'),
}));

vi.mock('../../components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  DialogContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('../../components/ui/drawer', () => ({
  Drawer: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  DrawerContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DrawerDescription: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DrawerFooter: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DrawerHeader: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  DrawerTitle: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('../../components/ui/select', async () => {
  const ReactModule = await import('react');
  const SelectContext = ReactModule.createContext<{ onValueChange?: (value: string) => void } | null>(null);

  return {
    Select: ({
      onValueChange,
      children,
    }: {
      value?: string;
      onValueChange?: (value: string) => void;
      children: React.ReactNode;
    }) => ReactModule.createElement(SelectContext.Provider, { value: { onValueChange } }, children),
    SelectContent: ({ children }: { children: React.ReactNode }) => ReactModule.createElement('div', null, children),
    SelectGroup: ({ children }: { children: React.ReactNode }) => ReactModule.createElement('div', null, children),
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const context = ReactModule.useContext(SelectContext);
      return ReactModule.createElement(
        'button',
        { type: 'button', onClick: () => context?.onValueChange?.(value) },
        children
      );
    },
    SelectLabel: ({ children }: { children: React.ReactNode }) => ReactModule.createElement('div', null, children),
    SelectSeparator: () => ReactModule.createElement('hr'),
    SelectTrigger: ({ children, id }: { children: React.ReactNode; id?: string }) =>
      ReactModule.createElement('div', { id }, children),
  };
});

vi.mock('../../components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (next: boolean) => void;
  }) =>
    React.createElement(
      'button',
      {
        type: 'button',
        role: 'switch',
        'aria-checked': checked ? 'true' : 'false',
        onClick: () => onCheckedChange?.(!checked),
      },
      checked ? 'on' : 'off'
    ),
}));

vi.mock('../../components/ConnectivityStatusBanner', () => ({
  ConnectivityStatusBanner: () => React.createElement('div', { 'data-testid': 'connectivity-banner' }),
}));

vi.mock('../../hooks/useConnectivityStatus', () => ({
  useConnectivityStatus: () => ({
    snapshot: { state: 'online' },
  }),
}));

vi.mock('../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isOnline: true,
  }),
}));

vi.mock('../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    snapshot: { state: 'synced' },
    retrySyncNow: vi.fn(),
  }),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mocks.authState,
}));

vi.mock('../../services/aiService', () => ({
  buildClassicItineraryPrompt: vi.fn().mockReturnValue('classic prompt'),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
    },
  }),
}));

import { CreateTripClassicLabPage } from '../../pages/CreateTripClassicLabPage';

const renderPage = () =>
  render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/create-trip'] },
      React.createElement(CreateTripClassicLabPage, {
        onOpenManager: vi.fn(),
        onTripGenerated: vi.fn(),
      })
    )
  );

describe('pages/CreateTripClassicLabPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authState.isAdmin = false;
    mocks.authState.isAuthenticated = true;
    mocks.authState.isAnonymous = false;

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });

    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  it('renders special notes directly after dates and before traveler preferences', () => {
    renderPage();

    const datesHeading = screen.getByText('dates.title');
    const notesHeading = screen.getByText('notes.title');
    const travelerHeading = screen.getByText('traveler.title');

    expect(datesHeading.compareDocumentPosition(notesHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notesHeading.compareDocumentPosition(travelerHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
