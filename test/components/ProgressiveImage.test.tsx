// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressiveImage } from '../../components/ProgressiveImage';

describe('ProgressiveImage', () => {
    beforeEach(() => {
        cleanup();
        vi.stubEnv('PROD', true);
    });

    it('retries a failed CDN request once using the original resource without picture candidates', () => {
        const onError = vi.fn();
        const { container } = render(<ProgressiveImage src="/images/trip-map.png?v=one" alt="Trip map" width={680} height={288} sizes="340px" srcSetWidths={[340, 560]} onError={onError} />);
        const cdnImage = screen.getByRole('img', { name: 'Trip map' });
        expect(cdnImage.getAttribute('src')).toContain('/.netlify/images?');
        expect(container.querySelectorAll('source')).toHaveLength(2);
        fireEvent.error(cdnImage);

        const original = screen.getByRole('img', { name: 'Trip map' });
        expect(original).toHaveAttribute('src', '/images/trip-map.png?v=one');
        expect(original).not.toHaveAttribute('srcset');
        expect(container.querySelectorAll('source')).toHaveLength(0);
        expect(original).toHaveAttribute('width', '680');
        expect(original).toHaveAttribute('height', '288');
        expect(original).toHaveAttribute('loading', 'lazy');
        expect(original).toHaveAttribute('sizes', '340px');
        expect(onError).not.toHaveBeenCalled();
        fireEvent.load(original);
        expect(original).toHaveClass('opacity-100');
    });

    it('reports an actual original failure once without entering a retry loop', () => {
        const onError = vi.fn();
        render(<ProgressiveImage src="/images/missing.png" alt="Missing" onError={onError} />);
        fireEvent.error(screen.getByRole('img', { name: 'Missing' }));
        const original = screen.getByRole('img', { name: 'Missing' });
        fireEvent.error(original);
        fireEvent.error(original);
        expect(original).toHaveAttribute('src', '/images/missing.png');
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it('reconciles a cached CDN failure and cached original success before handlers attach', () => {
        vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
        vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockImplementation(function (this: HTMLImageElement) {
            return this.getAttribute('src')?.startsWith('/.netlify/images?') ? 0 : 680;
        });
        const onError = vi.fn();
        render(<ProgressiveImage src="/images/cached.png" alt="Cached" onError={onError} />);
        const image = screen.getByRole('img', { name: 'Cached' });
        expect(image).toHaveAttribute('src', '/images/cached.png');
        expect(image).toHaveClass('opacity-100');
        expect(onError).not.toHaveBeenCalled();
    });

    it('reports a cached original failure once', () => {
        vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
        vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
        const onError = vi.fn();
        const { rerender } = render(<ProgressiveImage src="/images/missing.png" alt="Missing" onError={onError} />);
        rerender(<ProgressiveImage src="/images/missing.png" alt="Missing again" onError={onError} />);
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it('starts a fresh CDN lifecycle when the source changes after recovery', () => {
        const onError = vi.fn();
        const { container, rerender } = render(<ProgressiveImage src="/images/first.png" alt="Trip" onError={onError} />);
        fireEvent.error(screen.getByRole('img', { name: 'Trip' }));
        fireEvent.error(screen.getByRole('img', { name: 'Trip' }));
        expect(onError).toHaveBeenCalledTimes(1);
        rerender(<ProgressiveImage src="/images/second.png" alt="Trip" onError={onError} />);
        expect(screen.getByRole('img', { name: 'Trip' }).getAttribute('src')).toContain('second.png');
        expect(container.querySelectorAll('source')).toHaveLength(2);
        fireEvent.error(screen.getByRole('img', { name: 'Trip' }));
        expect(screen.getByRole('img', { name: 'Trip' })).toHaveAttribute('src', '/images/second.png');
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it('does not retry resources already delivered without the CDN', () => {
        const onError = vi.fn();
        render(<ProgressiveImage src="/images/direct.png" alt="Direct" disableCdn onError={onError} />);
        const image = screen.getByRole('img', { name: 'Direct' });
        fireEvent.error(image);
        fireEvent.error(image);
        expect(image).toHaveAttribute('src', '/images/direct.png');
        expect(onError).toHaveBeenCalledTimes(1);
    });

    it('keeps the placeholder while the original retry is pending', () => {
        const { container } = render(<ProgressiveImage src="/images/retry.png" alt="Retry" placeholderBlurhash="LEHV6nWB2yk8pyo0adR*.7kCMdnj" />);
        fireEvent.error(screen.getByRole('img', { name: 'Retry' }));
        expect(container.querySelector('img[aria-hidden="true"]')).not.toBeNull();
        fireEvent.load(screen.getByRole('img', { name: 'Retry' }));
        expect(container.querySelector('img[aria-hidden="true"]')).toBeNull();
    });

    it('does not retry an input already pointing at the image endpoint as its own original', () => {
        const onError = vi.fn();
        const src = '/.netlify/images?url=%2Fimages%2Fdirect.png&w=560';
        render(<ProgressiveImage src={src} alt="Endpoint" onError={onError} />);
        fireEvent.error(screen.getByRole('img', { name: 'Endpoint' }));
        expect(screen.getByRole('img', { name: 'Endpoint' })).toHaveAttribute('src', src);
        expect(onError).toHaveBeenCalledTimes(1);
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
