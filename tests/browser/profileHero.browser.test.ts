// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileHero } from '../../components/profile/ProfileHero';

const renderProfileHero = (greeting: string) => render(
  React.createElement(
    MemoryRouter,
    null,
    React.createElement(ProfileHero, {
      greeting,
      name: 'Chris',
      transliteration: 'ahn-yo',
      ipa: 'an.jo',
      context: 'Used to greet travelers warmly.',
      ctaIntroLabel: 'Inspired by',
      ctaLinkLabel: 'South Korea',
      ctaHref: '/inspirations/south-korea',
      inspirationCountryCode: 'KR',
    })
  )
);

describe('components/profile/ProfileHero', () => {
  it('stagger-animates visible greeting glyphs without consuming delay on spaces', () => {
    renderProfileHero('Hi Ya');

    const heading = screen.getByRole('heading', { level: 1 });
    const greeting = heading.children[0] as HTMLSpanElement;
    const glyphs = Array.from(greeting.children) as HTMLSpanElement[];

    expect(glyphs).toHaveLength(5);
    expect(glyphs[0].className).toContain('profile-greeting-letter');
    expect(glyphs[0].style.animationDelay).toBe('0ms');
    expect(glyphs[1].className).toContain('profile-greeting-letter');
    expect(glyphs[1].style.animationDelay).toBe('42ms');
    expect(glyphs[2].className).not.toContain('profile-greeting-letter');
    expect(glyphs[2].style.animationDelay).toBe('');
    expect(glyphs[2].textContent).toBe('\u00A0');
    expect(glyphs[3].className).toContain('profile-greeting-letter');
    expect(glyphs[3].style.animationDelay).toBe('84ms');
    expect(glyphs[4].className).toContain('profile-greeting-letter');
    expect(glyphs[4].style.animationDelay).toBe('126ms');
  });
});
