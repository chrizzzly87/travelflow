// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import SplitFlap, { SPLIT_FLAP_CHARSET_ALPHA } from '../../components/ui/SplitFlap';

describe('SplitFlap', () => {
    it('keeps flap cells mounted across value changes so the drum can animate in place', () => {
        const { container, rerender } = render(
            <SplitFlap value="DXB" length={3} charset={SPLIT_FLAP_CHARSET_ALPHA} />,
        );

        const initialCells = Array.from(container.querySelectorAll('.sf-cell'));
        expect(initialCells).toHaveLength(3);

        rerender(
            <SplitFlap value="HAM" length={3} charset={SPLIT_FLAP_CHARSET_ALPHA} />,
        );

        const nextCells = Array.from(container.querySelectorAll('.sf-cell'));
        expect(nextCells).toHaveLength(3);
        expect(nextCells[0]).toBe(initialCells[0]);
        expect(nextCells[1]).toBe(initialCells[1]);
        expect(nextCells[2]).toBe(initialCells[2]);
    });

    it('uses the requested component defaults for theme and board surface', () => {
        const { container } = render(<SplitFlap value="DXB" />);
        const board = container.querySelector('.sf-board');

        expect(board).toBeTruthy();
        expect(board?.className).toContain('sf-board--light');
        expect(board?.className).toContain('sf-board--board');
        expect(board?.className).toContain('sf-board--md');
    });
});
