import { describe, expect, it } from 'vitest';
import { applyDocumentLocale } from '../../config/locales';

describe('config/locales applyDocumentLocale', () => {
  it('updates html lang/dir and content-language meta', () => {
    document.head.innerHTML = '';
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';

    applyDocumentLocale('de');

    expect(document.documentElement.lang).toBe('de');
    expect(document.documentElement.dir).toBe('ltr');

    const meta = document.querySelector('meta[name="content-language"]');
    expect(meta).not.toBeNull();
    expect(meta?.getAttribute('content')).toBe('de');

    applyDocumentLocale('fr');
    const metas = document.querySelectorAll('meta[name="content-language"]');
    expect(metas.length).toBe(1);
    expect(metas[0].getAttribute('content')).toBe('fr');
  });
});
