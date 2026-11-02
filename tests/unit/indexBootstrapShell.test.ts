import React from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AppBootstrapShell } from '../../components/bootstrap/AppBootstrapShell';
import { getDocumentHints } from '../../src/document/headAssets';

describe('native document pending UI', () => {
  it('renders a branded marketing fallback without an external overlay or translated fake controls', () => {
    const html = renderToString(React.createElement(AppBootstrapShell));
    expect(html).toContain('TravelFlow');
    expect(html).toContain('/brand-plane.svg');
    expect(html).toContain('tf-boot-nav-skeleton--features');
    expect(html).not.toContain('id="app-bootstrap-shell"');
    expect(html).not.toContain('Features</span>');
    expect(html).not.toContain('tf-boot-planner');
  });
  it('renders the dedicated trip skeleton for the native trip pending boundary', () => {
    const html = renderToString(React.createElement(AppBootstrapShell, { variant: 'trip' }));
    expect(html).toContain('tf-boot-planner');
    expect(html).toContain('tf-boot-sheet');
    expect(html).not.toContain('id="app-bootstrap-shell"');
  });
  it('keeps dark loading surfaces in the cached loading stylesheet', () => {
    const css = readFileSync('styles/loading-shell.css', 'utf8');
    const blockFor = (selector: string) => {
      const start = css.indexOf(selector);
      expect(start).toBeGreaterThan(-1);
      return css.slice(start, css.indexOf('}', start));
    };
    const light = blockFor('.tf-boot-shell {');
    const dark = blockFor('.dark .tf-boot-shell {');
    const tokens = [...light.matchAll(/(--tf-boot-[a-z-]+):/g)].map(match => match[1]);
    expect(tokens.length).toBeGreaterThan(8);
    for (const token of tokens) expect(dark).toContain(`${token}:`);
    expect(css).not.toContain('#app-bootstrap-shell');
  });
  it('declares map connections only for actual map workspaces', () => {
    for (const path of ['/trip/abc', '/s/token', '/example/japan-spring']) {
      expect(getDocumentHints(path).filter(hint => hint.rel === 'preconnect').map(hint => hint.href)).toEqual(['https://api.mapbox.com', 'https://maps.googleapis.com', 'https://maps.gstatic.com']);
    }
    for (const path of ['/', '/pricing', '/blog/post', '/de/inspirations', '/trips']) expect(getDocumentHints(path).some(hint => hint.rel === 'preconnect')).toBe(false);
  });
  it('declares locale fonts in the native head without browser DOM mutation', () => {
    expect(getDocumentHints('/fa/faq').some(hint => hint.href.includes('vazirmatn-arabic'))).toBe(true);
    expect(getDocumentHints('/ru/features').some(hint => hint.href.includes('cyrillic'))).toBe(true);
    expect(getDocumentHints('/pl').some(hint => hint.href.includes('latin-ext'))).toBe(true);
    expect(getDocumentHints('/').some(hint => hint.href.includes('cyrillic'))).toBe(false);
  });
});
