import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../netlify/edge-functions/ai-personalize-journey.ts';
import { getBundledTravelDestinationPack } from '../../services/travelKnowledgeService';
import {
  JOURNEY_PERSONALIZATION_VERSION,
  buildJourneyPersonalizationContext,
} from '../../shared/journeyPersonalization';
import {
  buildJourneySpecFromShapeWizard,
  type JourneyShapeWizardDraft,
} from '../../shared/journeyShapeWizard';
import { buildTravelPlanningContext } from '../../shared/travelPlanningContext';
import { applyTravelTemplateToJourneySpec } from '../../shared/travelTemplateMatcher';

const fetchMock = vi.fn();
const envValues: Record<string, string | undefined> = {};
const fullPack = getBundledTravelDestinationPack('TH', 'en');
if (!fullPack) throw new Error('Thailand test pack is unavailable.');

const validBody = () => {
  const draft: JourneyShapeWizardDraft = {
    journeyType: 'city_break',
    dateMode: 'flexible',
    durationDays: 4,
    month: 12,
    pace: 'balanced',
    interestTags: ['food', 'culture'],
    maxBaseChanges: 0,
    selectedCitySlug: 'th-bangkok',
    selectedNeighborhoodSlugs: [],
    startDate: '2026-12-01',
    endDate: '2026-12-05',
  };
  const intent = buildJourneySpecFromShapeWizard(draft, fullPack);
  const comparison = buildTravelPlanningContext(fullPack, intent);
  const template = comparison.pack.templates[0]!;
  const applied = applyTravelTemplateToJourneySpec(intent, fullPack, template);
  const deep = buildTravelPlanningContext(fullPack, applied.spec, {
    templateKeys: [template.templateKey],
    templateLimit: 1,
    neighborhoodLimitPerCity: 4,
    poiLimitPerCity: 6,
  });
  return {
    requestId: 'personalization-edge-test',
    version: JOURNEY_PERSONALIZATION_VERSION,
    locale: 'en',
    travelerRequest: 'Make the trip slower and prioritize food.',
    journeySpec: applied.spec,
    context: buildJourneyPersonalizationContext(applied.spec, deep.pack, deep.retrieverVersion),
  };
};

const requestFor = (body: unknown, headers: Record<string, string> = {}) => new Request(
  'https://travelflowapp.netlify.app/api/ai/personalize-journey',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  },
);

describe('journey personalization edge endpoint', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    for (const key of Object.keys(envValues)) delete envValues[key];
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('Deno', { env: { get: (key: string) => envValues[key] } });
    for (const key of [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'GEMINI_API_KEY',
      'AI_JOURNEY_PERSONALIZATION_PROVIDER',
      'AI_JOURNEY_PERSONALIZATION_MODEL',
    ]) {
      envValues[key] = '';
      vi.stubEnv(key, '');
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('rejects malformed JourneySpec context before any provider work', async () => {
    const response = await handler(requestFor({
      version: 1,
      locale: 'en',
      travelerRequest: 'Make this slower.',
      journeySpec: {},
      context: {},
    }), { ip: '10.0.4.1' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'PERSONALIZATION_REQUEST_INVALID' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the fast server-selected model and forwards provider failures safely', async () => {
    envValues.GEMINI_API_KEY = 'test-key';
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'quota' } }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    }));
    const response = await handler(requestFor(validBody()), { ip: '10.0.4.2' });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      code: 'GEMINI_REQUEST_FAILED',
      meta: {
        provider: 'gemini',
        model: 'gemini-2.5-flash-lite',
      },
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/models/gemini-2.5-flash-lite:generateContent');
    const providerRequest = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const providerBody = JSON.parse(String(providerRequest?.body)) as {
      generationConfig?: { responseMimeType?: string; responseJsonSchema?: Record<string, unknown> };
    };
    expect(providerBody.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: 'object',
        additionalProperties: false,
      },
    });
  });

  it('rejects invalid Supabase tokens before a provider call', async () => {
    envValues.VITE_SUPABASE_URL = 'https://supabase.example';
    envValues.VITE_SUPABASE_ANON_KEY = 'anon-key';
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401 }));

    const response = await handler(requestFor(
      validBody(),
      { Authorization: 'Bearer forged-token' },
    ), { ip: '10.0.4.3' });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTH_TOKEN_INVALID' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is registered as a dedicated Netlify edge route', () => {
    const netlifyToml = readFileSync(path.resolve(process.cwd(), 'netlify.toml'), 'utf8');
    expect(netlifyToml).toContain('path = "/api/ai/personalize-journey"\n  function = "ai-personalize-journey"');
  });
});
