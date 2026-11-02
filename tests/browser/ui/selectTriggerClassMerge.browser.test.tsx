// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select, SelectTrigger, SelectValue } from '../../../components/ui/select';

describe('components/ui/select trigger classes', () => {
    it('lets a caller size override the default height instead of both applying', () => {
        render(<Select><SelectTrigger aria-label="Sort" className="h-9 w-auto"><SelectValue placeholder="Sort" /></SelectTrigger></Select>);
        const trigger = screen.getByRole('combobox', { name: 'Sort' });
        expect(trigger.className).toContain('h-9');
        expect(trigger.className).not.toContain('h-10');
        expect(trigger.className).not.toContain('w-full');
    });
});
