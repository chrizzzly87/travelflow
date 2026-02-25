import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('index.html Netlify contact form scaffold', () => {
  it('contains the static contact form registration markup for SPA deployments', () => {
    const indexHtmlPath = resolve(process.cwd(), 'index.html');
    const html = readFileSync(indexHtmlPath, 'utf8');

    expect(html).toContain('name="contact"');
    expect(html).toContain('data-netlify="true"');
    expect(html).toContain('netlify-honeypot="bot-field"');
    expect(html).toContain('name="form-name" value="contact"');

    for (const fieldName of ['reason', 'name', 'email', 'message', 'currentPath', 'locale', 'userId', 'plan', 'appVersion', 'bot-field']) {
      expect(html).toContain(`name="${fieldName}"`);
    }
  });
});
