// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppDialogProvider, useAppDialog } from '../../components/AppDialogProvider';

const ConfirmDialogHarness = ({ message }: { message: ReactNode }) => {
    const { confirm } = useAppDialog();
    return (
        <button
            type="button"
            onClick={() => {
                void confirm({
                    title: 'Confirm test',
                    message,
                    confirmLabel: 'Confirm',
                    cancelLabel: 'Cancel',
                });
            }}
        >
            Open test confirm
        </button>
    );
};

describe('AppDialogProvider', () => {
    beforeEach(() => {
        cleanup();
    });

    it('renders children', () => {
        render(
            <AppDialogProvider>
                <div>Dialog host baseline</div>
            </AppDialogProvider>
        );

        expect(screen.getByText('Dialog host baseline')).toBeInTheDocument();
    });

    it('renders rich confirm message content with list and emphasis', async () => {
        const user = userEvent.setup();
        render(
            <AppDialogProvider>
                <ConfirmDialogHarness
                    message={(
                        <div>
                            <p>Delete <strong>"Traveler One"</strong>?</p>
                            <ul>
                                <li>Auth account removed.</li>
                                <li>Profile removed.</li>
                            </ul>
                        </div>
                    )}
                />
            </AppDialogProvider>
        );

        await user.click(screen.getByRole('button', { name: 'Open test confirm' }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText(/Delete/i)).toBeInTheDocument();
        expect(screen.getByText('"Traveler One"')).toBeInTheDocument();
        expect(screen.getByText('Auth account removed.')).toBeInTheDocument();
        expect(screen.getByText('Profile removed.')).toBeInTheDocument();
    });

    it('positions app dialogs bottom-aligned on mobile container layout', async () => {
        const user = userEvent.setup();
        render(
            <AppDialogProvider>
                <ConfirmDialogHarness message="Mobile positioning check" />
            </AppDialogProvider>
        );

        await user.click(screen.getByRole('button', { name: 'Open test confirm' }));
        const dialog = screen.getByRole('dialog');
        const wrapper = dialog.parentElement;
        expect(wrapper).not.toBeNull();
        expect(wrapper?.className).toContain('items-end');
        expect(wrapper?.className).toContain('sm:items-center');
    });
});
