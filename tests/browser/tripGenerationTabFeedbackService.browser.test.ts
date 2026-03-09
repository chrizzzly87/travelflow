// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginTripGenerationTabFeedback,
  getTripReadyNotificationPermission,
  requestTripReadyNotificationPermission,
  setCanonicalDocumentTitle,
  sendTripReadyNotification,
} from '../../services/tripGenerationTabFeedbackService';

const DYNAMIC_FAVICON_ID = 'tf-trip-generation-favicon';

const setVisibilityState = (state: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
};

type MockNotificationInstance = {
  title: string;
  options?: NotificationOptions;
  close: ReturnType<typeof vi.fn>;
};

type MockNotificationClass = {
  new (title: string, options?: NotificationOptions): MockNotificationInstance;
  permission: NotificationPermission;
  requestPermission: ReturnType<typeof vi.fn>;
  instances: MockNotificationInstance[];
};

const installMockNotification = (
  permission: NotificationPermission,
  requestedPermission: NotificationPermission = permission,
): MockNotificationClass => {
  class MockNotification {
    static permission: NotificationPermission = permission;

    static requestPermission = vi.fn(async () => {
      MockNotification.permission = requestedPermission;
      return requestedPermission;
    });

    static instances: MockNotificationInstance[] = [];

    title: string;

    options?: NotificationOptions;

    close = vi.fn();

    constructor(title: string, options?: NotificationOptions) {
      this.title = title;
      this.options = options;
      MockNotification.instances.push(this);
    }
  }

  Object.defineProperty(globalThis, 'Notification', {
    configurable: true,
    writable: true,
    value: MockNotification,
  });

  return MockNotification;
};

describe('services/tripGenerationTabFeedbackService', () => {
  const originalNotification = globalThis.Notification;

  beforeEach(() => {
    vi.useFakeTimers();
    document.title = 'TravelFlow';
    setCanonicalDocumentTitle('TravelFlow');
    document.getElementById(DYNAMIC_FAVICON_ID)?.remove();
    setVisibilityState('visible');
    if (originalNotification) {
      Object.defineProperty(globalThis, 'Notification', {
        configurable: true,
        writable: true,
        value: originalNotification,
      });
    } else {
      Object.defineProperty(globalThis, 'Notification', {
        configurable: true,
        writable: true,
        value: undefined,
      });
    }
  });

  afterEach(() => {
    document.getElementById(DYNAMIC_FAVICON_ID)?.remove();
    document.title = 'TravelFlow';
    setCanonicalDocumentTitle('TravelFlow');
    if (originalNotification) {
      Object.defineProperty(globalThis, 'Notification', {
        configurable: true,
        writable: true,
        value: originalNotification,
      });
    } else {
      Object.defineProperty(globalThis, 'Notification', {
        configurable: true,
        writable: true,
        value: undefined,
      });
    }
  });

  it('animates title and favicon while hidden during running generation', () => {
    setVisibilityState('hidden');
    const session = beginTripGenerationTabFeedback();

    expect(document.title).toBe('Creating your trip...');
    const firstHref = (document.getElementById(DYNAMIC_FAVICON_ID) as HTMLLinkElement).href;

    vi.advanceTimersByTime(900);
    const secondHref = (document.getElementById(DYNAMIC_FAVICON_ID) as HTMLLinkElement).href;
    expect(secondHref).not.toBe(firstHref);

    vi.advanceTimersByTime(10000);
    expect(document.title).toBe('Mapping your route...');

    session.cancel();
    expect(document.title).toBe('TravelFlow');
    expect(document.getElementById(DYNAMIC_FAVICON_ID)).toBeNull();
  });

  it('shows a success completion state while hidden and restores on refocus', () => {
    setVisibilityState('hidden');
    const session = beginTripGenerationTabFeedback();
    session.complete('success', { title: 'Japan Road Trip' });

    expect(document.title).toBe('Trip ready: Japan Road Trip');
    expect(document.getElementById(DYNAMIC_FAVICON_ID)).not.toBeNull();

    setVisibilityState('visible');
    expect(document.title).toBe('TravelFlow');
    expect(document.getElementById(DYNAMIC_FAVICON_ID)).toBeNull();
  });

  it('shows an error completion state while hidden and restores on refocus', () => {
    setVisibilityState('hidden');
    const session = beginTripGenerationTabFeedback();
    session.complete('error');

    expect(document.title).toBe('Generation failed');
    expect(document.getElementById(DYNAMIC_FAVICON_ID)).not.toBeNull();

    setVisibilityState('visible');
    expect(document.title).toBe('TravelFlow');
    expect(document.getElementById(DYNAMIC_FAVICON_ID)).toBeNull();
  });

  it('does not animate when the tab is visible', () => {
    setVisibilityState('visible');
    const session = beginTripGenerationTabFeedback();

    vi.advanceTimersByTime(12000);
    expect(document.title).toBe('TravelFlow');
    expect(document.getElementById(DYNAMIC_FAVICON_ID)).toBeNull();

    session.cancel();
  });

  it('restores to latest canonical title after hidden completion', () => {
    setCanonicalDocumentTitle('Create Trip · TravelFlow');
    setVisibilityState('hidden');
    const session = beginTripGenerationTabFeedback();

    setCanonicalDocumentTitle('Japan Road Trip · TravelFlow');
    session.complete('success');
    expect(document.title).toBe('Trip ready');

    setVisibilityState('visible');
    expect(document.title).toBe('Japan Road Trip · TravelFlow');
    expect(document.getElementById(DYNAMIC_FAVICON_ID)).toBeNull();
  });

  it('handles unsupported/default/granted/denied notification states safely', async () => {
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    expect(getTripReadyNotificationPermission()).toBe('unsupported');
    await expect(requestTripReadyNotificationPermission()).resolves.toBe('unsupported');
    expect(sendTripReadyNotification()).toBe(false);

    const defaultMock = installMockNotification('default', 'denied');
    expect(getTripReadyNotificationPermission()).toBe('default');
    await expect(requestTripReadyNotificationPermission()).resolves.toBe('denied');
    expect(defaultMock.requestPermission).toHaveBeenCalledTimes(1);
    expect(sendTripReadyNotification()).toBe(false);

    const deniedMock = installMockNotification('denied');
    expect(getTripReadyNotificationPermission()).toBe('denied');
    expect(sendTripReadyNotification()).toBe(false);
    expect(deniedMock.instances).toHaveLength(0);

    const grantedMock = installMockNotification('granted');
    expect(getTripReadyNotificationPermission()).toBe('granted');
    expect(
      sendTripReadyNotification({
        title: 'Trip ready',
        body: 'Your itinerary is ready.',
      }),
    ).toBe(true);
    expect(grantedMock.instances).toHaveLength(1);
    expect(grantedMock.instances[0].title).toBe('Trip ready');
    vi.advanceTimersByTime(8000);
    expect(grantedMock.instances[0].close).toHaveBeenCalledTimes(1);
  });
});
