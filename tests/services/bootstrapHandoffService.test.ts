// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { hasRenderableHandoffNode } from '../../services/bootstrapHandoffService';

describe('bootstrapHandoffService', () => {
  it('ignores generic route-loading fallbacks when deciding handoff readiness', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-tf-handoff-ready="true">
        <div data-testid="route-loading-shell"></div>
      </div>
    `;

    expect(hasRenderableHandoffNode(root)).toBe(false);
  });

  it('ignores trip route-loading fallbacks when deciding handoff readiness', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-tf-handoff-ready="true">
        <div data-testid="trip-route-loading-shell"></div>
      </div>
    `;

    expect(hasRenderableHandoffNode(root)).toBe(false);
  });

  it('accepts resolved route content as handoff ready', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-tf-handoff-ready="true">
        <section><h1>Real content</h1></section>
      </div>
    `;

    expect(hasRenderableHandoffNode(root)).toBe(true);
  });
});
