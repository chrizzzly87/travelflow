// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../../../components/ui/badge';

const TONES = [
    ['success', 'bg-emerald-50', 'dark:bg-emerald-400/12'],
    ['warning', 'bg-amber-50', 'dark:bg-amber-400/12'],
    ['danger', 'bg-red-50', 'dark:bg-red-400/12'],
    ['info', 'bg-sky-50', 'dark:bg-sky-400/12'],
    ['accent', 'bg-accent-50', 'dark:bg-accent-400/12'],
    ['neutral', 'bg-secondary', 'border-border'],
] as const;

describe('components/ui/badge tone variants', () => {
    it.each(TONES)('renders the %s tone with its light and dark classes', (tone, lightClass, secondClass) => {
        render(<Badge variant={tone}>{tone}</Badge>);
        const badge = screen.getByText(tone);
        expect(badge).toHaveAttribute('data-variant', tone);
        expect(badge).toHaveClass('rounded-full', 'border', lightClass, secondClass);
    });

    it('lets a caller class override the tone colour and size', () => {
        render(<Badge variant="neutral" className="border-violet-300 bg-violet-50 text-[11px] font-semibold">Premium</Badge>);
        const badge = screen.getByText('Premium');
        expect(badge).toHaveClass('bg-violet-50', 'border-violet-300', 'text-[11px]', 'font-semibold');
        expect(badge).not.toHaveClass('bg-secondary');
        expect(badge).not.toHaveClass('border-border');
        expect(badge).not.toHaveClass('font-medium');
    });

    it('keeps the default variant unchanged', () => {
        render(<Badge>Default</Badge>);
        expect(screen.getByText('Default')).toHaveClass('bg-primary', 'text-primary-foreground');
    });
});
