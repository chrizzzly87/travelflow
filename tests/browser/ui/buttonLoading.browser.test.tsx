// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../../../components/ui/button';

describe('components/ui/button loading state', () => {
    it('renders the leading icon while idle', () => {
        render(<Button icon={<svg data-testid="icon" />}>Save</Button>);
        const button = screen.getByRole('button', { name: 'Save' });
        expect(screen.getByTestId('icon')).toBeInTheDocument();
        expect(button).toBeEnabled();
        expect(button).not.toHaveAttribute('aria-busy');
    });

    it('swaps the icon for the spinner, disables the action and announces busy', () => {
        const { container } = render(<Button icon={<svg data-testid="icon" />} loading>Save</Button>);
        const button = screen.getByRole('button', { name: 'Save' });
        expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
        expect(container.querySelector('svg.animate-spin')).toHaveAttribute('aria-hidden', 'true');
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('keeps an asChild link as its only child', () => {
        render(<Button asChild icon={<svg data-testid="icon" />}><a href="/trips">Trips</a></Button>);
        expect(screen.getByRole('link', { name: 'Trips' })).toHaveAttribute('data-slot', 'button');
        expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
    });
});
