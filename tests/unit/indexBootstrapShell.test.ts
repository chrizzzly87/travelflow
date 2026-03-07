import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('index.html bootstrap shell', () => {
  const indexHtmlPath = resolve(process.cwd(), 'index.html');
  const html = readFileSync(indexHtmlPath, 'utf8');
  const bootstrapMarkupMatch = html.match(/<div id="app-bootstrap-shell">([\s\S]*?)<div id="root"><\/div>/);
  const bootstrapMarkup = bootstrapMarkupMatch?.[1] ?? '';

  it('renders the branded marketing shell by default', () => {
    expect(html).toContain('id="app-bootstrap-shell"');
    expect(html).toContain('class="tf-boot-header-inner"');
    expect(html).toContain('class="tf-boot-nav"');
    expect(html).toContain('src="/favicon.svg"');
    expect(html).toContain('TravelFlow');
    expect(html).toContain('Features');
    expect(html).toContain('News &amp; Updates');
    expect(html).toContain('Create Trip');
    expect(bootstrapMarkup).not.toContain('class="tf-boot-main"');
    expect(bootstrapMarkup).not.toContain('class="tf-boot-page tf-boot-page--marketing"');
    expect(bootstrapMarkup).not.toContain('class="tf-boot-page tf-boot-page--trip"');
    expect(html).toContain('data-tf-react-shell-visible');
  });

  it('switches only the bootstrap header on trip-like routes before hydration', () => {
    expect(html).toContain("document.documentElement.setAttribute('data-tf-boot-route', 'trip')");
    expect(html).toContain("window.location.pathname || '/'");
    expect(bootstrapMarkup).toContain('class="tf-boot-header tf-boot-header--marketing"');
    expect(bootstrapMarkup).toContain('class="tf-boot-trip-header tf-boot-header--trip"');
    expect(html).toContain('(?:trip|s|example)');
  });
});
