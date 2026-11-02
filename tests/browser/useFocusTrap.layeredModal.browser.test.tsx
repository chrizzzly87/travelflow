// @vitest-environment jsdom
import React, { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';

function Panel() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [confirming, setConfirming] = useState(false);
    useFocusTrap({ isActive: true, containerRef });
    return <>
        <div ref={containerRef} role="dialog" aria-modal="true" aria-label="Trips">
            <button onClick={() => setConfirming(true)}>Archive</button>
        </div>
        {confirming && createPortal(<div role="alertdialog" aria-modal="true" aria-label="Confirm"><button>Cancel</button><button>Confirm</button></div>, document.body)}
    </>;
}

const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

describe('useFocusTrap with a modal layered above it', () => {
    it('lets a confirm opened from inside the trap keep focus and Tab', async () => {
        render(<Panel />);
        await flush();
        fireEvent.click(screen.getByText('Archive'));
        const confirm = screen.getByText('Confirm');
        confirm.focus();
        expect(document.activeElement).toBe(confirm);
        fireEvent.keyDown(document, { key: 'Tab' });
        expect(document.activeElement).toBe(confirm);
    });

    it('still pulls stray focus back from the page behind', async () => {
        render(<><button>Behind</button><Panel /></>);
        await flush();
        screen.getByText('Behind').focus();
        expect(document.activeElement).toBe(screen.getByText('Archive'));
    });
});
