import { beforeEach, describe, expect, it, vi } from 'vitest';
const session = vi.hoisted(() => vi.fn());
vi.mock('../../services/supabaseClient', () => ({ supabase: { auth: { getSession: session } } }));
import { getTripVideoState, requestTripVideo, setTripVideoImageSource } from '../../services/tripOgVideoService';

describe('trip preview client', () => {
  beforeEach(() => session.mockResolvedValue({ data: { session: { access_token: 'owner-token' } } }));
  it('uses authenticated async requests without shipping trip contents', async () => {
    const mock = vi.fn(async () => Response.json({ status: 'queued' }, { status: 202 })); vi.stubGlobal('fetch', mock);
    expect(await requestTripVideo('trip', { style: 'dark' })).toMatchObject({ status: 'queued' });
    expect(mock).toHaveBeenCalledWith('/api/og/trip-video?trip=trip', expect.objectContaining({ method: 'POST', body: '{"style":"dark"}', headers: expect.objectContaining({ authorization: 'Bearer owner-token' }) }));
  });
  it('changes image attachment without starting a render', async () => {
    const mock = vi.fn(async () => Response.json({ status: 'ready', posterAsImage: true })); vi.stubGlobal('fetch', mock);
    await setTripVideoImageSource('trip', true);
    expect(mock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: 'PATCH' }));
  });
  it('surfaces budget and authorization failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Hourly render budget reached.' }, { status: 429 })));
    await expect(getTripVideoState('trip')).rejects.toThrow('Hourly render budget');
    session.mockResolvedValue({ data: { session: null } });
    await expect(getTripVideoState('trip')).rejects.toThrow('Sign in');
  });
});
