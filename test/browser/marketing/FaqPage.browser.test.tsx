// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const trackEventMock = vi.fn();

vi.mock('../../../components/marketing/MarketingLayout', () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../services/analyticsService', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
  getAnalyticsDebugAttributes: () => ({}),
}));

import enFaq from '../../../locales/en/faq.json';
import deFaq from '../../../locales/de/faq.json';
import enCommon from '../../../locales/en/common.json';
import deCommon from '../../../locales/de/common.json';

const localeState = vi.hoisted(() => ({ language: 'en' }));

const BUNDLES: Record<string, Record<string, unknown>> = {
  en: { faq: enFaq, common: enCommon },
  de: { faq: deFaq, common: deCommon },
};

const getNestedValue = (bundle: unknown, key: string): unknown => key.split('.').reduce<unknown>((current, part) => {
  if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
    return (current as Record<string, unknown>)[part];
  }
  return undefined;
}, bundle);

const interpolateString = (template: string, options?: Record<string, unknown>) => template.replace(
  /\{(\w+)\}/g,
  (_, name: string) => {
    const value = options?.[name];
    return value == null ? `{${name}}` : String(value);
  },
);

// Mirrors i18n.ts: `ns:key` selects a namespace, a bare key uses the default
// namespace the component passed to useTranslation.
vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string | string[]) => {
    const defaultNs = Array.isArray(ns) ? ns[0] : (ns ?? 'common');
    return {
      t: (key: string, options?: Record<string, unknown>) => {
        const [maybeNs, ...rest] = key.split(':');
        const namespace = rest.length > 0 ? maybeNs : defaultNs;
        const path = rest.length > 0 ? rest.join(':') : key;
        const value = getNestedValue(BUNDLES[localeState.language]?.[namespace], path);
        return typeof value === 'string' ? interpolateString(value, options) : key;
      },
      i18n: { language: localeState.language, resolvedLanguage: localeState.language },
    };
  },
}));

import { FaqPage } from '../../../pages/FaqPage';

describe('pages/FaqPage', () => {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const previousScrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  const scrollIntoViewSpy = vi.fn();

  beforeEach(() => {
    localeState.language = 'en';
    trackEventMock.mockReset();
    scrollIntoViewSpy.mockReset();

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoViewSpy,
    });

    window.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
      callback(0);
      return 1;
    }) as typeof window.requestAnimationFrame;
  });

  afterEach(() => {
    cleanup();
    window.requestAnimationFrame = originalRequestAnimationFrame;
    if (previousScrollIntoViewDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', previousScrollIntoViewDescriptor);
    } else {
      delete (HTMLElement.prototype as HTMLElement & { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('opens and scrolls to a deep-linked FAQ item from hash', async () => {
    render(
      <MemoryRouter initialEntries={['/faq#general-report-translation-issue']}>
        <FaqPage />
      </MemoryRouter>
    );

    const deepLinkedItem = screen.getByRole('button', { name: 'How do I report translation issues?' });
    expect(deepLinkedItem).toHaveAttribute('aria-expanded', 'true');

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalled();
    });

    expect(trackEventMock).toHaveBeenCalledWith('faq__item--open', expect.objectContaining({
      item_id: 'general-report-translation-issue',
      source: 'hash',
    }));
  });

  it('tracks section link clicks and FAQ item toggles', () => {
    render(
      <MemoryRouter initialEntries={['/faq']}>
        <FaqPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole('link', { name: 'Billing' })[0]);
    expect(trackEventMock).toHaveBeenCalledWith('faq__section_link', expect.objectContaining({
      section_id: 'billing',
      source: 'toc',
    }));

    const itemButton = screen.getByRole('button', { name: 'How do I report translation issues?' });
    fireEvent.click(itemButton);

    expect(trackEventMock).toHaveBeenCalledWith('faq__item--open', expect.objectContaining({
      item_id: 'general-report-translation-issue',
      section_id: 'general',
      source: 'faq_page',
    }));

    fireEvent.click(itemButton);
    expect(trackEventMock).toHaveBeenCalledWith('faq__item--close', expect.objectContaining({
      item_id: 'general-report-translation-issue',
      section_id: 'general',
      source: 'faq_page',
    }));
  });

  // Regression: the heading, the section titles and the answers were hardcoded
  // English literals, so every localized /faq route rendered an English h1.
  it('renders the heading and body copy from the faq namespace, not a hardcoded literal', () => {
    render(
      <MemoryRouter initialEntries={['/faq']}>
        <FaqPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(enFaq.hero.title);
    expect(screen.getByRole('heading', { level: 2, name: enFaq.sections.billing })).toBeInTheDocument();
  });

  it('translates the heading, sections and answers when the locale is German', () => {
    localeState.language = 'de';

    render(
      <MemoryRouter initialEntries={['/faq#general-report-translation-issue']}>
        <FaqPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(deFaq.hero.title);
    expect(screen.getByRole('heading', { level: 2, name: deFaq.sections.billing })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: deFaq.items['general-report-translation-issue'].question })
    ).toHaveAttribute('aria-expanded', 'true');
  });

  // The answers quote Contact-form options; they must read as the labels that
  // form actually renders in the active locale.
  it('interpolates the live Contact-form option labels into answers', () => {
    localeState.language = 'de';

    render(
      <MemoryRouter initialEntries={['/faq#general-report-translation-issue']}>
        <FaqPage />
      </MemoryRouter>
    );

    const answer = screen.getByRole('region', { name: deFaq.items['general-report-translation-issue'].question });
    expect(answer).toHaveTextContent(deCommon.contact.form.reasonOptions.bugReport);
    expect(answer).toHaveTextContent(deCommon.contact.form.subReasonOptions.bugReport.translationWrongMisleading);
    expect(answer.textContent).not.toMatch(/\{\w+\}/);
  });
});
