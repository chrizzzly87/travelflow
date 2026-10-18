import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContactFormRegistration } from '../../src/document/ContactFormRegistration';
import { describe, expect, it } from 'vitest';

describe('native document Netlify form registration', () => {
  it('contains the static contact form registration markup for prerendered documents', () => {
    const html = renderToStaticMarkup(React.createElement(ContactFormRegistration));

    expect(html).toContain('name="contact"');
    expect(html).toContain('data-netlify="true"');
    expect(html).toContain('netlify-honeypot="bot-field"');
    expect(html).toContain('name="form-name" value="contact"');

    for (const fieldName of ['reason', 'subReason', 'name', 'email', 'message', 'currentPath', 'lastVisitedPath', 'locale', 'contactSource', 'userId', 'plan', 'appVersion', 'bot-field']) {
      expect(html).toContain(`name="${fieldName}"`);
    }
  });
});
