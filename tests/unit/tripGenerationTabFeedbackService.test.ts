// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { beginTripGenerationTabFeedback } from '../../services/tripGenerationTabFeedbackService';

describe('tripGenerationTabFeedbackService', () => {
  const notificationMock = vi.fn();
  let visibilityState: DocumentVisibilityState = 'visible';

  beforeEach(() => {
    notificationMock.mockReset();
    visibilityState = 'visible';

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });

    class MockNotification {
      static permission: NotificationPermission = 'granted';

      constructor(title: string, options?: NotificationOptions) {
        notificationMock(title, options);
      }

      close() {}

      addEventListener() {}

      removeEventListener() {}

      dispatchEvent() {
        return true;
      }
    }

    vi.stubGlobal('Notification', MockNotification);
    document.title = 'TravelFlow';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a browser notification when generation succeeds while the tab is hidden', () => {
    visibilityState = 'hidden';

    const session = beginTripGenerationTabFeedback();
    session.complete('success', { title: 'Japan Escape' });

    expect(notificationMock).toHaveBeenCalledTimes(1);
    expect(notificationMock).toHaveBeenCalledWith(
      'Trip ready: Japan Escape',
      expect.objectContaining({
        body: expect.stringContaining('ready'),
      }),
    );

    session.cancel();
  });
});
