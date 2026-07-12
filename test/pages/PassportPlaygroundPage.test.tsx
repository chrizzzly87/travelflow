// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PassportBook, type PassportBookSettings } from '../../pages/passport/PassportBook';
import { PASSPORT_ACHIEVEMENTS, getPassportSpreads } from '../../pages/passport/passportData';
import { generateTopographyPaths, hashString, pageSeed } from '../../pages/passport/passportArt';

const SETTINGS: PassportBookSettings = {
  nationality: 'germany',
  stampStyle: 'postal',
  seed: 'test-atlas',
  contours: 14,
  roughness: 1.5,
  inkBleed: 0.5,
  pageCurl: 8,
  speed: 4,
  imperfections: true,
  topography: true,
};

describe('passport playground model', () => {
  it('offers more than 30 distinct achievement specimens and filters locked stamps', () => {
    expect(PASSPORT_ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(PASSPORT_ACHIEVEMENTS.map((achievement) => achievement.id)).size).toBe(PASSPORT_ACHIEVEMENTS.length);

    const all = getPassportSpreads(true).flat();
    const unlocked = getPassportSpreads(false).flat();
    expect(all).toHaveLength(PASSPORT_ACHIEVEMENTS.length);
    expect(unlocked).toHaveLength(PASSPORT_ACHIEVEMENTS.filter((achievement) => achievement.unlocked).length);
    expect(unlocked.every((achievement) => achievement.unlocked)).toBe(true);
  });

  it('creates stable but page-specific topographic paths from a hash', () => {
    const options = { seed: pageSeed('Atlas', 2), contours: 18, roughness: 2 };
    const first = generateTopographyPaths(options);
    const second = generateTopographyPaths(options);
    const anotherPage = generateTopographyPaths({ ...options, seed: pageSeed('Atlas', 3) });

    expect(hashString('atlas')).toBe(hashString('atlas'));
    expect(first).toEqual(second);
    expect(first).not.toEqual(anotherPage);
    expect(first.length).toBeGreaterThan(10);
  });
});

describe('PassportBook', () => {
  it('opens from its nationality cover and stages the next spread during a page turn', () => {
    const spreads = getPassportSpreads(true);
    const { rerender, container } = render(
      <PassportBook spreads={spreads} settings={SETTINGS} isOpen={false} onOpenChange={() => undefined} />,
    );

    expect(screen.getByRole('button', { name: /open germany travel passport/i })).toBeInTheDocument();
    rerender(<PassportBook spreads={spreads} settings={SETTINGS} isOpen onOpenChange={() => undefined} />);
    expect(screen.getByText(`1 / ${spreads.length}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next passport spread/i }));
    const turningPage = container.querySelector('.passport-turn');
    expect(turningPage).not.toBeNull();
    expect(screen.getAllByLabelText('Passport page 3').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /next passport spread/i })).toBeDisabled();

    fireEvent.animationEnd(container.querySelector('.passport-turn__edge') as Element, { animationName: 'passport-edge-reveal' });
    expect(screen.getByText(`1 / ${spreads.length}`)).toBeInTheDocument();
  });
});
