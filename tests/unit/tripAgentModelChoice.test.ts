import { describe, expect, it } from 'vitest';

import { chooseTripAgentModel } from '../../netlify/edge-lib/trip-agent-model.ts';

const inputs = {
    override: '',
    runtimeDefault: 'openrouter:google/gemini-3.8-flash',
    definitionModel: 'openai/gpt-5.6-terra',
    fallbackModel: 'openai/gpt-5.4-mini',
    hasGatewayKey: false,
    hasOpenRouterKey: true,
    hasOpenAiKey: true,
};

describe('chooseTripAgentModel', () => {
    it('follows the app-wide default model so the planner tracks the admin setting', () => {
        expect(chooseTripAgentModel(inputs)).toEqual({
            provider: 'openrouter',
            modelId: 'google/gemini-3.8-flash',
            label: 'openrouter/google/gemini-3.8-flash',
        });
    });

    it('lets an explicit override win over the app default', () => {
        expect(chooseTripAgentModel({ ...inputs, override: 'openai:gpt-5.6-terra' }).provider).toBe('openai');
    });

    it('ignores a default whose provider key is missing', () => {
        const choice = chooseTripAgentModel({ ...inputs, hasOpenRouterKey: false });
        expect(choice.provider).toBe('openai');
        expect(choice.modelId).toBe('gpt-5.4-mini');
    });

    it('reports a configuration failure when no provider key is present', () => {
        expect(() => chooseTripAgentModel({
            ...inputs,
            hasOpenRouterKey: false,
            hasOpenAiKey: false,
        })).toThrow(/TRIP_AGENT_MODEL_NOT_CONFIGURED/);
    });
});
