import { describe, expect, it } from 'vitest';

import { applyOpenRouterReasoning } from '../../netlify/edge-lib/trip-agent-model.ts';

describe('applyOpenRouterReasoning', () => {
    it('merges the SDK reasoning_effort field into reasoning, which OpenRouter rejects as a conflict', () => {
        const body = applyOpenRouterReasoning({ model: 'google/gemini-3.8-flash', reasoning_effort: 'medium' }, 'low');

        expect(body.reasoning_effort).toBeUndefined();
        expect(body.reasoning).toEqual({ effort: 'low' });
    });

    it('keeps other reasoning options while forcing the configured effort', () => {
        const body = applyOpenRouterReasoning({ reasoning: { exclude: true, effort: 'high' } }, 'low');

        expect(body.reasoning).toEqual({ exclude: true, effort: 'low' });
    });

    it('leaves the body untouched when reasoning control is disabled', () => {
        const body = applyOpenRouterReasoning({ reasoning_effort: 'medium' }, 'none');

        expect(body).toEqual({ reasoning_effort: 'medium' });
    });
});
