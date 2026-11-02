import { act, render, type RenderOptions } from '@testing-library/react';
import type { ReactNode } from 'react';

/** Wait for the native router's initial async match before interacting with a fixture. */
export async function renderWithRouter(ui: ReactNode, options?: RenderOptions) {
    let result!: ReturnType<typeof render>;
    await act(async () => {
        result = render(ui, options);
    });
    return result;
}
