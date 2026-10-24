import { describe, expect, it } from 'vitest';
import { cn } from '../../lib/utils';

describe('cn', () => {
    it('lets max-h-none replace a default max-height cap', () => {
        expect(cn('flex max-h-[min(85dvh,48rem)] flex-col', 'max-h-none')).toBe('flex flex-col max-h-none');
    });

    it('keeps ordinary conflict resolution', () => {
        expect(cn('h-10 px-3', 'h-9')).toBe('px-3 h-9');
    });
});
