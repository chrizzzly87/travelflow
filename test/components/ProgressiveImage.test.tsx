// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProgressiveImage } from '../../components/ProgressiveImage';

describe('ProgressiveImage', () => {
    beforeEach(() => {
        cleanup();
    });

    it('renders with skipFade enabled without throwing and keeps the image visible immediately', () => {
        render(
            <ProgressiveImage
                src="/images/test-photo.webp"
                alt="Test image"
                width={1200}
                height={800}
                skipFade
            />
        );

        const image = screen.getByRole('img', { name: 'Test image' });
        expect(image).toBeInTheDocument();
        expect(image).toHaveClass('opacity-100');
    });
});
