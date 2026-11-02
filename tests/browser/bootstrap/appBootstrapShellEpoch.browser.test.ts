// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import { AppBootstrapShell } from '../../../components/bootstrap/AppBootstrapShell';
import { resetShellEpochForTests } from '../../../services/appBootstrapShellEpoch';

/**
 * One navigation renders the shell two or three times in a row, each as a fresh
 * element at a different position in the tree, so React remounts rather than
 * reusing the DOM. Measured on a trip route: three nodes inside 43ms, each
 * restarting `tf-boot-bones-in` from zero — the placeholder flashed twice.
 */
const readEpoch = (container: HTMLElement) => {
  const shell = container.querySelector('.tf-boot-shell') as HTMLElement;
  return shell.style.getPropertyValue('--tf-boot-epoch');
};

const readSweepEpoch = (container: HTMLElement) => {
  const shell = container.querySelector('.tf-boot-shell') as HTMLElement;
  return shell.style.getPropertyValue('--tf-boot-sweep-epoch');
};

describe('AppBootstrapShell loading-episode epoch', () => {
  beforeEach(() => {
    resetShellEpochForTests();
    vi.spyOn(performance, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    resetShellEpochForTests();
  });

  it('starts a fresh episode at zero so the entrance fade plays in full', () => {
    const view = render(React.createElement(AppBootstrapShell, { variant: 'trip' }));

    expect(readEpoch(view.container)).toBe('0ms');
    view.unmount();
  });

  it('carries the epoch forward when the next boundary remounts the shell', () => {
    const first = render(React.createElement(AppBootstrapShell, { variant: 'trip' }));
    expect(readEpoch(first.container)).toBe('0ms');
    first.unmount();

    vi.spyOn(performance, 'now').mockReturnValue(1036);
    const second = render(React.createElement(AppBootstrapShell, { variant: 'trip' }));

    // 36ms already spent on screen, so the fade resumes rather than restarting.
    expect(readEpoch(second.container)).toBe('36ms');
    second.unmount();
  });

  it('starts a new episode once the shell has been gone long enough', () => {
    vi.useFakeTimers();
    try {
      const first = render(React.createElement(AppBootstrapShell, { variant: 'trip' }));
      first.unmount();
      vi.advanceTimersByTime(500);

      vi.spyOn(performance, 'now').mockReturnValue(1500);
      const second = render(React.createElement(AppBootstrapShell, { variant: 'trip' }));

      expect(readEpoch(second.container)).toBe('0ms');
      second.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('anchors the bone sweep to document time so a remount never restarts it', () => {
    vi.spyOn(performance, 'now').mockReturnValue(4200);

    const view = render(React.createElement(AppBootstrapShell, { variant: 'marketing' }));

    expect(readSweepEpoch(view.container)).toBe('4200ms');
    view.unmount();
  });
});
