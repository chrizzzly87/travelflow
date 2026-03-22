// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import { Button } from '../../../components/ui/button';

describe('components/ui/dropdown-menu', () => {
    afterEach(() => {
        cleanup();
    });

    it('keeps menu layers above the trip workspace shell stack', async () => {
        const user = userEvent.setup({ pointerEventsCheck: 0 });

        render(React.createElement(
            DropdownMenu,
            undefined,
            React.createElement(
                DropdownMenuTrigger,
                { asChild: true },
                React.createElement(Button, { type: 'button' }, 'Open menu'),
            ),
            React.createElement(
                DropdownMenuContent,
                undefined,
                React.createElement(
                    DropdownMenuGroup,
                    undefined,
                    React.createElement(
                        DropdownMenuSub,
                        undefined,
                        React.createElement(DropdownMenuSubTrigger, undefined, 'More actions'),
                        React.createElement(
                            DropdownMenuSubContent,
                            undefined,
                            React.createElement(DropdownMenuItem, undefined, 'Nested action'),
                        ),
                    ),
                    React.createElement(DropdownMenuItem, undefined, 'Primary action'),
                ),
            ),
        ));

        await user.click(screen.getByRole('button', { name: 'Open menu' }));

        const menu = await screen.findByRole('menu');
        expect(menu.className).toContain('z-[1755]');

        await user.hover(screen.getByRole('menuitem', { name: 'More actions' }));

        const submenus = screen.getAllByRole('menu');
        expect(submenus.at(-1)?.className).toContain('z-[1755]');
    });
});
