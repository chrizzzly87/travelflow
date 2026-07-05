import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Netlify contact form scaffold (public/__forms.html)', () => {
  it('contains the static contact form registration markup for the Next.js deployment', () => {
    const indexHtmlPath = resolve(process.cwd(), 'public', '__forms.html');
    const html = readFileSync(indexHtmlPath, 'utf8');

    expect(html).toContain('name="contact"');
    expect(html).toContain('data-netlify="true"');
    expect(html).toContain('netlify-honeypot="bot-field"');
    expect(html).toContain('name="form-name" value="contact"');

    for (const fieldName of ['reason', 'subReason', 'name', 'email', 'message', 'currentPath', 'lastVisitedPath', 'locale', 'contactSource', 'userId', 'plan', 'appVersion', 'bot-field']) {
      expect(html).toContain(`name="${fieldName}"`);
    }
  });
});
