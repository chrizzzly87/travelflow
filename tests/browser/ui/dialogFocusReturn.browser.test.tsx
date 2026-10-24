// @vitest-environment jsdom
import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Dialog, DialogContent, DialogTitle } from '../../../components/ui/dialog';

function StateDialog({ onCloseAutoFocus }: { onCloseAutoFocus?: (event: Event) => void }) {
    const [open, setOpen] = useState(false);
    return <>
        <button onClick={() => setOpen(true)}>Open details</button>
        <button>Elsewhere</button>
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
                <DialogTitle>Details</DialogTitle>
                <button onClick={() => setOpen(false)}>Done</button>
            </DialogContent>
        </Dialog>
    </>;
}

const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });

describe('components/ui/dialog opened from state', () => {
    it('is announced as modal and hands focus back to the control that opened it', async () => {
        render(<StateDialog />);
        const opener = screen.getByText('Open details');
        opener.focus();
        fireEvent.click(opener);
        expect(await screen.findByRole('dialog')).toHaveAttribute('aria-modal', 'true');
        fireEvent.click(screen.getByText('Done'));
        await settle();
        expect(document.activeElement).toBe(opener);
    });

    it('leaves focus to a caller that handles close focus itself', async () => {
        render(<StateDialog onCloseAutoFocus={event => { event.preventDefault(); screen.getByText('Elsewhere').focus(); }} />);
        const opener = screen.getByText('Open details');
        opener.focus();
        fireEvent.click(opener);
        fireEvent.click(await screen.findByText('Done'));
        await settle();
        expect(document.activeElement).toBe(screen.getByText('Elsewhere'));
    });
});
