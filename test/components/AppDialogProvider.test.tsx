// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppDialogProvider } from '../../components/AppDialogProvider';

describe('AppDialogProvider', () => {
    it('renders children', () => {
        render(
            <AppDialogProvider>
                <div>Dialog host baseline</div>
            </AppDialogProvider>
        );

        expect(screen.getByText('Dialog host baseline')).toBeInTheDocument();
    });
});
