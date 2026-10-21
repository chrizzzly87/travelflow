// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ state: vi.fn(), generate: vi.fn(), asset: vi.fn(), inspect: vi.fn(), source: vi.fn() }));
vi.mock('../../services/tripOgVideoService', () => ({ getTripVideoState: mocks.state, requestTripVideo: mocks.generate, getTripVideoAsset: mocks.asset, setTripVideoImageSource: mocks.source }));
vi.mock('../../services/adminOgToolsService', () => ({ inspectOgUrl: mocks.inspect }));
import { TripOgPreviewPanel } from '../../components/admin/TripOgPreviewPanel';

describe('trip details OG previews', () => {
  afterEach(() => { cleanup(); window.history.replaceState(null, '', '/'); });
  beforeEach(() => {
    mocks.state.mockResolvedValue({ status: 'missing' }); mocks.inspect.mockResolvedValue({ resolvedOgImageUrl: '/api/og/trip?trip=taiwan' });
    mocks.generate.mockResolvedValue({ status: 'queued' }); mocks.asset.mockResolvedValue(new Blob(['mp4'], { type: 'video/mp4' }));
    URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn();
  });
  it('shows the actual attached image and creates video only on explicit action', async () => {
    render(<TripOgPreviewPanel tripId="taiwan" />);
    expect(await screen.findByAltText('Attached trip sharing preview')).toHaveAttribute('src', '/api/og/trip?trip=taiwan');
    expect(mocks.generate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Generate video' }));
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledWith('taiwan', { style: 'standard', routeMode: 'simple', force: false }));
  });
  it('uses authenticated media blobs and releases them when the drawer closes', async () => {
    mocks.state.mockResolvedValue({ status: 'ready', style: 'dark', bytes: 29000 });
    const { unmount } = render(<TripOgPreviewPanel tripId="taiwan" />);
    const video = await screen.findByLabelText('Animated trip route preview');
    expect(video).toHaveAttribute('src', 'blob:preview'); expect(video).not.toHaveAttribute('autoplay');
    unmount(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });
  it('forwards playground map and route settings only after applying, and explicitly refreshes a ready video', async () => {
    window.history.replaceState(null, '', '/admin/og-tools?mapStyle=satellite&routeMode=realistic');
    mocks.state.mockResolvedValue({ status: 'ready', style: 'clean', routeMode: 'simple', bytes: 29000 });
    render(<TripOgPreviewPanel tripId="taiwan" />);
    await screen.findByLabelText('Animated trip route preview');
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(screen.getByText(/These settings differ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply settings' }));
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledWith('taiwan', { style: 'satellite', routeMode: 'realistic', force: true }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Re-render & refresh cache' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Re-render & refresh cache' }));
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledTimes(2));
  });
  it('explains failed generation and lets the admin retry', async () => {
    mocks.state.mockResolvedValue({ status: 'failed', error: 'Map unavailable.' });
    render(<TripOgPreviewPanel tripId="taiwan" />);
    expect(await screen.findByText('Map unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate video' })).toBeEnabled();
  });
});
